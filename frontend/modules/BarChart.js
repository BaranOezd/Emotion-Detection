export default class BarChartModule {
  constructor(containerSelector, emotionColors, emotions) {
    this.containerSelector = containerSelector;
    this.emotionColors = emotionColors;
    this.emotions = emotions;
    this.selectedEmotions = [];
    this.tempEmotionValues = null; // New property to store temporary emotion values
    this.previousEmotionValues = null; // Store previous sentence emotion values for smooth transitions
    this.aiEnabled = true; // Track whether AI modifications are enabled
    this.lineChartModule = null; // Will be set by MainController
  }

  // Method to link the LineChart module
  setLineChartModule(lineChartModule) {
    this.lineChartModule = lineChartModule;
  }

  clear() {
    d3.select(this.containerSelector).html("");
  }

  setAIEnabled(enabled) {
    this.aiEnabled = enabled; // Update AI modification state
  }

  render(sentenceData, { onReset, onChangeSentence, skipAnimation = false } = {}) {
    const barChartDiv = d3.select(this.containerSelector);
    barChartDiv.html(""); // Clear any existing content
  
    // Create or reuse tooltip element
    let tooltip = d3.select("body").select(".tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("background-color", "#fff")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("padding", "5px")
        .style("font-size", "12px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)");
    }
  
    // Save current emotion values as previous before updating
    if (this.tempEmotionValues) {
      this.previousEmotionValues = { ...this.tempEmotionValues };
    } else {
      // Initialize with zeros if no previous values exist
      this.previousEmotionValues = {};
      if (this.emotions.length) {
        this.emotions.forEach(emotion => this.previousEmotionValues[emotion] = 0);
      } else if (sentenceData.emotions) {
        Object.keys(sentenceData.emotions).forEach(emotion => this.previousEmotionValues[emotion] = 0);
      }
    }
    
    // Initialize a fresh copy of emotion values when rendering a new sentence
    this.tempEmotionValues = Object.assign({}, sentenceData.emotions);
    
    // Set the baseline emotion values on sentenceData if not already set
    sentenceData.originalEmotions = sentenceData.originalEmotions || Object.assign({}, sentenceData.emotions);
  
    // Dynamically calculate height and width based on available space
    const containerNode = barChartDiv.node();
    const availableHeight = containerNode.clientHeight;
    const availableWidth = containerNode.clientWidth;
  
    // Add extra left margin for checkboxes
    const margin = { top: 10, right: 20, bottom: 40, left: 50 }; // Increased left margin for checkboxes
    const width = availableWidth - margin.left - margin.right;
    const height = availableHeight - margin.top - margin.bottom;
  
    // Append the SVG for the bar chart
    const svg = barChartDiv.append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "100%");
    
    // Create a container group for bars and labels
    const chartGroup = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Create a separate container for checkboxes
    const checkboxGroup = svg.append("g")
      .attr("class", "checkbox-container")
      .attr("transform", `translate(0,${margin.top})`);
  
    // Use provided emotions or keys from sentenceData.emotions
    const emotions = this.emotions.length ? this.emotions : Object.keys(this.tempEmotionValues);
  
    // Normalize emotion scores so that their sum equals 1
    let total = emotions.reduce((sum, emotion) => sum + (+this.tempEmotionValues[emotion] || 0), 0);
    const emotionScores = emotions.map(emotion => {
      let raw = +this.tempEmotionValues[emotion] || 0;
      let normalized = total > 0 ? raw / total : 0;
      
      // Also include previous value for transition
      let previousValue = this.previousEmotionValues[emotion] || 0;
      let previousTotal = emotions.reduce((sum, e) => sum + (+this.previousEmotionValues[e] || 0), 0);
      let previousNormalized = previousTotal > 0 ? previousValue / previousTotal : 0;
      
      return { 
        emotion, 
        score: normalized,
        previousScore: previousNormalized 
      };
    });
    
    // Define scales for a horizontal bar chart
    const y = d3.scaleBand()
      .domain(emotions)
      .range([0, height]) // Use the full height for the bars
      .padding(0.1); // Reduced padding to minimize empty space
  
    const x = d3.scaleLinear()
      .domain([0, 1])
      .nice()
      .range([0, width]);
  
    // Append the x-axis at the bottom for percentage values.
    chartGroup.append("g")
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
        if (!this.aiEnabled) return; // Cancel drag if AI modifications are disabled
        d3.select(this).style("opacity", 0.7);
      })
      .on("drag", (event, d) => {
        if (!this.aiEnabled) return; // Cancel drag if AI modifications are disabled
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
        if (!this.aiEnabled) return; // Cancel drag if AI modifications are disabled
        d3.select(this).style("opacity", 1);
      });
    
    // Add checkboxes to the left of each bar
    const self = this;
    const checkboxSize = 16; // Size of the checkbox
    
    // Add checkbox for each emotion
    emotions.forEach((emotion, i) => {
      const checkboxY = y(emotion) + (y.bandwidth() - checkboxSize) / 2;
      
      // Create checkbox group
      const checkboxContainer = checkboxGroup.append("g")
        .attr("transform", `translate(20, ${checkboxY})`)
        .style("cursor", "pointer");
      
      // Add checkbox background
      checkboxContainer.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", checkboxSize)
        .attr("height", checkboxSize)
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .attr("fill", "white");
      
      // Add checkbox checkmark conditionally
      const isSelected = self.lineChartModule && 
                         self.lineChartModule.selectedEmotions && 
                         self.lineChartModule.selectedEmotions.includes(emotion);
      
      const checkmark = checkboxContainer.append("path")
        .attr("d", "M3,9 L7,13 L13,3") // Simple checkmark path
        .attr("stroke", "#333")
        .attr("stroke-width", 2)
        .attr("fill", "none")
        .style("opacity", isSelected ? 1 : 0);
      
      // Add click event to toggle emotion visibility
      checkboxContainer.on("click", function() {
        if (!self.lineChartModule) return;
        
        // Toggle this emotion's visibility
        self.toggleEmotionSelection(emotion);
        
        // Update this checkmark visibility
        const isNowSelected = self.lineChartModule.selectedEmotions.includes(emotion);
        checkmark.style("opacity", isNowSelected ? 1 : 0);
      });
    });
  
    // Draw horizontal bars - start from previous values instead of 0
    const bars = chartGroup.selectAll(".bar")
      .data(emotionScores)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("y", d => y(d.emotion))
      .attr("x", 0)
      .attr("height", y.bandwidth()) // Dynamically adjust bar height
      .attr("width", d => skipAnimation 
        ? Math.max(x(d.score), dynamicMinWidth) // Final width if skipping animation
        : Math.max(x(d.previousScore), dynamicMinWidth)) // Start from previous width
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
      .call(drag); // Attach drag behavior
  
    // Only animate if not skipping animation
    if (!skipAnimation) {
      bars.transition()
        .duration(300)  
        .ease(d3.easeQuadInOut)
        .attr("width", d => Math.max(x(d.score), dynamicMinWidth));
    }
  
    // Append labels to the right end of each bar showing the emotion names
    chartGroup.selectAll(".label")
      .data(emotionScores)
      .enter().append("text")
      .attr("class", "label")
      .attr("y", d => y(d.emotion) + y.bandwidth() / 2 + 4)
      .attr("x", d => Math.max(x(skipAnimation ? d.score : d.previousScore), dynamicMinWidth) + 5)
      .attr("text-anchor", "start")
      .style("font-size", "12px")
      .text(d => d.emotion);
      
    // Animate label positions too - also make this faster
    if (!skipAnimation) {
      svg.selectAll(".label")
        .transition()
        .duration(300)
        .ease(d3.easeQuadInOut)
        .attr("x", d => Math.max(x(d.score), dynamicMinWidth) + 5);
    }
  }
  
  toggleEmotionSelection(emotion) {
    if (!this.lineChartModule) return;
    
    const selectedEmotions = this.lineChartModule.selectedEmotions || [];
    let updatedSelection = [];
    
    // Check if the emotion is already selected
    if (selectedEmotions.includes(emotion)) {
      // Remove it if already selected
      updatedSelection = selectedEmotions.filter(e => e !== emotion);
    } else {
      // Add it if not already selected
      updatedSelection = [...selectedEmotions, emotion];
    }
    
    // Update the LineChart module's emotion visibility
    this.lineChartModule.updateEmotionVisibility(updatedSelection);
  }

  // Get the current temporary emotion values
  getCurrentEmotionValues() {
    return this.tempEmotionValues;
  }
}
