import spacy
from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
import torch
import psutil
from functools import lru_cache
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from multiprocessing import cpu_count

class EmotionsAnalyzer:
    def __init__(self, model_name="SamLowe/roberta-base-go_emotions"):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.emotion_labels = None
        self.spacy_nlp = spacy.load("en_core_web_sm")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.max_batch_size = 16  # Base batch size
        self.min_batch_size = 4   # Don't go below this unless necessary
        self.batch_size = 16  # Reduced batch size
        self.min_free_memory = 1000  # Reduced to 1GB minimum
        self.memory_threshold_ratio = 0.8  # Only warn when at 80% of min memory
        self.last_warning_time = 0
        self.warning_cooldown = 5  # Seconds between warnings
        self.check_frequency = 4  # Check resources less frequently
        self._cache = {}
        self.max_workers = min(2, cpu_count() - 1)  # Limit to 2 threads max
        self.cpu_threshold = 70  # Lower CPU threshold
        self.process_delay = 0.1  # Add small delay between batches
        self.thread_executor = ThreadPoolExecutor(max_workers=self.max_workers)
        self._initialize_model()  # Pre-load model

    def _initialize_model(self):
        """Pre-load model during initialization"""
        self._load_model()
        # Warmup run to initialize CUDA
        if torch.cuda.is_available():
            dummy_input = ["warmup text"]
            self._process_batch(dummy_input)

    def _load_model(self):
        if self.model is None or self.tokenizer is None:
            print(f"Loading model '{self.model_name}'...")
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
                self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
                self.model = self.model.to(self.device)
                self.model.eval()  # Set to evaluation mode
                self.emotion_labels = list(self.model.config.id2label.values())
                print(f"Model loaded successfully on {self.device}")
            except Exception as e:
                print(f"Error loading model: {e}")
                raise

    @lru_cache(maxsize=1024)
    def _analyze_single(self, sentence):
        """Cached single sentence analysis"""
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
        """Process a batch with memory safety checks"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()  # Clear GPU cache before processing

        # Check cache first
        cached_results = []
        uncached_sentences = []
        uncached_indices = []

        for i, sentence in enumerate(batch):
            if sentence in self._cache:
                cached_results.append((i, self._cache[sentence]))
            else:
                uncached_sentences.append(sentence)
                uncached_indices.append(i)

        if uncached_sentences:
            # Process uncached sentences in one batch
            inputs = self.tokenizer(uncached_sentences, padding=True, truncation=True, return_tensors="pt").to(self.device)
            with torch.no_grad():
                outputs = self.model(**inputs)
                predictions = torch.softmax(outputs.logits, dim=-1)
                
                for idx, pred in zip(uncached_indices, predictions):
                    emotions = {self.emotion_labels[j]: float(score) for j, score in enumerate(pred)}
                    self._cache[batch[idx]] = emotions
                    cached_results.append((idx, emotions))

        # Sort by original index
        cached_results.sort(key=lambda x: x[0])
        return [result[1] for result in cached_results]

    def _check_system_resources(self):
        """Check if system has enough resources with reduced warnings"""
        current_time = time.time()
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        available_gb = memory.available / (1024 * 1024 * 1024)

        # More aggressive CPU throttling
        if cpu_percent > self.cpu_threshold:
            time.sleep(self.process_delay)  # Add delay when CPU is high
            if current_time - self.last_warning_time > self.warning_cooldown:
                print(f"Throttling: CPU {cpu_percent}%")
                self.last_warning_time = current_time
            self.batch_size = max(2, self.batch_size - 4)  # Reduce batch size more aggressively
            return False

        return True

    def _safe_batch_size(self, total_sentences):
        """Dynamically adjust batch size based on available resources"""
        if not self._check_system_resources():
            return 1
        return min(self.max_batch_size, total_sentences)

    def _process_batch_parallel(self, sentences):
        """Process sentences in parallel using thread pool"""
        futures = []
        results = []
        
        # Split into smaller chunks for parallel processing
        chunk_size = max(1, len(sentences) // self.max_workers)
        chunks = [sentences[i:i + chunk_size] for i in range(0, len(sentences), chunk_size)]
        
        try:
            # Submit chunks to thread pool
            for chunk in chunks:
                future = self.thread_executor.submit(self._process_batch, chunk)
                futures.append(future)
            
            # Collect results as they complete
            for future in as_completed(futures):
                results.extend(future.result())
                
        except Exception as e:
            print(f"Error in parallel processing: {e}")
            # Fallback to sequential processing
            results = self._process_batch(sentences)
            
        return results

    def analyze_emotions(self, sentence):
        """Analyze a single sentence for emotion scores."""
        self._load_model()
        
        # Use _process_batch for consistency and caching
        results = self._process_batch([sentence])
        return results[0] if results else {}

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
        self._load_model()
        sentences = self.split_text_into_sentences(text)
        if not sentences:
            return []

        total = len(sentences)
        results = []
        progress = {"processed": 0, "total": total, "batch_size": self.batch_size}

        try:
            # Process batches in parallel
            for i in range(0, total, self.batch_size):
                # Add delay between batches
                time.sleep(self.process_delay)
                batch = sentences[i:i + self.batch_size]
                batch_results = self._process_batch_parallel(batch)
                
                results.extend([
                    {"sentence": sent, "emotions": emo}
                    for sent, emo in zip(batch, batch_results)
                ])
                
                if i % (self.batch_size * self.check_frequency) == 0:
                    self._check_system_resources()
                    progress["processed"] = len(results)
                    print(f"Processed {len(results)}/{total} sentences")

        except Exception as e:
            print(f"Error during analysis: {e}")
            if hasattr(e, '__class__') and e.__class__.__name__ == 'RuntimeError':
                # Handle CUDA out of memory
                if "out of memory" in str(e):
                    torch.cuda.empty_cache()
                    self.batch_size = max(1, self.batch_size // 2)
                    remaining = sentences[len(results):]
                    if remaining:
                        more_results = self.analyze_dynamic_text(" ".join(remaining))
                        if more_results and "results" in more_results:
                            results.extend(more_results["results"])

        return {"results": results, "progress": progress}

    def split_text_into_sentences(self, text):
        """
        Splits text into sentences using spaCy's robust sentence segmentation
        while preserving the original white spaces.
        """
        doc = self.spacy_nlp(text)
        sentences = [sent.text for sent in doc.sents]
        return sentences

    def analyze_emotions_batch(self, sentences):
        """
        Analyze emotions for multiple sentences at once
        :param sentences: List of sentences to analyze
        :return: List of emotion dictionaries
        """
        if not sentences:
            return []
        
        results = []
        for sentence in sentences:
            results.append(self.analyze_emotions(sentence))
        return results

