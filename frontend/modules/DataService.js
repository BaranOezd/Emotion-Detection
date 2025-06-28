import { LoggingService } from './LoggingService.js';

export class DataService {
  constructor(baseUrl = window.location.origin) {
    this.baseUrl = baseUrl;
    this.counters = this.loadCounters();
    this.aiEnabled = true;
    this.logger = new LoggingService(baseUrl);
    this.currentMode = 'dynamic'; // Default mode
  }
  
  // Counter management
  loadCounters() {
    const savedCounters = localStorage.getItem('interactionCounters');
    return savedCounters ? JSON.parse(savedCounters) : { 
      rewriteCount: 0,
      resetCount: 0,
      sentenceCount: 0  // Add sentence count
    };
  }
  
  saveCounters() {
    localStorage.setItem('interactionCounters', JSON.stringify(this.counters));
  }
  
  updateSentenceCount(count) {
    this.counters.sentenceCount = count;
    this.saveCounters();
  }

  // AI state management
  setAiEnabled(enabled) {
    this.aiEnabled = enabled;
    // Update the mode in logger based on aiEnabled
    if (this.logger && typeof this.logger.setMode === 'function') {
      // If aiEnabled is true, mode is dynamic; otherwise it's determined by this.currentMode
      if (enabled) {
        this.logger.setMode('dynamic');
      } else {
        // Use static as default fallback if currentMode is not set
        this.logger.setMode(this.currentMode || 'static');
      }
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    
    // Also update the logger's mode
    if (this.logger && typeof this.logger.setMode === 'function') {
      this.logger.setMode(mode);
    }
    
    // Update aiEnabled based on mode
    this.aiEnabled = (mode === 'dynamic');
  }

  // Logging wrapper method
  logInteraction(type, data = {}) {
    try {
      // Create base log data without aiEnabled field
      const logData = {
        type: type,
        rewriteCount: this.counters.rewriteCount,
        resetCount: this.counters.resetCount,
        mode: this.currentMode,  // Use mode instead of aiEnabled
        sentenceCount: this.counters.sentenceCount,
        ...data
      };

      // Remove aiEnabled if present in data
      if (logData.aiEnabled !== undefined) {
        delete logData.aiEnabled;
      }

      if (type.startsWith('mode_')) {
        // Extract actual mode name (dynamic, static, simple)
        const mode = type.replace('mode_', '');
        this.setMode(mode); // Update current mode
        
        // Update mode in log data to match the new mode
        logData.mode = mode;
        
        // Use consistent type for all mode changes
        logData.type = 'mode_change';
      }
      
      // Send to logger with the current mode
      if (typeof this.logger.logInteraction === 'function') {
        this.logger.logInteraction(
          logData.type,
          data,
          this.counters,
          this.currentMode // Pass the current mode
        );
      } else {
        console.log('Logged event:', logData);
      }
    } catch (err) {
      console.error('Error logging interaction:', err);
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
      
      // Update sentence count when we get results
      this.updateSentenceCount(data.results.length);
      
      // Log successful analysis with duration in seconds
      const durationInSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
      
      this.logInteraction('api_analyze', {
        text: text, // Include the original text
        textLength: text.length,
        sentenceCount: data.results.length,
        duration: parseFloat(durationInSeconds)
      });

      return data;
    } catch (error) {
      console.error("Error analyzing text:", error);
      
      // Log failed analysis
      const durationInSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
      
      this.logInteraction('api_error', {
        endpoint: 'analyze',
        error: error.message,
        duration: parseFloat(durationInSeconds)
      });
      
      throw error;
    }
  }

  async uploadFile(file) {
    const startTime = performance.now();
    
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
      
      // Log successful upload without file name
      const durationInSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
      
      this.logInteraction('api_upload', {
        fileType: file.type,
        fileSize: file.size,
        sentenceCount: data.results ? data.results.length : 0,
        duration: parseFloat(durationInSeconds)
      });
      
      return data;
    } catch (error) {
      console.error("Error during file upload:", error);
      
      // Log failed upload without file name
      const durationInSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
      
      this.logInteraction('api_error', {
        endpoint: 'upload',
        // Removed: fileName: file.name,
        error: error.message,
        duration: parseFloat(durationInSeconds)
      });
      
      throw error;
    }
  }

  async modifySentence(sentenceData) {
    const startTime = performance.now();
       
    // Capture original emotions and intended emotions
    const originalEmotions = sentenceData.originalEmotions || {};
    const intendedEmotions = sentenceData.emotions || {};
    
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
      
      // Log both intended and actual emotion changes
      const intendedDelta = this.calculateEmotionDelta(originalEmotions, intendedEmotions);
      const actualDelta = this.calculateEmotionDelta(originalEmotions, data.emotion_levels);
      
      const durationInSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
      
      this.logInteraction('emotion_modified', {
        intendedEmotions: intendedDelta,
        actualEmotions: actualDelta,
        duration: parseFloat(durationInSeconds)
      });

      return data;
    } catch (error) {
      console.error("Error modifying sentence:", error);
      
      // Also convert error duration to seconds
      const durationInSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
      
      // Log error without sentence text or ID
      this.logInteraction('api_error', {
        endpoint: 'modify',
        error: error.message,
        duration: parseFloat(durationInSeconds)
      });
      
      throw error;
    }
  }
  
  calculateEmotionDelta(originalEmotions, newEmotions) {
    const emotionDelta = [];
    const significanceThreshold = 0.05; // Only log changes greater than 5%
    
    // Calculate the delta between original and new emotions
    const allEmotions = new Set([...Object.keys(originalEmotions), ...Object.keys(newEmotions)]);
    allEmotions.forEach(emotion => {
      const from = parseFloat(originalEmotions[emotion] || 0);
      const to = parseFloat(newEmotions[emotion] || 0);
      
      // Only include emotions with significant changes
      if (Math.abs(to - from) >= significanceThreshold) {
        emotionDelta.push({
          emotion,
          from: from.toFixed(2),
          to: to.toFixed(2)
        });
      }
    });
    
    return emotionDelta;
  }
  
  // Convenience logging methods
  logResetAction(sentenceData) {
    this.incrementResetCount();
    this.logInteraction('reset_initiated', {});
  }
  
  logHelpClicked() {
    this.logInteraction('help_clicked');
  }
  
  logUploadClicked() {
    this.logInteraction('upload_clicked');
  }

  logEmotionChange(sentenceData, originalEmotions, newEmotions) {
    const emotionDelta = this.calculateEmotionDelta(originalEmotions, newEmotions);
    this.logInteraction('emotion_modified', { emotionDelta });
  }
}
