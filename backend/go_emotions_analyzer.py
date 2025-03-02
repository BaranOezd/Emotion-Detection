import os
import nltk
import re
from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

app = Flask(__name__)

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
                self.emotion_pipeline = pipeline(
                    "text-classification",
                    model=self.model,
                    tokenizer=self.tokenizer,
                    top_k=None
                )
                # Get labels (e.g., Joy, Sadness, etc.)
                self.emotion_labels = list(self.model.config.id2label.values())
                print("Model loaded successfully.")
            except Exception as e:
                print(f"Error loading model: {e}")
                raise

    def analyze_emotions(self, sentence):
        """Analyze a single sentence for emotion scores."""
        self._load_model()
        results = self.emotion_pipeline(sentence)
        return {result['label']: result['score'] for result in results[0]}

    def batch_analyze(self, sentences):
        """Perform emotion analysis on a list of sentences."""
        self._load_model()
        print(f"Starting batch analysis for {len(sentences)} sentences...")
        results = []
        for i, sentence in enumerate(sentences, start=1):
            print(f"Analyzing sentence {i}/{len(sentences)}: '{sentence}'")
            results.append(self.analyze_emotions(sentence))
        return results

    def analyze_dynamic_text(self, text):
        print("GoEmotionsAnalyzer.analyze_dynamic_text called with text:", text[:30])  # Debug log

        self._load_model()  # Ensure the model is loaded
        sentences = self.split_text_into_sentences(text)  # Preprocess text

        if not sentences:
            print("No valid sentences extracted.")  # Debugging log
            return []  # Ensure it returns a valid list

        print(f"Extracted {len(sentences)} sentences for analysis")  # Debug log
        
        # Perform batch analysis
        results = self.batch_analyze(sentences)
        print("Batch analysis completed.")

        # Combine each sentence with its emotion scores into a single object
        combined_results = []
        for sentence, score in zip(sentences, results):
            combined_results.append({
                "sentence": sentence,
                "emotions": score
            })

        return combined_results

    def split_text_into_sentences(self, text):
        """
        Splits text into sentences.
        Normalizes quotes, ellipses, and prevents false splits using a custom abbreviation list.
        """
        # Normalize curly quotes to straight quotes and "..." to ellipsis
        text = text.replace("‘", "'").replace("’", "'")
        text = text.replace("“", '"').replace("”", '"')
        text = text.replace("...", "…")

        # Add space after punctuation (avoid splitting quotes/parentheses)
        text = re.sub(r'(?<=[.!?])(?=[^\s"\'])', ' ', text)
        
        # Custom abbreviations to prevent false sentence splits
        custom_abbreviations = ['mr', 'mrs', 'dr', 'vs', 'e.g', 'i.e', 'etc', 'prof', 'inc', 'st']
        tokenizer = nltk.data.load('tokenizers/punkt/english.pickle')
        tokenizer._params.abbrev_types.update(custom_abbreviations)

        candidate_sentences = tokenizer.tokenize(text.strip())

        # Merge sentences if split mid-quotation or due to ellipsis
        merged_sentences = []
        buffer = ""
        for sentence in candidate_sentences:
            quote_count = sentence.count('"') + sentence.count("'")
            has_ellipsis = "…" in sentence
            if buffer:
                sentence = buffer + " " + sentence
                buffer = ""
            if quote_count % 2 != 0 or has_ellipsis:
                buffer = sentence
            else:
                merged_sentences.append(sentence)
        if buffer:
            merged_sentences.append(buffer)

        # Merge sentences that start with an ellipsis with the previous sentence
        final_sentences = []
        i = 0
        while i < len(merged_sentences):
            sentence = merged_sentences[i]
            if i + 1 < len(merged_sentences) and merged_sentences[i+1].strip().startswith("…"):
                sentence += " " + merged_sentences[i+1].strip()
                i += 1
            final_sentences.append(sentence)
            i += 1

        return final_sentences

# Instantiate a global analyzer object
analyzer = GoEmotionsAnalyzer()

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        text = data.get("text", "").strip()
        if not text:
            return jsonify({"error": "No text provided"}), 400

        print("/analyze endpoint triggered")
        results = analyzer.analyze_dynamic_text(text)
        print("Analysis complete")
        return jsonify({"results": results})
    except Exception as e:
        print(f"Error during analysis: {e}")
        return jsonify({"error": f"An error occurred during analysis: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)
