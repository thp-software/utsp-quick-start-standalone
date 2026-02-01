/**
 * SpaceDemo
 * 
 * This demo serves as an educational base for new UTSP developers.
 * It demonstrates core concepts:
 * 1. Palette Management: Custom colors for your game.
 * 2. Sprites: Defining and using unicolor sprites.
 * 3. Layers & Z-Index: Organizing rendering into logical planes.
 * 4. Input System: Binding keys and gamepad axes to logical actions.
 * 5. Optimized Rendering: Using DotCloud for many similar particles.
 * 6. Game Loop: Separating input, logic, and rendering.
 */

import { Core, User, Layer, Display, Vector2, OrderBuilder } from "@utsp/core";
import { InputDeviceType, KeyboardInput, GamepadInput, type IRuntime, type IApplication } from "@utsp/types";

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

interface Star {
    x: number;
    y: number;
    color: number;
}

interface Asteroid {
    x: number;
    y: number;
    char: string;
}

/**
 * Custom data stored per user. 
 * This is where you keep your game state like positions, scores, and active layers.
 */
interface SpaceUserData {
    starLayerFar: Layer;
    starLayerNear: Layer;
    gameLayer: Layer;
    uiLayer: Layer;
    starsFar: Star[];
    starsNear: Star[];
    asteroids: Asteroid[];
    shipX: number;
    shipY: number;
    score: number;
    lives: number;              // Current life count (usually starts at 3)
    invincibilityFrames: number; // Ticks remaining for hit recovery period
    gameOver: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

// --- Screen Dimensions ---
const WIDTH = 60;
const HEIGHT = 20;

// --- Special Color Values ---
/** Use TRANSPARENT as background color to let lower layers show through */
const TRANSPARENT = 255;

// --- Palette Color IDs ---
// These IDs reference colors defined in the palette (see init())
const COLOR_DEEP_SPACE = 0;
const COLOR_DIM_STAR = 1;
const COLOR_MEDIUM_STAR = 2;
const COLOR_BRIGHT_STAR = 3;
const COLOR_SHIP = 4;
const COLOR_ASTEROID = 6;
const COLOR_WHITE = 7;
const COLOR_GOLD = 8;
const COLOR_GAMEOVER = 9;   // Bright red for losing/damage
const COLOR_LOST_HEART = 10; // Muted gray for depleted lives

// --- Difficulty Progression ---
const ASTEROIDS_START = 2;       // Initial asteroid count
const ASTEROIDS_MAX = 10;        // Maximum asteroid count
const ASTEROIDS_PER_SCORE = 3;   // Add 1 asteroid every N points
const DIFFICULTY_FULL_AT = 20;   // Score at which center spawns are fully unlocked

// --- Frequency & Movement (aligned for 30Hz grid) ---
const TICK_RATE = 30;
const SPEED_SHIP = 1.0;
const SPEED_ASTEROID = 1.0;
const SPEED_STARS_FAR = 0.5;
const SPEED_STARS_NEAR = 1.5;

/**
 * A 3x3 unicolor sprite definition for our spaceship.
 * String formatting makes it easy to visualize!
 */
const SHIP_SPRITE = `
 / 
>=>
 \\ `;

// ════════════════════════════════════════════════════════════════════════════
// APPLICATION
// ════════════════════════════════════════════════════════════════════════════

export class SpaceDemo implements IApplication<Core, User<SpaceUserData>> {

