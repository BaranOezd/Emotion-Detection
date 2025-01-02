import json

def load_lexicons():
    print("Loading lexicons...")  # Debugging print statement
    
    # Initialize dictionaries to store VAD values for English, Turkish, and German
    eng_dict = {}
    tur_dict = {}
    ger_dict = {}
    
    # Loading English lexicon
    with open("C:\\Users\\seyit\\Downloads\\NRC-VAD-Lexicon\\NRC-VAD-Lexicon\\NRC-VAD-Lexicon.txt", "r", encoding="utf-8") as file:
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

    # Loading Turkish lexicon
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
    
    # Loading German lexicon
    with open("C:\\Users\\seyit\\Downloads\\NRC-VAD-Lexicon\\NRC-VAD-Lexicon\\OneFilePerLanguage\\German-NRC-VAD-Lexicon.txt", "r", encoding="utf-8") as file:
        print("Loading German lexicon...")
        for line in file:
            parts = line.strip().split("\t")
            if len(parts) == 5:  # Ensure there are 5 values (English Word, Valence, Arousal, Dominance, German Word)
                try:
                    eng_word = parts[0].lower()
                    valence = float(parts[1])
                    arousal = float(parts[2])
                    dominance = float(parts[3])
                    ger_word = parts[4].lower()  # Get the German word

                    # Store the VAD values for the English word
                    eng_dict[eng_word] = {"Valence": valence, "Arousal": arousal, "Dominance": dominance}

                    # Optionally, map the German word as well if needed
                    ger_dict[ger_word] = {"Valence": valence, "Arousal": arousal, "Dominance": dominance}

                except ValueError:
                    print(f"Skipping line with invalid data in German lexicon: {line.strip()}")
            else:
                print(f"Skipping malformed line in German lexicon: {line.strip()}")
                
    # Combine all dictionaries (English, Turkish, German) into a single dictionary
    combined_dict = {
        "eng": eng_dict,  # English words
        "tur": tur_dict,  # Turkish words
        "ger": ger_dict   # German words
    }
    
    # Save the combined dictionary to a JSON file for reuse
    with open("combined_vad_dict.json", "w", encoding="utf-8") as json_file:
        json.dump(combined_dict, json_file, ensure_ascii=False, indent=4)
    
    print("Lexicons loaded and saved successfully.")

if __name__ == "__main__":
    load_lexicons()
