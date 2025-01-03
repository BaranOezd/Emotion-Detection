import csv
import os

from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline


class GoEmotionsAnalyzer:
    def __init__(self, model_name="j-hartmann/emotion-english-distilroberta-base"):
        """
        Initialize the GoEmotionsAnalyzer with a pre-trained RoBERTa model.

        :param model_name: The Hugging Face model name for emotion classification
        """
        # Load the pre-trained RoBERTa model and tokenizer
        print(f"Loading model '{model_name}'...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.emotion_pipeline = pipeline("text-classification", model=self.model, tokenizer=self.tokenizer, top_k=None)
        print("Model loaded successfully.")

        # Extract emotion labels from the model configuration
        self.emotion_labels = list(self.model.config.id2label.values())
        print(f"Emotion labels: {self.emotion_labels}")

    def analyze_emotions(self, sentence):
        """
        Analyze emotions for a given sentence using the pre-trained RoBERTa model.

        :param sentence: The input text for emotion classification
        :return: A dictionary with emotions and their associated probabilities
        """
        results = self.emotion_pipeline(sentence)
        # Convert results to a dictionary with emotion scores
        emotion_scores = {result['label']: result['score'] for result in results[0]}
        return emotion_scores

    def batch_analyze(self, sentences):
        """
        Analyze emotions for a batch of sentences.

        :param sentences: A list of sentences
        :return: A list of dictionaries containing emotion scores for each sentence
        """
        print(f"Starting batch analysis for {len(sentences)} sentences...")
        results = []
        for i, sentence in enumerate(sentences, start=1):
            print(f"Analyzing sentence {i}/{len(sentences)}: '{sentence}'")
            results.append(self.analyze_emotions(sentence))
        return results

    def batch_analyze_and_save_to_csv(self, sentences, output_csv="emotion_analysis.csv"):
        """
        Analyze emotions for a batch of sentences and save the results to a CSV file.

        :param sentences: A list of sentences
        :param output_csv: The name of the output CSV file
        """
        # Perform emotion analysis for each sentence
        results = self.batch_analyze(sentences)

        # Get the current script directory
        script_dir = os.path.dirname(__file__)

        # Save results to CSV
        output_csv_path = os.path.join(script_dir, output_csv)
        with open(output_csv_path, mode="w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            # Write header
            writer.writerow(["Sentence"] + [label.capitalize() for label in self.emotion_labels])

            # Write sentences and their corresponding emotion scores
            for sentence, emotion_scores in zip(sentences, results):
                row = [sentence]
                # Add scores for each emotion
                for emotion in self.emotion_labels:
                    score = emotion_scores.get(emotion, 0.0)  # Default to 0.0 if emotion is not present
                    row.append(f"{score:.3f}")
                writer.writerow(row)

        print(f"Emotion analysis results saved to {output_csv_path}")


if __name__ == "__main__":
    # Initialize the GoEmotionsAnalyzer
    analyzer = GoEmotionsAnalyzer()

    # Batch sentence analysis and save the results to a CSV file
    sentences = [
        "I feel like the world has lost all its color and joy.",
        "Every day feels heavier than the last, and I don't know how to go on.",
        "I miss the person I used to be before everything fell apart.",
        "No matter how hard I try, the emptiness never seems to go away.",
        "I've lost the only thing that gave my life meaning and direction.",
        "It's like every step forward only reminds me of everything I've lost."
    ]
    analyzer.batch_analyze_and_save_to_csv(sentences, output_csv="emotion_analysis.csv")
