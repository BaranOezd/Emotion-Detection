import os
import openai
import json
import numpy as np
import asyncio
import aiohttp
import time
from backend.emotion_analyzer import EmotionAnalyzer
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
print(f"Looking for .env file at: {env_path}")

load_dotenv(dotenv_path=env_path, override=True)
api_key = os.getenv("OPENAI_API_KEY", "").strip().replace('\ufeff', '')

if not api_key.startswith("sk-"):
    raise Exception(f"Invalid API key loaded")

openai.api_key = api_key

class SentenceGenerator:
    def __init__(self, model_name="gpt-4.1-nano", max_tokens=100):
        """
        Initialize the generator with the specified OpenAI model.
        :param model_name: The name of the OpenAI model to use.
        :param max_tokens: Maximum tokens for the generated response.
        """
        self.model_name = model_name
        self.max_tokens = max_tokens
        self.max_attempts = 3  # Fixed maximum attempts
        self.emotion_threshold = 0.12 
        self.emotion_model_name = "SamLowe/roberta-base-go_emotions"
        self.analyzer = EmotionAnalyzer(model_name=self.emotion_model_name)
        self.batch_size = 50  
        self.keep_best = 8   
        self.max_concurrent_requests = 32 

    def _log(self, message):
        """Simple console logging"""
        print(message)

    async def _analyze_emotions_async(self, sentence, user_top_emotions, loop=None):
        loop = loop or asyncio.get_event_loop()
        emotions = await loop.run_in_executor(None, self.analyzer.analyze_emotions, sentence)
        rmse, matches = self._calculate_rmse(user_top_emotions, emotions)
        return (sentence, emotions, rmse)

    def _process_batch_results(self, batch, user_top_emotions):
        """Process and analyze batch results in parallel with higher concurrency."""
        if not batch:
            return []

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            semaphore = asyncio.Semaphore(self.max_concurrent_requests)
            async def analyze_with_semaphore(sentence):
                async with semaphore:
                    return await self._analyze_emotions_async(sentence, user_top_emotions, loop)
            tasks = [
                analyze_with_semaphore(sentence)
                for sentence in batch
            ]
            batch_results = loop.run_until_complete(asyncio.gather(*tasks))
        finally:
            loop.close()

        # Sort by RMSE
        batch_results.sort(key=lambda x: x[2])
        return batch_results

    def _normalize_top_emotions(self, emotions, top_n=3):
        """Normalize top emotions to two decimal places."""
        top_emotions = dict(sorted(emotions.items(), key=lambda x: x[1], reverse=True)[:top_n])
        return {k: round(v, 2) for k, v in top_emotions.items()}

    async def _generate_sentence_with_retry(self, session, sentence, user_top_emotions, semaphore, retries=2):
        for attempt in range(retries + 1):
            try:
                async with semaphore:
                    return await asyncio.wait_for(
                        self._generate_sentence_async(session, sentence, user_top_emotions),
                        timeout=40
                    )
            except Exception as e:
                if attempt < retries:
                    print(f"Retrying sentence generation (attempt {attempt+2}) due to error: {e}")
                    await asyncio.sleep(1)
                else:
                    print(f"Failed to generate sentence after {retries+1} attempts: {e}")
                    return sentence  # fallback to original

    async def _generate_sentences_batch(self, sentences, user_top_emotions):
        """Generate multiple sentences concurrently"""
        sentences_per_source = max(1, self.batch_size // len(sentences))  # Distribute batch size evenly
        total_sentences = len(sentences) * sentences_per_source
        print(f"\nGenerating {total_sentences} sentences (using {len(sentences)} seed sentences)...")
        
        semaphore = asyncio.Semaphore(self.max_concurrent_requests)
        async with aiohttp.ClientSession() as session:
            tasks = []
            for sentence in sentences:
                for _ in range(sentences_per_source):
                    tasks.append(
                        self._generate_sentence_with_retry(session, sentence, user_top_emotions, semaphore)
                    )
            completed = []
            errors = 0
            for idx, task in enumerate(asyncio.as_completed(tasks), 1):
                try:
                    result = await task
                    completed.append(result)
                    print(f"\rSentence {len(completed)}/{total_sentences} generated", end="", flush=True)
                except Exception as e:
                    errors += 1
                    print(f"\nError in sentence generation: {e}")
            print(f"\nBatch complete: {len(completed)} generated, {errors} errors.")
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
        user_top_emotions = self._normalize_top_emotions(target_emotions)
        print(f"User's top three emotions (normalized): {user_top_emotions}")
        
        # Initialize the batch system
        best_sentences = [original_sentence] * min(3, self.keep_best)
        overall_best_rmse = float('inf')
        overall_best_sentence = original_sentence
        
        attempt = 0
        while attempt < self.max_attempts:
            batch_start = time.time()
            attempt += 1
            self._log(f"\nBatch {attempt}/{self.max_attempts}")

            # Use a try/except to catch interpreter shutdown or event loop errors
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    batch = loop.run_until_complete(
                        self._generate_sentences_batch(best_sentences, user_top_emotions)
                    )
                finally:
                    loop.close()
            except RuntimeError as e:
                # Handle interpreter shutdown or event loop closed errors gracefully
                if "cannot schedule new futures after interpreter shutdown" in str(e) or "Event loop is closed" in str(e):
                    self._log("Server interpreter has shut down or event loop is closed. Cannot process further requests.")
                    raise Exception("Server is shutting down or restarting. Please try again later.")
                else:
                    raise

            print("\nAnalyzing emotions for generated sentences...")
            batch_results = self._process_batch_results(batch, user_top_emotions)

            # Ensure batch_results is not empty before proceeding
            if not batch_results:
                self._log("\nNo sentences were successfully generated or analyzed in this batch.")
                continue
            
            # Update overall best if this batch has a better sentence
            if batch_results[0][2] < overall_best_rmse:
                overall_best_rmse = batch_results[0][2]
                overall_best_sentence = batch_results[0][0]
                print(f"\nNew best sentence found with RMSE {overall_best_rmse:.4f}")
                self._log(f"New best sentence found!")
                self._log(f"RMSE: {overall_best_rmse:.4f}")
                
                # Stop if we achieve target emotion_threshold
                if overall_best_rmse <= self.emotion_threshold:
                    self._log(f"\n✓ Found sentence with target emotion threshold! Stopping.")
                    self._log(f"Total generation time: {time.time() - start_time:.2f} seconds")
                    return overall_best_sentence
            
            # Keep best sentences for next iteration
            best_sentences = [result[0] for result in batch_results[:self.keep_best]]
        
        self._log(f"\n! Hit maximum attempts ({self.max_attempts}) without reaching target emotion threshold.")
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
            "Your task is to rewrite the original sentence to reflect the specified emotional levels as closely as possible. "
            "The rewritten sentence should:\n"
            "1. Retain the original context and meaning.\n"
            "2. Be similar in length to the original sentence.\n"
            "3. Match the top three emotions provided in the target emotional levels.\n"
            "4. Adjust the tone and word choice to align with the specified emotions without introducing new ideas.\n\n"
            "Important Notes:\n"
            "- Focus on the top three emotions with the highest values in the target emotional levels.\n"
            "- Ensure the sentence remains grammatically correct and natural.\n"
            "- Avoid exaggerating or diminishing the emotional tone beyond the specified levels.\n\n"
            "- Avoid clichés, overused phrases and direct names of emotions.\n"

            "Output Format:\n"
            "Return your output strictly as a JSON object with one key 'sentence'. For example:\n"
            "{\"sentence\": \"Your generated sentence here\"}\n"
            "Do not include any additional text, explanation, or formatting outside the JSON object."
        )
        
        messages = [
            {"role": "system", "content": "You are a highly skilled assistant specializing in rewriting sentences to convey specific emotional tones with precision."},
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