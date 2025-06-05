export default class TutorialController {
  constructor() {
    this.tutorialOverlay = document.getElementById('tutorialOverlay');
    this.helpButton = document.getElementById('helpButton');
    this.closeButton = document.getElementById('closeTutorial');
    
    this.initEventListeners();
  }
  
  initEventListeners() {
    // Help button shows the tutorial
    this.helpButton.addEventListener('click', () => this.showTutorial());
    
    // Close button hides the tutorial
    this.closeButton.addEventListener('click', () => this.hideTutorial());
    
    // Close tutorial when clicking outside content
    this.tutorialOverlay.addEventListener('click', (event) => {
      if (event.target === this.tutorialOverlay) {
        this.hideTutorial();
      }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
      // Only handle keypresses when tutorial is visible
      if (this.tutorialOverlay.classList.contains('hidden')) return;
      
      if (event.key === 'Escape') {
        this.hideTutorial();
      }
    });
  }
  
  showTutorial() {
    // Add class to body for blur effect
    document.body.classList.add('tutorial-active');
    
    // Show the tutorial overlay
    this.tutorialOverlay.classList.remove('hidden');
    
    // Announce for screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.classList.add('sr-only');
    announcement.textContent = 'Tutorial opened.';
    document.body.appendChild(announcement);
    
    // Remove announcement after it's read
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
  
  hideTutorial() {
    // Remove blur effect
    document.body.classList.remove('tutorial-active');
    
    // Hide the tutorial overlay with transition
    this.tutorialOverlay.classList.add('hidden');
  }
}
