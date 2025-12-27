// AI system - simple wandering AI for movement testing

const AI = {
    // AI state
    state: {
        targetX: 0,
        targetY: 0,
        shouldJump: false,
        wanderTimer: 0
    },
    
    // AI parameters
    reactionSpeed: 0.12,
    wanderInterval: 120, // Change direction every 2 seconds (at 60fps)
    
    init() {
        // AI starts on right side
        const ai = Physics.ai;
        this.state.targetX = 0;
        this.state.targetY = 0;
        this.state.wanderTimer = 0;
    },
    
    update() {
        const ai = Physics.ai;
        
        // Simple wandering behavior - change direction periodically
        this.state.wanderTimer++;
        if (this.state.wanderTimer >= this.wanderInterval) {
            // Pick a random direction within bounds
            // AI is on right side (x > NET_X), so prefer moving within that area
            const centerX = 6.0;  // Middle of AI side
            const centerY = Physics.COURT_LENGTH / 2;  // Middle depth
            
            // Random offset from center
            const offsetX = (Math.random() - 0.5) * 2.0; // -1 to 1
            const offsetY = (Math.random() - 0.5) * 1.0; // -0.5 to 0.5
            
            const targetX = centerX + offsetX;
            const targetY = centerY + offsetY;
            
            // Calculate direction toward target
            const dx = targetX - ai.x;
            const dy = targetY - ai.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0.1) {
                this.state.targetX = dx / dist;
                this.state.targetY = dy / dist;
            } else {
                this.state.targetX = 0;
                this.state.targetY = 0;
            }
            
            this.state.wanderTimer = 0;
        }
        
        // Occasionally jump (random)
        this.state.shouldJump = Math.random() < 0.01 && ai.onGround;
    },
    
    getInput() {
        return {
            vx: this.state.targetX * this.reactionSpeed,
            vy: this.state.targetY * this.reactionSpeed,
            jump: this.state.shouldJump
        };
    }
};

