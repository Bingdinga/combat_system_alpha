export class CombatUI {
    constructor(container, combatManager) {
      this.container = container;
      this.combatManager = combatManager;
      this.elements = {};
      
      // Create UI elements
      this.createUIElements();
      
      // Listen for combat events
      this.setupEventListeners();
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
      
      this.container.appendChild(this.elements.header);
      this.container.appendChild(this.elements.battlefield);
      this.container.appendChild(this.elements.actionBar);
      this.container.appendChild(this.elements.logContainer);
    }
  
    setupEventListeners() {
      // Listen for combat events from the combat manager
      this.combatManager.addEventListener('combatInitialized', this.initializeCombat.bind(this));
      this.combatManager.addEventListener('combatUpdated', this.updateCombatState.bind(this));
      this.combatManager.addEventListener('turnUpdated', this.updateTurn.bind(this));
      this.combatManager.addEventListener('playerTurnStarted', this.showActions.bind(this));
      this.combatManager.addEventListener('combatEnded', this.showCombatResults.bind(this));
    }
  
    initializeCombat(combatState) {
      // Update header
      this.elements.header.innerHTML = `
        <h2>Combat</h2>
        <div class="turn-info">Turn: <span id="turnCounter">1</span></div>
      `;
      
      // Render participants
      this.renderParticipants(combatState.participants);
      
      // Show initial turn info
      this.updateTurn({
        turn: combatState.turn,
        participant: combatState.participants[combatState.currentParticipantIndex]
      });
      
      // Clear log
      this.elements.log.innerHTML = '';
      this.addLogMessage('Combat started!');
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
  
    createParticipantCard(participant) {
      const card = document.createElement('div');
      card.className = `participant-card ${participant.type}`;
      card.dataset.id = participant.id;
      
      const healthPercent = (participant.stats.health / participant.stats.maxHealth) * 100;
      const energyPercent = (participant.stats.energy / participant.stats.maxEnergy) * 100;
      
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
        <div class="status-effects">
          ${this.renderStatusEffects(participant)}
        </div>
      `;
      
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
  
    updateCombatState(combatState) {
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
        
        // Add defeated class if health is 0
        if (participant.stats.health <= 0) {
          card.classList.add('defeated');
        } else {
          card.classList.remove('defeated');
        }
      });
      
      // Update combat log
      this.updateCombatLog(combatState.log);
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
  
    showActions(turnData) {
      // Clear action bar
      this.elements.actionBar.innerHTML = '';
      
      // Get available actions
      const actions = this.combatManager.getAvailableActions();
      
      // Create action buttons
      actions.forEach(action => {
        const button = document.createElement('button');
        button.className = 'action-button';
        button.dataset.action = action.type;
        button.textContent = action.name;
        
        button.addEventListener('click', () => {
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
  
    executeAction(action, targetId) {
      // Execute the action based on type
      switch (action.type) {
        case 'attack':
          this.combatManager.attack(targetId);
          break;
          
        case 'defend':
          this.combatManager.defend();
          break;
          
        case 'cast':
          this.combatManager.cast(targetId, {
            spellId: action.id,
            manaCost: action.energyCost
          });
          break;
      }
      
      // Show waiting message after action
      this.elements.actionBar.innerHTML = '<div class="waiting-message">Processing action...</div>';
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
      // Reset UI elements
      this.createUIElements();
    }
  }