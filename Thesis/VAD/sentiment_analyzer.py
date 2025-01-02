import json
import csv

# Load lexicons (both English, Turkish, and German)
def load_lexicons():
    print("Loading lexicons...")

    # Initialize dictionaries to store VAD values for English, Turkish, and German
    eng_dict = {}
    tur_dict = {}
    ger_dict = {}

    # Load English lexicon 
    try:
        with open("C:\\Users\\seyit\\Downloads\\NRC-VAD-Lexicon\\NRC-VAD-Lexicon.txt", "r", encoding="utf-8") as file:
            print("Loading English lexicon...")
            for line in file:
                parts = line.strip().split("\t")
                if len(parts) == 4:  # Ensure there are exactly 4 values (word, valence, arousal, dominance)
                    try:
                        word = parts[0].lower()
                        valence = float(parts[1])
                        arousal = float(parts[2])
                        dominance = float(parts[3])
                        eng_dict[word] = {"Valence": valence, "Arousal": arousal, "Dominance": dominance}
                    except ValueError:
                        print(f"Skipping line with invalid data in English lexicon: {line.strip()}")
                else:
                    print(f"Skipping malformed line in English lexicon: {line.strip()}")
    except FileNotFoundError:
        print("English lexicon file not found.")
    
    # Load Turkish lexicon 
    try:
        with open("C:\\Users\\seyit\\Downloads\\NRC-VAD-Lexicon\\NRC-VAD-Lexicon\\OneFilePerLanguage\\Turkish-NRC-VAD-Lexicon.txt", "r", encoding="utf-8") as file:
            print("Loading Turkish lexicon...")
            for line in file:
                parts = line.strip().split("\t")
                if len(parts) == 5:  # Ensure there are 5 values (English Word, Valence, Arousal, Dominance, Turkish Word)
                    try:
                        eng_word = parts[0].lower()
                        valence = float(parts[1])
                        arousal = float(parts[2])
                        dominance = float(parts[3])
                        tur_word = parts[4].lower()  # Get the Turkish word

                        # Store the VAD values for the English word
                        eng_dict[eng_word] = {"Valence": valence, "Arousal": arousal, "Dominance": dominance}

                        # Optionally, map the Turkish word as well if needed
                        tur_dict[tur_word] = {"Valence": valence, "Arousal": arousal, "Dominance": dominance}
                    except ValueError:
                        print(f"Skipping line with invalid data in Turkish lexicon: {line.strip()}")
                else:
                    print(f"Skipping malformed line in Turkish lexicon: {line.strip()}")
    except FileNotFoundError:
        print("Turkish lexicon file not found.")
        
    # Load German lexicon 
    try:
        with open("C:\\Users\\seyit\\Downloads\\NRC-VAD-Lexicon\\NRC-VAD-Lexicon\\OneFilePerLanguage\\German-NRC-VAD-Lexicon.txt", "r", encoding="utf-8") as file:
            print("Loading German lexicon...")
            for line in file:
                parts = line.strip().split("\t")
                if len(parts) == 5:  # Ensure there are exactly 5 values (word, valence, arousal, dominance, German Word)
                    try:
                        eng_word = parts[0].lower()
                        word = parts[0].lower()
                        valence = float(parts[1])
                        arousal = float(parts[2])
                        dominance = float(parts[3])
                        ger_word = parts[4].lower()  # Get the German word

                        # Store the VAD values for the English word and German word
                        ger_dict[ger_word] = {"Valence": valence, "Arousal": arousal, "Dominance": dominance}
                    except ValueError:
                        print(f"Skipping line with invalid data in German lexicon: {line.strip()}")
                else:
                    print(f"Skipping malformed line in German lexicon: {line.strip()}")
    except FileNotFoundError:
        print("German lexicon file not found.")
    
    # Combine both dictionaries (English, Turkish, and German) into a single dictionary
    combined_dict = {
        "eng": eng_dict,  # English words
        "tur": tur_dict,   # Turkish words
        "ger": ger_dict   # German words
    }

    # Save the combined dictionary to a JSON file for reuse
    with open("combined_vad_dict.json", "w", encoding="utf-8") as json_file:
        json.dump(combined_dict, json_file, ensure_ascii=False, indent=4)
    
    print("Lexicons loaded and saved successfully.")
    return combined_dict


# Function to calculate VAD scores for a given sentence
def calculate_vad_scores(sentence, lexicons):
    # Tokenize the sentence without lemmatization
    words = sentence.lower().split()  # Tokenize by splitting on spaces
    
    valence, arousal, dominance = 0, 0, 0
    count = 0
    skipped_words = []  # List to track skipped words

    # Process each word
    for word in words:
        # Check if word exists in lexicons (English, Turkish, or German)
        if word in lexicons.get("eng", {}) or word in lexicons.get("tur", {}) or word in lexicons.get("ger", {}):
            if word in lexicons.get("eng", {}):
                valence += lexicons["eng"][word]["Valence"]
                arousal += lexicons["eng"][word]["Arousal"]
                dominance += lexicons["eng"][word]["Dominance"]
                count += 1  # Increment count only once per word
            if word in lexicons.get("tur", {}):
                valence += lexicons["tur"][word]["Valence"]
                arousal += lexicons["tur"][word]["Arousal"]
                dominance += lexicons["tur"][word]["Dominance"]
                count += 1  # Increment count only once per word
            if word in lexicons.get("ger", {}):
                valence += lexicons["ger"][word]["Valence"]
                arousal += lexicons["ger"][word]["Arousal"]
                dominance += lexicons["ger"][word]["Dominance"]
                count += 1  # Increment count only once per word
        else:
            skipped_words.append(word)  # Add word to skipped words list
    
    # Calculate average if there were valid words
    if count > 0:
        valence /= count
        arousal /= count
        dominance /= count
    
    # Round the VAD values to 3 decimal places
    valence = round(valence, 3)
    arousal = round(arousal, 3)
    dominance = round(dominance, 3)
    
    # Print skipped words
    if skipped_words:
        print(f"Skipped words: {', '.join(skipped_words)}")
    
    return valence, arousal, dominance

# Main function to execute the lexicon loading and VAD score calculation
if __name__ == "__main__":
    # Load lexicons
    lexicons = load_lexicons()

    # Open a CSV file to save the results
    with open("vad_results.csv", "w", newline='', encoding="utf-8") as output_file:
        csv_writer = csv.writer(output_file)
        
        # Write CSV header
        csv_writer.writerow(["Sentence", "Valence", "Arousal", "Dominance"])

        while True:
            # The sentence to process can be passed dynamically, e.g., from user input or another source
            sentence = input("Enter sentence (or type 'exit' to quit): ")

            if sentence.lower() == "exit":
                break

            # Calculate VAD scores for the given sentence
            valence, arousal, dominance = calculate_vad_scores(sentence, lexicons)

            # Print results
            print(f"VAD Scores -> Valence: {valence}, Arousal: {arousal}, Dominance: {dominance}")

            # Save results to the CSV file
            csv_writer.writerow([sentence, valence, arousal, dominance])

    print("Results saved to vad_results.csv.")
