export default class TextEditorModule {
  constructor(editorSelector) {
    this.editor = document.querySelector(editorSelector);
    if (!this.editor) {
    }
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
      const selectedClass = (selectedIndex !== null && +selectedIndex === index) ? " selected" : "";
      return `<span class="highlighted-sentence${selectedClass}" 
                    data-index="${index}" 
                    tabindex="0" 
                    role="button" 
                    aria-label="Sentence ${index + 1}: ${item.sentence}">
                ${item.sentence}
              </span>`;
    }).join(" ");
    
    this.editor.innerHTML = updatedContent;
    
    // Attach event listeners to each sentence span.
    const spans = this.editor.querySelectorAll(".highlighted-sentence");
    spans.forEach(span => {
      const selectSentence = () => {
        // Debug: log the sentence selection.
        const index = span.getAttribute("data-index");
        
        // Clear previous selections.
        spans.forEach(s => s.classList.remove("selected"));
        // Add "selected" class to the clicked sentence.
        span.classList.add("selected");
        // Call the callback with the selected index.
        onSentenceSelect(index);
      };

      // Listen for click events.
      span.addEventListener("click", selectSentence);
      // Listen for keyboard events for accessibility.
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
}
