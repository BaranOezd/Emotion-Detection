import BarChartModule from './BarChart.js';
import LineChartModule from './LineChart.js';
import TextEditorModule from './TextEditorModule.js';
import { DataService } from './DataService.js';

class MainController {
  constructor() {
    this.dataService = new DataService();
    this.textEditorModule = new TextEditorModule("#textEditor");
    this.data = [];
    this.emotions = [];
    this.currentSelectedIndex = -1;
    this.emotionColors = {
      admiration: "#FFD700",
      amusement: "#FF69B4",
      anger: "#FF0000",
      annoyance: "#FFA07A",
      approval: "#32CD32",
      caring: "#FFB6C1",
      confusion: "#6A5ACD",
      curiosity: "#4682B4",
      desire: "#FF4500",
      disappointment: "#8D6E63", 
      disapproval: "#8B0000",
      disgust: "#008000",
      embarrassment: "#FF6347",
      excitement: "#FFA500",
      fear: "#800080",
      gratitude: "#8A2BE2",
      grief: "#2F4F4F",
      joy: "#FFEB3B",
      love: "#FF1493",
      nervousness: "#A52A2A",
      neutral: "#808080",
      optimism: "#FFDAB9",
      pride: "#DAA520",
      realization: "#87CEEB",
      relief: "#98FB98",
      remorse: "#8B4513",
      sadness: "#0000FF",
      surprise: "#FFC0CB" // Pink for surprise (unexpected and lighthearted)
    };
    // Initialize the visualization modules.
    this.barChartModule = new BarChartModule("#barchart", this.emotionColors, this.emotions);
    this.lineChartModule = new LineChartModule("#linechart", this.emotions, this.emotionColors);
    
    // Connect the modules
    this.barChartModule.setLineChartModule(this.lineChartModule);
    
    // Register the sentence selection callback with the LineChart
    this.lineChartModule.onSentenceSelect((index) => {
      this.handleLineChartSentenceSelection(index);
    });
    
    // Register for automatic text analysis when content changes
    this.textEditorModule.onContentChange(this.handleAutomaticAnalysis.bind(this));
    
    this.setupEventListeners();
  }
  
  /**
   * Handle sentence selection from the LineChart
   * @param {number} index - The index of the selected sentence
   */
  handleLineChartSentenceSelection(index) {
    if (index >= 0 && index < this.data.length) {
      // Show the bar chart buttons when a sentence is selected
      const barChartButtons = document.getElementById("barChartButtons");
      barChartButtons.classList.add("visible");
      
      // Find the text editor element and its sentences
      const textEditor = document.querySelector("#textEditor");
      if (textEditor) {
        const sentences = textEditor.querySelectorAll(".highlighted-sentence");
        
        if (sentences.length > 0 && sentences[index]) {
          // First check if the sentence is visible in the viewport
          const sentenceElement = sentences[index];
          const editorRect = textEditor.getBoundingClientRect();
          const sentenceRect = sentenceElement.getBoundingClientRect();
          
          // Check if the sentence is visible within the text editor's viewport
          const isVisible = (
            sentenceRect.top >= editorRect.top && 
            sentenceRect.bottom <= editorRect.bottom
          );
          
          // If the sentence is not visible, scroll it into view first
          if (!isVisible) {
            // Temporarily disable text editor scroll syncing to prevent line chart rescrolling
            this._disableScrollSync = true;
            
            // Calculate position to scroll to
            // We want the sentence to be positioned 1/3 from the top of the viewport
            const targetPosition = sentenceElement.offsetTop - (editorRect.height / 3);
            
            // Use direct scrolling for better performance
            textEditor.scrollTop = targetPosition;
            
            // Click immediately without waiting
            sentenceElement.click();
            
            // Re-enable text editor scroll syncing after a short delay
            setTimeout(() => {
              this._disableScrollSync = false;
            }, 500);
          } else {
            // If already visible, just click it
            sentenceElement.click();
          }
          return;
        }
      }
      
      // If no corresponding text editor sentence was found, update directly
      this.lastSelectedIndex = index;
      sentenceData = this.data[index];
      if (sentenceData) {
        sentenceData.index = index;
        
        // Reset emotion values to their original state
        if (sentenceData.originalEmotions) {
          sentenceData.emotions = Object.assign({}, sentenceData.originalEmotions);
        }
        
        // Render the bar chart with the selected sentence data
        this.barChartModule.render(sentenceData, {
          onReset: this.onReset.bind(this),
          onChangeSentence: this.handleChangeSentence.bind(this),
          skipAnimation: false
        });
      }
    }
  }
  
