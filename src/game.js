// Game state management

const Game = {
    state: {
        playerScore: 0,
        aiScore: 0,
        scoreCooldown: 0, // Prevent multiple scores from same bounce/fall
        resetTimer: 0, // Timer for reset after scoring
        isResetting: false,
        isServing: true, // Game starts with serving state
        servingPlayer: 'player' // Who is currently serving ('player' or 'ai')
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
        this.serveHorizontalMultiplier = 0.2022; // Default horizontal (slider 5)
        this.serveVerticalMultiplier = 0.2111;   // Default vertical (slider 5)
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
        // Reset character positions (middle of their sides)
        Physics.player.x = Physics.COURT_WIDTH * 0.25; // Middle of player side
        Physics.player.y = Physics.COURT_LENGTH * 0.5; // Middle depth
        Physics.player.z = 0;
        Physics.player.vx = 0;
        Physics.player.vy = 0;
        Physics.player.vz = 0;
        Physics.player.onGround = true;
        Physics.player.hasSpiked = false;
        Physics.player.hasReceived = false;
        
        Physics.ai.x = Physics.COURT_WIDTH * 0.75; // Middle of AI side
        Physics.ai.y = Physics.COURT_LENGTH * 0.5; // Middle depth
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
    
    serveBall() {
        // Only allow serve if in serving state
        if (!this.state.isServing) {
            return false;
        }
        
        const servingChar = this.state.servingPlayer === 'player' ? Physics.player : Physics.ai;
        
        // Determine target (opponent's side)
        let targetX, targetY;
        if (this.state.servingPlayer === 'player') {
            // Player serves toward AI side (right side, x > NET_X)
            targetX = Physics.COURT_WIDTH * 0.75; // 75% across court (AI side)
            targetY = Physics.COURT_LENGTH * 0.5;  // Middle depth
        } else {
            // AI serves toward player side (left side, x < NET_X)
            targetX = Physics.COURT_WIDTH * 0.25; // 25% across court (player side)
            targetY = Physics.COURT_LENGTH * 0.5;  // Middle depth
        }
        
        // Calculate direction to target
        const dirX = targetX - Physics.ball.x;
        const dirY = targetY - Physics.ball.y;
        const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
        
        // Calculate velocities - create a nice arcing trajectory
        // Use sliders to control horizontal and vertical multipliers independently
        // Higher vertical relative to horizontal = steeper arc (higher peak, same/slightly less horizontal distance)
        const horizontalMultiplier = this.serveHorizontalMultiplier;
        const verticalMultiplier = this.serveVerticalMultiplier;
        
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
            // Scale by ballMovementSpeed and servePower to maintain physics consistency
            vx = normDirX * horizontalMultiplier * Physics.ballMovementSpeed;
            vy = normDirY * horizontalMultiplier * Physics.ballMovementSpeed;
        }
        
        // Upward component for arching trajectory - needs to be significant for visible arc
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
        
        // Debug log to verify serve
        console.log('Serve executed:', {
            servingPlayer: this.state.servingPlayer,
            ballPos: { x: Physics.ball.x.toFixed(2), y: Physics.ball.y.toFixed(2), z: Physics.ball.z.toFixed(2) },
            target: { x: targetX.toFixed(2), y: targetY.toFixed(2) },
            velocities: { vx: vx.toFixed(4), vy: vy.toFixed(4), vz: vz.toFixed(4) },
            multipliers: { 
                horizontal: this.serveHorizontalMultiplier.toFixed(2), 
                vertical: this.serveVerticalMultiplier.toFixed(2) 
            },
            ballMovementSpeed: Physics.ballMovementSpeed.toFixed(4)
        });
        
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
                return 'Press I to serve';
            } else {
                return 'AI is serving...';
            }
        }
        return 'WASD: Move | J: Jump | I: Spike/Receive';
    }
};

