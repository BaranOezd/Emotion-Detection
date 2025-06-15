export default class TextEditorModule {
  constructor(editorSelector) {
    this.editor = document.querySelector(editorSelector);
    this.scrollCallbacks = [];
    this.changeCallbacks = [];
    this.debounceTimeout = null;
    this.debounceDelay = 4000; 
    this.cursorPosition = null; // Store cursor as character offset instead of range
    
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
    
    // Track cursor with simpler events
    this.editor.addEventListener("click", this.saveCursorPosition.bind(this));
    this.editor.addEventListener("keyup", this.saveCursorPosition.bind(this));
    
    // Add paste event to always paste as plain text
    this.editor.addEventListener("paste", this._handlePasteAsPlainText.bind(this));
  }
  
  /**
   * Save cursor position as character offset
   */
  saveCursorPosition() {
    if (!this.editor) return;
    
    try {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Only save if the range is within our editor
        if (this.editor.contains(range.commonAncestorContainer)) {
          // Save as offset from start rather than DOM range
          this.cursorPosition = this._getOffsetFromStart(range);
          //console.log("Cursor position saved:", this.cursorPosition);
        }
      }
    } catch (e) {
      console.error("Error saving cursor position:", e);
    }
  }
  
  /**
   * Calculate character offset from start of editor to cursor position
   */
  _getOffsetFromStart(range) {
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(this.editor);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    return preSelectionRange.toString().length;
  }
  
  /**
   * Restore cursor position using character offset
   */
  restoreCursorPosition() {
    if (!this.editor || this.cursorPosition === null) return;

    try {
      // Save the intended position to avoid drift if DOM changes
      const intendedPosition = this.cursorPosition;

      setTimeout(() => {
        let position = intendedPosition;
        const nodes = this._getAllTextNodes(this.editor);
        let currentOffset = 0;
        let targetNode = null;
        let targetOffset = 0;

        // Find the text node and offset where our cursor should go
        for (let node of nodes) {
          const nodeLength = node.textContent.length;

          if (currentOffset + nodeLength >= position) {
            targetNode = node;
            targetOffset = position - currentOffset;
            break;
          }

          currentOffset += nodeLength;
        }

        // If the offset is at the very end, and the last node is a text node, place at end
        if (!targetNode && nodes.length > 0) {
          targetNode = nodes[nodes.length - 1];
          targetOffset = targetNode.textContent.length;
        }

        // If the offset is exactly at a node boundary, prefer the end of the node
        if (targetNode && targetOffset > targetNode.textContent.length) {
          targetOffset = targetNode.textContent.length;
        }

        // If the offset is negative, clamp to 0
        if (targetOffset < 0) targetOffset = 0;

        // Set cursor position if we found a valid target
        if (targetNode) {
          const range = document.createRange();
          const selection = window.getSelection();

          range.setStart(targetNode, targetOffset);
          range.collapse(true);

          selection.removeAllRanges();
          selection.addRange(range);
          this.editor.focus();
        } else {
          this.editor.focus();
        }
      }, 40); // Slightly increased delay for DOM stabilization
    } catch (e) {
      console.error("Error restoring cursor position:", e);
      this.editor.focus();
    }
  }
  
  /**
   * Get all text nodes in the editor
   */
  _getAllTextNodes(element) {
    let textNodes = [];
    
    function getTextNodes(node) {
      if (node.nodeType === 3) {
        // Text node
        textNodes.push(node);
      } else if (node.nodeType === 1) {
        // Element node
        for (let childNode of node.childNodes) {
          getTextNodes(childNode);
        }
      }
    }
    
    getTextNodes(element);
    return textNodes;
  }
  
  /**
   * Handle input events in the text editor with debouncing
   * @private
   */
  _handleInput(event) {
    // Save to localStorage
    localStorage.setItem('editorContent', this.editor.innerHTML);
    
    // Save cursor position when typing
    this.saveCursorPosition();
    
    // Clear any existing timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    // Set a new timeout to trigger analysis after delay
    this.debounceTimeout = setTimeout(() => {
      const text = this.getText().trim();
      if (text) {
        this.changeCallbacks.forEach(callback => callback(text, {
          preserveCursor: true
        }));
      }
    }, this.debounceDelay);
  }
  
  /**
   * Render the sentences with optional highlighting and paragraph structure
   */
  renderSentences(results, selectedIndex = null, onSentenceSelect = () => {}, options = {}) {
    if (!this.editor || !results || results.length === 0) return;
    
    // Save cursor position if preserveCursor option is set
    if (options.preserveCursor) {
      this.saveCursorPosition();
    }
    
    // Check if we have structured data available
    if (results.structured_data && results.structured_data.structured_text) {
      this._renderStructuredText(results, selectedIndex, onSentenceSelect);
    } else {
      this._renderFlatText(results, selectedIndex, onSentenceSelect);
    }
    
    // Save to localStorage
    localStorage.setItem('editorContent', this.editor.innerHTML);
    localStorage.setItem('analysisData', JSON.stringify(results));
    
    // Restore cursor position if preserveCursor option is set
    if (options.preserveCursor && this.cursorPosition !== null) {
      this.restoreCursorPosition();
    }
    
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

  /**
   * Handle paste events to always paste as plain text
   * @private
   */
  _handlePasteAsPlainText(event) {
    event.preventDefault();
    let text = '';
    if (event.clipboardData) {
      text = event.clipboardData.getData('text/plain');
    } else if (window.clipboardData) {
      text = window.clipboardData.getData('Text');
    }
    document.execCommand('insertText', false, text);
  }
}
