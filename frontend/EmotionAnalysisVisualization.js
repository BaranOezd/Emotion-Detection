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

document.addEventListener("DOMContentLoaded", () => {
    // Bind Analyze button
    const analyzeButton = document.getElementById("analyzeButton");
    analyzeButton.addEventListener("click", handleAnalyzeButton);

    const uploadButton = document.getElementById("uploadButton");
    uploadButton.addEventListener("click", handleFileUpload);

    // Function to handle the Analyze button
    function handleAnalyzeButton() {
        const textInput = document.getElementById("textInput").value.trim();
        if (!textInput) {
            alert("Please enter some text to analyze.");
            return;
        }
        analyzeText(textInput);
    }

    // Function to handle the Upload button
    function handleFileUpload() {
        console.log("Upload button clicked"); // Debug log
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".txt"; // Accept only .txt files
        fileInput.click();
    
        fileInput.onchange = () => {
            const file = fileInput.files[0];
            if (!file) {
                alert("No file selected. Please select a valid .txt file.");
                return;
            }
    
            console.log("File selected:", file.name); // Debug log
            const formData = new FormData();
            formData.append("file", file);
    
            // Send the file to the backend for analysis
            fetch("/upload", {
                method: "POST",
                body: formData,
            })
                .then((response) => {
                    console.log("Received response status:", response.status); // Debug log
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then((data) => {
                    console.log("Backend response received:", data); // Debug log
                    if (data.error) {
                        alert(`Error from backend: ${data.error}`);
                    } else if (data.results) {
                        console.log("Analysis results:", data.results);
                        updateVisualization(data.results); // Update visualization
                        updateSentenceList(data.results); // Update sentence list
                    } else {
                        alert("Unexpected response format from backend.");
                    }
                })
                .catch((error) => {
                    console.error("Error during file upload:", error);
                    alert("An error occurred while uploading the file. Please try again.");
                });
        };
    }

    // Function to analyze text via backend
    function analyzeText(text) {
        fetch("/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text }),
        })
        .then((response) => response.json())
        .then((data) => {
            if (data.error) {
                alert("Error: " + data.error);
                console.error(data.error);
            } else {
                updateVisualization(data.results);
                updateSentenceList(data.results);
            }
        })
        .catch((error) => {
            console.error("Error analyzing text:", error);
        });
    }

    // Function to update the visualization dynamically
    function updateVisualization(results) {
        d3.select("#chart").html("");
        d3.select("#steamGraph").html("");
        updateBarChart(results);
        updateSteamGraph(results);
    }

    // Function to update the sentence list dynamically
    function updateSentenceList(results) {
        const sentenceList = d3.select(".sentence-list");
        sentenceList.html("");

        sentenceList.selectAll(".sentence-list-item")
            .data(results)
            .enter()
            .append("div")
            .attr("class", "sentence-list-item")
            .text((d, i) => `${i + 1}. ${d.sentence}`)
            .on("click", function (event, d) {
                d3.selectAll(".sentence-list-item").classed("clicked", false).style("color", "");
                d3.select(this).classed("clicked", true).style("color", "#c00");
                updateBarChart([d]);
            });
    }

    // Function to update the bar chart
    function updateBarChart(data) {
        // Existing bar chart update function (from previous code)
        const emotions = Object.keys(data[0].emotions);
        const emotionScores = emotions.map((emotion) => ({
            emotion,
            score: data[0].emotions[emotion],
        }));

        const chartDiv = d3.select("#chart");
        chartDiv.html("");

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
            .style("fill", "#2196F3");

        svg.selectAll(".label")
            .data(emotionScores)
            .enter().append("text")
            .attr("x", d => x(d.emotion) + x.bandwidth() / 2)
            .attr("y", d => y(d.score) - 5)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .text(d => `${Math.round(d.score * 100)}%`);
    }

    // Function to update the steam graph
    function updateSteamGraph(data) {
        const container = d3.select("#steamGraph");
        const margin = { top: 20, right: 30, bottom: 100, left: 40 };
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
            .domain([1, data.length])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, 1])
            .nice()
            .range([height, 0]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(data.length).tickFormat(d => `${d}`));

        svg.append("g")
            .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1f")));

        data[0].emotions.forEach(emotion => {
            const line = d3.line()
                .x((_, i) => x(i + 1))
                .y(d => y(d[emotion]));

            svg.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", "#F44336")
                .attr("stroke-width", 4)
                .attr("d", line);
        });
    }
});