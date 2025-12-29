// Controls system - handles physics parameter adjustments via UI sliders

const Controls = {
    // Value ranges mapping 1-10 scale to physics values
    // Recalibrated so comfortable values are now the default (5)
    // Movement speed: 0.025 to 0.075 (5 = 0.05, stays the same)
    // Jump power: 0.148 to 0.248 (5 = 0.198, which was old slider 6)
    // Gravity: 0.0037 to 0.0117 (5 = 0.0077, which was old slider 4)
    // Air Time: maps old 3-10 range, with 5 = old slider 7 (0.296 multiplier)
    
    init() {
        // Set up toggle for collapsing/expanding controls
        const controlsMenu = document.getElementById('controls-menu');
        const controlsToggle = document.getElementById('controls-toggle');
        
        controlsToggle.addEventListener('click', () => {
            controlsMenu.classList.toggle('collapsed');
        });
        
        // Set up movement speed slider
        const movementSpeedSlider = document.getElementById('movement-speed');
        const movementSpeedValue = document.getElementById('movement-speed-value');
        
        movementSpeedSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            movementSpeedValue.textContent = value;
            this.updateMovementSpeed(value);
        });
        
        // Set up jump power slider
        const jumpPowerSlider = document.getElementById('jump-power');
        const jumpPowerValue = document.getElementById('jump-power-value');
        
        jumpPowerSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            jumpPowerValue.textContent = value;
            this.updateJumpPower(value);
        });
        
        // Set up gravity slider
        const gravitySlider = document.getElementById('gravity');
        const gravityValue = document.getElementById('gravity-value');
        
        gravitySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            gravityValue.textContent = value;
            this.updateGravity(value);
        });
        
        // Set up air time slider
        const airTimeSlider = document.getElementById('air-time');
        const airTimeValue = document.getElementById('air-time-value');
        
        airTimeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            airTimeValue.textContent = value;
            this.updateAirTime(value);
        });
        
        // Set up ball movement speed slider
        const ballSpeedSlider = document.getElementById('ball-speed');
        const ballSpeedValue = document.getElementById('ball-speed-value');
        
        ballSpeedSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            ballSpeedValue.textContent = value;
            this.updateBallMovementSpeed(value);
        });
        
        // Set up receive zone size slider
        const receiveZoneSlider = document.getElementById('receive-zone');
        const receiveZoneValue = document.getElementById('receive-zone-value');
        // Sync displayed value to HTML default
        if (receiveZoneSlider && receiveZoneValue) {
            receiveZoneValue.textContent = receiveZoneSlider.value;
        }
        
        receiveZoneSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            receiveZoneValue.textContent = value;
            this.updateReceiveZoneSize(value);
        });
        
        // Set up spike zone size slider
        const spikeZoneSlider = document.getElementById('spike-zone');
        const spikeZoneValue = document.getElementById('spike-zone-value');
        // Sync displayed value to HTML default
        if (spikeZoneSlider && spikeZoneValue) {
            spikeZoneValue.textContent = spikeZoneSlider.value;
        }
        
        spikeZoneSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            spikeZoneValue.textContent = value;
            this.updateSpikeZoneSize(value);
        });
        
        // Set up serve horizontal power slider
        const serveHorizontalSlider = document.getElementById('serve-horizontal');
        const serveHorizontalValue = document.getElementById('serve-horizontal-value');
        
        serveHorizontalSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            serveHorizontalValue.textContent = value;
            this.updateServeHorizontal(value);
        });
        
        // Set up serve vertical power slider
        const serveVerticalSlider = document.getElementById('serve-vertical');
        const serveVerticalValue = document.getElementById('serve-vertical-value');
        
        serveVerticalSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            serveVerticalValue.textContent = value;
            this.updateServeVertical(value);
        });
        
        // Set up AI active toggle
        const aiActiveToggle = document.getElementById('ai-active');
        
        aiActiveToggle.addEventListener('change', (e) => {
            AI.isActive = e.target.checked;
        });

        // Set up free play toggle (no match end)
        const freePlayToggle = document.getElementById('free-play');
        if (freePlayToggle) {
            freePlayToggle.addEventListener('change', (e) => {
                Game.setFreePlay?.(e.target.checked);
            });
        }

        // Show/hide zone rings (receive/spike)
        const showZonesToggle = document.getElementById('show-zones');
        if (showZonesToggle) {
            showZonesToggle.addEventListener('change', (e) => {
                if (typeof Render !== 'undefined') {
                    Render.showZones = e.target.checked;
                }
            });
        }

        // Show/hide debug hitboxes/footprints/zones overlay (heavier draw)
        const showHitboxesToggle = document.getElementById('show-hitboxes');
        if (showHitboxesToggle) {
            showHitboxesToggle.addEventListener('change', (e) => {
                if (typeof Render !== 'undefined') {
                    Render.showHitboxes = e.target.checked;
                }
            });
        }
        
        // Initialize with default values
        this.updateMovementSpeed(5);
        this.updateJumpPower(5);
        this.updateGravity(5);
        this.updateAirTime(5);
        // Ball speed default: 5 (recalibrated so 5 is slower than before)
        this.updateBallMovementSpeed(5);
        // Defaults (on refresh): receive zone = 3, spike zone = 2
        this.updateReceiveZoneSize(3);
        this.updateSpikeZoneSize(2);
        this.updateServeHorizontal(5);
        this.updateServeVertical(5);
        // AI active is already checked by default in HTML
        AI.isActive = aiActiveToggle.checked;
        if (freePlayToggle) {
            // Default off
            freePlayToggle.checked = false;
            Game.setFreePlay?.(freePlayToggle.checked);
        }

        // Defaults for debug overlays (Render is loaded before controls.js in index.html)
        if (showZonesToggle && typeof Render !== 'undefined') {
            Render.showZones = showZonesToggle.checked;
        }
        if (showHitboxesToggle && typeof Render !== 'undefined') {
            Render.showHitboxes = showHitboxesToggle.checked;
        }
    },
    
    // Convert 1-10 scale to movement speed (0.025 to 0.075, with 5 = 0.05)
    updateMovementSpeed(scale) {
        // Linear interpolation: min + (max - min) * ((scale - 1) / 9)
        // Adjusted so slider 5 = 0.05 (was old slider 1)
        const minSpeed = 0.025;
        const maxSpeed = 0.075;
        const speed = minSpeed + (maxSpeed - minSpeed) * ((scale - 1) / 9);
        
        // Apply to both player and AI
        Physics.player.speed = speed;
        AI.reactionSpeed = speed;
    },
    
    // Convert 1-10 scale to jump power (0.148 to 0.248, with 5 = 0.198)
    updateJumpPower(scale) {
        // Linear interpolation: min + (max - min) * ((scale - 1) / 9)
        // Adjusted so slider 5 = 0.198 (which was old slider 6)
        const minPower = 0.148;
        const maxPower = 0.248;
        const power = minPower + (maxPower - minPower) * ((scale - 1) / 9);
        
        // Apply to both player and AI
        Physics.player.jumpPower = power;
        Physics.ai.jumpPower = power;
    },
    
    // Convert 1-10 scale to gravity (0.0037 to 0.0117, with 5 = 0.0077)
    updateGravity(scale) {
        // Linear interpolation: min + (max - min) * ((scale - 1) / 9)
        // Adjusted so slider 5 = 0.0077 (which was old slider 4)
        const minGravity = 0.0037;
        const maxGravity = 0.0117;
        const gravity = minGravity + (maxGravity - minGravity) * ((scale - 1) / 9);
        
        // Apply to physics system
        Physics.GRAVITY = gravity;
    },
    
    // Convert 1-10 scale to peak hang multiplier (maps old 3-10 range to new 1-10 range)
    // Old slider 3 → new slider 1, old slider 7 → new slider 5, old slider 10 → new slider 10
    // Lower value = less gravity at peak = more hang time (without increasing jump height)
    updateAirTime(scale) {
        // Map new scale (1-10) to old scale (3-10) with specific points:
        // new slider 1 → old slider 3, new slider 5 → old slider 7, new slider 10 → old slider 10
        // Using piecewise linear mapping to ensure these exact points
        let oldScale;
        if (scale <= 5) {
            // Map 1-5 to old 3-7
            oldScale = 3 + (7 - 3) * ((scale - 1) / (5 - 1));
        } else {
            // Map 5-10 to old 7-10
            oldScale = 7 + (10 - 7) * ((scale - 5) / (10 - 5));
        }
        
        // Calculate multiplier using old scale formula
        // Old formula: multiplier = 1.0 - (1.0 - 0.05) * ((oldScale - 1) / 9)
        const minMultiplier = 0.05; // Minimum cap to prevent indefinite floating
        const maxMultiplier = 1.0;
        const multiplier = maxMultiplier - (maxMultiplier - minMultiplier) * ((oldScale - 1) / 9);
        
        // Apply to physics system
        Physics.peakHangMultiplier = multiplier;
    },
    
    // Convert 1-10 scale to ball movement speed multiplier.
    // Recalibrated so:
    // - new slider 5 == old slider 2 (slower default)
    // - new slider 1 is much slower than before
    // - new slider 10 is not too fast
    updateBallMovementSpeed(scale) {
        // Linear interpolation: min + (max - min) * ((scale - 1) / 9)
        // Calibrated values:
        // - Slider 1  = 0.10 (much slower than old min 0.20)
        // - Slider 5  = ~0.244 (matches old slider 2 on the previous 0.2..0.6 mapping)
        // - Slider 10 = ~0.425 (faster but not too fast)
        const minSpeed = 0.10;
        const maxSpeed = 0.425;
        const speed = minSpeed + (maxSpeed - minSpeed) * ((scale - 1) / 9);
        
        // Apply to physics system
        Physics.ballMovementSpeed = speed;
    },
    
    // Convert 1-10 scale to receiving zone radius (0.6 to 1.8, with 5 = 1.2)
    // Current default is 1.2, so slider 5 = 1.2
    updateReceiveZoneSize(scale) {
        // Linear interpolation: min + (max - min) * ((scale - 1) / 9)
        // Slider 1 = 0.6 (small zone)
        // Slider 5 = 1.2 (current default)
        // Slider 10 = 1.8 (large zone)
        const minRadius = 0.6;
        const maxRadius = 1.8;
        const radius = minRadius + (maxRadius - minRadius) * ((scale - 1) / 9);
        
        // Apply to physics system
        Physics.RECEIVING_ZONE_RADIUS = radius;
    },
    
    // Convert 1-10 scale to spike zone radius (0.42 to 1.26, with 5 = 0.96)
    // Recalibrated: slider 5 = 0.96 (new standard/default)
    updateSpikeZoneSize(scale) {
        // Map scale 1-10 to radius range, with scale 5 = 0.96
        // We want: scale 1 = 0.42, scale 5 = 0.96, scale 10 = 1.26
        // Using piecewise linear mapping to ensure scale 5 = 0.96
        let radius;
        if (scale <= 5) {
            // Map 1-5 to 0.42-0.96
            radius = 0.42 + (0.96 - 0.42) * ((scale - 1) / (5 - 1));
        } else {
            // Map 5-10 to 0.96-1.26
            radius = 0.96 + (1.26 - 0.96) * ((scale - 5) / (10 - 5));
        }
        
        // Apply to physics system
        Physics.SPIKE_ZONE_RADIUS = radius;
    },
    
    // Convert 1-10 scale to serve horizontal multiplier (0.14 to 0.28)
    // Controls horizontal distance of serve
    updateServeHorizontal(scale) {
        // Linear interpolation: min + (max - min) * ((scale - 1) / 9)
        // Slider 1 = 0.14 (minimum)
        // Slider 5 = 0.2022 (default)
        // Slider 10 = 0.28 (maximum)
        const minPower = 0.14;
        const maxPower = 0.28;
        const power = minPower + (maxPower - minPower) * ((scale - 1) / 9);
        
        // Apply to game system
        Game.serveHorizontalMultiplier = power;
    },
    
    // Convert 1-10 scale to serve vertical multiplier (0.14 to 0.3)
    // Controls arc height (peak height) of serve
    updateServeVertical(scale) {
        // Linear interpolation: min + (max - min) * ((scale - 1) / 9)
        // Slider 1 = 0.14 (minimum)
        // Slider 5 = 0.2111 (default)
        // Slider 10 = 0.3 (maximum)
        const minPower = 0.14;
        const maxPower = 0.3;
        const power = minPower + (maxPower - minPower) * ((scale - 1) / 9);
        
        // Apply to game system
        Game.serveVerticalMultiplier = power;
    }
};

