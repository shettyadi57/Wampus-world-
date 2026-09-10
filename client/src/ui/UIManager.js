/**
 * UIManager.js
 * ─────────────────────────────────────────────────────────────
 * Owns all in-game UI panels: HUD, mini-map, KB visualiser,
 * menu screens, and mission log.
 *
 * UI is a read-only view of game state. It may dispatch user
 * actions to ActuatorBus or MissionController but must never
 * write to state directly.
 *
 * Panel mounting target: <div id="ui-overlay"> in index.html.
 * Implementation may use vanilla DOM or a lightweight VDOM.
 */

/**
 * @typedef {Object} UIManagerContext
 * @property {function(Object): void} updateHUD       – push fresh vehicle data
 * @property {function(Object): void} updateKBView    – push KB snapshot for debug panel
 * @property {function(string): void} showNotification – toast message
 * @property {function(): void} showPauseMenu
 * @property {function(): void} hidePauseMenu
 */

/**
 * @param {import('../state/StateManager.js').GameState} state
 * @param {import('../vehicle/VehicleController.js').VehicleState} vehicle
 * @param {import('../actuators/ActuatorBus.js').ActuatorBusContext} actuators
 * @returns {Promise<UIManagerContext>}
 */
export async function initUI(state, vehicle, actuators) {
  // TODO: mount HUD overlay, bind keyboard shortcuts to actuators,
  //       create KB debug panel, mission log panel.
  console.log('[ui] UIManager initialised (stub)');
  return {
    updateHUD:        () => {},
    updateKBView:     () => {},
    showNotification: () => {},
    showPauseMenu:    () => {},
    hidePauseMenu:    () => {},
  };
}
