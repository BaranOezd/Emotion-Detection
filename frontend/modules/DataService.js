export class DataService {
  constructor(baseUrl = window.location.origin) {
    this.baseUrl = baseUrl;
    this.userId = this.getOrCreateUserId();
    this.sessionId = this.generateSessionId();
    this.logQueue = [];
    this.counters = this.loadCounters();
    this.aiEnabled = true;
    
    // Set up periodic flush of logs
    this.flushInterval = setInterval(() => this.flushLogs(), 30000);
    
    // Set up flush on page unload
    window.addEventListener('beforeunload', () => this.flushLogs());
  }
  
  // User ID and session tracking
  getOrCreateUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      // Generate more unique ID: timestamp + random component, limited to range 0-100
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      
      // Simple hashing to get a number between 0-100
      userId = (timestamp + random) % 101;
      
      // Add a quick check to avoid the extremely rare case of userId=0
      if (userId === 0) userId = 1;
      
      localStorage.setItem('userId', userId);
    }
    return parseInt(userId, 10);
  }
  
  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
  
  // Counter management
  loadCounters() {
    const savedCounters = localStorage.getItem('interactionCounters');
    return savedCounters ? JSON.parse(savedCounters) : { 
      rewriteCount: 0,
      resetCount: 0
    };
  }
  
  saveCounters() {
    localStorage.setItem('interactionCounters', JSON.stringify(this.counters));
  }
  
  // AI state management
  setAiEnabled(enabled) {
    this.aiEnabled = enabled;
    this.logInteraction('ai_toggle');
  }
  
  incrementRewriteCount() {
    this.counters.rewriteCount++;
    this.saveCounters();
    return this.counters.rewriteCount;
  }
  
  incrementResetCount() {
    this.counters.resetCount++;
    this.saveCounters();
    return this.counters.resetCount;
  }

  // Logging core functionality
  logInteraction(type, data = {}) {
    const log = {
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      type,
      aiEnabled: this.aiEnabled,
      rewriteCount: this.counters.rewriteCount,
      resetCount: this.counters.resetCount,
      ...data
    };
    
    this.logQueue.push(log);
    
    if (this.logQueue.length > 20) {
      this.flushLogs();
    }
    
    console.log('[DataService] Logged interaction:', log);
    return log;
  }
  
  async flushLogs() {
    if (this.logQueue.length === 0) return;
    
    const logsToSend = [...this.logQueue];
    this.logQueue = [];
    
    try {
      await this.sendLogs(logsToSend);
    } catch (error) {
      console.error('Error sending logs:', error);
      // Put logs back in queue
      this.logQueue = [...logsToSend, ...this.logQueue];
    }
  }

  // API Methods with integrated tracking
  async analyzeText(text) {
    const startTime = performance.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
        throw new Error("Invalid or empty response from server");
      }
      
      // Log successful analysis
      this.logInteraction('api_analyze', {
        textLength: text.length,
        sentenceCount: data.results.length,
        duration: performance.now() - startTime
      });

      return data;
    } catch (error) {
      console.error("Error analyzing text:", error);
      
      // Log failed analysis
      this.logInteraction('api_error', {
        endpoint: 'analyze',
        error: error.message,
        duration: performance.now() - startTime
      });
      
      throw error;
    }
  }

  async uploadFile(file) {
    const startTime = performance.now();
    this.logInteraction('upload_clicked');
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${this.baseUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Log successful upload
      this.logInteraction('api_upload', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        sentenceCount: data.results ? data.results.length : 0,
        duration: performance.now() - startTime
      });
      
      return data;
    } catch (error) {
      console.error("Error during file upload:", error);
      
      // Log failed upload
      this.logInteraction('api_error', {
        endpoint: 'upload',
        fileName: file.name,
        error: error.message,
        duration: performance.now() - startTime
      });
      
      throw error;
    }
  }

  async modifySentence(sentenceData) {
    const startTime = performance.now();
    this.incrementRewriteCount();
    
    // Capture original emotions to track delta later
    const originalEmotions = sentenceData.originalEmotions || {};
    
    const payload = {
      sentence: sentenceData.sentence,
      new_emotions: sentenceData.emotions,
      context: document.getElementById("textEditor")?.innerText || "",
    };

    try {
      const response = await fetch(`${this.baseUrl}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Modify failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }
      
      // Log emotion deltas without sentence text or ID
      const emotionDelta = this.calculateEmotionDelta(originalEmotions, data.emotion_levels);
      
      this.logInteraction('emotion_modified', {
        emotionDelta,
        duration: performance.now() - startTime
      });

      return data;
    } catch (error) {
      console.error("Error modifying sentence:", error);
      
      // Log error without sentence text or ID
      this.logInteraction('api_error', {
        endpoint: 'modify',
        error: error.message,
        duration: performance.now() - startTime
      });
      
      throw error;
    }
  }
  
  calculateEmotionDelta(originalEmotions, newEmotions) {
    const emotionDelta = [];
    
    // Calculate the delta between original and new emotions
    const allEmotions = new Set([...Object.keys(originalEmotions), ...Object.keys(newEmotions)]);
    allEmotions.forEach(emotion => {
      const from = originalEmotions[emotion] || 0;
      const to = newEmotions[emotion] || 0;
      
      emotionDelta.push({
        emotion,
        from: parseFloat(from).toFixed(2),
        to: parseFloat(to).toFixed(2)
      });
    });
    
    return emotionDelta;
  }
  
  logResetAction(sentenceData) {
    this.incrementResetCount();
    this.logInteraction('reset_initiated', {
    });
  }
  
  logHelpClicked() {
    this.logInteraction('help_clicked');
  }
  
  logUploadClicked() {
    this.logInteraction('upload_clicked');
  }

  // Add logEmotionChange method
  logEmotionChange(sentenceData, originalEmotions, newEmotions) {
    const emotionDelta = this.calculateEmotionDelta(originalEmotions, newEmotions);
    
    this.logInteraction('emotion_modified', {
      emotionDelta
    });
  }

  async sendLogs(logs) {
    try {
      const response = await fetch(`${this.baseUrl}/log-interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Logging failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error logging interactions:", error);
      throw error;
    }
  }
}
