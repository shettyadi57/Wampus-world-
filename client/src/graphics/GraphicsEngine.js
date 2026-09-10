/**
 * GraphicsEngine.js
 * ─────────────────────────────────────────────────────────────
 * Owns all Three.js rendering: scene graph, camera, renderer,
 * post-processing, and the game loop (requestAnimationFrame).
 *
 * Rendering is a read-only consumer of game state — it NEVER
 * mutates VehicleState, WorldContext, or KnowledgeBase.
 *
 * Three.js version: r165+ (ES module import map or CDN).
 * Renderer: WebGLRenderer (WebGPU opt-in behind a feature flag).
 *
 * Post-processing stack (planned):
 *   Bloom → FXAA → Vignette → LUT colour grade
 */

/**
 * @typedef {Object} GraphicsEngineContext
 * @property {function(): void} startLoop    – begin rAF render loop
 * @property {function(): void} stopLoop     – cancel rAF
 * @property {function(): THREE.Scene} getScene
 * @property {function(): THREE.Camera} getCamera
 * @property {function(): THREE.WebGLRenderer} getRenderer
 */

/**
 * @param {import('../vehicle/VehicleController.js').VehicleState} vehicle
 * @param {import('../world/WorldManager.js').WorldContext} world
 * @returns {Promise<GraphicsEngineContext>}
 */
export async function initGraphics(vehicle, world) {
  // TODO: import Three.js, create renderer on #game-canvas,
  //       build scene graph, start render loop.
  //       Renderer resize observer for window resizing.
  console.log('[graphics] GraphicsEngine initialised (stub)');
  return {
    startLoop:   () => {},
    stopLoop:    () => {},
    getScene:    () => null,
    getCamera:   () => null,
    getRenderer: () => null,
  };
}
