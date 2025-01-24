import csv
import os
import nltk
import re
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

class GoEmotionsAnalyzer:
    def __init__(self, model_name="j-hartmann/emotion-english-distilroberta-base"):
    
        print(f"Loading model '{model_name}'...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.emotion_pipeline = pipeline("text-classification", model=self.model, tokenizer=self.tokenizer, top_k=None)
        print("Model loaded successfully.")

        # Extract emotion labels from the model configuration
        self.emotion_labels = list(self.model.config.id2label.values())

    def analyze_emotions(self, sentence):
    
        results = self.emotion_pipeline(sentence)
        return {result['label']: result['score'] for result in results[0]}

    def batch_analyze(self, sentences):
     
        print(f"Starting batch analysis for {len(sentences)} sentences...")
        results = []
        for i, sentence in enumerate(sentences, start=1):
            print(f"Analyzing sentence {i}/{len(sentences)}: '{sentence}'")
            results.append(self.analyze_emotions(sentence))
        return results

    def batch_analyze_and_save_to_csv(self, sentences, output_csv="emotion_analysis.csv"):
       
        results = self.batch_analyze(sentences)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_csv_path = script_dir

        # Save results to CSV
        try:
            output_csv_path = os.path.join(script_dir, output_csv)
            with open(output_csv_path, mode="w", newline="", encoding="utf-8") as file:
                writer = csv.writer(file)
                writer.writerow(["Sentence"] + [label.capitalize() for label in self.emotion_labels])
                for sentence, emotion_scores in zip(sentences, results):
                    row = [sentence] + [f"{emotion_scores.get(emotion, 0.0):.3f}" for emotion in self.emotion_labels]
                    writer.writerow(row)
            print(f"Emotion analysis results saved to {output_csv_path}")
        except Exception as e:
            print(f"Error saving CSV: {e}")

def preprocess_paragraph(paragraph):
  
    # Regex to divide sentences logically
    paragraph = re.sub(r'(?<=[.!?])(?=[^\s])', ' ', paragraph)
    paragraph = re.sub(r'\.\.\.(?!\s)', '…', paragraph)  

    # Normalize quotation marks
    paragraph = paragraph.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    
    # Restore the ellipses from the placeholder
    paragraph = paragraph.replace('<<ELLIPSIS>>', '...')
    return paragraph.strip()

def read_sentences_from_file(file_path):
   
    sentences = []
    with open(file_path, mode="r", encoding="utf-8") as file:
        for line in file:
            if line.strip():  # Ignore empty lines
                cleaned_line = preprocess_paragraph(line.strip())
                sentences.extend(nltk.sent_tokenize(cleaned_line))
    return sentences

if __name__ == "__main__":
    
    # Initialize the GoEmotionsAnalyzer
    analyzer = GoEmotionsAnalyzer()
    input_file = os.path.join("backend", "sentences.txt")
    sentences = read_sentences_from_file(input_file)

    # Batch sentence analysis and save the results to a CSV file
    analyzer.batch_analyze_and_save_to_csv(sentences, output_csv="emotion_analysis.csv")
