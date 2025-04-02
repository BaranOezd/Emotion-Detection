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
    def __init__(self, model_name="gpt-4o-mini", max_tokens=100, max_attempts=3, emotion_threshold=0.15):
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
        self.emotion_analyzer = EmotionsAnalyzer()

    def generate_modified_sentence(self, original_sentence, new_emotion_levels, context_text=None):
        """
        Generate a new sentence based on the original sentence and new emotion levels.
        The new sentence will be similar in context and length, but reflect the new emotions.
        Uses a feedback loop to ensure the generated sentence matches the intended emotions.
        
        :param original_sentence: The sentence selected from the EmotionsAnalyzer output.
        :param new_emotion_levels: A dictionary of emotion levels that add up to 1.000.
        :param context_text: (Optional) Additional context to help maintain overall narrative.
        :return: The generated sentence as a plain string.
        """
        print(f"Generating sentence with emotion levels: {new_emotion_levels}")
        
        # Convert emotion keys to match the model's expected format if needed
        target_emotions = self._normalize_emotion_keys(new_emotion_levels)
        
        # First try - generate a new sentence
        new_sentence = self._generate_sentence(original_sentence, target_emotions, context_text)
        
        # Analyze the generated sentence to see if it matches the target emotions
        for attempt in range(self.max_attempts):
            print(f"Attempt {attempt+1}/{self.max_attempts} to generate matching sentence")
            
            # Analyze emotions in the generated sentence
            actual_emotions = self.emotion_analyzer.analyze_emotions(new_sentence)
            print(f"Actual emotions detected: {actual_emotions}")
            
            # Check if emotions are close enough to target
            if self._emotions_match(target_emotions, actual_emotions):
                print("✓ Generated sentence matches target emotions!")
                return new_sentence
            
            # If not close enough, try to generate again with feedback
            print("× Emotions don't match target levels, generating new sentence with feedback...")
            feedback = self._generate_feedback(target_emotions, actual_emotions)
            new_sentence = self._generate_sentence(original_sentence, target_emotions, context_text, feedback)
        
        # Return the last generated sentence if we couldn't find a perfect match
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
        
        # Convert the response to a dictionary
        response_dict = response.to_dict()
        
        try:
            response_text = response_dict['choices'][0]['message']['content'].strip()
            # Attempt to parse the response as JSON
            parsed_output = json.loads(response_text)
            new_sentence = parsed_output["sentence"]
        except Exception as e:
            print("Error parsing JSON output from response:", e)
            # Fallback: try to extract the sentence directly if JSON parsing fails
            match = re.search(r'"sentence"\s*:\s*"([^"]+)"', response_text)
            if match:
                new_sentence = match.group(1)
            else:
                new_sentence = original_sentence  # Fallback to original sentence
            
        return new_sentence

    def _emotions_match(self, target_emotions, actual_emotions):
        """
        Check if the actual emotions are close enough to the target emotions.
        
        :param target_emotions: Dictionary of target emotion levels
        :param actual_emotions: Dictionary of actual emotion levels from analysis
        :return: True if emotions match within threshold, False otherwise
        """
        # Calculate the Euclidean distance between emotion vectors
        total_diff = 0
        
        # Check for each target emotion if it's close enough to actual
        for emotion, target_value in target_emotions.items():
            if emotion in actual_emotions:
                diff = abs(target_value - actual_emotions[emotion])
                total_diff += diff ** 2
            else:
                # If emotion doesn't exist in actual emotions, count as maximum difference
                total_diff += target_value ** 2
        
        # Calculate root mean square error
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
        For example, convert "joy" to "Joy" if the models use different casing.
        
        :param emotion_dict: Original emotion dictionary
        :return: Normalized emotion dictionary
        """
        # Get the expected emotion labels from the analyzer
        expected_labels = self.emotion_analyzer.emotion_labels
        
        if not expected_labels:
            # If no labels available, load the model to get them
            self.emotion_analyzer._load_model()
            expected_labels = self.emotion_analyzer.emotion_labels
        
        # Create mapping between provided and expected emotion labels
        normalized_dict = {}
        
        # Simple lowercase matching (can be expanded for more complex mappings)
        for emotion, value in emotion_dict.items():
            found = False
            for expected in expected_labels:
                if emotion.lower() == expected.lower():
                    normalized_dict[expected] = value
                    found = True
                    break
            
            if not found:
                # Keep original if no match found
                normalized_dict[emotion] = value
        
        return normalized_dict
