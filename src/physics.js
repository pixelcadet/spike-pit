// Physics system - character movement and jumping only
// All coordinates use world space (x, y, z)

const Physics = {
    // Court dimensions (in world units)
    COURT_WIDTH: 8,      // 8 cells wide (rotated 90 degrees)
    COURT_LENGTH: 4,     // 4 cells long (depth) - 4x4 grid per side
    NET_X: 4,            // Net divides court horizontally (x-axis) at middle (4 cells per side)
    NET_HEIGHT: 1.0,     // Net height in world units
    NET_TOP_THRESHOLD: 0.05, // Threshold for top edge collision (ball can hit top tape)
    GRAVITY: 0.012,      // Gravity constant for characters
    ballMovementSpeed: 1.0, // Ball movement speed multiplier (1.0 = normal, lower = slower)
    peakHangMultiplier: 0.15, // Gravity multiplier when near peak (0.0 = no gravity at peak = max hang, 1.0 = full gravity)
    peakVelocityThreshold: 0.02, // When |vz| < this, character is considered "at peak" (tighter window for hang effect)
    
    // Spike zone parameters
    SPIKE_ZONE_RADIUS: 0.96,     // Radius of spike zone sphere (default: slider 5)
    SPIKE_ZONE_HEAD_OFFSET: 0.6, // Height above character center for spike zone
    SPIKE_ZONE_FORWARD_OFFSET: 0.3, // Forward offset (toward net) so can't hit balls behind character
    SPIKE_ZONE_UPWARD_OFFSET: 0.2, // Upward offset above character center mass
    SPIKE_POWER: 0.3,            // Power for spike (straight trajectory, fast)
    SPIKE_LOB_POWER: 0.12,      // Power for lob (arching trajectory, slow) - when below/at net height
    SPIKE_LOB_ARCH_HEIGHT: 0.4, // Upward component for lob arching trajectory
    
    // Receiving zone parameters
    RECEIVING_ZONE_RADIUS: 1.2,  // Radius of receiving zone (bigger than spike zone)
    RECEIVE_MOVE_SPEED: 0.25,    // Speed boost when moving toward ball to receive
    RECEIVE_POWER: 0.12,         // Power for receiving hit (weaker than spike, arching trajectory)
    RECEIVE_ARCH_HEIGHT: 0.4,    // Upward component for arching trajectory (higher arc)
    
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
        radius: 0.414,   // Size (20% bigger: 0.345 * 1.2)
        onGround: true,
        hasSpiked: false, // Spike cooldown flag (reset when landing)
        hasReceived: false, // Receive cooldown flag (reset when landing)
        justAttemptedAction: false, // Flag to prevent collision bounce when action was just attempted
        isFalling: false, // Falling state
        fallTimer: 0, // Timer for falling duration (1 second)
        fallEdge: null, // Which edge they fell from ('A', 'B', or 'C')
        isBlinking: false, // Blinking state after respawn
        blinkTimer: 0 // Timer for blinking duration (1 second)
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
        radius: 0.414,   // Size (20% bigger: 0.345 * 1.2)
        onGround: true,
        hasSpiked: false, // Spike cooldown flag (reset when landing)
        hasReceived: false, // Receive cooldown flag (reset when landing)
        justAttemptedAction: false, // Flag to prevent collision bounce when action was just attempted
        isFalling: false, // Falling state
        fallTimer: 0, // Timer for falling duration (1 second)
        fallEdge: null, // Which edge they fell from ('A', 'B', or 'C')
        isBlinking: false, // Blinking state after respawn
        blinkTimer: 0 // Timer for blinking duration (1 second)
    },
    
    // Ball
    ball: {
        x: 2.0,          // Start on player side
        y: 2.0,           // Middle depth
        z: 2.0,          // Start above character (will drop down)
        vx: 0,
        vy: 0,
        vz: 0,
        radius: 0.3036, // Ball size (15% bigger: 0.264 * 1.15)
        groundLevel: 0,
        bounceDamping: 0.7,  // Energy loss on bounce (0.7 = 70% of velocity retained)
        friction: 0.9,       // Ground friction (0.9 = 90% of velocity retained)
        lastTouchedBy: null, // Track who last touched the ball ('player' or 'ai')
        hasScored: false,    // Flag to prevent multiple scores from same bounce/fall
        justServed: false,   // Flag to prevent immediate collision after serve
        serveTimer: 0         // Timer for serve grace period
    },
    
    init() {
        // Initialize ball position above player
        this.resetBall();
    },
    
    resetBall() {
        // Position ball above player character
        this.ball.x = this.player.x;
        this.ball.y = this.player.y;
        this.ball.z = 2.0; // Above character
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.vz = 0;
        this.ball.lastTouchedBy = null;
        this.ball.hasScored = false;
        this.ball.justServed = false;
        this.ball.serveTimer = 0;
    },
    
    reset() {
        // Reset player to middle of their side (matching starting state)
        this.player.x = this.COURT_WIDTH * 0.25; // Middle of player side
        this.player.y = this.COURT_LENGTH * 0.5; // Middle depth
        this.player.z = 0;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.vz = 0;
        this.player.onGround = true;
        this.player.hasSpiked = false;
        this.player.hasReceived = false;
        this.player.isFalling = false;
        this.player.fallTimer = 0;
        this.player.fallEdge = null;
        this.player.isBlinking = false;
        this.player.blinkTimer = 0;
        
        // Reset AI to middle of their side (matching starting state)
        this.ai.x = this.COURT_WIDTH * 0.75; // Middle of AI side
        this.ai.y = this.COURT_LENGTH * 0.5; // Middle depth
        this.ai.z = 0;
        this.ai.vx = 0;
        this.ai.vy = 0;
        this.ai.vz = 0;
        this.ai.onGround = true;
        this.ai.hasSpiked = false;
        this.ai.hasReceived = false;
        this.ai.isFalling = false;
        this.ai.fallTimer = 0;
        this.ai.fallEdge = null;
        this.ai.isBlinking = false;
        this.ai.blinkTimer = 0;
        
        // Reset game state to starting state (scores, serving)
        Game.init();
    },
    
    // Calculate what percentage of the footprint is outside each court edge
    // Returns an object with percentages for each edge
    // Edge labels (from camera view):
    // - EDGE A: Top side of screen (back of court, y = COURT_LENGTH) - threshold 80%
    // - EDGE B: Left side of screen (opposite from net, x = 0 for player, x = COURT_WIDTH for AI) - threshold 80%
    // - EDGE C: Bottom side of screen (front of court, y = 0) - threshold 20%
    getFootprintOutsidePercentages(character) {
        const footprintWidth = character.radius * 1.2;
        const footprintDepth = character.radius * 0.5;
        
        // Calculate footprint box edges
        const footprintLeft = character.x - footprintWidth * 0.5;
        const footprintRight = character.x + footprintWidth * 0.5;
        const footprintFront = character.y - footprintDepth * 0.5;
        const footprintBack = character.y + footprintDepth * 0.5;
        
        let edgeA_Outside = 0; // Top side of screen (back of court, y = COURT_LENGTH)
        let edgeB_Outside = 0; // Left side of screen (opposite from net)
        let edgeC_Outside = 0; // Bottom side of screen (front of court, y = 0)
        
        if (character === this.player) {
            // Player side: x from 0 to NET_X, y from 0 to COURT_LENGTH
            // EDGE A: Top side of screen (back of court, y = COURT_LENGTH) - threshold 70%
            const backOutside = Math.max(0, footprintBack - this.COURT_LENGTH);
            edgeA_Outside = Math.min(1.0, backOutside / footprintDepth);
            
            // EDGE B: Left side of screen (opposite from net, x = 0) - threshold 70%
            const leftOutside = Math.max(0, 0 - footprintLeft);
            edgeB_Outside = Math.min(1.0, leftOutside / footprintWidth);
            
            // EDGE C: Bottom side of screen (front of court, y = 0) - threshold 10%
            const frontOutside = Math.max(0, 0 - footprintFront);
            edgeC_Outside = Math.min(1.0, frontOutside / footprintDepth);
        } else {
            // AI side: x from NET_X to COURT_WIDTH, y from 0 to COURT_LENGTH
            // EDGE A: Top side of screen (back of court, y = COURT_LENGTH) - threshold 70%
            const backOutside = Math.max(0, footprintBack - this.COURT_LENGTH);
            edgeA_Outside = Math.min(1.0, backOutside / footprintDepth);
            
            // EDGE B: Left side of screen (opposite from net, x = COURT_WIDTH) - threshold 70%
            const rightOutside = Math.max(0, footprintRight - this.COURT_WIDTH);
            edgeB_Outside = Math.min(1.0, rightOutside / footprintWidth);
            
            // EDGE C: Bottom side of screen (front of court, y = 0) - threshold 10%
            const frontOutside = Math.max(0, 0 - footprintFront);
            edgeC_Outside = Math.min(1.0, frontOutside / footprintDepth);
        }
        
        return {
            edgeA: edgeA_Outside,  // Top side of screen (back of court)
            edgeB: edgeB_Outside,  // Left side of screen (opposite from net)
            edgeC: edgeC_Outside   // Bottom side of screen (front of court)
        };
    },
    
    // Check if character's footprint is at least partially on the court
    // Uses different thresholds for different edges
    // Edge labels (from camera view):
    // - EDGE A: Top side of screen (back of court) - threshold 70%
    // - EDGE B: Left side of screen (opposite from net) - threshold 70%
    // - EDGE C: Bottom side of screen (front of court) - threshold 10%
    isFootprintOnCourt(character) {
        const percentages = this.getFootprintOutsidePercentages(character);
        
        // Character falls if any edge exceeds its threshold:
        const edgeA_Threshold = 0.7; // Top side (back of court) - can lean more
        const edgeB_Threshold = 0.7; // Left side (opposite from net) - can lean more
        const edgeC_Threshold = 0.1; // Bottom side (front of court) - falls quickly
        
        // Character can stand if all edges are below their thresholds
        return percentages.edgeA < edgeA_Threshold && 
               percentages.edgeB < edgeB_Threshold && 
               percentages.edgeC < edgeC_Threshold;
    },
    
    // Check if ball is on the court (accounting for ball radius)
    // Ball is "on court" if any part of it overlaps the court boundaries
    isBallOnCourt() {
        const b = this.ball;
        
        // Court boundaries: x from 0 to COURT_WIDTH, y from 0 to COURT_LENGTH
        // Account for ball radius - ball is on court if its center is within
        // (radius) distance of the court boundaries
        
        // Check horizontal bounds (x-axis)
        // Ball is on court if center is between -radius and COURT_WIDTH + radius
        const onCourtX = (b.x + b.radius >= 0) && (b.x - b.radius <= this.COURT_WIDTH);
        
        // Check depth bounds (y-axis)
        // Ball is on court if center is between -radius and COURT_LENGTH + radius
        const onCourtY = (b.y + b.radius >= 0) && (b.y - b.radius <= this.COURT_LENGTH);
        
        return onCourtX && onCourtY;
    },
    
    updatePlayer(input) {
        const p = this.player;
        
        // SIMPLE FALLING/RESPAWN SYSTEM
        // Only trigger falling when character is actually falling (on ground and off court, or z < -2)
        // Don't trigger during jumps - allow characters to jump over edges
        const isOffCourt = !this.isFootprintOnCourt(p);
        const hasFallenTooFar = p.z < -2.0;
        const isOnGroundAndOffCourt = p.onGround && isOffCourt;
        
        // Only start falling if: (on ground and off court) OR (fallen too far below)
        // This allows jumping over edges without triggering falling state
        if ((isOnGroundAndOffCourt || hasFallenTooFar) && !p.isFalling) {
            p.isFalling = true;
            p.fallTimer = 0;
            // Determine which edge they fell from
            const percentages = this.getFootprintOutsidePercentages(p);
            if (percentages.edgeA >= 0.7) {
                p.fallEdge = 'A';
            } else if (percentages.edgeB >= 0.7) {
                p.fallEdge = 'B';
            } else if (percentages.edgeC >= 0.1) {
                p.fallEdge = 'C';
            } else {
                p.fallEdge = 'A'; // Default
            }
        }
        
        // Handle falling state - MUST be first, before any movement processing
        if (p.isFalling) {
            // After 1 second, respawn
            if (p.fallTimer >= 1.0) {
                this.respawnCharacter(p);
                p.isFalling = false;
                p.fallTimer = 0;
                p.fallEdge = null;
                // After respawn, allow normal movement again - don't return early
                // Continue with normal update logic below
            } else {
                // Still falling - disable all controls while falling - still apply gravity though
                if (!p.onGround) {
                    const absVz = Math.abs(p.vz);
                    if (absVz < this.peakVelocityThreshold) {
                        p.vz -= this.GRAVITY * this.peakHangMultiplier;
                    } else {
                        p.vz -= this.GRAVITY;
                    }
                }
                // Update position (only gravity affects it)
                p.z += p.vz;
                // Don't allow getting back on court while falling - keep falling until timer expires
                return;
            }
        }
        
        // Check if we're in receiving mode (ball in zone but not at center)
        // If so, automatic movement takes priority
        let isReceiving = false;
        if (input.isHitPressed()) {
            const b = this.ball;
            // Check if ball is in receiving zone
            const receiveZoneX = p.x;
            const receiveZoneY = p.y;
            const receiveZoneZ = p.z;
            const dx = b.x - receiveZoneX;
            const dy = b.y - receiveZoneY;
            const dz = b.z - receiveZoneZ;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const effectiveRadius = this.RECEIVING_ZONE_RADIUS + b.radius;
            
            if (dist <= effectiveRadius && b.z > b.groundLevel) {
                // Ball is in receiving zone and mid-air
                const horizontalDist = Math.sqrt(dx * dx + dy * dy);
                const centerThreshold = this.RECEIVING_ZONE_RADIUS * 0.3;
                
                // If not close to center, we're in receiving mode (automatic movement active)
                if (horizontalDist > centerThreshold) {
                    isReceiving = true;
                }
            }
        }
        
        // Lock movement and jump when serving
        if (Game.state.isServing && Game.state.servingPlayer === 'player') {
            // Character cannot move or jump while serving
            p.vx = 0;
            p.vy = 0;
            if (p.onGround) {
                p.vz = 0;
            }
        } else {
            // Apply blinking penalty: half speed and jump power while blinking
            const speedMultiplier = p.isBlinking ? 0.5 : 1.0;
            const jumpMultiplier = p.isBlinking ? 0.5 : 1.0;
            
            // Horizontal movement (x-axis)
            const hDir = input.getHorizontal();
            // If receiving, don't override automatic movement (it's already set by attemptReceive)
            if (!isReceiving) {
                p.vx = hDir * p.speed * speedMultiplier;
            } else {
                // Combine automatic movement with manual input (manual adds to automatic)
                const manualVx = hDir * p.speed * speedMultiplier;
                p.vx += manualVx * 0.3; // Manual input adds 30% influence
            }
            
            // Depth movement (y-axis)
            const dDir = input.getDepth();
            // If receiving, don't override automatic movement
            if (!isReceiving) {
                p.vy = dDir * p.speed * speedMultiplier;
            } else {
                // Combine automatic movement with manual input
                const manualVy = dDir * p.speed * speedMultiplier;
                p.vy += manualVy * 0.3; // Manual input adds 30% influence
            }
            
            // Jump
            if (input.isJumpPressed() && p.onGround) {
                p.vz = p.jumpPower * jumpMultiplier;
                p.onGround = false;
            }
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
        
        // Ground collision - only if footprint is on court
        if (p.z <= 0) {
            // Check if character's body edge would overlap with the net
            // Player is on left side, so check if right edge (x + radius) would cross net
            const characterRightEdge = p.x + p.radius;
            const isTooCloseToNet = characterRightEdge >= this.NET_X;
            
            if (isTooCloseToNet) {
                // Push character away so body edge aligns with net
                // Set character's right edge to be exactly at the net
                p.x = this.NET_X - p.radius;
            }
            
            // Only allow standing if footprint is on court (less than 70% outside)
            if (this.isFootprintOnCourt(p) && !p.isFalling) {
                p.z = 0; // Clamp to ground level only if on court
                p.vz = 0;
                p.onGround = true;
                p.hasSpiked = false; // Reset spike cooldown when landing
                p.hasReceived = false; // Reset receive cooldown when landing
            } else {
                // Footprint exceeds threshold on at least one edge - character falls through
                p.onGround = false;
                // Don't reset vz to 0, let gravity continue pulling down
                // Don't clamp z to 0, let them fall below ground level
            }
        }
        
        // Check if character stepped off court while on ground
        if (p.onGround && !this.isFootprintOnCourt(p)) {
            p.onGround = false; // Start falling immediately
            
            // Add a gentle push away from court center for natural sliding-off animation
            const percentages = this.getFootprintOutsidePercentages(p);
            // Check if any edge exceeds its threshold (EDGE A: 70%, EDGE B: 70%, EDGE C: 10%)
            if (percentages.edgeA >= 0.7 || percentages.edgeB >= 0.7 || percentages.edgeC >= 0.1) {
                // Calculate direction from court center to character
                const courtCenterX = this.NET_X * 0.5; // Center of player's side
                const courtCenterY = this.COURT_LENGTH * 0.5;
                
                const dirX = p.x - courtCenterX;
                const dirY = p.y - courtCenterY;
                const dist = Math.sqrt(dirX * dirX + dirY * dirY);
                
                if (dist > 0.01) { // Avoid division by zero
                    // Normalize direction and apply gentle push (15% of movement speed)
                    const pushStrength = p.speed * 0.15;
                    p.vx += (dirX / dist) * pushStrength;
                    p.vy += (dirY / dist) * pushStrength;
                }
            }
        }
        
        // Prevent player from crossing the net horizontally
        // Check if character's body edge (right edge for player) would cross net
        const characterRightEdge = p.x + p.radius;
        if (characterRightEdge >= this.NET_X) {
            // Push character away so body edge aligns with net
            p.x = this.NET_X - p.radius;
        }
        
        // Prevent player from standing on top of the net (mid-air)
        // Check if character's body edge is too close to net AND z position is at/above net height
        if (characterRightEdge >= this.NET_X && p.z >= this.NET_HEIGHT) {
            // Push character away from the net horizontally
            p.x = this.NET_X - p.radius;
            // If on ground, also push them down slightly to prevent floating
            if (p.onGround && p.z <= this.NET_HEIGHT + 0.1) {
                p.z = Math.max(0, p.z - 0.05);
            }
        }
    },
    
    updateAI(aiInput) {
        const ai = this.ai;
        
        // SIMPLE FALLING/RESPAWN SYSTEM
        // Only trigger falling when character is actually falling (on ground and off court, or z < -2)
        // Don't trigger during jumps - allow characters to jump over edges
        const isOffCourt = !this.isFootprintOnCourt(ai);
        const hasFallenTooFar = ai.z < -2.0;
        const isOnGroundAndOffCourt = ai.onGround && isOffCourt;
        
        // Only start falling if: (on ground and off court) OR (fallen too far below)
        // This allows jumping over edges without triggering falling state
        if ((isOnGroundAndOffCourt || hasFallenTooFar) && !ai.isFalling) {
            ai.isFalling = true;
            ai.fallTimer = 0;
            // Determine which edge they fell from
            const percentages = this.getFootprintOutsidePercentages(ai);
            if (percentages.edgeA >= 0.7) {
                ai.fallEdge = 'A';
            } else if (percentages.edgeB >= 0.7) {
                ai.fallEdge = 'B';
            } else if (percentages.edgeC >= 0.1) {
                ai.fallEdge = 'C';
            } else {
                ai.fallEdge = 'A'; // Default
            }
        }
        
        // Handle falling state - MUST be first, before any movement processing
        if (ai.isFalling) {
            // After 1 second, respawn
            if (ai.fallTimer >= 1.0) {
                this.respawnCharacter(ai);
                ai.isFalling = false;
                ai.fallTimer = 0;
                ai.fallEdge = null;
                // After respawn, allow normal movement again - don't return early
                // Continue with normal update logic below
            } else {
                // Still falling - disable all controls while falling - still apply gravity though
                if (!ai.onGround) {
                    const absVz = Math.abs(ai.vz);
                    if (absVz < this.peakVelocityThreshold) {
                        ai.vz -= this.GRAVITY * this.peakHangMultiplier;
                    } else {
                        ai.vz -= this.GRAVITY;
                    }
                }
                // Update position (only gravity affects it)
                ai.z += ai.vz;
                // Don't allow getting back on court while falling - keep falling until timer expires
                return;
            }
        }
        
        // Lock movement and jump when serving
        if (Game.state.isServing && Game.state.servingPlayer === 'ai') {
            // AI cannot move or jump while serving
            ai.vx = 0;
            ai.vy = 0;
            if (ai.onGround) {
                ai.vz = 0;
            }
        } else {
            // Apply blinking penalty: half speed and jump power while blinking
            const speedMultiplier = ai.isBlinking ? 0.5 : 1.0;
            const jumpMultiplier = ai.isBlinking ? 0.5 : 1.0;
            
            // AI movement (set by AI system)
            ai.vx = (aiInput.vx || 0) * speedMultiplier;
            ai.vy = (aiInput.vy || 0) * speedMultiplier;
            
            // AI jump
            if (aiInput.jump && ai.onGround) {
                ai.vz = ai.jumpPower * jumpMultiplier;
                ai.onGround = false;
            }
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
        
        // Ground collision - only if footprint is on court
        if (ai.z <= 0) {
            // Check if character's body edge would overlap with the net
            // AI is on right side, so check if left edge (x - radius) would cross net
            const characterLeftEdge = ai.x - ai.radius;
            const isTooCloseToNet = characterLeftEdge <= this.NET_X;
            
            if (isTooCloseToNet) {
                // Push character away so body edge aligns with net
                // Set character's left edge to be exactly at the net
                ai.x = this.NET_X + ai.radius;
            }
            
            // Only allow standing if footprint is on court (edge-specific thresholds) and not falling
            if (this.isFootprintOnCourt(ai) && !ai.isFalling) {
                ai.z = 0; // Clamp to ground level only if on court
                ai.vz = 0;
                ai.onGround = true;
                ai.hasSpiked = false; // Reset spike cooldown when landing
                ai.hasReceived = false; // Reset receive cooldown when landing
            } else {
                // Footprint exceeds threshold on at least one edge - character falls through
                ai.onGround = false;
                // Don't reset vz to 0, let gravity continue pulling down
                // Don't clamp z to 0, let them fall below ground level
            }
        }
        
        // Check if character stepped off court while on ground (70% threshold)
        if (ai.onGround && !this.isFootprintOnCourt(ai)) {
            ai.onGround = false; // Start falling immediately
            
            // Add a gentle push away from court center for natural sliding-off animation
            const percentages = this.getFootprintOutsidePercentages(ai);
            // Check if any edge exceeds its threshold (EDGE A: 70%, EDGE B: 70%, EDGE C: 10%)
            if (percentages.edgeA >= 0.7 || percentages.edgeB >= 0.7 || percentages.edgeC >= 0.1) {
                // Calculate direction from court center to character
                // AI is on the right side, so court center is on AI's side
                const courtCenterX = this.NET_X + (this.COURT_WIDTH - this.NET_X) * 0.5; // Center of AI's side
                const courtCenterY = this.COURT_LENGTH * 0.5;
                
                const dirX = ai.x - courtCenterX;
                const dirY = ai.y - courtCenterY;
                const dist = Math.sqrt(dirX * dirX + dirY * dirY);
                
                if (dist > 0.01) { // Avoid division by zero
                    // Normalize direction and apply gentle push (15% of movement speed)
                    const pushStrength = ai.speed * 0.15;
                    ai.vx += (dirX / dist) * pushStrength;
                    ai.vy += (dirY / dist) * pushStrength;
                }
            }
        }
        
        // Prevent AI from crossing the net horizontally
        // Check if character's body edge (left edge for AI) would cross net
        const characterLeftEdge = ai.x - ai.radius;
        if (characterLeftEdge <= this.NET_X) {
            // Push character away so body edge aligns with net
            ai.x = this.NET_X + ai.radius;
        }
        
        // Prevent AI from standing on top of the net (mid-air)
        // Check if character's body edge is too close to net AND z position is at/above net height
        if (characterLeftEdge <= this.NET_X && ai.z >= this.NET_HEIGHT) {
            // Push character away from the net horizontally
            ai.x = this.NET_X + ai.radius;
            // If on ground, also push them down slightly to prevent floating
            if (ai.onGround && ai.z <= this.NET_HEIGHT + 0.1) {
                ai.z = Math.max(0, ai.z - 0.05);
            }
        }
    },
    
    checkBallCharacterCollision(character) {
        // Skip collision bounce if character just attempted an action (spike/receive)
        // This prevents the bounce from overriding the action's velocity
        if (character.justAttemptedAction) {
            return false;
        }
        
        // Skip collision if ball was just served (prevents immediate collision with serving character)
        if (this.ball.justServed) {
            return false;
        }
        
        const b = this.ball;
        const dx = b.x - character.x;
        const dy = b.y - character.y;
        const dz = b.z - character.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const collisionDist = b.radius + character.radius;
        
        if (dist < collisionDist) {
            // Collision detected - calculate bounce
            const pushDirX = dx / dist;
            const pushDirY = dy / dist;
            const pushDirZ = dz / dist;
            
            // Move ball to just outside character
            b.x = character.x + pushDirX * (collisionDist + 0.05);
            b.y = character.y + pushDirY * (collisionDist + 0.05);
            b.z = character.z + pushDirZ * (collisionDist + 0.05);
            
            // Ensure ball doesn't go below ground
            if (b.z < b.groundLevel) {
                b.z = b.groundLevel;
            }
            
            // Calculate bounce velocity based on character's movement
            // Character's velocity contributes to ball's bounce
            const characterSpeed = Math.sqrt(character.vx * character.vx + character.vy * character.vy);
            const bouncePower = 0.15; // Base bounce power
            const speedMultiplier = Math.min(characterSpeed * 2, 0.1); // Character speed adds to bounce
            
            // Bounce direction: opposite of collision normal + character velocity influence
            // The ball bounces away from the character in the direction opposite to where it came from
            // Plus it gets pushed in the direction the character is moving
            // Scale by ballMovementSpeed to maintain same trajectory at different time scales
            b.vx = (pushDirX * (bouncePower + speedMultiplier) + character.vx * 0.3) * this.ballMovementSpeed;
            b.vy = (pushDirY * (bouncePower + speedMultiplier) + character.vy * 0.3) * this.ballMovementSpeed;
            b.vz = (pushDirZ * (bouncePower + speedMultiplier) + 0.1) * this.ballMovementSpeed; // Always add some upward component
            
            // Apply bounce damping
            b.vx *= b.bounceDamping;
            b.vy *= b.bounceDamping;
            b.vz *= b.bounceDamping;
            
            // Track who last touched the ball
            b.lastTouchedBy = (character === this.player) ? 'player' : 'ai';
            b.hasScored = false; // Reset score flag on new touch
            
            return true;
        }
        return false;
    },
    
    // Attempt to spike the ball (called when character presses spike key mid-air)
    attemptSpike(character) {
        // Can only spike when mid-air and haven't spiked this jump
        // Also can't spike if already received this jump (prevent spamming)
        if (character.onGround || character.hasSpiked || character.hasReceived) {
            return false;
        }
        
        const b = this.ball;
        
        // Can't spike ball that is on the ground (only mid-air balls)
        if (b.z <= b.groundLevel) {
            return false;
        }
        
        // Calculate spike zone center (at character's center mass, offset forward and upward)
        // Offset forward so character can't spike balls behind them
        let forwardOffset = this.SPIKE_ZONE_FORWARD_OFFSET;
        if (character === this.ai) {
            // AI is on right side, forward is toward left (decreasing x)
            forwardOffset = -forwardOffset;
        }
        const spikeZoneX = character.x + forwardOffset;
        const spikeZoneY = character.y;
        const spikeZoneZ = character.z + this.SPIKE_ZONE_UPWARD_OFFSET; // Slightly above center mass
        
        // Check if ball is within spike zone (3D distance)
        // Account for ball's radius - if any part of ball overlaps zone, it's in
        const dx = b.x - spikeZoneX;
        const dy = b.y - spikeZoneY;
        const dz = b.z - spikeZoneZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const effectiveRadius = this.SPIKE_ZONE_RADIUS + b.radius;
        
        if (dist > effectiveRadius) {
            return false; // Ball not in spike zone
        }
        
        // Determine target (opponent's side)
        let targetX, targetY;
        if (character === this.player) {
            // Player hits toward AI side (right side, x > NET_X)
            targetX = this.COURT_WIDTH * 0.75; // 75% across court (AI side)
            targetY = this.COURT_LENGTH * 0.5;  // Middle depth
        } else {
            // AI hits toward player side (left side, x < NET_X)
            targetX = this.COURT_WIDTH * 0.25; // 25% across court (player side)
            targetY = this.COURT_LENGTH * 0.5;  // Middle depth
        }
        
        // Determine trajectory based on ball height relative to net
        // If ball is at or below net height: lob (arching, slow)
        // If ball is above net height: spike (straight, fast)
        const isLob = b.z <= this.NET_HEIGHT;
        
        if (isLob) {
            // LOB: Arching trajectory (slow, high arc)
            const dirX = targetX - b.x;
            const dirY = targetY - b.y;
            const horizontalDist = Math.sqrt(dirX * dirX + dirY * dirY);
            
            // Normalize horizontal direction
            const horizontalPower = this.SPIKE_LOB_POWER * 0.8; // Slightly weaker horizontal
            b.vx = (dirX / horizontalDist) * horizontalPower * this.ballMovementSpeed;
            b.vy = (dirY / horizontalDist) * horizontalPower * this.ballMovementSpeed;
            b.vz = this.SPIKE_LOB_ARCH_HEIGHT * this.ballMovementSpeed; // Upward for arch
            
            // Add character's velocity influence (slight)
            b.vx += character.vx * 0.1;
            b.vy += character.vy * 0.1;
        } else {
            // SPIKE: Straight trajectory (fast, direct)
            const dirX = targetX - b.x;
            const dirY = targetY - b.y;
            const dirZ = -0.3; // Slight downward angle for spike effect
            const dirLength = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
            
            // Normalize and apply power
            b.vx = (dirX / dirLength) * this.SPIKE_POWER * this.ballMovementSpeed;
            b.vy = (dirY / dirLength) * this.SPIKE_POWER * this.ballMovementSpeed;
            b.vz = (dirZ / dirLength) * this.SPIKE_POWER * this.ballMovementSpeed;
            
            // Add character's velocity influence (slight)
            b.vx += character.vx * 0.1;
            b.vy += character.vy * 0.1;
        }
        
        character.hasSpiked = true;
        character.justAttemptedAction = true; // Flag to prevent collision bounce this frame
        
        // Track who last touched the ball
        b.lastTouchedBy = (character === this.player) ? 'player' : 'ai';
        b.hasScored = false; // Reset score flag on new touch
        
        return true;
    },
    
    // Attempt to receive the ball (can be called mid-air or on ground)
    attemptReceive(character) {
        // Can't receive if already received this jump (prevent spamming)
        if (character.hasReceived) {
            return false;
        }
        
        const b = this.ball;
        
        // Can't receive if ball was just served (prevents receive from interfering with serve)
        if (b.justServed) {
            return false;
        }
        
        // Can't receive ball that is on the ground (only mid-air balls)
        if (b.z <= b.groundLevel) {
            return false;
        }
        
        // Calculate receiving zone center (at character's center mass)
        const receiveZoneX = character.x;
        const receiveZoneY = character.y;
        const receiveZoneZ = character.z; // At ground level
        
        // Check if ball is within receiving zone (3D distance)
        // Account for ball's radius - if any part of ball overlaps zone, it's in
        const dx = b.x - receiveZoneX;
        const dy = b.y - receiveZoneY;
        const dz = b.z - receiveZoneZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const effectiveRadius = this.RECEIVING_ZONE_RADIUS + b.radius;
        
        if (dist > effectiveRadius) {
            return false; // Ball not in receiving zone
        }
        
        // Calculate distance from ball to center of receiving zone (horizontal)
        const horizontalDist = Math.sqrt(dx * dx + dy * dy);
        const centerThreshold = this.RECEIVING_ZONE_RADIUS * 0.3; // 30% of zone radius from center
        
        // If ball is not close enough to center, move character toward ball first
        // BUT only if character is on the ground (no automatic chasing mid-air)
        if (horizontalDist > centerThreshold && character.onGround) {
            // Move character toward ball to get it closer to center
            const moveDirX = dx / horizontalDist;
            const moveDirY = dy / horizontalDist;
            
            // Apply movement boost toward ball
            character.vx = moveDirX * this.RECEIVE_MOVE_SPEED;
            character.vy = moveDirY * this.RECEIVE_MOVE_SPEED;
            
            // Don't hit yet, just move closer
            // Don't set justAttemptedAction here - we want collision to still work while moving
            return true;
        }
        
        // If mid-air and ball not centered, don't attempt receive (need to be more precise mid-air)
        if (!character.onGround && horizontalDist > centerThreshold) {
            return false; // Can't receive if ball not centered and mid-air
        }
        
        // Ball is close enough to center, now hit it
        // If on ground, just bounce ball upward (for testing spikes)
        // If mid-air, lob to opponent's side
        if (character.onGround) {
            // Just bounce the ball upward (no horizontal movement)
            // Reduced power for ground bounce (so it doesn't fly too high)
            b.vx = 0;
            b.vy = 0;
            b.vz = this.RECEIVE_ARCH_HEIGHT * 0.7 * this.ballMovementSpeed; // Reduced upward bounce (70% of normal)
            character.justAttemptedAction = true; // Flag to prevent collision bounce this frame
        } else {
            // Mid-air: lob to opponent's side
            // Determine target (opponent's side)
            let targetX, targetY;
            if (character === this.player) {
                // Player receives toward AI side (right side, x > NET_X)
                targetX = this.COURT_WIDTH * 0.75; // 75% across court (AI side)
                targetY = this.COURT_LENGTH * 0.5;  // Middle depth
            } else {
                // AI receives toward player side (left side, x < NET_X)
                targetX = this.COURT_WIDTH * 0.25; // 25% across court (player side)
                targetY = this.COURT_LENGTH * 0.5;  // Middle depth
            }
            
            // Calculate direction to target
            const dirX = targetX - b.x;
            const dirY = targetY - b.y;
            const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
            
            // Normalize horizontal direction
            const normDirX = dirX / dirLength;
            const normDirY = dirY / dirLength;
            
            // Apply arching trajectory (weaker and more arching than spike)
            // Reduce horizontal power more than vertical to create a higher arc
            const horizontalPower = this.RECEIVE_POWER * 0.8; // Even weaker horizontal component
            b.vx = normDirX * horizontalPower * this.ballMovementSpeed;
            b.vy = normDirY * horizontalPower * this.ballMovementSpeed;
            b.vz = this.RECEIVE_ARCH_HEIGHT * this.ballMovementSpeed; // Higher upward component for arch
            
            // Add slight character velocity influence (reduced for lob)
            b.vx += character.vx * 0.1;
            b.vy += character.vy * 0.1;
        }
        
        // Mark character as having received (prevent spamming)
        character.hasReceived = true;
        character.justAttemptedAction = true; // Flag to prevent collision bounce this frame
        
        // Track who last touched the ball
        b.lastTouchedBy = (character === this.player) ? 'player' : 'ai';
        b.hasScored = false; // Reset score flag on new touch
        
        return true;
    },
    
    checkBallNetCollision() {
        const b = this.ball;
        const netX = this.NET_X;
        const netHeight = this.NET_HEIGHT;
        const topThreshold = this.NET_TOP_THRESHOLD;
        
        // Check if ball is near the net (within ball radius)
        const distToNet = Math.abs(b.x - netX);
        
        // Ball must be within net's depth range (y: 0 to COURT_LENGTH)
        const withinNetDepth = b.y >= 0 && b.y <= this.COURT_LENGTH;
        
        if (distToNet < b.radius && withinNetDepth) {
            // Check if ball is below net (main collision)
            const belowNet = b.z < netHeight - topThreshold;
            
            // Check if ball is at top edge (hitting the tape/rope)
            const atTopEdge = b.z >= netHeight - topThreshold && b.z <= netHeight + topThreshold;
            
            // Check if ball is above net (should pass over)
            const aboveNet = b.z > netHeight + topThreshold;
            
            if (belowNet) {
                // Main net collision - ball hits the net below the top
                const ballOnLeftSide = b.x < netX;
                
                // Push ball away from net
                if (ballOnLeftSide) {
                    b.x = netX - b.radius - 0.05;
                } else {
                    b.x = netX + b.radius + 0.05;
                }
                
                // Bounce off net - reverse horizontal velocity with damping
                // Scale by ballMovementSpeed to maintain trajectory
                b.vx = -b.vx * b.bounceDamping;
                
                // Slight upward component to prevent ball from getting stuck
                // Scale by ballMovementSpeed to maintain trajectory
                if (b.vz < 0.05 * this.ballMovementSpeed) {
                    b.vz = 0.05 * this.ballMovementSpeed;
                }
                
                // Apply slight damping to other velocities
                b.vy *= 0.95;
                
                return true;
            } else if (atTopEdge) {
                // Top edge collision - ball hits the tape/rope at top of net
                const ballOnLeftSide = b.x < netX;
                
                // Push ball away from net
                if (ballOnLeftSide) {
                    b.x = netX - b.radius - 0.05;
                } else {
                    b.x = netX + b.radius + 0.05;
                }
                
                // Top edge bounce - deflects ball with reduced horizontal bounce
                // Velocities already scaled by ballMovementSpeed from previous updates
                b.vx = -b.vx * b.bounceDamping * 0.7; // Less horizontal bounce on top edge
                
                // Deflect downward slightly (ball hits top and bounces down)
                if (b.vz > 0) {
                    b.vz = -b.vz * 0.5; // Reverse and reduce upward velocity
                }
                
                // Apply damping
                b.vy *= 0.95;
                
                return true;
            }
            // If aboveNet, ball passes over - no collision
        }
        return false;
    },
    
    updateBall(deltaTime = 1/60) {
        const b = this.ball;
        
        // Update serve timer
        if (b.justServed) {
            b.serveTimer -= deltaTime;
            if (b.serveTimer <= 0) {
                b.justServed = false;
                b.serveTimer = 0;
            }
        }
        
        // Check collisions with characters first (before updating position)
        // Skip collision check if ball was just served (prevents immediate collision with serving character)
        if (!b.justServed) {
            this.checkBallCharacterCollision(this.player);
            this.checkBallCharacterCollision(this.ai);
        }
        
        // Apply gravity (same as characters - uses Physics.GRAVITY which is controlled by slider)
        // Scale gravity by ballMovementSpeed to act as time-scale factor
        // This ensures the same trajectory but at different time scales
        b.vz -= this.GRAVITY * this.ballMovementSpeed;
        
        // Update position
        // ballMovementSpeed acts as time-scale: lower = slower = same distance takes longer
        // Since velocities are already scaled by ballMovementSpeed (from forces),
        // we update position directly with the scaled velocities
        // This maintains the same trajectory but at different time scales
        b.x += b.vx;
        b.y += b.vy;
        b.z += b.vz;
        
        // Check net collision (after position update)
        this.checkBallNetCollision();
        
        // Ground collision with bounce (only if ball is on court)
        if (b.z <= b.groundLevel) {
            // Only bounce if ball is on court - if off court, let it fall through
            if (this.isBallOnCourt()) {
                // Check for scoring: ball bounces on court ground
                // Score goes to opponent of the side where ball lands
                if (!b.hasScored) {
                    // Determine which side the ball is on
                    if (b.x < this.NET_X) {
                        // Ball landed on player's side (left) → AI scores
                        Game.scorePoint('ai');
                    } else {
                        // Ball landed on AI's side (right) → Player scores
                        Game.scorePoint('player');
                    }
                    b.hasScored = true; // Prevent multiple scores from same bounce
                }
                
                b.z = b.groundLevel;
                
                // Bounce off ground (reverse vertical velocity with damping)
                if (b.vz < 0) {
                    b.vz = -b.vz * b.bounceDamping;
                } else {
                    b.vz = 0;
                }
                
                // Apply friction to horizontal movement
                b.vx *= b.friction;
                b.vy *= b.friction;
                
                // Stop very small velocities to prevent jitter
                if (Math.abs(b.vx) < 0.001) b.vx = 0;
                if (Math.abs(b.vy) < 0.001) b.vy = 0;
                if (Math.abs(b.vz) < 0.001) b.vz = 0;
            } else {
                // Ball is off court and falling - check for out-of-bounds score
                if (!b.hasScored && b.lastTouchedBy) {
                    // Ball went out of bounds - opponent of last toucher scores
                    if (b.lastTouchedBy === 'player') {
                        // Player hit it out → AI scores
                        Game.scorePoint('ai');
                    } else {
                        // AI hit it out → Player scores
                        Game.scorePoint('player');
                    }
                    b.hasScored = true; // Prevent multiple scores from same fall
                }
            }
            // If ball is off court, don't clamp z or reset velocities - let it fall through
        }
        
        // Check for out-of-bounds score when ball falls off court (even if z > groundLevel)
        // This handles cases where ball goes out of bounds while still in the air
        if (!b.hasScored && !this.isBallOnCourt() && b.z < 0 && b.lastTouchedBy) {
            // Ball went out of bounds - opponent of last toucher scores
            if (b.lastTouchedBy === 'player') {
                // Player hit it out → AI scores
                Game.scorePoint('ai');
            } else {
                // AI hit it out → Player scores
                Game.scorePoint('player');
            }
            b.hasScored = true; // Prevent multiple scores from same fall
        }
        
        // Ball can move freely (no clamping)
    },
    
    // Respawn character at the edge they fell from (fixed spots slightly inward from each edge)
    respawnCharacter(character) {
        // Respawn at fixed position based on which edge they fell from
        if (character.fallEdge === 'A') {
            // EDGE A: back of court - respawn at back edge, slightly inward
            character.y = this.COURT_LENGTH - 0.3; // Slightly inward from back edge
            // Center horizontally on their side
            if (character === this.player) {
                character.x = this.NET_X * 0.5; // Center of player's side
            } else {
                character.x = this.NET_X + (this.COURT_WIDTH - this.NET_X) * 0.5; // Center of AI's side
            }
        } else if (character.fallEdge === 'B') {
            // EDGE B: left/right side - respawn at side edge, slightly inward
            if (character === this.player) {
                character.x = 0.3; // Slightly inward from left edge
            } else {
                character.x = this.COURT_WIDTH - 0.3; // Slightly inward from right edge
            }
            // Center depth-wise
            character.y = this.COURT_LENGTH * 0.5; // Center depth
        } else if (character.fallEdge === 'C') {
            // EDGE C: front of court - respawn at front edge, slightly inward
            character.y = 0.3; // Slightly inward from front edge
            // Center horizontally on their side
            if (character === this.player) {
                character.x = this.NET_X * 0.5; // Center of player's side
            } else {
                character.x = this.NET_X + (this.COURT_WIDTH - this.NET_X) * 0.5; // Center of AI's side
            }
        } else {
            // Fallback: if fallEdge is unknown, respawn at center
            if (character === this.player) {
                character.x = this.NET_X * 0.5;
                character.y = this.COURT_LENGTH * 0.5;
            } else {
                character.x = this.NET_X + (this.COURT_WIDTH - this.NET_X) * 0.5;
                character.y = this.COURT_LENGTH * 0.5;
            }
        }
        
        // Reset position and velocity
        character.z = 0;
        character.vx = 0;
        character.vy = 0;
        character.vz = 0;
        character.onGround = true;
        character.hasSpiked = false;
        character.hasReceived = false;
        
        // Start blinking state (1 second)
        character.isBlinking = true;
        character.blinkTimer = 0;
    },
    
    update(input, aiInput, deltaTime = 1/60) {
        // Reset action flags at start of frame (before actions are attempted)
        this.player.justAttemptedAction = false;
        this.ai.justAttemptedAction = false;
        
        // Update fall timers with actual deltaTime
        if (this.player.isFalling) {
            this.player.fallTimer += deltaTime;
        }
        if (this.ai.isFalling) {
            this.ai.fallTimer += deltaTime;
        }
        
        // Update blink timers with actual deltaTime
        if (this.player.isBlinking) {
            this.player.blinkTimer += deltaTime;
            if (this.player.blinkTimer >= 1.0) {
                this.player.isBlinking = false;
                this.player.blinkTimer = 0;
            }
        }
        if (this.ai.isBlinking) {
            this.ai.blinkTimer += deltaTime;
            if (this.ai.blinkTimer >= 1.0) {
                this.ai.isBlinking = false;
                this.ai.blinkTimer = 0;
            }
        }
        
        this.updatePlayer(input);
        this.updateAI(aiInput);
        
        // If serving, keep ball "held" by serving character
        // Do this AFTER character movement so ball follows character if they move
        if (Game.state.isServing) {
            const servingChar = Game.state.servingPlayer === 'player' ? this.player : this.ai;
            // Keep ball at character position (held)
            this.ball.x = servingChar.x;
            this.ball.y = servingChar.y;
            this.ball.z = servingChar.radius * 1.5; // Slightly above character
            this.ball.vx = 0;
            this.ball.vy = 0;
            this.ball.vz = 0;
        } else {
            // Update ball after character movement (so collisions work correctly)
            // Only update ball physics if not serving
            this.updateBall();
        }
    }
};

