class EmotionAnalysisVisualization {
    constructor(data) {
        this.data = data;
        this.emotions = data.columns.slice(1); // Get emotion columns (skip the first column which is 'Sentence')
        this.emotionColors = {
            "Joy": "#FFEB3B",  // Yellow
            "Sadness": "#2196F3",    // Blue
            "Fear": "#9C27B0",       // Purple
            "Disgust": "#4CAF50",    // Green
            "Anger": "#F44336",      // Red
            "Surprise": "#FFB322",   // Orange
            "Neutral": "#9E9E9E"     // Gray
        };
        this.lastClickedSentence = null;  // Initialize as null
    }

    // Create the sentence list
    createSentenceList() {
        const sentenceList = d3.select(".sentence-list");

        sentenceList.selectAll(".sentence-list-item")
            .data(this.data)
            .enter()
            .append("div")
            .attr("class", "sentence-list-item")
            .text(d => d.Sentence)
            .on("mouseover", (event) => {
                if (this.lastClickedSentence === event.target) {
                    d3.select(event.target).style("color", "#c00"); // Keep red if already clicked
                } else {
                    d3.select(event.target).style("color", "#0056b3"); // Change text color on hover
                }
            })
            .on("mouseout", (event) => {
                if (this.lastClickedSentence === event.target) {
                    d3.select(event.target).style("color", "#c00"); // Keep red if already clicked
                } else {
                    d3.select(event.target).style("color", ""); // Reset text color if not clicked
                }
            })
            .on("click", (event, d) => this.onSentenceClick(event, d)); // Pass 'this' reference properly
    }

    // Handle sentence click event
    onSentenceClick(event, d) {
        if (this.lastClickedSentence === event.target) {
            // Unclick logic: Clear chart and reset styles
            d3.select(this.lastClickedSentence).style("color", "").classed("clicked", false);
            this.lastClickedSentence = null;
            this.clearBarChart(); // Clear the bar chart
        } else {
            if (this.lastClickedSentence) {
                d3.select(this.lastClickedSentence).style("color", "").classed("clicked", false);
            }
            // Highlight the clicked sentence
            d3.select(event.target).style("color", "#c00").classed("clicked", true); // Red color for active
            this.lastClickedSentence = event.target; // Update last clicked sentence
            this.updateBarChart(d); // Update the chart for the clicked sentence
        }
    }

    // Clear the bar chart
    clearBarChart() {
        const chartDiv = d3.select("#chart");
        chartDiv.html(""); // Clear existing chart
    }

    // Update the bar chart with new data
    updateBarChart(sentenceData) {
        const chartDiv = d3.select("#chart");
        chartDiv.html(""); // Clear existing chart

        const margin = { top: 20, right: 30, bottom: 100, left: 50 };
        const width = chartDiv.node().clientWidth - margin.left - margin.right;
        const height = chartDiv.node().clientHeight - margin.top - margin.bottom;

        const svg = chartDiv.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("width", "100%")
            .style("height", "100%")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(this.emotions)
            .range([0, width])
            .padding(0.2);

        const y = d3.scaleLinear()
            .domain([0, 1])
            .nice()
            .range([height, 0]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .attr("dy", "1.5em");

        svg.append("g")
            .call(d3.axisLeft(y)
                .ticks(5)
                .tickValues([0, 0.2, 0.4, 0.6, 0.8, 1])
                .tickFormat(d => `${d * 100}%`) // Format ticks as percentages without decimals
            );

        const emotionScores = this.emotions.map(emotion => ({
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
            .style("fill", d => this.emotionColors[d.emotion]);

        svg.selectAll(".label")
            .data(emotionScores)
            .enter().append("text")
            .attr("x", d => x(d.emotion) + x.bandwidth() / 2)
            .attr("y", d => y(d.score) - 5)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .text(d => (d.score > 0 ? `${Math.round(d.score * 100)}%` : "")); // Display as an integer percentage
    }

    // Create the steam graph
    createSteamGraph() {
        const container = d3.select("#steamGraph");
        const margin = { top: 20, right: 30, bottom: 100, left: 40 }; // Increased bottom margin for legend and x-axis spacing
        const width = container.node().clientWidth - margin.left - margin.right;
        const height = container.node().clientHeight - margin.top - margin.bottom;

        const svg = container.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("width", "100%")
            .style("height", "100%")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain([1, this.data.length])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, 1])
            .nice()
            .range([height, 0]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(this.data.length).tickFormat(d => `${d}`));

        svg.append("g")
            .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1f")));

        // Add emotion lines for steam graph
        this.emotions.forEach(emotion => {
            const line = d3.line()
                .x((_, i) => x(i + 1))
                .y(d => y(d[emotion]));

            svg.append("path")
                .datum(this.data)
                .attr("fill", "none")
                .attr("stroke", this.emotionColors[emotion])
                .attr("stroke-width", 4)
                .attr("class", `line-${emotion}`)
                .attr("d", line);
        });
    }
}

// Initialize the class and render charts after loading CSV data
d3.csv("/backend/emotion_analysis.csv").then(function (data) {
    const visualization = new EmotionAnalysisVisualization(data);
    visualization.createSentenceList();
    visualization.createSteamGraph();
});

// Function to handle text input analysis and update visualization dynamically
document.getElementById("analyzeButton").addEventListener("click", function () {
    const textInput = document.getElementById("textInput").value;

    if (textInput.trim() === "") {
        alert("Please enter some text to analyze.");
        return;
    }

    // Clear previous analysis and graphs
    clearPreviousAnalysis();

    // Send the text to the backend for analysis
    analyzeText(textInput);
});

// Function to clear previous analysis and graphs
function clearPreviousAnalysis() {
    // Clear the charts
    d3.select("#chart").html("");
    d3.select("#steamGraph").html("");

    // Optionally, clear the text input field
    const textInput = document.getElementById("textInput");
    textInput.value = ''; // Optionally clear the text input after each analysis
}

// Function to send text to the backend for analysis
function analyzeText(text) {
    fetch("/analyze", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text }),
    })
    .then((response) => response.json())
    .then((data) => {
        // Directly update visualization without page reload
        updateVisualization(data);
        
        // Update sentence list dynamically
        updateSentenceList(data);
    })
    .catch((error) => {
        console.error("Error analyzing text:", error);
    });
}

