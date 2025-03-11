export class Actions {
    constructor() {
      // Define base actions
      this.baseActions = [
        {
          id: 'attack',
          type: 'attack',
          name: 'Attack',
          description: 'Basic attack that deals damage to a target',
          energyCost: 0,
          targetType: 'enemy', // enemy, ally, self, any
          damageType: 'physical',
          baseDamage: [5, 15] // Min-max damage range
        },
        {
          id: 'defend',
          type: 'defend',
          name: 'Defend',
          description: 'Take a defensive stance, reducing incoming damage',
          energyCost: 0,
          targetType: 'self',
          effect: {
            type: 'defense',
            value: 5,
            duration: 2
          }
        },
        {
          id: 'fireball',
          type: 'cast',
          name: 'Fireball',
          description: 'Cast a fireball that deals fire damage to a target',
          energyCost: 15,
          targetType: 'enemy',
          damageType: 'magical',
          baseDamage: [10, 20]
        },
        {
          id: 'heal',
          type: 'cast',
          name: 'Heal',
          description: 'Cast a healing spell that restores health to a target',
          energyCost: 20,
          targetType: 'any',
          effect: {
            type: 'healing',
            value: [10, 20] // Min-max healing range
          }
        }
      ];
      
      // More specialized action collections can be added here
      this.warriorActions = [...this.baseActions];
      this.mageActions = [...this.baseActions];
      this.healerActions = [...this.baseActions];
    }
  
    // Get all base actions available to any character
    getBaseActions() {
      return this.baseActions;
    }
  
    // Get class-specific actions
    getActionsForClass(className) {
      switch (className.toLowerCase()) {
        case 'warrior':
          return this.warriorActions;
        case 'mage':
          return this.mageActions;
        case 'healer':
          return this.healerActions;
        default:
          return this.baseActions;
      }
    }
  
    // Get a specific action by ID
    getActionById(actionId) {
      return this.baseActions.find(action => action.id === actionId);
    }
  
    // Calculate damage for an attack action
    calculateDamage(action, attacker, target) {
      if (!action.baseDamage) return 0;
      
      // Get random damage in range
      const [minDamage, maxDamage] = action.baseDamage;
      let damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
      
      // Apply attacker's stats (simplified)
      if (attacker.stats.strength) {
        damage += Math.floor(attacker.stats.strength * 0.5);
      }
      
      // Apply target's defense (simplified)
      if (target.stats.defense) {
        damage = Math.max(1, damage - Math.floor(target.stats.defense * 0.3));
      }
      
      // Check for target's defensive buffs
      if (target.buffs) {
        const defenseBuff = target.buffs.find(buff => buff.type === 'defense');
        if (defenseBuff) {
          damage = Math.max(1, damage - defenseBuff.value);
        }
      }
      
      return Math.max(1, damage); // Minimum 1 damage
    }
  
    // Calculate healing for a healing action
    calculateHealing(action, caster, target) {
      if (!action.effect || action.effect.type !== 'healing') return 0;
      
      // Get random healing in range
      const [minHealing, maxHealing] = action.effect.value;
      let healing = Math.floor(Math.random() * (maxHealing - minHealing + 1)) + minHealing;
      
      // Apply caster's stats (simplified)
      if (caster.stats.wisdom) {
        healing += Math.floor(caster.stats.wisdom * 0.5);
      }
      
      return healing;
    }
  
    // Get all possible targets for an action
    getPossibleTargets(action, participants, actorId) {
      const actor = participants.find(p => p.id === actorId);
      if (!actor) return [];
      
      switch (action.targetType) {
        case 'enemy':
          // Can target enemies (assuming players can only target NPCs)
          return participants.filter(p => 
            p.type !== actor.type && p.stats.health > 0
          );
          
        case 'ally':
          // Can target allies of the same type
          return participants.filter(p => 
            p.type === actor.type && p.id !== actorId && p.stats.health > 0
          );
          
        case 'self':
          // Can only target self
          return [actor];
          
        case 'any':
          // Can target any participant
          return participants.filter(p => p.stats.health > 0);
          
        default:
          return [];
      }
    }
  
    // Check if an action is valid given the current state
    isActionValid(action, actor, target) {
      // Check if actor has enough energy
      if (action.energyCost > actor.stats.energy) {
        return false;
      }
      
      // Check if target is valid
      if (action.targetType === 'enemy' && actor.type === target.type) {
        return false;
      }
      
      if (action.targetType === 'ally' && actor.type !== target.type) {
        return false;
      }
      
      if (action.targetType === 'self' && actor.id !== target.id) {
        return false;
      }
      
      // Check if target is alive
      if (target.stats.health <= 0) {
        return false;
      }
      
      return true;
    }
  }