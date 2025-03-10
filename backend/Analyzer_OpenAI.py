import spacy
import openai
import json
import re
from flask import Flask, request, jsonify

# Read the OpenAI API key from the file
with open(r"C:\Users\seyit\Desktop\openAIToken.txt", "r") as file:
    api_key = file.read().strip()

if not api_key:
    raise Exception("The OPENAI_API_KEY is not set in the file.")

# Set the OpenAI API key for authentication
openai.api_key = api_key

class EmotionsAnalyzer:
    def __init__(self, model_name="gpt-4o-mini"):
        self.model_name = model_name
        self.spacy_nlp = spacy.load("en_core_web_sm")

    def analyze_emotions(self, sentence):
        """Analyze a single sentence for emotion scores using GPT-4o Mini."""
        
        # Skip short sentences
        if len(sentence.split()) < 3:
            return {"joy": 0.0, "sadness": 0.0, "fear": 0.0, "disgust": 0.0, "anger": 0.0, "surprise": 0.0, "neutral": 1.0}

        prompt = (
            "Classify the following sentence into Ekman's six emotions: Joy, Sadness, Fear, Disgust, Anger, Surprise, plus Neutral. "
            "Provide confidence scores (0 to 1) for each emotion. "
            "Output ONLY JSON. No explanations, no extra text. "
            "Format: {\"joy\": 0.0, \"sadness\": 0.0, \"fear\": 0.0, \"disgust\": 0.0, \"anger\": 0.0, \"surprise\": 0.0, \"neutral\": 0.0} "
            f"Sentence: \"{sentence}\""
        )

        try:
            response = openai.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "You are an AI emotion classifier."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=100
            )

            response_text = response.choices[0].message.content.strip()
            
            if not response_text:  # If OpenAI returned an empty response
                print(f"⚠️ Empty response for: {sentence}")
                return {"joy": 0.0, "sadness": 0.0, "fear": 0.0, "disgust": 0.0, "anger": 0.0, "surprise": 0.0, "neutral": 1.0}

            # Extract JSON part safely using regex
            match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if match:
                response_text = match.group(0)  # Extract only the JSON part
            else:
                print(f"⚠️ No valid JSON found in response for: {sentence}, returning default values.")
                return {"joy": 0.0, "sadness": 0.0, "fear": 0.0, "disgust": 0.0, "anger": 0.0, "surprise": 0.0, "neutral": 1.0}

            # Parse JSON
            emotion_scores = json.loads(response_text)
            return emotion_scores

        except json.JSONDecodeError as e:
            print(f"⚠️ JSON Parsing Error: {e}. Response received: {response_text}")
            return {"joy": 0.0, "sadness": 0.0, "fear": 0.0, "disgust": 0.0, "anger": 0.0, "surprise": 0.0, "neutral": 1.0}  # Safe return

        except Exception as e:
            print(f"❌ Error in emotion analysis: {e}")
            return {"joy": 0.0, "sadness": 0.0, "fear": 0.0, "disgust": 0.0, "anger": 0.0, "surprise": 0.0, "neutral": 1.0}

    def batch_analyze(self, sentences):
        """Perform emotion analysis on a list of sentences."""
        print(f"Starting batch analysis for {len(sentences)} sentences...")
        results = []
        for i, sentence in enumerate(sentences, start=1):
            print(f"Analyzing sentence {i}/{len(sentences)}: '{sentence}'")
            results.append(self.analyze_emotions(sentence))
        return results

    def analyze_dynamic_text(self, text):
        """Analyze a longer text by splitting it into sentences."""
        print("Analyzing text with GPT-4o Mini...")
        sentences = self.split_text_into_sentences(text)

        if not sentences:
            print("No valid sentences extracted.")
            return []

        print(f"Extracted {len(sentences)} sentences for analysis")
        results = self.batch_analyze(sentences)
        print("Batch analysis completed.")

        combined_results = []
        for sentence, score in zip(sentences, results):
            combined_results.append({"sentence": sentence, "emotions": score})

        return combined_results

    def split_text_into_sentences(self, text):
        """Splits text into sentences using spaCy."""
        doc = self.spacy_nlp(text)
        sentences = [sent.text.strip() for sent in doc.sents]
        return sentences
