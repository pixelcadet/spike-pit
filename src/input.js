// Input handling system
// Key mapping: A/D (x-axis), W/S (y-axis), J (jump), I (hit)

const Input = {
    keys: {},
    previousKeys: {}, // Track previous frame's key states
    
    init() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            
            // Handle serve release (I key released during serving)
            // Don't handle release if spike serve is pending (character is jumping)
            if (e.key.toLowerCase() === 'i' && 
                Game.state.isServing && 
                Game.state.servingPlayer === 'player' && 
                Game.state.isChargingServe &&
                !Game.state.spikeServePending) {
                console.log('I key released, charge time:', Game.state.serveChargeTimer);
                // Check minimum charge time - if too short, don't serve
                if (Game.state.serveChargeTimer >= Game.state.minChargeTime) {
                    console.log('Serving with charge');
                    Game.serveBallWithCharge();
                } else {
                    console.log('Charge time too short, not serving');
                }
                Game.state.isChargingServe = false;
                Game.state.serveChargeTimer = 0;
            }
        });
    },
    
    update() {
        // Store current keys for next frame comparison
        this.previousKeys = {...this.keys};
    },
    
    isPressed(key) {
        return this.keys[key.toLowerCase()] === true;
    },
    
    // Movement inputs (disabled when character is falling or serving)
    getHorizontal() {
        if (Physics.player.isFalling) return 0;
        if (Game.state.isServing && Game.state.servingPlayer === 'player') return 0; // Lock movement when serving
        if (Game.state.serveMovementLock > 0) return 0; // Lock movement briefly after serving
        let dir = 0;
        if (this.isPressed('a')) dir -= 1;
        if (this.isPressed('d')) dir += 1;
        return dir;
    },
    
    getDepth() {
        if (Physics.player.isFalling) return 0;
        if (Game.state.isServing && Game.state.servingPlayer === 'player') return 0; // Lock movement when serving
        if (Game.state.serveMovementLock > 0) return 0; // Lock movement briefly after serving
        let dir = 0;
        if (this.isPressed('w')) dir += 1;  // W moves forward (increase y)
        if (this.isPressed('s')) dir -= 1;  // S moves backward (decrease y)
        return dir;
    },
    
    isJumpPressed() {
        if (Physics.player.isFalling) return false;
        if (Game.state.isServing && Game.state.servingPlayer === 'player') return false; // Lock jump when serving
        return this.isPressed('j');
    },
    
    isHitPressed() {
        if (Physics.player.isFalling) return false;
        return this.isPressed('i');
    },
    
    isResetPressed() {
        return this.isPressed('p');
    },
    
    // Check if any key is pressed (for restart)
    anyKeyPressed() {
        return Object.values(this.keys).some(pressed => pressed === true);
    }
};

