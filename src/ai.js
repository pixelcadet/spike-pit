// AI system - tracks ball and tries to return it

const AI = {
    // AI state
    state: {
        targetX: 0,
        targetY: 0,
        shouldJump: false,
        shouldSpike: false,
        shouldReceive: false,
        lastBallX: 0,
        lastBallY: 0,
        // Imperfection: AI won't spike every time it can.
        spikeCooldown: 0,
        // Prevent AI from immediately chasing/jumping right after it serves (looks like a pre-serve jump).
        postServeFreezeTimer: 0
    },
    
    // AI parameters
    reactionSpeed: 0.12,
    jumpDistance: 0.5,      // Distance at which AI will jump to hit ball
    hitDistance: 0.4,       // Distance at which AI can hit the ball
    predictionTime: 0.3,    // How far ahead to predict ball position
    isActive: true,         // Whether AI should chase ball (true) or stand still (false)
    outChaseMargin: 0.9,    // If ball is clearly far out, AI stops chasing (kept forgiving so AI still chases sometimes)
    
    init() {
        // AI starts on right side
        const ai = Physics.ai;
        this.state.targetX = 0;
        this.state.targetY = 0;
        this.state.lastBallX = 0;
        this.state.lastBallY = 0;
        this.state.spikeCooldown = 0;
        this.state.postServeFreezeTimer = 0;
        this.isActive = true; // Default: AI is active
    },
    
    // If a desired position is on a destroyed tile, snap to nearest intact tile (prevents walking into holes).
    // Otherwise, keep the original desired position for smoother tracking.
    snapIfOnHoleAISide(desiredX, desiredY) {
        if (!Game?.findNearestIntactTileCenter) {
            return { x: desiredX, y: desiredY };
        }
        
        const tx = Math.floor(desiredX);
        const ty = Math.floor(desiredY);
        if (tx < Physics.NET_X || tx >= Physics.COURT_WIDTH || ty < 0 || ty >= Physics.COURT_LENGTH) {
            return { x: desiredX, y: desiredY };
        }
        const tile = Game.getTileState?.(tx, ty);
        if (tile && !tile.indestructible && tile.destroyed) {
            const safe = Game.findNearestIntactTileCenter(tx, ty, 'ai');
            return { x: safe.x, y: safe.y };
        }
        return { x: desiredX, y: desiredY };
    },
    
    update(deltaTime = 1/60) {
        const ai = Physics.ai;
        const ball = Physics.ball;
        const netX = Physics.NET_X;
        this.state.spikeCooldown = Math.max(0, this.state.spikeCooldown - deltaTime);
        this.state.postServeFreezeTimer = Math.max(0, (this.state.postServeFreezeTimer ?? 0) - deltaTime);
        
        // Score splash / reset window: freeze AI completely (prevents weird pre-serve jumps).
        if (Game?.state?.isResetting || Game?.state?.matchOver) {
            this.state.targetX = 0;
            this.state.targetY = 0;
            this.state.shouldJump = false;
            this.state.shouldSpike = false;
            this.state.shouldReceive = false;
            return;
        }
        
        // Right after AI serves, freeze briefly so it doesn't instantly jump/chase the ball it just launched.
        // This makes the serve read as "standing serve" rather than a jumpy action.
        if (ball.justServed && ball.lastTouchedBy === 'ai' && ball.lastHitType === 'serve') {
            // Arm the freeze window on the first frame we notice a fresh serve.
            if ((this.state.postServeFreezeTimer ?? 0) <= 0.001) {
                this.state.postServeFreezeTimer = 0.6;
            }
        }
        if ((this.state.postServeFreezeTimer ?? 0) > 0) {
            this.state.targetX = 0;
            this.state.targetY = 0;
            this.state.shouldJump = false;
            this.state.shouldSpike = false;
            this.state.shouldReceive = false;
            return;
        }
        
        // Serving state: AI should NOT try to chase/jump/hit the held ball.
        // When AI is serving, it should stand still until main.js triggers Game.serveBall().
        if (Game?.state?.isServing) {
            if (Game.state.servingPlayer === 'ai') {
                this.state.targetX = 0;
                this.state.targetY = 0;
            } else {
                // Player is serving: AI can idle toward a safe center spot, but never jump/hit.
                // IMPORTANT: AI should also avoid standing on holes while waiting for a serve.
                // If AI is currently on/over a destroyed tile, steer to the nearest intact tile immediately.
                let desiredX = 6.0;
                let desiredY = Physics.COURT_LENGTH / 2;
                
                // Detect if AI is on a hole by center-tile OR footprint overlap (more robust).
                let onHole = false;
                const tx = Math.floor(ai.x);
                const ty = Math.floor(ai.y);
                const tile = Game?.getTileState?.(tx, ty);
                if (tile && !tile.indestructible && tile.destroyed) {
                    onHole = true;
                } else if (typeof Physics?.getFootprintHoleOverlapInfo === 'function' || typeof Physics?.getFootprintHoleOverlapMax === 'function') {
                    // If destroyed tiles overlap a meaningful fraction of the footprint, treat it as unsafe.
                    // Use a lower threshold than the "fall" threshold so AI doesn't idle half-on a hole.
                    const info = typeof Physics.getFootprintHoleOverlapInfo === 'function' ? Physics.getFootprintHoleOverlapInfo(ai) : null;
                    const overlap = info ? (info.totalOverlap ?? info.maxOverlap ?? 0) : Physics.getFootprintHoleOverlapMax(ai);
                    if (overlap >= 0.2) onHole = true;
                }
                
                if (onHole && Game?.findNearestIntactTileCenter) {
                    const safe = Game.findNearestIntactTileCenter(tx, ty, 'ai');
                    desiredX = safe.x;
                    desiredY = safe.y;
                } else {
                    const center = this.snapIfOnHoleAISide(desiredX, desiredY);
                    desiredX = center.x;
                    desiredY = center.y;
                }
                
                const dx = desiredX - ai.x;
                const dy = desiredY - ai.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0.2) {
                    this.state.targetX = dx / dist;
                    this.state.targetY = dy / dist;
                } else {
                    this.state.targetX = 0;
                    this.state.targetY = 0;

                    // Snap to the exact (safe) target to avoid sub-tile drifting that can look blurry in the renderer.
                    // This only happens while waiting for the player's serve.
                    if (dist > 0.001 && dist <= 0.2) {
                        ai.x = desiredX;
                        ai.y = desiredY;
                        ai.vx = 0;
                        ai.vy = 0;
                    }
                }
            }
            this.state.shouldJump = false;
            this.state.shouldSpike = false;
            this.state.shouldReceive = false;
            return;
        }
        
        // If AI is inactive, just stand in the middle and don't do anything
        if (!this.isActive) {
            const center = this.snapIfOnHoleAISide(6.0, Physics.COURT_LENGTH / 2);
            const centerX = center.x;
            const centerY = center.y;
            
            const dx = centerX - ai.x;
            const dy = centerY - ai.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0.2) {
                this.state.targetX = dx / dist;
                this.state.targetY = dy / dist;
            } else {
                this.state.targetX = 0;
                this.state.targetY = 0;
            }
            
            this.state.shouldJump = false;
            this.state.shouldSpike = false;
            this.state.shouldReceive = false;
            return; // Exit early, don't process ball tracking
        }
        
        // Check if ball is on AI's side of the court (x > NET_X)
        const ballOnAISide = ball.x > netX;
        
        // If ball is clearly far out, don't chase it (but this is intentionally forgiving).
        const farOut =
            ball.x > Physics.COURT_WIDTH + this.outChaseMargin ||
            ball.y > Physics.COURT_LENGTH + this.outChaseMargin ||
            ball.y < -this.outChaseMargin;
        
        if (ballOnAISide && !farOut) {
            // Ball is on AI's side - track and try to hit it
            // Predict where ball will be
            const predictedX = ball.x + ball.vx * this.predictionTime;
            const predictedY = ball.y + ball.vy * this.predictionTime;
            const predictedZ = ball.z + ball.vz * this.predictionTime;
            
            // Clamp predicted position to court bounds (AI shouldn't run off court chasing a wild ball)
            const clampedX = Math.max(netX + 0.2, Math.min(Physics.COURT_WIDTH - 0.2, predictedX));
            const clampedY = Math.max(0.2, Math.min(Physics.COURT_LENGTH - 0.2, predictedY));
            const safe = this.snapIfOnHoleAISide(clampedX, clampedY);
            
            // Calculate distance to predicted ball position
            const dx = safe.x - ai.x;
            const dy = safe.y - ai.y;
            const dz = predictedZ - ai.z;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // Move toward predicted ball position
            if (dist > 0.1) {
                this.state.targetX = dx / dist;
                this.state.targetY = dy / dist;
            } else {
                this.state.targetX = 0;
                this.state.targetY = 0;
            }
            
            // Jump if ball is close enough and above ground
            // Also jump if ball is coming down and we're close horizontally
            const ballCloseHorizontally = dist < this.jumpDistance;
            const ballAboveGround = predictedZ > 0.3;
            const ballComingDown = ball.vz < 0;
            
            // Jump to hit the ball when it's close and in a hittable position
            if (ballCloseHorizontally && (ballAboveGround || ballComingDown) && ai.onGround) {
                this.state.shouldJump = true;
            } else {
                this.state.shouldJump = false;
            }
            
            // Check if AI should spike or receive (mid-air or on ground)
            // Account for ball's radius in zone checks
            const ballRadius = Physics.ball.radius;
            const effectiveSpikeRadius = Physics.SPIKE_ZONE_RADIUS + ballRadius;
            const effectiveReceiveRadius = Physics.RECEIVING_ZONE_RADIUS + ballRadius;
            const touches = Physics.ball.touchesRemaining ?? 0;
            const isAiSide = ball.x >= Physics.NET_X;
            // Touch-count awareness (imperfect on purpose):
            // When touches are low and the ball is on AI side, prefer sending it over the net instead of stalling.
            // Keep it only ~50% reliable so AI isn't always "optimal".
            const touchAware = isAiSide && touches <= 1 && Math.random() < 0.5;
            
            if (!ai.onGround && !ai.hasSpiked && !ai.hasReceived) {
                // Mid-air: check both zones, prioritize spike zone
                const spikeZoneX = ai.x - Physics.SPIKE_ZONE_FORWARD_OFFSET; // AI forward is left (decreasing x)
                const spikeZoneY = ai.y;
                const spikeZoneZ = ai.z + Physics.SPIKE_ZONE_UPWARD_OFFSET; // Slightly above center mass
                const dxSpike = ball.x - spikeZoneX;
                const dySpike = ball.y - spikeZoneY;
                const dzSpike = ball.z - spikeZoneZ;
                const distToSpikeZone = Math.sqrt(dxSpike * dxSpike + dySpike * dySpike + dzSpike * dzSpike);
                
                if (distToSpikeZone < effectiveSpikeRadius) {
                    // AI can spike, but not always (keeps it beatable)
                    const canSpikeNow = this.state.spikeCooldown <= 0;
                    const baseSpikeChance = 0.35;
                    const willSpike = canSpikeNow && (touchAware || Math.random() < baseSpikeChance);
                    this.state.shouldSpike = willSpike;
                    this.state.shouldReceive = false;
                    if (willSpike) {
                        this.state.spikeCooldown = 0.6; // small cooldown between spikes
                    }
                } else {
                    // Check receiving zone if not in spike zone (using ellipsoid + core logic)
                    const receiveZoneZ = ai.z;
                    const dxReceive = ball.x - ai.x;
                    const dyReceive = ball.y - ai.y;
                    const dzReceive = ball.z - receiveZoneZ;
                    
                    // Two-part receive zone (matches physics):
                    // - Outer ellipsoid: x radius = R, y radius = R*squash, z radius = R (squash Y for perspective, but keep Z full for vertical reach)
                    // - Inner core sphere: smaller "normal circle" centered on character
                    const distSphere = Math.sqrt(dxReceive * dxReceive + dyReceive * dyReceive + dzReceive * dzReceive);
                    const invSquash = 1 / (Physics.RECEIVE_ZONE_Y_SQUASH || 1);
                    const dyE = dyReceive * invSquash;
                    // Don't squash Z-axis - keep full vertical reach so balls above head can be received
                    const distEllipsoid = Math.sqrt(dxReceive * dxReceive + dyE * dyE + dzReceive * dzReceive);
                    const coreRadius = effectiveReceiveRadius * (Physics.RECEIVE_ZONE_CORE_MULT ?? 0.55);
                    // Add small hysteresis buffer to prevent flickering at core boundary (matches player logic)
                    const coreRadiusWithBuffer = coreRadius * 1.1; // 10% buffer
                    const inCore = distSphere <= coreRadiusWithBuffer;
                    const inOuter = distEllipsoid <= effectiveReceiveRadius;
                    
                    // Calculate horizontal distance to check if we should activate receive
                    const horizontalDist = Math.sqrt(dxReceive * dxReceive + dyReceive * dyReceive);
                    const minDist = Physics.RECEIVE_MOVE_MIN_DIST ?? 0.15;
                    
                    if ((inOuter || inCore) && horizontalDist > minDist) {
                        this.state.shouldSpike = false;
                        this.state.shouldReceive = true;
                    } else {
                        this.state.shouldSpike = false;
                        this.state.shouldReceive = false;
                    }
                }
            } else if (ai.onGround && !ai.hasReceived) {
                // On ground: check receiving zone (using ellipsoid + core logic)
                const receiveZoneX = ai.x;
                const receiveZoneY = ai.y;
                const receiveZoneZ = ai.z;
                const dx = ball.x - receiveZoneX;
                const dy = ball.y - receiveZoneY;
                const dz = ball.z - receiveZoneZ;
                
                // Two-part receive zone (matches physics):
                // - Outer ellipsoid: x radius = R, y radius = R*squash, z radius = R (squash Y for perspective, but keep Z full for vertical reach)
                // - Inner core sphere: smaller "normal circle" centered on character
                const distSphere = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const invSquash = 1 / (Physics.RECEIVE_ZONE_Y_SQUASH || 1);
                const dyE = dy * invSquash;
                // Don't squash Z-axis - keep full vertical reach so balls above head can be received
                const distEllipsoid = Math.sqrt(dx * dx + dyE * dyE + dz * dz);
                const coreRadius = effectiveReceiveRadius * (Physics.RECEIVE_ZONE_CORE_MULT ?? 0.55);
                // Add small hysteresis buffer to prevent flickering at core boundary (matches player logic)
                const coreRadiusWithBuffer = coreRadius * 1.1; // 10% buffer
                const inCore = distSphere <= coreRadiusWithBuffer;
                const inOuter = distEllipsoid <= effectiveReceiveRadius;
                
                // Calculate horizontal distance to check if we should activate receive
                const horizontalDist = Math.sqrt(dx * dx + dy * dy);
                const minDist = Physics.RECEIVE_MOVE_MIN_DIST ?? 0.15;
                
                if ((inOuter || inCore) && horizontalDist > minDist) {
                    this.state.shouldReceive = true;
                } else {
                    this.state.shouldReceive = false;
                }
                this.state.shouldSpike = false;
            } else {
                this.state.shouldSpike = false;
                this.state.shouldReceive = false;
            }
            
            // Store last ball position for tracking
            this.state.lastBallX = ball.x;
            this.state.lastBallY = ball.y;
        } else {
            // Ball is on player's side - return to center position
            const center = this.snapIfOnHoleAISide(6.0, Physics.COURT_LENGTH / 2);
            const centerX = center.x;
            const centerY = center.y;
            
            const dx = centerX - ai.x;
            const dy = centerY - ai.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0.2) {
                this.state.targetX = dx / dist;
                this.state.targetY = dy / dist;
            } else {
                this.state.targetX = 0;
                this.state.targetY = 0;
            }
            
            this.state.shouldJump = false;
            this.state.shouldReceive = false;
        }
    },
    
    getInput() {
        return {
            vx: this.state.targetX * this.reactionSpeed,
            vy: this.state.targetY * this.reactionSpeed,
            jump: this.state.shouldJump,
            spike: this.state.shouldSpike,
            receive: this.state.shouldReceive
        };
    }
};

