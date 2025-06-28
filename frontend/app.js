import MainController from './modules/MainController.js';
import TutorialController from './modules/TutorialController.js';

document.addEventListener("DOMContentLoaded", async () => {
  const mainController = new MainController();
  // Wait for userId to be set (async)
  if (mainController.dataService.logger.userId instanceof Promise || !mainController.dataService.logger.userId) {
    mainController.dataService.logger.userId = await mainController.dataService.logger.getUserIdFromModal();
  }

  // Make dataService accessible globally for legacy code
  window.dataService = mainController.dataService;

  // Initialize tutorial
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

  const helpButton = document.getElementById("helpButton");
  if (helpButton) {
    helpButton.addEventListener("click", () => {
      mainController.dataService.logHelpClicked();
      // Show tutorial
      tutorialController.showTutorial();
    });
  }
});
