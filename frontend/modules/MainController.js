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
      joy: "#FFEB3B",
      sadness: "#2196F3",
      fear: "#9C27B0",
      disgust: "#4CAF50",
      anger: "#F44336",
      surprise: "#FFB322",
      neutral: "#9E9E9E",
    };
    // Initialize the visualization modules.
    this.barChartModule = new BarChartModule("#barchart", this.emotionColors, this.emotions);
    this.lineChartModule = new LineChartModule("#linechart", this.emotions, this.emotionColors);
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    const analyzeButton = document.getElementById("analyzeButton");
    const uploadButton = document.getElementById("uploadButton");
    const barChartButtons = document.getElementById("barChartButtons");
    const resetButton = document.getElementById("resetButton");
    const changeSentenceButton = document.getElementById("changeSentenceButton");
    
    analyzeButton.addEventListener("click", () => {
      const text = this.textEditorModule.getText().trim();
      if (!text) {
        alert("Please enter some text to analyze.");
        return;
      }
      this.setLoading(true);
      this.dataService.analyzeText(text)
        .then(data => {
          if (data.results) {
            this.data = data.results;
            this.updateEmotions();
            this.updateVisualizations();
            this.updateSentenceList();
          } else {
            alert("No results returned from analysis.");
          }
        })
        .catch(error => {
          console.error("Error analyzing text:", error);
          alert("An error occurred during analysis.");
        })
        .finally(() => this.setLoading(false));
    });
    
    uploadButton.addEventListener("click", () => {
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
    const analyzeButton = document.getElementById("analyzeButton");
    const uploadButton = document.getElementById("uploadButton");
    loadingIndicator.style.display = isLoading ? "block" : "none";
    analyzeButton.disabled = isLoading;
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
      this.emotions = Object.keys(this.data[0].emotions);
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
  
  updateSentenceList() {
    const barChartButtons = document.getElementById("barChartButtons");
    // Hide buttons when rendering new sentence list
    barChartButtons.classList.remove("visible");
    
    // Store a reference to the previous highlight index
    const prevHighlightIndex = this.lineChartModule.currentHighlightIndex;
    
    // Clear any existing highlights before starting
    this.lineChartModule.clearHighlight();
    
    // Render the sentences using TextEditorModule.
    this.textEditorModule.renderSentences(this.data, null, (selectedIndex) => {
      if (selectedIndex >= 0 && selectedIndex < this.data.length) {
        const sentenceData = this.data[selectedIndex];
        sentenceData.index = selectedIndex;
        
        // Force highlight update regardless of whether the same sentence is clicked
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
        
        // Render the bar chart for the selected sentence.
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
    });

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
        // Update the data with the new values from the backend
        sentenceData.sentence = data.new_sentence;
        sentenceData.emotions = emotionsToSend; // Update the actual emotions with the temporary values
        sentenceData.index = currentIndex;
        this.data[currentIndex] = sentenceData;
        
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
          this.barChartModule.render(selectedSentence, {
            onReset: this.onReset.bind(this),
            onChangeSentence: this.handleChangeSentence.bind(this),
            skipAnimation: true // Skip animation when re-rendering after change
          });
          
          // Make sure highlight is applied after text editor rendering
          this.lineChartModule.highlightSentence(selectedIndex);
        });
      })
      .catch(error => {
        console.error("Error modifying sentence:", error);
        alert("An error occurred while modifying the sentence: " + error.message);
      });
  }
}

export default MainController;