  setupEventListeners() {
    // Try to load saved data when the app starts
    if (this.loadSavedData()) {
      console.log('Successfully loaded saved data');
    }

    const uploadButton = document.getElementById("uploadButton");
    const barChartButtons = document.getElementById("barChartButtons");
    const resetButton = document.getElementById("resetButton");
    const changeSentenceButton = document.getElementById("changeSentenceButton");
    
    uploadButton.addEventListener("click", () => {
      // Log upload button clicks
      this.dataService.logUploadClicked();
      
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".txt";
      fileInput.click();
      fileInput.onchange = () => {
        const file = fileInput.files[0];
        if (!file) {
          alert("No file selected. Please select a valid .txt file.");
          return;
        }
        this.setLoading(true);
        this.dataService.uploadFile(file)
          .then(data => {
            if (data.error) {
              this.showFeedback(`Error: ${data.error}`, true);
            } else if (data.results) {
              this.showFeedback("File uploaded and processed successfully!");
              this.data = data.results;
              this.updateEmotions();
              this.updateVisualizations();
              this.updateSentenceList();
            } else {
              this.showFeedback("Unexpected response from backend.", true);
            }
          })
          .catch(error => {
            console.error("Error during file upload:", error);
            this.showFeedback("An error occurred during file upload.", true);
          })
          .finally(() => this.setLoading(false));
      };
    });

    // Update Reset button handler
    resetButton.addEventListener("click", () => {
      if (this.lastSelectedIndex !== undefined && this.data[this.lastSelectedIndex]) {
        const sentenceData = this.data[this.lastSelectedIndex];
        const currentIndex = this.lastSelectedIndex; // Store for later use
        
        // Reset emotions to their original state
        sentenceData.emotions = { ...sentenceData.originalEmotions };
        
        // Also restore the original sentence text if available
        if (sentenceData.originalSentence) {
          sentenceData.sentence = sentenceData.originalSentence;
        }

        // Update the bar chart for the currently selected sentence
        this.barChartModule.render(sentenceData, {
          onReset: this.onReset.bind(this),
          onChangeSentence: this.handleChangeSentence.bind(this),
          skipAnimation: true
        });

        // Clear any existing highlights
        this.lineChartModule.clearHighlight();
        
        // Update the line chart to reflect the reset values
        this.lineChartModule.render(this.data);
        
        // Apply highlight after rendering and store the highlighted index
        this.lineChartModule.highlightSentence(currentIndex);

        // Re-render the text editor to ensure consistency
        this.textEditorModule.renderSentences(this.data, currentIndex, (selectedIndex) => {
          this.lastSelectedIndex = selectedIndex;
          const updatedSentenceData = this.data[selectedIndex];
          updatedSentenceData.index = selectedIndex;
          this.barChartModule.render(updatedSentenceData, {
            onReset: this.onReset.bind(this),
            onChangeSentence: this.handleChangeSentence.bind(this),
            skipAnimation: true
          });
          
          // Ensure highlight is reapplied even if selectedIndex equals currentIndex
          this.lineChartModule.highlightSentence(selectedIndex);
        });
      }
    });

    // Update Change button handler
    changeSentenceButton.addEventListener("click", () => {
      if (this.lastSelectedIndex !== undefined && this.data[this.lastSelectedIndex]) {
        const sentenceData = { ...this.data[this.lastSelectedIndex] };
        this.handleChangeSentence(sentenceData);
      }
    });

    // Connect the text editor scroll events to the line chart
    this.textEditorModule.onScroll(scrollInfo => {
      // Skip scroll sync if temporarily disabled
      if (this._disableScrollSync) return;
      
      // Only sync scrolling when we have data and more than one visible sentence
      if (this.data.length > 0 && scrollInfo.visibleCount > 0) {
        this.lineChartModule.scrollToVisibleRange(
          scrollInfo.firstVisibleIndex,
          scrollInfo.lastVisibleIndex
        );
      }
    });
  }
  
