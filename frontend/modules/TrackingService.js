export class TrackingService {
  constructor() {
    // Initialize user ID
    this.userId = this.getOrCreateUserId();
    this.aiEnabled = true;
    this.sessionId = this.generateSessionId();
    
    // Initialize counters
    this.counters = this.loadCounters();
    
    // Queue to store logs before sending
    this.logQueue = [];
    
    // Set up periodic flush of logs every 30 seconds
    this.flushInterval = setInterval(() => this.flushLogs(), 30000);
    
    // Set up flush on page unload
    window.addEventListener('beforeunload', () => this.flushLogs());
  }
  
  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  getOrCreateUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = Math.floor(Math.random() * 501); // Integer between 0-500
      localStorage.setItem('userId', userId);
    }
    return parseInt(userId, 10);
  }
  
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
  
  setAiEnabled(enabled) {
    this.aiEnabled = enabled;
    // Remove the redundant 'enabled' property, as we already have aiEnabled
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
  
  logEmotionChange(sentenceData, originalEmotions, newEmotions) {
    const emotionDelta = [];
    
    // Calculate the delta between original and new emotions
    const allEmotions = new Set([...Object.keys(originalEmotions), ...Object.keys(newEmotions)]);
    allEmotions.forEach(emotion => {
      const from = originalEmotions[emotion] || 0;
      const to = newEmotions[emotion] || 0;
      
      if (from !== to) {
        emotionDelta.push({
          emotion,
          from: parseFloat(from).toFixed(2),
          to: parseFloat(to).toFixed(2)
        });
      }
    });
    
    this.logInteraction('emotion_modified', {
      sentenceId: sentenceData.index,
      sentence: sentenceData.sentence,
      emotionDelta
    });
  }
  
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
    
    // If queue gets too large, flush it immediately
    if (this.logQueue.length > 20) {
      this.flushLogs();
    }
    
    console.log('[TrackingService] Logged interaction:', log);
    return log;
  }
  
  async flushLogs() {
    if (this.logQueue.length === 0) return;
    
    const logsToSend = [...this.logQueue];
    this.logQueue = [];
    
    try {
      const response = await fetch('/log-interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logsToSend)
      });
      
      if (!response.ok) {
        console.error('Failed to send logs:', response.statusText);
        // Put logs back in queue
        this.logQueue = [...logsToSend, ...this.logQueue];
      }
    } catch (error) {
      console.error('Error sending logs:', error);
      // Put logs back in queue
      this.logQueue = [...logsToSend, ...this.logQueue];
    }
  }
}
