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
        // Not-too-OP behavior: AI doesn't make perfect decisions every frame.
        decisionTimer: 0,
        ignoreBallThisDecision: false
    },
    
    // AI parameters
    reactionSpeed: 0.12,
    jumpDistance: 0.5,      // Distance at which AI will jump to hit ball
    hitDistance: 0.4,       // Distance at which AI can hit the ball
    predictionTime: 0.3,    // How far ahead to predict ball position
    isActive: true,         // Whether AI should chase ball (true) or stand still (false)
    decisionInterval: 0.18, // Seconds between "strategic" decisions (avoid perfect reactions)
    outMargin: 0.6,         // How far outside bounds before AI considers ball "obviously out"
    
    init() {
        // AI starts on right side
        const ai = Physics.ai;
        this.state.targetX = 0;
        this.state.targetY = 0;
        this.state.lastBallX = 0;
        this.state.lastBallY = 0;
        this.state.decisionTimer = 0;
        this.state.ignoreBallThisDecision = false;
        this.isActive = true; // Default: AI is active
    },
    
    // Snap a desired position to the nearest intact tile on AI side (prevents walking into holes).
    // Returns { x, y } in world coords.
    snapToSafeAISide(desiredX, desiredY) {
        if (!Game?.findNearestIntactTileCenter) {
            return { x: desiredX, y: desiredY };
        }
        
        const tx = Math.floor(desiredX);
        const ty = Math.floor(desiredY);
        const safe = Game.findNearestIntactTileCenter(
            Math.max(Physics.NET_X, Math.min(Physics.COURT_WIDTH - 1, tx)),
            Math.max(0, Math.min(Physics.COURT_LENGTH - 1, ty)),
            'ai'
        );
        return { x: safe.x, y: safe.y };
    },
    
    // Roughly predict where the ball will hit the ground (in world coords).
    // This uses the same general ballistic math we use elsewhere (good enough, not perfect).
    predictBallLanding() {
        const b = Physics.ball;
        const gEff = Physics.GRAVITY * Physics.ballMovementSpeed;
        const z0 = Math.max(0.001, b.z - b.groundLevel);
        const disc = b.vz * b.vz + 2 * gEff * z0;
        const flightFrames = disc > 0 ? (b.vz + Math.sqrt(disc)) / gEff : 12;
        const tFrames = Math.max(3, flightFrames);
        return {
            x: b.x + b.vx * tFrames,
            y: b.y + b.vy * tFrames,
            tFrames
        };
    },
    
    // Decide (imperfectly) whether this ball is likely to go far out-of-bounds so AI shouldn't chase hard.
    // Intentionally fuzzy: uses margins + randomness + only updates every decisionInterval.
    computeShouldIgnoreBall() {
        const b = Physics.ball;
        const landing = this.predictBallLanding();
        
        const outX = landing.x > Physics.COURT_WIDTH + this.outMargin || landing.x < -this.outMargin;
        const outY = landing.y > Physics.COURT_LENGTH + this.outMargin || landing.y < -this.outMargin;
        const obviouslyOutNow =
            b.x > Physics.COURT_WIDTH + this.outMargin ||
            b.y > Physics.COURT_LENGTH + this.outMargin ||
            b.y < -this.outMargin;
        
        // Only consider "ignore" when ball is heading down / lower-ish, to avoid being too smart early.
        const isDescending = b.vz < 0;
        const lowEnough = b.z < 1.2;
        const likelyOut = (outX || outY) && isDescending && lowEnough;
        
        // Randomness so AI isn't perfect: sometimes it still chases out balls, sometimes it gives up early.
        const r = Math.random();
        
        if (obviouslyOutNow) {
            // Pretty strong confidence, but still not perfect.
            return r < 0.8;
        }
        if (likelyOut) {
            return r < 0.6;
        }
        return false;
    },
    
    update(deltaTime = 1/60) {
        const ai = Physics.ai;
        const ball = Physics.ball;
        const netX = Physics.NET_X;
        
        // Update coarse decision timer (for imperfect out-of-bounds judgement)
        this.state.decisionTimer += deltaTime;
        if (this.state.decisionTimer >= this.decisionInterval) {
            this.state.decisionTimer = 0;
            this.state.ignoreBallThisDecision = this.computeShouldIgnoreBall();
        }
        
        // If AI is inactive, just stand in the middle and don't do anything
        if (!this.isActive) {
            const center = this.snapToSafeAISide(6.0, Physics.COURT_LENGTH / 2);
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
        
        if (ballOnAISide && !this.state.ignoreBallThisDecision) {
            // Ball is on AI's side - track and try to hit it
            // Predict where ball will be
            const predictedX = ball.x + ball.vx * this.predictionTime;
            const predictedY = ball.y + ball.vy * this.predictionTime;
            const predictedZ = ball.z + ball.vz * this.predictionTime;
            
            // Clamp predicted position to court bounds (AI shouldn't run off court chasing a wild ball)
            const clampedX = Math.max(netX + 0.2, Math.min(Physics.COURT_WIDTH - 0.2, predictedX));
            const clampedY = Math.max(0.2, Math.min(Physics.COURT_LENGTH - 0.2, predictedY));
            const safe = this.snapToSafeAISide(clampedX, clampedY);
            
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
                    this.state.shouldSpike = true;
                    this.state.shouldReceive = false;
                } else {
                    // Check receiving zone if not in spike zone
                    const receiveZoneZ = ai.z;
                    const dxReceive = ball.x - ai.x;
                    const dyReceive = ball.y - ai.y;
                    const dzReceive = ball.z - receiveZoneZ;
                    const distToReceiveZone = Math.sqrt(dxReceive * dxReceive + dyReceive * dyReceive + dzReceive * dzReceive);
                    
                    if (distToReceiveZone < effectiveReceiveRadius) {
                        this.state.shouldSpike = false;
                        this.state.shouldReceive = true;
                    } else {
                        this.state.shouldSpike = false;
                        this.state.shouldReceive = false;
                    }
                }
            } else if (ai.onGround && !ai.hasReceived) {
                // On ground: check receiving zone
                const receiveZoneX = ai.x;
                const receiveZoneY = ai.y;
                const receiveZoneZ = ai.z;
                const dx = ball.x - receiveZoneX;
                const dy = ball.y - receiveZoneY;
                const dz = ball.z - receiveZoneZ;
                const distToReceiveZone = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distToReceiveZone < effectiveReceiveRadius) {
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
            const center = this.snapToSafeAISide(6.0, Physics.COURT_LENGTH / 2);
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

