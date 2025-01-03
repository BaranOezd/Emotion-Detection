// Load the CSV file using D3.js
d3.csv("/backend/emotion_analysis.csv").then(function (data) {
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

        function updateBarChart(sentenceData) {
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
        
            // Add X-axis
            svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x))
                .selectAll("text")
                .style("text-anchor", "middle")
                .style("font-size", "12px")
                .attr("dy", "1.5em");
        
            // Add Y-axis with specified tick values and formatting
            svg.append("g")
                .call(d3.axisLeft(y)
                    .ticks(5)
                    .tickValues([0, 0.2, 0.4, 0.6, 0.8, 1])
                    .tickFormat(d => `${d * 100}%`) // Format ticks as percentages without decimals
                );
        
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
                .text(d => (d.score > 0 ? `${Math.round(d.score * 100)}%` : "")); // Display as an integer percentage
        }
        
         
    
    // Render the steam graph
    createSteamGraph(data);

    function createSteamGraph(data) {
        // Filter out invalid rows
        data = data.filter(d => d.Sentence && d.Sentence.trim() !== "");
    
        const container = d3.select("#steamGraph");
        const margin = { top: 20, right: 30, bottom: 100, left: 40 }; // Increased bottom margin for legend and x-axis spacing
        const width = container.node().clientWidth - margin.left - margin.right;
        const height = container.node().clientHeight - margin.top - margin.bottom;
    
        // Define height for legend
        const legendHeight = 50;
    
        const svg = container.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom + legendHeight}`)
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
    
        // X-Axis
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(data.length).tickFormat(d => `${d}`))
            .selectAll("text")
            .attr("dy", "1.5em"); // Add padding to move labels down
    
        // Y-Axis
        svg.append("g")
            .call(d3.axisLeft(y).ticks(5).tickValues([0, 0.2, 0.4, 0.6, 0.8, 1]).tickFormat(d3.format(".1f")));
    
        // State variable to track isolated line
        let isolatedEmotion = null;
    
        // Add lines for each emotion
        emotions.forEach(emotion => {
            const line = d3.line()
                .x((_, i) => x(i + 1))
                .y(d => y(+d[emotion]));
    
            svg.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", emotionColors[emotion])
                .attr("stroke-width", 4)
                .attr("class", `line-${emotion}`)
                .attr("d", line)
                .on("click", function () {
                    if (isolatedEmotion === emotion) {
                        svg.selectAll("path").style("opacity", 1);
                        isolatedEmotion = null;
                    } else {
                        svg.selectAll("path").style("opacity", 0.1);
                        d3.select(this).style("opacity", 1);
                        isolatedEmotion = emotion;
                    }
                });
        });
    
        // Add legend dynamically below the graph
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(0, ${height + 50})`); // Added extra space below the x-axis labels
    
        const legendItems = emotions.map((emotion, i) => ({
            emotion,
            color: emotionColors[emotion],
            x: i * 100, // Horizontal spacing for each legend item
        }));
    
        // Add legend rectangles
        legend.selectAll(".legend-rect")
            .data(legendItems)
            .enter()
            .append("rect")
            .attr("class", "legend-rect")
            .attr("x", d => d.x)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .style("fill", d => d.color)
            .on("click", function (event, d) {
                const line = svg.select(`.line-${d.emotion}`);
                if (isolatedEmotion === d.emotion) {
                    svg.selectAll("path").style("opacity", 1);
                    isolatedEmotion = null;
                } else {
                    svg.selectAll("path").style("opacity", 0.1);
                    line.style("opacity", 1);
                    isolatedEmotion = d.emotion;
                }
            });
    
        // Add legend text
        legend.selectAll(".legend-text")
            .data(legendItems)
            .enter()
            .append("text")
            .attr("class", "legend-text")
            .attr("x", d => d.x + 20)
            .attr("y", 12)
            .style("font-size", "12px")
            .text(d => d.emotion)
            .on("click", function (event, d) {
                const line = svg.select(`.line-${d.emotion}`);
                if (isolatedEmotion === d.emotion) {
                    svg.selectAll("path").style("opacity", 1);
                    isolatedEmotion = null;
                } else {
                    svg.selectAll("path").style("opacity", 0.1);
                    line.style("opacity", 1);
                    isolatedEmotion = d.emotion;
                }
            });
    }
});
