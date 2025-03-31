export default class BarChartModule {
  constructor(containerSelector, emotionColors, emotions) {
    this.containerSelector = containerSelector;
    this.emotionColors = emotionColors;
    this.emotions = emotions;
    this.selectedEmotions = [];
    this.tempEmotionValues = null; // New property to store temporary emotion values
  }

  clear() {
    d3.select(this.containerSelector).html("");
  }

  render(sentenceData, { onReset, onChangeSentence } = {}) {
    const barChartDiv = d3.select(this.containerSelector);
    barChartDiv.html(""); // Clear any existing content
  
    // Create or reuse tooltip element
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
  
    // Initialize a fresh copy of emotion values when rendering a new sentence
    this.tempEmotionValues = Object.assign({}, sentenceData.emotions);
  
    // Set the baseline emotion values on sentenceData if not already set.
    sentenceData.originalEmotions = sentenceData.originalEmotions || Object.assign({}, sentenceData.emotions);
  
    // Dynamically calculate height and width based on available space
    const containerNode = barChartDiv.node();
    const availableHeight = containerNode.clientHeight;
    const availableWidth = containerNode.clientWidth;
  
    // Set up margins and dimensions
    const margin = { top: 10, right: 20, bottom: 40, left: 20 }; // Reduced top margin
    const width = availableWidth - margin.left - margin.right;
    const height = availableHeight - margin.top - margin.bottom;
  
    // Append the SVG for the bar chart
    const svg = barChartDiv.append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "100%")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
    // Use provided emotions or keys from sentenceData.emotions.
    const emotions = this.emotions.length ? this.emotions : Object.keys(this.tempEmotionValues);
  
    // Normalize emotion scores so that their sum equals 1.
    let total = emotions.reduce((sum, emotion) => sum + (+this.tempEmotionValues[emotion] || 0), 0);
    const emotionScores = emotions.map(emotion => {
      let raw = +this.tempEmotionValues[emotion] || 0;
      let normalized = total > 0 ? raw / total : 0;
      return { emotion, score: normalized };
    });      
    
    // Define scales for a horizontal bar chart.
    const y = d3.scaleBand()
      .domain(emotions)
      .range([0, height]) // Use the full height for the bars
      .padding(0.1); // Reduced padding to minimize empty space
  
    const x = d3.scaleLinear()
      .domain([0, 1])
      .nice()
      .range([0, width]);
  
    // Append the x-axis at the bottom for percentage values.
    svg.append("g")
      .attr("transform", `translate(0,${height})`) // Move x-axis to the bottom
      .call(d3.axisBottom(x)
        .ticks(5)
        .tickFormat(d => `${Math.round(d * 100)}%`))
      .selectAll("text")
      .style("font-size", "12px");
  
    // Enforce a minimum bar width for visibility.
    const minFraction = 0.03;
    const dynamicMinWidth = x(minFraction);
  
    // Define drag behavior for interactive score adjustment.
    const drag = d3.drag()
      .on("start", function (event, d) {
        d3.select(this).style("opacity", 0.7);
      })
      .on("drag", (event, d) => {
        let newX = Math.max(0, Math.min(event.x, width));
        let newScore = x.invert(newX);
        newScore = Math.round(newScore * 20) / 20;
        newScore = Math.max(0, Math.min(newScore, 1));
  
        // Update the temporary score for the dragged emotion and re-normalize all scores
        this.tempEmotionValues[d.emotion] = newScore;
        let total = 0;
        for (let key in this.tempEmotionValues) {
          total += this.tempEmotionValues[key];
        }
        for (let key in this.tempEmotionValues) {
          this.tempEmotionValues[key] = this.tempEmotionValues[key] / total;
        }
        
        // Update emotionScores for rendering
        emotionScores.forEach(e => {
          e.score = this.tempEmotionValues[e.emotion];
        });
  
        // Update the bar widths based on the new scores.
        svg.selectAll(".bar")
          .data(emotionScores)
          .attr("width", d => Math.max(x(d.score), dynamicMinWidth));
  
        // Update the labels so they remain at the right end of each bar.
        svg.selectAll(".label")
          .data(emotionScores)
          .attr("x", d => Math.max(x(d.score), dynamicMinWidth) + 5)
          .text(d => d.emotion);
  
        tooltip.html(`${d.emotion}: ${Math.round(d.score * 100)}%`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("end", function () {
        d3.select(this).style("opacity", 1);
      });
  
    // Draw horizontal bars for each emotion with initial width set to 0.
    const bars = svg.selectAll(".bar")
      .data(emotionScores)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("y", d => y(d.emotion))
      .attr("x", 0)
      .attr("height", y.bandwidth()) // Dynamically adjust bar height
      .attr("width", 0)  // Start at 0 width for animation
      .style("fill", d => this.emotionColors[d.emotion])
      .style("cursor", "pointer")
      .attr("tabindex", 0)
      .attr("aria-label", d => `${d.emotion}: ${Math.round(d.score * 100)}%`)
      .on("mouseover", function (event, d) {
        tooltip.style("opacity", 0.9)
          .html(`${d.emotion}: ${Math.round(d.score * 100)}%`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
        d3.select(this).style("stroke", "#000").style("stroke-width", "1px");
      })
      .on("mousemove", function (event, d) {
        tooltip.style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", function () {
        tooltip.style("opacity", 0);
        d3.select(this).style("stroke", "none");
      })
      .call(drag);
  
    // Animate the bars to their final width.
    bars.transition()
      .duration(500)  // Animation duration in milliseconds
      .attr("width", d => Math.max(x(d.score), dynamicMinWidth));
  
    // Append labels to the right end of each bar showing the emotion names.
    svg.selectAll(".label")
      .data(emotionScores)
      .enter().append("text")
      .attr("class", "label")
      .attr("y", d => y(d.emotion) + y.bandwidth() / 2 + 4)
      .attr("x", d => Math.max(x(d.score), dynamicMinWidth) + 5)
      .attr("text-anchor", "start")
      .style("font-size", "12px")
      .text(d => d.emotion);
  }
  
  // Get the current temporary emotion values
  getCurrentEmotionValues() {
    return this.tempEmotionValues;
  }
}
