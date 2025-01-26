import csv
import os
import nltk
import re
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

class GoEmotionsAnalyzer:
    def __init__(self, model_name="j-hartmann/emotion-english-distilroberta-base"):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.emotion_pipeline = None
        self.emotion_labels = None

    def _load_model(self):
        if self.model is None or self.tokenizer is None:
            print(f"Loading model '{self.model_name}'...")
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
                self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
                self.emotion_pipeline = pipeline("text-classification", model=self.model, tokenizer=self.tokenizer, top_k=None)
                self.emotion_labels = list(self.model.config.id2label.values())
                print("Model loaded successfully.")
            except Exception as e:
                print(f"Error loading model: {e}")
                raise

    def analyze_emotions(self, sentence):
        self._load_model()
        results = self.emotion_pipeline(sentence)
        return {result['label']: result['score'] for result in results[0]}

    def batch_analyze(self, sentences):
        self._load_model()
        print(f"Starting batch analysis for {len(sentences)} sentences...")
        results = []
        for i, sentence in enumerate(sentences, start=1):
            print(f"Analyzing sentence {i}/{len(sentences)}: '{sentence}'")
            results.append(self.analyze_emotions(sentence))
        return results

    def batch_analyze_and_save_to_csv(self, sentences, output_csv="emotion_analysis.csv"):
        results = self.batch_analyze(sentences)
        self.save_results_to_csv(results, sentences, output_csv)

    def analyze_dynamic_text(self, text, output_csv="emotion_analysis.csv"):
        print("GoEmotionsAnalyzer.analyze_dynamic_text called for text:", text[:30])  # Debug log

        self._load_model()  # Ensure the model is loaded
        sentences = self.preprocess_paragraph(text)  # Preprocess text

        # Perform batch analysis once and save to CSV
        results = self.batch_analyze(sentences)
        self.save_results_to_csv(results, sentences, output_csv)
        print("Batch analysis completed and results saved")

        return results

    def save_results_to_csv(self, results, sentences, output_csv):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_csv_path = os.path.join(script_dir, output_csv)

        try:
            with open(output_csv_path, mode="w", newline="", encoding="utf-8") as file:
                writer = csv.writer(file)
                writer.writerow(["Sentence"] + [label.capitalize() for label in self.emotion_labels])
                for sentence, emotion_scores in zip(sentences, results):
                    row = [sentence] + [f"{emotion_scores.get(emotion, 0.0):.3f}" for emotion in self.emotion_labels]
                    writer.writerow(row)
            print(f"Emotion analysis results saved to {output_csv_path}")
        except Exception as e:
            print(f"Error saving CSV: {e}")

    def preprocess_paragraph(self, paragraph):
        # Regex to divide sentences logically
        paragraph = re.sub(r'(?<=[.!?])(?=[^\s])', ' ', paragraph)

        # Normalize quotation marks
        paragraph = paragraph.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")

        return nltk.sent_tokenize(paragraph.strip())
