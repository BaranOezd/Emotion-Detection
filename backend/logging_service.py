import os
import json
import time
from datetime import datetime
from pathlib import Path

class LoggingService:
    def __init__(self, base_dir="user_logs"):
        """Initialize the logging service with a base directory for logs."""
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(exist_ok=True, parents=True)
        
        # Create a simple in-memory cache for recent logs
        self.log_cache = {}
        self.cache_limit = 1000  # Maximum logs to keep in memory per user
    
    def store_logs(self, logs):
        """Store multiple logs at once."""
        if not isinstance(logs, list):
            logs = [logs]
            
        # Group logs by user ID
        user_logs = {}
        for log in logs:
            user_id = log.get('userId')
            if user_id is not None:
                if user_id not in user_logs:
                    user_logs[user_id] = []
                user_logs[user_id].append(log)
        
        # Store logs for each user
        stored_count = 0
        for user_id, user_log_list in user_logs.items():
            self._store_user_logs(user_id, user_log_list)
            stored_count += len(user_log_list)
        
        return stored_count
    
    def _filter_emotion_changes(self, emotion_data, threshold=0.1):
        """Filter emotion delta to keep only significant changes.
        Can be applied to both log filtering and statistics analysis."""
        try:
            from_val = float(emotion_data.get('from', 0))
            to_val = float(emotion_data.get('to', 0))
            return abs(from_val - to_val) >= threshold
        except (ValueError, TypeError):
            return False
    
    def _store_user_logs(self, user_id, logs):
        """Store logs for a specific user."""
        # Ensure user directory exists
        user_dir = self.base_dir / str(user_id)
        user_dir.mkdir(exist_ok=True)
        
        # Get today's log file
        today = datetime.now().strftime("%Y-%m-%d")
        log_file = user_dir / f"{today}.jsonl"
        
        # Filter emotion deltas before storing
        filtered_logs = []
        for log in logs:
            if log.get('type') == 'emotion_modified' and 'emotionDelta' in log:
                # Only keep emotion entries with significant changes
                log['emotionDelta'] = [
                    delta for delta in log.get('emotionDelta', [])
                    if self._filter_emotion_changes(delta)
                ]
            filtered_logs.append(log)
        
        # Append logs to file
        with open(log_file, 'a', encoding='utf-8') as f:
            for log in filtered_logs:
                f.write(json.dumps(log) + '\n')
        
        # Update in-memory cache
        if user_id not in self.log_cache:
            self.log_cache[user_id] = []
        
        self.log_cache[user_id].extend(filtered_logs)
        # Trim cache if it gets too large
        if len(self.log_cache[user_id]) > self.cache_limit:
            self.log_cache[user_id] = self.log_cache[user_id][-self.cache_limit:]
    
    def get_user_logs(self, user_id, limit=100, start_date=None, end_date=None):
        """Retrieve logs for a specific user with optional date filtering."""
        if not isinstance(user_id, str):
            user_id = str(user_id)
            
        user_dir = self.base_dir / user_id
        if not user_dir.exists():
            return []
        
        # If we have enough logs in cache and no date filtering, use cache
        if not start_date and not end_date and user_id in self.log_cache and len(self.log_cache[user_id]) >= limit:
            return self.log_cache[user_id][-limit:]
        
        # Otherwise, read from files
        logs = []
        log_files = sorted(user_dir.glob("*.jsonl"), reverse=True)
        
        for log_file in log_files:
            if len(logs) >= limit:
                break
                
            try:
                file_date = datetime.strptime(log_file.stem, "%Y-%m-%d")
                if start_date and file_date < start_date:
                    continue
                if end_date and file_date > end_date:
                    continue
                    
                with open(log_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        try:
                            log = json.loads(line.strip())
                            logs.append(log)
                            if len(logs) >= limit:
                                break
                        except json.JSONDecodeError:
                            continue
            except Exception as e:
                print(f"Error reading log file {log_file}: {e}")
                continue
        
        return logs[-limit:] if limit else logs
    
    def get_emotion_delta_stats(self, user_id=None, start_date=None, end_date=None):
        """Analyze emotion delta patterns for users or a specific user."""
        stats = {
            'total_modifications': 0,
            'emotion_changes': {},
            'users_analyzed': 0
        }
        
        if user_id:
            # Get statistics for a specific user
            logs = self.get_user_logs(user_id, limit=None, start_date=start_date, end_date=end_date)
            self._analyze_emotion_logs(logs, stats)
            stats['users_analyzed'] = 1
        else:
            # Get statistics across all users
            for user_dir in self.base_dir.iterdir():
                if user_dir.is_dir():
                    user_logs = self.get_user_logs(user_dir.name, limit=None, start_date=start_date, end_date=end_date)
                    self._analyze_emotion_logs(user_logs, stats)
                    stats['users_analyzed'] += 1
        
        return stats
    
    def _analyze_emotion_logs(self, logs, stats):
        """Helper method to analyze emotion logs for statistics."""
        for log in logs:
            if log.get('type') == 'emotion_modified' and 'emotionDelta' in log:
                stats['total_modifications'] += 1
                
                # Only consider emotions with significant changes (using a higher threshold for stats)
                for delta in log.get('emotionDelta', []):
                    emotion = delta.get('emotion')
                    if not emotion:
                        continue
                        
                    # Only process emotions with actual value changes
                    if not self._filter_emotion_changes(delta, threshold=0.1):
                        continue
                    
                    try:    
                        from_val = float(delta.get('from', 0))
                        to_val = float(delta.get('to', 0))
                        
                        # Initialize emotion stats if not already present
                        if emotion not in stats['emotion_changes']:
                            stats['emotion_changes'][emotion] = {
                                'count': 0,
                                'avg_from': 0,
                                'avg_to': 0,
                                'total_from': 0,
                                'total_to': 0
                            }
                        
                        # Update emotion stats
                        emotion_stats = stats['emotion_changes'][emotion]
                        emotion_stats['count'] += 1
                        emotion_stats['total_from'] += from_val
                        emotion_stats['total_to'] += to_val
                        
                        # Update averages
                        emotion_stats['avg_from'] = emotion_stats['total_from'] / emotion_stats['count']
                        emotion_stats['avg_to'] = emotion_stats['total_to'] / emotion_stats['count']
                    except (ValueError, TypeError):
                        continue
        
        return stats
