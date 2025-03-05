import openai

# Read the OpenAI API key from the file
with open(r"C:\Users\seyit\Desktop\openAIToken.txt", "r") as file:
    api_key = file.read().strip()  # Read and strip any surrounding whitespace/newlines

if not api_key:
    raise Exception("The OPENAI_API_KEY is not set in the file.")

# Set the OpenAI API key for authentication
openai.api_key = api_key

# Example of generating a response using the new API (Chat-based completion)
response = openai.chat.completions.create(
    model="gpt-4o-mini",  # Use the correct model name
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Write a haiku about programming."}
    ],
    max_tokens=100
)

# Output the response
print(response.choices[0].message.content.strip())

tokens_used = response.usage.total_tokens

# Pricing model for GPT-4o mini
price_per_1M_input_tokens = 0.15  # $0.15 per 1 million input tokens
price_per_1M_output_tokens = 0.60  # $0.60 per 1 million output tokens

# Assuming that total tokens include both input and output
input_tokens_used = response.usage.prompt_tokens
output_tokens_used = response.usage.completion_tokens

# Calculate the cost based on token usage for input and output separately
money_spent_input = (input_tokens_used / 1_000_000) * price_per_1M_input_tokens
money_spent_output = (output_tokens_used / 1_000_000) * price_per_1M_output_tokens

# Total money spent
money_spent = money_spent_input + money_spent_output

# Print the number of tokens used and the money spent
print(f"Input Tokens used: {input_tokens_used}")
print(f"Output Tokens used: {output_tokens_used}")
print(f"Total Tokens used: {tokens_used}")
print(f"Money spent (GPT-4o mini): ${money_spent:.8f}")