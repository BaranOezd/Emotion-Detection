export default class LineChartModule {
  constructor(containerSelector, emotions, emotionColors) {
    this.containerSelector = containerSelector;
    this.emotions = emotions;
    this.emotionColors = emotionColors;
    this.selectedEmotions = [];
    this.currentHighlightIndex = null; // Add property to track currently highlighted sentence
  }

  // Modify the render method
  render(data) {
    // Skip rendering if element is not visible (simple mode)
    if (document.getElementById("linechart").style.display === "none") {
      return;
    }
    
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

    // X-axis SVG - ensure exact same transformation as main chart for horizontal alignment
    const xAxisSvg = xAxisContainer.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .append("g")
      .attr("transform", `translate(${margin.left},0)`);

    // Create a linear scale with exact domain values and no rounding
    const x = d3.scaleLinear()
      .domain([0, 1])
      .range([0, chartWidth]);
    
    // Create a dynamic y scale based on data length
    const y = d3.scalePoint()
      .domain(data.length > 0 ? data.map((_, i) => i + 1) : [1]) // Handle empty data
      .range([0, dynamicChartHeight])
      .padding(0.); // Maximum padding to create extremely wide gaps between rows

    // Define exact percentage values for ticks (use same values for both grid and axis)
    const xTickValues = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    
    // For debugging: Store these calculated positions in instance variables
    this.debugTickPositions = xTickValues.map(d => ({
      value: d,
      pixelPos: Math.round(x(d))  // Round to integer pixels for perfect alignment
    }));
    
    // UNIFIED APPROACH: Create both grid lines and axis in a single group
    // This ensures they share exactly the same coordinate space
    const combinedAxisGroup = chartSvg.append("g")
      .attr("class", "combined-axis-group");
    
    // 1. Add the horizontal axis line - make it more visible
    combinedAxisGroup.append("line")
      .attr("class", "axis-baseline")
      .attr("x1", 0)
      .attr("x2", chartWidth)
      .attr("y1", dynamicChartHeight) // Position at bottom of chart
      .attr("y2", dynamicChartHeight)
      .attr("stroke", "black")
      .attr("stroke-width", 1.5); // Make the line slightly thicker
    
    // 2. Create tick marks and grid lines together
    this.debugTickPositions.forEach(tick => {
      // Create a group for each tick position
      const tickGroup = combinedAxisGroup.append("g")
        .attr("class", "tick-group")
        .attr("transform", `translate(${tick.pixelPos}, 0)`);
      
      // Add the vertical grid line from top to bottom
      tickGroup.append("line")
        .attr("class", "grid-line")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", 0)
        .attr("y2", dynamicChartHeight)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "3,3")
        .attr("stroke-width", 1);
      
      // Add the tick mark at the bottom
      tickGroup.append("line")
        .attr("class", "tick-line")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", dynamicChartHeight)
        .attr("y2", dynamicChartHeight + 4) // Slightly shorter ticks
        .attr("stroke", "black");
      
      // Add the tick label 
      tickGroup.append("text")
        .attr("class", "tick-label")
        .attr("x", 0)
        .attr("y", dynamicChartHeight + 9)
        .attr("dy", "0.71em")
        .attr("text-anchor", "middle")
        .style("font-size", "11px") 
        .text(`${Math.round(tick.value * 100)}%`);
    });
    
    // Now the x-axis container only needs to show the labels by cloning them
    // Create a mirrored version of the axis labels in the bottom container with smaller font
    const xAxisLabels = xAxisSvg.append("g")
      .attr("class", "x-axis-labels")
      .attr("transform", `translate(0, 0)`);
      
    // Add a horizontal line at the top of the x-axis container for better separation
    xAxisLabels.append("line")
      .attr("x1", 0)
      .attr("x2", chartWidth)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", "#000")
      .attr("stroke-width", 1);
      
    this.debugTickPositions.forEach(tick => {
      xAxisLabels.append("text")
        .attr("class", "tick-label-mirror")
        .attr("x", tick.pixelPos)
        .attr("y", 9)
        .attr("dy", "0.71em")
        .attr("text-anchor", "middle")
        .style("font-size", "11px") // Increased from 9px to 11px
        .text(`${Math.round(tick.value * 100)}%`);
    });

    // Hide the original ticks to avoid duplication
    combinedAxisGroup.selectAll(".tick-label").style("opacity", 0);

    // Add y-axis to the main chart
    chartSvg.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(0, 0)`) // Align y-axis with the 0 point of x-axis
      .call(d3.axisLeft(y).tickFormat(() => "")); 

    // Check if we have data before trying to draw emotion lines
    if (data.length > 0) {
      // Add bidirectional highlighting - add this before drawing emotion lines
      this.addSentenceInteractionAreas(chartSvg, data, x, y, dynamicChartHeight, rowHeight);
      
      this.emotions.forEach(emotion => {
        const points = data.map((d, i) => ({
          x: x(+d.emotions[emotion] || 0),
          y: y(i + 1)
        }));

        // Use a more reliable curve that balances accuracy and aesthetics
        const line = d3.line()
          .x(d => d.x)
          .y(d => d.y)
          .curve(d3.curveMonotoneY); // Reliable curve that preserves data points

        // Create a single clean line with appropriate thickness
        const path = chartSvg.append("path")
          .datum(points)
          .attr("class", `line-${emotion} lines`)
          .attr("fill", "none")
          .attr("stroke", this.emotionColors[emotion] || "#000")
          .attr("stroke-width", 4) // Increased line thickness for better visibility
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

    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const containerHeight = entry.contentRect.height;
        const containerWidth = entry.contentRect.width;

        // Log resize events for debugging
        //console.log("Resize detected:", { height: containerHeight, width: containerWidth });

        // Only update if container dimensions have changed significantly (threshold: 20px)
        if (Math.abs(containerHeight - this._lastContainerHeight) > 20 ||
            Math.abs(containerWidth - this._lastContainerWidth) > 20) {

          this._lastContainerHeight = containerHeight;
          this._lastContainerWidth = containerWidth;

          const newHeight = Math.max(initialHeight, containerHeight);

          const svgElement = chartSvg.node().parentNode;
          if (svgElement) {
            d3.select(svgElement)
              .style("height", `${newHeight}px`)
              .attr("height", newHeight);
          }

          // Debounce re-render to avoid frequent updates
          clearTimeout(this._resizeTimer);
          this._resizeTimer = setTimeout(() => {
            if (this.data && this.data.length > 0 && this.data.length < 10 &&
                containerHeight > initialHeight + 50) {
              console.log("LineChart: Container resize triggered re-render");
              this.render(this.data);
            }
          }, 1500); // Increased debounce delay to 1500ms for significant slowdown
        }
      }
    });
    
    this._lastContainerHeight = chartContainer.node().clientHeight;
    this._lastContainerWidth = chartContainer.node().clientWidth;

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
    // Skip highlighting if in simple mode
    if (document.getElementById("linechart").style.display === "none") {
      return;
    }
    
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
      .attr("x", 0)  // Start from the left edge of the transformed coordinate system
      .attr("y", yPos - 20) // Increased vertical offset for the wider spacing
      .attr("width", this.x.range()[1]) // Use the exact width from the x scale range
      .attr("height", 40) // Increased height for highlight bar
      .attr("fill", "rgba(80, 80, 80, 0.2)") // Semi-transparent gray
      .attr("rx", 6) // Slightly increased rounded corners
      .attr("ry", 6)
      .style("pointer-events", "none") // Allow interaction with elements above
      .lower(); // Move highlight to back
    
    // Highlight the y-axis tick for the selected sentence
    this.chartSvg.selectAll(".y-axis .tick")
      .filter(d => d === index + 1)  // Match the tick for the selected sentence
      .select("text")
      .attr("class", "highlighted-tick")
      .style("font-weight", "bold")
      .style("fill", "#2196F3");  // Blue color for highlighting 
      
    // Check if the highlighted sentence is already visible in the current view
    // If not, scroll to make it visible but with smarter positioning
    this.scrollToSentenceIfNeeded(index);
  }

  /**
   * Scrolls to the sentence only if it's not already fully visible in the view
   * @param {number} index - The index of the sentence to check and potentially scroll to
   */
  scrollToSentenceIfNeeded(index) {
    const chartContainer = d3.select(this.containerSelector).select(".chart-container");
    if (!chartContainer.node()) return;
    
    // Get the current scroll position and viewport height
    const scrollTop = chartContainer.node().scrollTop;
    const viewportHeight = chartContainer.node().clientHeight;
    
    // Calculate the position of the target sentence
    const sentencePosition = index * this.rowHeight;
    
    // Determine if the sentence is already fully visible
    const isBelowViewport = sentencePosition > (scrollTop + viewportHeight - this.rowHeight);
    const isAboveViewport = sentencePosition < scrollTop;
    
    if (!isBelowViewport && !isAboveViewport) {
      // If sentence is already visible, don't scroll
      return;
    }
    
    // Determine scroll position based on where the sentence is relative to viewport
    let targetScrollTop;
    
    if (isBelowViewport) {
      // If sentence is below, position it 1/3 from the bottom of the viewport
      targetScrollTop = sentencePosition - viewportHeight + this.rowHeight + (viewportHeight / 3);
    } else {
      // If sentence is above, position it 1/3 from the top of the viewport
      targetScrollTop = sentencePosition - (viewportHeight / 3);
    }
    
    // Ensure we don't scroll beyond content bounds
    const maxScrollTop = chartContainer.node().scrollHeight - viewportHeight;
    const safeScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
    
    // Smooth scroll with animation
    d3.select(chartContainer.node())
      .transition()
      .duration(300) // Faster transition for less disruption
      .ease(d3.easeCubicOut) // Smoother easing
      .tween("scrollToSentence", function() {
        const node = this;
        const startScrollTop = node.scrollTop;
        const distance = safeScrollTop - startScrollTop;
        return function(t) {
          node.scrollTop = startScrollTop + (distance * t);
        };
      });
  }

  /**
   * Scroll the line chart to show a specific sentence
   * This method is kept for backward compatibility but modified to use the new approach
   * @param {number} index - The index of the sentence to scroll to
   * @param {boolean} immediate - Whether to scroll without animation
   */
  scrollToSentence(index, immediate = false) {
    // If immediate is true, we still use the centered approach for consistency with existing calls
    if (immediate) {
      const chartContainer = d3.select(this.containerSelector).select(".chart-container");
      if (!chartContainer.node()) return;
      
      // Calculate the container's visible height
      const containerHeight = chartContainer.node().clientHeight;
      
      // Position the sentence in the middle of the visible area
      const sentencePosition = index * this.rowHeight;
      const targetScrollTop = sentencePosition - (containerHeight / 2) + (this.rowHeight / 2);
      
      // Ensure we don't scroll beyond content bounds
      const maxScrollTop = chartContainer.node().scrollHeight - containerHeight;
      const safeScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
      
      // Scroll immediately without animation
      chartContainer.node().scrollTop = safeScrollTop;
    } else {
      // Use the new smarter scrolling for non-immediate scrolls
      this.scrollToSentenceIfNeeded(index);
    }
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

  /**
   * Adds interactive areas for each sentence in the chart
   */
  addSentenceInteractionAreas(chartSvg, data, x, y, chartHeight, rowHeight) {
    const self = this;
    
    // Remove any existing interaction areas first
    chartSvg.selectAll(".sentence-hit-area").remove();
    
    // Create interactive rectangles for each sentence row
    const hitAreas = chartSvg.append("g")
      .attr("class", "sentence-interaction-areas");
    
    data.forEach((d, i) => {
      hitAreas.append("rect")
        .attr("class", "sentence-hit-area")
        .attr("x", 0)
        .attr("y", y(i + 1) - rowHeight/2)
        .attr("width", x.range()[1])
        .attr("height", rowHeight)
        .attr("fill", "transparent")
        .style("cursor", "pointer")
        .on("click", function(event) {
          // Prevent event propagation
          event.stopPropagation();
          
          // Clear any existing highlights first
          self.clearHighlight();
          
          // Highlight this sentence in the chart
          self.highlightSentence(i);
          
          // Check if we have a valid callback and call it
          if (typeof self.onSentenceSelectCallback === 'function') {
            // Log successful callback invocation
            self.onSentenceSelectCallback(i);
          } else {
            // If no callback is registered, attempt to auto-register with MainController
            console.warn('LineChart: No sentence selection callback registered.');
            self._attemptAutoRegistration(i);
          }
        })
        .on("mouseover", function() {
          // Add subtle hover effect
          d3.select(this).attr("fill", "rgba(0,0,0,0.05)");
        })
        .on("mouseout", function() {
          // Remove hover effect
          d3.select(this).attr("fill", "transparent");
        });
    });
  }

  /**
   * Attempt to automatically find and use an appropriate callback in the MainController
   * @private
   * @param {number} index - The index of the selected sentence
   */
  _attemptAutoRegistration(index) {
    try {
      // Try to find the text editor and trigger a sentence selection
      const textEditor = document.querySelector("#textEditor");
      if (textEditor) {
        const sentences = textEditor.querySelectorAll(".highlighted-sentence");
        if (sentences.length > 0 && sentences[index]) {
          console.log("LineChart: Auto-triggering sentence selection in text editor");
          sentences[index].click();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("LineChart: Auto-registration failed", error);
      return false;
    }
  }

  /**
   * Register a callback to be called when a sentence is selected in the chart
   * This method ensures the callback is properly set
   * @param {Function} callback - Function to call with the selected sentence index
   * @returns {boolean} - Whether the callback was successfully registered
   */
  onSentenceSelect(callback) {
    if (typeof callback !== 'function') {
      console.error('LineChart: onSentenceSelect requires a function parameter');
      return false;
    }
    
    this.onSentenceSelectCallback = callback;
    console.log('LineChart: Sentence selection callback registered successfully');
    return true;
  }

  /**
   * Initialize the chart with data and all required callbacks
   * @param {Array} data - The emotion data to render
   * @param {Function} sentenceSelectCallback - Optional callback for sentence selection
   */
  initialize(data, sentenceSelectCallback) {
    // Register the sentence selection callback if provided
    if (typeof sentenceSelectCallback === 'function') {
      this.onSentenceSelect(sentenceSelectCallback);
    }
    
    // Render the chart with the provided data
    this.render(data);
  }

  /**
   * Register a callback to be called when a sentence is selected in the chart
   * @param {Function} callback - Function to call with the selected sentence index
   */
  onSentenceSelect(callback) {
    this.onSentenceSelectCallback = callback;
  }

  /**
   * Register a callback to be called when the chart is scrolled
   * @param {Function} callback - Function to call with the visible range
   */
  onScroll(callback) {
    this.onScrollCallback = callback;
  }
}