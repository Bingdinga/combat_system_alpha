export class CombatUI {
  constructor(container, combatManager) {
    this.container = container;
    this.combatManager = combatManager;
    this.elements = {};
    this.combatState = null;

    // Create UI elements
    this.createUIElements();

    // Listen for combat events
    this.setupEventListeners();

    // Set up action points interval
    this.setupActionPointsInterval();
  }

  createUIElements() {
    // Clear container
    this.container.innerHTML = '';

    // Create main sections
    this.elements.header = document.createElement('div');
    this.elements.header.className = 'combat-header';

    this.elements.battlefield = document.createElement('div');
    this.elements.battlefield.className = 'battlefield';

    this.elements.playerArea = document.createElement('div');
    this.elements.playerArea.className = 'player-area';

    this.elements.enemyArea = document.createElement('div');
    this.elements.enemyArea.className = 'enemy-area';

    this.elements.actionBar = document.createElement('div');
    this.elements.actionBar.className = 'action-bar';

    this.elements.logContainer = document.createElement('div');
    this.elements.logContainer.className = 'combat-log-container';

    this.elements.log = document.createElement('div');
    this.elements.log.className = 'combat-log';
    this.elements.logContainer.appendChild(this.elements.log);

    // Add sections to container
    this.elements.battlefield.appendChild(this.elements.enemyArea);
    this.elements.battlefield.appendChild(this.elements.playerArea);

    // Create action point indicator
    this.elements.actionPoints = document.createElement('div');
    this.elements.actionPoints.className = 'action-points';

    // Create individual action point indicators
    for (let i = 0; i < 3; i++) {
      const actionPoint = document.createElement('div');
      actionPoint.className = 'action-point';
      actionPoint.innerHTML = `
      <div class="action-point-progress"></div>
      <span class="action-point-label">${i + 1}</span>
    `;
      this.elements.actionPoints.appendChild(actionPoint);
    }

    this.container.appendChild(this.elements.actionPoints);
    this.container.appendChild(this.elements.header);
    this.container.appendChild(this.elements.battlefield);
    this.container.appendChild(this.elements.actionBar);
    this.container.appendChild(this.elements.logContainer);
  }

  setupActionPointsInterval() {
    if (this.actionPointsInterval) {
      clearInterval(this.actionPointsInterval);
    }

    this.actionPointsInterval = setInterval(() => {
      this.updateActionPoints();
    }, 100); // Update every 100ms for smooth progress
  }

  setupEventListeners() {
    // Listen for combat events from the combat manager
    this.combatManager.addEventListener('combatInitialized', this.initializeCombat.bind(this));
    this.combatManager.addEventListener('combatUpdated', this.updateCombatState.bind(this));
    this.combatManager.addEventListener('turnUpdated', this.updateTurn.bind(this));
    this.combatManager.addEventListener('playerTurnStarted', this.showActions.bind(this));
    this.combatManager.addEventListener('combatEnded', this.showCombatResults.bind(this));

    this.actionTimeout = null;

    // Add interval for updating action points
    this.actionPointsInterval = setInterval(() => {
      if (this.combatState) {
        this.updateActionPoints();
      }
    }, 100); // Update every 100ms for smooth progress bars
  }

  updateActionButtonState() {
    const canAct = this.combatManager.canPerformAction();
    console.log('Can perform action:', canAct); // Debug log

    const actionButtons = this.elements.actionBar.querySelectorAll('.action-button');
    actionButtons.forEach(button => {
      button.disabled = !canAct;
    });
  }

  // Add a method to update action points UI
  updateActionPoints() {
    if (!this.combatState) return;

    // Update action points for all participants
    this.combatState.participants.forEach(participant => {
      const card = this.container.querySelector(`.participant-card[data-id="${participant.id}"]`);
      if (card) {
        this.updateEntityActionPoints(participant, card);
      }
    });

    // Update action button state based on local player's action point availability
    this.updateActionButtonState();
  }

  initializeCombat(combatState) {
    console.log('CombatUI initializing with combat state:', combatState.id);

    // Store the combat state
    this.combatState = combatState;

    // Update header
    this.elements.header.innerHTML = `
      <h2>Combat</h2>
    `;

    // Render participants
    this.renderParticipants(combatState.participants);

    // Clear log
    this.elements.log.innerHTML = '';
    this.addLogMessage('Combat started!');

    // Show actions after a short delay to ensure everything is set up
    setTimeout(() => {
      this.showActions();
      this.updateActionPoints();
    }, 500);
  }

  renderParticipants(participants) {
    // Clear areas
    this.elements.playerArea.innerHTML = '';
    this.elements.enemyArea.innerHTML = '';

    participants.forEach(participant => {
      const card = this.createParticipantCard(participant);

      if (participant.type === 'player') {
        this.elements.playerArea.appendChild(card);
      } else {
        this.elements.enemyArea.appendChild(card);
      }
    });
  }

  // In public/js/CombatUI.js, update the createParticipantCard method:

  createParticipantCard(participant) {
    const card = document.createElement('div');
    card.className = `participant-card ${participant.type}`;
    card.dataset.id = participant.id;

    const healthPercent = (participant.stats.health / participant.stats.maxHealth) * 100;
    const energyPercent = (participant.stats.energy / participant.stats.maxEnergy) * 100;

    // Create main card content
    card.innerHTML = `
    <div class="participant-name">${participant.name}</div>
    <div class="stats">
      <div class="health-bar">
        <div class="health-bar-inner" style="width: ${healthPercent}%"></div>
        <span class="health-text">${participant.stats.health}/${participant.stats.maxHealth}</span>
      </div>
      <div class="energy-bar">
        <div class="energy-bar-inner" style="width: ${energyPercent}%"></div>
        <span class="energy-text">${participant.stats.energy}/${participant.stats.maxEnergy}</span>
      </div>
    </div>
    <div class="action-points-container">
      <div class="action-points-label">Action Points:</div>
      <div class="entity-action-points"></div>
    </div>
    <div class="status-effects">
      ${this.renderStatusEffects(participant)}
    </div>
  `;

    // Add action points indicators
    const actionPointsContainer = card.querySelector('.entity-action-points');

    // Create individual action point indicators
    if (participant.actionPoints) {
      for (let i = 0; i < participant.actionPoints.max; i++) {
        const actionPoint = document.createElement('div');
        actionPoint.className = 'entity-action-point';
        actionPoint.innerHTML = `<div class="entity-action-point-progress"></div>`;
        actionPointsContainer.appendChild(actionPoint);
      }
    }

    return card;
  }

  renderStatusEffects(participant) {
    let html = '';

    // Render buffs
    participant.buffs.forEach(buff => {
      html += `<div class="status-effect buff" title="${buff.type}: ${buff.value} (${buff.duration} turns)">
          ${buff.type} (${buff.duration})
        </div>`;
    });

    // Render debuffs
    participant.debuffs.forEach(debuff => {
      html += `<div class="status-effect debuff" title="${debuff.type}: ${debuff.value} (${debuff.duration} turns)">
          ${debuff.type} (${debuff.duration})
        </div>`;
    });

    return html;
  }

  // In public/js/CombatUI.js, update the updateCombatState method:

  updateCombatState(combatState) {
    // Store the updated combat state
    this.combatState = combatState;

    // Update participant stats
    combatState.participants.forEach(participant => {
      const card = this.container.querySelector(`.participant-card[data-id="${participant.id}"]`);
      if (!card) return;

      const healthPercent = (participant.stats.health / participant.stats.maxHealth) * 100;
      const energyPercent = (participant.stats.energy / participant.stats.maxEnergy) * 100;

      card.querySelector('.health-bar-inner').style.width = `${healthPercent}%`;
      card.querySelector('.health-text').textContent = `${participant.stats.health}/${participant.stats.maxHealth}`;

      card.querySelector('.energy-bar-inner').style.width = `${energyPercent}%`;
      card.querySelector('.energy-text').textContent = `${participant.stats.energy}/${participant.stats.maxEnergy}`;

      card.querySelector('.status-effects').innerHTML = this.renderStatusEffects(participant);

      // Update action points for this participant
      this.updateEntityActionPoints(participant, card);

      // Add defeated class if health is 0
      if (participant.stats.health <= 0) {
        card.classList.add('defeated');
      } else {
        card.classList.remove('defeated');
      }
    });

    // Update combat log
    this.updateCombatLog(combatState.log);

    // Check if we need to refresh the action buttons
    const waitingMessage = this.elements.actionBar.querySelector('.waiting-message');
    if (waitingMessage && this.currentAction) {
      // If an action was performed over 1 second ago, refresh the action buttons
      const now = Date.now();
      if (now - this.currentAction.timestamp > 1000) {
        console.log('Refreshing action buttons after state update');
        this.showActions();
        this.currentAction = null;

        // Clear any pending timeout
        if (this.actionTimeout) {
          clearTimeout(this.actionTimeout);
          this.actionTimeout = null;
        }
      }
    }
  }

  // Add this new method to update a specific entity's action points
  updateEntityActionPoints(participant, card) {
    if (!participant.actionPoints) return;

    const now = Date.now();
    const rechargeTime = participant.actionPoints.rechargeRate * 1000;
    const actionPointElements = card.querySelectorAll('.entity-action-point');

    // Update each action point indicator
    participant.actionPoints.lastUsedTimestamps.forEach((lastUsed, index) => {
      const element = actionPointElements[index];
      if (!element) return;

      let progress = 1; // Default to fully charged
      if (lastUsed > 0) {
        const elapsed = now - lastUsed;
        progress = Math.min(1, elapsed / rechargeTime);
      }

      const progressBar = element.querySelector('.entity-action-point-progress');
      progressBar.style.width = `${progress * 100}%`;

      // Add/remove 'ready' class based on charge state
      if (progress >= 1) {
        element.classList.add('ready');
      } else {
        element.classList.remove('ready');
      }
    });
  }

  updateCombatLog(logEntries) {
    // Check if there are new entries
    const currentEntryCount = this.elements.log.querySelectorAll('.log-entry').length;
    if (logEntries.length <= currentEntryCount) return;

    // Add new log entries
    for (let i = currentEntryCount; i < logEntries.length; i++) {
      const entry = logEntries[i];
      this.addLogMessage(this.formatLogEntry(entry));
    }

    // Scroll to bottom
    this.elements.logContainer.scrollTop = this.elements.logContainer.scrollHeight;
  }

  formatLogEntry(entry) {
    const participant = entry.participantId;
    const target = entry.targetId;

    switch (entry.actionType) {
      case 'attack':
        return `${participant} attacks ${target} for ${entry.result.damage} damage!`;

      case 'defend':
        return `${participant} defends, gaining ${entry.result.buffApplied.value} defense for ${entry.result.buffApplied.duration} turns.`;

      case 'cast':
        if (entry.result.damage) {
          return `${participant} casts a spell on ${target}, dealing ${entry.result.damage} damage!`;
        } else if (entry.result.healing) {
          return `${participant} casts a healing spell on ${target}, restoring ${entry.result.healing} health!`;
        } else {
          return `${participant} casts a spell on ${target}.`;
        }

      default:
        return `${participant} performs an action.`;
    }
  }

  addLogMessage(message) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = message;

    this.elements.log.appendChild(entry);
  }

  updateTurn(turnData) {
    // Update turn counter
    const turnCounter = this.container.querySelector('#turnCounter');
    if (turnCounter) {
      turnCounter.textContent = turnData.turn + 1; // Display as 1-based
    }

    // Highlight active participant
    const cards = this.container.querySelectorAll('.participant-card');
    cards.forEach(card => {
      card.classList.remove('active');
    });

    const activeCard = this.container.querySelector(`.participant-card[data-id="${turnData.participant.id}"]`);
    if (activeCard) {
      activeCard.classList.add('active');
    }

    // Show whose turn it is
    this.addLogMessage(`It's ${turnData.participant.name}'s turn.`);

    // Clear action bar if it's not the player's turn
    if (turnData.participant.id !== this.combatManager.localPlayerId) {
      this.elements.actionBar.innerHTML = `<div class="waiting-message">Waiting for ${turnData.participant.name}...</div>`;
    }
  }

  showActions() {
    // Clear action bar
    this.elements.actionBar.innerHTML = '';

    if (!this.combatManager.combatState) {
      console.error('Combat manager has no combat state');
      return;
    }

    console.log('Getting available actions for player ID:', this.combatManager.localPlayerId);

    // Get available actions
    const actions = this.combatManager.getAvailableActions();
    console.log('Available actions:', actions);

    if (actions.length === 0) {
      this.elements.actionBar.innerHTML = '<div class="no-actions-message">No actions available</div>';
      return;
    }

    // Create action buttons
    actions.forEach(action => {
      const button = document.createElement('button');
      button.className = 'action-button';
      button.dataset.action = action.type;
      button.textContent = action.name;

      button.addEventListener('click', () => {
        console.log('Action button clicked:', action.name);
        this.handleActionButtonClick(action);
      });

      this.elements.actionBar.appendChild(button);
    });
  }

  handleActionButtonClick(action) {
    // Get valid targets
    const validTargets = this.combatManager.getValidTargets(action.type);

    // Show target selection if needed
    if (validTargets.length > 1 && action.targetType !== 'self') {
      this.showTargetSelection(action, validTargets);
    } else {
      // Auto-select target if only one or self-targeting
      const targetId = validTargets.length > 0 ? validTargets[0].id : this.combatManager.localPlayerId;
      this.executeAction(action, targetId);
    }
  }

  // In public/js/CombatUI.js

  // Add a failsafe method to show basic actions
  showBasicActions() {
    // Clear action bar
    this.elements.actionBar.innerHTML = '';

    // Define basic actions as a fallback
    const basicActions = [
      { id: 'attack', type: 'attack', name: 'Attack', targetType: 'enemy' },
      { id: 'defend', type: 'defend', name: 'Defend', targetType: 'self' }
    ];

    // Create buttons for these basic actions
    basicActions.forEach(action => {
      const button = document.createElement('button');
      button.className = 'action-button';
      button.dataset.action = action.type;
      button.textContent = action.name;

      button.addEventListener('click', () => {
        console.log('Basic action button clicked:', action.name);

        if (action.type === 'attack') {
          // Find an enemy to attack
          const enemies = this.combatState.participants.filter(p => p.type === 'npc' && p.stats.health > 0);
          if (enemies.length > 0) {
            const target = enemies[0];
            this.combatManager.attack(target.id);
          }
        } else if (action.type === 'defend') {
          this.combatManager.defend();
        }
      });

      this.elements.actionBar.appendChild(button);
    });
  }

  // Modify initializeCombat to use the failsafe if needed
  initializeCombat(combatState) {
    // Store the combat state
    this.combatState = combatState;

    // Update header
    this.elements.header.innerHTML = `
    <h2>Combat</h2>
  `;

    // Render participants
    this.renderParticipants(combatState.participants);

    // Clear log
    this.elements.log.innerHTML = '';
    this.addLogMessage('Combat started!');

    // Show actions after a short delay to ensure everything is set up
    setTimeout(() => {
      // Try to show regular actions
      this.showActions();

      // If no actions were displayed, show the basic actions as failsafe
      if (this.elements.actionBar.children.length === 0 ||
        (this.elements.actionBar.children.length === 1 &&
          this.elements.actionBar.querySelector('.no-actions-message'))) {
        console.log('No actions displayed, showing basic actions as fallback');
        this.showBasicActions();
      }

      this.updateActionPoints();
    }, 500);
  }

  actionComplete(data) {
    console.log('Action completed, updating UI');

    // Clear the "processing" message
    if (this.elements.actionBar.querySelector('.waiting-message')) {
      // Show available actions again
      this.showActions();
    }
  }

  showTargetSelection(action, targets) {
    // Add "select target" message
    const selectionMsg = document.createElement('div');
    selectionMsg.className = 'selection-message';
    selectionMsg.textContent = `Select a target for ${action.name}:`;
    this.elements.actionBar.innerHTML = '';
    this.elements.actionBar.appendChild(selectionMsg);

    // Add cancel button
    const cancelButton = document.createElement('button');
    cancelButton.className = 'cancel-button';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
      this.showActions({ participant: this.combatManager.getLocalPlayer() });
    });
    this.elements.actionBar.appendChild(cancelButton);

    // Highlight valid target cards
    const cards = this.container.querySelectorAll('.participant-card');
    cards.forEach(card => {
      card.classList.remove('valid-target');

      const isValidTarget = targets.some(target => target.id === card.dataset.id);
      if (isValidTarget) {
        card.classList.add('valid-target');

        // Add click event for target selection
        const onClick = () => {
          this.executeAction(action, card.dataset.id);
          cards.forEach(c => {
            c.classList.remove('valid-target');
            c.removeEventListener('click', onClick);
          });
        };

        card.addEventListener('click', onClick);
      }
    });
  }

  // In public/js/CombatUI.js, update executeAction method:

  executeAction(action, targetId) {
    console.log('Executing action:', action.type, 'on target:', targetId);

    // Track this action to prevent double-clicks
    this.currentAction = {
      type: action.type,
      targetId: targetId,
      timestamp: Date.now()
    };

    // Show waiting message after action
    this.elements.actionBar.innerHTML = '<div class="waiting-message">Processing action...</div>';

    // Set a safety timeout to reset the UI if no response comes back
    this.actionTimeout = setTimeout(() => {
      console.log('Action timeout - resetting UI');
      this.showActions();
    }, 5000); // 5 second safety timeout

    // Execute the action based on type
    let actionSuccess = false;
    switch (action.type) {
      case 'attack':
        actionSuccess = this.combatManager.attack(targetId);
        break;

      case 'defend':
        actionSuccess = this.combatManager.defend();
        break;

      case 'cast':
        actionSuccess = this.combatManager.cast(targetId, {
          spellId: action.id,
          manaCost: action.energyCost
        });
        break;
    }

    // If action failed on client side, show actions again immediately
    if (!actionSuccess) {
      console.log('Action failed client-side validation - resetting UI');
      clearTimeout(this.actionTimeout);
      this.showActions();
    }
  }

  showCombatResults(results) {
    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'combat-results';

    // Show winner
    const winner = results.winner === 'players' ? 'Players' : 'Enemies';
    resultsContainer.innerHTML = `
        <h2>${winner} Win!</h2>
        <div class="combat-stats">
          <p>Combat duration: ${Math.floor((results.combat.endTime - results.combat.startTime) / 1000)} seconds</p>
          <p>Total turns: ${results.combat.turn}</p>
        </div>
      `;

    // Clear action bar and add results
    this.elements.actionBar.innerHTML = '';
    this.elements.actionBar.appendChild(resultsContainer);

    // Add message to log
    this.addLogMessage(`Combat ended. ${winner} are victorious!`);
  }

  reset() {
    // Clear action points update interval
    if (this.actionPointsInterval) {
      clearInterval(this.actionPointsInterval);
    }

    // Clear any pending action timeout
    if (this.actionTimeout) {
      clearTimeout(this.actionTimeout);
      this.actionTimeout = null;
    }

    // Reset UI elements
    this.createUIElements();
  }
}