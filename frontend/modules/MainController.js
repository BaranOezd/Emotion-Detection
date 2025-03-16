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
    this.loadInitialData(); 
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
    
    // Save editor changes to localStorage.
    const editor = document.getElementById("textEditor");
    editor.addEventListener("input", () => {
      localStorage.setItem("savedText", editor.innerText);
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
  
    loadInitialData() {
    // This method only restores text from localStorage (or uses default text)
    // without triggering analysis.
    const textEditor = document.getElementById("textEditor");
    const savedText = localStorage.getItem("savedText");
    if (savedText && savedText.trim() !== "") {
      textEditor.innerHTML = savedText;
    } else {
      const sampleText = "Enter some default text here for analysis.";
      textEditor.innerHTML = sampleText;
      localStorage.setItem("savedText", sampleText);
    }
  } 
  
  updateEmotions() {
    if (this.data.length > 0) {
      this.emotions = Object.keys(this.data[0].emotions);
    } else {
      this.emotions = [];
    }
  }
  
  updateVisualizations() {
    // Iterate over each item in this.data to assign an index and preserve the original sentence.
    this.data.forEach((result, index) => {
      result.index = index; // Assign the index for later reference.
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
    // Use the TextEditorModule to render sentences.
    this.textEditorModule.renderSentences(this.data, null, (selectedIndex) => {
      // Remove any existing "selected" classes.
      document.querySelectorAll('.highlighted-sentence.selected').forEach(el => {
        el.classList.remove('selected');
      });
  
      // Ensure the selectedIndex corresponds to valid data.
      if (selectedIndex >= 0 && selectedIndex < this.data.length) {
        const sentenceData = this.data[selectedIndex]; // Declare sentenceData
        
        // Add the "selected" class to the clicked sentence element.
        const sentenceElement = document.querySelector(`.highlighted-sentence[data-index="${selectedIndex}"]`);
        if (sentenceElement) {
          sentenceElement.classList.add("selected");
        }
  
        // Render the bar chart for the selected sentence.
        this.barChartModule.render(sentenceData, {
          onReset: (updatedSentenceData) => {
            this.data[updatedSentenceData.index] = updatedSentenceData;
            this.lineChartModule.render(this.data);
            // Re-render the sentence list with the updated selection.
            this.textEditorModule.renderSentences(this.data, updatedSentenceData.index, () => {
              // Remove existing selections.
              document.querySelectorAll('.highlighted-sentence.selected').forEach(el => {
                el.classList.remove('selected');
              });
              // Reapply the "selected" class.
              const updatedEl = document.querySelector(`.highlighted-sentence[data-index="${updatedSentenceData.index}"]`);
              if (updatedEl) {
                updatedEl.classList.add("selected");
              }
            });
          },
          onChangeSentence: this.handleChangeSentence.bind(this)
        });
      } else {
        console.error("Invalid selectedIndex:", selectedIndex);
      }
    });
  }
  
  handleChangeSentence(sentenceData) {
    this.dataService.modifySentence(sentenceData)
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }
        // Update the sentence text with the new sentence.
        sentenceData.sentence = data.new_sentence;
        this.data[sentenceData.index] = sentenceData;
        
        // Re-render the sentence list with the modified sentence selected.
        this.textEditorModule.renderSentences(this.data, sentenceData.index, (selectedIndex) => {
          // This callback fires when a user clicks a sentence.
          // The renderSentences method itself clears old highlights and applies "selected" to the clicked element.
          
          // Additionally, you can update the bar chart based on the new selection:
          const selectedSentence = this.data[selectedIndex];
          this.barChartModule.render(selectedSentence, {
            onReset: (updatedSentenceData) => {
              this.data[updatedSentenceData.index] = updatedSentenceData;
              this.lineChartModule.render(this.data);
              // Re-render sentence list with the updated selection.
              this.textEditorModule.renderSentences(this.data, updatedSentenceData.index, () => {
                // The render function will take care of highlighting the correct sentence.
              });
            },
            onChangeSentence: this.handleChangeSentence.bind(this)
          });
        });
        
        // Update the line chart with the new data.
        this.lineChartModule.render(this.data);
      })
      .catch(error => {
        console.error("Error modifying sentence:", error);
        alert("An error occurred while modifying the sentence: " + error.message);
      });
  }
  
  
}

export default MainController;
