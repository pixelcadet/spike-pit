// Behind-camera game loop (reuses existing game logic, swaps only rendering + movement mapping)

// Initialize all systems
Input.init();
Physics.init();
AI.init();
Game.init();
RenderBehind.init();
Controls.init();

// Sandbox mode for behind-camera iteration:
// - no serving (so the ball isn't "held" above heads)
// - no scoring / resets / splash
Game.state.disableScoring = true;
Game.state.isServing = false;
Game.state.isResetting = false;
Game.state.spikeServePending = false;
Game.state.isChargingServe = false;
Physics.ball.justServed = false;
Physics.ball.serveTimer = 0;
Physics.ball.fallingThroughHole = false;

// Start the ball in-play near the net for easy testing.
Physics.ball.x = Physics.NET_X - 0.6;
Physics.ball.y = Physics.COURT_LENGTH * 0.5;
Physics.ball.z = 1.2;
Physics.ball.vx = 0.02;
Physics.ball.vy = 0.0;
Physics.ball.vz = 0.10;

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

    // Player actions (I key): sandbox mode has no serving; always treat I as spike/receive.
    if (Input.shouldAttemptHit()) {
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

    // AI actions (no serving in sandbox)
    if (aiInput.spike) Physics.attemptSpike(Physics.ai);
    if (aiInput.receive) Physics.attemptReceive(Physics.ai);

    Physics.update(InputBehind, aiInput, deltaTime / 1000);
    Game.update(Input, deltaTime / 1000);

    RenderBehind.updateHighlights(Input, aiInput);
    RenderBehind.update(deltaTime / 1000);
    RenderBehind.render();
    updateUIBehind();

    // If the ball goes way out / falls too deep, respawn it near the net (sandbox convenience).
    const b = Physics.ball;
    const tooFar =
        b.x < -2 || b.x > Physics.COURT_WIDTH + 2 ||
        b.y < -2 || b.y > Physics.COURT_LENGTH + 2 ||
        b.z < -6;
    if (tooFar) {
        b.x = Physics.NET_X - 0.6;
        b.y = Physics.COURT_LENGTH * 0.5;
        b.z = 1.2;
        b.vx = 0.02;
        b.vy = 0.0;
        b.vz = 0.10;
        b.justServed = false;
        b.serveTimer = 0;
        b.fallingThroughHole = false;
        b.hasScored = false;
    }

    requestAnimationFrame(gameLoopBehind);
}

requestAnimationFrame(gameLoopBehind);


