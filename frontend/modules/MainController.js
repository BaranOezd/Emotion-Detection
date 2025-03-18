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
    // Iterate over each item to assign an index and preserve the original sentence.
    this.data.forEach((result, index) => {
      result.index = index;
      if (!result.originalSentence) {
        result.originalSentence = result.sentence;
      }
    });

    // Update the line chart.
    this.lineChartModule.emotions = this.emotions;
    this.lineChartModule.emotionColors = this.emotionColors;
    this.lineChartModule.render(this.data);
    // Update the bar chart.
    this.barChartModule.emotions = this.emotions;
  } 
  
  updateSentenceList() {
    // Render the sentences; when one is selected, update its index in the data.
    this.textEditorModule.renderSentences(this.data, null, (selectedIndex) => {
      if (selectedIndex >= 0 && selectedIndex < this.data.length) {
        const sentenceData = this.data[selectedIndex];
        sentenceData.index = selectedIndex;
        
        // Reset emotion values to their original state (before any modifications)
        // Check if the original state exists; if not, create it.
        if (sentenceData.originalEmotions) {
          sentenceData.emotions = Object.assign({}, sentenceData.originalEmotions);
        } else {
          sentenceData.originalEmotions = Object.assign({}, sentenceData.emotions);
        }
        
        // Store the currently selected index globally in the controller
        this.lastSelectedIndex = selectedIndex;
        
        // Render the bar chart for the selected sentence.
        this.barChartModule.render(sentenceData, {
          onReset: (updatedSentenceData) => {
            // Use the index from the updated sentence data.
            const indexToUpdate = updatedSentenceData.index;
            
            // Update the data array with the reset sentence data.
            this.data[indexToUpdate] = updatedSentenceData;
            
            // Re-render the line chart.
            this.lineChartModule.render(this.data);
            
            // Re-render the sentences with the SAME index selected.
            this.textEditorModule.renderSentences(this.data, indexToUpdate, (newIndex) => {
              // Update the lastSelectedIndex when a new sentence is selected after reset.
              this.lastSelectedIndex = newIndex;
              
              // Get the newly selected sentence data.
              const newSentenceData = this.data[newIndex];
              newSentenceData.index = newIndex;
              
              // Render the bar chart for the newly selected sentence.
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
        
        // Update the sentence with the new text
        sentenceData.sentence = data.new_sentence;       
     
        sentenceData.index = currentIndex;     
      
        this.data[currentIndex] = sentenceData;
        
        // Re-render the sentence list with the same sentence selected
        this.textEditorModule.renderSentences(this.data, currentIndex, (selectedIndex) => {
          // Update the lastSelectedIndex
          this.lastSelectedIndex = selectedIndex;
          
          // Get the selected sentence data
          const selectedSentence = this.data[selectedIndex];
          selectedSentence.index = selectedIndex;
          
          // Render the bar chart for the selected sentence
          this.barChartModule.render(selectedSentence, {
            onReset: this.onReset.bind(this),
            onChangeSentence: this.handleChangeSentence.bind(this)
          });
        });
        
        // Update the line chart
        this.lineChartModule.render(this.data);
      })
      .catch(error => {
        console.error("Error modifying sentence:", error);
        alert("An error occurred while modifying the sentence: " + error.message);
      });
  }
}

export default MainController;
