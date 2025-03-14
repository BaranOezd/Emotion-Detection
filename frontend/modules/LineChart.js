export default class LineChartModule {
    constructor(containerSelector, emotions, emotionColors) {
      this.containerSelector = containerSelector;
      this.emotions = emotions;
      this.emotionColors = emotionColors;
      this.selectedEmotions = [];
    }
  
    render(data) {
      // Clear the container
      const container = d3.select(this.containerSelector);
      container.html("");
  
      // Set margins and dimensions
      const margin = { top: 20, right: 30, bottom: 100, left: 40 };
      const width = container.node().clientWidth - margin.left - margin.right;
      const height = container.node().clientHeight - margin.top - margin.bottom;
  
      // Create SVG
      const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
  
      // Define x and y scales
      const x = d3.scaleLinear()
        .domain([1, data.length])
        .range([0, width]);
  
      const y = d3.scaleLinear()
        .domain([0, 1])
        .nice()
        .range([height, 0]);
  
      // Append x-axis
      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(data.length).tickFormat(d => `${d}`));
  
      // Append y-axis
      svg.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1f")));
  
      // Draw a line for each emotion
      this.emotions.forEach(emotion => {
        const line = d3.line()
          .x((d, i) => x(i + 1))
          .y(d => y(+d.emotions[emotion] || 0))
          .curve(d3.curveBasis);
  
        svg.append("path")
          .datum(data)
          .attr("class", `line-${emotion} lines`)
          .attr("fill", "none")
          .attr("stroke", this.emotionColors[emotion] || "#000")
          .attr("stroke-width", 4)
          .attr("d", line);
      });
  
      // Add an integrated legend below the chart
      const legendGroup = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width / 2}, ${height + 30})`);
  
      const legendSpacing = 100;
      this.emotions.forEach((emotion, i) => {
        const legendItem = legendGroup.append("g")
          .attr("transform", `translate(${(i - this.emotions.length / 2) * legendSpacing}, 0)`)
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
  }
  