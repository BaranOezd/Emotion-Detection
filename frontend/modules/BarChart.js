// barChart.js
import * as d3 from 'd3';

export class BarChartVisualizer {
  constructor(emotionColors) {
    this.emotionColors = emotionColors || {
      joy: "#FFEB3B",
      sadness: "#2196F3",
      fear: "#9C27B0",
      disgust: "#4CAF50",
      anger: "#F44336",
      surprise: "#FFB322",
      neutral: "#9E9E9E",
    };
    this.tooltip = this.createTooltip();
  }

  createTooltip() {
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
    return tooltip;
  }

  clear() {
    d3.select("#barchart").html("");
  }

  render(sentenceData, updateLineChart, updateTextEditorWithHighlights) {
    const barChartDiv = d3.select("#barchart");
    barChartDiv.html("");
    
    // Save a copy of the original emotions for resetting later
    const originalEmotions = Object.assign({}, sentenceData.emotions);
    
    // Ensure the original sentence is stored
    if (!sentenceData.originalSentence) {
      sentenceData.originalSentence = sentenceData.sentence;
    }
    
    // Add Reset button
    this.addResetButton(barChartDiv, sentenceData, originalEmotions, updateLineChart, updateTextEditorWithHighlights);
    
    // Add Change Sentence button
    this.addChangeSentenceButton(barChartDiv, sentenceData, updateLineChart, updateTextEditorWithHighlights);
    
    const emotions = Object.keys(sentenceData.emotions);
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
      .domain(emotions)
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
    
    // Normalize emotion scores
    let total = emotions.reduce((sum, emotion) => sum + (+sentenceData.emotions[emotion] || 0), 0);
    const emotionScores = emotions.map(emotion => {
      let raw = +sentenceData.emotions[emotion] || 0;
      let normalized = total > 0 ? raw / total : 0;
      return { emotion, score: normalized };
    });
    
    // Define a dynamic minimum: 3% of the scale
    const minFraction = 0.03;
    const dynamicMinHeight = height - y(minFraction);
    
    // Create drag behavior
    const drag = this.createDragBehavior(sentenceData, emotionScores, svg, y, height, dynamicMinHeight);
    
    // Draw bars with tooltip and drag events
    this.drawBars(svg, emotionScores, x, y, height, dynamicMinHeight, drag);
    
    // Draw labels above bars
    this.drawLabels(svg, emotionScores, x, y, height, dynamicMinHeight);
  }

  addResetButton(barChartDiv, sentenceData, originalEmotions, updateLineChart, updateTextEditorWithHighlights) {
    barChartDiv.append("button")
      .attr("id", "resetButton")
      .text("Reset")
      .style("margin-bottom", "10px")
      .on("click", () => {
        // Revert to original emotions and sentence
        sentenceData.emotions = Object.assign({}, originalEmotions);
        sentenceData.sentence = sentenceData.originalSentence;

        // Revert line graph to original emotions 
        window.visualizationInstance.data[sentenceData.index] = sentenceData;
        updateLineChart();   

        // Revert bar chart to original emotions
        this.render(sentenceData, updateLineChart, updateTextEditorWithHighlights);

        // Update the corresponding sentence span in the text editor and keep it highlighted
        if (sentenceData.index !== undefined) {
          const sentenceSpan = document.querySelector(`.highlighted-sentence[data-index="${sentenceData.index}"]`);
          if (sentenceSpan) {
            sentenceSpan.innerText = sentenceData.originalSentence;
            sentenceSpan.classList.add("selected");
          } else {
            // Re-render text editor with the selected index preserved
            updateTextEditorWithHighlights(window.visualizationInstance.data, sentenceData.index);
          }
        }
      });
  }

  addChangeSentenceButton(barChartDiv, sentenceData, updateLineChart, updateTextEditorWithHighlights) {
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
          updateTextEditorWithHighlights(window.visualizationInstance.data, sentenceData.index);
          updateLineChart();
        })
        .catch(error => {
          console.error("Error modifying sentence:", error);
          alert("An error occurred while modifying the sentence: " + error.message);
        });
      });
  }

  createDragBehavior(sentenceData, emotionScores, svg, y, height, dynamicMinHeight) {
    return d3.drag()
      .on("start", (event, d) => {
        d3.select(event.sourceEvent.target).style("opacity", 0.7);
      })
      .on("drag", (event, d) => {
        // Get the new score from the drag event
        let newY = Math.max(0, Math.min(event.y, height));
        let newScore = y.invert(newY);
        newScore = Math.round(newScore * 20) / 20;
        newScore = Math.max(0, Math.min(newScore, 1));
      
        // Set the new value for the dragged emotion
        sentenceData.emotions[d.emotion] = newScore;
      
        // Recalculate the total and normalize all emotion values
        let total = 0;
        for (let key in sentenceData.emotions) {
          total += sentenceData.emotions[key];
        }
        // Update each emotion so that the sum equals 1
        for (let key in sentenceData.emotions) {
          sentenceData.emotions[key] = sentenceData.emotions[key] / total;
        }
      
        // Update the local array of scores used by the chart
        emotionScores.forEach(e => {
          e.score = sentenceData.emotions[e.emotion];
        });
      
        // Update the bars
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
      
        this.tooltip.html(`${d.emotion}: ${Math.round(d.score * 100)}%`)
                .style("left", (event.sourceEvent.pageX + 10) + "px")
                .style("top", (event.sourceEvent.pageY - 20) + "px");
      })
      .on("end", (event, d) => {
        d3.select(event.sourceEvent.target).style("opacity", 1);
        this.tooltip.style("opacity", 0);
      });
  }

  drawBars(svg, emotionScores, x, y, height, dynamicMinHeight, drag) {
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
      .on("mouseover", (event, d) => {
        this.tooltip.style("opacity", 0.9);
        this.tooltip.html(`${d.emotion}: ${Math.round(d.score * 100)}%`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
        d3.select(event.target).style("stroke", "#000").style("stroke-width", "1px");
      })
      .on("mousemove", (event, d) => {
        this.tooltip.style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", (event, d) => {
        this.tooltip.style("opacity", 0);
        d3.select(event.target).style("stroke", "none");
      })
      .call(drag);
  }

  drawLabels(svg, emotionScores, x, y, height, dynamicMinHeight) {
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
}