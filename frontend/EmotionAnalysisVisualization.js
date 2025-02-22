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
        this.lastClickedSentence = null;  
        this.selectedEmotion = [];  

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
        const streamContainer = d3.select("#steamGraph");
        streamContainer.selectAll("*").remove();
    
        const margin = { top: 40, right: 30, bottom: 40, left: 40 };
        const width = streamContainer.node().clientWidth - margin.left - margin.right;
        const height = streamContainer.node().clientHeight - margin.top - margin.bottom;
    
        const svg = streamContainer.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("width", "100%")
            .style("height", "100%");
    
        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
    
        // Add title for the stream graph
        g.append("text")
            .attr("x", width / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text("Emotion Trends Over Sentences");
    
        // Prepare data and scales
        const fullData = this.data;
        const x = d3.scaleLinear()
            .domain([1, fullData.length])
            .range([0, width]);
    
        const y = d3.scaleLinear()
            .domain([0, 1])
            .nice()
            .range([height, 0]);
    
        // Helper to sample data based on a visible domain and step value
        const sampleData = (data, domainStart, domainEnd, step) => {
            const sampledData = [];
            const sampledIndices = [];
            for (let i = domainStart - 1; i < domainEnd; i += step) {
                if (i >= 0 && i < data.length) {
                    sampledData.push(data[i]);
                    sampledIndices.push(i + 1);
                }
            }
            return { sampledData, sampledIndices };
        };
    
        // Group for drawing lines
        const lineGroup = g.append("g").attr("class", "lines");
    
        // --- DRAW LINES WITH TRANSITIONS ---
        const drawLines = (sampledData, sampledIndices, xScale, immediate = true) => {
            const lines = lineGroup.selectAll(".emotion-line")
                .data(this.emotions);
    
            // Remove exiting lines instantly.
            lines.exit().interrupt().style("opacity", 0).remove();
    
            // Enter new lines
            const newLines = lines.enter()
                .append("path")
                .attr("class", d => `line-${d} emotion-line`)
                .attr("fill", "none")
                .attr("stroke", d => this.emotionColors[d])
                .attr("stroke-width", 4)
                // Set initial opacity based on the selected emotions array
                .style("opacity", d =>
                    (this.selectedEmotions && this.selectedEmotions.length > 0)
                        ? (this.selectedEmotions.includes(d) ? 1 : 0.1)
                        : 1
                );
    
            const merged = lines.merge(newLines).interrupt();
    
            if (immediate) {
                // Update instantly without any transition.
                merged
                    .attr("d", emotion => {
                        return d3.line()
                            .x((_, i) => xScale(sampledIndices[i]))
                            .y(v => y(+v[emotion] || 0))
                            .curve(d3.curveBasis)(sampledData);
                    })
                    .style("opacity", emotion =>
                        (this.selectedEmotions && this.selectedEmotions.length > 0)
                            ? (this.selectedEmotions.includes(emotion) ? 1 : 0.1)
                            : 1
                    );
            } else {
                // Animated update (used by reset zoom)
                merged
                    .transition()
                    .duration(500)
                    .attr("d", emotion => {
                        return d3.line()
                            .x((_, i) => xScale(sampledIndices[i]))
                            .y(v => y(+v[emotion] || 0))
                            .curve(d3.curveBasis)(sampledData);
                    })
                    .style("opacity", emotion =>
                        (this.selectedEmotions && this.selectedEmotions.length > 0)
                            ? (this.selectedEmotions.includes(emotion) ? 1 : 0.1)
                            : 1
                    );
            }
        };
    
        // Initialize drawing
        let currentStep = Math.ceil(fullData.length / (width / 20));
        let { sampledData, sampledIndices } = sampleData(fullData, 1, fullData.length, currentStep);
        drawLines(sampledData, sampledIndices, x);
    
        // X-axis and Y-axis
        const xAxis = g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x)
                .tickValues(d3.range(1, fullData.length + 1))
                .tickFormat(d => `${d}`));
    
        g.append("g")
            .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1f")))
            .select(".domain").attr("stroke", "none");
    
        // Grid lines
        g.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
            .style("stroke", "#ddd")
            .style("stroke-opacity", 0.3);
    
        // --- DYNAMIC MAXIMUM ZOOM ---
        const minPixelPerSentence = 30;
        const maxZoom = Math.ceil((minPixelPerSentence * (fullData.length - 1)) / width);
    
        const zoom = d3.zoom()
            .scaleExtent([1, maxZoom])
            .translateExtent([[0, 0], [width, height]])
            .on("zoom", (event) => {
                const newX = event.transform.rescaleX(x);
                const domain = newX.domain();
                const domainStart = Math.max(1, Math.round(domain[0]));
                const domainEnd = Math.min(fullData.length, Math.round(domain[1]));
                const visibleWidth = newX(domainEnd) - newX(domainStart);
                const step = Math.max(1, Math.floor((domainEnd - domainStart) / (visibleWidth / 20)));
                const { sampledData, sampledIndices } = sampleData(fullData, domainStart, domainEnd, step);
                drawLines(sampledData, sampledIndices, newX);
                const tickValues = (domainEnd - domainStart) < 20 ?
                    d3.range(domainStart, domainEnd + 1) :
                    null;
                xAxis.call(d3.axisBottom(newX)
                    .tickValues(tickValues)
                    .tickFormat(d => `${d}`));
            });
    
        svg.call(zoom);
    
        // --- RESET ZOOM BUTTON ---
        const resetZoom = () => {
            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity);
            const { sampledData, sampledIndices } = sampleData(fullData, 1, fullData.length, currentStep);
            drawLines(sampledData, sampledIndices, x);
            xAxis.call(d3.axisBottom(x)
                .tickValues(d3.range(1, fullData.length + 1))
                .tickFormat(d => `${d}`));
        };
    
        svg.append("g")
            .attr("class", "reset-zoom")
            .append("rect")
            .attr("x", 10)
            .attr("y", 10)
            .attr("width", 100)
            .attr("height", 30)
            .attr("fill", "#f0f0f0")
            .attr("stroke", "#ccc")
            .attr("rx", 5)
            .style("cursor", "pointer")
            .on("click", resetZoom);
    
        svg.append("text")
            .attr("x", 20)
            .attr("y", 30)
            .attr("dy", "0.35em")
            .style("font-size", "14px")
            .style("cursor", "pointer")
            .text("Reset Zoom")
            .on("click", resetZoom);
    
        // --- LEGEND (rendered in #legend) ---
        const legendContainer = d3.select("#legend");
        legendContainer.selectAll("*").remove();
    
        const legendWidth = legendContainer.node().clientWidth;
        const legendHeight = 50; // adjust as needed
    
        const legendSVG = legendContainer.append("svg")
            .attr("viewBox", `0 0 ${legendWidth} ${legendHeight}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("width", "100%")
            .style("height", "100%");
    
        const legendGroup = legendSVG.append("g")
            .attr("transform", `translate(10, ${legendHeight / 2 - 10})`);
    
        const self = this; // preserve reference to the instance
        // Ensure selectedEmotions array is initialized
        if (!this.selectedEmotions) {
            this.selectedEmotions = [];
        }
    
        this.emotions.forEach((emotion, i) => {
            const legendItem = legendGroup.append("g")
                .attr("transform", `translate(${i * 100}, 0)`)
                .style("cursor", "pointer")
                .on("click", function(event, d) {
                    if (event.shiftKey) {
                        // Shift-click: toggle the clicked emotion in the selection array
                        if (self.selectedEmotions.includes(emotion)) {
                            self.selectedEmotions = self.selectedEmotions.filter(e => e !== emotion);
                            d3.select(this).select("rect")
                                .transition().duration(300)
                                .attr("stroke-width", 0)
                                .attr("transform", "scale(1)");
                            d3.select(this).select("text")
                                .transition().duration(300)
                                .style("font-weight", "normal");
                        } else {
                            self.selectedEmotions.push(emotion);
                            d3.select(this).select("rect")
                                .transition().duration(300)
                                .attr("stroke-width", 2)
                                .attr("transform", "scale(1.1)");
                            d3.select(this).select("text")
                                .transition().duration(300)
                                .style("font-weight", "bold");
                        }
                    } else {
                        // Normal click: if already the only selection, clear it; otherwise select just this emotion.
                        if (self.selectedEmotions.length === 1 && self.selectedEmotions[0] === emotion) {
                            self.selectedEmotions = [];
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
                            self.selectedEmotions = [emotion];
                            d3.select(this).select("rect")
                                .transition().duration(300)
                                .attr("stroke-width", 2)
                                .attr("transform", "scale(1.1)");
                            d3.select(this).select("text")
                                .transition().duration(300)
                                .style("font-weight", "bold");
                        }
                    }
                    // Update line opacities based on the current selection
                    if (self.selectedEmotions.length === 0) {
                        d3.selectAll(".lines path")
                            .transition().duration(500)
                            .style("opacity", 1);
                    } else {
                        d3.selectAll(".lines path")
                            .transition().duration(500)
                            .style("opacity", function() {
                                const classes = d3.select(this).attr("class").split(" ");
                                for (let sel of self.selectedEmotions) {
                                    if (classes.indexOf(`line-${sel}`) !== -1) {
                                        return 1;
                                    }
                                }
                                return 0.1;
                            });
                    }
                })
                .on("mouseover", function() {
                    d3.select(this).select("rect")
                        .transition().duration(200)
                        .attr("stroke", "#000")
                        .attr("stroke-width", 2);
                    d3.select(this).select("text")
                        .transition().duration(200)
                        .style("font-weight", "bold");
                })
                .on("mouseout", function() {
                    if (!self.selectedEmotions.includes(emotion)) {
                        d3.select(this).select("rect")
                            .transition().duration(200)
                            .attr("stroke", "none")
                            .attr("stroke-width", 0);
                        d3.select(this).select("text")
                            .transition().duration(200)
                            .style("font-weight", "normal");
                    }
                });
    
            // Append the color square and label
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
        container.html(""); // clear any previous graph
    
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
    
        // Derive emotion keys by filtering out the "Sentence" column.
        const emotions = data.columns 
            ? data.columns.slice(1)
            : Object.keys(data[0]).filter(key => key !== "Sentence");
    
        // For each emotion, build and append a line.
        emotions.forEach(emotion => {
            const line = d3.line()
                .x((d, i) => x(i + 1))
                // Convert each value to a number; if conversion fails, default to 0.
                .y(d => y(+d[emotion] || 0))
                .curve(d3.curveBasis);
    
            svg.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", "#F44336")  // might use this.emotionColors[emotion] instead
                .attr("stroke-width", 4)
                .attr("d", line);
        });
    }   
    
});