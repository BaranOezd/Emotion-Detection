import openai

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
        :return: A dictionary containing the generated sentence and usage details.
        """
        # Create a prompt that provides context and instructs the model on the required changes.
        prompt = (
            f"Below is the original sentence:\n\"{original_sentence}\"\n\n"
            f"The new desired emotion levels are:\n{new_emotion_levels}\n\n"
            "Please generate a new sentence that retains the original context and is similar in length, "
            "but reflects these modified emotions. Adjust the tone accordingly without changing the meaning."
        )
        
        if context_text:
            prompt += f"\n\nAdditional context:\n{context_text}"
        
        # Prepare the messages for the chat-based completion.
        messages = [
            {"role": "system", "content": "You are a helpful assistant skilled in creative rewriting."},
            {"role": "user", "content": prompt}
        ]
        
        # Generate the new sentence using the OpenAI chat API.
        response = openai.chat.completions.create(
            model=self.model_name,
            messages=messages,
            max_tokens=self.max_tokens
        )
        
        new_sentence = response.choices[0].message.content.strip()
        
        # Extract token usage for cost calculations.
        usage = response.usage
        input_tokens = usage.get('prompt_tokens', 0)
        output_tokens = usage.get('completion_tokens', 0)
        total_tokens = usage.get('total_tokens', 0)
        
        # Pricing (example values for GPT-4o mini)
        price_per_1M_input_tokens = 0.15  # $0.15 per 1M input tokens
        price_per_1M_output_tokens = 0.60  # $0.60 per 1M output tokens
        
        money_spent_input = (input_tokens / 1_000_000) * price_per_1M_input_tokens
        money_spent_output = (output_tokens / 1_000_000) * price_per_1M_output_tokens
        money_spent = money_spent_input + money_spent_output
        
        return {
            "new_sentence": new_sentence,
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "money_spent": money_spent
            }
        }
