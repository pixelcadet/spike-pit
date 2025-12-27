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
    SPIKE_ZONE_RADIUS: 0.84,     // Radius of spike zone sphere (scaled 20% with character size: 0.7 * 1.2)
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
        justAttemptedAction: false // Flag to prevent collision bounce when action was just attempted
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
        justAttemptedAction: false // Flag to prevent collision bounce when action was just attempted
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
        friction: 0.9        // Ground friction (0.9 = 90% of velocity retained)
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
    },
    
    reset() {
        // Reset player to middle of their side
        this.player.x = 2.0;  // Middle of left side
        this.player.y = 2.0;  // Middle depth
        this.player.z = 0;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.vz = 0;
        this.player.onGround = true;
        this.player.hasSpiked = false;
        this.player.hasReceived = false;
        
        // Reset AI to middle of their side
        this.ai.x = 6.0;  // Middle of right side
        this.ai.y = 2.0;  // Middle depth
        this.ai.z = 0;
        this.ai.vx = 0;
        this.ai.vy = 0;
        this.ai.vz = 0;
        this.ai.onGround = true;
        this.ai.hasSpiked = false;
        this.ai.hasReceived = false;
        
        // Reset ball above player
        this.resetBall();
    },
    
    updatePlayer(input) {
        const p = this.player;
        
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
        
        // Horizontal movement (x-axis)
        const hDir = input.getHorizontal();
        // If receiving, don't override automatic movement (it's already set by attemptReceive)
        if (!isReceiving) {
            p.vx = hDir * p.speed;
        } else {
            // Combine automatic movement with manual input (manual adds to automatic)
            const manualVx = hDir * p.speed;
            p.vx += manualVx * 0.3; // Manual input adds 30% influence
        }
        
        // Depth movement (y-axis)
        const dDir = input.getDepth();
        // If receiving, don't override automatic movement
        if (!isReceiving) {
            p.vy = dDir * p.speed;
        } else {
            // Combine automatic movement with manual input
            const manualVy = dDir * p.speed;
            p.vy += manualVy * 0.3; // Manual input adds 30% influence
        }
        
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
            p.hasSpiked = false; // Reset spike cooldown when landing
            p.hasReceived = false; // Reset receive cooldown when landing
        }
        
        // Only prevent player from crossing the net (x < NET_X)
        if (p.x >= this.NET_X) {
            p.x = this.NET_X - 0.01; // Keep slightly away from net
        }
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
            ai.hasSpiked = false; // Reset spike cooldown when landing
            ai.hasReceived = false; // Reset receive cooldown when landing
        }
        
        // Only prevent AI from crossing the net (x > NET_X)
        if (ai.x <= this.NET_X) {
            ai.x = this.NET_X + 0.01; // Keep slightly away from net
        }
    },
    
    checkBallCharacterCollision(character) {
        // Skip collision bounce if character just attempted an action (spike/receive)
        // This prevents the bounce from overriding the action's velocity
        if (character.justAttemptedAction) {
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
        return true;
    },
    
    // Attempt to receive the ball (can be called mid-air or on ground)
    attemptReceive(character) {
        // Can't receive if already received this jump (prevent spamming)
        if (character.hasReceived) {
            return false;
        }
        
        const b = this.ball;
        
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
    
    updateBall() {
        const b = this.ball;
        
        // Check collisions with characters first (before updating position)
        this.checkBallCharacterCollision(this.player);
        this.checkBallCharacterCollision(this.ai);
        
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
        
        // Ground collision with bounce
        if (b.z <= b.groundLevel) {
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
        }
        
        // Ball can move freely (no clamping)
    },
    
    update(input, aiInput) {
        // Reset action flags at start of frame (before actions are attempted)
        this.player.justAttemptedAction = false;
        this.ai.justAttemptedAction = false;
        
        this.updatePlayer(input);
        this.updateAI(aiInput);
        
        // Update ball after character movement (so collisions work correctly)
        this.updateBall();
    }
};

