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
    AI.update(deltaTime / 1000);
    const aiInput = AI.getInput();
    
    // Check for player actions (I key)
    // Handle serve charging (hold and release) - only for player serves
    if (Game.state.isServing && Game.state.servingPlayer === 'player') {
        // Don't allow charging if spike serve is pending (character is jumping)
        // Completely ignore 'I' input when spike serve is pending - user must release and press again
        if (Game.state.spikeServePending) {
            // Ignore all 'I' input until spike serve completes
            // This prevents any interference with the pending spike serve
        } else {
            // Check if I key is being held (keydown) - start charging
            if (Input.isPressed('i')) {
                if (!Game.state.isChargingServe) {
                    // Start charging serve
                    Game.state.isChargingServe = true;
                    Game.state.serveChargeTimer = 0;
                }
            } else {
                // If I key is not pressed but we were charging, don't reset here
                // (keyup handler will handle the release)
            }
        }
        // Keyup is handled in Input.init() keyup event listener
    } else if (Input.shouldAttemptHit()) {
        // Normal gameplay: spike/receive (controlled character only)
        const controlledChar = Physics.controlledCharacter;
        if (controlledChar) {
            if (!controlledChar.onGround) {
                // Mid-air: check which zone the ball is in
                // Try spike first (if ball in spike zone), then receive (if ball in receiving zone)
                const spikeAttempted = Physics.attemptSpike(controlledChar);
                if (!spikeAttempted) {
                    // If spike didn't work (ball not in spike zone), try receive
                    Physics.attemptReceive(controlledChar);
                }
            } else {
                // On ground: attempt receive
                Physics.attemptReceive(controlledChar);
            }

            // If an actual action happened (spike/receive/toss), consume the hold so we don't fire again
            // until the player releases I.
            if (controlledChar.justAttemptedAction) {
                Input.consumeHit();
            }
        }
    }
    
    // Check for AI actions
    // If AI is serving, handle serve
    if (Game.state.isServing && Game.state.servingPlayer === 'ai') {
        // AI serves automatically after a short delay (pacing + "SCORED" splash)
        if (Game.state.aiServeTimer <= 0) {
            Game.serveBall();
        }
    } else {
        // Normal gameplay: spike/receive for AI team
        if (Physics.aiTeam) {
            for (const ai of Physics.aiTeam) {
                if (aiInput.spike) {
                    Physics.attemptSpike(ai);
                }
                if (aiInput.receive) {
                    Physics.attemptReceive(ai);
                }
            }
        }
    }
    
    Physics.update(Input, aiInput, deltaTime / 1000); // Convert to seconds
    Game.update(Input, deltaTime / 1000); // Convert to seconds
    
    // Update visual highlights
    Render.updateHighlights(Input, aiInput);

    // Update render-side animations (camera shake, etc.)
    Render.update(deltaTime / 1000);
    
    // Render
    Render.render();
    updateUI();
    
    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Start game loop
requestAnimationFrame(gameLoop);

