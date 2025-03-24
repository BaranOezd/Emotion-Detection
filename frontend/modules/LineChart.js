export default class LineChartModule {
  constructor(containerSelector, emotions, emotionColors) {
    this.containerSelector = containerSelector;
    this.emotions = emotions;
    this.emotionColors = emotionColors;
    this.selectedEmotions = [];
  }

  // Render function that creates separate sub-containers for the chart and legend.
  render(data) {
    const container = d3.select(this.containerSelector);
    container.html("");

    // Create sub-containers: one for the chart (scrollable) and one for the legend (always visible)
    const chartContainer = container.append("div")
      .attr("class", "chart-container");
    const legendContainer = container.append("div")
      .attr("class", "legend-container");

    // Get container width (the container's height is controlled by CSS)
    const fullWidth = container.node().clientWidth;
    
    // Compute natural chart height based on data (e.g., 30px per data row)
    const rowHeight = 30;
    const dynamicChartHeight = data.length * rowHeight;
    
    // Define margins for the chart
    const margin = { top: 0, right: 20, bottom: 20, left: 20 };
    const totalChartHeight = dynamicChartHeight + margin.top + margin.bottom;
    const chartWidth = fullWidth - margin.left - margin.right;

    // Create the chart SVG inside the scrollable chart container.
    const chartSvg = chartContainer.append("svg")
      .attr("class", "chart-svg")
      .attr("viewBox", `0 0 ${chartWidth + margin.left + margin.right} ${totalChartHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      // The SVG’s height is set naturally, which may exceed the visible area.
      .style("height", `${totalChartHeight}px`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales.
    const x = d3.scaleLinear().domain([0, 1]).nice().range([chartWidth, 0]);
    const y = d3.scalePoint()
      .domain(data.map((_, i) => i + 1))
      .range([0, dynamicChartHeight])
      .padding(0);
    const yCenter = d => y(d);

    // Draw axes.
    chartSvg.append("g")
      .attr("transform", `translate(0, ${dynamicChartHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".1f")));
    chartSvg.append("g")
      .attr("transform", `translate(${chartWidth}, 0)`)
      .call(d3.axisRight(y).tickFormat(d => d));

    // Draw each emotion line.
    this.emotions.forEach(emotion => {
      const points = data.map((d, i) => ({
        x: x(+d.emotions[emotion] || 0),
        y: yCenter(i + 1)
      }));
      // Duplicate first and last points for smooth edges.
      const augmentedPoints = [points[0], ...points, points[points.length - 1]];

      const line = d3.line()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3.curveBasis);

      chartSvg.append("path")
        .datum(augmentedPoints)
        .attr("class", `line-${emotion} lines`)
        .attr("fill", "none")
        .attr("stroke", this.emotionColors[emotion] || "#000")
        .attr("stroke-width", 4)
        .attr("d", line);
    });

    // Create the legend SVG inside the fixed legend container.
    const legendHeight = 80; // Fixed height for legend.
    const legendSvg = legendContainer.append("svg")
      .attr("class", "legend-svg")
      .attr("viewBox", `0 0 ${chartWidth} ${legendHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", `${legendHeight}px`);

    this.drawLegend(legendSvg, chartWidth, legendHeight);
  }

  // Legend drawing remains unchanged.
  drawLegend(legendSvg, chartWidth, legendHeight) {
    const numRows = 3; // Fixed 3 rows.
    const numCols = Math.ceil(this.emotions.length / numRows);
    const rowHeight = legendHeight / numRows;
    const colSpacing = chartWidth / numCols;
    const legendPaddingX = 10;

    const legendGroup = legendSvg.append("g")
      .attr("transform", "translate(0,0)");

    this.emotions.forEach((emotion, i) => {
      const row = i % numRows;
      const col = Math.floor(i / numRows);
      const x = col * colSpacing + legendPaddingX;
      const y = row * rowHeight;

      const legendItem = legendGroup.append("g")
        .attr("transform", `translate(${x}, ${y})`)
        .style("cursor", "pointer")
        .on("mouseover", function() {
          d3.select(this).select("rect")
            .transition().duration(200)
            .attr("opacity", 0.7);
        })
        .on("mouseout", function() {
          d3.select(this).select("rect")
            .transition().duration(200)
            .attr("opacity", 1);
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

      legendItem.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", this.emotionColors[emotion])
        .attr("stroke", "#000");

      legendItem.append("text")
        .attr("x", 16)
        .attr("y", 10)
        .style("font-size", "12px")
        .text(emotion);
    });
  }
}
