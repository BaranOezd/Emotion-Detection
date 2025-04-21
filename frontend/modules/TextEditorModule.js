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
      // Process any special tags before setting content
      this.editor.innerHTML = this._processSpecialTags(savedContent);
      console.log('Restored editor content from localStorage');
    } else {
      // Default content if nothing is saved
      const sampleText = "Enter some text here for analysis.";
      this.editor.innerHTML = this._preserveWhitespace(sampleText);
    }
    
    // Add event listeners
    this.editor.addEventListener("input", this._handleInput.bind(this));
    this.editor.addEventListener("scroll", this._handleScroll.bind(this));
    
    // Add support for cursor position tracking
    this.lastCursorPosition = null;
    this.isUpdatingContent = false;
    this.lastSelectionRange = null;
    
    // Add cursor tracking event listeners
    this.editor.addEventListener("mouseup", this._saveCursorPosition.bind(this));
    this.editor.addEventListener("keyup", this._saveCursorPosition.bind(this));
    this.editor.addEventListener("click", this._saveCursorPosition.bind(this));
  }
  
  /**
   * Save current cursor position
   * @private
   */
  _saveCursorPosition() {
    if (!this.editor || this.isUpdatingContent) return;
    
    try {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Check if selection is within the editor
        if (!this.editor.contains(range.startContainer)) return;

        // Store a copy of the range for later use
        this.lastSelectionRange = {
          startContainer: range.startContainer,
          startOffset: range.startOffset,
          endContainer: range.endContainer,
          endOffset: range.endOffset,
          timestamp: Date.now()
        };
      }
    } catch (e) {
      console.warn('Could not save cursor position:', e);
    }
  }
  
  /**
   * Process special tags like <NEWLINE> and <PARAGRAPH> in text
   * @param {string} text - Text containing special tags
   * @returns {string} - Text with special tags converted to HTML elements
   */
  _processSpecialTags(text) {
    if (!text) return '';
    
    // Handle more variants of these tags with flexible spacing and case insensitivity
    
    // Handle HTML-encoded versions
    text = text.replace(/&lt;\s*PARAGRAPH\s*&gt;/gi, '<br><br>');
    text = text.replace(/&lt;\s*NEWLINE\s*&gt;/gi, '<br>');
    
    // Handle raw tags with various spacing patterns
    text = text.replace(/\s*<\s*PARAGRAPH\s*>\s*/gi, '<br><br>');
    text = text.replace(/\s*<\s*NEWLINE\s*>\s*/gi, '<br>');
    
    // Fix the case where < and tag name have a space between them
    text = text.replace(/\s*<\s+PARAGRAPH\s*>\s*/gi, '<br><br>');
    text = text.replace(/\s*<\s+NEWLINE\s*>\s*/gi, '<br>');
    
    // Handle bare tags (ensure these are last to catch any remaining instances)
    text = text.replace(/<PARAGRAPH>/gi, '<br><br>');
    text = text.replace(/<NEWLINE>/gi, '<br>');
    
    return text;
  }
  
  /**
   * Convert newlines to <br> tags and preserve consecutive white spaces.
   * @param {string} text - The plain text to be converted.
   * @returns {string} - The converted HTML string.
   */
  _preserveWhitespace(text) {
    if (!text) return '';
    text = text.replace(/<br\s*\/?>/gi, '\n');
    let preservedText = text.replace(/\n/g, '<br>');
    preservedText = preservedText.replace(/ {2}/g, ' &nbsp;');
    return preservedText;
  }
  
  /**
   * Handle input events in the text editor with debouncing
   * @private
   */
  _handleInput(event) {
    // Save current cursor position
    this._saveCursorPosition();
    
    // Clean any paragraph tags that might have been entered or pasted
    const content = this.editor.innerHTML;
    if (content.includes('PARAGRAPH') || content.includes('< PARAGRAPH') || content.match(/[<&].*PARAGRAPH/i)) {
      // Process content to replace all variants of PARAGRAPH tags
      this.editor.innerHTML = this._processSpecialTags(content);
      
      // Since we modified the content, restore the cursor position
      this._restoreCursorPosition();
    }
    
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
   * Restore cursor position after DOM updates
   * @private
   */
  _restoreCursorPosition() {
    if (!this.lastSelectionRange || !this.editor) return false;
    
    try {
      // Focus the editor element
      this.editor.focus();
      
      // Try direct range restoration
      if (this._tryDirectRangeRestoration()) {
        return true;
      }
      
      // If direct restoration fails, place cursor at end of content
      this._placeCursorAtEnd();
    } catch (e) {
      console.error('Error restoring cursor position:', e);
      this._placeCursorAtEnd();
    }
    
    return false;
  }
  
  /**
   * Try to directly restore selection range from saved reference
   * @private
   * @returns {boolean} Whether restoration was successful
   */
  _tryDirectRangeRestoration() {
    if (!this.lastSelectionRange || !this.editor) return false;
    
    try {
      // Check if container nodes still exist in document
      const startInDocument = document.contains(this.lastSelectionRange.startContainer);
      const endInDocument = document.contains(this.lastSelectionRange.endContainer);
      
      if (!startInDocument || !endInDocument) return false;
      
      // Create and set new range
      const selection = window.getSelection();
      const range = document.createRange();
      
      range.setStart(
        this.lastSelectionRange.startContainer,
        this.lastSelectionRange.startOffset
      );
      
      range.setEnd(
        this.lastSelectionRange.endContainer,
        this.lastSelectionRange.endOffset
      );
      
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Focus editor to ensure cursor is visible
      this.editor.focus();
      return true;
    } catch (e) {
      console.warn('Direct range restoration failed:', e);
      return false;
    }
  }
  
  /**
   * Find the last text node in a given element
   * @private
   */
  _findLastTextNode(element) {
    if (!element) return null;
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let lastNode = null;
    let currentNode;
    
    while (currentNode = walker.nextNode()) {
      lastNode = currentNode;
    }
    
    return lastNode;
  }
  
  /**
   * Place cursor at the end of the editor content
   * @private
   */
  _placeCursorAtEnd() {
    if (!this.editor) return false;
    
    try {
      this.editor.focus();
      
      const selection = window.getSelection();
      const range = document.createRange();
      
      if (this.editor.childNodes.length > 0) {
        const lastNode = this.editor.childNodes[this.editor.childNodes.length - 1];
        
        if (lastNode.nodeType === Node.TEXT_NODE) {
          range.setStart(lastNode, lastNode.length);
        } else {
          const lastTextNode = this._findLastTextNode(lastNode);
          if (lastTextNode) {
            range.setStart(lastTextNode, lastTextNode.textContent.length);
          } else {
            range.selectNodeContents(lastNode);
            range.collapse(false); // false means collapse to end
          }
        }
      } else {
        range.setStart(this.editor, 0);
      }
      
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      return true;
    } catch (e) {
      console.error('Error placing cursor at end:', e);
      return false;
    }
  }
  
  /**
   * Render the sentences with optional highlighting
   */
  renderSentences(results, selectedIndex = null, onSentenceSelect = () => {}, options = {}) {
    if (!this.editor || !results || results.length === 0) return;
    
    this._saveCursorPosition();
    this.isUpdatingContent = true;
    
    // Clean any PARAGRAPH tags from the results data - handle more variants
    results = results.map(item => {
      if (item.sentence) {
        // Remove all variations of the PARAGRAPH tag
        item.sentence = item.sentence.replace(/<\s*PARAGRAPH\s*>/gi, ' ');
        item.sentence = item.sentence.replace(/< PARAGRAPH>/gi, ' ');
        item.sentence = item.sentence.replace(/<\s+PARAGRAPH>/gi, ' ');
      }
      return item;
    });
    
    // Build the HTML for each sentence
    const updatedContent = results.map((item, index) => {
      const selectedClass = (selectedIndex !== null && Number(selectedIndex) === index) ? " selected" : "";
      const sentenceText = item.sentence || '';
      const processedText = this._processSpecialTags(sentenceText);
      const sentenceHTML = this._preserveWhitespace(processedText);
      
      return `<span class="highlighted-sentence${selectedClass}" 
                    data-index="${index}" 
                    tabindex="0" 
                    role="button" 
                    aria-label="Sentence ${index + 1}">
                ${sentenceHTML}
              </span>`;
    }).join(""); 
    
    this.editor.innerHTML = updatedContent;
    
    // Save to localStorage
    localStorage.setItem('editorContent', updatedContent);
    localStorage.setItem('analysisData', JSON.stringify(results));
    
    // Attach event listeners to each sentence span
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
    
    // Reset updating flag and attempt to restore cursor
    setTimeout(() => {
      this.isUpdatingContent = false;
      
      if (options.preserveCursor) {
        this.editor.focus();
        this._restoreCursorPosition();
      }
      
      if (typeof options.afterRender === 'function') {
        options.afterRender();
      }
    }, 10);
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
