// dataService.js

export class DataService {
    constructor() {}
  
    async analyzeText(text) {
      try {
        const response = await fetch("/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text })
        });
        
        if (!response.ok) {
          throw new Error("Network response was not ok: " + response.statusText);
        }
        
        const data = await response.json();
        console.log("Backend response:", data);
        return data;
      } catch (error) {
        console.error("Error analyzing text:", error);
        throw error;
      }
    }
  
    async loadInitialData() {
      const sampleText = "Enter some default text here for analysis."; // Replace with your sample text
      try {
        const data = await this.analyzeText(sampleText);
        if (!data.results) {
          throw new Error("Expected JSON object to contain a 'results' key");
        }
        return data.results;
      } catch (error) {
        console.error("Error loading JSON from /analyze:", error);
        throw error;
      }
    }
  
    async uploadFile(file) {
      const formData = new FormData();
      formData.append("file", file);
      
      try {
        const response = await fetch("/upload", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error during file upload:", error);
        throw error;
      }
    }
  
    async modifySentence(sentenceData) {
      const payload = {
        sentence: sentenceData.sentence,
        new_emotions: sentenceData.emotions,
        context: document.getElementById("textEditor")
                ? document.getElementById("textEditor").innerText
                : ""
      };
      
      try {
        const response = await fetch("/modify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Network response was not ok: ${response.statusText} - ${errorText}`);
        }
        
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        
        return data;
      } catch (error) {
        console.error("Error modifying sentence:", error);
        throw error;
      }
    }
  }