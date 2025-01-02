import spacy
import csv

# Load the spaCy English tokenizer
nlp = spacy.load("en_core_web_sm")

# Step 1: Load the VAD dataset into a dictionary
vad_dict = {}

# Read the txt file with VAD data (replace with your actual dataset path)
with open("NRC-VAD-Lexicon.txt", "r", encoding="utf-8") as file:
    for line in file:
        # Split each line by whitespace
        parts = line.strip().split()
        
        # Extract word and its corresponding VAD scores
        word = parts[0]
        valence = float(parts[1])
        arousal = float(parts[2])
        dominance = float(parts[3])
        
        # Store in dictionary for quick lookup
        vad_dict[word.lower()] = {"Valence": valence, "Arousal": arousal, "Dominance": dominance}

# Example: Check the dictionary for a specific word
print(f"Loaded {len(vad_dict)} words from the VAD dataset.")
print(vad_dict.get("abandoned", "Word not found"))

# Step 2: Function to process and calculate VAD scores for a sentence
def calculate_vad_scores(sentence):
    # Tokenize the sentence
    doc = nlp(sentence)
    
    # Initialize scores
    valence, arousal, dominance = 0, 0, 0
    count = 0
    
    # Process each token in the sentence
    for token in doc:
        word = token.text.lower()
        if word in vad_dict:
            valence += vad_dict[word]["Valence"]
            arousal += vad_dict[word]["Arousal"]
            dominance += vad_dict[word]["Dominance"]
            count += 1
    
    # Calculate average scores if any valid words were found
    if count > 0:
        valence /= count
        arousal /= count
        dominance /= count
    
    return valence, arousal, dominance

# Step 3: Load sentences from your text file (replace with your actual file path)
with open("Harry_Potter", "r", encoding="utf-8") as file:
    sentences = file.readlines()

# Step 4: Process each sentence and print the results
print("\nProcessing sentences...\n")
for sentence in sentences:
    sentence = sentence.strip()  # Clean up any extra whitespace or newline characters
    
    # Calculate VAD scores for the sentence
    valence, arousal, dominance = calculate_vad_scores(sentence)
    
    # Output the results for the sentence
    print(f"Sentence: {sentence}")
    print(f"VAD Scores -> Valence: {valence:.2f}, Arousal: {arousal:.2f}, Dominance: {dominance:.2f}")
    print()

# Step 5: Optionally save results to a CSV file
output_file = "vad_scores.csv"
with open(output_file, mode="w", newline='', encoding="utf-8") as file:
    writer = csv.writer(file)
    writer.writerow(["Sentence", "Valence", "Arousal", "Dominance"])

    # Process each sentence and save the results to the CSV file
    for sentence in sentences:
        sentence = sentence.strip()
        
        # Calculate VAD scores for the sentence
        valence, arousal, dominance = calculate_vad_scores(sentence)
        
        # Write the results to the CSV file
        writer.writerow([sentence, valence, arousal, dominance])

print(f"Processing complete. Results saved to '{output_file}'.")
