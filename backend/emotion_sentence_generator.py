import re
import openai
import json
import numpy as np
import asyncio
import aiohttp
import time
import os
from datetime import datetime
from backend.Emotions_analyzer import EmotionsAnalyzer

# Read the OpenAI API key from the file
with open(r"C:\Users\seyit\Desktop\openAIToken.txt", "r") as file:
    api_key = file.read().strip()

if not api_key:
    raise Exception("The OPENAI_API_KEY is not set in the file.")

# Set the OpenAI API key for authentication
openai.api_key = api_key

class SentenceGenerator:
    def __init__(self, model_name="gpt-4o-mini", max_tokens=100, max_attempts=3, emotion_threshold=0.05, analyzer=None):
        """
        Initialize the generator with the specified OpenAI model.
        :param model_name: The name of the OpenAI model to use.
        :param max_tokens: Maximum tokens for the generated response.
        :param max_attempts: Maximum number of attempts to generate a matching sentence.
        :param emotion_threshold: Maximum acceptable difference between intended and actual emotions.
        :param analyzer: An instance of EmotionsAnalyzer for emotion analysis.
        """
        self.model_name = model_name
        self.max_tokens = max_tokens
        self.max_attempts = 3  # Force max_attempts to 3 batches
        self.emotion_threshold = 0.05  # Threshold for top 3 emotions
        # Use the provided analyzer or create a new one
        self.analyzer = analyzer if analyzer else EmotionsAnalyzer(model_name="SamLowe/roberta-base-go_emotions")
        self.batch_size = 15  # Total sentences per batch
        self.keep_best = 3   # Keep only top 3 sentences for next batch
        self.perfect_match_threshold = 0.05  # Add threshold for perfect matches
        self.early_stop_threshold = 0.1  # More lenient threshold for early stopping

        # Set up logging
        self.log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
        os.makedirs(self.log_dir, exist_ok=True)

    def _create_new_log(self):
        """Create a new log file for each sentence generation attempt"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return os.path.join(self.log_dir, f"sentence_generation_{timestamp}.txt")

    def _log(self, message, log_file, console=True):
        """Log message to file and optionally console"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] {message}"
        
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_message + "\n")
        
        if console:
            print(message)

    async def _generate_sentences_batch(self, sentences, user_top_emotions, context_text):
        """Generate multiple sentences concurrently"""
        tasks = []
        sentences_per_source = max(1, self.batch_size // len(sentences))  # Distribute batch size evenly
        total_sentences = len(sentences) * sentences_per_source
        print(f"\nGenerating {total_sentences} sentences (using {len(sentences)} seed sentences)...")
        
        async with aiohttp.ClientSession() as session:
            for sentence in sentences:
                for _ in range(sentences_per_source):
                    task = self._generate_sentence_async(session, sentence, user_top_emotions, context_text)
                    tasks.append(task)
            
            # Process sentences as they complete
            completed = []
            for task in asyncio.as_completed(tasks):
                sentence = await task
                completed.append(sentence)
                print(f"\nSentence {len(completed)}/{total_sentences} generated:")
                print(f"Text: {sentence[:100]}...")
            
            return completed

    def generate_modified_sentence(self, original_sentence, new_emotion_levels, context_text=None):
        log_file = self._create_new_log()
        self.current_log_file = log_file  # Store current log file for scoring
        start_time = time.time()
        self._log("\n" + "="*80, log_file)
        self._log("Starting New Sentence Generation", log_file)
        self._log(f"Original sentence: {original_sentence}", log_file)
        self._log(f"Target emotions: {new_emotion_levels}", log_file)
        if context_text:
            self._log(f"Context: {context_text}", log_file)
        
        # Normalize emotion keys to match the model's expected format
        target_emotions = self._normalize_emotion_keys(new_emotion_levels)
        
        # Identify the user's top three emotions from the input and normalize to two decimals
        user_top_emotions = {k: round(v, 2) for k, v in sorted(target_emotions.items(), key=lambda x: x[1], reverse=True)[:3]}
        print(f"User's top three emotions (normalized): {user_top_emotions}")
        
        # Initialize the batch system
        best_sentences = [original_sentence]  # Start with the original sentence
        best_rmse = float('inf')
        best_sentence = original_sentence
        overall_best_rmse = float('inf')
        overall_best_sentence = original_sentence
        overall_best_emotions = None
        overall_best_score = float('inf')
        
        for attempt in range(self.max_attempts):
            batch_start = time.time()
            self._log(f"\nBatch {attempt + 1}/{self.max_attempts}", log_file)
            
            # Create and run a new event loop for each batch
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                batch = loop.run_until_complete(
                    self._generate_sentences_batch(best_sentences, user_top_emotions, context_text)
                )
            finally:
                loop.close()
            
            print("\nAnalyzing emotions for generated sentences...")
            batch_results = []
            
            # Process and analyze sentences one by one
            for idx, sentence in enumerate(batch, 1):
                emotions = self.analyzer.analyze_emotions(sentence)
                rmse, matches = self._calculate_rmse(user_top_emotions, emotions)
                
                self._log(f"\nCandidate {idx}:", log_file)
                self._log(f"RMSE: {rmse:.4f}", log_file)
                self._log(f"Matching emotions: {matches}/3", log_file)
                self._log(f"Text: {sentence}", log_file)
                
                batch_results.append((sentence, emotions, rmse, matches))
            
            # Sort by RMSE, using matches as secondary criteria
            batch_results.sort(key=lambda x: (x[2], -x[3]))
            
            # Show which sentences are selected for the next batch
            selected_sentences = batch_results[:self.keep_best]
            print(f"\nSelected {self.keep_best} best sentences for next batch:")
            for idx, (sentence, _, rmse, matches) in enumerate(selected_sentences, 1):
                print(f"{idx}. RMSE {rmse:.4f} (matches: {matches}/3): {sentence[:100]}...")
            
            batch_end = time.time()
            self._log(f"Batch completed in {batch_end - batch_start:.2f} seconds", log_file)
            
            # Update overall best if this batch has a better sentence
            if batch_results[0][2] < overall_best_rmse:
                overall_best_rmse = batch_results[0][2]
                overall_best_sentence = batch_results[0][0]
                overall_best_emotions = batch_results[0][1]
                print(f"\nNew best sentence found with RMSE {overall_best_rmse:.4f}")
                self._log(f"\nNew best sentence found!", log_file)
                self._log(f"RMSE: {overall_best_rmse:.4f}", log_file)
                self._log(f"Matching emotions: {batch_results[0][3]}/3", log_file)
                
                # Only stop early if we find an extremely good match
                if overall_best_rmse <= self.perfect_match_threshold:
                    total_time = time.time() - start_time
                    self._log(f"\n✓ Found perfect match! Stopping early.", log_file)
                    self._log(f"Total generation time: {total_time:.2f} seconds", log_file)
                    return overall_best_sentence
            
            # Keep best sentences for next iteration
            best_sentences = [sent for sent, _, _, _ in batch_results[:self.keep_best]]
            
            batch_end = time.time()
            self._log(f"Batch {attempt + 1} completed in {batch_end - batch_start:.2f} seconds", log_file)
        
        total_time = time.time() - start_time
        print("\n! Returning best sentence after all batches")
        print(f"Best RMSE achieved: {overall_best_rmse:.4f}")
        print(f"Total generation time: {total_time:.2f} seconds")
        
        # Log final selection at the end
        self._log("\n" + "="*50, log_file)
        self._log("Final Selected Sentence:", log_file)
        self._log(f"RMSE: {overall_best_rmse:.4f}", log_file)
        self._log(f"Sentence: {overall_best_sentence}", log_file)
        self._log("Final Emotions:", log_file)
        
        # Get and normalize top 3 emotions
        top_final = dict(sorted(overall_best_emotions.items(), key=lambda x: x[1], reverse=True)[:3])
        total = sum(top_final.values())
        normalized_final = {k: round(v/total, 2) for k, v in top_final.items()}
        
        for emotion, value in normalized_final.items():
            self._log(f"  - {emotion}: {value:.2f}", log_file)
            
        # Verify normalization
        total = sum(normalized_final.values())
        self._log(f"Total (should be 1.00): {total:.2f}", log_file)
        
        return overall_best_sentence

    async def _generate_sentence_async(self, session, original_sentence, target_emotions, context_text=None):
        """Async version of sentence generation"""
        # Format target emotions to two decimals for the prompt
        formatted_target = {k: round(v, 2) for k, v in target_emotions.items()}
        prompt = (
            f"Below is the original sentence:\n\"{original_sentence}\"\n\n"
            f"The new desired emotion levels are:\n{json.dumps(formatted_target, indent=2)}\n\n"
        )
        if context_text:
            prompt += f"\n\nAdditional context:\n{context_text}"
        prompt += (
            "Please generate a new sentence that retains the original context and is similar in length, "
            "but reflects these specific emotional values. Focus on matching the top three emotions provided. "
            "Adjust the tone accordingly without changing the meaning. "
            "Return your output strictly as a JSON object with one key 'sentence'. For example, the output should be:\n"
            "{\"sentence\": \"Your generated sentence here\"}\n"
            "Do not include any additional text or explanation."
        )
        
        messages = [
            {"role": "system", "content": "You are a helpful assistant skilled in creative rewriting to convey specific emotions."},
            {"role": "user", "content": prompt}
        ]
        
        async with session.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {openai.api_key}"},
            json={
                "model": self.model_name,
                "messages": messages,
                "max_tokens": self.max_tokens
            }
        ) as response:
            try:
                response_json = await response.json()
                if response_json.get("choices") and len(response_json["choices"]) > 0:
                    response_text = response_json["choices"][0]["message"]["content"].strip()
                    parsed_output = json.loads(response_text)
                    return parsed_output["sentence"]
            except Exception as e:
                print(f"Error parsing OpenAI response: {str(e)}")
                return original_sentence

    def _emotions_match(self, reference_emotions, actual_emotions):
        # Normalize actual emotions to two decimal places
        normalized_actual_emotions = {k: round(v, 2) for k, v in actual_emotions.items()}
        
        # Check if any emotion deviates more than the threshold
        for emotion, target_value in reference_emotions.items():
            actual_value = normalized_actual_emotions.get(emotion, 0)
            deviation = abs(target_value - actual_value)
            if deviation > self.emotion_threshold:
                return False
            
        print(f"\nAll emotions within {self.emotion_threshold * 100}% deviation threshold")
        return True

    def _generate_feedback(self, target_emotions, actual_emotions):
        feedback_parts = []
        for emotion, target_value in target_emotions.items():
            actual_value = actual_emotions.get(emotion, 0.0)
            relative_diff = abs(target_value - actual_value) / target_value if target_value != 0 else abs(target_value - actual_value)
            diff = target_value - actual_value
            if abs(diff) > 0.1 and relative_diff > 0.2:
                direction = "Increase" if diff > 0 else "Decrease"
                feedback_parts.append(f"{direction} {emotion} (current: {actual_value:.2f}, target: {target_value:.2f}, diff: {abs(diff):.2f})")
        if feedback_parts:
            return "Adjust the sentence as follows: " + ", ".join(feedback_parts)
        else:
            return "No significant adjustments needed."

    def _normalize_emotion_keys(self, emotion_dict):
        """
        Normalize emotion keys to match between different models if needed.
        :return: Normalized emotion dictionary
        :param emotion_dict: Original emotion dictionary
        :return: Normalized emotion dictionary
        """
        # Ensure the emotion analyzer model and labels are loaded if not already loaded
        if not self.analyzer.emotion_labels:
            self.analyzer._load_model()  # Load the model if not already loaded
        normalized_dict = {}
        expected_labels = self.analyzer.emotion_labels
        for emotion, value in emotion_dict.items():
            for expected in expected_labels:
                if emotion.lower() == expected.lower():
                    normalized_dict[expected] = value
                    break
            else:
                normalized_dict[emotion] = value
        return normalized_dict

    def _calculate_rmse(self, reference_emotions, actual_emotions):
        """Calculate RMSE for top 3 emotions only and check their deviations"""
        # Normalize all emotions first so they sum to 1.0
        total_ref = sum(reference_emotions.values())
        total_actual = sum(actual_emotions.values())
        
        normalized_ref = {k: v/total_ref for k, v in reference_emotions.items()}
        normalized_actual = {k: v/total_actual for k, v in actual_emotions.items()}
        
        # Get top 3 emotions from normalized values
        top_target = dict(sorted(normalized_ref.items(), key=lambda x: x[1], reverse=True)[:3])
        
        # Calculate RMSE and matches for top 3 only
        total_diff = 0
        matches = 0
        details = []
        
        for emotion, target in top_target.items():
            actual = normalized_actual.get(emotion, 0)
            diff = abs(target - actual)
            total_diff += diff ** 2
            
            if diff <= self.emotion_threshold:
                matches += 1
            
            details.append((emotion, target, actual, diff))
        
        rmse = np.sqrt(total_diff / 3)
        
        # Log with normalized values
        if hasattr(self, '_log'):
            self._log("\nTop 3 Emotion Comparisons (normalized):", self.current_log_file)
            for emotion, target, actual, diff in details:
                match = "✓" if diff <= self.emotion_threshold else "✗"
                self._log(f"  {emotion}: target={target:.2f}, actual={actual:.2f}, diff={diff:.2f} {match}", 
                         self.current_log_file)
            self._log(f"Top emotions within threshold: {matches}/3", self.current_log_file)
        
        return rmse, matches