// Main game loop - coordinates all systems

// Initialize all systems
Input.init();
Physics.init();
AI.init();
Game.init();
Render.init();
Controls.init();

// Update UI
function updateUI() {
    document.getElementById('game-status').textContent = Game.getStatusText();
}

// Game loop
let lastTime = 0;

function gameLoop(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    // Check for reset (P key)
    if (Input.isResetPressed()) {
        Physics.reset();
    }
    
    // Update systems
    AI.update();
    const aiInput = AI.getInput();
    
    Physics.update(Input, aiInput);
    Game.update(Input);
    
    // Render
    Render.render();
    updateUI();
    
    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Start game loop
requestAnimationFrame(gameLoop);

