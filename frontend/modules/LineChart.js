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
    const availableHeight = container.node().clientHeight - 30; // Subtract x-axis height
    const margin = { top: 0, right: 20, bottom: 0, left: 20 };
    const chartWidth = fullWidth - margin.left - margin.right;

    // Calculate dynamic row height to better utilize available space
    const minRowHeight = 30; // Minimum height per row
    const maxRowHeight = 120; // Maximum height per row - increased to allow for significant expansion
    let rowHeight = minRowHeight;
    
    // Always try to fill at least 90% of the available height
    const targetHeight = Math.max(300, availableHeight * 0.9);
    
    if (data.length > 0) {
      // Calculate row height to fill the target height
      rowHeight = Math.min(maxRowHeight, targetHeight / data.length);
      // Ensure row height is at least the minimum
      rowHeight = Math.max(minRowHeight, rowHeight);
      
      console.log(`LineChart: ${data.length} sentences, rowHeight=${rowHeight}px, availableHeight=${availableHeight}px`);
    }
    
    // Calculate total chart height based on row height and data length
    const dynamicChartHeight = data.length > 0 
      ? data.length * rowHeight 
      : Math.max(300, availableHeight); // Default height if no data
    
    const totalChartHeight = dynamicChartHeight + margin.top;

    // Main chart SVG with responsive attributes
    const chartSvg = chartContainer.append("svg")
      .attr("class", "chart-svg")
      .attr("viewBox", `0 0 ${chartWidth + margin.left + margin.right} ${totalChartHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "100%") // Make height responsive
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X-axis SVG
    const xAxisSvg = xAxisContainer.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .append("g")
      .attr("transform", `translate(${margin.left},0)`);

    const x = d3.scaleLinear().domain([0, 1]).nice().range([0, chartWidth]); // Adjust range to start from 0
    
    // Create a dynamic y scale based on data length
    const y = d3.scalePoint()
      .domain(data.length > 0 ? data.map((_, i) => i + 1) : [1]) // Handle empty data
      .range([0, dynamicChartHeight])
      .padding(0.1); // Add some padding to prevent lines touching container edges

    // Add x-axis to the fixed container
    xAxisSvg.append("g")
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".1f")));

    // Add y-axis to the main chart
    chartSvg.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(0, 0)`) // Align y-axis with the 0 point of x-axis
      .call(d3.axisLeft(y).tickFormat(d => d));

    // Check if we have data before trying to draw emotion lines
    if (data.length > 0) {
      this.emotions.forEach(emotion => {
        const points = data.map((d, i) => ({
          x: x(+d.emotions[emotion] || 0),
          y: y(i + 1)
        }));

        const line = d3.line()
          .x(d => d.x)
          .y(d => d.y)
          .curve(d3.curveBasis);

        const path = chartSvg.append("path")
          .datum(points)
          .attr("class", `line-${emotion} lines`)
          .attr("fill", "none")
          .attr("stroke", this.emotionColors[emotion] || "#000") // Use the updated emotion colors
          .attr("stroke-width", 4)
          .attr("d", line);

        // Add hover functionality to display the emotion name
        path.on("mouseover", function (event) {
          // Ensure any existing tooltip is removed before creating a new one
          d3.select(".line-tooltip").remove();

          const tooltip = d3.select("body").append("div")
            .attr("class", "line-tooltip")
            .style("position", "absolute")
            .style("background", "#fff")
            .style("border", "1px solid #ccc")
            .style("border-radius", "4px")
            .style("padding", "5px")
            .style("pointer-events", "none")
            .style("font-size", "12px")
            .style("opacity", 0);

          tooltip.html(emotion)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 20) + "px")
            .transition()
            .duration(200)
            .style("opacity", 0.9);
        })
        .on("mousemove", function (event) {
          d3.select(".line-tooltip")
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function () {
          // Properly remove the tooltip on mouseout
          d3.select(".line-tooltip")
            .transition()
            .duration(200)
            .style("opacity", 0)
            .remove();
        });
      });
    } else {
      // If no data, show a message
      chartSvg.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", dynamicChartHeight / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text("No data available");
    }

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
    this.chartHeight = dynamicChartHeight;
    this.rowHeight = rowHeight; // Store calculated row height for scrolling calculations
    
    // If there was a highlighted sentence, restore it after re-rendering
    if (this.currentHighlightIndex !== null && this.currentHighlightIndex < data.length) {
      this.highlightSentence(this.currentHighlightIndex);
    }
    
    // Add resize handler to ensure chart fills available space
    this._setupResizeHandler(chartContainer, chartSvg, totalChartHeight, wrapper);

    // Ensure the chart container's scroll event works with the existing synchronization logic
    chartContainer.on("scroll", () => {
      const scrollTop = chartContainer.node().scrollTop;
      const visibleRange = this.getVisibleRange(scrollTop, chartContainer.node().clientHeight);
      if (this.onScrollCallback) {
        this.onScrollCallback(visibleRange);
      }
    });
  }

  _setupResizeHandler(chartContainer, chartSvg, initialHeight, wrapper) {
    // Clean up any previous resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    // Create a new resize observer to handle container size changes
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const containerHeight = entry.contentRect.height;
        const containerWidth = entry.contentRect.width;
        
        // Only update if container dimensions have changed significantly
        if (Math.abs(containerHeight - this._lastContainerHeight) > 10 ||
            Math.abs(containerWidth - this._lastContainerWidth) > 10) {
          
          // Store new dimensions
          this._lastContainerHeight = containerHeight;
          this._lastContainerWidth = containerWidth;
          
          // Calculate new height that uses the full available space
          const newHeight = Math.max(initialHeight, containerHeight);
          
          // Update the SVG parent's height to fill the available space
          // Fix: Access the SVG element correctly (chartSvg is a group inside SVG)
          const svgElement = chartSvg.node().parentNode; // Get the SVG element
          if (svgElement) {
            d3.select(svgElement) // Create a D3 selection from the SVG element
              .style("height", `${newHeight}px`)
              .attr("height", newHeight);
          }

          // If we have few data points, trigger a complete re-render to better use the space
          if (this.data && this.data.length > 0 && this.data.length < 10 && 
              containerHeight > initialHeight + 50) { // Only re-render if significant height change
            // Use setTimeout to avoid multiple rapid re-renders
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
              console.log("LineChart: Container resize triggered re-render");
              this.render(this.data);
            }, 300);
          }
        }
      }
    });
    
    // Store initial dimensions
    this._lastContainerHeight = chartContainer.node().clientHeight;
    this._lastContainerWidth = chartContainer.node().clientWidth;
    
    // Start observing the container
    this.resizeObserver.observe(wrapper.node());
  }

  drawLegend(legendSvg, chartWidth, legendHeight) {
    const padding = { x: 15, y: 10 };
    const emotionColors = this.emotionColors;
    const self = this;

    // Clear any existing legend content
    legendSvg.html("");

    // Create a scrollable container for the legend
    const legendContainer = d3.select("#lineChartLegend")
      .style("overflow-y", "auto") // Enable vertical scrolling
      .style("max-height", "150px") // Limit the height of the legend
      .style("display", "grid") // Use grid layout for items
      .style("grid-template-columns", "repeat(auto-fit, minmax(120px, 1fr))") // Responsive grid
      .style("gap", "10px") // Add spacing between items
      .style("padding", "10px"); // Add padding inside the container

    // Add legend items for each emotion
    this.emotions.forEach(emotion => {
      const legendItem = legendContainer.append("div")
        .attr("class", "legend-item")
        .style("display", "flex")
        .style("align-items", "center")
        .style("cursor", "pointer")
        .attr("data-emotion", emotion);

      // Add color box
      legendItem.append("div")
        .style("width", "15px")
        .style("height", "15px")
        .style("background-color", emotionColors[emotion])
        .style("border", "1px solid #000")
        .style("margin-right", "8px");

      // Add emotion label
      legendItem.append("span")
        .style("font-size", "12px")
        .style("font-weight", "500")
        .text(emotion);

      // Add click event for filtering
      legendItem.on("click", function (event) {
        const clickedEmotion = d3.select(this).attr("data-emotion");

        if (event.shiftKey) {
          // Shift+Click: Add or remove the emotion from the selected list
          if (self.selectedEmotions.includes(clickedEmotion)) {
            self.selectedEmotions = self.selectedEmotions.filter(e => e !== clickedEmotion);
          } else {
            self.selectedEmotions.push(clickedEmotion);
          }
        } else {
          // Regular Click: Toggle between showing only the clicked emotion or all emotions
          if (self.selectedEmotions.length === 1 && self.selectedEmotions[0] === clickedEmotion) {
            self.selectedEmotions = []; // Deselect all if the same emotion is clicked again
          } else {
            self.selectedEmotions = [clickedEmotion]; // Show only the clicked emotion
          }
        }

        // Update legend item opacity
        legendContainer.selectAll(".legend-item").each(function () {
          const emotion = d3.select(this).attr("data-emotion");
          d3.select(this).style("opacity", self.selectedEmotions.length === 0 || self.selectedEmotions.includes(emotion) ? 1 : 0.5);
        });

        // Update line visibility based on selection
        d3.selectAll(".lines")
          .transition().duration(500)
          .style("opacity", function () {
            const classes = d3.select(this).attr("class").split(" ");
            return self.selectedEmotions.length === 0 || self.selectedEmotions.some(sel => classes.includes(`line-${sel}`)) ? 1 : 0.1;
          });
      });
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
    
    // Use the stored row height for more accurate scrolling
    const sentencePosition = index * this.rowHeight;
    
    // Position the sentence in the middle of the visible area
    const targetScrollTop = sentencePosition - (containerHeight / 2) + (this.rowHeight / 2);
    
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
    
    // Use the stored row height for more accurate scrolling
    const containerHeight = chartContainer.node().clientHeight;
    
    // Calculate the ideal target scroll position (center the visible range)
    const rangeHeight = (lastIndex - firstIndex + 1) * this.rowHeight;
    const targetMidpoint = (firstIndex + (lastIndex - firstIndex) / 2) * this.rowHeight;
    const targetScrollTop = targetMidpoint - (containerHeight / 2) + (this.rowHeight / 2);
    
    // Ensure we don't scroll beyond content bounds
    const maxScrollTop = chartContainer.node().scrollHeight - containerHeight;
    const safeScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
    
    // Set scroll position immediately without animation
    chartContainer.node().scrollTop = safeScrollTop;
  }

  getVisibleRange(scrollTop, containerHeight) {
    // Calculate the first and last visible indices based on scroll position and container height
    const firstVisibleIndex = Math.floor(scrollTop / this.rowHeight);
    const lastVisibleIndex = Math.min(
        Math.ceil((scrollTop + containerHeight) / this.rowHeight) - 1,
        this.data.length - 1
    );

    return { firstVisibleIndex, lastVisibleIndex };
  }
}