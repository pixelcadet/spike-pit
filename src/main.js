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
    
    // Check for reset (P key) - only allowed when match is over
    if (Input.isResetPressed() && Game.state.matchOver) {
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
        // Normal gameplay: spike/receive/toss (merged I and O buttons with smart context)
        if (!Physics.player.onGround) {
            // Mid-air: check which zone the ball is in
            // Try spike first (if ball in spike zone), then receive (if ball in receiving zone)
            const spikeAttempted = Physics.attemptSpike(Physics.player);
            if (!spikeAttempted) {
                // If spike didn't work (ball not in spike zone), try receive
                Physics.attemptReceive(Physics.player);
            }
        } else {
            // On ground: smart context - check if ball is in spike zone
            // Helper function to check if ball is in spike zone
            const isBallInSpikeZone = () => {
                const ball = Physics.ball;
                const player = Physics.player;
                const spikeZoneRadius = Physics.SPIKE_ZONE_RADIUS + ball.radius;
                
                let forwardOffset = Physics.SPIKE_ZONE_FORWARD_OFFSET;
                const spikeZoneX = player.x + forwardOffset;
                const spikeZoneY = player.y;
                const spikeZoneZ = player.z + Physics.SPIKE_ZONE_UPWARD_OFFSET;
                
                const dx = ball.x - spikeZoneX;
                const dy = ball.y - spikeZoneY;
                const dz = ball.z - spikeZoneZ;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const effectiveRadius = Physics.SPIKE_ZONE_RADIUS + ball.radius;
                
                return dist <= effectiveRadius;
            };
            
            const ballInSpikeZone = isBallInSpikeZone();
            const isAPressed = Input.isPressed('a');
            
            if (ballInSpikeZone && !isAPressed) {
                // Ball is in spike zone and A is NOT pressed: forward toss
                Physics.attemptToss(Physics.player);
            } else if (ballInSpikeZone && isAPressed) {
                // Ball is in spike zone and A IS pressed: vertical toss (receive)
                Physics.attemptReceive(Physics.player);
            } else {
                // Ball is NOT in spike zone: vertical receive (normal behavior)
                Physics.attemptReceive(Physics.player);
            }
        }

        // If an actual action happened (spike/receive/toss), consume the hold so we don't fire again
        // until the player releases I.
        if (Physics.player.justAttemptedAction) {
            Input.consumeHit();
        }
    }
    
    // Check for energy ball shooting (O key, when power meter > 0)
    // Allow shooting multiple times - only prevent if energy ball is already active
    if (Input.shouldShootEnergyBall() && !Physics.energyBall.active) {
        Physics.shootEnergyBall();
        // Decrease power meter by 1
        const newPower = Math.max(0, Game.state.playerPower - 1);
        Game.state.playerPower = newPower;
        // Deactivate power mode when power reaches 0
        if (newPower === 0) {
            Game.state.powerModeActive = false;
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
        // Normal gameplay: spike/receive/toss
        if (aiInput.toss) {
            Physics.attemptToss(Physics.ai);
        }
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

