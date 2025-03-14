import BarChartModule from "./modules/BarChart.js";
import LineChartModule from "./modules/LineChart.js";

class EmotionAnalysisVisualization {
  constructor(data) {
    // data is now an array of result objects
    this.data = data;
    // Extract emotion keys from the first result's emotions object
    this.emotions = data.length > 0 ? Object.keys(data[0].emotions) : [];
    this.emotionColors = {
      joy: "#FFEB3B",
      sadness: "#2196F3",
      fear: "#9C27B0",
      disgust: "#4CAF50",
      anger: "#F44336",
      surprise: "#FFB322",
      neutral: "#9E9E9E",
    };
    this.lastClickedSentence = null;
    this.selectedEmotions = [];
    this.barChartModule = new BarChartModule("#barchart", this.emotionColors, this.emotions);
    this.lineChartModule = new LineChartModule("#linechart", this.emotions, this.emotionColors);

  }
  updateLineChart() {
    this.lineChartModule.render(this.data);
  }
}

// -------------------
// Global Helper Functions
// -------------------

// Consolidated visualization update function
function updateVisualization(results) {
  results.forEach((result, index) => {
    result.index = index; // Assign the index for later reference
    if (!result.originalSentence) {
      result.originalSentence = result.sentence;
    }
  });

  window.visualizationInstance.data = results;
  window.visualizationInstance.emotions = results.length > 0 ? Object.keys(results[0].emotions) : [];
  window.visualizationInstance.updateLineChart();
  updateSentenceList(results);
}

// Load initial data using POST and initialize the visualization instance
function loadInitialData() {
  const sampleText = "Enter some default text here for analysis."; // Replace with your sample text
  fetch("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: sampleText })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error("Network response was not ok: " + response.statusText);
      }
      return response.json();
    })
    .then(data => {
      if (!data.results) {
        throw new Error("Expected JSON object to contain a 'results' key");
      }
      const results = data.results;
      window.visualizationInstance = new EmotionAnalysisVisualization(results);
      updateVisualization(results);
    })
    .catch(error => {
      console.error("Error loading JSON from /analyze:", error);
    });
}
loadInitialData();

// -------------------
// DOM Event Listeners and Other Global Functions
// -------------------

document.addEventListener("DOMContentLoaded", () => {
  const textEditor = document.getElementById("textEditor");
  const analyzeButton = document.getElementById("analyzeButton");
  const uploadButton = document.getElementById("uploadButton");
  const feedbackEl = document.getElementById("feedback");
  const loadingIndicator = document.getElementById("loadingIndicator");

  window.updateSentenceList = function (results) {
    const sentenceList = d3.select(".sentence-list");
    sentenceList.html("");
    results.forEach((d, i) => {
      sentenceList.append("div")
        .attr("class", "sentence-list-item")
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", `Sentence ${i + 1}: ${d.sentence}`)
        .attr("title", `Click to view analysis for: ${d.sentence}`)
        .html(
          `<span class="sentence-number" style="user-select: none;">${i + 1}. </span>
           <span class="sentence-text">${d.sentence}</span>`
        )
        // (Rest of your event listeners)
        .on("click", function () {
          d3.selectAll(".sentence-list-item")
            .classed("clicked", false)
            .style("color", "");
          d3.select(this)
            .classed("clicked", true)
            .style("color", "#c00");
            window.visualizationInstance.barChartModule.render(d);
        })
        .on("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            d3.selectAll(".sentence-list-item")
              .classed("clicked", false)
              .style("color", "");
            d3.select(this)
              .classed("clicked", true)
              .style("color", "#c00");
              window.visualizationInstance.barChartModule.render(d);
            }
        });
    });
  };

  // Restore saved text on load
  const savedText = localStorage.getItem("savedText");
  if (savedText) {
    textEditor.innerHTML = savedText;
  }

  // Save text changes to localStorage as the user types
  textEditor.addEventListener("input", () => {
    localStorage.setItem("savedText", textEditor.innerText);
  });

  function setLoading(isLoading) {
    loadingIndicator.style.display = isLoading ? "block" : "none";
    analyzeButton.disabled = isLoading;
    uploadButton.disabled = isLoading;
  }

  analyzeButton.addEventListener("click", () => {
    const textInput = textEditor.innerText.trim();
    if (!textInput) {
      alert("Please enter some text to analyze.");
      return;
    }
    setLoading(true);
    analyzeText(textInput)
      .then(data => {
        if (data.results) {
          updateVisualization(data.results);  
          // Optionally update the text editor with highlighted sentences based on backend data
          updateTextEditorWithHighlights(data.results);
        } else {
          alert("No results returned from analysis.");
        }
      })
      .catch(error => {
        console.error("Error analyzing text:", error);
        alert("An error occurred during analysis.");
      })
      .finally(() => {
        setLoading(false);
      });
  });


  uploadButton.addEventListener("click", handleFileUpload);
  function handleFileUpload() {
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
      const formData = new FormData();
      formData.append("file", file);
      setLoading(true);
      fetch("/upload", {
        method: "POST",
        body: formData,
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.error) {
            showFeedback(`Error: ${data.error}`, true);
          } else if (data.results) {
            showFeedback("File uploaded and processed successfully!");
            updateVisualization(data.results);
          } else {
            showFeedback("Unexpected response from backend.", true);
          }
        })
        .catch(error => {
          console.error("Error during file upload:", error);
          showFeedback("An error occurred during file upload.", true);
        })
        .finally(() => {
          setLoading(false);
        });
    };
  }

  function analyzeText(text) {
    return fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error("Network response was not ok: " + response.statusText);
        }
        return response.json();
      })
      .then(data => {
        console.log("Backend response:", data);
        return data;
      })
      .catch(error => {
        console.error("Error analyzing text:", error);
        throw error;
      });
  }

  // Modified updateTextEditorWithHighlights to accept an optional selectedIndex parameter
