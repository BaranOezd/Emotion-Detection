import spacy
from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

class EmotionsAnalyzer:
    def __init__(self, model_name="j-hartmann/emotion-english-distilroberta-base"):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.emotion_pipeline = None
        self.emotion_labels = None
        self.spacy_nlp = spacy.load("en_core_web_sm")

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
        # Convert the pipeline result to a dictionary mapping emotion labels to scores.
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
        print("GoEmotionsAnalyzer.analyze_dynamic_text called with text:", text[:30])
        self._load_model()  # Ensure the model is loaded
        sentences = self.split_text_into_sentences(text)  # Preprocess text

        if not sentences:
            print("No valid sentences extracted.")
            return []  # Return an empty list if no sentences are found

        print(f"Extracted {len(sentences)} sentences for analysis")
        
        # Perform batch analysis
        results = self.batch_analyze(sentences)
        print("Batch analysis completed.")

        # Combine each sentence with its corresponding emotion scores into a single object
        combined_results = []
        for sentence, score in zip(sentences, results):
            combined_results.append({
                "sentence": sentence,
                "emotions": score
            })

        return combined_results

    def split_text_into_sentences(self, text):
        """
        Splits text into sentences using spaCy's robust sentence segmentation
        while preserving the original white spaces.
        """
        doc = self.spacy_nlp(text)
        sentences = [sent.text for sent in doc.sents]
        return sentences

