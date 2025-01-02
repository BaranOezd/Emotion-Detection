// Load the CSV file using D3.js
d3.csv("emotion_analysis.csv").then(function (data) {
    const emotions = data.columns.slice(1); // Get emotion columns (skip the first column which is 'Sentence')

    // Emotion color mapping based on Ekman's discrete model
    const emotionColors = {
        "Happiness": "#FFEB3B",  // Yellow
        "Sadness": "#2196F3",    // Blue
        "Fear": "#9C27B0",       // Purple
        "Disgust": "#4CAF50",    // Green
        "Anger": "#F44336",      // Red
        "Surprise": "#FFB322",   // Orange
        "Neutral": "#9E9E9E"     // Gray
    };

    // Track the last clicked sentence
    let lastClickedSentence = null;

    // Display the list of sentences
    const sentencesDiv = d3.select("#sentences");
    sentencesDiv.selectAll(".sentence-list-item")
        .data(data)
        .enter()
        .append("div")
        .attr("class", "sentence-list-item")
        .text(d => d.Sentence)
        .on("mouseover", function () {
            d3.select(this).style("color", "#0056b3"); // Change text color on hover
        })
        .on("mouseout", function () {
            if (this !== lastClickedSentence) {
                d3.select(this).style("color", ""); // Reset text color if not clicked
            }
        })
        .on("click", function (event, d) {
            // Reset style for previously clicked sentence
            if (lastClickedSentence) {
                d3.select(lastClickedSentence).style("color", "").classed("clicked", false);
            }

            // Highlight the clicked sentence
            d3.select(this).style("color", "#c00").classed("clicked", true); // Red color for active

            lastClickedSentence = this; // Update last clicked sentence

            // Update the chart for the clicked sentence
            updateBarChart(d);
        });

    // Render the bar chart for a selected sentence
    function updateBarChart(sentenceData) {
        const chartDiv = d3.select("#chart");
        chartDiv.html(""); // Clear existing chart
    
        const margin = { top: 20, right: 30, bottom: 100, left: 50 };
        const width = chartDiv.node().clientWidth - margin.left - margin.right;
        const height = chartDiv.node().clientHeight - margin.top - margin.bottom;
    
        const svg = chartDiv.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
    
        const x = d3.scaleBand()
            .domain(emotions)
            .range([0, width])
            .padding(0.2);
    
        const y = d3.scaleLinear()
            .domain([0, 1])
            .range([height, 0])
            .nice();
    
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .attr("dy", "1.5em");
    
        svg.append("g").call(d3.axisLeft(y));
    
        const emotionScores = emotions.map(emotion => ({
            emotion: emotion,
            score: +sentenceData[emotion] || 0
        }));
    
        svg.selectAll(".bar")
            .data(emotionScores)
            .enter().append("rect")
            .attr("x", d => x(d.emotion))
            .attr("y", d => y(d.score))
            .attr("width", x.bandwidth())
            .attr("height", d => height - y(d.score))
            .style("fill", d => emotionColors[d.emotion]);
    
        svg.selectAll(".label")
            .data(emotionScores)
            .enter().append("text")
            .attr("x", d => x(d.emotion) + x.bandwidth() / 2)
            .attr("y", d => y(d.score) - 5)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .text(d => (d.score > 0 ? `${(d.score * 100).toFixed(1)}%` : ""));
    }
    
    // Render the steam graph
    createSteamGraph(data);

    function createSteamGraph(data) {
        const container = d3.select("#steamGraph");
        const margin = { top: 10, right: 20, bottom: 40, left: 40 }; // Smaller margins
        const width = container.node().clientWidth - margin.left - margin.right;
        const height = container.node().clientHeight - margin.top - margin.bottom;
    
        const svg = container.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
    
        const x = d3.scaleLinear()
            .domain([1, data.length])
            .range([0, width]);
    
        const y = d3.scaleLinear()
            .domain([0, 1])
            .range([height, 0]);
    
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(data.length).tickFormat(d => `${d}`));
    
        svg.append("g").call(d3.axisLeft(y).tickFormat(() => ""));
    
        emotions.forEach(emotion => {
            const line = d3.line()
                .x((_, i) => x(i + 1))
                .y(d => y(+d[emotion]));
    
            svg.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", emotionColors[emotion])
                .attr("stroke-width", 1.5)
                .attr("d", line);
        });
    }    
});
