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

    // Update the line chart.
    this.lineChartModule.emotions = this.emotions;
    this.lineChartModule.emotionColors = this.emotionColors;
    this.lineChartModule.render(this.data);
    // Ensure the bar chart uses the correct emotions list.
    this.barChartModule.emotions = this.emotions;
  } 
  
  updateSentenceList() {
    // Render the sentences using TextEditorModule.
    this.textEditorModule.renderSentences(this.data, null, (selectedIndex) => {
      if (selectedIndex >= 0 && selectedIndex < this.data.length) {
        const sentenceData = this.data[selectedIndex];
        sentenceData.index = selectedIndex;
        
        // Reset emotion values to their original state (unsaved changes discarded).
        // This ensures that if a user has played with the emotion bars and then switches sentences,
        // the selected sentence will display the emotions as they originally were.
        if (sentenceData.originalEmotions) {
          sentenceData.emotions = Object.assign({}, sentenceData.originalEmotions);
        } else {
          sentenceData.originalEmotions = Object.assign({}, sentenceData.emotions);
        }
        
        // Store the currently selected index.
        this.lastSelectedIndex = selectedIndex;
        
        // Render the bar chart for the selected sentence.
        this.barChartModule.render(sentenceData, {
          onReset: (updatedSentenceData) => {
            // Update the data array with the reset sentence data.
            const indexToUpdate = updatedSentenceData.index;
            this.data[indexToUpdate] = updatedSentenceData;
            
            // Re-render the line chart.
            this.lineChartModule.render(this.data);
            
            // Re-render the sentences while preserving the selected index.
            this.textEditorModule.renderSentences(this.data, indexToUpdate, (newIndex) => {
              this.lastSelectedIndex = newIndex;
              const newSentenceData = this.data[newIndex];
              newSentenceData.index = newIndex;
              this.barChartModule.render(newSentenceData, {
                onReset: this.onReset.bind(this),
                onChangeSentence: this.handleChangeSentence.bind(this)
              });
            });
          },
          onChangeSentence: this.handleChangeSentence.bind(this)
        });
      } else {
        console.error("Invalid selectedIndex:", selectedIndex);
      }
    });
  }
  
  onReset(updatedSentenceData) {
    const indexToUpdate = updatedSentenceData.index;
    this.data[indexToUpdate] = updatedSentenceData;
    this.lineChartModule.render(this.data);
    this.textEditorModule.renderSentences(this.data, indexToUpdate, (newIndex) => {
      this.lastSelectedIndex = newIndex;
      const newSentenceData = this.data[newIndex];
      newSentenceData.index = newIndex;
      this.barChartModule.render(newSentenceData, {
        onReset: this.onReset.bind(this),
        onChangeSentence: this.handleChangeSentence.bind(this)
      });
    });
  }
  
  handleChangeSentence(sentenceData) {
    const currentIndex = sentenceData.index;
    this.dataService.modifySentence(sentenceData)
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }
        // Update the sentence with the new text.
        sentenceData.sentence = data.new_sentence;
        sentenceData.index = currentIndex;
        this.data[currentIndex] = sentenceData;
        
        // Re-render the sentence list with the same sentence selected.
        this.textEditorModule.renderSentences(this.data, currentIndex, (selectedIndex) => {
          this.lastSelectedIndex = selectedIndex;
          const selectedSentence = this.data[selectedIndex];
          selectedSentence.index = selectedIndex;
          this.barChartModule.render(selectedSentence, {
            onReset: this.onReset.bind(this),
            onChangeSentence: this.handleChangeSentence.bind(this)
          });
        });
        
        // Update the line chart.
        this.lineChartModule.render(this.data);
      })
      .catch(error => {
        console.error("Error modifying sentence:", error);
        alert("An error occurred while modifying the sentence: " + error.message);
      });
  }
}

export default MainController;
