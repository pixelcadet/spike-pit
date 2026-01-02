// AI system - tracks ball and tries to return it

const AI = {
    // AI state
    state: {
        targetX: 0,
        targetY: 0,
        shouldJump: false,
        shouldSpike: false,
        shouldReceive: false,
        shouldToss: false, // Forward toss from spike zone (O key)
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
    // Also checks nearby tiles to avoid moving through holes.
    snapIfOnHoleAISide(desiredX, desiredY) {
        if (!Game?.findNearestIntactTileCenter) {
            return { x: desiredX, y: desiredY };
        }
        
        const tx = Math.floor(desiredX);
        const ty = Math.floor(desiredY);
        if (tx < Physics.NET_X || tx >= Physics.COURT_WIDTH || ty < 0 || ty >= Physics.COURT_LENGTH) {
            return { x: desiredX, y: desiredY };
        }
        
        // Check if target tile is a hole
        const tile = Game.getTileState?.(tx, ty);
        if (tile && !tile.indestructible && tile.destroyed) {
            const safe = Game.findNearestIntactTileCenter(tx, ty, 'ai');
            return { x: safe.x, y: safe.y };
        }
        
        // Also check nearby tiles (within 0.5 units) to avoid moving through holes
        // This prevents AI from moving toward a position that's just outside a hole but would cause it to fall in
        const checkRadius = 0.5;
        for (let checkTy = Math.floor(desiredY - checkRadius); checkTy <= Math.floor(desiredY + checkRadius); checkTy++) {
            for (let checkTx = Math.floor(desiredX - checkRadius); checkTx <= Math.floor(desiredX + checkRadius); checkTx++) {
                if (checkTx < Physics.NET_X || checkTx >= Physics.COURT_WIDTH || checkTy < 0 || checkTy >= Physics.COURT_LENGTH) {
                    continue;
                }
                const checkTile = Game.getTileState?.(checkTx, checkTy);
                if (checkTile && !checkTile.indestructible && checkTile.destroyed) {
                    // Check distance from desired position to this hole
                    const holeCenterX = checkTx + 0.5;
                    const holeCenterY = checkTy + 0.5;
                    const distToHole = Math.sqrt((desiredX - holeCenterX) ** 2 + (desiredY - holeCenterY) ** 2);
                    // If desired position is too close to a hole (within 0.4 units), avoid it
                    if (distToHole < 0.4) {
                        const safe = Game.findNearestIntactTileCenter(checkTx, checkTy, 'ai');
                        return { x: safe.x, y: safe.y };
                    }
                }
            }
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
            this.state.shouldToss = false;
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
            this.state.shouldToss = false;
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
            this.state.shouldToss = false;
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
            
            // Check if predicted ball position is over/near a hole
            // If so, and AI is also near that hole (especially after respawning), avoid moving toward it
            const ballTileX = Math.floor(predictedX);
            const ballTileY = Math.floor(predictedY);
            let ballOverHole = false;
            if (ballTileX >= Physics.NET_X && ballTileX < Physics.COURT_WIDTH && 
                ballTileY >= 0 && ballTileY < Physics.COURT_LENGTH) {
                const ballTile = Game.getTileState?.(ballTileX, ballTileY);
                if (ballTile && !ballTile.indestructible && ballTile.destroyed) {
                    ballOverHole = true;
                }
            }
            
            // Check if AI is currently near a hole (especially after respawning)
            const aiTileX = Math.floor(ai.x);
            const aiTileY = Math.floor(ai.y);
            let aiNearHole = false;
            if (aiTileX >= Physics.NET_X && aiTileX < Physics.COURT_WIDTH && 
                aiTileY >= 0 && aiTileY < Physics.COURT_LENGTH) {
                // Check current tile and nearby tiles
                for (let checkTy = aiTileY - 1; checkTy <= aiTileY + 1; checkTy++) {
                    for (let checkTx = aiTileX - 1; checkTx <= aiTileX + 1; checkTx++) {
                        if (checkTx >= Physics.NET_X && checkTx < Physics.COURT_WIDTH && 
                            checkTy >= 0 && checkTy < Physics.COURT_LENGTH) {
                            const checkTile = Game.getTileState?.(checkTx, checkTy);
                            if (checkTile && !checkTile.indestructible && checkTile.destroyed) {
                                aiNearHole = true;
                                break;
                            }
                        }
                    }
                    if (aiNearHole) break;
                }
            }
            
            // If ball is over a hole and AI is near that same hole (or just respawned), avoid moving directly toward it
            // Instead, move to a safe position nearby
            if (ballOverHole && aiNearHole && ai.isBlinking) {
                // AI just respawned and ball is over a hole - stay put or move to safe center
                const safeCenter = this.snapIfOnHoleAISide(6.0, Physics.COURT_LENGTH / 2);
                const dxSafe = safeCenter.x - ai.x;
                const dySafe = safeCenter.y - ai.y;
                const distSafe = Math.sqrt(dxSafe * dxSafe + dySafe * dySafe);
                if (distSafe > 0.1) {
                    this.state.targetX = dxSafe / distSafe;
                    this.state.targetY = dySafe / distSafe;
                } else {
                    this.state.targetX = 0;
                    this.state.targetY = 0;
                }
                // Skip the rest of the ball tracking logic for this frame
                this.state.shouldJump = false;
                this.state.shouldSpike = false;
                this.state.shouldReceive = false;
                this.state.shouldToss = false;
                return;
            }
            
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
            
            // Check if ball is in spike zone (needed for movement strategy)
            const ballRadius = Physics.ball.radius;
            const effectiveSpikeRadius = Physics.SPIKE_ZONE_RADIUS + ballRadius;
            const spikeZoneX = ai.x - Physics.SPIKE_ZONE_FORWARD_OFFSET;
            const spikeZoneY = ai.y;
            const spikeZoneZ = ai.z + Physics.SPIKE_ZONE_UPWARD_OFFSET;
            const dxSpike = ball.x - spikeZoneX;
            const dySpike = ball.y - spikeZoneY;
            const dzSpike = ball.z - spikeZoneZ;
            const distToSpikeZone = Math.sqrt(dxSpike * dxSpike + dySpike * dySpike + dzSpike * dzSpike);
            const ballInSpikeZone = distToSpikeZone < effectiveSpikeRadius;
            
            // NEW STRATEGY: Prioritize positioning for spike zone tosses (85% reliable)
            // If ball is not in spike zone, move to position ball in spike zone
            // Otherwise, move toward predicted ball position to maintain spike zone alignment
            if (ballInSpikeZone) {
                // Ball is in spike zone - make small adjustments to maintain position
                if (dist > 0.3) {
                    this.state.targetX = dx / dist;
                    this.state.targetY = dy / dist;
                } else {
                    this.state.targetX = 0;
                    this.state.targetY = 0;
                }
            } else {
                // Ball not in spike zone - move to position ball into spike zone
                // Calculate where we need to be so ball is in spike zone (forward offset)
                let forwardOffset = Physics.SPIKE_ZONE_FORWARD_OFFSET;
                // For AI, forward is left (decreasing x), so we want ball at ai.x - forwardOffset
                // So we need to move to: ball.x + forwardOffset
                const desiredX = predictedX + forwardOffset;
                const desiredY = predictedY;
                
                const dxToDesired = desiredX - ai.x;
                const dyToDesired = desiredY - ai.y;
                const distToDesired = Math.sqrt(dxToDesired * dxToDesired + dyToDesired * dyToDesired);
                
                // Clamp desired position to court bounds
                const clampedDesiredX = Math.max(netX + 0.2, Math.min(Physics.COURT_WIDTH - 0.2, desiredX));
                const clampedDesiredY = Math.max(0.2, Math.min(Physics.COURT_LENGTH - 0.2, desiredY));
                const safeDesired = this.snapIfOnHoleAISide(clampedDesiredX, clampedDesiredY);
                
                const dxSafe = safeDesired.x - ai.x;
                const dySafe = safeDesired.y - ai.y;
                const distSafe = Math.sqrt(dxSafe * dxSafe + dySafe * dySafe);
                
                if (distSafe > 0.1) {
                    this.state.targetX = dxSafe / distSafe;
                    this.state.targetY = dySafe / distSafe;
                } else {
                    this.state.targetX = 0;
                    this.state.targetY = 0;
                }
            }
            
            // Check if AI should spike or receive (mid-air or on ground)
            // Account for ball's radius in zone checks
            // ballRadius and effectiveSpikeRadius already calculated above
            const effectiveReceiveRadius = Physics.RECEIVING_ZONE_RADIUS + ballRadius;
            const touches = Physics.ball.touchesRemaining ?? 0;
            const isAiSide = ball.x >= Physics.NET_X;
            // Touch-count awareness (imperfect on purpose):
            // When touches are low and the ball is on AI side, prefer sending it over the net instead of stalling.
            // Keep it 85% reliable so AI is mostly aware but still beatable.
            const touchAware = isAiSide && touches <= 1 && Math.random() < 0.85;
            
            // Check if ball is in receive zone (for ground receive decision)
            const receiveZoneX = ai.x;
            const receiveZoneY = ai.y;
            const receiveZoneZ = ai.z;
            const dxReceive = ball.x - receiveZoneX;
            const dyReceive = ball.y - receiveZoneY;
            const dzReceive = ball.z - receiveZoneZ;
            const distSphere = Math.sqrt(dxReceive * dxReceive + dyReceive * dyReceive + dzReceive * dzReceive);
            const invSquash = 1 / (Physics.RECEIVE_ZONE_Y_SQUASH || 1);
            const dyE = dyReceive * invSquash;
            const distEllipsoid = Math.sqrt(dxReceive * dxReceive + dyE * dyE + dzReceive * dzReceive);
            const coreRadius = effectiveReceiveRadius * (Physics.RECEIVE_ZONE_CORE_MULT ?? 0.55);
            const coreRadiusWithBuffer = coreRadius * 1.1;
            const inCore = distSphere <= coreRadiusWithBuffer;
            const inOuter = distEllipsoid <= effectiveReceiveRadius;
            const ballInReceiveZone = inOuter || inCore;
            
            // NEW STRATEGY: Prioritize forward tosses from spike zone (85% reliable)
            // ballInSpikeZone already calculated above for movement strategy
            // Only jump/receive for hard balls to catch (55% reliable) or to spike
            
            // Check if ball is in spike zone - if so, prefer forward toss (85% reliable)
            // ballInSpikeZone already calculated above for movement strategy
            const tossReliability = 0.85;
            const hardBallCatchReliability = 0.55; // For jump/receive when ball is hard to catch
            
            // Determine if ball is "hard to catch" (fast, high, or moving away quickly)
            const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const ballVeryHigh = predictedZ > 1.5;
            const ballMovingAwayFast = ballSpeed > 1.0;
            const isHardBall = ballVeryHigh || ballMovingAwayFast;
            
            // Decide whether to jump or stay on ground
            const ballCloseHorizontally = dist < this.jumpDistance;
            const ballAboveGround = predictedZ > 0.3;
            const ballComingDown = ball.vz < 0;
            const ballLow = predictedZ < 1.0;
            
            // Primary strategy: If ball is in spike zone, try to do forward toss (85% reliable)
            let shouldToss = false;
            if (ballInSpikeZone && (ai.onGround || !ai.onGround)) {
                // Can toss from spike zone both on ground and mid-air
                shouldToss = Math.random() < tossReliability;
            }
            
            // Secondary strategy: Jump/receive only for hard balls (55% reliable) or to spike
            let shouldJump = false;
            if (ai.onGround && ballCloseHorizontally) {
                if (ballInSpikeZone && ballAboveGround && !ballLow && !shouldToss) {
                    // Ball is in spike zone and medium-high - sometimes jump to spike (if not tossing)
                    const spikeChance = touchAware ? 0.3 : 0.15;
                    shouldJump = Math.random() < spikeChance;
                } else if (isHardBall && ballComingDown) {
                    // Hard ball to catch - jump/receive with 55% reliability
                    shouldJump = Math.random() < hardBallCatchReliability;
                } else if (ballVeryHigh && ballComingDown) {
                    // Ball is very high - must jump to reach it
                    shouldJump = true;
                }
                // Otherwise: don't jump (prefer positioning for spike zone toss)
            }
            this.state.shouldJump = shouldJump;
            this.state.shouldToss = shouldToss;
            
            // Update spike/receive actions based on new strategy
            // If we're doing a toss, don't do spike/receive
            if (this.state.shouldToss) {
                this.state.shouldSpike = false;
                this.state.shouldReceive = false;
            } else if (!ai.onGround && !ai.hasSpiked && !ai.hasReceived) {
                // Mid-air: check both zones, prioritize spike zone
                if (ballInSpikeZone) {
                    // AI can spike, but not always (keeps it beatable)
                    const canSpikeNow = this.state.spikeCooldown <= 0;
                    const baseSpikeChance = 0.50;
                    const willSpike = canSpikeNow && (touchAware || Math.random() < baseSpikeChance);
                    this.state.shouldSpike = willSpike;
                    this.state.shouldReceive = false;
                    if (willSpike) {
                        this.state.spikeCooldown = 0.6; // small cooldown between spikes
                    }
                } else {
                    // Check receiving zone if not in spike zone - only for hard balls (55% reliable)
                    const horizontalDist = Math.sqrt(dxReceive * dxReceive + dyReceive * dyReceive);
                    const minDist = Physics.RECEIVE_MOVE_MIN_DIST ?? 0.15;
                    
                    if (ballInReceiveZone && horizontalDist > minDist && isHardBall) {
                        // Only receive if it's a hard ball to catch (55% reliable)
                        this.state.shouldSpike = false;
                        this.state.shouldReceive = Math.random() < hardBallCatchReliability;
                    } else {
                        this.state.shouldSpike = false;
                        this.state.shouldReceive = false;
                    }
                }
            } else if (ai.onGround && !ai.hasReceived) {
                // On ground: only receive for hard balls (55% reliable)
                const horizontalDist = Math.sqrt(dxReceive * dxReceive + dyReceive * dyReceive);
                const verticalDist = Math.abs(dzReceive);
                const minDist = Physics.RECEIVE_MOVE_MIN_DIST ?? 0.15;
                const ballCloseVertically = verticalDist < 0.5;
                const shouldHit = ballInReceiveZone && (horizontalDist > minDist || (inCore && ballCloseVertically));
                
                if (shouldHit && isHardBall) {
                    // Only receive if it's a hard ball to catch (55% reliable)
                    this.state.shouldReceive = Math.random() < hardBallCatchReliability;
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
        // Check if AI is stunned by energy ball (can't receive, jump, or toss)
        const isStunned = Physics.ai.energyBallStunTimeLeft > 0;
        
        return {
            vx: this.state.targetX * this.reactionSpeed,
            vy: this.state.targetY * this.reactionSpeed,
            jump: this.state.shouldJump && !isStunned, // Block jump when stunned
            spike: this.state.shouldSpike, // Spike still allowed
            receive: this.state.shouldReceive && !isStunned, // Block receive when stunned
            toss: this.state.shouldToss && !isStunned // Block toss when stunned
        };
    }
};

