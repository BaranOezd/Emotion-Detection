export class DataService {
    constructor() {}
  
    async analyzeText(text) {
        try {
            const response = await fetch("/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: text })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
                throw new Error("Invalid or empty response from server");
            }

            console.log("Backend response:", data);
            return data;
            
        } catch (error) {
            console.error("Error analyzing text:", error);
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