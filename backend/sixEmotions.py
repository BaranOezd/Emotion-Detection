import csv

# Define the sentences
sentences = [
    "I can't believe this is happening, it's amazing!",
    "I'm so disappointed in you right now.",
    "You make me feel so loved and cherished.",
    "I am absolutely terrified of what comes next.",
    "Wow, what a shocking turn of events!",
    "I'm filled with rage over this injustice!",
    "Life feels so empty and pointless these days.",
    "I adore spending time with my family.",
    "This is beyond frustrating. I'm done.",
    "I feel a little anxious but also excited for tomorrow."
]

# Simulate emotion analysis based on Ekman's six basic emotions + neutral
# These values represent hypothetical emotions for each sentence.
emotion_model = {
    "I can't believe this is happening, it's amazing!": {
        "happiness": 0.9, "sadness": 0.0, "fear": 0.1, "anger": 0.0, "surprise": 0.8, "disgust": 0.0, "neutral": 0.0
    },
    "I'm so disappointed in you right now.": {
        "happiness": 0.0, "sadness": 0.9, "fear": 0.0, "anger": 0.7, "surprise": 0.1, "disgust": 0.0, "neutral": 0.0
    },
    "You make me feel so loved and cherished.": {
        "happiness": 0.8, "sadness": 0.0, "fear": 0.0, "anger": 0.0, "surprise": 0.2, "disgust": 0.0, "neutral": 0.0
    },
    "I am absolutely terrified of what comes next.": {
        "happiness": 0.0, "sadness": 0.0, "fear": 0.9, "anger": 0.1, "surprise": 0.5, "disgust": 0.0, "neutral": 0.0
    },
    "Wow, what a shocking turn of events!": {
        "happiness": 0.0, "sadness": 0.0, "fear": 0.2, "anger": 0.0, "surprise": 0.9, "disgust": 0.0, "neutral": 0.0
    },
    "I'm filled with rage over this injustice!": {
        "happiness": 0.0, "sadness": 0.0, "fear": 0.0, "anger": 0.9, "surprise": 0.0, "disgust": 0.3, "neutral": 0.0
    },
    "Life feels so empty and pointless these days.": {
        "happiness": 0.0, "sadness": 0.9, "fear": 0.0, "anger": 0.0, "surprise": 0.0, "disgust": 0.0, "neutral": 0.0
    },
    "I adore spending time with my family.": {
        "happiness": 0.8, "sadness": 0.0, "fear": 0.0, "anger": 0.0, "surprise": 0.1, "disgust": 0.0, "neutral": 0.0
    },
    "This is beyond frustrating. I'm done.": {
        "happiness": 0.0, "sadness": 0.0, "fear": 0.0, "anger": 0.8, "surprise": 0.0, "disgust": 0.1, "neutral": 0.0
    },
    "I feel a little anxious but also excited for tomorrow.": {
        "happiness": 0.5, "sadness": 0.0, "fear": 0.5, "anger": 0.0, "surprise": 0.0, "disgust": 0.0, "neutral": 0.0
    }
}

# Prepare data for CSV
csv_data = []
for sentence in sentences:
    emotions = emotion_model[sentence]
    row = [sentence] + [emotions[emotion] for emotion in ["happiness", "sadness", "fear", "anger", "surprise", "disgust", "neutral"]]
    csv_data.append(row)

# Define CSV file path
csv_file = 'emotion_analysis.csv'

# Write to CSV
header = ["Sentence", "Happiness", "Sadness", "Fear", "Anger", "Surprise", "Disgust", "Neutral"]
with open(csv_file, mode='w', newline='', encoding='utf-8') as file:
    writer = csv.writer(file)
    writer.writerow(header)
    writer.writerows(csv_data)

print(f"CSV file '{csv_file}' has been created.")
