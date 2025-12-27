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
    
    // Movement inputs
    getHorizontal() {
        let dir = 0;
        if (this.isPressed('a')) dir -= 1;
        if (this.isPressed('d')) dir += 1;
        return dir;
    },
    
    getDepth() {
        let dir = 0;
        if (this.isPressed('w')) dir += 1;  // W moves forward (increase y)
        if (this.isPressed('s')) dir -= 1;  // S moves backward (decrease y)
        return dir;
    },
    
    isJumpPressed() {
        return this.isPressed('j');
    },
    
    isHitPressed() {
        return this.isPressed('i');
    },
    
    // Check if any key is pressed (for restart)
    anyKeyPressed() {
        return Object.values(this.keys).some(pressed => pressed === true);
    }
};