    /**
     * Step 1: Global Initialization
     * Called once when the application starts. Use this for assets that 
     * are shared across all users (palettes, sprites).
     */
    init(runtime: IRuntime, core: Core): void {
        // Define our game's color palette
        // Each color has an ID (0-255) and RGBA values
        const palette = [
            { colorId: 0, r: 5, g: 5, b: 15, a: 255 },      // Deep space background
            { colorId: 1, r: 40, g: 40, b: 60, a: 255 },    // Dim stars (far layer)
            { colorId: 2, r: 80, g: 80, b: 120, a: 255 },   // Medium stars
            { colorId: 3, r: 150, g: 150, b: 200, a: 255 }, // Bright stars (near layer)
            { colorId: 4, r: 100, g: 200, b: 255, a: 255 }, // Ship cyan
            { colorId: 5, r: 255, g: 150, b: 50, a: 255 },  // Ship orange (unused)
            { colorId: 6, r: 140, g: 140, b: 140, a: 255 }, // Asteroid gray
            { colorId: 7, r: 255, g: 255, b: 255, a: 255 }, // White text
            { colorId: 8, r: 255, g: 220, b: 100, a: 255 }, // Score gold
            { colorId: 9, r: 255, g: 80, b: 80, a: 255 },   // Game over red
            { colorId: 10, r: 100, g: 100, b: 100, a: 255 }, // Lost heart gray
        ];
        // Load palette into slot 0 (displays can switch between palette slots)
        core.loadPaletteToSlot(0, palette);

        // Load ship sprite using the new string-based API
        // spriteId: unique ID to reference this sprite later
        // sizeX/sizeY: dimensions in characters
        // data: the visual representation as a string
        core.loadUnicolorSprites([
            { spriteId: 0, sizeX: 3, sizeY: 3, data: SHIP_SPRITE },
        ]);

        // Set game simulation speed
        runtime.setTickRate(TICK_RATE);
    }

    /**
     * Step 2: Per-User Initialization 
     * Called when a new player connects. Here we set up their unique state,
     * layers and display.
     */
    initUser(runtime: IRuntime, core: Core, user: User<SpaceUserData>, metadata?: any): void {
        // Create 4 layers with different z-indices (higher = rendered on top)
        // Layer parameters: position, z-index, width, height, transparency
        const starLayerFar = new Layer(
            new Vector2(0, 0),  // Position offset (usually 0,0)
            0,                   // Z-index: 0 = furthest back
            WIDTH, HEIGHT,       // Layer dimensions
            { mustBeReliable: false, name: "starLayerFar" } // Must be reliable for transport (server -> client)
        );
        const starLayerNear = new Layer(new Vector2(0, 0), 1, WIDTH, HEIGHT, { mustBeReliable: false, name: "starLayerNear" });
        const gameLayer = new Layer(new Vector2(0, 0), 2, WIDTH, HEIGHT, { mustBeReliable: true, name: "gameLayer" });
        const uiLayer = new Layer(new Vector2(0, 0), 3, WIDTH, HEIGHT, { mustBeReliable: true, name: "uiLayer" }); // 3 = topmost

        // Register layers with the user
        user.addLayer(starLayerFar);
        user.addLayer(starLayerNear);
        user.addLayer(gameLayer);
        user.addLayer(uiLayer);

        // A Display maps layers to the user's screen
        // Parameters: display ID, width, height
        const display = new Display(0, WIDTH, HEIGHT);
        display.setOrigin(new Vector2(0, 0)); // Camera position
        user.addDisplay(display);
        display.switchPalette(0); // Use palette slot 0

        // Optional: Add a subtle retro scanline effect
        display.setPostProcess({ scanlines: { enabled: true, opacity: 0.15, pattern: "horizontal" } });

        // Initialize game state
        user.data = {
            starLayerFar,
            starLayerNear,
            gameLayer,
            uiLayer,
            starsFar: this.generateStars(40, [COLOR_DIM_STAR, COLOR_MEDIUM_STAR]),
            starsNear: this.generateStars(25, [COLOR_MEDIUM_STAR, COLOR_BRIGHT_STAR]),
            asteroids: Array.from({ length: ASTEROIDS_START }, () => this.createAsteroid(0)),
            shipX: 10,
            shipY: HEIGHT / 2,
            score: 0,
            lives: 3,               // Start with 3 hearts
            invincibilityFrames: 0, // No invincibility at start
            gameOver: false,
        };

        this.setupInputBindings(user);
    }

