import { Actions } from './Actions.js';

export class CombatManager {
  constructor(socket) {
    this.socket = socket;
    this.actions = new Actions();
    this.combatState = null;
    this.localPlayerId = socket.id;
    console.log('CombatManager initialized with local player ID:', this.localPlayerId);
    this.eventListeners = {};

    // Add listener for when combat starts to verify player ID
    this.addEventListener('combatInitialized', (state) => {
      console.log('Combat initialized, local player ID:', this.localPlayerId);
      console.log('Combat participants:', state.participants.map(p => ({ id: p.id, name: p.name })));
      const localPlayer = state.participants.find(p => p.id === this.localPlayerId);
      console.log('Found local player:', localPlayer ? localPlayer.name : 'Not found');
    });
  }

  initializeCombat(combatState) {
    console.log('CombatManager initializing combat with state:', combatState.id);

    // Store the combat state
    this.combatState = combatState;

    // Find the local player in participants
    const localPlayer = combatState.participants.find(p =>
      p.type === 'player' && p.id === this.localPlayerId
    );

    if (localPlayer) {
      console.log('Found local player in combat state:', localPlayer.name);
    } else {
      console.warn('Local player not found with ID:', this.localPlayerId);

      // Try to identify by username from localStorage
      const username = localStorage.getItem('username');
      if (username) {
        const playerByName = combatState.participants.find(p =>
          p.type === 'player' && p.name === username
        );

        if (playerByName) {
          console.log('Found player by username:', playerByName.name);
          this.localPlayerId = playerByName.id;
        } else {
          // As a last resort, just take the first player
          const firstPlayer = combatState.participants.find(p => p.type === 'player');
          if (firstPlayer) {
            console.log('Using first player as fallback:', firstPlayer.name);
            this.localPlayerId = firstPlayer.id;
          }
        }
      }
    }

    // Emit the event after we've processed everything
    this.emitEvent('combatInitialized', combatState);
  }

  // Update combat state
  updateCombatState(newState) {
    this.combatState = newState;
    this.emitEvent('combatUpdated', newState);
  }

  // Perform a combat action
  performAction(actionType, targetId, actionData = {}) {
    if (!this.combatState) {
      console.error('No active combat');
      return false;
    }

    const player = this.getLocalPlayer();
    if (!player) {
      console.error('Local player not found. Local ID:', this.localPlayerId);
      console.error('Available participant IDs:', this.combatState.participants.map(p => p.id));
      return false;
    }

    // Check if player has available action points
    const now = Date.now();
    let hasAvailableActionPoint = false;

    for (let i = 0; i < player.actionPoints.max; i++) {
      const lastUsed = player.actionPoints.lastUsedTimestamps[i];
      const rechargeTime = player.actionPoints.rechargeRate * 1000;

      if (lastUsed === 0 || (now - lastUsed) >= rechargeTime) {
        hasAvailableActionPoint = true;
        break;
      }
    }

    if (!hasAvailableActionPoint) {
      console.error('No action points available');
      return false;
    }

    console.log('Attempting action:', actionType, 'on target:', targetId);

    // Validate the action
    if (!this.validateAction(actionType, targetId, actionData)) {
      return false;
    }

    // Send the action to the server
    this.socket.emit('combatAction', {
      actionType,
      targetId,
      actionData
    });

    return true;
  }

  // Add method to get action point recharge progress
  getActionPointProgress() {
    const player = this.getLocalPlayer();
    if (!player || !player.actionPoints) return [0, 0, 0];

    const now = Date.now();
    const rechargeTime = player.actionPoints.rechargeRate * 1000;

    return player.actionPoints.lastUsedTimestamps.map(lastUsed => {
      if (lastUsed === 0) return 1; // Fully charged

      const elapsed = now - lastUsed;
      return Math.min(1, elapsed / rechargeTime); // Progress from 0 to 1
    });
  }

  // Update canPerformAction to handle server data format
  canPerformAction() {
    const player = this.getLocalPlayer();
    if (!player || !player.actionPoints) {
      console.log('Cannot perform action - no player or action points'); // Debug log
      return false;
    }

    const now = Date.now();
    const rechargeTime = player.actionPoints.rechargeRate * 1000;

    const available = player.actionPoints.lastUsedTimestamps.some(lastUsed =>
      lastUsed === 0 || (now - lastUsed) >= rechargeTime
    );

    console.log('Can perform action:', available); // Debug log
    return available;
  }

