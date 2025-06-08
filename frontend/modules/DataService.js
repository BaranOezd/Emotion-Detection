export class DataService {
  constructor(baseUrl = window.location.origin) {
    this.baseUrl = baseUrl;
  }

  async analyzeText(text) {
    try {
      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
        throw new Error("Invalid or empty response from server");
      }

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
      const response = await fetch(`${this.baseUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("❌ Error during file upload:", error);
      throw error;
    }
  }

  async modifySentence(sentenceData, originalEmotions = {}) {
    const payload = {
      sentence: sentenceData.sentence,
      new_emotions: sentenceData.emotions,
      context: document.getElementById("textEditor")?.innerText || "",
    };

    try {
      const response = await fetch(`${this.baseUrl}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Modify failed: ${response.status} - ${errorText}`);
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

  async logInteractions(logs) {
    try {
      const response = await fetch(`${this.baseUrl}/log-interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Logging failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error logging interactions:", error);
      throw error;
    }
  }
}
