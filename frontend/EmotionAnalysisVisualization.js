class EmotionAnalysisVisualization {
    constructor(data) {
      this.data = data;
      this.emotions = data.columns.slice(1); // Skip the 'Sentence' column
      this.emotionColors = {
        Joy: "#FFEB3B",
        Sadness: "#2196F3",
        Fear: "#9C27B0",
        Disgust: "#4CAF50",
        Anger: "#F44336",
        Surprise: "#FFB322",
        Neutral: "#9E9E9E",
      };
      this.lastClickedSentence = null;
      this.selectedEmotions = [];
    }  
  
    clearBarChart() {
      d3.select("#chart").html("");
    }
  
    // Update the bar chart for a selected sentence's emotion data
    updateBarChart(sentenceData) {
      const chartDiv = d3.select("#chart");
      chartDiv.html("");
  
      const margin = { top: 20, right: 30, bottom: 100, left: 50 };
      const width = chartDiv.node().clientWidth - margin.left - margin.right;
      const height = chartDiv.node().clientHeight - margin.top - margin.bottom;
  
      const svg = chartDiv.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
  
      const x = d3.scaleBand()
        .domain(this.emotions)
        .range([0, width])
        .padding(0.2);
  
      const y = d3.scaleLinear()
        .domain([0, 1])
        .nice()
        .range([height, 0])
        .clamp(true);
  
      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .attr("dy", "1.5em");
  
      svg.append("g")
        .call(d3.axisLeft(y)
          .ticks(5)
          .tickValues([0, 0.2, 0.4, 0.6, 0.8, 1])
          .tickFormat(d => `${d * 100}%`));
  
      const emotionScores = this.emotions.map(emotion => ({
        emotion: emotion,
        score: +sentenceData[emotion] || 0
      }));
  
      svg.selectAll(".bar")
        .data(emotionScores)
        .enter().append("rect")
        .attr("x", d => x(d.emotion))
        .attr("y", d => y(d.score))
        .attr("width", x.bandwidth())
        .attr("height", d => Math.max(height - y(d.score), 0))
        .style("fill", d => this.emotionColors[d.emotion]);
  
      svg.selectAll(".label")
        .data(emotionScores)
        .enter().append("text")
        .attr("x", d => x(d.emotion) + x.bandwidth() / 2)
        .attr("y", d => y(d.score) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(d => (d.score > 0 ? `${Math.round(d.score * 100)}%` : ""));
    }
  
    // Create the steam graph with an integrated, clickable legend
    createSteamGraph() {
      const streamContainer = d3.select("#steamGraph");
      streamContainer.selectAll("*").remove();
  
      // Increase bottom margin to leave room for the integrated legend
      const margin = { top: 40, right: 30, bottom: 70, left: 40 };
      const width = streamContainer.node().clientWidth - margin.left - margin.right;
      const height = streamContainer.node().clientHeight - margin.top - margin.bottom;
  
      const svg = streamContainer.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%");
  
      const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
  
      // Title
      g.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("Emotion Trends Over Sentences");
  
      const fullData = this.data;
      const x = d3.scaleLinear()
        .domain([1, fullData.length])
        .range([0, width]);
      const y = d3.scaleLinear()
        .domain([0, 1])
        .nice()
        .range([height, 0]);
  
      // Data sampling helper
      const sampleData = (data, domainStart, domainEnd, step) => {
        const sampledData = [];
        const sampledIndices = [];
        for (let i = domainStart - 1; i < domainEnd; i += step) {
          if (i >= 0 && i < data.length) {
            sampledData.push(data[i]);
            sampledIndices.push(i + 1);
          }
        }
        return { sampledData, sampledIndices };
      };
  
      const lineGroup = g.append("g").attr("class", "lines");  
      const drawLines = (sampledData, sampledIndices, xScale, immediate = true) => {
        const lines = lineGroup.selectAll(".emotion-line")
          .data(this.emotions);
  
        lines.exit().interrupt().style("opacity", 0).remove();
  
        const newLines = lines.enter()
          .append("path")
          .attr("class", d => `line-${d} emotion-line`)
          .attr("fill", "none")
          .attr("stroke", d => this.emotionColors[d])
          .attr("stroke-width", 4)
          .style("opacity", d =>
            (this.selectedEmotions && this.selectedEmotions.length > 0)
              ? (this.selectedEmotions.includes(d) ? 1 : 0.1)
              : 1
          );
  
        const merged = lines.merge(newLines).interrupt();
  
        if (immediate) {
          merged
            .attr("d", emotion => {
              return d3.line()
                .x((_, i) => xScale(sampledIndices[i]))
                .y(v => y(+v[emotion] || 0))
                .curve(d3.curveBasis)(sampledData);
            })
            .style("opacity", emotion =>
              (this.selectedEmotions && this.selectedEmotions.length > 0)
                ? (this.selectedEmotions.includes(emotion) ? 1 : 0.1)
                : 1
            );
        } else {
          merged
            .transition()
            .duration(500)
            .attr("d", emotion => {
              return d3.line()
                .x((_, i) => xScale(sampledIndices[i]))
                .y(v => y(+v[emotion] || 0))
                .curve(d3.curveBasis)(sampledData);
            })
            .style("opacity", emotion =>
              (this.selectedEmotions && this.selectedEmotions.length > 0)
                ? (this.selectedEmotions.includes(emotion) ? 1 : 0.1)
                : 1
            );
        }
      };
  
      let currentStep = Math.ceil(fullData.length / (width / 20));
      let { sampledData, sampledIndices } = sampleData(fullData, 1, fullData.length, currentStep);
      drawLines(sampledData, sampledIndices, x);
  
      // Axes and grid
      const xAxis = g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x)
          .tickValues(d3.range(1, fullData.length + 1))
          .tickFormat(d => `${d}`));
  
      g.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1f")))
        .select(".domain").attr("stroke", "none");
  
      g.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .style("stroke", "#ddd")
        .style("stroke-opacity", 0.3);
  
      // Zoom behavior
      const minPixelPerSentence = 30;
      const maxZoom = Math.ceil((minPixelPerSentence * (fullData.length - 1)) / width);
      const zoom = d3.zoom()
        .scaleExtent([1, maxZoom])
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", (event) => {
          const newX = event.transform.rescaleX(x);
          const domain = newX.domain();
          const domainStart = Math.max(1, Math.round(domain[0]));
          const domainEnd = Math.min(fullData.length, Math.round(domain[1]));
          const visibleWidth = newX(domainEnd) - newX(domainStart);
          const step = Math.max(1, Math.floor((domainEnd - domainStart) / (visibleWidth / 20)));
          const { sampledData, sampledIndices } = sampleData(fullData, domainStart, domainEnd, step);
          drawLines(sampledData, sampledIndices, newX);
          const tickValues = (domainEnd - domainStart) < 20
            ? d3.range(domainStart, domainEnd + 1)
            : null;
          xAxis.call(d3.axisBottom(newX)
            .tickValues(tickValues)
            .tickFormat(d => `${d}`));
        });
  
      svg.call(zoom);
  
      // Reset zoom button
      const resetZoom = () => {
        svg.transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity);
        const { sampledData, sampledIndices } = sampleData(fullData, 1, fullData.length, currentStep);
        drawLines(sampledData, sampledIndices, x);
        xAxis.call(d3.axisBottom(x)
          .tickValues(d3.range(1, fullData.length + 1))
          .tickFormat(d => `${d}`));
      };
  
      const resetZoomGroup = svg.append("g")
        .attr("class", "reset-zoom")
        .attr("transform", `translate(${width - 110}, 10)`)
        .style("cursor", "pointer")
        .on("click", resetZoom);
  
      resetZoomGroup.append("rect")
        .attr("width", 80)
        .attr("height", 25)
        .attr("fill", "#f0f0f0")
        .attr("stroke", "#ccc")
        .attr("rx", 5);
  
      resetZoomGroup.append("text")
        .attr("x", 10)
        .attr("y", 16)
        .style("font-size", "12px")
        .text("Reset Zoom");
  
      // Integrated Legend 
      const legendGroup = g.append("g")
        .attr("class", "legend")
        // Position the legend centered below the graph (adjust the y value as needed)
        .attr("transform", `translate(${width / 2}, ${height + 30})`);
  
      const legendSpacing = 100;
      const self = this;
      this.emotions.forEach((emotion, i) => {
        const legendItem = legendGroup.append("g")
          .attr("transform", `translate(${(i - this.emotions.length / 2) * legendSpacing}, 0)`)
          .style("cursor", "pointer")
          .on("click", function(event) {
            if (event.shiftKey) {
              // Toggle selection on shift-click
              if (self.selectedEmotions.includes(emotion)) {
                self.selectedEmotions = self.selectedEmotions.filter(e => e !== emotion);
                d3.select(this).select("rect")
                  .transition().duration(300)
                  .attr("stroke-width", 0)
                  .attr("transform", "scale(1)");
                d3.select(this).select("text")
                  .transition().duration(300)
                  .style("font-weight", "normal");
              } else {
                self.selectedEmotions.push(emotion);
                d3.select(this).select("rect")
                  .transition().duration(300)
                  .attr("stroke-width", 2)
                  .attr("transform", "scale(1.1)");
                d3.select(this).select("text")
                  .transition().duration(300)
                  .style("font-weight", "bold");
              }
            } else {
              // Normal click: if already the only selection, clear; otherwise select exclusively.
              if (self.selectedEmotions.length === 1 && self.selectedEmotions[0] === emotion) {
                self.selectedEmotions = [];
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
                self.selectedEmotions = [emotion];
                d3.select(this).select("rect")
                  .transition().duration(300)
                  .attr("stroke-width", 2)
                  .attr("transform", "scale(1.1)");
                d3.select(this).select("text")
                  .transition().duration(300)
                  .style("font-weight", "bold");
              }
            }
            // Update the opacity of the lines based on selection
            if (self.selectedEmotions.length === 0) {
              d3.selectAll(".lines path")
                .transition().duration(500)
                .style("opacity", 1);
            } else {
              d3.selectAll(".lines path")
                .transition().duration(500)
                .style("opacity", function() {
                  const classes = d3.select(this).attr("class").split(" ");
                  for (let sel of self.selectedEmotions) {
                    if (classes.indexOf(`line-${sel}`) !== -1) {
                      return 1;
                    }
                  }
                  return 0.1;
                });
            }
          })
          .on("mouseover", function() {
            d3.select(this).select("rect")
              .transition().duration(200)
              .attr("stroke", "#000")
              .attr("stroke-width", 2);
            d3.select(this).select("text")
              .transition().duration(200)
              .style("font-weight", "bold");
          })
          .on("mouseout", function() {
            if (!self.selectedEmotions.includes(emotion)) {
              d3.select(this).select("rect")
                .transition().duration(200)
                .attr("stroke", "none")
                .attr("stroke-width", 0);
              d3.select(this).select("text")
                .transition().duration(200)
                .style("font-weight", "normal");
            }
          });
  
        legendItem.append("rect")
          .attr("width", 18)
          .attr("height", 18)
          .attr("fill", self.emotionColors[emotion]);
  
        legendItem.append("text")
          .attr("x", 24)
          .attr("y", 14)
          .style("font-size", "12px")
          .text(emotion);
      });
    }
  }
  
  // Load initial CSV data and render the visualization
  d3.csv("/backend/emotion_analysis.csv").then(function (data) {
    window.visualizationInstance = new EmotionAnalysisVisualization(data);
    window.visualizationInstance.createSteamGraph();
  });
  
  // DOMContentLoaded for dynamic interactions
  document.addEventListener("DOMContentLoaded", () => {
    const analyzeButton = document.getElementById("analyzeButton");
    const uploadButton = document.getElementById("uploadButton");
    const feedbackEl = document.getElementById("feedback");
    const loadingIndicator = document.getElementById("loadingIndicator");
  
    function setLoading(isLoading) {
      if (isLoading) {
        loadingIndicator.style.display = "block";
        analyzeButton.disabled = true;
        uploadButton.disabled = true;
      } else {
        loadingIndicator.style.display = "none";
        analyzeButton.disabled = false;
        uploadButton.disabled = false;
      }
    }
    analyzeButton.addEventListener("click", () => {
      const textInput = document.getElementById("textEditor").innerText.trim();
      if (!textInput) {
          alert("Please enter some text to analyze.");
          return;
        }
        setLoading(true);
        analyzeText(textInput)
          .then((data) => {
            // Update visualization with returned data, etc.
            updateVisualization(data.results);
            updateSentenceList(data.results);
          })
          .catch((error) => {
            console.error("Error analyzing text:", error);
            alert("An error occurred during analysis.");
          })
          .finally(() => {
            setLoading(false);
          });
      });
  
    function showFeedback(message, isError = false) {
      feedbackEl.textContent = message;
      feedbackEl.style.color = isError ? "#c00" : "#007b00";
      setTimeout(() => {
        feedbackEl.textContent = "";
      }, 3000);
    }
  
    analyzeButton.addEventListener("click", handleAnalyzeButton);
    uploadButton.addEventListener("click", handleFileUpload);
  
    function handleAnalyzeButton() {
      const textInput = document.getElementById("textEditor").innerText.trim();
      if (!textInput) {
          alert("Please enter some text to analyze.");
          return;
      }
  
      setLoading(true);  // Show loading spinner
      analyzeText(textInput)
          .then(() => setLoading(false))  // Stop loading on success
          .catch(() => setLoading(false)); // Stop loading on error
  }
  
  
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
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            if (data.error) {
              showFeedback(`Error: ${data.error}`, true);
            } else if (data.results) {
              showFeedback("File uploaded and processed successfully!");
              updateVisualization(data.results);
              updateSentenceList(data.results);
            } else {
              showFeedback("Unexpected response from backend.", true);
            }
          })
          .catch((error) => {
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
          body: JSON.stringify({ text }),
      })
      .then(response => response.json()) // Make sure this returns the parsed JSON
      .then(data => {
          console.log("Backend response:", data);
          if (!data || !data.results) {
              console.error("Error: Backend response is missing 'results'", data);
              throw new Error("No results in backend response.");
          }
          updateTextEditor(data.results);
          updateVisualization(data.results);
          updateSentenceList(data.results);
          return data;
      })
      .catch(error => {
          console.error("Error analyzing text:", error);
      })
      .finally(() => {
          setLoading(false);
      });
  }
    
  // Function to update the text editor with analyzed sentences
  function updateTextEditor(results) {
    if (!results || !Array.isArray(results)) {
        console.error("updateTextEditor received invalid results:", results);
        return;
    }

    const textEditor = document.getElementById("textEditor");
    textEditor.innerHTML = ""; // Clear existing content

    results.forEach((d, i) => {
        const sentenceSpan = document.createElement("span");
        sentenceSpan.textContent = d.sentence;
        sentenceSpan.classList.add("sentence-text");

        textEditor.appendChild(sentenceSpan);
        textEditor.appendChild(document.createElement("br")); // Add line breaks
    });
}

  
    function updateVisualization(results) {
      d3.select("#chart").html("");
      d3.select("#steamGraph").html("");
      updateBarChart(results);
      updateSteamGraph(results);
    }
  
    function updateSentenceList(results) {
        const sentenceList = d3.select(".sentence-list");
        sentenceList.html("");
        results.forEach((d, i) => {
          sentenceList.append("div")
            .attr("class", "sentence-list-item")
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("aria-label", `Sentence ${i + 1}: ${d.sentence}`)
            .attr("title", `Click to view analysis for: ${d.sentence}`)
            // Again, separate the sentence number from the text.
            .html(
              `<span class="sentence-number" style="user-select: none;">${i + 1}. </span>
               <span class="sentence-text">${d.sentence}</span>`
            )
            .on("mouseover", function () {
              d3.select(this).classed("hover", true);
            })
            .on("mouseout", function () {
              d3.select(this).classed("hover", false);
            })
            .on("focus", function () {
              d3.select(this).classed("focus", true);
            })
            .on("blur", function () {
              d3.select(this).classed("focus", false);
            })
            .on("click", function (event) {
              // Remove the clicked state from all sentence items.
              d3.selectAll(".sentence-list-item")
                .classed("clicked", false)
                .style("color", "");
              // Mark the clicked element.
              d3.select(this)
                .classed("clicked", true)
                .style("color", "#c00");
              updateBarChart([d]);
            })
            .on("keydown", function (event) {
              if (event.key === "Enter" || event.key === " ") {
                d3.selectAll(".sentence-list-item")
                  .classed("clicked", false)
                  .style("color", "");
                d3.select(this)
                  .classed("clicked", true)
                  .style("color", "#c00");
                updateBarChart([d]);
              }
            });
        });
      }   
  
    function updateBarChart(data) {
        // Existing bar chart update function (from previous code)
        const emotions = Object.keys(data[0].emotions);
        const emotionScores = emotions.map((emotion) => ({
            emotion,
            score: data[0].emotions[emotion],
        }));

        const chartDiv = d3.select("#chart");
        chartDiv.html("");

        const margin = { top: 20, right: 30, bottom: 100, left: 50 };
        const width = chartDiv.node().clientWidth - margin.left - margin.right;
        const height = chartDiv.node().clientHeight - margin.top - margin.bottom;

        const svg = chartDiv.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("width", "100%")
            .style("height", "100%")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(emotions)
            .range([0, width])
            .padding(0.2);

        const y = d3.scaleLinear()
            .domain([0, 1])
            .nice()
            .range([height, 0]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .attr("dy", "1.5em");

        svg.append("g")
            .call(d3.axisLeft(y).ticks(5).tickValues([0, 0.2, 0.4, 0.6, 0.8, 1]).tickFormat(d => `${d * 100}%`));

        svg.selectAll(".bar")
            .data(emotionScores)
            .enter().append("rect")
            .attr("x", d => x(d.emotion))
            .attr("y", d => y(d.score))
            .attr("width", x.bandwidth())
            .attr("height", d => height - y(d.score))
            .style("fill", "#2196F3");

        svg.selectAll(".label")
            .data(emotionScores)
            .enter().append("text")
            .attr("x", d => x(d.emotion) + x.bandwidth() / 2)
            .attr("y", d => y(d.score) - 5)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .text(d => `${Math.round(d.score * 100)}%`);
    }

    // Function to update the steam graph
    function updateSteamGraph(data) {
        const container = d3.select("#steamGraph");
        container.html(""); // clear any previous graph
    
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
            .domain([1, data.length])
            .range([0, width]);
    
        const y = d3.scaleLinear()
            .domain([0, 1])
            .nice()
            .range([height, 0]);
    
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(data.length).tickFormat(d => `${d}`));
    
        svg.append("g")
            .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1f")));
    
        // Derive emotion keys by filtering out the "Sentence" column.
        const emotions = data.columns 
            ? data.columns.slice(1)
            : Object.keys(data[0]).filter(key => key !== "Sentence");
    
        // For each emotion, build and append a line.
        emotions.forEach(emotion => {
            const line = d3.line()
                .x((d, i) => x(i + 1))
                // Convert each value to a number; if conversion fails, default to 0.
                .y(d => y(+d[emotion] || 0))
                .curve(d3.curveBasis);
    
            svg.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", "#F44336")  // might use this.emotionColors[emotion] instead
                .attr("stroke-width", 4)
                .attr("d", line);
        });
    }
  });
  