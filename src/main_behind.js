// Behind-camera game loop (reuses existing game logic, swaps only rendering + movement mapping)

// Initialize all systems
Input.init();
Physics.init();
AI.init();
Game.init();
RenderBehind.init();
Controls.init();

// Update UI
function updateUIBehind() {
    const el = document.getElementById('game-status');
    if (el) el.textContent = Game.getStatusText();
}

// Input proxy for behind-camera controls:
// - W/S should move "forward/back" toward/away from the net (Physics x-axis)
// - A/D should move left/right across the screen (Physics y-axis)
//
// Physics.updatePlayer expects:
// - getHorizontal() -> x-axis
// - getDepth()      -> y-axis
const InputBehind = {
    ...Input,
    getHorizontal() {
        return Input.getDepth(); // W/S -> x
    },
    getDepth() {
        return Input.getHorizontal(); // A/D -> y
    }
};

let lastTime = 0;
function gameLoopBehind(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    if (Input.isResetPressed()) {
        Physics.reset();
    }

    AI.update(deltaTime / 1000);
    const aiInput = AI.getInput();

    // Player actions (I key): same logic as main.js, but still read raw Input for press/hold
    if (Game.state.isServing && Game.state.servingPlayer === 'player') {
        if (Game.state.spikeServePending) {
            // ignore I while pending
        } else {
            if (Input.isPressed('i')) {
                if (!Game.state.isChargingServe) {
                    Game.state.isChargingServe = true;
                    Game.state.serveChargeTimer = 0;
                }
            }
        }
    } else if (Input.shouldAttemptHit()) {
        if (!Physics.player.onGround) {
            const spikeAttempted = Physics.attemptSpike(Physics.player);
            if (!spikeAttempted) {
                Physics.attemptReceive(Physics.player);
            }
        } else {
            Physics.attemptReceive(Physics.player);
        }
        if (Physics.player.justAttemptedAction) {
            Input.consumeHit();
        }
    }

    // AI actions
    if (Game.state.isServing && Game.state.servingPlayer === 'ai') {
        if (Game.state.aiServeTimer <= 0) {
            Game.serveBall();
        }
    } else {
        if (aiInput.spike) Physics.attemptSpike(Physics.ai);
        if (aiInput.receive) Physics.attemptReceive(Physics.ai);
    }

    Physics.update(InputBehind, aiInput, deltaTime / 1000);
    Game.update(Input, deltaTime / 1000);

    RenderBehind.updateHighlights(Input, aiInput);
    RenderBehind.update(deltaTime / 1000);
    RenderBehind.render();
    updateUIBehind();

    requestAnimationFrame(gameLoopBehind);
}

requestAnimationFrame(gameLoopBehind);