  // Attack a target
  attack(targetId, attackData = {}) {
    return this.performAction('attack', targetId, attackData);
  }

  // Defend action
  defend(defendData = {}) {
    return this.performAction('defend', this.localPlayerId, defendData);
  }

  // Cast a spell
  cast(targetId, spellData) {
    return this.performAction('cast', targetId, spellData);
  }

  // Validate an action before sending to server
  validateAction(actionType, targetId, actionData) {
    if (!this.combatState) return false;

    // Check if target exists
    const target = this.combatState.participants.find(p => p.id === targetId);
    if (!target) {
      console.error('Target not found');
      return false;
    }

    // Check if target is alive
    if (target.stats.health <= 0) {
      console.error('Target is defeated');
      return false;
    }

    // Specific validations based on action type
    switch (actionType) {
      case 'attack':
        // Basic attack validation (can add more later)
        return true;

      case 'defend':
        // Defend validation
        return true;

      case 'cast':
        // Cast validation
        const { spellId, manaCost } = actionData;

        // Check if player has enough energy
        const player = this.getLocalPlayer();
        if (manaCost && player && player.stats.energy < manaCost) {
          console.error('Not enough energy');
          return false;
        }

        return true;

      default:
        console.error('Invalid action type');
        return false;
    }
  }

  // Get the local player from combat state
  getLocalPlayer() {
    if (!this.combatState) return null;
    const localPlayer = this.combatState.participants.find(p => p.id === this.localPlayerId);
    console.log('Local player:', this.localPlayerId, localPlayer); // Debug log
    return localPlayer;
  }

  // Check if it's the local player's turn
  isLocalPlayerTurn() {
    if (!this.combatState) return false;
    const currentParticipant = this.combatState.participants[this.combatState.currentParticipantIndex];
    return currentParticipant && currentParticipant.id === this.localPlayerId;
  }

  // Get available actions for the current player
  // In public/js/CombatManager.js

  // Modify getAvailableActions to be more resilient
  getAvailableActions() {
    if (!this.combatState) {
      console.log('No combat state, cannot get actions');
      return [];
    }

    // Get basic actions from Actions class
    const actions = this.actions.getBaseActions();
    console.log('Base actions retrieved:', actions.length);

    // Try to find the local player
    let player = this.getLocalPlayer();

    // If no player found by ID, try to find by name (as fallback)
    if (!player) {
      const username = localStorage.getItem('username') || '';
      player = this.combatState.participants.find(p =>
        p.type === 'player' && p.name === username
      );

      if (player) {
        console.log('Found player by username match as fallback:', player.name);
        this.localPlayerId = player.id; // Update the ID
      } else {
        console.error('Cannot find local player by ID or username');

        // Last resort: just use the first player if there's only one human
        const humanPlayers = this.combatState.participants.filter(p => p.type === 'player');
        if (humanPlayers.length === 1) {
          player = humanPlayers[0];
          this.localPlayerId = player.id;
          console.log('Last resort: using the only human player:', player.name);
        }
      }
    }

    if (!player) {
      console.error('No player found, cannot filter actions');
      return actions; // Return all actions as last resort
    }

    // Filter based on player energy
    return actions.filter(action => {
      if (action.energyCost && player.stats.energy < action.energyCost) {
        return false;
      }
      return true;
    });
  }

  // Get valid targets for an action
  getValidTargets(actionType) {
    if (!this.combatState) return [];

    // Filter based on action type
    switch (actionType) {
      case 'attack':
        // Can only attack enemies
        return this.combatState.participants.filter(p =>
          p.type === 'npc' && p.stats.health > 0
        );

      case 'defend':
        // Can only defend self
        return [this.getLocalPlayer()];

      case 'cast':
        // Can cast on anyone depending on the spell
        return this.combatState.participants.filter(p =>
          p.stats.health > 0
        );

      default:
        return [];
    }
  }

  // Event listener system
  addEventListener(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  removeEventListener(event, callback) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
  }

  emitEvent(event, data) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event].forEach(callback => callback(data));
  }

  // End combat and clean up
  endCombat(results) {
    this.emitEvent('combatEnded', results);
    this.combatState = null;
  }

  // Reset combat manager
  reset() {
    this.combatState = null;
  }
}