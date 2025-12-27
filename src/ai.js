// AI system - tracks ball and tries to return it

const AI = {
    // AI state
    state: {
        targetX: 0,
        targetY: 0,
        shouldJump: false,
        shouldSpike: false,
        lastBallX: 0,
        lastBallY: 0
    },
    
    // AI parameters
    reactionSpeed: 0.12,
    jumpDistance: 0.5,      // Distance at which AI will jump to hit ball
    hitDistance: 0.4,       // Distance at which AI can hit the ball
    predictionTime: 0.3,    // How far ahead to predict ball position
    
    init() {
        // AI starts on right side
        const ai = Physics.ai;
        this.state.targetX = 0;
        this.state.targetY = 0;
        this.state.lastBallX = 0;
        this.state.lastBallY = 0;
    },
    
    update() {
        const ai = Physics.ai;
        const ball = Physics.ball;
        const netX = Physics.NET_X;
        
        // Check if ball is on AI's side of the court (x > NET_X)
        const ballOnAISide = ball.x > netX;
        
        if (ballOnAISide) {
            // Ball is on AI's side - track and try to hit it
            // Predict where ball will be
            const predictedX = ball.x + ball.vx * this.predictionTime;
            const predictedY = ball.y + ball.vy * this.predictionTime;
            const predictedZ = ball.z + ball.vz * this.predictionTime;
            
            // Calculate distance to predicted ball position
            const dx = predictedX - ai.x;
            const dy = predictedY - ai.y;
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
            
            // Check if AI should spike (mid-air and ball in spike zone)
            if (!ai.onGround && !ai.hasSpiked) {
                const spikeZoneZ = ai.z + Physics.SPIKE_ZONE_HEAD_OFFSET;
                const dx = ball.x - ai.x;
                const dy = ball.y - ai.y;
                const dz = ball.z - spikeZoneZ;
                const distToSpikeZone = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distToSpikeZone < Physics.SPIKE_ZONE_RADIUS) {
                    this.state.shouldSpike = true;
                } else {
                    this.state.shouldSpike = false;
                }
            } else {
                this.state.shouldSpike = false;
            }
            
            // Store last ball position for tracking
            this.state.lastBallX = ball.x;
            this.state.lastBallY = ball.y;
        } else {
            // Ball is on player's side - return to center position
            const centerX = 6.0;  // Middle of AI side
            const centerY = Physics.COURT_LENGTH / 2;  // Middle depth
            
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
        }
    },
    
    getInput() {
        return {
            vx: this.state.targetX * this.reactionSpeed,
            vy: this.state.targetY * this.reactionSpeed,
            jump: this.state.shouldJump,
            spike: this.state.shouldSpike
        };
    }
};

