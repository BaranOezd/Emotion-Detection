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
        # Skip analysis for empty content
        if not sentence or not sentence.strip() or sentence.strip() == '\n':
            return {}
        return self._process_batch([sentence])[0]

    def preserve_text_structure(self, text):
        """Process text while preserving original structure including paragraph breaks"""
        # Split text into paragraphs while preserving empty lines
        paragraphs = text.split('\n')
        
        processed_paragraphs = []
        sentence_data = []
        sentence_id = 0
        
        for para_idx, paragraph in enumerate(paragraphs):
            if paragraph.strip():  # Non-empty paragraph
                doc = self.spacy_nlp(paragraph)
                processed_sentences = []
                
                for sent in doc.sents:
                    sentence_text = sent.text.strip()
                    # Skip empty sentences
                    if sentence_text and sentence_text != '\n' and not sentence_text.isspace():
                        # Use existing emotion analysis
                        emotions = self.analyze_emotions(sentence_text)
                        
                        # Only add if emotions were successfully analyzed
                        if emotions:
                            sentence_data.append({
                                'sentence': sentence_text,
                                'emotions': emotions,
                                'paragraph_id': para_idx,
                                'sentence_id': sentence_id,
                                'start_char': sent.start_char,
                                'end_char': sent.end_char
                            })
                            
                            processed_sentences.append({
                                'id': sentence_id,
                                'text': sentence_text
                            })
                            sentence_id += 1
                
                if processed_sentences:  # Only add paragraph if it has valid sentences
                    processed_paragraphs.append({
                        'type': 'paragraph',
                        'sentences': processed_sentences,
                        'original_text': paragraph
                    })
            else:  # Empty line - preserve as line break
                processed_paragraphs.append({
                    'type': 'linebreak',
                    'text': ''
                })
        
        return {
            'structured_text': processed_paragraphs,
            'sentences': sentence_data
        }

    def analyze_dynamic_text(self, text):
        """Analyze a block of text dynamically with structure preservation."""
        if not text or not text.strip():
            return {"results": [], "progress": {"processed": 0, "total": 0}}
        
        # Use structured text processing
        structured_result = self.preserve_text_structure(text)
        
        if not structured_result['sentences']:
            return {"results": [], "progress": {"processed": 0, "total": 0}}
        
        # Return results with both flat and structured formats
        results = []
        for sentence_data in structured_result['sentences']:
            results.append({
                'sentence': sentence_data['sentence'],
                'emotions': sentence_data['emotions'],
                'paragraph_id': sentence_data['paragraph_id']  # Include paragraph info
            })
        
        return {
            "results": results,
            "structured_data": structured_result,
            "progress": {"processed": len(results), "total": len(results)}
        }

    def split_text_into_sentences(self, text):
        """
        Splits text into sentences using spaCy.
        """
        doc = self.spacy_nlp(text)
        sentences = []
        
        for sent in doc.sents:
            sent_text = sent.text.strip()
            if sent_text and not sent_text.isspace():
                sentences.append(sent_text)
        
        return sentences

