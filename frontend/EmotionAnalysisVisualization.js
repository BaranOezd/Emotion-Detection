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
  }

  clearBarChart() {
    d3.select("#barchart").html("");
  }

  // Update the bar chart for a selected sentence's emotion data
  updateBarChart(sentenceData) {
    const barChartDiv = d3.select("#barchart");
    barChartDiv.html("");
  
    // Create (or reuse) tooltip element
    let tooltip = d3.select("body").select(".tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("padding", "5px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0);
    }
  
    // Save a copy of the original emotions for resetting later
    const originalEmotions = Object.assign({}, sentenceData.emotions);
  
    // Ensure the original sentence is stored
    if (!sentenceData.originalSentence) {
      sentenceData.originalSentence = sentenceData.sentence;
    }
  
    // Reset button
    barChartDiv.append("button")
      .attr("id", "resetButton")
      .text("Reset")
      .style("margin-bottom", "10px")
      .on("click", () => {
        
        // Revert to original emotions and sentence
        sentenceData.emotions = Object.assign({}, originalEmotions);
        sentenceData.sentence = sentenceData.originalSentence;

        //Revert line graph to original emotions 
        window.visualizationInstance.data[sentenceData.index] = sentenceData;
        window.visualizationInstance.updateLineChart();   

        //Revert bar chart to original emotions
        this.updateBarChart(sentenceData);

        // Update the corresponding sentence span in the text editor and keep it highlighted
        if (sentenceData.index !== undefined) {
          const sentenceSpan = document.querySelector(`.highlighted-sentence[data-index="${sentenceData.index}"]`);
          if (sentenceSpan) {
            sentenceSpan.innerText = sentenceData.originalSentence;
            sentenceSpan.classList.add("selected");
          } else {
            // Re-render text editor with the selected index preserved
            window.updateTextEditorWithHighlights(window.visualizationInstance.data, sentenceData.index);
          }
        }
      });
  
    // Change Sentence button
    barChartDiv.append("button")
      .attr("id", "changeSentenceButton")
      .text("Change Sentence")
      .style("margin-left", "10px")
      .style("margin-bottom", "10px")
      .on("click", () => {
        // Build payload with current sentence and updated emotion values
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
          const modifiedSentence = data.new_sentence;
          // Update sentenceData with the new sentence
          sentenceData.sentence = modifiedSentence;

          window.visualizationInstance.data[sentenceData.index] = sentenceData;
    
          // Re-render the text editor with the current sentence highlighted
          window.updateTextEditorWithHighlights(window.visualizationInstance.data, sentenceData.index);
          window.visualizationInstance.updateLineChart();

        })
        .catch(error => {
          console.error("Error modifying sentence:", error);
          alert("An error occurred while modifying the sentence: " + error.message);
        });
      });
  
    const margin = { top: 40, right: 30, bottom: 100, left: 50 };
    const width = barChartDiv.node().clientWidth - margin.left - margin.right;
    const height = barChartDiv.node().clientHeight - margin.top - margin.bottom;
  
    const svg = barChartDiv.append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "100%")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
    // Define x and y scales
    const x = d3.scaleBand()
      .domain(this.emotions)
      .range([0, width])
      .padding(0.2);
  
    const y = d3.scaleLinear()
      .domain([0, 1])
      .nice()
      .range([height, 0]);
  
    // Append x-axis
    const xAxis = svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));
    xAxis.selectAll("text")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .attr("dy", "1.5em");
  
    // Append y-axis
    svg.append("g")
      .call(d3.axisLeft(y)
        .ticks(5)
        .tickValues([0, 0.2, 0.4, 0.6, 0.8, 1])
        .tickFormat(d => `${Math.round(d * 100)}%`));
  
    // Normalize emotion scores so that their sum equals 1
    let total = this.emotions.reduce((sum, emotion) => sum + (+sentenceData.emotions[emotion] || 0), 0);
    const emotionScores = this.emotions.map(emotion => {
      let raw = +sentenceData.emotions[emotion] || 0;
      let normalized = total > 0 ? raw / total : 0;
      return { emotion, score: normalized };
    });
  
    // Define a dynamic minimum: 3% of the scale
    const minFraction = 0.03;
    const dynamicMinHeight = height - y(minFraction);
  
    // Define drag behavior with proportional adjustments
    const drag = d3.drag()
      .on("start", function(event, d) {
        d3.select(this).style("opacity", 0.7);
      })
      .on("drag", function(event, d) {
        let newY = Math.max(0, Math.min(event.y, height));
        let newScore = y.invert(newY);
        newScore = Math.round(newScore * 20) / 20;
        newScore = Math.max(0, Math.min(newScore, 1));
  
        const otherTotal = emotionScores.filter(e => e.emotion !== d.emotion)
                                        .reduce((acc, cur) => acc + cur.score, 0);
        const remaining = 1 - newScore;
        d.score = newScore;
        sentenceData.emotions[d.emotion] = newScore;
  
        emotionScores.forEach(e => {
          if (e.emotion !== d.emotion) {
            e.score = otherTotal > 0 ? e.score / otherTotal * remaining : remaining / (emotionScores.length - 1);
          }
        });
  
        svg.selectAll(".bar")
          .data(emotionScores)
          .attr("y", d => {
            const computedHeight = height - y(d.score);
            return computedHeight < dynamicMinHeight ? height - dynamicMinHeight : y(d.score);
          })
          .attr("height", d => Math.max(height - y(d.score), dynamicMinHeight));
  
        svg.selectAll(".label")
          .data(emotionScores)
          .attr("y", d => {
            const computedHeight = height - y(d.score);
            return (computedHeight < dynamicMinHeight ? height - dynamicMinHeight : y(d.score)) - 5;
          })
          .text(d => `${Math.round(d.score * 100)}%`);
  
        tooltip.html(`${d.emotion}: ${Math.round(d.score * 100)}%`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("end", function(event, d) {
        d3.select(this).style("opacity", 1);
        tooltip.style("opacity", 0);
      });
  
    // Draw bars with tooltip and drag events
    svg.selectAll(".bar")
      .data(emotionScores)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.emotion))
      .attr("y", d => {
        const computedHeight = height - y(d.score);
        return computedHeight < dynamicMinHeight ? height - dynamicMinHeight : y(d.score);
      })
      .attr("width", x.bandwidth())
      .attr("height", d => Math.max(height - y(d.score), dynamicMinHeight))
      .style("fill", d => this.emotionColors[d.emotion])
      .style("cursor", "pointer")
      .attr("tabindex", 0)
      .attr("aria-label", d => `${d.emotion}: ${Math.round(d.score * 100)}%`)
      .on("mouseover", function(event, d) {
        tooltip.style("opacity", 0.9);
        tooltip.html(`${d.emotion}: ${Math.round(d.score * 100)}%`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
        d3.select(this).style("stroke", "#000").style("stroke-width", "1px");
      })
      .on("mousemove", function(event, d) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", function(event, d) {
        tooltip.style("opacity", 0);
        d3.select(this).style("stroke", "none");
      })
      .call(drag);
  
    // Draw labels above bars
    svg.selectAll(".label")
      .data(emotionScores)
      .enter().append("text")
      .attr("class", "label")
      .attr("x", d => x(d.emotion) + x.bandwidth() / 2)
      .attr("y", d => {
        const computedHeight = height - y(d.score);
        return (computedHeight < dynamicMinHeight ? height - dynamicMinHeight : y(d.score)) - 5;
      })
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text(d => `${Math.round(d.score * 100)}%`);
  }

  // Update (or re-create) the steam graph with integrated legend.
    updateLineChart() {
    const container = d3.select("#linechart");
    container.html("");

    const margin = { top: 20, right: 30, bottom: 100, left: 40 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "100%")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([1, this.data.length])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, 1])
      .nice()
      .range([height, 0]);

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(this.data.length).tickFormat(d => `${d}`));

    svg.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1f")));

    // Draw a line for each emotion using this.emotionColors
    this.emotions.forEach(emotion => {
      const line = d3.line()
        .x((d, i) => x(i + 1))
        .y(d => y(+d.emotions[emotion] || 0))
        .curve(d3.curveBasis);

      svg.append("path")
        .datum(this.data)
        .attr("class", `line-${emotion} lines`)
        .attr("fill", "none")
        .attr("stroke", this.emotionColors[emotion] || "#000")
        .attr("stroke-width", 4)
        .attr("d", line);
    });

    // Integrated legend below the graph
    const legendGroup = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width / 2}, ${height + 30})`);

    const legendSpacing = 100;
    this.emotions.forEach((emotion, i) => {
      const legendItem = legendGroup.append("g")
        .attr("transform", `translate(${(i - this.emotions.length / 2) * legendSpacing}, 0)`)
        .style("cursor", "pointer")
        .on("click", (event) => {
          // Toggle selection logic
          if (event.shiftKey) {
            if (this.selectedEmotions.includes(emotion)) {
              this.selectedEmotions = this.selectedEmotions.filter(e => e !== emotion);
              d3.select(event.currentTarget).select("rect")
                .transition().duration(300)
                .attr("stroke-width", 0)
                .attr("transform", "scale(1)");
              d3.select(event.currentTarget).select("text")
                .transition().duration(300)
                .style("font-weight", "normal");
            } else {
              this.selectedEmotions.push(emotion);
              d3.select(event.currentTarget).select("rect")
                .transition().duration(300)
                .attr("stroke-width", 2)
                .attr("transform", "scale(1.1)");
              d3.select(event.currentTarget).select("text")
                .transition().duration(300)
                .style("font-weight", "bold");
            }
          } else {
            // Single selection logic
            if (this.selectedEmotions.length === 1 && this.selectedEmotions[0] === emotion) {
              this.selectedEmotions = [];
              legendGroup.selectAll("rect")
                .transition().duration(300)
                .attr("stroke-width", 0)
                .attr("transform", "scale(1)");
              legendGroup.selectAll("text")
                .transition().duration(300)
                .style("font-weight", "normal");
            } else {
              legendGroup.selectAll("rect")
                .transition().duration(300)
                .attr("stroke-width", 0)
                .attr("transform", "scale(1)");
              legendGroup.selectAll("text")
                .transition().duration(300)
                .style("font-weight", "normal");
              this.selectedEmotions = [emotion];
              d3.select(event.currentTarget).select("rect")
                .transition().duration(300)
                .attr("stroke-width", 2)
                .attr("transform", "scale(1.1)");
              d3.select(event.currentTarget).select("text")
                .transition().duration(300)
                .style("font-weight", "bold");
            }
          }
          // Update line opacities based on selectedEmotions
          if (this.selectedEmotions.length === 0) {
            d3.selectAll(".lines path")
              .transition().duration(500)
              .style("opacity", 1);
          } else {
            d3.selectAll(".lines path")
              .transition().duration(500)
              .style("opacity", function () {
                const classes = d3.select(this).attr("class").split(" ");
                for (let sel of this.selectedEmotions) {
                  if (classes.indexOf(`line-${sel}`) !== -1) {
                    return 1;
                  }
                }
                return 0.1;
              }.bind(this));
          }
        });

      legendItem.append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", this.emotionColors[emotion]);

      legendItem.append("text")
        .attr("x", 24)
        .attr("y", 14)
        .style("font-size", "12px")
        .text(emotion);
    });
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
  window.visualizationInstance.updateBarChart(results[0]);
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
          window.visualizationInstance.updateBarChart(d);
        })
        .on("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            d3.selectAll(".sentence-list-item")
              .classed("clicked", false)
              .style("color", "");
            d3.select(this)
              .classed("clicked", true)
              .style("color", "#c00");
            window.visualizationInstance.updateBarChart(d);
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
      window.visualizationInstance.updateBarChart(results[index]);
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
