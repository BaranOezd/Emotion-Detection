import csv
import os

from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
from collections import Counter


class GoEmotionsAnalyzer:
    def __init__(self, dataset_name="google-research-datasets/go_emotions", dataset_config="simplified",
                 model_name="bhadresh-savani/bert-base-uncased-emotion"):
        """
        Initialize the GoEmotionsAnalyzer with the GoEmotions dataset and a pre-trained model.

        :param dataset_name: The Hugging Face dataset name for GoEmotions
        :param dataset_config: The configuration for the GoEmotions dataset (e.g., "simplified")
        :param model_name: The Hugging Face model name for emotion classification
        """
        print(f"Loading GoEmotions dataset...")
        self.dataset = load_dataset(dataset_name, dataset_config)
        print("Dataset loaded successfully.")

        # Load the pre-trained model and tokenizer
        print(f"Loading model '{model_name}'...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.emotion_pipeline = pipeline("text-classification", model=self.model, tokenizer=self.tokenizer,
                                         top_k=None)  # Use top_k=None to replace deprecated return_all_scores=True
        print("Model loaded successfully.")

        # Extract and filter labels for the six emotions + neutral
        all_labels = self.dataset['train'].features['labels'].feature.names
        self.target_emotions = {"happiness", "sadness", "fear", "anger", "disgust", "surprise", "neutral"}
        self.emotion_labels = [label for label in all_labels if label.lower() in self.target_emotions]

    def analyze_emotions(self, sentence):
        """
        Analyze emotions for a given sentence using the pre-trained BERT model.

        :param sentence: The input text for emotion classification
        :return: A dictionary with emotions and their associated probabilities
        """
        results = self.emotion_pipeline(sentence)
        # Filter results to include only the six emotions + neutral
        emotion_scores = {result['label']: result['score'] for result in results[0]
                          if result['label'].lower() in self.target_emotions}
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
        Analyze emotions for a batch of sentences and save the results to a CSV file in the backend folder.

        :param sentences: A list of sentences
        :param output_csv: The name of the output CSV file
        """
        # Perform emotion analysis for each sentence
        results = self.batch_analyze(sentences)

        # Use the existing backend folder relative to the script
        script_dir = os.path.dirname(__file__)  # Directory of the current script
        backend_folder = script_dir         

        # Save results to CSV in the backend folder
        output_csv_path = os.path.join(backend_folder, output_csv)
        with open(output_csv_path, mode="w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)  # Default behavior: quote when necessary
            # Write header
            writer.writerow(["Sentence"] + self.emotion_labels)  # Add emotion labels as header

            # Write sentences and their corresponding emotion scores
            for sentence, emotion_scores in zip(sentences, results):
                row = [sentence]
                # Add scores for each emotion
                for emotion in self.emotion_labels:
                    score = emotion_scores.get(emotion, 0.0)  # Default to 0.0 if emotion is not present
                    row.append(f"{score:.2f}")
                writer.writerow(row)

        print(f"Emotion analysis results saved to {output_csv_path}")            

if __name__ == "__main__":
    # Initialize the GoEmotionsAnalyzer
    analyzer = GoEmotionsAnalyzer()

    # Batch sentence analysis and save the results to a CSV file
    sentences = [        
        "I feel a little anxious but also excited for tomorrow",
        "I lost the only thing that kept me going.",
        "Every day feels heavier than the last.",
        "I don't know how much more of this I can",
        "The world feels so distant and cold.",
        "All I see around me are reminders of what I have lost."
    ]
    analyzer.batch_analyze_and_save_to_csv(sentences, output_csv="emotion_analysis.csv")

    