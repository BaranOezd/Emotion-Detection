import re
import openai
import json
import numpy as np
from backend.Emotions_analyzer import EmotionsAnalyzer

# Read the OpenAI API key from the file
with open(r"C:\Users\seyit\Desktop\openAIToken.txt", "r") as file:
    api_key = file.read().strip()

if not api_key:
    raise Exception("The OPENAI_API_KEY is not set in the file.")

# Set the OpenAI API key for authentication
openai.api_key = api_key

class SentenceGenerator:
    def __init__(self, model_name="gpt-4o-mini", max_tokens=100, max_attempts=5, emotion_threshold=0.1):
        """
        Initialize the generator with the specified OpenAI model.
        :param model_name: The name of the OpenAI model to use.
        :param max_tokens: Maximum tokens for the generated response.
        :param max_attempts: Maximum number of attempts to generate a matching sentence.
        :param emotion_threshold: Maximum acceptable difference between intended and actual emotions.
        """
        self.model_name = model_name
        self.max_tokens = max_tokens
        self.max_attempts = max_attempts
        self.emotion_threshold = emotion_threshold
        self.emotion_analyzer = EmotionsAnalyzer(model_name="SamLowe/roberta-base-go_emotions")

    def generate_modified_sentence(self, original_sentence, new_emotion_levels, context_text=None):
        """
        Generate a new sentence based on the original sentence and new emotion levels.
        Focus on emotions whose levels have changed significantly.
        """
        print(f"Generating sentence with emotion levels: {new_emotion_levels}")
        
        # Normalize emotion keys to match the model's expected format
        target_emotions = self._normalize_emotion_keys(new_emotion_levels)
        
        # Identify emotions with significant changes
        significant_emotions = {emotion: level for emotion, level in target_emotions.items() if abs(level - 0.5) > 0.1}
        print(f"Focusing on significant emotions: {significant_emotions}")
        
        # Generate the initial sentence
        new_sentence = self._generate_sentence(original_sentence, significant_emotions, context_text)
        
        # Feedback loop to refine the generated sentence
        for attempt in range(self.max_attempts):
            print(f"Attempt {attempt + 1}/{self.max_attempts} to generate matching sentence")
            
            # Analyze emotions in the generated sentence
            actual_emotions = self.emotion_analyzer.analyze_emotions(new_sentence)
            print(f"Actual emotions detected: {actual_emotions}")
            
            # Check if the actual emotions match the target emotions
            if self._emotions_match(significant_emotions, actual_emotions):
                print("✓ Generated sentence matches target emotions!")
                return new_sentence
            
            # If emotions don't match, generate feedback and refine the sentence
            print("× Emotions don't match target levels, generating new sentence with feedback...")
            feedback = self._generate_feedback(significant_emotions, actual_emotions)
            new_sentence = self._generate_sentence(original_sentence, significant_emotions, context_text, feedback)
        
        # Return the last generated sentence if no perfect match is found
        print("! Returning best generated sentence after maximum attempts")
        return new_sentence

    def _generate_sentence(self, original_sentence, target_emotions, context_text=None, feedback=None):
        """Generate a sentence using OpenAI's API with optional feedback."""
        prompt = (
            f"Below is the original sentence:\n\"{original_sentence}\"\n\n"
            f"The new desired emotion levels are:\n{json.dumps(target_emotions, indent=2)}\n\n"
        )
        
        if feedback:
            prompt += f"Previous attempt feedback: {feedback}\n\n"
        
        prompt += (
            "Please generate a new sentence that retains the original context and is similar in length, "
            "but reflects these modified emotions. Adjust the tone accordingly without changing the meaning. "
            "Return your output strictly as a JSON object with one key 'sentence'. For example, the output should be:\n"
            "{\"sentence\": \"Your generated sentence here\"}\n"
            "Do not include any additional text or explanation."
        )
        
        if context_text:
            prompt += f"\n\nAdditional context:\n{context_text}"
        
        messages = [
            {"role": "system", "content": "You are a helpful assistant skilled in creative rewriting to convey specific emotions."},
            {"role": "user", "content": prompt}
        ]
        
        response = openai.chat.completions.create(
            model=self.model_name,
            messages=messages,
            max_tokens=self.max_tokens
        )
        
        try:
            response_text = response.choices[0].message.content.strip()
            parsed_output = json.loads(response_text)
            return parsed_output["sentence"]
        except Exception as e:
            print("Error parsing JSON output from response:", e)
            return original_sentence  # Fallback to the original sentence

    def _emotions_match(self, target_emotions, actual_emotions):
        """
        Check if the actual emotions are close enough to the target emotions.
        
        :param target_emotions: Dictionary of target emotion levels
        :param actual_emotions: Dictionary of actual emotion levels from analysis
        :return: True if emotions match within threshold, False otherwise
        """
        total_diff = 0
        for emotion, target_value in target_emotions.items():
            actual_value = actual_emotions.get(emotion, 0)
            diff = abs(target_value - actual_value)
            total_diff += diff ** 2
        
        rmse = np.sqrt(total_diff / len(target_emotions))
        print(f"Emotion difference (RMSE): {rmse:.4f}, threshold: {self.emotion_threshold:.4f}")
        return rmse <= self.emotion_threshold

    def _generate_feedback(self, target_emotions, actual_emotions):
        """
        Generate feedback on how the actual emotions differ from target emotions.
        
        :param target_emotions: Dictionary of target emotion levels
        :param actual_emotions: Dictionary of actual emotion levels from analysis
        :return: String containing feedback for improving the next generation
        """
        feedback_parts = []
        for emotion, target_value in target_emotions.items():
            actual_value = actual_emotions.get(emotion, 0)
            diff = target_value - actual_value
            if abs(diff) > 0.1:  # Only mention significant differences
                if diff > 0:
                    feedback_parts.append(f"Increase {emotion} (current: {actual_value:.2f}, target: {target_value:.2f})")
                else:
                    feedback_parts.append(f"Decrease {emotion} (current: {actual_value:.2f}, target: {target_value:.2f})")
        return "Please adjust the new sentence as follows: " + ", ".join(feedback_parts)

    def _normalize_emotion_keys(self, emotion_dict):
        """
        Normalize emotion keys to match between different models if needed.
        
        :param emotion_dict: Original emotion dictionary
        :return: Normalized emotion dictionary
        """
        # Ensure the emotion analyzer model and labels are loaded
        if not self.emotion_analyzer.emotion_labels:
            self.emotion_analyzer._load_model()  # Load the model if not already loaded

        expected_labels = self.emotion_analyzer.emotion_labels
        normalized_dict = {}
        for emotion, value in emotion_dict.items():
            for expected in expected_labels:
                if emotion.lower() == expected.lower():
                    normalized_dict[expected] = value
                    break
            else:
                normalized_dict[emotion] = value
        return normalized_dict
