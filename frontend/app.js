import MainController from './modules/MainController.js';

document.addEventListener("DOMContentLoaded", () => {
  const mainController = new MainController();

  const toggleAIButton = document.getElementById("toggleAIButton");
  const changeButton = document.getElementById("changeSentenceButton");
  const resetButton = document.getElementById("resetButton");

  let aiEnabled = true; // Track whether AI modifications are enabled

  toggleAIButton.addEventListener("click", () => {
    aiEnabled = !aiEnabled;

    // Update button states
    changeButton.disabled = !aiEnabled;
    resetButton.disabled = !aiEnabled;

    // Update toggle button text
    toggleAIButton.textContent = aiEnabled ? "Disable AI Modifications" : "Enable AI Modifications";

    // Update AI modification state in the BarChartModule
    mainController.barChartModule.setAIEnabled(aiEnabled);
  });
});
