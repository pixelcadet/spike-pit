// Input handling system
// Key mapping: A/D (x-axis), W/S (y-axis), J (jump), I (hit)

const Input = {
    keys: {},
    
    init() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
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

