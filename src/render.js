// Rendering system - projection, drawing, sprites
// Converts world coordinates (x, y, z) to screen coordinates

const Render = {
    canvas: null,
    ctx: null,
    // Highlight states for visual feedback
    playerSpikeHighlight: false,
    playerReceivingHighlight: false,
    aiSpikeHighlight: false,
    aiReceivingHighlight: false,
    
    // Canvas dimensions
    width: 800,
    height: 600,
    
    // Perspective projection parameters (side camera view)
    horizonY: 100,           // Y position of horizon on screen (top)
    scaleAtBottom: 1.0,      // Scale at bottom of screen (front/closer)
    scaleAtTop: 0.8,         // Scale at top of screen (back/farther) - 80% of front
    depthRange: 4,           // World depth range (0 to COURT_LENGTH = 4)
    
    // Court rendering
    courtTileSize: 88,      // Base tile size in pixels (reduced slightly for narrower court width)
    
    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Initialize projection parameters based on court
        this.depthRange = Physics.COURT_LENGTH;
    },
    
    // Project world coordinates to screen space
    // Camera is from the side, looking at the court
    // X (left/right) maps to screen X
    // Y (depth) creates perspective (receding into distance)
    // Z (height) affects screen Y
    project(x, y, z) {
        // Normalize y to 0-1 range (0 = front/closer, 1 = back/farther)
        const normalizedY = y / this.depthRange;
        
        // Calculate scale based on depth (closer = larger, farther = smaller)
        const scale = this.scaleAtBottom + (this.scaleAtTop - this.scaleAtBottom) * normalizedY;
        
        // X maps directly to screen X (left/right), centered
        const centerX = this.width / 2;
        const xOffset = (x - Physics.COURT_WIDTH / 2) * this.courtTileSize;
        const screenX = centerX + xOffset * scale;
        
        // Y maps to screen Y with perspective (y=0 is front/bottom, y=COURT_LENGTH is back/top)
        // To maintain square cells, integrate the scale function along Y
        // Each unit of Y should take up courtTileSize * scale(y) pixels on screen
        // Using analytical integration for accuracy:
        // Integral of scale(y) from 0 to y where scale(y) = scaleAtBottom - scaleDiff * (y/depthRange)
        // Result: scaleAtBottom * y - (scaleDiff * y^2) / (2 * depthRange)
        const scaleDiff = this.scaleAtBottom - this.scaleAtTop;
        const integratedDepth = this.courtTileSize * (
            this.scaleAtBottom * y - 
            (scaleDiff * y * y) / (2 * this.depthRange)
        );
        
        // Calculate screen Y: start at bottom, subtract integrated scaled depth
        // Position court lower on screen (closer to bottom than top)
        const totalCourtHeight = this.courtTileSize * (
            this.scaleAtBottom * this.depthRange - 
            (scaleDiff * this.depthRange * this.depthRange) / (2 * this.depthRange)
        );
        const baseOffset = (this.height - totalCourtHeight) * 0.15; // Position court much lower (only 15% from bottom)
        const screenY = this.height - baseOffset - integratedDepth;
        
        // Z (height) moves up on screen (subtract from screenY)
        const screenZ = screenY - z * this.courtTileSize * scale;
        
        return {
            x: screenX,
            y: screenZ,
            scale: scale
        };
    },
    
    // Draw court (8 cells wide, 4 cells long - rotated 90 degrees)
    drawCourt() {
        const ctx = this.ctx;
        
        // Court background
        ctx.fillStyle = '#4a7c59';
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw tiles with forced perspective
        // 8 cells wide (tx: 0-7, net at tx=4)
        // 4 cells long (ty: 0-3, depth) - 4x4 grid per side
        const tilesWide = 8;
        const tilesLong = 4;
        
        for (let ty = 0; ty < tilesLong; ty++) {
            for (let tx = 0; tx < tilesWide; tx++) {
                const worldX = tx;
                const worldY = ty;
                
                // Project tile corners (y increases toward back/top)
                // Project exact cell boundaries to ensure square cells
                const frontLeft = this.project(worldX, worldY, 0);
                const frontRight = this.project(worldX + 1, worldY, 0);
                const backLeft = this.project(worldX, worldY + 1, 0);
                const backRight = this.project(worldX + 1, worldY + 1, 0);
                
                // Alternate tile colors for grid effect
                const isEven = (tx + ty) % 2 === 0;
                ctx.fillStyle = isEven ? '#5a8c69' : '#4a7c59';
                
                // Draw trapezoid tile (wider at front, narrower at back)
                ctx.beginPath();
                ctx.moveTo(frontLeft.x, frontLeft.y);
                ctx.lineTo(frontRight.x, frontRight.y);
                ctx.lineTo(backRight.x, backRight.y);
                ctx.lineTo(backLeft.x, backLeft.y);
                ctx.closePath();
                ctx.fill();
                
                // Draw tile border
                ctx.strokeStyle = '#3a6c49';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        
        // Draw net
        this.drawNet();
    },
    
    drawNet() {
        const ctx = this.ctx;
        const netX = Physics.NET_X; // 4 - divides court horizontally (X axis)
        const netHeight = 1.0; // Net height
        
        // Draw net shadow on the ground first (so it appears behind the net)
        const shadowFront = this.project(netX, 0, 0);
        const shadowBack = this.project(netX, Physics.COURT_LENGTH, 0);
        const shadowThickness = 16; // Rectangle thickness in pixels (twice as wide)
        
        // Draw rectangle shadow spanning from front to back of net
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Slightly more opaque for visibility
        ctx.beginPath();
        // Calculate rectangle corners
        const halfThickness = shadowThickness / 2;
        ctx.moveTo(shadowFront.x - halfThickness, shadowFront.y);
        ctx.lineTo(shadowFront.x + halfThickness, shadowFront.y);
        ctx.lineTo(shadowBack.x + halfThickness, shadowBack.y);
        ctx.lineTo(shadowBack.x - halfThickness, shadowBack.y);
        ctx.closePath();
        ctx.fill();
        
        // Net spans full depth (3 cells) and divides court by X (left/right)
        // From side camera view, net appears as a vertical line on screen
        // Project net at front (y=0) and back (y=COURT_LENGTH=4)
        const netFrontTop = this.project(netX, 0, netHeight);
        const netFrontBottom = this.project(netX, 0, 0);
        const netBackTop = this.project(netX, Physics.COURT_LENGTH, netHeight);
        const netBackBottom = this.project(netX, Physics.COURT_LENGTH, 0);
        
        // Draw net posts (thicker vertical lines at front and back to show structure)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(netFrontTop.x, netFrontTop.y);
        ctx.lineTo(netFrontBottom.x, netFrontBottom.y);
        ctx.moveTo(netBackTop.x, netBackTop.y);
        ctx.lineTo(netBackBottom.x, netBackBottom.y);
        ctx.stroke();
        
        // Draw main net top line (shows the height)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(netFrontTop.x, netFrontTop.y);
        ctx.lineTo(netBackTop.x, netBackTop.y);
        ctx.stroke();
        
        // Draw net bottom line (at ground level)
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(netFrontBottom.x, netFrontBottom.y);
        ctx.lineTo(netBackBottom.x, netBackBottom.y);
        ctx.stroke();
        
        // Draw net mesh (vertical lines along depth) - these show the net structure
        ctx.strokeStyle = '#dddddd';
        ctx.lineWidth = 1.5;
        for (let i = 0; i <= 3; i++) {
            const y = i;
            const netTop = this.project(netX, y, netHeight);
            const netBottom = this.project(netX, y, 0);
            ctx.beginPath();
            ctx.moveTo(netTop.x, netTop.y);
            ctx.lineTo(netBottom.x, netBottom.y);
            ctx.stroke();
        }
        
        // Draw horizontal net lines (across depth) - these show height levels
        ctx.strokeStyle = '#bbbbbb';
        ctx.lineWidth = 1;
        const numLines = 10; // More lines to show net structure
        for (let i = 0; i <= numLines; i++) {
            const z = (netHeight / numLines) * i;
            const netFront = this.project(netX, 0, z);
            const netBack = this.project(netX, Physics.COURT_LENGTH, z);
            // Make lines slightly darker at bottom, lighter at top for depth
            const alpha = 0.3 + (i / numLines) * 0.4;
            ctx.strokeStyle = `rgba(200, 200, 200, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(netFront.x, netFront.y);
            ctx.lineTo(netBack.x, netBack.y);
            ctx.stroke();
        }
        
        // Draw a subtle highlight on the top edge to show it's a 3D structure
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(netFrontTop.x, netFrontTop.y);
        ctx.lineTo(netBackTop.x, netBackTop.y);
        ctx.stroke();
    },
    
    // Draw character shadow (separated for proper rendering order)
    drawCharacterShadow(character) {
        const ctx = this.ctx;
        const proj = this.project(character.x, character.y, character.z);
        
        // Calculate character rectangle dimensions
        const charSize = character.radius * this.courtTileSize * proj.scale;
        const minSize = 8;
        const finalSize = Math.max(charSize, minSize);
        const rectWidth = finalSize * 1.2;
        const rectHeight = finalSize * 1.5;
        
        // Draw shadow - directly below character at ground level (z=0)
        const shadowProj = this.project(character.x, character.y, 0);
        
        // Shadow size reduces as character jumps higher (z increases)
        const shadowScale = Math.max(0.2, 1.0 - character.z * 0.4);
        const baseShadowWidth = character.radius * this.courtTileSize * shadowProj.scale * 2 * 0.6; // Reduced by 40% (0.6 = 60% of original)
        const shadowWidth = baseShadowWidth * shadowScale;
        const shadowHeight = shadowWidth * 0.5;
        
        // Shadow X matches character X exactly
        const shadowX = proj.x;
        // Shadow Y at ground level, aligned with character's bottom edge
        const scaleRatio = shadowProj.scale / proj.scale;
        const shadowY = shadowProj.y + (rectHeight / 2) * scaleRatio;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        // Draw square shadow instead of ellipse
        ctx.fillRect(
            shadowX - shadowWidth * 0.5,
            shadowY - shadowHeight * 0.5,
            shadowWidth,
            shadowHeight
        );
    },
    
    // Draw character body (without shadow)
    drawCharacterBody(character, color) {
        const ctx = this.ctx;
        const proj = this.project(character.x, character.y, character.z);
        
        // Calculate character rectangle dimensions
        const charSize = character.radius * this.courtTileSize * proj.scale;
        const minSize = 8;
        const finalSize = Math.max(charSize, minSize);
        const rectWidth = finalSize * 1.2;
        const rectHeight = finalSize * 1.5;
        
        // Draw character rectangle (centered on position)
        ctx.fillStyle = color;
        ctx.fillRect(proj.x - rectWidth / 2, proj.y - rectHeight / 2, rectWidth, rectHeight);
        
        // Draw character border (thicker for visibility)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(proj.x - rectWidth / 2, proj.y - rectHeight / 2, rectWidth, rectHeight);
        
        // Draw a small indicator on top (rectangle highlight)
        ctx.fillStyle = '#fff';
        ctx.fillRect(proj.x - rectWidth * 0.2, proj.y - rectHeight * 0.4, rectWidth * 0.4, rectHeight * 0.2);
    },
    
    // Draw ball shadow (separated for proper rendering order)
    drawBallShadow() {
        const ctx = this.ctx;
        const ball = Physics.ball;
        const shadowProj = this.project(ball.x, ball.y, 0);
        
        // Shadow gets smaller when ball is higher (inverse relationship)
        const shadowSize = ball.radius * this.courtTileSize * shadowProj.scale * Math.max(0.3, 1.0 - ball.z * 0.3);
        
        // Check if ball is directly above a character (same x, y) and align shadow
        let shadowY = shadowProj.y;
        const alignmentThreshold = 0.3; // Distance threshold for "directly above"
        
        // Check player character
        const player = Physics.player;
        const distToPlayer = Math.sqrt(
            Math.pow(ball.x - player.x, 2) + Math.pow(ball.y - player.y, 2)
        );
        if (distToPlayer < alignmentThreshold) {
            // Ball is above player, use player's shadow Y position
            const playerProj = this.project(player.x, player.y, player.z);
            const playerShadowProj = this.project(player.x, player.y, 0);
            const charSize = player.radius * this.courtTileSize * playerProj.scale;
            const minSize = 8;
            const finalSize = Math.max(charSize, minSize);
            const rectHeight = finalSize * 1.5;
            const scaleRatio = playerShadowProj.scale / playerProj.scale;
            shadowY = playerShadowProj.y + (rectHeight / 2) * scaleRatio;
        } else {
            // Check AI character
            const ai = Physics.ai;
            const distToAI = Math.sqrt(
                Math.pow(ball.x - ai.x, 2) + Math.pow(ball.y - ai.y, 2)
            );
            if (distToAI < alignmentThreshold) {
                // Ball is above AI, use AI's shadow Y position
                const aiProj = this.project(ai.x, ai.y, ai.z);
                const aiShadowProj = this.project(ai.x, ai.y, 0);
                const charSize = ai.radius * this.courtTileSize * aiProj.scale;
                const minSize = 8;
                const finalSize = Math.max(charSize, minSize);
                const rectHeight = finalSize * 1.5;
                const scaleRatio = aiShadowProj.scale / aiProj.scale;
                shadowY = aiShadowProj.y + (rectHeight / 2) * scaleRatio;
            }
        }
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(shadowProj.x, shadowY, shadowSize, shadowSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    },
    
    // Draw ball body (without shadow)
    drawBallBody() {
        const ctx = this.ctx;
        const ball = Physics.ball;
        const proj = this.project(ball.x, ball.y, ball.z);
        
        const ballSize = ball.radius * this.courtTileSize * proj.scale;
        
        // Ensure minimum size for visibility
        const minBallSize = 6;
        const finalBallSize = Math.max(ballSize, minBallSize);
        
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, finalBallSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw ball border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw ball highlight
        ctx.fillStyle = '#ff6666';
        ctx.beginPath();
        ctx.arc(proj.x - finalBallSize * 0.3, proj.y - finalBallSize * 0.3, finalBallSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
    },
    
    // Main render function
    // Update highlight states based on input and character states
    updateHighlights(input, aiInput) {
        // Reset highlights
        this.playerSpikeHighlight = false;
        this.playerReceivingHighlight = false;
        this.aiSpikeHighlight = false;
        this.aiReceivingHighlight = false;
        
        // Player highlights
        if (input.isHitPressed()) {
            if (!Physics.player.onGround) {
                // Mid-air: check which zone ball is in
                const ball = Physics.ball;
                const spikeZoneZ = Physics.player.z + Physics.SPIKE_ZONE_HEAD_OFFSET;
                const dxSpike = ball.x - Physics.player.x;
                const dySpike = ball.y - Physics.player.y;
                const dzSpike = ball.z - spikeZoneZ;
                const distToSpikeZone = Math.sqrt(dxSpike * dxSpike + dySpike * dySpike + dzSpike * dzSpike);
                
                // Account for ball's radius in zone checks
                const ballRadius = Physics.ball.radius;
                const effectiveSpikeRadius = Physics.SPIKE_ZONE_RADIUS + ballRadius;
                const effectiveReceiveRadius = Physics.RECEIVING_ZONE_RADIUS + ballRadius;
                
                if (distToSpikeZone < effectiveSpikeRadius) {
                    this.playerSpikeHighlight = true;
                    this.playerReceivingHighlight = false;
                } else {
                    // Check receiving zone
                    const receiveZoneZ = Physics.player.z;
                    const dxReceive = ball.x - Physics.player.x;
                    const dyReceive = ball.y - Physics.player.y;
                    const dzReceive = ball.z - receiveZoneZ;
                    const distToReceiveZone = Math.sqrt(dxReceive * dxReceive + dyReceive * dyReceive + dzReceive * dzReceive);
                    
                    if (distToReceiveZone < effectiveReceiveRadius) {
                        this.playerSpikeHighlight = false;
                        this.playerReceivingHighlight = true;
                    } else {
                        this.playerSpikeHighlight = false;
                        this.playerReceivingHighlight = false;
                    }
                }
            } else {
                // On ground: highlight receiving zone
                this.playerSpikeHighlight = false;
                this.playerReceivingHighlight = true;
            }
        }
        
        // AI highlights
        if (aiInput.spike) {
            this.aiSpikeHighlight = true;
        }
        if (aiInput.receive) {
            this.aiReceivingHighlight = true;
        }
    },
    
    render() {
        const ctx = this.ctx;
        
        // Clear canvas
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw court
        this.drawCourt();
        
        // Draw receiving zone ground rings (always visible, on court ground)
        this.drawReceivingZoneGroundRing(Physics.player, '#4a9eff');
        this.drawReceivingZoneGroundRing(Physics.ai, '#ff4a4a');
        
        // Draw spike zone rings (only visible when character is jumping)
        if (!Physics.player.onGround) {
            this.drawSpikeZoneGroundRing(Physics.player, '#4a9eff');
        }
        if (!Physics.ai.onGround) {
            this.drawSpikeZoneGroundRing(Physics.ai, '#ff4a4a');
        }
        
        // Draw all shadows first (so they appear behind entities)
        this.drawCharacterShadow(Physics.player);
        this.drawCharacterShadow(Physics.ai);
        this.drawBallShadow();
        
        // Draw entities (depth sorted by y position - higher y = farther = drawn first)
        // Sort by y position for proper depth
        const entities = [
            { type: 'character', data: Physics.player, color: '#4a9eff', y: Physics.player.y },
            { type: 'character', data: Physics.ai, color: '#ff4a4a', y: Physics.ai.y },
            { type: 'ball', y: Physics.ball.y }
        ];
        
        // Sort by y (farther = higher y = draw first)
        entities.sort((a, b) => b.y - a.y);
        
        // Draw sorted entities (without shadows, since we drew them separately)
        entities.forEach(entity => {
            if (entity.type === 'character') {
                this.drawCharacterBody(entity.data, entity.color);
            } else if (entity.type === 'ball') {
                this.drawBallBody();
            }
        });
        
        // Draw hitboxes for debugging
        this.drawHitboxes();
    },
    
    // Draw hitboxes for debugging
    drawHitboxes() {
        const ctx = this.ctx;
        
        // Draw character hitboxes (hidden)
        // this.drawCharacterHitbox(Physics.player, '#4a9eff');
        // this.drawCharacterHitbox(Physics.ai, '#ff4a4a');
        
        // Draw ball hitbox (hidden)
        // this.drawBallHitbox();
        
        // Draw net hitbox (hidden)
        // this.drawNetHitbox();
        
        // Draw spike zones (hidden for now)
        // this.drawSpikeZone(Physics.player, '#4a9eff', this.playerSpikeHighlight);
        // this.drawSpikeZone(Physics.ai, '#ff4a4a', this.aiSpikeHighlight);
        
        // Draw receiving zones (hidden for now)
        // this.drawReceivingZone(Physics.player, '#4a9eff', this.playerReceivingHighlight);
        // this.drawReceivingZone(Physics.ai, '#ff4a4a', this.aiReceivingHighlight);
    },
    
    // Draw character hitbox (3D sphere projected to 2D)
    drawCharacterHitbox(character, color) {
        const ctx = this.ctx;
        const proj = this.project(character.x, character.y, character.z);
        
        // Draw hitbox circle at character position
        const hitboxSize = character.radius * this.courtTileSize * proj.scale;
        const minSize = 8;
        const finalSize = Math.max(hitboxSize, minSize);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dashed line
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, finalSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid
        
        // Draw hitbox at ground level too (shadow of hitbox)
        const groundProj = this.project(character.x, character.y, 0);
        const groundSize = character.radius * this.courtTileSize * groundProj.scale;
        const finalGroundSize = Math.max(groundSize, minSize);
        
        ctx.strokeStyle = color + '80'; // Semi-transparent
        ctx.beginPath();
        ctx.arc(groundProj.x, groundProj.y, finalGroundSize, 0, Math.PI * 2);
        ctx.stroke();
    },
    
    // Draw ball hitbox
    drawBallHitbox() {
        const ctx = this.ctx;
        const ball = Physics.ball;
        const proj = this.project(ball.x, ball.y, ball.z);
        
        const hitboxSize = ball.radius * this.courtTileSize * proj.scale;
        const minSize = 6;
        const finalSize = Math.max(hitboxSize, minSize);
        
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, finalSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw hitbox at ground level
        const groundProj = this.project(ball.x, ball.y, 0);
        const groundSize = ball.radius * this.courtTileSize * groundProj.scale;
        const finalGroundSize = Math.max(groundSize, minSize);
        
        ctx.strokeStyle = '#ff000080';
        ctx.beginPath();
        ctx.arc(groundProj.x, groundProj.y, finalGroundSize, 0, Math.PI * 2);
        ctx.stroke();
    },
    
    // Draw net hitbox
    drawNetHitbox() {
        const ctx = this.ctx;
        const netX = Physics.NET_X;
        const netHeight = Physics.NET_HEIGHT;
        const topThreshold = Physics.NET_TOP_THRESHOLD;
        
        // Draw net hitbox as vertical lines at front and back
        const netFrontTop = this.project(netX, 0, netHeight);
        const netFrontBottom = this.project(netX, 0, 0);
        const netBackTop = this.project(netX, Physics.COURT_LENGTH, netHeight);
        const netBackBottom = this.project(netX, Physics.COURT_LENGTH, 0);
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        // Draw front edge
        ctx.beginPath();
        ctx.moveTo(netFrontTop.x, netFrontTop.y);
        ctx.lineTo(netFrontBottom.x, netFrontBottom.y);
        ctx.stroke();
        
        // Draw back edge
        ctx.beginPath();
        ctx.moveTo(netBackTop.x, netBackTop.y);
        ctx.lineTo(netBackBottom.x, netBackBottom.y);
        ctx.stroke();
        
        // Draw top edge (the tape/rope)
        ctx.strokeStyle = '#ffff00'; // Yellow for top edge
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(netFrontTop.x, netFrontTop.y);
        ctx.lineTo(netBackTop.x, netBackTop.y);
        ctx.stroke();
        
        // Draw bottom edge
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(netFrontBottom.x, netFrontBottom.y);
        ctx.lineTo(netBackBottom.x, netBackBottom.y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Draw main collision zone (below net height, within ball radius)
        const ballRadius = Physics.ball.radius;
        const frontLeft = this.project(netX - ballRadius, 0, 0);
        const frontRight = this.project(netX + ballRadius, 0, 0);
        const backLeft = this.project(netX - ballRadius, Physics.COURT_LENGTH, 0);
        const backRight = this.project(netX + ballRadius, Physics.COURT_LENGTH, 0);
        
        ctx.strokeStyle = '#ffff0080'; // Yellow, semi-transparent
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(frontLeft.x, frontLeft.y);
        ctx.lineTo(frontRight.x, frontRight.y);
        ctx.lineTo(backRight.x, backRight.y);
        ctx.lineTo(backLeft.x, backLeft.y);
        ctx.closePath();
        ctx.stroke();
        
        // Draw top edge collision zone (at net height ± threshold)
        const topEdgeFrontTop = this.project(netX, 0, netHeight + topThreshold);
        const topEdgeFrontBottom = this.project(netX, 0, netHeight - topThreshold);
        const topEdgeBackTop = this.project(netX, Physics.COURT_LENGTH, netHeight + topThreshold);
        const topEdgeBackBottom = this.project(netX, Physics.COURT_LENGTH, netHeight - topThreshold);
        
        ctx.strokeStyle = '#ff8800'; // Orange for top edge collision zone
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        
        // Draw top edge collision zone boundaries
        ctx.beginPath();
        ctx.moveTo(topEdgeFrontTop.x, topEdgeFrontTop.y);
        ctx.lineTo(topEdgeBackTop.x, topEdgeBackTop.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(topEdgeFrontBottom.x, topEdgeFrontBottom.y);
        ctx.lineTo(topEdgeBackBottom.x, topEdgeBackBottom.y);
        ctx.stroke();
        
        ctx.setLineDash([]);
    },
    
    // Draw spike zone (3D sphere above character's head)
    drawSpikeZone(character, color, highlight = false) {
        const ctx = this.ctx;
        const spikeZoneZ = character.z + Physics.SPIKE_ZONE_HEAD_OFFSET;
        const spikeZoneRadius = Physics.SPIKE_ZONE_RADIUS;
        
        // Project spike zone center (above character's head)
        const centerProj = this.project(character.x, character.y, spikeZoneZ);
        
        // Single circle at spike zone center
        const topSize = spikeZoneRadius * this.courtTileSize * centerProj.scale;
        const minSize = 6;
        const finalTopSize = Math.max(topSize, minSize);
        
        // Fill with transparent color if highlighted
        if (highlight) {
            ctx.fillStyle = color + '30'; // 30% opacity
            ctx.beginPath();
            ctx.arc(centerProj.x, centerProj.y, finalTopSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]); // Dotted line for spike zone
        ctx.beginPath();
        ctx.arc(centerProj.x, centerProj.y, finalTopSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid
    },
    
    // Draw receiving zone (3D sphere at character's center mass)
    drawReceivingZone(character, color, highlight = false) {
        const ctx = this.ctx;
        const receiveZoneZ = character.z; // At character's center mass (ground level)
        const receiveZoneRadius = Physics.RECEIVING_ZONE_RADIUS;
        const minSize = 6;
        
        // Single circle at center (ground level) - properly scaled with perspective
        const centerProj = this.project(character.x, character.y, receiveZoneZ);
        const mainSize = receiveZoneRadius * this.courtTileSize * centerProj.scale;
        const finalMainSize = Math.max(mainSize, minSize);
        
        // Fill with transparent color if highlighted
        if (highlight) {
            ctx.fillStyle = color + '30'; // 30% opacity
            ctx.beginPath();
            ctx.arc(centerProj.x, centerProj.y, finalMainSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]); // Different dash pattern for receiving zone
        ctx.beginPath();
        ctx.arc(centerProj.x, centerProj.y, finalMainSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid
    },
    
    // Draw receiving zone ground ring (always visible, shows area on court ground)
    drawReceivingZoneGroundRing(character, color) {
        const ctx = this.ctx;
        const receiveZoneRadius = Physics.RECEIVING_ZONE_RADIUS;
        
        // Project character position at ground level (z=0)
        const groundProj = this.project(character.x, character.y, 0);
        
        // Calculate ring size with perspective scaling
        const ringSize = receiveZoneRadius * this.courtTileSize * groundProj.scale;
        const minSize = 6;
        const finalRingSize = Math.max(ringSize, minSize);
        
        // Draw ring on ground (always visible, more prominent)
        ctx.strokeStyle = color + 'AA'; // 67% opacity (AA in hex = 170/255) for more prominent visibility
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]); // Slightly larger dashes
        ctx.beginPath();
        ctx.arc(groundProj.x, groundProj.y, finalRingSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid
    },
    
    // Draw spike zone ring (only visible when character is jumping, shows area above character's head)
    drawSpikeZoneGroundRing(character, color) {
        const ctx = this.ctx;
        const spikeZoneRadius = Physics.SPIKE_ZONE_RADIUS;
        const spikeZoneZ = character.z + Physics.SPIKE_ZONE_HEAD_OFFSET;
        
        // Project spike zone position (above character's head)
        const spikeZoneProj = this.project(character.x, character.y, spikeZoneZ);
        
        // Calculate ring size with perspective scaling
        const ringSize = spikeZoneRadius * this.courtTileSize * spikeZoneProj.scale;
        const minSize = 6;
        const finalRingSize = Math.max(ringSize, minSize);
        
        // Draw ring at spike zone position (more prominent)
        ctx.strokeStyle = color + 'AA'; // 67% opacity (AA in hex = 170/255) for more prominent visibility
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]); // Slightly larger dashes
        ctx.beginPath();
        ctx.arc(spikeZoneProj.x, spikeZoneProj.y, finalRingSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid
    }
};

