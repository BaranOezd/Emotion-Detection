export default class TextEditorModule {
  constructor(editorSelector) {
    this.editor = document.querySelector(editorSelector);
    this.scrollCallbacks = [];
    if (!this.editor) {
      console.warn(`No editor found with selector: ${editorSelector}`);
      return;
    }
    
    // Restore saved content if available, or load default sample text.
    const savedText = localStorage.getItem("savedText");
    if (savedText) {
      this.editor.innerHTML = this._preserveWhitespace(savedText);
    } else {
      const sampleText = "Enter some default text here for analysis.";
      this.editor.innerHTML = this._preserveWhitespace(sampleText);
      localStorage.setItem("savedText", sampleText);
    }
    
    // Save content on each input event.
    this.editor.addEventListener("input", () => {
      localStorage.setItem("savedText", this.editor.innerText);
    });

    // Add scroll event listener to track scrolling
    this.editor.addEventListener("scroll", this._handleScroll.bind(this));
  }
  
  /**
   * Convert newlines to <br> tags and preserve consecutive white spaces.
   * @param {string} text - The plain text to be converted.
   * @returns {string} - The converted HTML string.
   */
  _preserveWhitespace(text) {
    // Remove any existing <br> tags to avoid double conversion.
    text = text.replace(/<br\s*\/?>/gi, '\n');
    // Replace newline characters with <br> tags.
    let preservedText = text.replace(/\n/g, '<br>');
    // Replace occurrences of double spaces with a space and a non-breaking space.
    preservedText = preservedText.replace(/ {2}/g, ' &nbsp;');
    return preservedText;
  }
  
  /**
   * Render the sentences with optional highlighting.
   * @param {Array} results - Array of sentence objects.
   * @param {number|null} selectedIndex - Index of the sentence to highlight.
   * @param {Function} onSentenceSelect - Callback invoked with the selected index.
   */
  renderSentences(results, selectedIndex = null, onSentenceSelect = () => {}) {
    if (!this.editor) return;
    
    // Build the HTML for each sentence with accessibility attributes.
    const updatedContent = results.map((item, index) => {
      const selectedClass = (selectedIndex !== null && Number(selectedIndex) === index) ? " selected" : "";
      // Use _preserveWhitespace to maintain white spaces within each sentence.
      const sentenceHTML = this._preserveWhitespace(item.sentence);
      return `<span class="highlighted-sentence${selectedClass}" 
                      data-index="${index}" 
                      tabindex="0" 
                      role="button" 
                      aria-label="Sentence ${index + 1}: ${item.sentence}">
                  ${sentenceHTML}
                </span>`;
    }).join(""); 
    
    this.editor.innerHTML = updatedContent;
    
    // Attach event listeners to each sentence span.
    const spans = this.editor.querySelectorAll(".highlighted-sentence");
    spans.forEach(span => {
      const selectSentence = () => {
        spans.forEach(s => s.classList.remove("selected"));
        span.classList.add("selected");
        const index = parseInt(span.getAttribute("data-index"), 10);
        onSentenceSelect(index);
      };
  
      span.addEventListener("click", selectSentence);
      span.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          selectSentence();
        }
      });
    });
  }
  
  getText() {
    return this.editor ? this.editor.innerText : "";
  }
  
  onTextChange(callback) {
    if (this.editor) {
      this.editor.addEventListener("input", callback);
    }
  }

  /**
   * Handle scroll events in the text editor
   * @private
   */
  _handleScroll(event) {
    if (!this.editor || this.scrollCallbacks.length === 0) return;
    
    // Get all sentence elements
    const sentences = this.editor.querySelectorAll(".highlighted-sentence");
    if (sentences.length === 0) return;
    
    // Calculate which sentences are visible in the viewport
    const editorRect = this.editor.getBoundingClientRect();
    const visibleSentences = Array.from(sentences).filter(sentence => {
      const sentenceRect = sentence.getBoundingClientRect();
      // Check if the sentence is at least partially visible
      return (
        sentenceRect.top < editorRect.bottom &&
        sentenceRect.bottom > editorRect.top
      );
    });
    
    // Get the index of the first and last visible sentences
    const firstVisibleIndex = visibleSentences.length > 0
      ? parseInt(visibleSentences[0].getAttribute("data-index"), 10)
      : 0;
    const lastVisibleIndex = visibleSentences.length > 0
      ? parseInt(visibleSentences[visibleSentences.length - 1].getAttribute("data-index"), 10)
      : 0;
    
    // Notify all registered callbacks
    this.scrollCallbacks.forEach(callback => {
      callback({
        firstVisibleIndex,
        lastVisibleIndex,
        visibleCount: visibleSentences.length,
        totalCount: sentences.length,
        scrollTop: this.editor.scrollTop,
        scrollHeight: this.editor.scrollHeight,
        viewportHeight: editorRect.height
      });
    });
  }
  
  /**
   * Register a callback to be notified of scroll events
   * @param {Function} callback - Function to be called when scrolling occurs
   */
  onScroll(callback) {
    if (typeof callback === 'function') {
      this.scrollCallbacks.push(callback);
    }
  }
  
  /**
   * Get the currently visible sentence indices
   * @returns {Object} Information about visible sentences
   */
  getVisibleSentences() {
    if (!this.editor) return { firstVisibleIndex: 0, lastVisibleIndex: 0 };
    
    const sentences = this.editor.querySelectorAll(".highlighted-sentence");
    if (sentences.length === 0) return { firstVisibleIndex: 0, lastVisibleIndex: 0 };
    
    const editorRect = this.editor.getBoundingClientRect();
    const visibleSentences = Array.from(sentences).filter(sentence => {
      const sentenceRect = sentence.getBoundingClientRect();
      return (
        sentenceRect.top < editorRect.bottom &&
        sentenceRect.bottom > editorRect.top
      );
    });
    
    if (visibleSentences.length === 0) return { firstVisibleIndex: 0, lastVisibleIndex: 0 };
    
    return {
      firstVisibleIndex: parseInt(visibleSentences[0].getAttribute("data-index"), 10),
      lastVisibleIndex: parseInt(visibleSentences[visibleSentences.length - 1].getAttribute("data-index"), 10)
    };
  }
}
