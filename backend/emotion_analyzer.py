import spacy
from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
import torch
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor, as_completed
from multiprocessing import cpu_count

class EmotionAnalyzer:
    def __init__(self, model_name="SamLowe/roberta-base-go_emotions"):
        self.model_name = model_name
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.spacy_nlp = spacy.load("en_core_web_sm")
        self.max_batch_size = 16
        self.min_batch_size = 4
        self.batch_size = 16
        self.cpu_threshold = 70
        self.process_delay = 0.1
        max_workers = max(1, cpu_count() - 1)
        self.thread_executor = ThreadPoolExecutor(max_workers=max_workers)        
        self._cache = {}
        self.tokenizer = None  # Initialize tokenizer as None
        self.model = None      # Initialize model as None
        self.emotion_labels = None
        self._initialize_model()  # Pre-load model

    def _initialize_model(self):
        """Pre-load model during initialization."""
        if not self.tokenizer or not self.model:
            print(f"Loading model '{self.model_name}'...")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name).to(self.device)
            self.model.eval()
            self.emotion_labels = list(self.model.config.id2label.values())
            print(f"Model loaded successfully on {self.device}")
        if torch.cuda.is_available():
            self._process_batch(["warmup text"])  # Warmup run for CUDA

    @lru_cache(maxsize=1024)
    def _analyze_single(self, sentence):
        """Analyze a single sentence with caching."""
        if sentence in self._cache:
            return self._cache[sentence]
        inputs = self.tokenizer(sentence, return_tensors="pt", padding=True, truncation=True).to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)
            predictions = torch.softmax(outputs.logits, dim=-1)[0]
            result = {self.emotion_labels[i]: float(score) for i, score in enumerate(predictions)}
            self._cache[sentence] = result
            return result

    def _process_batch(self, batch):
        """Process a batch of sentences."""
        cached_results = [self._cache[sent] for sent in batch if sent in self._cache]
        uncached_sentences = [sent for sent in batch if sent not in self._cache]

        if uncached_sentences:
            inputs = self.tokenizer(uncached_sentences, return_tensors="pt", padding=True, truncation=True).to(self.device)
            with torch.no_grad():
                outputs = self.model(**inputs)
                predictions = torch.softmax(outputs.logits, dim=-1)
                for sent, pred in zip(uncached_sentences, predictions):
                    emotions = {self.emotion_labels[i]: float(score) for i, score in enumerate(pred)}
                    self._cache[sent] = emotions
                    cached_results.append(emotions)
        return cached_results

    def _process_batch_parallel(self, sentences):
        """Process sentences in parallel using thread pool."""
        chunk_size = max(1, len(sentences) // self.thread_executor._max_workers)
        chunks = [sentences[i:i + chunk_size] for i in range(0, len(sentences), chunk_size)]
        futures = [self.thread_executor.submit(self._process_batch, chunk) for chunk in chunks]
        results = []
        for future in as_completed(futures):
            results.extend(future.result())
        return results

    def analyze_emotions(self, sentence):
        """Analyze a single sentence for emotion scores."""
        return self._process_batch([sentence])[0]

    def analyze_dynamic_text(self, text):
        """Analyze a block of text dynamically."""
        sentences = self.split_text_into_sentences(text)
        if not sentences:
            return {"results": [], "progress": {"processed": 0, "total": 0}}

        # Filter out standalone newlines and whitespace
        valid_sentences = []
        for sentence in sentences:
            # Skip if sentence is just newlines or whitespace
            if sentence.strip() and not sentence.isspace() and sentence != '\n' and sentence != '\n\n':
                valid_sentences.append(sentence)

        if not valid_sentences:
            return {"results": [], "progress": {"processed": 0, "total": 0}}

        results = self._process_batch_parallel(valid_sentences)
        return {"results": [{"sentence": sent, "emotions": emo} for sent, emo in zip(valid_sentences, results)]}

    def split_text_into_sentences(self, text):
        """
        Splits text into sentences while preserving paragraph structure.
        """
        # Replace consecutive newlines with a special marker
        text = text.replace('\n\n', ' <PARAGRAPH> ').replace('\n', ' <NEWLINE> ')
        
        doc = self.spacy_nlp(text)
        sentences = []
        
        for sent in doc.sents:
            sent_text = sent.text.strip()
            if not sent_text:
                continue
            
            # Process the sentence
            processed_text = sent_text.replace('<PARAGRAPH>', '\n\n').replace('<NEWLINE>', '\n')
            if processed_text.strip():  # Only add if there's actual content
                sentences.append(processed_text)
        
        return sentences