window.updateTextEditorWithHighlights = function(results, selectedIndex = null) {
  const textEditor = document.getElementById("textEditor");
  const updatedContent = results.map((item, index) => {
    const selectedClass = (selectedIndex !== null && +selectedIndex === index) ? " selected" : "";
    return `<span class="highlighted-sentence${selectedClass}" data-index="${index}">
              ${item.sentence}
            </span>`;
  }).join(" ");
  textEditor.innerHTML = updatedContent;
  
  // Attach event listeners to each sentence span
  textEditor.querySelectorAll(".highlighted-sentence").forEach(span => {
    span.addEventListener("click", () => {
      textEditor.querySelectorAll(".highlighted-sentence").forEach(s => s.classList.remove("selected"));
      span.classList.add("selected");
      const index = span.getAttribute("data-index");
      const sentenceData = results[index];
      window.visualizationInstance.barChartModule.render(sentenceData, {
        onReset: updatedSentenceData => {
          window.visualizationInstance.data[updatedSentenceData.index] = updatedSentenceData;
          window.visualizationInstance.updateLineChart();
          window.updateTextEditorWithHighlights(window.visualizationInstance.data, updatedSentenceData.index);
        },
        onChangeSentence: sentenceData => {
          const payload = {
            sentence: sentenceData.sentence,
            new_emotions: sentenceData.emotions,
            context: document.getElementById("textEditor")
              ? document.getElementById("textEditor").innerText
              : ""
          };
          fetch("/modify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })
            .then(async response => {
              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Network response was not ok: ${response.statusText} - ${errorText}`);
              }
              return response.json();
            })
            .then(data => {
              if (data.error) {
                throw new Error(data.error);
              }
              sentenceData.sentence = data.new_sentence;
              window.visualizationInstance.data[sentenceData.index] = sentenceData;
              window.updateTextEditorWithHighlights(window.visualizationInstance.data, sentenceData.index);
              window.visualizationInstance.updateLineChart();
            })
            .catch(error => {
              console.error("Error modifying sentence:", error);
              alert("An error occurred while modifying the sentence: " + error.message);
            });
        }
      });
      
    });
  });
}; 

  function showFeedback(message, isError = false) {
    feedbackEl.textContent = message;
    feedbackEl.style.color = isError ? "#c00" : "#007b00";
    setTimeout(() => {
      feedbackEl.textContent = "";
    }, 3000);
  }
});
