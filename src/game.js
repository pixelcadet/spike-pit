// Game state management

const Game = {
    state: {
        playerScore: 0,
        aiScore: 0,
        scoreCooldown: 0, // Prevent multiple scores from same bounce/fall
        resetTimer: 0, // Timer for reset after scoring
        isResetting: false,
        isServing: true, // Game starts with serving state
        servingPlayer: 'player', // Who is currently serving ('player' or 'ai')
        serveMovementLock: 0, // Timer to lock movement briefly after serving (prevents W/S from moving character)
        isChargingServe: false, // True when I key is held down during serving
        serveChargeTimer: 0, // How long I has been held (0.0 to maxChargeTime)
        maxChargeTime: 0.5, // Maximum charge time (beyond this = out of bounds)
        minChargeTime: 0.1, // Minimum charge time to allow serve (prevents accidental taps)
        earlyReleaseThreshold: 0.2 // Releases before this time get "too close" power (punishment)
    },
    
    // Serve multipliers (set by sliders)
    serveHorizontalMultiplier: 0.2022, // Default horizontal multiplier (slider 5)
    serveVerticalMultiplier: 0.2111,   // Default vertical multiplier (slider 5)
    
    init() {
        this.state.playerScore = 0;
        this.state.aiScore = 0;
        this.state.scoreCooldown = 0;
        this.state.resetTimer = 0;
        this.state.isResetting = false;
        this.state.isServing = true;
        this.state.servingPlayer = 'player';
        this.state.serveMovementLock = 0;
        this.state.isChargingServe = false;
        this.state.serveChargeTimer = 0;
        this.state.maxChargeTime = 0.5;
        this.state.minChargeTime = 0.1;
        this.state.earlyReleaseThreshold = 0.2;
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
    
    update(input, deltaTime) {
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
        
        // Update serve movement lock timer
        if (this.state.serveMovementLock > 0) {
            this.state.serveMovementLock -= deltaTime;
            if (this.state.serveMovementLock < 0) {
                this.state.serveMovementLock = 0;
            }
        }
        
        // Update serve charge timer
        if (this.state.isChargingServe && this.state.isServing && this.state.servingPlayer === 'player') {
            this.state.serveChargeTimer += deltaTime;
            
            // Auto-serve at max charge (ball will go out of bounds)
            if (this.state.serveChargeTimer >= this.state.maxChargeTime) {
                console.log('Auto-serving at max charge');
                this.state.serveChargeTimer = this.state.maxChargeTime;
                this.serveBallWithCharge();
                // serveBallWithCharge will reset isChargingServe and serveChargeTimer
            }
        }
    },
    
    scorePoint(winner) {
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
        
        // Start reset timer (0.5s delay before reset)
        this.state.isResetting = true;
        this.state.resetTimer = 0.5;
        
        this.updateScoreDisplay();
    },
    
    resetAfterScore() {
        // Reset character positions - serve position: further from net
        Physics.player.x = 1.0; // Further from net (closer to left edge)
        Physics.player.y = 2.0; // Middle depth
        Physics.player.z = 0;
        Physics.player.vx = 0;
        Physics.player.vy = 0;
        Physics.player.vz = 0;
        Physics.player.onGround = true;
        Physics.player.hasSpiked = false;
        Physics.player.hasReceived = false;
        
        Physics.ai.x = 7.0; // Further from net (closer to right edge)
        Physics.ai.y = 2.0; // Middle depth
        Physics.ai.z = 0;
        Physics.ai.vx = 0;
        Physics.ai.vy = 0;
        Physics.ai.vz = 0;
        Physics.ai.onGround = true;
        Physics.ai.hasSpiked = false;
        Physics.ai.hasReceived = false;
        
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
        Physics.ball.hasScored = false;
    },
    
    // Serve with charge power (called on release or max charge)
    serveBallWithCharge() {
        // Only allow serve if in serving state and charging
        if (!this.state.isServing || !this.state.isChargingServe) {
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
        // - 0.0s to minChargeTime (0.1s): No serve allowed
        // - minChargeTime (0.1s) to earlyReleaseThreshold (0.2s): "Too close" power (punishment for early release)
        // - earlyReleaseThreshold (0.2s) to maxChargeTime (0.5s): Normal scaling from too close to too far
        // Power range: too close (H=0.1711, V=0.1756) to too far (H=0.2644, V=0.2822)
        const minHorizontalPower = 0.1711; // Too close (slider 3) - might not cross net
        const maxHorizontalPower = 0.2644; // Too far (slider 9) - goes out of bounds
        const minVerticalPower = 0.1756;   // Too close (slider 3)
        const maxVerticalPower = 0.2822;   // Too far (slider 9)
        
        let horizontalMultiplier, verticalMultiplier;
        
        if (this.state.serveChargeTimer < this.state.earlyReleaseThreshold) {
            // Early release: use "too close" power (punishment)
            horizontalMultiplier = minHorizontalPower;
            verticalMultiplier = minVerticalPower;
        } else {
            // Normal charge: scale from too close to too far
            // Map charge time from earlyReleaseThreshold to maxChargeTime
            const effectiveChargeTime = this.state.serveChargeTimer - this.state.earlyReleaseThreshold;
            const effectiveMaxChargeTime = this.state.maxChargeTime - this.state.earlyReleaseThreshold;
            const chargeRatio = Math.min(effectiveChargeTime / effectiveMaxChargeTime, 1.0);
            
            horizontalMultiplier = minHorizontalPower + (maxHorizontalPower - minHorizontalPower) * chargeRatio;
            verticalMultiplier = minVerticalPower + (maxVerticalPower - minVerticalPower) * chargeRatio;
        }
        
        // Determine target (opponent's side)
        let targetX, targetY;
        if (this.state.servingPlayer === 'player') {
            // Player serves toward AI side (right side, x > NET_X)
            targetX = Physics.COURT_WIDTH * 0.75; // 75% across court (AI side)
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
        } else {
            // AI serves toward player side (left side, x < NET_X)
            targetX = Physics.COURT_WIDTH * 0.25; // 25% across court (player side)
            targetY = Physics.COURT_LENGTH * 0.5;  // Middle depth (AI always serves straight)
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
        }
        
        // Upward component for arching trajectory
        const vz = verticalMultiplier * Physics.ballMovementSpeed;
        
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
        Physics.ball.hasScored = false;
        
        // Exit serving state LAST, after everything is set up
        // This ensures Physics.update() will process the ball with the new velocities
        this.state.isServing = false;
        
        // Lock movement for 0.1 seconds after serving to prevent W/S from moving character
        // This ensures directional input only affects serve direction, not character movement
        this.state.serveMovementLock = 0.1;
        
        // Debug log to verify serve (capture charge time before resetting)
        const chargeTimeUsed = this.state.serveChargeTimer;
        console.log('Serve executed:', {
            servingPlayer: this.state.servingPlayer,
            chargeTime: chargeTimeUsed.toFixed(3),
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
            targetX = Physics.COURT_WIDTH * 0.25;
            targetY = Physics.COURT_LENGTH * 0.5;
        }
        
        // Calculate direction to target
        const dirX = targetX - Physics.ball.x;
        const dirY = targetY - Physics.ball.y;
        const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
        
        // Use default slider values for AI
        const horizontalMultiplier = this.serveHorizontalMultiplier;
        const verticalMultiplier = this.serveVerticalMultiplier;
        
        let vx, vy;
        if (dirLength < 0.01) {
            // If ball is already at target, serve straight forward
            if (this.state.servingPlayer === 'player') {
                vx = horizontalMultiplier * Physics.ballMovementSpeed;
            } else {
                vx = -horizontalMultiplier * Physics.ballMovementSpeed;
            }
            vy = 0;
        } else {
            // Normalize horizontal direction
            const normDirX = dirX / dirLength;
            const normDirY = dirY / dirLength;
            
            // Apply serve velocity with arching trajectory
            vx = normDirX * horizontalMultiplier * Physics.ballMovementSpeed;
            vy = normDirY * horizontalMultiplier * Physics.ballMovementSpeed;
        }
        
        // Upward component for arching trajectory
        const vz = verticalMultiplier * Physics.ballMovementSpeed;
        
        // Set velocities
        Physics.ball.vx = vx;
        Physics.ball.vy = vy;
        Physics.ball.vz = vz;
        
        // Mark ball as just served
        Physics.ball.justServed = true;
        Physics.ball.serveTimer = 0.2;
        
        // Track who served
        Physics.ball.lastTouchedBy = this.state.servingPlayer;
        Physics.ball.hasScored = false;
        
        // Exit serving state
        this.state.isServing = false;
        
        return true;
    },
    
    updateScoreDisplay() {
        const playerScoreEl = document.getElementById('player-score');
        const aiScoreEl = document.getElementById('ai-score');
        if (playerScoreEl) playerScoreEl.textContent = this.state.playerScore;
        if (aiScoreEl) aiScoreEl.textContent = this.state.aiScore;
    },
    
    getStatusText() {
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

