export default class LineChartModule {
  constructor(containerSelector, emotions, emotionColors) {
    this.containerSelector = containerSelector;
    this.emotions = emotions;
    this.emotionColors = emotionColors;
    this.selectedEmotions = [];
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

    const legendHeight = 80;
    const legendSvg = legendContainer.append("svg")
      .attr("class", "legend-svg")
      .attr("viewBox", `0 0 ${chartWidth} ${legendHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", `${legendHeight}px`);

    this.drawLegend(legendSvg, chartWidth, legendHeight);
  }

  drawLegend(legendSvg, chartWidth, legendHeight) {
    // Calculate optimal layout based on emotion count
    const numCols = Math.min(4, this.emotions.length); // Max 4 items per row
    const numRows = Math.ceil(this.emotions.length / numCols);
    const rowHeight = legendHeight / numRows;
    const colWidth = chartWidth / numCols;
    const padding = { x: 20, y: 15 }; // Increased padding for better spacing

    const legendGroup = legendSvg.append("g")
      .attr("transform", `translate(${padding.x},${padding.y})`);

    this.emotions.forEach((emotion, i) => {
      const col = i % numCols;
      const row = Math.floor(i / numCols);
      const x = col * colWidth;
      const y = row * rowHeight;

      const legendItem = legendGroup.append("g")
        .attr("transform", `translate(${x}, ${y})`)
        .style("cursor", "pointer");

      // Create a background rect for hover effect
      legendItem.append("rect")
        .attr("class", "legend-item-bg")
        .attr("x", -padding.x/2)
        .attr("y", -padding.y/2)
        .attr("width", colWidth - padding.x)
        .attr("height", rowHeight - padding.y)
        .attr("fill", "transparent")
        .attr("rx", 4); // Rounded corners

      // Color box
      legendItem.append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("fill", this.emotionColors[emotion])
        .attr("rx", 2) // Slightly rounded corners
        .attr("stroke", "#000")
        .attr("stroke-width", 1);

      // Emotion label
      legendItem.append("text")
        .attr("x", 20)
        .attr("y", 11)
        .style("font-size", "13px")
        .style("font-weight", "500")
        .text(emotion);

      // Existing hover and click handlers with improved visual feedback
      legendItem
        .on("mouseover", function() {
          d3.select(this).select(".legend-item-bg")
            .transition().duration(200)
            .attr("fill", "rgba(0,0,0,0.05)");
        })
        .on("mouseout", function() {
          d3.select(this).select(".legend-item-bg")
            .transition().duration(200)
            .attr("fill", "transparent");
        })
        .on("click", (event) => {
          // Toggle selection logic.
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
  
          if (this.selectedEmotions.length === 0) {
            d3.selectAll(".lines")
              .transition().duration(500)
              .style("opacity", 1);
          } else {
            d3.selectAll(".lines")
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
    });
  }
}
