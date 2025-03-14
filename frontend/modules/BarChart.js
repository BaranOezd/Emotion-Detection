export default class BarChartModule {
  constructor(containerSelector, emotionColors, emotions) {
    this.containerSelector = containerSelector;
    this.emotionColors = emotionColors;
    this.emotions = emotions; 
    this.selectedEmotions = [];
  }

  clear() {
    d3.select(this.containerSelector).html("");
  }

  render(sentenceData, { onReset, onChangeSentence } = {}) {
    const barChartDiv = d3.select(this.containerSelector);
    barChartDiv.html("");

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

    const originalEmotions = Object.assign({}, sentenceData.emotions);
    if (!sentenceData.originalSentence) {
      sentenceData.originalSentence = sentenceData.sentence;
    }

    // Reset button
    barChartDiv.append("button")
      .attr("id", "resetButton")
      .text("Reset")
      .style("margin-bottom", "10px")
      .on("click", () => {
        sentenceData.emotions = Object.assign({}, originalEmotions);
        sentenceData.sentence = sentenceData.originalSentence;
        if (onReset && typeof onReset === "function") {
          onReset(sentenceData);
        }
        this.render(sentenceData, { onReset, onChangeSentence });
      });

    // Change Sentence button
    barChartDiv.append("button")
      .attr("id", "changeSentenceButton")
      .text("Change Sentence")
      .style("margin-left", "10px")
      .style("margin-bottom", "10px")
      .on("click", () => {
        if (onChangeSentence && typeof onChangeSentence === "function") {
          onChangeSentence(sentenceData);
        }
      });

    // Set up margins and dimensions
    const margin = { top: 40, right: 30, bottom: 100, left: 50 };
    const containerNode = barChartDiv.node();
    const width = containerNode.clientWidth - margin.left - margin.right;
    const height = containerNode.clientHeight - margin.top - margin.bottom;

    const svg = barChartDiv.append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "100%")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Instead of using this.emotions directly, get keys from sentenceData.emotions if needed.
    const emotions = this.emotions.length ? this.emotions : Object.keys(sentenceData.emotions);

    // Define scales
    const x = d3.scaleBand()
      .domain(emotions)
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, 1])
      .nice()
      .range([height, 0]);

    // Append axes
    const xAxis = svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));
    xAxis.selectAll("text")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .attr("dy", "1.5em");

    svg.append("g")
      .call(d3.axisLeft(y)
        .ticks(5)
        .tickValues([0, 0.2, 0.4, 0.6, 0.8, 1])
        .tickFormat(d => `${Math.round(d * 100)}%`));

    // Normalize emotion scores so that their sum equals 1
    let total = emotions.reduce((sum, emotion) => sum + (+sentenceData.emotions[emotion] || 0), 0);
    const emotionScores = emotions.map(emotion => {
      let raw = +sentenceData.emotions[emotion] || 0;
      let normalized = total > 0 ? raw / total : 0;
      return { emotion, score: normalized };
    });

    const minFraction = 0.03;
    const dynamicMinHeight = height - y(minFraction);

    const drag = d3.drag()
      .on("start", function(event, d) {
        d3.select(this).style("opacity", 0.7);
      })
      .on("drag", (event, d) => {
        let newY = Math.max(0, Math.min(event.y, height));
        let newScore = y.invert(newY);
        newScore = Math.round(newScore * 20) / 20;
        newScore = Math.max(0, Math.min(newScore, 1));

        sentenceData.emotions[d.emotion] = newScore;
        let total = 0;
        for (let key in sentenceData.emotions) {
          total += sentenceData.emotions[key];
        }
        for (let key in sentenceData.emotions) {
          sentenceData.emotions[key] = sentenceData.emotions[key] / total;
        }
        emotionScores.forEach(e => {
          e.score = sentenceData.emotions[e.emotion];
        });

        svg.selectAll(".bar")
          .data(emotionScores)
          .attr("y", d => {
            const computedHeight = height - y(d.score);
            return computedHeight < dynamicMinHeight ? height - dynamicMinHeight : y(d.score);
          })
          .attr("height", d => Math.max(height - y(d.score), dynamicMinHeight));

        svg.selectAll(".label")
          .data(emotionScores)
          .attr("y", d => {
            const computedHeight = height - y(d.score);
            return (computedHeight < dynamicMinHeight ? height - dynamicMinHeight : y(d.score)) - 5;
          })
          .text(d => `${Math.round(d.score * 100)}%`);

        tooltip.html(`${d.emotion}: ${Math.round(d.score * 100)}%`)
               .style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 20) + "px");
      })
      .on("end", function() {
        d3.select(this).style("opacity", 1);
      });

    svg.selectAll(".bar")
      .data(emotionScores)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.emotion))
      .attr("y", d => {
        const computedHeight = height - y(d.score);
        return computedHeight < dynamicMinHeight ? height - dynamicMinHeight : y(d.score);
      })
      .attr("width", x.bandwidth())
      .attr("height", d => Math.max(height - y(d.score), dynamicMinHeight))
      .style("fill", d => this.emotionColors[d.emotion])
      .style("cursor", "pointer")
      .attr("tabindex", 0)
      .attr("aria-label", d => `${d.emotion}: ${Math.round(d.score * 100)}%`)
      .on("mouseover", function(event, d) {
        tooltip.style("opacity", 0.9)
               .html(`${d.emotion}: ${Math.round(d.score * 100)}%`)
               .style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 20) + "px");
        d3.select(this).style("stroke", "#000").style("stroke-width", "1px");
      })
      .on("mousemove", function(event, d) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("opacity", 0);
        d3.select(this).style("stroke", "none");
      })
      .call(drag);

    svg.selectAll(".label")
      .data(emotionScores)
      .enter().append("text")
      .attr("class", "label")
      .attr("x", d => x(d.emotion) + x.bandwidth() / 2)
      .attr("y", d => {
        const computedHeight = height - y(d.score);
        return (computedHeight < dynamicMinHeight ? height - dynamicMinHeight : y(d.score)) - 5;
      })
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text(d => `${Math.round(d.score * 100)}%`);
  }
}
