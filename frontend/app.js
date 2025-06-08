import MainController from './modules/MainController.js';
import TutorialController from './modules/TutorialController.js';

document.addEventListener("DOMContentLoaded", () => {
  // Initialize the main app controller
  const mainController = new MainController();
  
  // Make dataService accessible globally for legacy code
  window.dataService = mainController.dataService;

  // Initialize the tutorial controller
  const tutorialController = new TutorialController();

  // Check if this is the user's first visit
  const hasSeenTutorial = localStorage.getItem('hasSeenTutorial') === 'true';
  if (!hasSeenTutorial) {
    // Show tutorial on first visit
    tutorialController.showTutorial();
    localStorage.setItem('hasSeenTutorial', 'true');
    
    // Log tutorial shown via dataService
    mainController.dataService.logInteraction('tutorial_shown');
  }

  // Setup AI toggle functionality
  const toggleAIButton = document.getElementById("toggleAIButton");
  const changeButton = document.getElementById("changeSentenceButton");
  const resetButton = document.getElementById("resetButton");
  const helpButton = document.getElementById("helpButton");

  let aiEnabled = true; // Track whether AI modifications are enabled

  // Log help button clicks through dataService
  helpButton.addEventListener("click", () => {
    mainController.dataService.logHelpClicked();
  });

  toggleAIButton.addEventListener("click", () => {
    aiEnabled = !aiEnabled;

    // Update button states
    changeButton.disabled = !aiEnabled;
    resetButton.disabled = !aiEnabled;

    // Update toggle button text
    toggleAIButton.textContent = aiEnabled ? "Disable AI Modifications" : "Enable AI Modifications";

    // Update AI modification state in BarChartModule and log via DataService
    mainController.barChartModule.setAIEnabled(aiEnabled);
    mainController.dataService.setAiEnabled(aiEnabled);
  });
});
