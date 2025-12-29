// Game state management

const Game = {
    state: {
        playerScore: 0,
        aiScore: 0,
        pointsToWin: 7,
        matchOver: false,
        matchWinner: null, // 'player' | 'ai'
        matchEndReason: null,
        scoreCooldown: 0, // Prevent multiple scores from same bounce/fall
        resetTimer: 0, // Timer for reset after scoring
        resetDuration: 2.0, // Delay between point scored and next rally
        isResetting: false,
        lastPointWinner: null, // 'player' | 'ai' (for UI feedback)
        scoreSplashDelay: 0.4, // Visual-only delay before showing "SCORED!" overlay (seconds)
        
        // AI serve pacing (when it's AI turn to serve)
        aiServeDelay: 1.0,
        aiServeTimer: 0,
        isServing: true, // Game starts with serving state
        servingPlayer: 'player', // Who is currently serving ('player' or 'ai')
        serveMovementLock: 0, // Timer to lock movement briefly after serving (prevents W/S from moving character)
        isChargingServe: false, // True when I key is held down during serving
        serveChargeTimer: 0, // How long I has been held (0.0 to maxChargeTime)
        maxChargeTime: 0.5, // Maximum charge time (beyond this = out of bounds)
        minChargeTime: 0.05, // Minimum charge time to allow serve (10% of max, prevents accidental taps)
        earlyReleaseThreshold: 0.2, // Kept for backward compatibility, but no longer used for punishment
        spikeServePending: false, // True when spike serve detected but waiting for jump peak
        spikeServePower: null, // Store spike serve power values when pending
        spikeServeTarget: null, // Store spike serve target when pending
        isOverchargedSpikeServe: false, // True if spike serve is overcharged (90-100%, lands out of court)
        
        // Prevent holding 'I' after a serve/spike-serve from being treated as a normal gameplay hit.
        // Without this, main.js will call Physics.attemptSpike()/attemptReceive() on the next frame and
        // overwrite the serve velocities (this is exactly the vx/vz jump you saw).
        blockHitUntilIRelease: false,
        
        // Court tiles (8x4). Destructible tiles start at 3 HP; destroyed tiles are holes.
        // Net-adjacent columns (tx=3 and tx=4) are indestructible (stored as null).
        tileMaxHp: 3,
        tileHp: [], // flat array length = Physics.COURT_WIDTH * Physics.COURT_LENGTH

        // Tile hit feedback (blink) - parallel arrays indexed by tileIndex(tx, ty)
        tileBlinkTimeLeft: [],
        tileBlinkDuration: [],
        tileBlinkStrength: [],
        tileBlinkOldHp: []
    },
    
    // Serve multipliers (set by sliders)
    serveHorizontalMultiplier: 0.2022, // Default horizontal multiplier (slider 5)
    serveVerticalMultiplier: 0.2111,   // Default vertical multiplier (slider 5)
    
    init() {
        this.state.playerScore = 0;
        this.state.aiScore = 0;
        this.state.pointsToWin = 7;
        this.state.matchOver = false;
        this.state.matchWinner = null;
        this.state.matchEndReason = null;
        this.state.scoreCooldown = 0;
        this.state.resetTimer = 0;
        this.state.resetDuration = 2.0;
        this.state.isResetting = false;
        this.state.lastPointWinner = null;
        this.state.scoreSplashDelay = 0.4;
        this.state.aiServeDelay = 1.0;
        this.state.aiServeTimer = 0;
        this.state.isServing = true;
        this.state.servingPlayer = 'player';
        this.state.serveMovementLock = 0;
        this.state.isChargingServe = false;
        this.state.serveChargeTimer = 0;
        this.state.maxChargeTime = 0.5;
        this.state.minChargeTime = 0.05; // 10% of max charge time
        this.state.earlyReleaseThreshold = 0.2; // Kept for backward compatibility
        this.state.spikeServePending = false;
        this.state.spikeServePower = null;
        this.state.spikeServeTarget = null;
        this.state.isOverchargedSpikeServe = false;
        this.state.blockHitUntilIRelease = false;
        this.initCourtTiles();
        // Don't reset serve multipliers here - they're controlled by sliders
        // Only set defaults if they haven't been set yet (first initialization)
        if (this.serveHorizontalMultiplier === undefined) {
            this.serveHorizontalMultiplier = 0.2022; // Default horizontal (slider 5)
        }
        if (this.serveVerticalMultiplier === undefined) {
            this.serveVerticalMultiplier = 0.2111;   // Default vertical (slider 5)
        }
        this.updateScoreDisplay();
        this.setupServe();
    },
    
    // --- Court tiles / match rules ---
    isTileIndestructible(tx) {
        return tx === 3 || tx === 4;
    },
    
    tileIndex(tx, ty) {
        return ty * Physics.COURT_WIDTH + tx;
    },
    
    initCourtTiles() {
        const total = Physics.COURT_WIDTH * Physics.COURT_LENGTH;
        this.state.tileHp = new Array(total);
        this.state.tileBlinkTimeLeft = new Array(total).fill(0);
        this.state.tileBlinkDuration = new Array(total).fill(0);
        this.state.tileBlinkStrength = new Array(total).fill(0);
        this.state.tileBlinkOldHp = new Array(total).fill(null);
        for (let ty = 0; ty < Physics.COURT_LENGTH; ty++) {
            for (let tx = 0; tx < Physics.COURT_WIDTH; tx++) {
                const idx = this.tileIndex(tx, ty);
                this.state.tileHp[idx] = this.isTileIndestructible(tx) ? null : this.state.tileMaxHp;
            }
        }
    },
    
    getTileState(tx, ty) {
        const idx = this.tileIndex(tx, ty);
        const hp = this.state.tileHp[idx];
        const indestructible = hp === null;
        const destroyed = !indestructible && hp <= 0;
        return {
            hp,
            indestructible,
            destroyed,
            maxHp: this.state.tileMaxHp,
            blinkTimeLeft: this.state.tileBlinkTimeLeft?.[idx] ?? 0,
            blinkDuration: this.state.tileBlinkDuration?.[idx] ?? 0,
            blinkStrength: this.state.tileBlinkStrength?.[idx] ?? 0,
            blinkOldHp: this.state.tileBlinkOldHp?.[idx] ?? null
        };
    },
    
    isTileDestroyed(tx, ty) {
        const { destroyed } = this.getTileState(tx, ty);
        return destroyed;
    },
    
    isTileIntactForStanding(tx, ty) {
        const { indestructible, hp } = this.getTileState(tx, ty);
        return indestructible || (hp !== null && hp > 0);
    },
    
    isTileOnSide(tx, side) {
        if (side === 'player') return tx >= 0 && tx < Physics.NET_X;
        return tx >= Physics.NET_X && tx < Physics.COURT_WIDTH;
    },
    
    damageTile(tx, ty, amount) {
        const idx = this.tileIndex(tx, ty);
        const hp = this.state.tileHp[idx];
        if (hp === null) return null; // indestructible
        if (hp <= 0) return hp; // already destroyed
        
        // Start blink feedback BEFORE showing the new (lower) opacity.
        // Use oldHp for the duration of the blink, then settle to the new hp opacity.
        const oldHp = hp;
        const newHp = Math.max(0, hp - amount);
        this.state.tileHp[idx] = newHp;

        // 1 damage = calmer blink; 3 damage = more vicious blink.
        const isBigHit = amount >= 3;
        const duration = isBigHit ? 0.28 : 0.18;
        const strength = isBigHit ? 1.0 : 0.55;
        this.state.tileBlinkTimeLeft[idx] = duration;
        this.state.tileBlinkDuration[idx] = duration;
        this.state.tileBlinkStrength[idx] = strength;
        this.state.tileBlinkOldHp[idx] = oldHp;

        this.checkWinConditions();
        return newHp;
    },
    
    areAllDestructibleTilesDestroyed(side) {
        for (let ty = 0; ty < Physics.COURT_LENGTH; ty++) {
            for (let tx = 0; tx < Physics.COURT_WIDTH; tx++) {
                if (!this.isTileOnSide(tx, side)) continue;
                if (this.isTileIndestructible(tx)) continue;
                const { hp } = this.getTileState(tx, ty);
                if (hp > 0) return false;
            }
        }
        return true;
    },
    
    checkWinConditions() {
        if (this.state.matchOver) return;
        
        if (this.state.playerScore >= this.state.pointsToWin) {
            this.endMatch('player', 'points');
            return;
        }
        if (this.state.aiScore >= this.state.pointsToWin) {
            this.endMatch('ai', 'points');
            return;
        }
        
        // Tile win: destroy all opponent destructible tiles
        if (this.areAllDestructibleTilesDestroyed('player')) {
            this.endMatch('ai', 'tiles');
            return;
        }
        if (this.areAllDestructibleTilesDestroyed('ai')) {
            this.endMatch('player', 'tiles');
        }
    },
    
    endMatch(winner, reason) {
        this.state.matchOver = true;
        this.state.matchWinner = winner;
        this.state.matchEndReason = reason;
        this.state.isResetting = false;
        this.state.resetTimer = 0;
    },
    
    // Find nearest intact tile center on a side, starting from a preferred tile coord.
    findNearestIntactTileCenter(preferredTx, preferredTy, side) {
        const maxR = Physics.COURT_WIDTH + Physics.COURT_LENGTH;
        for (let r = 0; r <= maxR; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // perimeter only
                    const tx = preferredTx + dx;
                    const ty = preferredTy + dy;
                    if (tx < 0 || tx >= Physics.COURT_WIDTH || ty < 0 || ty >= Physics.COURT_LENGTH) continue;
                    if (!this.isTileOnSide(tx, side)) continue;
                    if (!this.isTileIntactForStanding(tx, ty)) continue;
                    return { x: tx + 0.5, y: ty + 0.5, tx, ty };
                }
            }
        }
        // Fallback: center of side (net-adjacent tile should always exist and be intact)
        const txFallback = side === 'player' ? 3 : 4;
        const tyFallback = 1;
        return { x: txFallback + 0.5, y: tyFallback + 0.5, tx: txFallback, ty: tyFallback };
    },
    
    update(input, deltaTime) {
        // Tile blink feedback timers
        if (this.state.tileBlinkTimeLeft && this.state.tileBlinkTimeLeft.length) {
            for (let i = 0; i < this.state.tileBlinkTimeLeft.length; i++) {
                const t = this.state.tileBlinkTimeLeft[i] ?? 0;
                if (t > 0) {
                    const next = t - deltaTime;
                    this.state.tileBlinkTimeLeft[i] = next > 0 ? next : 0;
                    if (next <= 0) {
                        this.state.tileBlinkDuration[i] = 0;
                        this.state.tileBlinkStrength[i] = 0;
                        this.state.tileBlinkOldHp[i] = null;
                    }
                }
            }
        }

        // Update score cooldown
        if (this.state.scoreCooldown > 0) {
            this.state.scoreCooldown -= deltaTime;
            if (this.state.scoreCooldown < 0) {
                this.state.scoreCooldown = 0;
            }
        }
        
        // Handle reset after scoring
        if (this.state.isResetting) {
            this.state.resetTimer -= deltaTime;
            if (this.state.resetTimer <= 0) {
                this.resetAfterScore();
                this.state.isResetting = false;
                this.state.resetTimer = 0;
            }
        }
        
        // AI serve delay countdown
        if (this.state.isServing && this.state.servingPlayer === 'ai' && this.state.aiServeTimer > 0) {
            this.state.aiServeTimer -= deltaTime;
            if (this.state.aiServeTimer < 0) this.state.aiServeTimer = 0;
        }
        
        // Update serve movement lock timer
        if (this.state.serveMovementLock > 0) {
            this.state.serveMovementLock -= deltaTime;
            if (this.state.serveMovementLock < 0) {
                this.state.serveMovementLock = 0;
            }
        }
        
        // Update serve charge timer
        // Don't update if spike serve is pending (prevents any interference)
        // CRITICAL: Once spikeServePending is true, do NOT modify serveChargeTimer or any stored values
        if (this.state.isChargingServe && 
            this.state.isServing && 
            this.state.servingPlayer === 'player' &&
            !this.state.spikeServePending) {
            this.state.serveChargeTimer += deltaTime;
            
            // Auto-serve at max charge (ball will go out of bounds)
            if (this.state.serveChargeTimer >= this.state.maxChargeTime) {
                console.log('Auto-serving at max charge');
                this.state.serveChargeTimer = this.state.maxChargeTime;
                this.serveBallWithCharge();
                // serveBallWithCharge will reset isChargingServe and set spikeServePending
                // After spikeServePending is set, serveChargeTimer is LOCKED and should not be modified
            }
        }
        
        // Check for spike serve at jump peak
        if (this.state.spikeServePending && this.state.servingPlayer === 'player') {
            const servingChar = Physics.player;
            // Check if character is at jump peak (vz is near 0 or negative, and not on ground)
            // Peak is when upward velocity becomes zero or negative
            if (!servingChar.onGround && servingChar.vz <= 0.01) {
                // At peak! Execute the spike serve
                console.log('Spike serve at jump peak!');
                console.log('🔴 BEFORE executeSpikeServe: Ball velocities', {
                    vx: Physics.ball.vx.toFixed(4),
                    vy: Physics.ball.vy.toFixed(4),
                    vz: Physics.ball.vz.toFixed(4),
                    isServing: this.state.isServing,
                    spikeServePending: this.state.spikeServePending
                });
                this.executeSpikeServe();
                console.log('🔴 AFTER executeSpikeServe: Ball velocities', {
                    vx: Physics.ball.vx.toFixed(4),
                    vy: Physics.ball.vy.toFixed(4),
                    vz: Physics.ball.vz.toFixed(4),
                    isServing: this.state.isServing,
                    spikeServePending: this.state.spikeServePending
                });
            }
        }
    },
    
    scorePoint(winner) {
        if (this.state.matchOver) return;
        // If we're already showing the score splash / resetting, ignore any additional scoring triggers.
        if (this.state.isResetting) return;
        // Prevent multiple scores from same bounce/fall
        if (this.state.scoreCooldown > 0) {
            return;
        }
        
        // Award point
        if (winner === 'player') {
            this.state.playerScore++;
        } else if (winner === 'ai') {
            this.state.aiScore++;
        }
        
        // Set cooldown to prevent multiple scores
        this.state.scoreCooldown = 0.5; // 0.5 seconds cooldown
        
        // Start reset timer (delay before reset)
        this.state.isResetting = true;
        this.state.resetTimer = this.state.resetDuration;
        this.state.lastPointWinner = winner;
        
        this.updateScoreDisplay();
        this.checkWinConditions();
    },
    
    resetAfterScore() {
        if (this.state.matchOver) return;
        // Reset character positions - serve position: further from net
        const pSpawn = this.findNearestIntactTileCenter(1, 2, 'player');
        Physics.player.x = pSpawn.x;
        Physics.player.y = pSpawn.y;
        Physics.player.z = 0;
        Physics.player.vx = 0;
        Physics.player.vy = 0;
        Physics.player.vz = 0;
        Physics.player.onGround = true;
        Physics.player.hasSpiked = false;
        Physics.player.hasReceived = false;
        // CRITICAL: scoring reset must override falling/respawn mechanics
        Physics.player.isFalling = false;
        Physics.player.fallTimer = 0;
        Physics.player.fallEdge = null;
        Physics.player.isBlinking = false;
        Physics.player.blinkTimer = 0;
        
        const aiSpawn = this.findNearestIntactTileCenter(7, 2, 'ai');
        Physics.ai.x = aiSpawn.x;
        Physics.ai.y = aiSpawn.y;
        Physics.ai.z = 0;
        Physics.ai.vx = 0;
        Physics.ai.vy = 0;
        Physics.ai.vz = 0;
        Physics.ai.onGround = true;
        Physics.ai.hasSpiked = false;
        Physics.ai.hasReceived = false;
        // CRITICAL: scoring reset must override falling/respawn mechanics
        Physics.ai.isFalling = false;
        Physics.ai.fallTimer = 0;
        Physics.ai.fallEdge = null;
        Physics.ai.isBlinking = false;
        Physics.ai.blinkTimer = 0;
        
        // Reset transient serve state (in case a point happens mid-charge or mid-spike-serve jump)
        this.state.serveMovementLock = 0;
        this.state.isChargingServe = false;
        this.state.serveChargeTimer = 0;
        this.state.spikeServePending = false;
        this.state.spikeServePower = null;
        this.state.spikeServeTarget = null;
        this.state.isOverchargedSpikeServe = false;
        this.state.blockHitUntilIRelease = false;
        
        // Set up serve for the winner
        // Alternate serve based on total points
        this.state.isServing = true;
        const totalPoints = this.state.playerScore + this.state.aiScore;
        this.state.servingPlayer = (totalPoints % 2 === 0) ? 'player' : 'ai';
        this.setupServe();
    },
    
    setupServe() {
        // Position ball "held" by the serving character
        const servingChar = this.state.servingPlayer === 'player' ? Physics.player : Physics.ai;
        
        // Ball is held at character position, slightly above ground
        Physics.ball.x = servingChar.x;
        Physics.ball.y = servingChar.y;
        Physics.ball.z = servingChar.radius * 1.5; // Slightly above character (held position)
        Physics.ball.vx = 0;
        Physics.ball.vy = 0;
        Physics.ball.vz = 0;
        Physics.ball.lastTouchedBy = null;
        Physics.ball.lastHitType = null;
        Physics.ball.tileDamageBounces = 0;
        Physics.ball.hasScored = false;
        Physics.ball.justServed = false;
        Physics.ball.serveTimer = 0;
        
        // AI serving pacing
        this.state.aiServeTimer = (this.state.servingPlayer === 'ai') ? this.state.aiServeDelay : 0;
    },
    
    // Serve with charge power (called on release or max charge)
    serveBallWithCharge() {
        // Only allow serve if in serving state and charging
        // Don't allow if spike serve is already pending (prevents double-serve and target overwrite)
        if (!this.state.isServing || !this.state.isChargingServe || this.state.spikeServePending) {
            return false;
        }
        
        const servingChar = this.state.servingPlayer === 'player' ? Physics.player : Physics.ai;
        
        // Check for directional input (W/S keys) when serving
        // Only check for player serves (AI serves straight)
        let serveDirection = 0; // 0 = forward (middle), -1 = left (up from camera), 1 = right (down from camera)
        if (this.state.servingPlayer === 'player') {
            if (Input.isPressed('w')) {
                serveDirection = -1; // W: ball goes left (up from camera view)
            } else if (Input.isPressed('s')) {
                serveDirection = 1; // S: ball goes right (down from camera view)
            }
        }
        
        // Map charge time to power
        // Charge mapping:
        // - 0.0s to minChargeTime (0.05s = 10%): No serve allowed
        // - minChargeTime (0.05s = 10%) to 65%: Normal arching serve scaling from too close to furthest (highest x before out of bounds)
        //   - At 10%: Uses "too close" power (might not cross net)
        //   - At 65%: Uses "furthest normal" power (high x, still within court)
        // - >65% to 85%: Spike serve (jump, lands inside court near edge)
        // - >85% to 100%: Overcharged spike serve (jump, lands out of court)
        // Power range: too close (H=0.1711, V=0.1756) to too far (H=0.2644, V=0.2822)
        const minHorizontalPower = 0.1711; // Too close (slider 3) - might not cross net
        const maxHorizontalPower = 0.2644; // Too far (slider 9) - goes out of bounds
        const minVerticalPower = 0.1756;   // Too close (slider 3)
        const maxVerticalPower = 0.2822;   // Too far (slider 9)
        
        // Furthest normal serve that still lands inside (slider 8 horizontal, slider 7 vertical)
        const furthestNormalHorizontalPower = 0.2489; // Slider 8 - highest x before out of bounds
        const furthestNormalVerticalPower = 0.2467;   // Slider 7
        
        // Calculate charge percentage (0-100%)
        const chargePercent = (this.state.serveChargeTimer / this.state.maxChargeTime) * 100;
        // Zone definitions:
        // - 0% to 65%: Normal serve zone (possibility of not crossing net if too early)
        // - >65% to 85%: Sweet spot zone (spike serve, lands inside court near edge)
        // - >85% to 100%: Overcharged spike serve (lands out of court)
        const isSpikeServe = chargePercent > 65 && chargePercent <= 85; // Sweet spot: >65% to 85% (exclusive of 65%, inclusive of 85%)
        const isOverchargedSpikeServe = chargePercent > 85; // Overcharged: >85% to 100% (exclusive of 85%)
        
        let horizontalMultiplier, verticalMultiplier;
        
        if (isSpikeServe || isOverchargedSpikeServe) {
            // Spike serve: trigger jump first, serve at peak
            // Store serve parameters for later execution
            const servingChar = this.state.servingPlayer === 'player' ? Physics.player : Physics.ai;
            
            // Calculate target - always forward (toward opponent), W/S controls left/right direction
            // Re-check W/S keys at this moment to ensure correct direction
            let currentServeDirection = 0;
            if (this.state.servingPlayer === 'player') {
                const wPressed = Input.isPressed('w');
                const sPressed = Input.isPressed('s');
                const iPressed = Input.isPressed('i');
                
                if (wPressed) {
                    currentServeDirection = -1; // W: left (up from camera view)
                } else if (sPressed) {
                    currentServeDirection = 1; // S: right (down from camera view)
                }
            }
            
            let targetX, targetY;
            if (this.state.servingPlayer === 'player') {
                // Determine target based on whether it's overcharged or normal spike serve
                if (isOverchargedSpikeServe) {
                    // Overcharged spike serve (85-100%): lands out of court
                    // Target beyond court bounds for out-of-court landing
                    targetX = Physics.COURT_WIDTH * 1.05; // Beyond court edge (8 * 1.05 = 8.4, out of bounds)
                } else {
                    // Normal spike serve (75-85%): lands inside court
                    // Keep targetX fixed at high x (right side) but inside court
                    targetX = 5.5; // Right side (AI side), high but inside court (COURT_WIDTH = 8)
                }
                
                // W/S controls y (front/back) like normal serve
                if (currentServeDirection === -1) {
                    // W: left (up from camera view) = higher y (back of court) - same as normal serve
                    targetY = Physics.COURT_LENGTH * 0.8; // Back of court
                } else if (currentServeDirection === 1) {
                    // S: right (down from camera view) = lower y (front of court) - same as normal serve
                    targetY = Physics.COURT_LENGTH * 0.2; // Front of court
                } else {
                    // I alone: middle y (middle depth)
                    targetY = Physics.COURT_LENGTH * 0.5; // Middle depth
                }
                
            } else {
                // AI always serves forward (toward player side)
                // Always target 3rd lane from net on player side (tx=1, center at x=1.5)
                targetX = 1.5; // 3rd lane from net (tx=1) on player side
                targetY = Physics.COURT_LENGTH * 0.98; // Back
            }
            
            // Store spike serve parameters
            this.state.isOverchargedSpikeServe = isOverchargedSpikeServe;
            if (isOverchargedSpikeServe) {
                // Overcharged spike serve (85-100%): lands out of court
                // Use increased horizontal power to reach out-of-bounds target
                this.state.spikeServePower = {
                    horizontal: maxHorizontalPower * 3.5, // Increased horizontal power to reach out-of-bounds (8.4)
                    vertical: 0.18 // Higher vertical (less downward angle) to go further before landing
                };
            } else {
                // Normal spike serve (75-85%): lands inside court
                this.state.spikeServePower = {
                    horizontal: maxHorizontalPower * 2.5, // Very strong horizontal (increased to compensate for ballMovementSpeed)
                    vertical: 0.12 // Lower vertical for flatter spike (reduced from 0.15)
                };
            }
            // CRITICAL: Store target and lock it - this should NEVER be overwritten
            // Once spikeServePending is set, these values are LOCKED until executeSpikeServe() is called
            const storedTargetX = targetX;
            const storedTargetY = targetY;
            const storedChargeTimer = this.state.serveChargeTimer; // Lock the charge timer value at this moment
            
            this.state.spikeServeTarget = { x: storedTargetX, y: storedTargetY };
            this.state.spikeServePending = true;
            
            // LOCK serveChargeTimer - it should not be modified after spikeServePending is set
            // Store the charge timer value that was used for calculation
            // This ensures executeSpikeServe() uses the same charge percentage that was used to determine isOverchargedSpikeServe
            
            // Make character jump automatically
            if (servingChar.onGround) {
                servingChar.vz = servingChar.jumpPower;
                servingChar.onGround = false;
            }
            
            // IMPORTANT: If player keeps holding 'I' after this moment, we must not treat it as a normal hit,
            // otherwise next frame main.js will overwrite our spike-serve velocities via Physics.attemptSpike().
            this.state.blockHitUntilIRelease = true;
            
            // Exit charging state but keep serving state (ball stays held)
            // CRITICAL: Do NOT reset serveChargeTimer here - it's locked and will be used by executeSpikeServe()
            this.state.isChargingServe = false;
            // Don't serve yet - wait for jump peak
            return false;
        } else {
            // Normal charge (10% to 65%): scale from too close to furthest normal serve
            // Map charge time from minChargeTime (10%) to 65% of maxChargeTime
            const sweetSpotStartTime = this.state.maxChargeTime * 0.65; // 65% = start of sweet spot
            const effectiveChargeTime = this.state.serveChargeTimer - this.state.minChargeTime; // Start from 10%
            const effectiveMaxChargeTime = sweetSpotStartTime - this.state.minChargeTime; // Range: 10% to 65%
            const chargeRatio = Math.min(effectiveChargeTime / effectiveMaxChargeTime, 1.0);
            
            // Scale from too close (at 10%) to furthest normal serve (at 65%)
            // At 10%: chargeRatio = 0, uses minHorizontalPower (too close, might not cross net)
            // At 65%: chargeRatio = 1, uses furthestNormalHorizontalPower (high x, still within court)
            horizontalMultiplier = minHorizontalPower + (furthestNormalHorizontalPower - minHorizontalPower) * chargeRatio;
            verticalMultiplier = minVerticalPower + (furthestNormalVerticalPower - minVerticalPower) * chargeRatio;
        }
        
        // Determine target (opponent's side)
        let targetX, targetY;
        if (this.state.servingPlayer === 'player') {
            // For normal serves (before 65%): target highest x before out of bounds
            // For spike serves (>65% to 100%): target is already set in spike serve logic above
            if (isSpikeServe || isOverchargedSpikeServe) {
                // Spike serve target was already calculated above, skip here
                // (targetX and targetY are set in the spike serve block)
            } else {
                // Normal serve (before 65%): target highest x before out of bounds
                targetX = Physics.COURT_WIDTH * 0.95; // 95% = 7.6 (highest x before out of bounds, COURT_WIDTH = 8)
                
                // Adjust targetY based on serve direction
                if (serveDirection === -1) {
                    // W: left (up from camera view) = higher y (back of opponent's court)
                    targetY = Physics.COURT_LENGTH * 0.8; // Back of opponent's court
                } else if (serveDirection === 1) {
                    // S: right (down from camera view) = lower y (front of opponent's court)
                    targetY = Physics.COURT_LENGTH * 0.2; // Front of opponent's court
                } else {
                    // I alone: forward (middle)
                    targetY = Physics.COURT_LENGTH * 0.5;  // Middle depth
                }
            }
        } else {
            // AI serves toward player side (left side, x < NET_X)
            // Always target 3rd lane from net on player side (tx=1, center at x=1.5)
            // This ensures the serve always crosses the net (NET_X = 4) regardless of AI position
            targetX = 1.5; // 3rd lane from net (tx=1) on player side
            if (isSpikeServe) {
                targetY = Physics.COURT_LENGTH * 0.95; // Spike serve: back edge
            } else {
                targetY = Physics.COURT_LENGTH * 0.5;  // Middle depth (AI always serves straight)
            }
        }
        
        // Calculate direction to target
        const dirX = targetX - Physics.ball.x;
        const dirY = targetY - Physics.ball.y;
        const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
        
        // Use charge-based multipliers (already calculated above)
        let vx, vy;
        if (dirLength < 0.01) {
            // If ball is already at target, serve straight forward
            if (this.state.servingPlayer === 'player') {
                vx = horizontalMultiplier * Physics.ballMovementSpeed; // Right (toward AI)
            } else {
                // AI serve: ensure it always crosses the net (x=4) toward player side (x < 4)
                vx = -horizontalMultiplier * Physics.ballMovementSpeed; // Left (toward player)
            }
            vy = 0;
        } else {
            // Normalize horizontal direction
            const normDirX = dirX / dirLength;
            const normDirY = dirY / dirLength;
            
            // Apply serve velocity with arching trajectory
            // Scale by ballMovementSpeed to maintain physics consistency
            vx = normDirX * horizontalMultiplier * Physics.ballMovementSpeed;
            vy = normDirY * horizontalMultiplier * Physics.ballMovementSpeed;
            
            // Safety check for AI serves: ensure ball always crosses the net (x=4)
            // Target is always on player side (x < 4), so vx should be negative (leftward)
            if (this.state.servingPlayer === 'ai' && vx >= 0) {
                // Force negative vx to ensure ball crosses net toward player side
                vx = -Math.abs(vx);
            }
        }
        
        // Upward component for arching trajectory
        let vz = verticalMultiplier * Physics.ballMovementSpeed;
        
        // IMPORTANT: Set velocities BEFORE exiting serving state
        // This ensures the velocities are set before Physics.update() processes the ball
        Physics.ball.vx = vx;
        Physics.ball.vy = vy;
        Physics.ball.vz = vz;
        
        // Mark ball as just served to prevent immediate collision with serving character
        Physics.ball.justServed = true;
        Physics.ball.serveTimer = 0.2; // 0.2 seconds grace period (increased to allow ball to move away)
        
        // Track who served
        Physics.ball.lastTouchedBy = this.state.servingPlayer;
        Physics.ball.lastHitType = 'serve';
        Physics.ball.tileDamageBounces = 0;
        Physics.ball.hasScored = false;
        
        // Exit serving state LAST, after everything is set up
        // This ensures Physics.update() will process the ball with the new velocities
        this.state.isServing = false;
        
        // Lock movement for 0.1 seconds after serving to prevent W/S from moving character
        // This ensures directional input only affects serve direction, not character movement
        this.state.serveMovementLock = 0.1;
        
        // Debug log to verify serve (capture charge time before resetting)
        const chargeTimeUsed = this.state.serveChargeTimer;
        const chargePercentUsed = (chargeTimeUsed / this.state.maxChargeTime) * 100;
        console.log('Serve executed:', {
            servingPlayer: this.state.servingPlayer,
            chargeTime: chargeTimeUsed.toFixed(3),
            chargePercent: chargePercentUsed.toFixed(1) + '%',
            isSpikeServe: isSpikeServe,
            ballPos: { x: Physics.ball.x.toFixed(2), y: Physics.ball.y.toFixed(2), z: Physics.ball.z.toFixed(2) },
            target: { x: targetX.toFixed(2), y: targetY.toFixed(2) },
            velocities: { vx: vx.toFixed(4), vy: vy.toFixed(4), vz: vz.toFixed(4) },
            multipliers: { 
                horizontal: horizontalMultiplier.toFixed(4), 
                vertical: verticalMultiplier.toFixed(4) 
            },
            ballMovementSpeed: Physics.ballMovementSpeed.toFixed(4)
        });
        
        // Reset charging state (after logging)
        this.state.isChargingServe = false;
        this.state.serveChargeTimer = 0;
        
        return true;
    },
    
    // Legacy serveBall function (kept for AI, but player uses serveBallWithCharge)
    serveBall() {
        // AI always uses this (no charging, uses default slider values)
        if (!this.state.isServing) {
            return false;
        }
        
        const servingChar = this.state.servingPlayer === 'player' ? Physics.player : Physics.ai;
        
        // Determine target (opponent's side)
        let targetX, targetY;
        if (this.state.servingPlayer === 'player') {
            targetX = Physics.COURT_WIDTH * 0.75;
            targetY = Physics.COURT_LENGTH * 0.5;
        } else {
            // AI normal serve only (no spike serve), but with some variation:
            // - X: always middle of player's side (center of x-axis on player court)
            // - Y: randomized (front/back)
            // Aim at the 3rd lane from the net on the player side:
            // Lane 1 (adjacent to net) is indestructible (tx=3), lane 2 is tx=2, lane 3 is tx=1.
            targetX = 1.5; // center of tx=1 tile
            const minY = Physics.COURT_LENGTH * 0.2;
            const maxY = Physics.COURT_LENGTH * 0.8;
            targetY = minY + Math.random() * (maxY - minY);
        }
        
        const b = Physics.ball;
        
        // Use default slider values for serves
        const horizontalMultiplier = this.serveHorizontalMultiplier;
        const verticalMultiplier = this.serveVerticalMultiplier;
        
        // Upward component for arching trajectory
        let vz = verticalMultiplier * Physics.ballMovementSpeed;
        
        let vx, vy;
        if (this.state.servingPlayer === 'ai') {
            // Make AI serve arc higher (more vertical).
            // Since AI serve is target-driven, a higher vz increases airtime -> naturally lowers horizontal speed.
            vz *= 1.7;

            // AI serve should ALWAYS cross the net and land on the intended tile, regardless of AI position.
            // So we compute vx/vy from an estimated flight time (target-driven), instead of scaling by ballMovementSpeed.
            const gEff = Physics.GRAVITY * Physics.ballMovementSpeed;
            const z0 = Math.max(0.001, b.z - b.groundLevel);
            const disc = (vz * vz) + 2 * gEff * z0;
            const t = gEff > 1e-6 ? (vz + Math.sqrt(Math.max(0, disc))) / gEff : 60; // frames
            
            vx = (targetX - b.x) / t;
            vy = (targetY - b.y) / t;
            
            // Safety: if serving from AI side toward player side, vx must be negative to cross the net.
            if (b.x > Physics.NET_X && targetX < Physics.NET_X && vx >= 0) {
                vx = -Math.abs(vx || 0.01);
            }
        } else {
            // Player legacy serve (mostly unused now; player uses serveBallWithCharge)
            // Calculate direction to target
            const dirX = targetX - b.x;
            const dirY = targetY - b.y;
            const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
            
            if (dirLength < 0.01) {
                vx = horizontalMultiplier * Physics.ballMovementSpeed;
                vy = 0;
            } else {
                const normDirX = dirX / dirLength;
                const normDirY = dirY / dirLength;
                vx = normDirX * horizontalMultiplier * Physics.ballMovementSpeed;
                vy = normDirY * horizontalMultiplier * Physics.ballMovementSpeed;
            }
        }
        
        // Set velocities
        Physics.ball.vx = vx;
        Physics.ball.vy = vy;
        Physics.ball.vz = vz;
        
        // Mark ball as just served
        Physics.ball.justServed = true;
        Physics.ball.serveTimer = 0.2;
        
        // Track who served
        Physics.ball.lastTouchedBy = this.state.servingPlayer;
        Physics.ball.lastHitType = 'serve';
        Physics.ball.tileDamageBounces = 0;
        Physics.ball.hasScored = false;
        
        // Exit serving state
        this.state.isServing = false;
        
        // If the serve was triggered while 'I' is still held (auto-serve), block hit until release
        // to prevent immediate Physics.attemptSpike()/attemptReceive() overwriting serve velocities.
        this.state.blockHitUntilIRelease = true;
        
        return true;
    },
    
    // Execute spike serve at jump peak
    executeSpikeServe() {
        if (!this.state.spikeServePending || !this.state.spikeServePower || !this.state.spikeServeTarget) {
            return false;
        }
        
        // CRITICAL: Exit serving state FIRST, before setting velocities
        // This prevents Physics.update() from resetting velocities to 0 in the same frame
        this.state.isServing = false;
        
        const servingChar = this.state.servingPlayer === 'player' ? Physics.player : Physics.ai;
        const { horizontal, vertical } = this.state.spikeServePower;
        const { x: targetX, y: targetY } = this.state.spikeServeTarget;
        
        // Calculate direction to target
        const dirX = targetX - Physics.ball.x;
        const dirY = targetY - Physics.ball.y;
        const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
        
        // Calculate velocities
        let vx, vy;
        if (dirLength < 0.01) {
            if (this.state.servingPlayer === 'player') {
                vx = horizontal * Physics.ballMovementSpeed;
            } else {
                vx = -horizontal * Physics.ballMovementSpeed;
            }
            vy = 0;
        } else {
            const normDirX = dirX / dirLength;
            const normDirY = dirY / dirLength;
            vx = normDirX * horizontal * Physics.ballMovementSpeed;
            vy = normDirY * horizontal * Physics.ballMovementSpeed;
        }
        
        // Downward spike trajectory (negative vz for downward)
        // Steeper angle for normal spike serve, less steep for overcharged (goes out of court)
        const downwardMultiplier = this.state.isOverchargedSpikeServe ? 0.8 : 1.5; // Even less steep for overcharged (0.8 instead of 1.0)
        const vz = -vertical * Physics.ballMovementSpeed * downwardMultiplier;
        
        // Set ball velocities
        const timestamp = performance.now();
        Physics.ball.vx = vx;
        Physics.ball.vy = vy;
        Physics.ball.vz = vz;
        
        // Store timestamp for debugging
        Physics.ball._lastVelocitySetTime = timestamp;
        Physics.ball._lastVelocitySetValues = { vx, vy, vz };
        
        // CRITICAL: If player keeps holding 'I' after spike serve executes, main.js would treat it as a hit
        // and call Physics.attemptSpike(), overwriting these velocities (matches your log: vx=0.2497, vz=-0.0907).
        this.state.blockHitUntilIRelease = true;
        
        
        // Mark ball as just served
        Physics.ball.justServed = true;
        Physics.ball.serveTimer = 0.2;
        
        // Track who served
        Physics.ball.lastTouchedBy = this.state.servingPlayer;
        Physics.ball.lastHitType = 'spikeServe';
        Physics.ball.tileDamageBounces = 0;
        Physics.ball.hasScored = false;
        
        // Exit serving state (isServing already set to false at the beginning of this function)
        this.state.spikeServePending = false;
        this.state.spikeServePower = null;
        this.state.spikeServeTarget = null;
        this.state.isOverchargedSpikeServe = false;
        
        // Lock movement briefly
        this.state.serveMovementLock = 0.1;
        
        return true;
    },
    
    updateScoreDisplay() {
        const playerScoreEl = document.getElementById('player-score');
        const aiScoreEl = document.getElementById('ai-score');
        if (playerScoreEl) playerScoreEl.textContent = this.state.playerScore;
        if (aiScoreEl) aiScoreEl.textContent = this.state.aiScore;
    },
    
    getStatusText() {
        if (this.state.matchOver) {
            const who = this.state.matchWinner === 'player' ? 'Player wins!' : 'AI wins!';
            const why = this.state.matchEndReason === 'tiles' ? ' (All tiles destroyed)' : ' (First to 7)';
            return `Match over — ${who}${why} Press P to reset.`;
        }
        if (this.state.isResetting) {
            return 'Point scored! Resetting...';
        }
        if (this.state.isServing) {
            if (this.state.servingPlayer === 'player') {
                // Only show charging status after 0.1s has elapsed (prevents blinky effect on quick taps)
                if (this.state.isChargingServe && this.state.serveChargeTimer >= this.state.minChargeTime) {
                    const chargePercent = Math.min((this.state.serveChargeTimer / this.state.maxChargeTime) * 100, 100);
                    return `Charging serve... ${chargePercent.toFixed(0)}% (Release I to serve, W/S for direction)`;
                }
                return 'Hold I to charge serve (W/S for direction)';
            } else {
                return 'AI is serving...';
            }
        }
        return 'WASD: Move | J: Jump | I: Spike/Receive';
    }
};