    /**
     * Main simulation logic. Not used in this simple demo.
     */
    update(runtime: IRuntime, core: Core, deltaTime: number): void { }

    /**
     * Step 3: User-specific game loop
     * Called every tick (60 times/second). Here we:
     * 1. Read input
     * 2. Update game logic
     * 3. Check collisions
     * 4. Render to layers
     */
    updateUser(runtime: IRuntime, core: Core, user: User<SpaceUserData>, deltaTime: number): void {
        const state = user.data;
        if (!state) return;

        // Handle game over state
        if (state.gameOver) {
            // --- BANDWIDTH OPTIMIZATION ---
            // If the game is over, the screen state is static (no movement, no logic changes).
            // In UTSP, 'layer.commit()' sends the entire layer's orders to the client.
            // By returning early here, we skip the call to 'renderAll()' and its 'commit()' calls.
            // The client will simply keep displaying the last received frame (the Game Over screen).
            // This prevents sending redundant network packets 30 times per second.

            if (user.getButtonJustPressed("Restart")) {
                this.resetGame(state);
                // We don't return here so we can immediately process and render the first frame of the new game.
            } else {
                return;
            }
        }

        // TOCK: Update recovery timer. Decrementing every frame (30 times/sec).
        if (state.invincibilityFrames > 0) {
            state.invincibilityFrames--;
        }

        // 1. INPUT: Read axis values (-1 to +1) and apply to ship position
        const moveX = user.getAxis("MoveX");
        const moveY = user.getAxis("MoveY");
        state.shipX = Math.max(1, Math.min(15, state.shipX + moveX * SPEED_SHIP));
        state.shipY = Math.max(2, Math.min(HEIGHT - 3, state.shipY + moveY * SPEED_SHIP));

        // 2. PARALLAX: Scroll star layers at different speeds for depth effect
        this.scrollStars(state.starsFar, SPEED_STARS_FAR);   // Slow = far away
        this.scrollStars(state.starsNear, SPEED_STARS_NEAR);  // Fast = close

        // 3. COLLISION: Check ship vs asteroids
        // We floor coordinates because terminal rendering is grid-based
        const shipGridX = Math.floor(state.shipX);
        const shipGridY = Math.floor(state.shipY);

        for (const asteroid of state.asteroids) {
            asteroid.x -= SPEED_ASTEROID; // Move asteroid left
            const asteroidGridX = Math.floor(asteroid.x);
            const asteroidGridY = Math.floor(asteroid.y);

            // Simple collision check: ship body (3 wide) and wings (center column)
            const hitBody = (asteroidGridY === shipGridY && asteroidGridX >= shipGridX && asteroidGridX <= shipGridX + 2);
            const hitWings = ((asteroidGridY === shipGridY - 1 || asteroidGridY === shipGridY + 1) && asteroidGridX === shipGridX + 1);

            if (hitBody || hitWings) {
                // Only take damage if not currently in recovery (invincible)
                if (state.invincibilityFrames <= 0) {
                    state.lives--;

                    if (state.lives <= 0) {
                        state.gameOver = true;
                    } else {
                        // Activate brief recovery period (1 second) to prevent instant multiple hits
                        state.invincibilityFrames = TICK_RATE;

                        // Recycle the asteroid that hit us immediately
                        Object.assign(asteroid, this.createAsteroid(state.score));
                        continue;
                    }
                }
            }

            // Recycle asteroid when it leaves the screen
            if (asteroid.x < -2) {
                Object.assign(asteroid, this.createAsteroid(state.score));
                state.score++;

                // Progressive difficulty: add more asteroids as score increases
                const targetCount = Math.min(
                    ASTEROIDS_MAX,
                    ASTEROIDS_START + Math.floor(state.score / ASTEROIDS_PER_SCORE)
                );
                if (state.asteroids.length < targetCount) {
                    state.asteroids.push(this.createAsteroid(state.score));
                }
            }
        }

        // 4. RENDER: Draw everything to the layers
        this.renderAll(state);
    }

