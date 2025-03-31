export default class LineChartModule {
  constructor(containerSelector, emotions, emotionColors) {
    this.containerSelector = containerSelector;
    this.emotions = emotions;
    this.emotionColors = emotionColors;
    this.selectedEmotions = [];
    this.currentHighlightIndex = null; // Add property to track currently highlighted sentence
  }

  render(data) {
    const container = d3.select(this.containerSelector);
    container.html(""); // Clear the chart container

    // Create a wrapper div with relative positioning
    const wrapper = container.append("div")
      .style("position", "relative")
      .style("height", "100%");

    // Create the scrollable chart container
    const chartContainer = wrapper.append("div")
      .attr("class", "chart-container")
      .style("position", "absolute")
      .style("top", "0")
      .style("left", "0")
      .style("right", "0")
      .style("bottom", "30px"); // Leave space for x-axis

    // Create fixed container for x-axis
    const xAxisContainer = wrapper.append("div")
      .style("position", "absolute")
      .style("bottom", "0")
      .style("left", "0")
      .style("right", "0")
      .style("height", "30px") // Fixed height for x-axis
      .style("background-color", "#fff");

    const fullWidth = container.node().clientWidth;
    const rowHeight = 30;
    const dynamicChartHeight = data.length * rowHeight;
    const margin = { top: 0, right: 20, bottom: 0, left: 20 }; // bottom margin moved to container
    const totalChartHeight = dynamicChartHeight + margin.top;
    const chartWidth = fullWidth - margin.left - margin.right;

    // Main chart SVG
    const chartSvg = chartContainer.append("svg")
      .attr("class", "chart-svg")
      .attr("viewBox", `0 0 ${chartWidth + margin.left + margin.right} ${totalChartHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", `${totalChartHeight}px`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X-axis SVG
    const xAxisSvg = xAxisContainer.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .append("g")
      .attr("transform", `translate(${margin.left},0)`);

    const x = d3.scaleLinear().domain([0, 1]).nice().range([chartWidth, 0]);
    const y = d3.scalePoint()
      .domain(data.map((_, i) => i + 1))
      .range([0, dynamicChartHeight])
      .padding(0);

    // Add x-axis to the fixed container
    xAxisSvg.append("g")
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".1f")));

    // Add y-axis to the main chart
    chartSvg.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${chartWidth}, 0)`)
      .call(d3.axisRight(y).tickFormat(d => d));

    this.emotions.forEach(emotion => {
      const points = data.map((d, i) => ({
        x: x(+d.emotions[emotion] || 0),
        y: y(i + 1)
      }));

      const line = d3.line()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3.curveBasis);

      chartSvg.append("path")
        .datum(points)
        .attr("class", `line-${emotion} lines`)
        .attr("fill", "none")
        .attr("stroke", this.emotionColors[emotion] || "#000")
        .attr("stroke-width", 4)
        .attr("d", line);
    });

    // Render the legend in the #lineChartLegend container
    const legendContainer = d3.select("#lineChartLegend");
    legendContainer.html(""); // Clear the legend container

    // Calculate proper legend height based on number of emotions
    const numRows = Math.ceil(this.emotions.length / 4); // At most 4 per row
    const legendHeight = Math.max(110, numRows * 40 + 30); // Dynamic height with minimum

    const legendSvg = legendContainer.append("svg")
      .attr("class", "legend-svg")
      .attr("width", "100%")
      .attr("height", "100%") // Fill entire container
      .attr("viewBox", `0 0 ${chartWidth} ${legendHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    this.drawLegend(legendSvg, chartWidth, legendHeight);

    // Store references to important elements for later use
    this.chartSvg = chartSvg;
    this.x = x;
    this.y = y;
    this.data = data;
    
    // If there was a highlighted sentence, restore it after re-rendering
    if (this.currentHighlightIndex !== null && this.currentHighlightIndex < data.length) {
      this.highlightSentence(this.currentHighlightIndex);
    }
  }

  drawLegend(legendSvg, chartWidth, legendHeight) {
    const padding = { x: 15, y: 10 };
    const availableWidth = chartWidth - (padding.x * 2);
    const emotionColors = this.emotionColors;
    const self = this;
    
    const legendGroup = legendSvg.append("g")
      .attr("transform", `translate(${padding.x},${padding.y})`);
    
    // Add legend title/instructions with smaller font
    legendGroup.append("text")
      .attr("x", availableWidth / 2)
      .attr("y", -2)
      .attr("text-anchor", "middle")
      .style("font-size", "8px")
      .style("font-weight", "bold")
      .text("Click to filter • Shift+Click for multiple");
    
    // Calculate item dimensions
    const itemHeight = 18;
    const itemPadding = 6;
    const minItemWidth = 80; // Minimum width for each legend item
    
    // Calculate item sizes and positions using a flexbox-like wrapping approach
    const legendItems = [];
    let rowX = 0;
    let rowY = 5; // Starting Y position (after the title)
    let maxRowHeight = 0;
    
    // First pass: calculate text widths and create item objects
    this.emotions.forEach(emotion => {
      // Measure the text width
      const tempText = legendGroup.append("text")
        .style("font-size", "10px") // Even smaller font
        .style("visibility", "hidden")
        .text(emotion);
      const textWidth = tempText.node().getComputedTextLength();
      tempText.remove();
      
      // Calculate full item width (color box + spacing + text + padding)
      const itemWidth = Math.max(minItemWidth, textWidth + 30); // 10px box + 5px spacing + 15px right padding
      
      // Check if this item will fit on the current row
      if (rowX + itemWidth > availableWidth && rowX > 0) {
        // Move to the next row
        rowY += maxRowHeight + itemPadding;
        rowX = 0;
        maxRowHeight = 0;
      }
      
      // Add the item to our layout data
      legendItems.push({
        emotion,
        x: rowX,
        y: rowY,
        width: itemWidth,
        height: itemHeight
      });
      
      // Update position for the next item
      rowX += itemWidth + itemPadding;
      maxRowHeight = Math.max(maxRowHeight, itemHeight);
    });
    
    // Create tooltip div if it doesn't exist
    let tooltip = d3.select("body").select(".legend-tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div")
        .attr("class", "legend-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0,0,0,0.7)")
        .style("color", "white")
        .style("padding", "5px 8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", 1000);
    }
    
    // Add "Clear All" button in bottom right corner
    const clearButton = legendGroup.append("g")
      .attr("class", "clear-button")
      .attr("transform", `translate(${availableWidth - 40}, ${legendHeight - 18})`)
      .style("cursor", "pointer")
      .style("opacity", 0.7);
    
    clearButton.append("rect")
      .attr("rx", 3)
      .attr("width", 40)
      .attr("height", 14)
      .attr("fill", "#f0f0f0")
      .attr("stroke", "#ccc");
      
    clearButton.append("text")
      .attr("x", 20)
      .attr("y", 10)
      .attr("text-anchor", "middle")
      .style("font-size", "8px")
      .text("Clear All");
    
    clearButton.on("click", () => {
      self.selectedEmotions = [];
      legendGroup.selectAll("[data-emotion] rect:not(.legend-item-bg)")
        .transition().duration(300)
        .attr("stroke-width", 1)
        .attr("transform", "scale(1)");
      legendGroup.selectAll("[data-emotion] text")
        .transition().duration(300)
        .style("font-weight", "500");
      
      d3.selectAll(".lines")
        .transition().duration(500)
        .style("opacity", 1);
    })
    .on("mouseover", function() {
      d3.select(this).style("opacity", 1);
    })
    .on("mouseout", function() {
      d3.select(this).style("opacity", 0.7);
    });
    
    // Second pass: render all legend items
    legendItems.forEach(item => {
      createLegendItem(item.emotion, item.x, item.y, item.width, item.height);
    });
    
    // Helper function to create a legend item
    function createLegendItem(emotion, x, y, width, height) {
      const legendItem = legendGroup.append("g")
        .attr("transform", `translate(${x}, ${y})`)
        .style("cursor", "pointer")
        .attr("data-emotion", emotion);
      
      // Background for hover effect
      legendItem.append("rect")
        .attr("class", "legend-item-bg")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .attr("rx", 3);
      
      // Color box
      legendItem.append("rect")
        .attr("width", 10) // Even smaller
        .attr("height", 10)
        .attr("x", 5)
        .attr("y", (height - 10) / 2) // Center vertically
        .attr("fill", emotionColors[emotion])
        .attr("rx", 1)
        .attr("stroke", "#000")
        .attr("stroke-width", 0.5);
      
      // Emotion label with non-selectable text
      legendItem.append("text")
        .attr("x", 20) // Position after color box
        .attr("y", height / 2 + 3) // Center vertically
        .style("font-size", "10px") // Even smaller font
        .style("font-weight", "500")
        .style("pointer-events", "none") // Prevent text from capturing mouse events
        .text(emotion);
    }
    
    // Add enhanced event handlers to all legend items
    legendGroup.selectAll("[data-emotion]")
      .on("mouseover", function(event) {
        const emotion = d3.select(this).attr("data-emotion");
        
        // Highlight background
        d3.select(this).select(".legend-item-bg")
          .transition().duration(200)
          .attr("fill", "rgba(0,0,0,0.05)");
        
        // Show tooltip with instructions
        const isSelected = self.selectedEmotions.includes(emotion);
        let tooltipText = isSelected ? 
          `Click to remove "${emotion}" filter` : 
          `Click to show only "${emotion}" data`;
        
        if (self.selectedEmotions.length > 0 && !isSelected) {
          tooltipText += ' • Shift+Click to add to filter';
        }
        
        tooltip.html(tooltipText)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 25) + "px")
          .transition().duration(200)
          .style("opacity", 0.9);
        
        // Highlight the corresponding line
        if (self.selectedEmotions.length === 0) {
          d3.selectAll(`.line-${emotion}`)
            .transition().duration(200)
            .attr("stroke-width", 6);
        }
      })
      .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 25) + "px");
      })
      .on("mouseout", function() {
        d3.select(this).select(".legend-item-bg")
          .transition().duration(200)
          .attr("fill", "transparent");
        
        tooltip.transition().duration(200)
          .style("opacity", 0);
        
        // Restore line thickness
        const emotion = d3.select(this).attr("data-emotion");
        if (self.selectedEmotions.length === 0) {
          d3.selectAll(`.line-${emotion}`)
            .transition().duration(200)
            .attr("stroke-width", 4);
        }
      })
      .on("click", function(event) {
        const clickedItem = d3.select(this);
        const emotionText = clickedItem.attr("data-emotion");
        
        // Hide tooltip after click
        tooltip.transition().duration(200)
          .style("opacity", 0);
        
        // Toggle selection logic
        if (event.shiftKey) {
          if (self.selectedEmotions.includes(emotionText)) {
            self.selectedEmotions = self.selectedEmotions.filter(e => e !== emotionText);
            clickedItem.select("rect:not(.legend-item-bg)")
              .transition().duration(300)
              .attr("stroke-width", 1)
              .attr("transform", "scale(1)");
            clickedItem.select("text")
              .transition().duration(300)
              .style("font-weight", "500");
          } else {
            self.selectedEmotions.push(emotionText);
            clickedItem.select("rect:not(.legend-item-bg)")
              .transition().duration(300)
              .attr("stroke-width", 2)
              .attr("transform", "scale(1.1)");
            clickedItem.select("text")
              .transition().duration(300)
              .style("font-weight", "bold");
          }
        } else {
          if (self.selectedEmotions.length === 1 && self.selectedEmotions[0] === emotionText) {
            self.selectedEmotions = [];
            legendGroup.selectAll("[data-emotion] rect:not(.legend-item-bg)")
              .transition().duration(300)
              .attr("stroke-width", 1)
              .attr("transform", "scale(1)");
            legendGroup.selectAll("[data-emotion] text")
              .transition().duration(300)
              .style("font-weight", "500");
          } else {
            legendGroup.selectAll("[data-emotion] rect:not(.legend-item-bg)")
              .transition().duration(300)
              .attr("stroke-width", 1)
              .attr("transform", "scale(1)");
            legendGroup.selectAll("[data-emotion] text")
              .transition().duration(300)
              .style("font-weight", "500");
            
            self.selectedEmotions = [emotionText];
            clickedItem.select("rect:not(.legend-item-bg)")
              .transition().duration(300)
              .attr("stroke-width", 2)
              .attr("transform", "scale(1.1)");
            clickedItem.select("text")
              .transition().duration(300)
              .style("font-weight", "bold");
          }
        }

        // Update line visibility based on selection
        if (self.selectedEmotions.length === 0) {
          d3.selectAll(".lines")
            .transition().duration(500)
            .style("opacity", 1);
        } else {
          d3.selectAll(".lines")
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
      });
  }

  /**
   * Highlight a specific sentence in the line chart
   * @param {number} index - The index of the sentence to highlight
   */
  highlightSentence(index) {
    if (!this.chartSvg || !this.data || index < 0 || index >= this.data.length) return;
    
    // Force clear any existing highlights first
    this.clearHighlight();
    
    // Store the current highlight index explicitly
    this.currentHighlightIndex = index;
    
    // Calculate the y-position for the highlight
    const yPos = this.y(index + 1);
    
    // Add a highlight rectangle across the chart width
    this.chartSvg.append("rect")
      .attr("class", "sentence-highlight")
      .attr("x", 0)
      .attr("y", yPos - 15) // Position slightly above the line to make it centered
      .attr("width", this.chartSvg.node().getBBox().width - 20) // Full width minus some padding
      .attr("height", 30) // Fixed height for highlight bar
      .attr("fill", "rgba(80, 80, 80, 0.2)") // Semi-transparent gray
      .attr("rx", 5) // Rounded corners
      .attr("ry", 5);
    
    // Highlight the y-axis tick for the selected sentence
    this.chartSvg.selectAll(".y-axis .tick")
      .filter(d => d === index + 1)  // Match the tick for the selected sentence
      .select("text")
      .attr("class", "highlighted-tick")
      .style("font-weight", "bold")
      .style("fill", "#2196F3")  // Blue color for highlighting 
      
    // Ensure the highlighted sentence is visible by scrolling to it
    this.scrollToSentence(index, true);
  }

  /**
   * Clear any sentence highlighting
   */
  clearHighlight() {
    if (!this.chartSvg) return;
    
    // Remove highlight elements
    this.chartSvg.selectAll(".sentence-highlight").remove();
    
    // Reset the y-axis tick styling
    this.chartSvg.selectAll(".y-axis .tick text")
      .style("font-weight", "normal")
      .style("fill", "#000")
      .style("font-size", "10px")
      .classed("highlighted-tick", false);
    
    // Reset the current highlight index
    this.currentHighlightIndex = null;
  }

  /**
   * Scroll the line chart to show a specific sentence
   * @param {number} index - The index of the sentence to scroll to
   * @param {boolean} immediate - Whether to scroll without animation
   */
  scrollToSentence(index, immediate = false) {
    const chartContainer = d3.select(this.containerSelector).select(".chart-container");
    if (!chartContainer.node()) return;
    
    // Calculate the container's visible height
    const containerHeight = chartContainer.node().clientHeight;
    
    // Calculate the target scroll position to center the sentence in the view
    const rowHeight = 30;
    const sentencePosition = index * rowHeight;
    
    // Position the sentence in the middle of the visible area
    const targetScrollTop = sentencePosition - (containerHeight / 2) + (rowHeight / 2);
    
    // Ensure we don't scroll beyond content bounds
    const maxScrollTop = chartContainer.node().scrollHeight - containerHeight;
    const safeScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
    
    if (immediate) {
      // Scroll immediately without animation
      chartContainer.node().scrollTop = safeScrollTop;
    } else {
      // Smooth scroll with animation
      d3.select(chartContainer.node())
        .transition()
        .duration(500)
        .tween("scrollToSentence", function() {
          const node = this;
          const startScrollTop = node.scrollTop;
          const distance = safeScrollTop - startScrollTop;
          return function(t) {
            node.scrollTop = startScrollTop + (distance * t);
          };
        });
    }
  }
  
  /**
   * Scroll the line chart to show a range of sentences
   * @param {number} firstIndex - The index of the first sentence to show
   * @param {number} lastIndex - The index of the last sentence to show
   */
  scrollToVisibleRange(firstIndex, lastIndex) {
    const chartContainer = d3.select(this.containerSelector).select(".chart-container");
    if (!chartContainer.node()) return;
    
    const rowHeight = 30;
    const containerHeight = chartContainer.node().clientHeight;
    
    // Calculate the ideal target scroll position (center the visible range)
    const rangeHeight = (lastIndex - firstIndex + 1) * rowHeight;
    const targetMidpoint = (firstIndex + (lastIndex - firstIndex) / 2) * rowHeight;
    const targetScrollTop = targetMidpoint - (containerHeight / 2) + (rowHeight / 2);
    
    // Ensure we don't scroll beyond content bounds
    const maxScrollTop = chartContainer.node().scrollHeight - containerHeight;
    const safeScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
    
    // Set scroll position immediately without animation
    chartContainer.node().scrollTop = safeScrollTop;
  }
}