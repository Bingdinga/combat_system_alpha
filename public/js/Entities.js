// Base entity class with common properties and methods
class Entity {
  constructor(config = {}) {
    this.id = config.id || `entity-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.name = config.name || 'Unknown Entity';
    this.type = config.type || 'entity';

    // Set up basic stats
    this.stats = {
      health: config.stats?.health || 100,
      maxHealth: config.stats?.maxHealth || 100,
      energy: config.stats?.energy || 50,
      maxEnergy: config.stats?.maxEnergy || 50,
      strength: config.stats?.strength || 10,
      defense: config.stats?.defense || 5,
      speed: config.stats?.speed || 10,
      ...config.stats
    };

    // Add action point properties
    this.actionPoints = config.actionPoints || {
      current: 3,
      max: 3,
      rechargeRate: 3, // seconds per action point
      lastUsedTimestamps: [0, 0, 0] // Timestamps for each action point's last usage
    };

    // Status effects
    this.buffs = config.buffs || [];
    this.debuffs = config.debuffs || [];
  }

  getAvailableActionPoints() {
    const now = Date.now();
    const availablePoints = [];

    for (let i = 0; i < this.actionPoints.max; i++) {
      const lastUsed = this.actionPoints.lastUsedTimestamps[i];
      const rechargeTime = this.actionPoints.rechargeRate * 1000; // Convert to ms
      const recharged = (now - lastUsed) >= rechargeTime;

      if (lastUsed === 0 || recharged) {
        availablePoints.push(i);
      }
    }

    return availablePoints;
  }

  // Add a method to use an action point
  useActionPoint() {
    const availablePoints = this.getAvailableActionPoints();

    if (availablePoints.length === 0) {
      return false;
    }

    // Use the first available action point
    const pointIndex = availablePoints[0];
    this.actionPoints.lastUsedTimestamps[pointIndex] = Date.now();

    return true;
  }

  // Add a method to get recharge progress for each action point
  getActionPointRechargeProgress() {
    const now = Date.now();
    const rechargeTime = this.actionPoints.rechargeRate * 1000; // Convert to ms

    return this.actionPoints.lastUsedTimestamps.map(lastUsed => {
      if (lastUsed === 0) return 1; // Fully charged

      const elapsed = now - lastUsed;
      return Math.min(1, elapsed / rechargeTime); // Progress from 0 to 1
    });
  }

  // Apply damage to this entity
  takeDamage(amount) {
    // Calculate actual damage after defense
    let actualDamage = amount;

    // Apply defense stat
    actualDamage = Math.max(1, actualDamage - Math.floor(this.stats.defense * 0.3));

    // Apply defense buffs
    const defenseBuff = this.buffs.find(buff => buff.type === 'defense');
    if (defenseBuff) {
      actualDamage = Math.max(1, actualDamage - defenseBuff.value);
    }

    // Update health
    this.stats.health = Math.max(0, this.stats.health - actualDamage);

    return {
      damage: actualDamage,
      currentHealth: this.stats.health,
      isDead: this.stats.health <= 0
    };
  }

  // Heal this entity
  heal(amount) {
    const actualHealing = Math.min(amount, this.stats.maxHealth - this.stats.health);
    this.stats.health += actualHealing;

    return {
      healing: actualHealing,
      currentHealth: this.stats.health
    };
  }

  // Use energy for an action
  useEnergy(amount) {
    if (this.stats.energy < amount) {
      return {
        success: false,
        message: 'Not enough energy'
      };
    }

    this.stats.energy -= amount;

    return {
      success: true,
      energyUsed: amount,
      currentEnergy: this.stats.energy
    };
  }

  // Recover energy
  recoverEnergy(amount) {
    const actualRecovery = Math.min(amount, this.stats.maxEnergy - this.stats.energy);
    this.stats.energy += actualRecovery;

    return {
      recovery: actualRecovery,
      currentEnergy: this.stats.energy
    };
  }

  // Add a buff to this entity
  addBuff(buff) {
    this.buffs.push(buff);
    return this.buffs;
  }

  // Add a debuff to this entity
  addDebuff(debuff) {
    this.debuffs.push(debuff);
    return this.debuffs;
  }

  // Process buffs and debuffs for this turn
  processTurnEffects() {
    // Process buffs: decrement duration, remove expired
    this.buffs = this.buffs.filter(buff => {
      if (buff.duration <= 1) {
        return false; // Remove expired buff
      }
      buff.duration--;
      return true;
    });

    // Process debuffs: apply effects, decrement duration, remove expired
    let damageFromDebuffs = 0;

    this.debuffs = this.debuffs.filter(debuff => {
      // Apply damage over time effects
      if (debuff.type === 'dot') {
        damageFromDebuffs += debuff.value;
      }

      if (debuff.duration <= 1) {
        return false; // Remove expired debuff
      }
      debuff.duration--;
      return true;
    });

    // Apply damage from debuffs
    if (damageFromDebuffs > 0) {
      this.takeDamage(damageFromDebuffs);
    }

    return {
      damageFromEffects: damageFromDebuffs,
      currentHealth: this.stats.health,
      currentBuffs: this.buffs,
      currentDebuffs: this.debuffs
    };
  }

  // Check if entity is alive
  isAlive() {
    return this.stats.health > 0;
  }

  // Serialize entity data for transmission
  serialize() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      stats: { ...this.stats },
      buffs: this.buffs.map(buff => ({ ...buff })),
      debuffs: this.debuffs.map(debuff => ({ ...debuff }))
    };
  }
}

// Player class for user-controlled entities
export class Player extends Entity {
  constructor(config = {}) {
    super({
      ...config,
      type: 'player'
    });

    // Player-specific properties
    this.username = config.username || 'Player';
    this.class = config.class || 'warrior';
    this.level = config.level || 1;
    this.experience = config.experience || 0;

    // Adjust stats based on class
    this.adjustStatsByClass();
  }

  adjustStatsByClass() {
    switch (this.class) {
      case 'warrior':
        this.stats.strength += 5;
        this.stats.defense += 3;
        this.stats.maxHealth += 20;
        this.stats.health = this.stats.maxHealth;
        break;

      case 'mage':
        this.stats.intelligence = (this.stats.intelligence || 10) + 5;
        this.stats.maxEnergy += 30;
        this.stats.energy = this.stats.maxEnergy;
        break;

      case 'healer':
        this.stats.wisdom = (this.stats.wisdom || 10) + 5;
        this.stats.maxEnergy += 20;
        this.stats.energy = this.stats.maxEnergy;
        break;
    }
  }

  // Level up the player
  levelUp() {
    this.level++;

    // Increase base stats
    this.stats.maxHealth += 10;
    this.stats.health = this.stats.maxHealth;
    this.stats.maxEnergy += 5;
    this.stats.energy = this.stats.maxEnergy;
    this.stats.strength += 1;
    this.stats.defense += 1;
    this.stats.speed += 1;

    // Additional class-specific increases
    this.adjustStatsByClass();

    return {
      newLevel: this.level,
      stats: { ...this.stats }
    };
  }

  // Add experience and check for level up
  addExperience(amount) {
    this.experience += amount;

    // Simple level formula: level * 100 experience needed
    const experienceNeeded = this.level * 100;

    let leveledUp = false;
    if (this.experience >= experienceNeeded) {
      this.experience -= experienceNeeded;
      this.levelUp();
      leveledUp = true;
    }

    return {
      experience: this.experience,
      leveledUp,
      level: this.level
    };
  }

  // Override serialize to include player-specific properties
  serialize() {
    return {
      ...super.serialize(),
      username: this.username,
      class: this.class,
      level: this.level,
      experience: this.experience
    };
  }
}

// Enemy class for AI-controlled entities
export class Enemy extends Entity {
  constructor(config = {}) {
    super({
      ...config,
      type: 'npc'
    });

    // Enemy-specific properties
    this.category = config.category || 'normal'; // normal, elite, boss
    this.difficulty = config.difficulty || 1;
    this.loot = config.loot || [];
    this.experienceValue = config.experienceValue || this.calculateExperienceValue();

    // Adjust stats based on difficulty
    this.adjustStatsByDifficulty();
  }

  adjustStatsByDifficulty() {
    const multiplier = this.difficulty;

    // Scale stats based on difficulty
    this.stats.maxHealth = Math.floor(this.stats.maxHealth * multiplier);
    this.stats.health = this.stats.maxHealth;
    this.stats.strength = Math.floor(this.stats.strength * multiplier);
    this.stats.defense = Math.floor(this.stats.defense * multiplier);

    // Additional adjustments based on enemy category
    switch (this.category) {
      case 'elite':
        this.stats.maxHealth *= 2;
        this.stats.health = this.stats.maxHealth;
        this.stats.strength *= 1.5;
        break;

      case 'boss':
        this.stats.maxHealth *= 5;
        this.stats.health = this.stats.maxHealth;
        this.stats.strength *= 2;
        this.stats.defense *= 1.5;
        break;
    }
  }

  // Calculate experience value based on stats and difficulty
  calculateExperienceValue() {
    let baseValue = 10;

    // Adjust based on category
    switch (this.category) {
      case 'elite':
        baseValue = 25;
        break;
      case 'boss':
        baseValue = 100;
        break;
    }

    // Adjust based on difficulty
    return Math.floor(baseValue * this.difficulty);
  }

  // Generate loot when defeated
  generateLoot() {
    // This would typically pull from a loot table
    // For now, just return the predefined loot
    return [...this.loot];
  }

  // Basic AI decision making for choosing an action
  decideAction(combatState) {
    // Simple AI: prioritize attacking low health players
    const players = combatState.participants.filter(p =>
      p.type === 'player' && p.stats.health > 0
    );

    // If no valid targets, return null
    if (players.length === 0) {
      return null;
    }

    // Sort players by health (lowest first)
    players.sort((a, b) => a.stats.health - b.stats.health);

    // Choose target and action
    const target = players[0];

    // 80% chance to attack, 20% chance to use a special ability if available
    if (Math.random() < 0.8 || this.stats.energy < 10) {
      return {
        actionType: 'attack',
        targetId: target.id
      };
    } else {
      // Use a special ability (simplified for now)
      return {
        actionType: 'cast',
        targetId: target.id,
        actionData: {
          spellId: 'enemySpell',
          manaCost: 10
        }
      };
    }
  }

  // Override serialize to include enemy-specific properties
  serialize() {
    return {
      ...super.serialize(),
      category: this.category,
      difficulty: this.difficulty,
      experienceValue: this.experienceValue
    };
  }
}