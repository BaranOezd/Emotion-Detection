import csv
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

        # Extract labels from the dataset
        self.emotion_labels = self.dataset['train'].features['labels'].feature.names

    def analyze_emotions(self, sentence):
        """
        Analyze emotions for a given sentence using the pre-trained BERT model.

        :param sentence: The input text for emotion classification
        :return: A dictionary with emotions and their associated probabilities
        """
        results = self.emotion_pipeline(sentence)
        # Convert results to a dictionary
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

        # Save results to CSV
        with open(output_csv, mode="w", newline="") as file:
            writer = csv.writer(file)
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

        print(f"Emotion analysis results saved to {output_csv}")

    def get_label_distribution(self):
        """
        Get the label distribution in the training split of the dataset.

        :return: A dictionary with label frequencies
        """
        print("Analyzing label distribution in the training split...")

        # Accessing the 'train' split of the dataset
        train_dataset = self.dataset['train']

        # Flatten the list of labels to handle multi-label examples
        all_labels = [label for labels in train_dataset['labels'] for label in labels]

        # Count the occurrences of each label
        label_counts = Counter(all_labels)

        # Prepare the label distribution
        label_distribution = {self.emotion_labels[label]: count for label, count in label_counts.items()}

        # Save the label distribution to a CSV file
        with open("label_distribution.csv", mode="w", newline="") as file:
            writer = csv.writer(file)
            writer.writerow(["Emotion", "Count"])  # Write header
            for label, count in label_distribution.items():
                writer.writerow([label, count])

        print(f"Label distribution saved to label_distribution.csv")
        return label_distribution


if __name__ == "__main__":
    # Initialize the GoEmotionsAnalyzer
    analyzer = GoEmotionsAnalyzer()

    # Batch sentence analysis and save the results to a CSV file
    sentences = [
       "I can't believe this is happening, it's amazing!", #(Expected: joy, surprise)
        "I'm so disappointed in you right now.", #(Expected: sadness, anger)
        "You make me feel so loved and cherished.", #(Expected: love, joy)
        "I am absolutely terrified of what comes next.", #(Expected: fear)
        "Wow, what a shocking turn of events!", #(Expected: surprise)
        "I'm filled with rage over this injustice!", #(Expected: anger)
        "Life feels so empty and pointless these days.", #(Expected: sadness)
        "I adore spending time with my family.", #(Expected: love, joy)
        "This is beyond frustrating. I'm done.", #(Expected: anger)
        "I feel a little anxious but also excited for tomorrow.", #(Expected: fear, joy)
    ]
    analyzer.batch_analyze_and_save_to_csv(sentences, output_csv="emotion_analysis.csv")