  setLoading(isLoading) {
    const loadingIndicator = document.getElementById("loadingIndicator");
    const uploadButton = document.getElementById("uploadButton");
    loadingIndicator.style.display = isLoading ? "block" : "none";
    uploadButton.disabled = isLoading;
  }
  
  showFeedback(message, isError = false) {
    const feedbackEl = document.getElementById("feedback");
    feedbackEl.textContent = message;
    feedbackEl.style.color = isError ? "#c00" : "#007b00";
    setTimeout(() => { feedbackEl.textContent = ""; }, 3000);
  }
  
  updateEmotions() {
    if (this.data.length > 0) {
      this.emotions = Object.keys(this.data[0].emotions); // Dynamically update emotions
    } else {
      this.emotions = [];
    }
  }
  
  updateVisualizations() {
    // Assign an index and store the original sentence for each data item.
    this.data.forEach((result, index) => {
      result.index = index;
      if (!result.originalSentence) {
        result.originalSentence = result.sentence;
      }
      // Also, capture the original emotion values if not already done.
      if (!result.originalEmotions) {
        result.originalEmotions = Object.assign({}, result.emotions);
      }
    });

    // Clear any existing highlights
    this.lineChartModule.clearHighlight();
    
    // Update the line chart.
    this.lineChartModule.emotions = this.emotions;
    this.lineChartModule.emotionColors = this.emotionColors;
    this.lineChartModule.render(this.data);
    
    // Ensure the bar chart uses the correct emotions list.
    this.barChartModule.emotions = this.emotions;
  } 
  
  /**
   * Update the list of sentences in the text editor
   * @param {Object} options - Options for updating sentences
   * @param {boolean} [options.preserveCursor=false] - Whether to preserve cursor position
   * @param {Function} [options.afterRender] - Callback after rendering completes
   */
  updateSentenceList(options = {}) {
    const barChartButtons = document.getElementById("barChartButtons");
    // Hide buttons when rendering new sentence list
    barChartButtons.classList.remove("visible");
    
    // Store a reference to the previous highlight index
    const prevHighlightIndex = this.lineChartModule.currentHighlightIndex;
    
    // Clear any existing highlights before starting
    this.lineChartModule.clearHighlight();
    
    // Render the sentences using TextEditorModule with options
    this.textEditorModule.renderSentences(
      this.data, 
      null, 
      (selectedIndex) => {
        if (selectedIndex >= 0 && selectedIndex < this.data.length) {
          const sentenceData = this.data[selectedIndex];
          sentenceData.index = selectedIndex;
          
          // Force highlight update in the line chart when a sentence is selected in the text editor
          this.lineChartModule.highlightSentence(selectedIndex);
          
          // Skip re-rendering the bar chart if the same sentence is clicked
          if (this.lastSelectedIndex === selectedIndex) {
            return;
          }
          
          // Show buttons when a sentence is selected
          barChartButtons.classList.add("visible");
          
          // Reset emotion values to their original state (unsaved changes discarded).
          if (sentenceData.originalEmotions) {
            sentenceData.emotions = Object.assign({}, sentenceData.originalEmotions);
          } else {
            sentenceData.originalEmotions = Object.assign({}, sentenceData.emotions);
          }
          
          // Store the currently selected index.
          this.lastSelectedIndex = selectedIndex;
          
          // Explicitly set skipAnimation to false to ensure animation when switching sentences
          this.barChartModule.render(sentenceData, {
            onReset: this.onReset.bind(this),
            onChangeSentence: this.handleChangeSentence.bind(this),
            skipAnimation: false // Always animate when switching between sentences
          });
        } else {
          console.error("Invalid selectedIndex:", selectedIndex);
          
          // If no valid selection but we had a previous highlight, restore it
          if (prevHighlightIndex !== null && prevHighlightIndex >= 0 && 
              prevHighlightIndex < this.data.length) {
            this.lineChartModule.highlightSentence(prevHighlightIndex);
          }
        }
      },
      options // Pass options to renderSentences
    );

    // Immediately sync the line chart with visible sentences - removed setTimeout
    const visibleSentences = this.textEditorModule.getVisibleSentences();
    if (this.data.length > 0 && 
        visibleSentences.firstVisibleIndex !== undefined && 
        visibleSentences.lastVisibleIndex !== undefined) {
      this.lineChartModule.scrollToVisibleRange(
        visibleSentences.firstVisibleIndex,
        visibleSentences.lastVisibleIndex
      );
    }
  }
  
