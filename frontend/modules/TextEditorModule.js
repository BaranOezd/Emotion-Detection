export default class TextEditorModule {
  constructor(editorSelector) {
    this.editor = document.querySelector(editorSelector);
    this.scrollCallbacks = [];
    this.changeCallbacks = [];
    this.debounceTimeout = null;
    this.debounceDelay = 2500; // 2.5 seconds delay before triggering analysis
    
    if (!this.editor) {
      console.warn(`No editor found with selector: ${editorSelector}`);
      return;
    }
    
    // Try to restore content from localStorage if it exists
    const savedContent = localStorage.getItem('editorContent');
    if (savedContent) {
      this.editor.innerHTML = savedContent;
      console.log('Restored editor content from localStorage');
    } else {
      // Default content if nothing is saved
      this.editor.innerHTML = "Enter some text here for analysis.";
    }
    
    // Add event listeners
    this.editor.addEventListener("input", this._handleInput.bind(this));
    this.editor.addEventListener("scroll", this._handleScroll.bind(this));
  }
  
  /**
   * Handle input events in the text editor with debouncing
   * @private
   */
  _handleInput(event) {
    // Save to localStorage
    localStorage.setItem('editorContent', this.editor.innerHTML);
    
    // Clear any existing timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    // Set a new timeout to trigger analysis after delay
    this.debounceTimeout = setTimeout(() => {
      const text = this.getText().trim();
      if (text) {
        this.changeCallbacks.forEach(callback => callback(text));
      }
    }, this.debounceDelay);
  }
  
  /**
   * Render the sentences with optional highlighting and paragraph structure
   */
  renderSentences(results, selectedIndex = null, onSentenceSelect = () => {}, options = {}) {
    if (!this.editor || !results || results.length === 0) return;
    
    // Check if we have structured data available
    if (results.structured_data && results.structured_data.structured_text) {
      this._renderStructuredText(results, selectedIndex, onSentenceSelect);
    } else {
      this._renderFlatText(results, selectedIndex, onSentenceSelect);
    }
    
    // Save to localStorage
    localStorage.setItem('editorContent', this.editor.innerHTML);
    localStorage.setItem('analysisData', JSON.stringify(results));
    
    // Execute after render callback if provided
    setTimeout(() => {
      if (typeof options.afterRender === 'function') {
        options.afterRender();
      }
    }, 10);
  }

  /**
   * Render text with preserved paragraph structure
   */
  _renderStructuredText(results, selectedIndex, onSentenceSelect) {
    const structuredText = results.structured_data.structured_text;
    const sentences = results.results;
    let html = '';
    let sentenceIndex = 0;
    
    // Create a mapping from sentence index to sentence
    const sentenceMap = {};
    sentences.forEach((s, idx) => {
      sentenceMap[idx] = s;
    });
    
    structuredText.forEach(element => {
      if (element.type === 'paragraph') {
        html += '<div class="paragraph">';
        element.sentences.forEach(sentenceInfo => {
          const idx = sentenceInfo.id;
          if (sentenceMap[idx]) {
            const selectedClass = (selectedIndex !== null && selectedIndex === idx) ? " selected" : "";
            html += `<span class="highlighted-sentence${selectedClass}" 
                          data-index="${idx}" 
                          tabindex="0" 
                          role="button" 
                          aria-label="Sentence ${idx + 1}">
                      ${sentenceMap[idx].sentence}
                    </span> `;
          }
        });
        html += '</div>';
      } else if (element.type === 'linebreak') {
        html += '<div class="linebreak">&nbsp;</div>';
      }
    });
    
    this.editor.innerHTML = html;
    this._attachSentenceListeners(onSentenceSelect);
  }
  
  /**
   * Render flat text (legacy format)
   */
  _renderFlatText(results, selectedIndex, onSentenceSelect) {
    const updatedContent = results.map((item, index) => {
      const selectedClass = (selectedIndex !== null && Number(selectedIndex) === index) ? " selected" : "";
      const sentenceText = item.sentence || '';
      
      // Group by paragraphs if paragraph_id is available
      const paraStart = index > 0 && 
                       item.paragraph_id !== undefined && 
                       results[index-1].paragraph_id !== item.paragraph_id ? 
                       '<div class="paragraph-break"></div>' : '';
      
      return `${paraStart}<span class="highlighted-sentence${selectedClass}" 
                    data-index="${index}" 
                    tabindex="0" 
                    role="button" 
                    aria-label="Sentence ${index + 1}">
                ${sentenceText}
              </span>`;
    }).join(" ");
    
    this.editor.innerHTML = updatedContent;
    this._attachSentenceListeners(onSentenceSelect);
  }

  /**
   * Attach click listeners to sentence elements
   */
  _attachSentenceListeners(onSentenceSelect) {
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
  
  /**
   * Get the text content
   */
  getText() {
    return this.editor ? this.editor.innerText : "";
  }
  
  /**
   * Register a callback to be notified of content changes
   */
  onContentChange(callback) {
    if (typeof callback === 'function') {
      this.changeCallbacks.push(callback);
    }
  }

  /**
   * Handle scroll events in the text editor
   * @private
   */
  _handleScroll(event) {
    if (!this.editor || this.scrollCallbacks.length === 0) return;
    
    const sentences = this.editor.querySelectorAll(".highlighted-sentence");
    if (sentences.length === 0) return;
    
    const editorRect = this.editor.getBoundingClientRect();
    const visibleSentences = Array.from(sentences).filter(sentence => {
      const sentenceRect = sentence.getBoundingClientRect();
      return (
        sentenceRect.top < editorRect.bottom &&
        sentenceRect.bottom > editorRect.top
      );
    });
    
    const firstVisibleIndex = visibleSentences.length > 0
      ? parseInt(visibleSentences[0].getAttribute("data-index"), 10)
      : 0;
    const lastVisibleIndex = visibleSentences.length > 0
      ? parseInt(visibleSentences[visibleSentences.length - 1].getAttribute("data-index"), 10)
      : 0;
    
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
   * Register a callback for scroll events
   */
  onScroll(callback) {
    if (typeof callback === 'function') {
      this.scrollCallbacks.push(callback);
    }
  }
  
  /**
   * Get the currently visible sentence indices
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
