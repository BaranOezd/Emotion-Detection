import BarChartModule from './BarChart.js';
import LineChartModule from './LineChart.js';
import TextEditorModule from './TextEditorModule.js';
import ApiModule from './ApiModule.js';

class MainController {
  constructor() {
    this.api = new ApiModule();
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
    const feedbackEl = document.getElementById("feedback");
    const loadingIndicator = document.getElementById("loadingIndicator");
    
    analyzeButton.addEventListener("click", () => {
      const text = this.textEditorModule.getText().trim();
      if (!text) {
        alert("Please enter some text to analyze.");
        return;
      }
      this.setLoading(true);
      this.api.analyzeText(text)
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
        this.api.uploadFile(file)
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
      // Retrieve sentenceData using the provided selectedIndex.
      const sentenceData = this.data[selectedIndex];
      
      // When a sentence is clicked, render its bar chart.
      this.barChartModule.render(sentenceData, {
        onReset: (updatedSentenceData) => {
          this.data[updatedSentenceData.index] = updatedSentenceData;
          this.lineChartModule.render(this.data);
          // Optionally, re-render the sentence list to update the selection.
          this.textEditorModule.renderSentences(this.data, updatedSentenceData.index, (idx) => {
            // Additional callback logic if needed.
          });
        },
        onChangeSentence: this.handleChangeSentence.bind(this)
      });
    });
  }
  
  handleChangeSentence(sentenceData) {
    this.api.modifySentence(sentenceData)
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }
        sentenceData.sentence = data.new_sentence;
        this.data[sentenceData.index] = sentenceData;
        this.textEditorModule.renderSentences(this.data, null, (selectedIndex) => {
          const sentenceData = this.data[selectedIndex];
          this.barChartModule.render(sentenceData, {
            onReset: (updatedSentenceData) => {
              this.data[updatedSentenceData.index] = updatedSentenceData;
              this.lineChartModule.render(this.data);
              this.updateSentenceList();
            },
            onChangeSentence: this.handleChangeSentence.bind(this)
          });
        });
        this.lineChartModule.render(this.data);
      })
      .catch(error => {
        console.error("Error modifying sentence:", error);
        alert("An error occurred while modifying the sentence: " + error.message);
      });
  }
}

export default MainController;