  onReset(updatedSentenceData) {
    const indexToUpdate = updatedSentenceData.index;
    
    // Log reset via the DataService
    this.dataService.logResetAction(updatedSentenceData);
    
    // Ensure the original sentence text is also reset
    if (this.data[indexToUpdate].originalSentence) {
      updatedSentenceData.sentence = this.data[indexToUpdate].originalSentence;
    }
    
    this.data[indexToUpdate] = updatedSentenceData;
    
    // Clear highlight first
    this.lineChartModule.clearHighlight();
    
    // Re-render the line chart
    this.lineChartModule.render(this.data);
    
    // Re-apply highlight and store the highlighted index
    this.lineChartModule.highlightSentence(indexToUpdate);
    this.lineChartModule.currentHighlightIndex = indexToUpdate;
    
    this.textEditorModule.renderSentences(this.data, indexToUpdate, (newIndex) => {
      this.lastSelectedIndex = newIndex;
      const newSentenceData = this.data[newIndex];
      newSentenceData.index = newIndex;
      this.barChartModule.render(newSentenceData, {
        onReset: this.onReset.bind(this),
        onChangeSentence: this.handleChangeSentence.bind(this),
        skipAnimation: true // Skip animation when resetting the same sentence
      });
    });
  }
  
  handleChangeSentence(sentenceData) {
    const currentIndex = sentenceData.index;

    // Store the original sentence if not already stored
    if (!sentenceData.originalSentence) {
      sentenceData.originalSentence = sentenceData.sentence;
    }

    // Disable all interactive elements during generation
    this.setGenerating(true);

    // Start countdown for 30 seconds
    this.currentCountdownInterval = this.startButtonCountdown(30);

    // Use the temporary emotion values from BarChart instead of sentenceData.emotions
    const emotionsToSend = this.barChartModule.getCurrentEmotionValues();


    // Create a copy of sentenceData with the temporary emotion values
    const dataToSend = {
      ...sentenceData,
      emotions: emotionsToSend
    };

    this.dataService.modifySentence(dataToSend)
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }
        
        // Stop countdown when sentence changes
        this.stopCountdown();
        
        // Update the data with the new values from the backend
        sentenceData.sentence = data.new_sentence;
        sentenceData.emotions = data.emotion_levels;
        sentenceData.index = currentIndex;
        this.data[currentIndex] = sentenceData;

        // Save the entire data array to localStorage
        localStorage.setItem('analysisData', JSON.stringify(this.data));

        // Re-enable interactive elements
        this.setGenerating(false);

        // Clear existing highlight
        this.lineChartModule.clearHighlight();

        // Update the line chart with new data
        this.lineChartModule.render(this.data);

        // Make sure to re-highlight the current sentence
        this.lineChartModule.highlightSentence(currentIndex);

