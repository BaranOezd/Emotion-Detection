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

    // Display the list of sentences as clickable items
    const sentencesDiv = d3.select("#sentences");
    sentencesDiv.selectAll(".sentence-list")
        .data(data)
        .enter().append("div")
        .attr("class", "sentence-list")
        .text(d => d.Sentence)
        .on("click", function (event, d) {
            // When a sentence is clicked, toggle the chart visibility
            toggleChart(d);
        });

    // Variable to keep track of the last clicked sentence
    let lastClickedSentence = null;

    // Function to update or clear the chart based on the sentence clicked
    function toggleChart(sentenceData) {
        // If the same sentence is clicked again, clear the chart
        if (lastClickedSentence === sentenceData.Sentence) {
            d3.select("#chart").html(""); // Clear the chart
            lastClickedSentence = null; // Reset the last clicked sentence
        } else {
            lastClickedSentence = sentenceData.Sentence; // Update the last clicked sentence
            updateChart(sentenceData); // Update the chart with the new sentence data
        }
    }

    // Function to update the chart with emotion data for a selected sentence
    // Function to update the chart with a fixed x-axis from 0..1
    function updateChart(sentenceData) {
        // Clear previous chart
        d3.select("#chart").html("");

        // Define chart dimensions
        const width = 900; // Wider width for x-axis
        const height = 500; // Chart height
        const margin = { top: 20, right: 30, bottom: 120, left: 50 };

        // Create SVG with viewBox for responsiveness
        const svg = d3.select("#chart")
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet") // Maintain aspect ratio
            .classed("responsive-svg", true);

        // Add a group (`g`) element for the chart content with proper margins
        const g = svg.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Define the chart's actual drawing area
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Extract emotion scores for the selected sentence
        const emotionScores = Object.entries(sentenceData)
            .filter(([key, value]) => key !== "Sentence") // Ignore the "Sentence" field
            .map(([emotion, score]) => ({
                emotion: emotion,
                score: +score // Convert score to number
            }));

        // Include all emotions, even with zero scores
        const allEmotions = emotions.map(emotion => ({
            emotion: emotion,
            score: emotionScores.find(d => d.emotion === emotion)?.score || 0 // Default to 0 if not found
        }));

        // Define scales
        const x = d3.scaleBand()
            .domain(allEmotions.map(d => d.emotion)) // All emotions on the x-axis
            .range([0, chartWidth]) // Full width of the chart
            .padding(0.2); // Space between bars

        const y = d3.scaleLinear()
            .domain([0, 1]) // Assuming scores are in the range [0, 1]
            .range([chartHeight, 0]) // Reverse range for vertical scaling
            .nice();

        // Create the X axis
        g.append("g")
            .attr("transform", `translate(0,${chartHeight})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .attr("dy", "1.5em"); // Add extra spacing for labels

        // Create the Y axis
        g.append("g")
            .call(d3.axisLeft(y));

        // Draw bars
        g.selectAll(".bar")
            .data(allEmotions) // Use all emotions, including those with zero scores
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.emotion)) // Position each bar based on emotion
            .attr("y", d => y(d.score)) // Height starts at y(score)
            .attr("width", x.bandwidth()) // Bar width from scaleBand
            .attr("height", d => chartHeight - y(d.score)) // Bar height
            .style("fill", d => emotionColors[d.emotion] || "#9E9E9E"); // Default color for unknown emotions

        // Add labels to bars (only for scores > 0)
        g.selectAll(".label")
            .data(allEmotions)
            .enter().append("text")
            .attr("class", "label")
            .attr("x", d => x(d.emotion) + x.bandwidth() / 2) // Center horizontally
            .attr("y", d => y(d.score) - 5) // Slightly above the bar
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .text(d => d.score > 0 ? `${(d.score * 100).toFixed(1)}%` : null); // Convert to percentage format
    }

    // Create the Steam Graph (Time-Series Graph for emotion fluctuation across sentences)
    createSteamGraph(data);

    // Function to create the Steam Graph
    function createSteamGraph(data) {
        // Select the container and calculate its dimensions
        const container = d3.select("#steamGraph");
        const width = container.node().clientWidth;
        const height = container.node().clientHeight;

        // Define margins for spacing
        const margin = { top: 20, right: 30, bottom: 60, left: 40 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Create the SVG element and set it to fill the container
        const svg = container.append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Set up scales
        const x = d3.scaleLinear()
            .domain([1, data.length]) // Map sentence numbers directly
            .range([0, innerWidth]);

        const y = d3.scaleLinear()
            .domain([0, 1]) // Emotion scores range from 0 to 1
            .nice()
            .range([innerHeight, 0]);

        // Create the X axis
        const xAxis = d3.axisBottom(x)
            .ticks(data.length) // Ensure one tick per sentence
            .tickFormat(d => `${d}`);
        svg.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxis)
            .selectAll("text")
            .style("text-anchor", "end");

        // Create the Y axis
        svg.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y));

        // Add lines for each emotion
        emotions.forEach(function (emotion) {
            const line = d3.line()
                .x((_, i) => x(i + 1)) // Map sentence index (starting from 1)
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
