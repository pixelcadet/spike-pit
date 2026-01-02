// Input handling system
// Key mapping: A/D (x-axis), W/S (y-axis), J (jump), I (hit)

const Input = {
    keys: {},
    previousKeys: {}, // Track previous frame's key states
    
    // Aim buffering: allow "almost simultaneous" direction + hit inputs
    // (e.g., tap W/S shortly before/after holding I) to still count as aiming.
    _aimDepthDir: 0, // -1 = backward (S), +1 = forward (W)
    _aimDepthTimeMs: -Infinity,
    // Buffered x-axis aim (A/D) for toss aiming.
    _aimXDir: 0, // -1 = left (A), +1 = right (D)
    _aimXTimeMs: -Infinity,
    aimBufferMs: 150,

    // Hit latching: allow holding I to "wait" for timing, but only fire ONE action per hold.
    // Prevents accidental double-actions (e.g., spike then immediate ground receive) that can overwrite ball velocity.
    _hitUsedThisHold: false,
    
    init() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            
            // Track most recent depth-direction intent for buffered aiming.
            // We use W/S because serve aiming already uses W/S and it maps cleanly to y-axis.
            if (key === 'w') {
                this._aimDepthDir = 1;
                this._aimDepthTimeMs = performance.now();
            } else if (key === 's') {
                this._aimDepthDir = -1;
                this._aimDepthTimeMs = performance.now();
            } else if (key === 'a') {
                this._aimXDir = -1;
                this._aimXTimeMs = performance.now();
            } else if (key === 'd') {
                this._aimXDir = 1;
                this._aimXTimeMs = performance.now();
            } else if (key === 'i') {
                // New hold: allow one action during this hold.
                this._hitUsedThisHold = false;
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            
            // Always unblock hit after 'I' is released
            if (e.key.toLowerCase() === 'i') {
                Game.state.blockHitUntilIRelease = false;
                // Release resets per-hold latch.
                this._hitUsedThisHold = false;
            }
            
            // Handle serve release (I key released during serving)
            // Don't handle release if spike serve is pending (character is jumping)
            if (e.key.toLowerCase() === 'i' && 
                Game.state.isServing && 
                Game.state.servingPlayer === 'player' && 
                Game.state.isChargingServe &&
                !Game.state.spikeServePending) {
                // Check minimum charge time - if too short, don't serve
                if (Game.state.serveChargeTimer >= Game.state.minChargeTime) {
                    Game.serveBallWithCharge();
                } else {
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
    
    // Returns -1/0/+1 indicating aim direction along depth (y axis).
    // Accepts sequential inputs within aimBufferMs so players don't need perfect timing.
    getAimDepthDirection(bufferMs = this.aimBufferMs) {
        // If actively held, prefer the live state.
        if (this.isPressed('w')) return 1;
        if (this.isPressed('s')) return -1;
        
        // Otherwise, accept the most recent tap within buffer window.
        const now = performance.now();
        if (now - this._aimDepthTimeMs <= bufferMs) {
            return this._aimDepthDir;
        }
        return 0;
    },
    
    // Returns -1/0/+1 indicating buffered aim direction along x axis (A/D).
    // Accepts sequential inputs within aimBufferMs so players don't need perfect timing.
    getAimXDirection(bufferMs = this.aimBufferMs) {
        if (this.isPressed('d')) return 1;
        if (this.isPressed('a')) return -1;
        
        const now = performance.now();
        if (now - this._aimXTimeMs <= bufferMs) {
            return this._aimXDir;
        }
        return 0;
    },
    
    // Returns a buffered 2D aim vector from WASD, supporting diagonals and sequential presses.
    // Output: { x: -1..1, y: -1..1 } (not normalized).
    getAim2D(bufferMs = this.aimBufferMs) {
        const x = this.getAimXDirection(bufferMs);
        const y = this.getAimDepthDirection(bufferMs);
        return { x, y };
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
        if (Game.state.blockHitUntilIRelease) return false;
        return this.isPressed('i');
    },
    
    isTossPressed() {
        if (Physics.player.isFalling) return false;
        return this.isPressed('o');
    },
    
    // Check if energy ball should be shot (O key pressed, when outline is yellow/power mode active)
    shouldShootEnergyBall() {
        if (Physics.player.isFalling) return false;
        if (Game.state.isServing) return false; // Can't shoot during serve
        if (Game.state.isResetting) return false; // Can't shoot during reset after scoring
        if (!this.isPressed('o')) return false;
        // Can only shoot when power mode is active (outline is yellow)
        return Game.state.powerModeActive === true;
    },

    // For rally actions: "I is held and not yet used this hold".
    // This still allows holding I to time the hit, but prevents repeated actions while held.
    shouldAttemptHit() {
        return this.isHitPressed() && !this._hitUsedThisHold;
    },

    consumeHit() {
        this._hitUsedThisHold = true;
    },
    
    isResetPressed() {
        return this.isPressed('p');
    },
    
    // Check if any key is pressed (for restart)
    anyKeyPressed() {
        return Object.values(this.keys).some(pressed => pressed === true);
    }
};

