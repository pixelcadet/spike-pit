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
    
    // Check for player actions (I key pressed)
    if (Input.isHitPressed()) {
        // If serving, handle serve
        if (Game.state.isServing && Game.state.servingPlayer === 'player') {
            Game.serveBall();
        } else {
            // Normal gameplay: spike/receive
            if (!Physics.player.onGround) {
                // Mid-air: check which zone the ball is in
                // Try spike first (if ball in spike zone), then receive (if ball in receiving zone)
                const spikeAttempted = Physics.attemptSpike(Physics.player);
                if (!spikeAttempted) {
                    // If spike didn't work (ball not in spike zone), try receive
                    Physics.attemptReceive(Physics.player);
                }
            } else {
                // On ground: attempt receive
                Physics.attemptReceive(Physics.player);
            }
        }
    }
    
    // Check for AI actions
    // If AI is serving, handle serve
    if (Game.state.isServing && Game.state.servingPlayer === 'ai') {
        // AI serves automatically after a short delay
        // For now, AI serves immediately (you can add delay later if needed)
        Game.serveBall();
    } else {
        // Normal gameplay: spike/receive
        if (aiInput.spike) {
            Physics.attemptSpike(Physics.ai);
        }
        if (aiInput.receive) {
            Physics.attemptReceive(Physics.ai);
        }
    }
    
    Physics.update(Input, aiInput, deltaTime / 1000); // Convert to seconds
    Game.update(Input, deltaTime / 1000); // Convert to seconds
    
    // Update visual highlights
    Render.updateHighlights(Input, aiInput);
    
    // Render
    Render.render();
    updateUI();
    
    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Start game loop
requestAnimationFrame(gameLoop);

