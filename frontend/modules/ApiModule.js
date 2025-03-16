/* export default class ApiModule {
    analyzeText(text) {
      return fetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Network response not ok: ${response.statusText}`);
        }
        return response.json();
      });
    }
    
    uploadFile(file) {
      const formData = new FormData();
      formData.append("file", file);
      return fetch("/upload", {
        method: "POST",
        body: formData,
      }).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      });
    }
    
    modifySentence(sentenceData) {
      const payload = {
        sentence: sentenceData.sentence,
        new_emotions: sentenceData.emotions,
        context: document.getElementById("textEditor")
                  ? document.getElementById("textEditor").innerText
                  : ""
      };
      return fetch("/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async response => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Network response not ok: ${response.statusText} - ${errorText}`);
        }
        return response.json();
      });
    }
  }
   */