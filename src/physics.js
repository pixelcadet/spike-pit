// Physics system - character movement and jumping only
// All coordinates use world space (x, y, z)

const Physics = {
    // Court dimensions (in world units)
    COURT_WIDTH: 8,      // 8 cells wide (rotated 90 degrees)
    COURT_LENGTH: 4,     // 4 cells long (depth) - 4x4 grid per side
    NET_X: 4,            // Net divides court horizontally (x-axis) at middle (4 cells per side)
    GRAVITY: 0.012,      // Gravity constant for characters
    peakHangMultiplier: 0.15, // Gravity multiplier when near peak (0.0 = no gravity at peak = max hang, 1.0 = full gravity)
    peakVelocityThreshold: 0.02, // When |vz| < this, character is considered "at peak" (tighter window for hang effect)
    
    // Player character
    player: {
        x: 2.0,          // Start on left side (4 cells available)
        y: 2.0,           // Start in middle depth (4 cells deep, middle = 2.0)
        z: 0,            // On ground
        vx: 0,
        vy: 0,
        vz: 0,
        speed: 0.15,
        jumpPower: 0.3,
        radius: 0.345,   // Size for visibility (15% bigger: 0.3 * 1.15)
        onGround: true
    },
    
    // AI character
    ai: {
        x: 6.0,          // Start on right side (4 cells available)
        y: 2.0,           // Start in middle depth (4 cells deep, middle = 2.0)
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        speed: 0.12,
        jumpPower: 0.3,
        radius: 0.345,   // Size for visibility (15% bigger: 0.3 * 1.15)
        onGround: true
    },
    
    init() {
        // Initialize starting positions
    },
    
    updatePlayer(input) {
        const p = this.player;
        
        // Horizontal movement (x-axis)
        const hDir = input.getHorizontal();
        p.vx = hDir * p.speed;
        
        // Depth movement (y-axis)
        const dDir = input.getDepth();
        p.vy = dDir * p.speed;
        
        // Jump
        if (input.isJumpPressed() && p.onGround) {
            p.vz = p.jumpPower;
            p.onGround = false;
        }
        
        // Apply gravity (reduced when very close to peak for hang time)
        // Only affects a small window around the peak, not general ascent/descent
        if (!p.onGround) {
            const absVz = Math.abs(p.vz);
            if (absVz < this.peakVelocityThreshold) {
                // Very close to peak (just before or just after) - apply reduced gravity for hang time
                p.vz -= this.GRAVITY * this.peakHangMultiplier;
            } else {
                // Normal ascent or descent - apply full gravity
                p.vz -= this.GRAVITY;
            }
        }
        
        // Update position
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        
        // Ground collision
        if (p.z <= 0) {
            p.z = 0;
            p.vz = 0;
            p.onGround = true;
        }
        
        // Clamp to player side (x < NET_X, left side)
        // Keep character within court bounds using radius
        const minX = p.radius;
        const maxX = this.NET_X - p.radius;
        const minY = p.radius;
        const maxY = this.COURT_LENGTH - p.radius;
        p.x = Math.max(minX, Math.min(p.x, maxX));
        p.y = Math.max(minY, Math.min(p.y, maxY));
    },
    
    updateAI(aiInput) {
        const ai = this.ai;
        
        // AI movement (set by AI system)
        ai.vx = aiInput.vx || 0;
        ai.vy = aiInput.vy || 0;
        
        // AI jump
        if (aiInput.jump && ai.onGround) {
            ai.vz = ai.jumpPower;
            ai.onGround = false;
        }
        
        // Apply gravity (reduced when very close to peak for hang time)
        // Only affects a small window around the peak, not general ascent/descent
        if (!ai.onGround) {
            const absVz = Math.abs(ai.vz);
            if (absVz < this.peakVelocityThreshold) {
                // Very close to peak (just before or just after) - apply reduced gravity for hang time
                ai.vz -= this.GRAVITY * this.peakHangMultiplier;
            } else {
                // Normal ascent or descent - apply full gravity
                ai.vz -= this.GRAVITY;
            }
        }
        
        // Update position
        ai.x += ai.vx;
        ai.y += ai.vy;
        ai.z += ai.vz;
        
        // Ground collision
        if (ai.z <= 0) {
            ai.z = 0;
            ai.vz = 0;
            ai.onGround = true;
        }
        
        // Clamp to AI side (x > NET_X, right side)
        // Keep character within court bounds using radius
        const minX = this.NET_X + ai.radius;
        const maxX = this.COURT_WIDTH - ai.radius;
        const minY = ai.radius;
        const maxY = this.COURT_LENGTH - ai.radius;
        ai.x = Math.max(minX, Math.min(ai.x, maxX));
        ai.y = Math.max(minY, Math.min(ai.y, maxY));
    },
    
    update(input, aiInput) {
        this.updatePlayer(input);
        this.updateAI(aiInput);
    }
};

