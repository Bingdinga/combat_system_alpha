import { Actions } from './Actions.js';

export class CombatManager {
  constructor(socket) {
    this.socket = socket;
    this.actions = new Actions();
    this.combatState = null;
    this.localPlayerId = this.socket.id;
    this.eventListeners = {};
  }

  // Initialize combat with state from server
  initializeCombat(combatState) {
    this.combatState = combatState;
    this.emitEvent('combatInitialized', combatState);
  }

  // Update combat state
  updateCombatState(newState) {
    this.combatState = newState;
    this.emitEvent('combatUpdated', newState);
  }

  // Update current turn
  updateTurn(turnData) {
    if (!this.combatState) return;
    
    this.combatState.turn = turnData.turn;
    this.combatState.currentParticipant = turnData.participant;
    
    this.emitEvent('turnUpdated', turnData);
    
    // Check if it's the local player's turn
    const isLocalPlayerTurn = turnData.participant.id === this.localPlayerId;
    if (isLocalPlayerTurn) {
      this.emitEvent('playerTurnStarted', turnData);
    }
  }

  // Perform a combat action
  performAction(actionType, targetId, actionData = {}) {
    if (!this.combatState) {
      console.error('No active combat');
      return false;
    }
    
    const currentParticipant = this.combatState.participants[this.combatState.currentParticipantIndex];
    
    // Check if it's the player's turn
    if (currentParticipant.id !== this.localPlayerId) {
      console.error('Not your turn');
      return false;
    }
    
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
    return this.combatState.participants.find(p => p.id === this.localPlayerId);
  }

  // Check if it's the local player's turn
  isLocalPlayerTurn() {
    if (!this.combatState) return false;
    const currentParticipant = this.combatState.participants[this.combatState.currentParticipantIndex];
    return currentParticipant && currentParticipant.id === this.localPlayerId;
  }

  // Get available actions for the current player
  getAvailableActions() {
    if (!this.isLocalPlayerTurn()) return [];
    
    // Get basic actions
    const actions = this.actions.getBaseActions();
    
    // Filter based on player state (could add more logic here)
    const player = this.getLocalPlayer();
    
    // Filter out actions that require more energy than the player has
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