    /**
     * Input Binding: Maps physical keys/buttons to logical action names.
     * This abstraction allows supporting multiple input devices seamlessly.
     */
    private setupInputBindings(user: User<SpaceUserData>): void {
        const registry = user.getInputBindingRegistry();

        // Horizontal axis: combine multiple input sources
        registry.defineAxis(0, "MoveX", [
            { sourceId: 1, type: InputDeviceType.Keyboard, negativeKey: KeyboardInput.ArrowLeft, positiveKey: KeyboardInput.ArrowRight },
            { sourceId: 2, type: InputDeviceType.Keyboard, negativeKey: KeyboardInput.KeyA, positiveKey: KeyboardInput.KeyD },
            { sourceId: 3, type: InputDeviceType.Gamepad, gamepadIndex: 0, axis: GamepadInput.LeftStickX, deadzone: 0.2 },
        ]);

        // Vertical axis
        registry.defineAxis(1, "MoveY", [
            { sourceId: 4, type: InputDeviceType.Keyboard, negativeKey: KeyboardInput.ArrowUp, positiveKey: KeyboardInput.ArrowDown },
            { sourceId: 5, type: InputDeviceType.Keyboard, negativeKey: KeyboardInput.KeyW, positiveKey: KeyboardInput.KeyS },
            { sourceId: 6, type: InputDeviceType.Gamepad, gamepadIndex: 0, axis: GamepadInput.LeftStickY, deadzone: 0.2 },
        ]);

        // Restart button
        registry.defineButton(0, "Restart", [
            { sourceId: 10, type: InputDeviceType.Keyboard, key: KeyboardInput.Space },
            { sourceId: 11, type: InputDeviceType.Keyboard, key: KeyboardInput.Enter },
            { sourceId: 12, type: InputDeviceType.Gamepad, gamepadIndex: 0, button: GamepadInput.Start },
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // HELPERS & RENDERING
    // ──────────────────────────────────────────────────────────────────────────

    private resetGame(state: SpaceUserData): void {
        state.shipX = 10;
        state.shipY = HEIGHT / 2;
        state.score = 0;
        state.lives = 3;
        state.invincibilityFrames = 0;
        state.gameOver = false;
        // Reset to initial asteroid count
        state.asteroids.length = ASTEROIDS_START;
        state.asteroids.forEach(a => Object.assign(a, this.createAsteroid(0)));
    }

    /** Generate random star field with specified colors */
    private generateStars(count: number, colors: number[]): Star[] {
        return Array.from({ length: count }, () => ({
            x: Math.random() * WIDTH,
            y: Math.random() * HEIGHT,
            color: colors[Math.floor(Math.random() * colors.length)],
        }));
    }

    /**
     * Creates a new asteroid.
     * 
     * At low scores, asteroids spawn near screen edges (easier to dodge).
     * As score increases, they progressively appear across the full height.
     */
    private createAsteroid(score: number): Asteroid {
        const chars = ["o", "O", "0"];
        const char = chars[Math.floor(Math.random() * chars.length)];

        // How much of the center is "unlocked" (0 = edges only, 1 = full height)
        const centerBias = Math.min(1, score / DIFFICULTY_FULL_AT);

        // Playable Y range (leave margin for UI)
        const minY = 2;
        const maxY = HEIGHT - 3;
        const halfRange = (maxY - minY) / 2;

        // Decide Y position based on difficulty progression
        let y: number;
        if (centerBias < 1 && Math.random() > centerBias) {
            // Early game: spawn on edges only (top or bottom 40%)
            const edgeRange = halfRange * 0.4;
            y = Math.random() < 0.5
                ? minY + Math.random() * edgeRange
                : maxY - Math.random() * edgeRange;
        } else {
            // Late game: full range available
            y = minY + Math.random() * (maxY - minY);
        }

        return {
            x: WIDTH + Math.random() * 30, // Spawn off-screen right
            y,
            char,
        };
    }

    /** Scroll stars leftward and wrap when off-screen */
    private scrollStars(stars: Star[], speed: number): void {
        for (const star of stars) {
            star.x -= speed;
            if (star.x < 0) {
                star.x = WIDTH;
                star.y = Math.random() * HEIGHT;
            }
        }
    }

    /** Master render function - draws all layers */
    private renderAll(state: SpaceUserData): void {
        this.renderStars(state.starLayerFar, state.starsFar);
        this.renderStars(state.starLayerNear, state.starsNear);
        this.renderGame(state);
        this.renderUI(state);
    }

    /** Render a star field using optimized dotCloudMultiColor */
    private renderStars(layer: Layer, stars: Star[]): void {
        const dots = stars.map(star => ({
            posX: Math.floor(star.x),
            posY: Math.floor(star.y),
            charCode: ".",
            fgColorCode: star.color,
            bgColorCode: TRANSPARENT,
        }));

        layer.setOrders([OrderBuilder.dotCloudMultiColor(dots)]);
        layer.commit(); // Send changes to renderer
    }

    /** Render game objects: asteroids and ship */
    private renderGame(state: SpaceUserData): void {
        const orders: any[] = [];

        // Asteroids as varied characters (o, O, 0)
        const asteroidDots = state.asteroids.map(a => ({
            posX: Math.floor(a.x),
            posY: Math.floor(a.y),
            charCode: a.char,
            fgColorCode: COLOR_ASTEROID,
            bgColorCode: TRANSPARENT,
        }));
        orders.push(OrderBuilder.dotCloudMultiColor(asteroidDots));

        // --- Ship Sprite ---
        const shipX = Math.floor(state.shipX);
        const shipY = Math.floor(state.shipY) - 1;

        // Define ship color based on health status
        let shipColor = COLOR_SHIP;
        if (state.gameOver) {
            shipColor = COLOR_GAMEOVER; // Dead ship turns bright red
        } else if (state.invincibilityFrames > 0) {
            // ALARM EFFECT: Alternate between blue and red every 5 frames 
            // when in recovery period. This is an 'alarm' flash.
            const isRedPhase = Math.floor(state.invincibilityFrames / 5) % 2 === 0;
            shipColor = isRedPhase ? COLOR_GAMEOVER : COLOR_SHIP;
        }

        orders.push(OrderBuilder.sprite(shipX, shipY, 0, shipColor, TRANSPARENT));

        state.gameLayer.setOrders(orders);
        state.gameLayer.commit(); // Send changes to renderer
    }

    /** Render UI: title, lives, score, and game over text */
    private renderUI(state: SpaceUserData): void {
        const orders: any[] = [
            // text(x, y, string, foregroundColor, backgroundColor)
            OrderBuilder.text(1, 0, "SPACE DEMO", COLOR_WHITE, COLOR_DEEP_SPACE),
            // Hearts Display: Current health status.
            // We draw active lives (red) followed by depleted lives (dimmed gray).
            OrderBuilder.text(1, 1, "♥".repeat(state.lives), COLOR_GAMEOVER, TRANSPARENT),
            OrderBuilder.text(1 + state.lives, 1, "♥".repeat(3 - state.lives), COLOR_LOST_HEART, TRANSPARENT),
            OrderBuilder.text(WIDTH - 11, 0, `Score: ${state.score}`, COLOR_GOLD, COLOR_DEEP_SPACE),
        ];

        if (state.gameOver) {
            orders.push(OrderBuilder.text(22, 8, "GAME OVER!", COLOR_GAMEOVER, COLOR_DEEP_SPACE));
            orders.push(OrderBuilder.text(17, 10, "Press SPACE to restart", COLOR_WHITE, COLOR_DEEP_SPACE));
        } else {
            orders.push(OrderBuilder.text(1, HEIGHT - 1, "Avoid asteroids! [WASD] or Stick", COLOR_DIM_STAR, TRANSPARENT));
        }

        state.uiLayer.setOrders(orders);
        state.uiLayer.commit();
    }
}
