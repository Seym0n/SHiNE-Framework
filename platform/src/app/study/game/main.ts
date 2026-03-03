import { AUTO, Game } from 'phaser';
import GameScene from './scenes/GameScene';

/**
 * Base Phaser game configuration
 * Defines the core game settings including renderer type, dimensions, and initial scene
 */
const config: Phaser.Types.Core.GameConfig = {
    /** Automatically choose the best renderer (WebGL or Canvas) */
    type: AUTO,
    /** Game canvas width in pixels */
    width: 768,
    /** Game canvas height in pixels */
    height: 432,
    /** Initial scene to load when the game starts */
    scene: GameScene
};

/**
 * Creates and initializes a new Phaser game instance for the smart home simulation
 * @param parent DOM element ID where the game canvas should be attached
 * @param customConfig Custom game configuration containing rooms, devices, and settings
 * @returns Configured Phaser game instance ready for the smart home simulation
 */
const StartGame = (parent: string, customConfig?: Record<string, unknown>, width = 768, height = 432) => {
    // Create game instance with base config and attach to specified DOM element
    const game = new Game({ ...config, parent, width, height }) as Game & {
        config: Phaser.Types.Core.GameConfig & {
            scaleRoomElementsX: number;
            scaleRoomElementsY: number;
            positionScaleX: number;
            positionScaleY: number;
            uiScale: number;
            maxZoom: number;
            animDuration: number;
            settings: Record<string, unknown>;
        }
    };

    // Image scale factors: images were authored for 1024x576 canvas
    game.config.scaleRoomElementsX = width / 1024;
    game.config.scaleRoomElementsY = height / 576;

    // Position scale factors: positions were authored for 768x432 canvas
    game.config.positionScaleX = width / 768;
    game.config.positionScaleY = height / 432;

    // UI scale: single factor for Smarty panel elements, controls, text
    game.config.uiScale = width / 768;
    
    // Set camera zoom and animation limits
    game.config.maxZoom = 4;        // Maximum zoom level for device closeup
    game.config.animDuration = 400; // Duration for zoom/transition animations in ms
    
    // Attach custom configuration (rooms, devices, interactions)
    game.config.settings = customConfig;

    return game;
}

/**
 * Default export of the game initialization function
 * Used by React components to create and start the Phaser game instance
 */
export default StartGame;