        // Re-render the sentence list with the same sentence selected.
        this.textEditorModule.renderSentences(this.data, currentIndex, (selectedIndex) => {
          this.lastSelectedIndex = selectedIndex;

          const selectedSentence = this.data[selectedIndex];
          selectedSentence.index = selectedIndex;

          // ANIMATION FIX: Force animation after rewrite regardless of index
          // Original code: const skipAnimation = selectedIndex === currentIndex;
          const skipAnimation = false; // Always animate after rewrite

          // Render the bar chart with the updated real emotion values
          this.barChartModule.render(selectedSentence, {
            onReset: this.onReset.bind(this),
            onChangeSentence: this.handleChangeSentence.bind(this),
            skipAnimation: skipAnimation
          });

          // Make sure highlight is applied after text editor rendering
          this.lineChartModule.highlightSentence(selectedIndex);
        });
      })
      .catch(error => {
        console.error("Error modifying sentence:", error);
        alert("An error occurred while modifying the sentence: " + error.message);
        this.stopCountdown();
        this.setGenerating(false);
      });
  }

  /**
   * Start a countdown directly on the button
   * @param {number} seconds - Countdown duration in seconds
   * @returns {number} - The interval ID
   */
  startButtonCountdown(seconds) {
    const changeButton = document.getElementById("changeSentenceButton");
    let remainingTime = seconds;

    const updateButtonText = () => {
      if (remainingTime < 0) {
        // Stay at 0 if processing takes longer than countdown
        changeButton.textContent = `Processing (0s)`;
        changeButton.classList.add('countdown-active');
        return; // Don't clear interval, keep showing 0
      }
      changeButton.textContent = `Processing (${remainingTime}s)`;
      changeButton.classList.add('countdown-active');
      remainingTime -= 1;
    };

    changeButton.disabled = true;
    updateButtonText(); // Initialize button text
    return setInterval(updateButtonText, 1000);
  }

  /**
   * Stop the countdown and reset the button
   */
  stopCountdown() {
    const changeButton = document.getElementById("changeSentenceButton");
    
    if (this.currentCountdownInterval) {
      clearInterval(this.currentCountdownInterval);
      this.currentCountdownInterval = null;
    }
    
    changeButton.textContent = "Rewrite";
    changeButton.disabled = false;
    changeButton.classList.remove('countdown-active'); // Remove styling class
  }

  setGenerating(isGenerating) {
    const buttons = document.querySelectorAll('button');  
    const barChartBars = document.querySelectorAll('.bar');
    const changeSentenceButton = document.getElementById("changeSentenceButton");

    // Add loading indicator to body
    document.body.classList.toggle('bar-chart-loading', isGenerating);

    // Disable all buttons while generating
    buttons.forEach(button => {
      button.disabled = isGenerating;
      button.classList.toggle('generating', isGenerating);
    });
    
    // Make bar charts non-interactive during generation
    barChartBars.forEach(bar => {
      bar.style.pointerEvents = isGenerating ? 'none' : 'auto';
    });

    // Hide loading indicator when done
    const loadingIndicator = document.getElementById("loadingIndicator");
    if (loadingIndicator && !isGenerating) {
      loadingIndicator.style.display = "none";
    }
  }

  loadSavedData() {
    try {
      const savedData = localStorage.getItem('analysisData');
      if (savedData) {
        this.data = JSON.parse(savedData);
        if (this.data && this.data.length > 0) {
          this.updateEmotions();
          this.updateVisualizations();
          this.updateSentenceList();
          console.log('Restored saved data from localStorage');
          console.log("Dynamic analysis JSON result:", this.data);          

          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error loading saved data:', error);
      return false;
    }
  }

  /**
   * Handle automatic analysis when text content changes
   * @param {string} text - The updated text content
   * @param {Object} context - Additional context information
   */
  handleAutomaticAnalysis(text, context = {}) {
    // Don't analyze if text is too short
    if (!text || text.length < 10) return;
    
    console.log("Auto-analyzing text after user stopped typing...");
    
    // Save editor state before analysis
    this.textEditorModule.saveCursorPosition();
    
    // Show subtle loading indicator (without blocking UI)
    document.body.classList.add('analyzing');
    
    this.dataService.analyzeText(text)
      .then(data => {
        if (data.results) {
          this.data = data.results;
          this.updateEmotions();
          this.updateVisualizations();
          
          // Pass cursor preservation option and force it to true
          this.updateSentenceList({
            preserveCursor: true,
            afterRender: () => {
              //console.log("Text rendered with cursor preservation");
              // Explicitly restore cursor position again for redundancy
              setTimeout(() => this.textEditorModule.restoreCursorPosition(), 50);
            }
          });
        }
      })
      .catch(error => {
        console.error("Error during auto-analysis:", error);
      })
      .finally(() => {
        document.body.classList.remove('analyzing');
      });
  }
}

export default MainController;
