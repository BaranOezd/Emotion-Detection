export default class LineChartModule {
  constructor(containerSelector, emotions, emotionColors) {
    this.containerSelector = containerSelector;
    this.emotions = emotions;
    this.emotionColors = emotionColors;
    this.selectedEmotions = [];
  }

  // Main render function to draw the chart.
  render(data) {
    const container = d3.select(this.containerSelector);
    container.html("");

    // Define margins and dimensions.
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const containerNode = container.node();
    const width = containerNode.clientWidth - margin.left - margin.right;
    const height = containerNode.clientHeight - margin.top - margin.bottom;

    // Create the main SVG element.
    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "100%")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales.
    const x = d3.scaleLinear().domain([0, 1]).nice().range([width, 0]);
    const y = d3.scalePoint()
  .domain(data.map((_, i) => i + 1))
  .range([0, height])
  .padding(0);  // ensures the points are flush with the range ends
  const yCenter = d => y(d);


    // Draw axes.
    svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".1f")));

    svg.append("g")
      .attr("transform", `translate(${width}, 0)`)
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

      svg.append("path")
        .datum(augmentedPoints)
        .attr("class", `line-${emotion} lines`)
        .attr("fill", "none")
        .attr("stroke", this.emotionColors[emotion] || "#000")
        .attr("stroke-width", 4)
        .attr("d", line);
    });

    // Create a legend group positioned above the chart.
    const legendGroup = svg.append("g")
      .attr("class", "legend")
      .attr("transform", "translate(0, -20)");

    this.drawLegend(legendGroup, width);
  }

  // Draw legend items and attach click events.
  drawLegend(legendGroup, chartWidth) {
    const legendPadding = 10;
    const legendItemWidth = 30;
    const totalLegendWidth = (legendItemWidth + legendPadding) * this.emotions.length;
    const availableWidth = chartWidth;
    const legendSpacing = availableWidth > totalLegendWidth
      ? (availableWidth - totalLegendWidth) / this.emotions.length + legendItemWidth + legendPadding
      : legendItemWidth + legendPadding;

    this.emotions.forEach((emotion, i) => {
      const legendItem = legendGroup.append("g")
        .attr("transform", `translate(${i * legendSpacing}, 0)`)
        .style("cursor", "pointer")
          .on("click", (event) => {
            // Toggle selection logic: shift for multiple selection, click for single selection
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
  
            // Update the opacity of lines based on selected emotions
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
  
        // Legend item rectangle and text
      legendItem.append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", this.emotionColors[emotion]);

      legendItem.append("text")
        .attr("x", 24)
        .attr("y", 14)
        .style("font-size", "12px")
        .text(emotion);
    });
  }

  // Handle legend click events, supporting both shift-click (multi-select) and regular click.
  handleLegendClick(event, emotion, legendGroup) {
    const isShift = event.shiftKey;

    if (isShift) {
      if (this.selectedEmotions.includes(emotion)) {
        this.selectedEmotions = this.selectedEmotions.filter(e => e !== emotion);
      } else {
        this.selectedEmotions.push(emotion);
      }
    } else {
      if (this.selectedEmotions.length === 1 && this.selectedEmotions[0] === emotion) {
        this.selectedEmotions = [];
      } else {
        this.selectedEmotions = [emotion];
      }
    }
    this.updateLegendStyles(legendGroup);
    this.updateLineOpacities();
  }

  // Update legend item styles based on selected emotions.
  updateLegendStyles(legendGroup) {
    legendGroup.selectAll("g")
      .each((d, i, nodes) => {
        const currentEmotion = this.emotions[i];
        const isSelected = this.selectedEmotions.includes(currentEmotion);
        d3.select(nodes[i]).select("rect")
          .transition().duration(300)
          .attr("stroke-width", isSelected ? 2 : 0)
          .attr("transform", isSelected ? "scale(1.1)" : "scale(1)");
        d3.select(nodes[i]).select("text")
          .transition().duration(300)
          .style("font-weight", isSelected ? "bold" : "normal");
      });
  }

  // Adjust the opacity of each line based on the current selection.
  updateLineOpacities() {
    d3.selectAll(".lines")
      .transition().duration(500)
      .style("opacity", function() {
        const classAttr = d3.select(this).attr("class") || "";
        const classes = classAttr.split(" ");
        // If no emotion is selected, display all lines normally.
        if (!this.selectedEmotions || this.selectedEmotions.length === 0) return 1;
        return this.selectedEmotions.some(sel => classes.includes(`line-${sel}`)) ? 1 : 0.1;
      }.bind(this)); // Bind this so that selectedEmotions can be referenced.
  }
}