// Add a new function to update sentence list dynamically
function updateSentenceList(data) {
    const sentenceList = d3.select(".sentence-list");
    
    // Clear existing sentences
    sentenceList.html("");
    
    // Populate with new sentences
    sentenceList.selectAll(".sentence-list-item")
        .data(data.sentences)
        .enter()
        .append("div")
        .attr("class", "sentence-list-item")
        .text(d => d.Sentence);
}

// Function to update the visualization with new data (bar chart and steam graph)
function updateVisualization(data) {
    // Update the bar chart
    updateBarChart(data);

    // Update the steam graph
    updateSteamGraph(data);
}

// Function to update the bar chart with new data
function updateBarChart(data) {
    const emotions = Object.keys(data.emotions);
    const emotionScores = emotions.map(emotion => ({
        emotion: emotion,
        score: data.emotions[emotion]
    }));

    const chartDiv = d3.select("#chart");
    chartDiv.html(""); // Clear existing chart

    const margin = { top: 20, right: 30, bottom: 100, left: 50 };
    const width = chartDiv.node().clientWidth - margin.left - margin.right;
    const height = chartDiv.node().clientHeight - margin.top - margin.bottom;

    const svg = chartDiv.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(emotions)
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, 1])
        .nice()
        .range([height, 0]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .attr("dy", "1.5em");

    svg.append("g")
        .call(d3.axisLeft(y).ticks(5).tickValues([0, 0.2, 0.4, 0.6, 0.8, 1]).tickFormat(d => `${d * 100}%`));

    svg.selectAll(".bar")
        .data(emotionScores)
        .enter().append("rect")
        .attr("x", d => x(d.emotion))
        .attr("y", d => y(d.score))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.score))
        .style("fill", "#2196F3"); // Add color mapping here if necessary

    svg.selectAll(".label")
        .data(emotionScores)
        .enter().append("text")
        .attr("x", d => x(d.emotion) + x.bandwidth() / 2)
        .attr("y", d => y(d.score) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(d => `${Math.round(d.score * 100)}%`);
}

// Function to update the steam graph with new data
function updateSteamGraph(data) {
    const emotions = Object.keys(data.emotions);
    const container = d3.select("#steamGraph");
    const margin = { top: 20, right: 30, bottom: 100, left: 40 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;
    const legendHeight = 50;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom + legendHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([1, data.sentences.length])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, 1])
        .nice()
        .range([height, 0]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(data.sentences.length).tickFormat(d => `${d}`));

    svg.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1f")));

    // Add emotion lines for steam graph
    emotions.forEach(emotion => {
        const line = d3.line()
            .x((_, i) => x(i + 1))
            .y(d => y(d[emotion]));

        svg.append("path")
            .datum(data.sentences)
            .attr("fill", "none")
            .attr("stroke", "#F44336") // Emotion color can be dynamic
            .attr("stroke-width", 4)
            .attr("d", line);
    });
}
