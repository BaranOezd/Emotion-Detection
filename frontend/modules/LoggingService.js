/**
 * Logging service that handles tracking user interactions and sending logs to the server
 */
export class LoggingService {
  constructor(baseUrl = window.location.origin) {
    this.baseUrl = baseUrl;
    this.userId = null; // Will be set asynchronously
    this.sessionId = this.generateSessionId();
    this.logQueue = [];
    this.flushInterval = setInterval(() => this.flushLogs(), 30000);
    window.addEventListener('beforeunload', () => this.flushLogs());
    
    // Tracking variables for differential logging
    this._lastCounters = {};
    this._lastAiEnabled = true;

    // Only prompt for userId if not already set
    this._initUserId();
  }

  async _initUserId() {
    // Only prompt if not already in localStorage
    this.userId = await this.getUserIdFromModal();
  }

  // User ID logic using modal
  getUserIdFromModal() {
    let userId = localStorage.getItem('userId');
    if (userId) {
      userId = userId.trim().toLowerCase();
      if (userId) {
        localStorage.setItem('userId', userId);
        return Promise.resolve(userId);
      }
    }

    // Show modal
    const modal = document.getElementById('userIdModal');
    const input = document.getElementById('userIdInput');
    const button = document.getElementById('userIdSubmitButton');
    modal.classList.remove('hidden');
    input.value = '';
    input.focus();

    return new Promise(resolve => {
      const submit = () => {
        let val = input.value.trim().toLowerCase();
        if (val) {
          localStorage.setItem('userId', val);
          modal.classList.add('hidden');
          resolve(val);
        } else {
          input.focus();
        }
      };
      button.onclick = submit;
      input.onkeydown = e => {
        if (e.key === 'Enter') submit();
      };
    });
  }

  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  // Core logging functionality
  logInteraction(type, data = {}, counters = {}, aiEnabled = true) {
    // If userId is a Promise (not yet resolved), skip logging until resolved
    if (!this.userId || typeof this.userId.then === 'function') return;

    // Always use trimmed, lowercased userId
    const safeUserId = typeof this.userId === 'string' ? this.userId.trim().toLowerCase() : this.userId;

    // Do not log api_analyze events
    if (type === 'api_analyze') return;

    // Always include rewriteCount, resetCount, aiEnabled, and sentenceCount in every log
    const log = {
      userId: safeUserId,
      sessionId: this.sessionId,
      timestamp: this._getCETTimestamp(),
      type,
      rewriteCount: counters.rewriteCount,
      resetCount: counters.resetCount,
      aiEnabled: aiEnabled,
      sentenceCount:
        (typeof counters.sentenceCount !== "undefined" && counters.sentenceCount !== null)
          ? counters.sentenceCount
          : (typeof data.sentenceCount !== "undefined" ? data.sentenceCount : undefined),
      ...this._filterLogData(type, data)
    };

    // Update tracking values
    this._updateTrackedValues(counters, aiEnabled);
    this.logQueue.push(log);

    if (this.logQueue.length > 20) {
      this.flushLogs();
    }

    //console.log('[LoggingService] Logged interaction:', log);
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

  // CET timestamp helper
  _getCETTimestamp() {
    const date = new Date();
    // Central European Time (CET/CEST) is UTC+1 or UTC+2 (with DST)
    // Use 'Europe/Berlin' as a canonical CET/CEST zone
    const options = {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    // Format: DD.MM.YYYY HH:mm:ss
    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
    const get = type => parts.find(p => p.type === type)?.value;
    return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
  }
}
