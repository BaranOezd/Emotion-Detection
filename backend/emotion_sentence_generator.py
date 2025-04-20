import openai
import json
import numpy as np
import asyncio
import aiohttp
import time
from backend.Emotions_analyzer import EmotionsAnalyzer

# Read the OpenAI API key from the file
with open(r"C:\Users\seyit\Desktop\openAIToken.txt", "r") as file:
    api_key = file.read().strip()

if not api_key:
    raise Exception("The OPENAI_API_KEY is not set in the file.")

# Set the OpenAI API key for authentication
openai.api_key = api_key

class SentenceGenerator:
    def __init__(self, model_name="gpt-4o-mini", max_tokens=100, analyzer=None):
        """
        Initialize the generator with the specified OpenAI model.
        :param model_name: The name of the OpenAI model to use.
        :param max_tokens: Maximum tokens for the generated response.
        :param analyzer: An instance of EmotionsAnalyzer for emotion analysis.
        """
        self.model_name = model_name
        self.max_tokens = max_tokens
        self.max_attempts = 3  # Fixed maximum attempts
        self.rmse_target = 0.10  # Target for acceptable emotion match
        self.emotion_threshold = 0.12  # Threshold for individual emotion matches
        self.analyzer = analyzer if analyzer else EmotionsAnalyzer(model_name="SamLowe/roberta-base-go_emotions")
        self.batch_size = 30  # Number of sentences per batch
        self.keep_best = 5    # Number of best sentences to keep

    def _log(self, message):
        """Simple console logging"""
        print(message)

    async def _generate_sentences_batch(self, sentences, user_top_emotions):
        """Generate multiple sentences concurrently"""
        tasks = []
        sentences_per_source = max(1, self.batch_size // len(sentences))  # Distribute batch size evenly
        total_sentences = len(sentences) * sentences_per_source
        print(f"\nGenerating {total_sentences} sentences (using {len(sentences)} seed sentences)...")
        
        async with aiohttp.ClientSession() as session:
            for sentence in sentences:
                for _ in range(sentences_per_source):
                    task = self._generate_sentence_async(session, sentence, user_top_emotions)
                    tasks.append(task)
            
            # Process sentences as they complete
            completed = []
            for task in asyncio.as_completed(tasks):
                sentence = await task
                completed.append(sentence)
                print(f"\nSentence {len(completed)}/{total_sentences} generated:")
                print(f"Text: {sentence[:100]}...")
            
            return completed

    def generate_modified_sentence(self, original_sentence, new_emotion_levels):
        start_time = time.time()
        self._log("\n" + "="*80)
        self._log("Starting New Sentence Generation")
        self._log(f"Original sentence: {original_sentence}")
        self._log(f"Target emotions: {new_emotion_levels}")
        
        # Normalize emotion keys to match the model's expected format
        target_emotions = self._normalize_emotion_keys(new_emotion_levels)
        
        # Identify the user's top three emotions from the input
        user_top_emotions = {k: round(v, 2) for k, v in sorted(target_emotions.items(), key=lambda x: x[1], reverse=True)[:3]}
        print(f"User's top three emotions (normalized): {user_top_emotions}")
        
        # Initialize the batch system
        best_sentences = [original_sentence]
        overall_best_rmse = float('inf')
        overall_best_sentence = original_sentence
        overall_best_emotions = None
        
        attempt = 0
        while attempt < self.max_attempts:
            batch_start = time.time()
            attempt += 1
            self._log(f"\nBatch {attempt}/{self.max_attempts}")
            
            # Create and run a new event loop for each batch
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                batch = loop.run_until_complete(
                    self._generate_sentences_batch(best_sentences, user_top_emotions)
                )
            finally:
                loop.close()
            
            print("\nAnalyzing emotions for generated sentences...")
            batch_results = []

            # Process and analyze sentences
            for sentence in batch:
                emotions = self.analyzer.analyze_emotions(sentence)
                rmse, matches = self._calculate_rmse(user_top_emotions, emotions)
                batch_results.append((sentence, emotions, rmse))
            
            # Sort by RMSE
            batch_results.sort(key=lambda x: x[2])
            
            # Update overall best if this batch has a better sentence
            if batch_results[0][2] < overall_best_rmse:
                overall_best_rmse = batch_results[0][2]
                overall_best_sentence = batch_results[0][0]
                overall_best_emotions = batch_results[0][1]
                print(f"\nNew best sentence found with RMSE {overall_best_rmse:.4f}")
                self._log(f"New best sentence found!")
                self._log(f"RMSE: {overall_best_rmse:.4f}")
                
                # Stop if we achieve target RMSE
                if overall_best_rmse <= self.rmse_target:
                    self._log(f"\n✓ Found sentence with target RMSE! Stopping.")
                    self._log(f"Total generation time: {time.time() - start_time:.2f} seconds")
                    return overall_best_sentence
            
            # Keep best sentences for next iteration
            best_sentences = [result[0] for result in batch_results[:self.keep_best]]
        
        self._log(f"\n! Hit maximum attempts ({self.max_attempts}) without reaching target RMSE.")
        self._log(f"Returning best sentence after all batches")
        self._log(f"Best RMSE achieved: {overall_best_rmse:.4f}")
        self._log(f"Total generation time: {time.time() - start_time:.2f} seconds")
        
        return overall_best_sentence

    async def _generate_sentence_async(self, session, original_sentence, target_emotions):
        """Async version of sentence generation"""
        # Format target emotions to two decimals for the prompt
        formatted_target = {k: round(v, 2) for k, v in target_emotions.items()}
        prompt = (
            f"Below is the original sentence:\n\"{original_sentence}\"\n\n"
            f"The new desired emotion levels are:\n{json.dumps(formatted_target, indent=2)}\n\n"
        )
        prompt += (
            "Please generate a new, single sentence that retains the original context and is similar in length, "
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
        
        # Log comparison to console only
        self._log("\nTop 3 Emotion Comparisons (normalized):")
        for emotion, target, actual, diff in details:
            match = "✓" if diff <= self.emotion_threshold else "✗"
            self._log(f"  {emotion}: target={target:.2f}, actual={actual:.2f}, diff={diff:.2f} {match}")
        self._log(f"Top emotions within threshold: {matches}/3")
        
        return rmse, matches