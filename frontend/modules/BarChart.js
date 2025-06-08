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
      .on("start", (event, d) => {  // Changed to arrow function
        if (!this.aiEnabled) return; // Now this refers to the BarChartModule instance
        d3.select(event.sourceEvent.target).style("opacity", 0.7);
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
      .on("end", (event) => {  // Changed to arrow function
        if (!this.aiEnabled) return; // Cancel drag if AI modifications are disabled
        d3.select(event.sourceEvent.target).style("opacity", 1);
      });
    
    // Add checkboxes to the left of each bar with improved styling and logic
    const self = this;
    const checkboxSize = 14; // Slightly smaller for better proportions
    
    // Add checkbox for each emotion
    emotions.forEach((emotion, i) => {
      const checkboxY = y(emotion) + (y.bandwidth() - checkboxSize) / 2;
      
      // Check if this emotion is currently selected in the line chart
      const isSelected = self.lineChartModule && 
                         self.lineChartModule.selectedEmotions && 
                         self.lineChartModule.selectedEmotions.includes(emotion);
      
      // Create checkbox container with better hover states
      const checkboxContainer = checkboxGroup.append("g")
        .attr("class", "checkbox-container")
        .attr("transform", `translate(15, ${checkboxY})`)
        .style("cursor", "pointer");
      
      // Add hover background for better UX
      const hoverBg = checkboxContainer.append("rect")
        .attr("class", "checkbox-hover-bg")
        .attr("x", -3)
        .attr("y", -3)
        .attr("width", checkboxSize + 6)
        .attr("height", checkboxSize + 6)
        .attr("rx", 2)
        .attr("fill", "transparent")
        .attr("stroke", "none");
      
      // Add checkbox background with better styling
      const checkboxBg = checkboxContainer.append("rect")
        .attr("class", "checkbox-bg")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", checkboxSize)
        .attr("height", checkboxSize)
        .attr("rx", 2) // Rounded corners
        .attr("stroke", isSelected ? self.emotionColors[emotion] : "#666")
        .attr("stroke-width", isSelected ? 2 : 1)
        .attr("fill", isSelected ? self.emotionColors[emotion] : "white");
      
      // Add checkmark with smooth transitions
      const checkmark = checkboxContainer.append("path")
        .attr("class", "checkbox-checkmark")
        .attr("d", "M2,7 L6,11 L12,3") // Adjusted for smaller size
        .attr("stroke", isSelected ? "white" : "transparent")
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("fill", "none")
        .style("opacity", isSelected ? 1 : 0);
    
      
      // Enhanced interaction with visual feedback
      checkboxContainer
        .on("mouseenter", function() {
          hoverBg.attr("fill", "rgba(0,0,0,0.05)");
          if (!isSelected) {
            checkboxBg.attr("stroke", self.emotionColors[emotion]);
          }
        })
        .on("mouseleave", function() {
          hoverBg.attr("fill", "transparent");
          const currentlySelected = self.lineChartModule && 
                                   self.lineChartModule.selectedEmotions && 
                                   self.lineChartModule.selectedEmotions.includes(emotion);
          if (!currentlySelected) {
            checkboxBg.attr("stroke", "#666");
          }
        })
        .on("click", function(event) {
          if (!self.lineChartModule) return;
          
          // Prevent event bubbling
          event.stopPropagation();
          
          // Get current selection state
          const currentSelection = self.lineChartModule.selectedEmotions || [];
          let newSelection = [...currentSelection];
          
          if (event.shiftKey || event.ctrlKey) {
            // Multi-select mode: toggle this emotion
            if (newSelection.includes(emotion)) {
              newSelection = newSelection.filter(e => e !== emotion);
            } else {
              newSelection.push(emotion);
            }
          } else {
            // Single-select mode: if this emotion is the only one selected, deselect all
            // Otherwise, select only this emotion
            if (newSelection.length === 1 && newSelection[0] === emotion) {
              newSelection = [];
            } else {
              newSelection = [emotion];
            }
          }
          
          // Update the selection
          self.updateEmotionSelection(newSelection);
          
          // Update this checkbox visual state immediately
          const nowSelected = newSelection.includes(emotion);
          
          // Animate checkbox state change
          checkboxBg
            .transition()
            .duration(100) // Reduced from 200
            .attr("stroke", nowSelected ? self.emotionColors[emotion] : "#666")
            .attr("stroke-width", nowSelected ? 2 : 1)
            .attr("fill", nowSelected ? self.emotionColors[emotion] : "white");
          
          checkmark
            .transition()
            .duration(100) // Reduced from 200
            .style("opacity", nowSelected ? 1 : 0)
            .attr("stroke", nowSelected ? "white" : "transparent");
          
          // Update all other checkboxes to reflect new state
          setTimeout(() => self.updateAllCheckboxes(), 150); // Reduced from 250
        });
      
      // Add keyboard accessibility
      checkboxContainer
        .attr("tabindex", 0)
        .attr("role", "checkbox")
        .attr("aria-checked", isSelected)
        .attr("aria-label", `Toggle ${emotion} visibility`)
        .on("keydown", function(event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            checkboxContainer.node().dispatchEvent(new MouseEvent("click", {
              shiftKey: event.shiftKey,
              ctrlKey: event.ctrlKey
            }));
          }
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
  
  updateEmotionSelection(newSelection) {
    if (!this.lineChartModule) return;
    
    // Update the LineChart module's emotion selection
    this.lineChartModule.selectedEmotions = newSelection;
    
    // Update line visibility in the line chart
    d3.selectAll(".lines")
      .transition()
      .duration(300)
      .style("opacity", function() {
        const classes = d3.select(this).attr("class").split(" ");
        return newSelection.length === 0 || newSelection.some(sel => classes.includes(`line-${sel}`)) ? 1 : 0.15;
      });
    
    // Update legend in line chart if it exists
    if (this.lineChartModule.updateLegendSelection) {
      this.lineChartModule.updateLegendSelection(newSelection);
    }
  }
  
  updateAllCheckboxes() {
    if (!this.lineChartModule) return;
    
    const currentSelection = this.lineChartModule.selectedEmotions || [];
    const checkboxContainers = d3.selectAll(".checkbox-container");
    const self = this; 
    
    checkboxContainers.each(function() {
      const container = d3.select(this);
      // Get emotion name from aria-label instead of label text
      const ariaLabel = container.attr("aria-label");
      const emotion = ariaLabel ? ariaLabel.replace("Toggle ", "").replace(" visibility", "") : "";
      const isSelected = currentSelection.includes(emotion);
      
      // Update visual state
      container.select(".checkbox-bg")
        .attr("stroke", isSelected ? self.emotionColors[emotion] : "#666")
        .attr("stroke-width", isSelected ? 2 : 1)
        .attr("fill", isSelected ? self.emotionColors[emotion] : "white");
      
      container.select(".checkbox-checkmark")
        .style("opacity", isSelected ? 1 : 0)
        .attr("stroke", isSelected ? "white" : "transparent");
      
      // Update accessibility attributes
      container.attr("aria-checked", isSelected);
    });
  }
}
