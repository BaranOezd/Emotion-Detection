import MainController from './modules/MainController.js';
import TutorialController from './modules/TutorialController.js';
import { TrackingService } from './modules/TrackingService.js';

document.addEventListener("DOMContentLoaded", () => {
  // Initialize tracking service first
  const trackingService = new TrackingService();
  window.trackingService = trackingService;
  
  // Initialize the main app controller
  const mainController = new MainController();

  // Initialize the tutorial controller
  const tutorialController = new TutorialController();

  // Check if this is the user's first visit
  const hasSeenTutorial = localStorage.getItem('hasSeenTutorial') === 'true';
  if (!hasSeenTutorial) {
    // Show tutorial on first visit
    tutorialController.showTutorial();
    localStorage.setItem('hasSeenTutorial', 'true');
    trackingService.logInteraction('tutorial_shown');
  }

  // Setup AI toggle functionality
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

    // Update AI modification state in the BarChartModule and tracking service
    mainController.barChartModule.setAIEnabled(aiEnabled);
    trackingService.setAiEnabled(aiEnabled);
  });
  
  // Add tracking for rewrite button
  changeButton.addEventListener("click", () => {
    trackingService.incrementRewriteCount();
    trackingService.logInteraction('rewrite_initiated');
  });
  
  // Add tracking for reset button
  resetButton.addEventListener("click", () => {
    trackingService.incrementResetCount();
    trackingService.logInteraction('reset_initiated');
  });
});
