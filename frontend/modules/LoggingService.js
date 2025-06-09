/**
 * Logging service that handles tracking user interactions and sending logs to the server
 */
export class LoggingService {
  constructor(baseUrl = window.location.origin) {
    this.baseUrl = baseUrl;
    this.userId = this.getOrCreateUserId();
    this.sessionId = this.generateSessionId();
    this.logQueue = [];
    this.flushInterval = setInterval(() => this.flushLogs(), 30000);
    window.addEventListener('beforeunload', () => this.flushLogs());
    
    // Tracking variables for differential logging
    this._lastCounters = {};
    this._lastAiEnabled = true;
  }
  
  // User ID and session tracking methods
  getOrCreateUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      userId = (timestamp + random) % 101;
      if (userId === 0) userId = 1;
      localStorage.setItem('userId', userId);
    }
    return parseInt(userId, 10);
  }
  
  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  // Core logging functionality
  logInteraction(type, data = {}, counters = {}, aiEnabled = true) {
    // Create an optimized log structure
    const log = {
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      type,
      // Only include counters that changed since last log
      ...(this._hasCounterChanged('rewriteCount', counters.rewriteCount) && 
          { rewriteCount: counters.rewriteCount }),
      ...(this._hasCounterChanged('resetCount', counters.resetCount) && 
          { resetCount: counters.resetCount }),
      // Only include aiEnabled when it changes or for specific events
      ...(this._lastAiEnabled !== aiEnabled || type === 'ai_toggle' ? 
          { aiEnabled } : {}),
      // Add filtered data
      ...this._filterLogData(type, data)
    };
    
    // Update tracking values
    this._updateTrackedValues(counters, aiEnabled);
    
    this.logQueue.push(log);
    
    if (this.logQueue.length > 20) {
      this.flushLogs();
    }
    
    console.log('[LoggingService] Logged interaction:', log);
    return log;
  }
  
  // Helper methods for tracking changes
  _hasCounterChanged(counterName, newValue) {
    if (newValue === undefined) return false;
    const hasChanged = this._lastCounters[counterName] !== newValue;
    return hasChanged;
  }
  
  _updateTrackedValues(counters, aiEnabled) {
    Object.entries(counters).forEach(([key, value]) => {
      if (value !== undefined) {
        this._lastCounters[key] = value;
      }
    });
    this._lastAiEnabled = aiEnabled;
  }
  
  // Data filtering logic
  _filterLogData(type, data) {
    const filteredData = {};
    
    if (type === 'emotion_modified' && data.emotionDelta) {
      // Only include significant emotion changes
      filteredData.emotionDelta = data.emotionDelta.filter(delta => {
        const fromVal = parseFloat(delta.from);
        const toVal = parseFloat(delta.to);
        return Math.abs(toVal - fromVal) >= 0.05; // 5% threshold
      });
      
      if (data.duration) {
        filteredData.duration = parseFloat(data.duration.toFixed(2));
      }
    } else if (type === 'api_error') {
      if (data.error) {
        const errorMatch = data.error.match(/^([^:]+):/);
        filteredData.errorType = errorMatch ? errorMatch[1] : 'Unknown';
      }
      
      if (data.duration) {
        filteredData.duration = parseFloat(data.duration.toFixed(2));
      }
    } else {
      Object.keys(data).forEach(key => {
        // Skip sensitive fields
        const skipFields = ['sentence', 'newSentence', 'context'];
        if (!skipFields.includes(key)) {
          filteredData[key] = data[key];
        }
      });
    }
    
    return filteredData;
  }

  // Batch handling and optimization
  _optimizeBatch(logs) {
    if (logs.length <= 1) return logs;
    
    const optimizedLogs = [logs[0]];
    
    for (let i = 1; i < logs.length; i++) {
      const currentLog = logs[i];
      const previousLog = logs[i-1];
      
      // If same type event within 500ms, consider merging or skipping
      if (currentLog.type === previousLog.type && 
          this._getTimeDiff(currentLog.timestamp, previousLog.timestamp) < 500) {
        
        // Skip duplicate events that occur in rapid succession
        if (['help_clicked', 'upload_clicked'].includes(currentLog.type)) {
          optimizedLogs[optimizedLogs.length-1] = currentLog;
          continue;
        }
      }
      
      optimizedLogs.push(currentLog);
    }
    
    return optimizedLogs;
  }
  
  _getTimeDiff(timestamp1, timestamp2) {
    return new Date(timestamp1).getTime() - new Date(timestamp2).getTime();
  }

  // Network communication
  async flushLogs() {
    if (this.logQueue.length === 0) return;
    
    const logsToSend = this._optimizeBatch([...this.logQueue]);
    this.logQueue = [];
    
    try {
      await this.sendLogs(logsToSend);
    } catch (error) {
      console.error('Error sending logs:', error);
      this.logQueue = [...logsToSend, ...this.logQueue];
    }
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
