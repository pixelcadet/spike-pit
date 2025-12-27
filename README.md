# Spike Pit

A fake-3D / 2.5D arcade volleyball game built with HTML5 Canvas and vanilla JavaScript for itch.io.

## About

Spike Pit is a fast-paced, arcade-style volleyball game with exaggerated physics and a forced-perspective camera. The game looks 3D but is technically fully 2D, creating a unique visual style where characters closer to the bottom of the screen appear larger, and those farther away appear smaller.

**Tone:** Short, punchy, slightly chaotic. More fun than realistic.

## How to Run

Simply open `index.html` in a web browser. No build step required.

## Controls

- **A / D** → Move horizontally (left ↔ right)
- **W / S** → Move on court depth (forward ↔ backward)
- **J** → Jump
- **I** → Hit / Spike / Serve / Receive

## Gameplay

- **1 player vs AI** volleyball match
- **First to 5 or 7 points** wins
- Player character starts on the **left side** of the court
- AI character is on the **right side**
- Auto-serve after each point (press **I** to serve)
- Press any key to restart after match ends

## Technical Details

- Built with vanilla JavaScript (no frameworks)
- HTML5 Canvas 2D rendering
- Forced perspective projection system
- Continuous movement (not grid-based)
- Compatible with itch.io HTML uploads

## Status

MVP in development. See `docs/CONTEXT.md` for full project specifications and development guidelines.

