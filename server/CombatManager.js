class CombatManager {
  constructor(io, roomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.activeConbats = new Map(); // Maps roomId to combat state
    this.socketIdToUsername = new Map(); // Maps socket.id to username
  }

  // In server/CombatManager.js
  initiateCombat(socket, data) {
    const { targets } = data;
    const room = this.roomManager.getPlayerRoom(socket.id);

    if (!room) {
      socket.emit('combatError', { message: 'Room not found' });
      return;
    }

    if (room.inCombat) {
      socket.emit('combatError', { message: 'Combat already in progress' });
      return;
    }

    // Get all players in room
    const players = Array.from(room.players.values());

    // Set up combat participants
    const participants = [];

    players.forEach(player => {
      this.socketIdToUsername.set(player.id, player.username);
    });

    // Add all players to combat
    players.forEach(player => {
      // Store the socket.id in the participant for reference
      const socketId = player.id;

      participants.push({
        id: socketId, // This must match the client's socket.id
        name: player.username,
        type: 'player',
        socketId: socketId, // Store this for reference
        stats: { ...player.stats },
        buffs: [],
        debuffs: [],
        actionPoints: {
          max: 3,
          lastUsedTimestamps: [0, 0, 0],
          rechargeRate: 3
        }
      });
    });

    // Add one NPC enemy per player
    players.forEach((player, index) => {
      participants.push({
        id: `npc-${Date.now()}-${index}`,
        name: `Enemy ${index + 1}`,
        type: 'npc',
        stats: {
          health: 100,
          maxHealth: 100,
          energy: 30,
          maxEnergy: 30,
          strength: 10,
          defense: 5
        },
        buffs: [],
        debuffs: [],
        actionPoints: {
          max: 3,
          lastUsedTimestamps: [0, 0, 0],
          rechargeRate: 3
        }
      });
    });

    // Initialize combat state
    const combatState = {
      id: `combat-${Date.now()}`,
      participants,
      log: [],
      status: 'active',
      startTime: Date.now()
    };

    // Update room state
    room.inCombat = true;
    room.combatState = combatState;
    this.activeConbats.set(room.id, combatState);

    // Notify all players in the room
    this.roomManager.broadcastToRoom(room.id, 'combatStarted', combatState);

    // Start NPC AI
    this.startNpcAi(room.id);

    console.log(`Combat initiated in room ${room.id} with ${players.length} players and ${players.length} enemies`);
  }

  // Add a new method for NPC AI
  startNpcAi(roomId) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.inCombat) return;

    const combat = room.combatState;
    const npcs = combat.participants.filter(p => p.type === 'npc');

    // Set up recurring actions for each NPC
    npcs.forEach(npc => {
      // Set up a recurring function for this NPC to attempt actions
      const npcInterval = setInterval(() => {
        if (!room.inCombat) {
          clearInterval(npcInterval);
          return;
        }

        // Try to perform an action if NPC has available action points
        const availablePoints = this.getAvailableActionPoints(npc);
        if (availablePoints.length > 0) {
          this.performNpcAction(roomId, npc);
        }

      }, 3000); // Check every second
    });
  }

  // Add helper method to get available action points
  getAvailableActionPoints(participant) {

    if (!participant || !participant.actionPoints) {
      return [];
    }
    const now = Date.now();
    const availablePoints = [];

    for (let i = 0; i < participant.actionPoints.max; i++) {
      const lastUsed = participant.actionPoints.lastUsedTimestamps[i];
      const rechargeTime = participant.actionPoints.rechargeRate * 1000; // Convert to ms
      const recharged = (now - lastUsed) >= rechargeTime;

      if (lastUsed === 0 || recharged) {
        availablePoints.push(i);
      }
    }

    return availablePoints;
  }

  handleAction(socket, data) {
    const { actionType, targetId, actionData } = data;
    const room = this.roomManager.getPlayerRoom(socket.id);

    if (!room || !room.inCombat) {
      socket.emit('combatError', { message: 'No active combat' });
      return;
    }

    const combat = room.combatState;

    // Find the actor (using socket.id)
    const participant = combat.participants.find(p => p.id === socket.id);

    if (!participant) {
      console.log('Participant not found for ID:', socket.id);
      console.log('All participants:', combat.participants.map(p => p.id));
      socket.emit('combatError', { message: 'Participant not found' });
      return;
    }

    // Check if player has an available action point
    const availablePoints = this.getAvailableActionPoints(participant);
    if (availablePoints.length === 0) {
      socket.emit('combatError', { message: 'No action points available' });
      return;
    }

    // Find target
    const target = combat.participants.find(p => p.id === targetId);
    if (!target) {
      socket.emit('combatError', { message: 'Target not found' });
      return;
    }

    // Use an action point
    const pointIndex = availablePoints[0];
    participant.actionPoints.lastUsedTimestamps[pointIndex] = Date.now();

    // Process the action
    let result = null;
    switch (actionType) {
      case 'attack':
        result = this.processAttack(participant, target, actionData);
        break;
      case 'defend':
        result = this.processDefend(participant, actionData);
        break;
      case 'cast':
        result = this.processCast(participant, target, actionData);
        break;
      default:
        socket.emit('combatError', { message: 'Invalid action type' });
        return;
    }

    // Add to combat log
    combat.log.push({
      participantId: participant.id,
      actionType,
      targetId,
      result,
      timestamp: Date.now()
    });

    console.log(`Player ${participant.name} used ${actionType} on ${target.name}`);

    // Check if combat is over
    if (this.checkCombatEnd(combat)) {
      this.endCombat(room.id);
      return;
    }

    // Broadcast updated combat state
    this.roomManager.broadcastToRoom(room.id, 'combatUpdate', combat);
  }

  processAttack(attacker, target, actionData) {
    // Basic attack logic
    const damage = actionData?.damage || Math.floor(Math.random() * 10) + 5; // Random damage between 5-15
    target.stats.health = Math.max(0, target.stats.health - damage);

    return {
      success: true,
      damage,
      targetHealth: target.stats.health
    };
  }

  processDefend(participant, actionData) {
    // Add a defense buff
    const defenseBuff = {
      type: 'defense',
      value: actionData?.value || 5,
      duration: actionData?.duration || 2 // Lasts for 2 turns
    };

    participant.buffs.push(defenseBuff);

    return {
      success: true,
      buffApplied: defenseBuff
    };
  }

  processCast(caster, target, actionData) {
    const { spellId, manaCost } = actionData || {};

    // Check mana cost
    if (manaCost && caster.stats.energy < manaCost) {
      return {
        success: false,
        message: 'Not enough energy'
      };
    }

    // Consume energy
    if (manaCost) {
      caster.stats.energy -= manaCost;
    }

    // Spell effects (simplified)
    let result = {
      success: true,
      energyUsed: manaCost || 0
    };

    // Simple damage spell
    if (spellId === 'fireball' || !spellId) {
      const damage = actionData?.damage || Math.floor(Math.random() * 15) + 10;
      target.stats.health = Math.max(0, target.stats.health - damage);
      result.damage = damage;
      result.targetHealth = target.stats.health;
    }
    // Healing spell
    else if (spellId === 'heal') {
      const healing = actionData?.healing || Math.floor(Math.random() * 15) + 10;
      target.stats.health = Math.min(target.stats.maxHealth, target.stats.health + healing);
      result.healing = healing;
      result.targetHealth = target.stats.health;
    }

    return result;
  }

  advanceTurn(roomId) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.inCombat) return;

    const combat = room.combatState;

    // Update buffs/debuffs duration
    combat.participants.forEach(participant => {
      // Process buffs
      participant.buffs = participant.buffs.filter(buff => {
        if (buff.duration <= 1) {
          return false; // Remove expired buff
        }
        buff.duration--;
        return true;
      });

      // Process debuffs
      participant.debuffs = participant.debuffs.filter(debuff => {
        if (debuff.duration <= 1) {
          return false; // Remove expired debuff
        }
        debuff.duration--;
        return true;
      });
    });

    // Move to next participant
    combat.currentParticipantIndex = (combat.currentParticipantIndex + 1) % combat.participants.length;

    // If we've gone through all participants, increment the turn counter
    if (combat.currentParticipantIndex === 0) {
      combat.turn++;
    }

    this.startNextTurn(roomId);
  }

  startNextTurn(roomId) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.inCombat) return;

    const combat = room.combatState;
    const currentParticipant = combat.participants[combat.currentParticipantIndex];

    // Notify all players about the turn change
    this.roomManager.broadcastToRoom(roomId, 'turnChange', {
      turn: combat.turn,
      participant: currentParticipant
    });

    // If it's an NPC's turn, process AI action
    if (currentParticipant.type === 'npc') {
      setTimeout(() => {
        this.processNpcAction(roomId, currentParticipant);
      }, 1500); // Add a delay to make it feel more natural
    }
  }

  // Make sure this method exists for NPC actions:
  performNpcAction(roomId, npc) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.inCombat) return;

    const combat = room.combatState;

    // Simple AI: find a random player target and attack
    const playerTargets = combat.participants.filter(p => p.type === 'player' && p.stats.health > 0);

    if (playerTargets.length === 0) {
      return;
    }

    const target = playerTargets[Math.floor(Math.random() * playerTargets.length)];

    // Use an action point
    const availablePoints = this.getAvailableActionPoints(npc);
    if (availablePoints.length === 0) return;

    const pointIndex = availablePoints[0];
    npc.actionPoints.lastUsedTimestamps[pointIndex] = Date.now();

    // Perform a basic attack
    const result = this.processAttack(npc, target);

    // Add to combat log
    combat.log.push({
      participantId: npc.id,
      actionType: 'attack',
      targetId: target.id,
      result,
      timestamp: Date.now()
    });

    // Check if combat is over
    if (this.checkCombatEnd(combat)) {
      this.endCombat(roomId);
      return;
    }

    // Broadcast updated combat state
    this.roomManager.broadcastToRoom(roomId, 'combatUpdate', combat);
  }

  processNpcAction(roomId, npc) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.inCombat) return;

    const combat = room.combatState;

    // Simple AI: find a random player target and attack
    const playerTargets = combat.participants.filter(p => p.type === 'player' && p.stats.health > 0);

    if (playerTargets.length === 0) {
      this.advanceTurn(roomId);
      return;
    }

    const target = playerTargets[Math.floor(Math.random() * playerTargets.length)];

    // Perform a basic attack
    const result = this.processAttack(npc, target);

    // Add to combat log
    combat.log.push({
      turn: combat.turn,
      participantId: npc.id,
      actionType: 'attack',
      targetId: target.id,
      result,
      timestamp: Date.now()
    });

    // Check if combat is over
    if (this.checkCombatEnd(combat)) {
      this.endCombat(roomId);
      return;
    }

    // Move to next turn
    this.advanceTurn(roomId);

    // Broadcast updated combat state
    this.roomManager.broadcastToRoom(roomId, 'combatUpdate', combat);
  }

  checkCombatEnd(combat) {
    // Check if all players or all NPCs are defeated
    const alivePlayers = combat.participants.filter(p => p.type === 'player' && p.stats.health > 0);
    const aliveNpcs = combat.participants.filter(p => p.type === 'npc' && p.stats.health > 0);

    return alivePlayers.length === 0 || aliveNpcs.length === 0;
  }

  endCombat(roomId) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.inCombat) return;

    const combat = room.combatState;

    // Determine winner
    const alivePlayers = combat.participants.filter(p => p.type === 'player' && p.stats.health > 0);
    const winner = alivePlayers.length > 0 ? 'players' : 'npcs';

    // Update combat status
    combat.status = 'completed';
    combat.endTime = Date.now();
    combat.winner = winner;

    // Update room state
    room.inCombat = false;
    this.activeConbats.delete(roomId);

    // Notify all players in the room
    this.roomManager.broadcastToRoom(roomId, 'combatEnded', {
      combat,
      winner
    });

    console.log(`Combat ended in room ${roomId}. Winner: ${winner}`);
  }
}

module.exports = CombatManager;