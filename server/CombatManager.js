class CombatManager {
    constructor(io, roomManager) {
      this.io = io;
      this.roomManager = roomManager;
      this.activeConbats = new Map(); // Maps roomId to combat state
    }
  
    initiateCombat(socket, data) {
      const { targets, initiatorId } = data;
      const room = this.roomManager.getPlayerRoom(socket.id);
      
      if (!room) {
        socket.emit('combatError', { message: 'Room not found' });
        return;
      }
      
      if (room.inCombat) {
        socket.emit('combatError', { message: 'Combat already in progress' });
        return;
      }
      
      // Set up combat participants
      const participants = [];
      const initiator = room.players.get(initiatorId || socket.id);
      
      if (!initiator) {
        socket.emit('combatError', { message: 'Initiator not found' });
        return;
      }
      
      participants.push({
        id: initiator.id,
        name: initiator.username,
        type: 'player',
        stats: { ...initiator.stats },
        buffs: [],
        debuffs: []
      });
      
      // Add targets (could be players or NPCs)
      if (targets && targets.length > 0) {
        targets.forEach(target => {
          if (target.type === 'player') {
            const playerTarget = room.players.get(target.id);
            if (playerTarget) {
              participants.push({
                id: playerTarget.id,
                name: playerTarget.username,
                type: 'player',
                stats: { ...playerTarget.stats },
                buffs: [],
                debuffs: []
              });
            }
          } else if (target.type === 'npc') {
            // For NPC targets, use the provided data
            participants.push({
              id: `npc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              name: target.name || 'Enemy',
              type: 'npc',
              stats: target.stats || {
                health: 100,
                maxHealth: 100,
                energy: 30,
                maxEnergy: 30
              },
              buffs: [],
              debuffs: []
            });
          }
        });
      }
      
      // Initialize combat state
      const combatState = {
        id: `combat-${Date.now()}`,
        participants,
        turn: 0,
        currentParticipantIndex: 0,
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
      
      // Start the first turn
      this.startNextTurn(room.id);
      
      console.log(`Combat initiated in room ${room.id}`);
    }
  
    handleAction(socket, data) {
      const { actionType, targetId, actionData } = data;
      const room = this.roomManager.getPlayerRoom(socket.id);
      
      if (!room || !room.inCombat) {
        socket.emit('combatError', { message: 'No active combat' });
        return;
      }
      
      const combat = room.combatState;
      const currentParticipant = combat.participants[combat.currentParticipantIndex];
      
      // Check if it's the player's turn
      if (currentParticipant.id !== socket.id && currentParticipant.type !== 'npc') {
        socket.emit('combatError', { message: 'Not your turn' });
        return;
      }
      
      // Find target
      const target = combat.participants.find(p => p.id === targetId);
      if (!target) {
        socket.emit('combatError', { message: 'Target not found' });
        return;
      }
      
      // Process the action
      let result = null;
      switch (actionType) {
        case 'attack':
          result = this.processAttack(currentParticipant, target, actionData);
          break;
        case 'defend':
          result = this.processDefend(currentParticipant, actionData);
          break;
        case 'cast':
          result = this.processCast(currentParticipant, target, actionData);
          break;
        default:
          socket.emit('combatError', { message: 'Invalid action type' });
          return;
      }
      
      // Add to combat log
      combat.log.push({
        turn: combat.turn,
        participantId: currentParticipant.id,
        actionType,
        targetId,
        result,
        timestamp: Date.now()
      });
      
      // Check if combat is over
      if (this.checkCombatEnd(combat)) {
        this.endCombat(room.id);
        return;
      }
      
      // Move to next turn
      this.advanceTurn(room.id);
      
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