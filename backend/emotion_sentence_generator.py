import openai
import json

# Read the OpenAI API key from the file
with open(r"C:\Users\seyit\Desktop\openAIToken.txt", "r") as file:
    api_key = file.read().strip()

if not api_key:
    raise Exception("The OPENAI_API_KEY is not set in the file.")

# Set the OpenAI API key for authentication
openai.api_key = api_key

class SentenceGenerator:
    def __init__(self, model_name="gpt-4o-mini", max_tokens=100):
        """
        Initialize the generator with the specified OpenAI model.
        :param model_name: The name of the OpenAI model to use.
        :param max_tokens: Maximum tokens for the generated response.
        """
        self.model_name = model_name
        self.max_tokens = max_tokens

    def generate_modified_sentence(self, original_sentence, new_emotion_levels, context_text=None):
        """
        Generate a new sentence based on the original sentence and new emotion levels.
        The new sentence will be similar in context and length, but reflect the new emotions.
        
        :param original_sentence: The sentence selected from the GoEmotionsAnalyzer output.
        :param new_emotion_levels: A dictionary of emotion levels (anger, disgust, fear, joy,
                                   neutral, sadness, surprise) that add up to 1.000.
        :param context_text: (Optional) Additional context to help maintain overall narrative.
        :return: The generated sentence as a plain string.
        """
        # Modify the prompt to instruct JSON output
        prompt = (
            f"Below is the original sentence:\n\"{original_sentence}\"\n\n"
            f"The new desired emotion levels are:\n{new_emotion_levels}\n\n"
            "Please generate a new sentence that retains the original context and is similar in length, "
            "but reflects these modified emotions. Adjust the tone accordingly without changing the meaning. "
            "Return your output strictly as a JSON object with one key 'sentence'. For example, the output should be:\n"
            "{\"sentence\": \"Your generated sentence here\"}\n"
            "Do not include any additional text or explanation."
        )
        if context_text:
            prompt += f"\n\nAdditional context:\n{context_text}"
        
        messages = [
            {"role": "system", "content": "You are a helpful assistant skilled in creative rewriting."},
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
            raise
        
        # Return just the generated sentence
        return new_sentence
