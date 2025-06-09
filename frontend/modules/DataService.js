import { LoggingService } from './LoggingService.js';

export class DataService {
  constructor(baseUrl = window.location.origin) {
    this.baseUrl = baseUrl;
    this.counters = this.loadCounters();
    this.aiEnabled = true;
    this.logger = new LoggingService(baseUrl);
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

  // Logging wrapper method
  logInteraction(type, data = {}) {
    return this.logger.logInteraction(type, data, this.counters, this.aiEnabled);
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
      
      // Log successful analysis with duration in seconds
      const durationInSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
      
      this.logInteraction('api_analyze', {
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
        // Removed: fileName: file.name, 
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
      
      // Convert duration from milliseconds to seconds with 2 decimal places
      const durationInSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
      
      this.logInteraction('emotion_modified', {
        emotionDelta,
        duration: parseFloat(durationInSeconds) // Convert to number after formatting
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
