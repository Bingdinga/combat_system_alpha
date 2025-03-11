// Import necessary modules
import { Socket } from './Socket.js';
import { CombatManager } from './CombatManager.js';
import { CombatUI } from './CombatUI.js';
import { Player, Enemy } from './Entities.js';

// Initialize the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Element references
  // const joinForm = document.getElementById('joinForm');
  const usernameInput = document.getElementById('usernameInput');
  const roomIdInput = document.getElementById('roomIdInput');
  const gameContainer = document.getElementById('gameContainer');
  const playerListElement = document.getElementById('playerList');
  const startCombatBtn = document.getElementById('startCombatBtn');
  const combatContainer = document.getElementById('combatContainer');

  window.io = io || {}; // Make sure io is defined
  console.log('Socket.io available:', !!window.io);

  // Initialize socket connection
  const socket = new Socket();

  // Initialize combat manager
  const combatManager = new CombatManager(socket);

  // Initialize combat UI
  const combatUI = new CombatUI(combatContainer, combatManager);

  // Update the form reference and event listener in main.js
  const joinForm = document.getElementById('roomJoinForm');
  console.log('Join form element found:', joinForm);

  joinForm.addEventListener('submit', function (e) {
    e.preventDefault();
    console.log('Join form submitted');

    const username = usernameInput.value.trim();
    const roomId = roomIdInput.value.trim();

    console.log('Username:', username, 'Room ID:', roomId);

    if (!username || !roomId) {
      alert('Please enter both username and room ID');
      return;
    }

    // Join the room
    socket.emit('join', { username, roomId });
    console.log('Join event emitted');

    // Show game container and hide join form
    document.getElementById('joinForm').classList.add('hidden');
    gameContainer.classList.remove('hidden');

    // Update UI header
    document.getElementById('roomHeader').textContent = `Room: ${roomId}`;
    document.getElementById('playerName').textContent = `Player: ${username}`;
  });



  // Listen for player updates
  socket.on('playerJoined', (data) => {
    updatePlayerList(data.players);
  });

  socket.on('playerLeft', (data) => {
    updatePlayerList(data.players);
  });

  // Update player list in UI
  function updatePlayerList(players) {
    playerListElement.innerHTML = '';

    players.forEach(player => {
      const playerItem = document.createElement('div');
      playerItem.classList.add('player-item');
      playerItem.dataset.playerId = player.id;

      playerItem.innerHTML = `
        <span class="player-name">${player.username}</span>
        <span class="player-status ${player.isReady ? 'ready' : 'not-ready'}">
          ${player.isReady ? 'Ready' : 'Not Ready'}
        </span>
      `;

      playerListElement.appendChild(playerItem);
    });

    // Only show start combat button if there are at least 2 players
    startCombatBtn.disabled = players.length < 2;
  }

  // Handle start combat button
  startCombatBtn.addEventListener('click', () => {
    // Create a sample enemy for testing
    const enemy = new Enemy({
      name: 'Test Enemy',
      stats: {
        health: 100,
        maxHealth: 100,
        energy: 30,
        maxEnergy: 30
      }
    });

    // Initiate combat with the test enemy
    socket.emit('initiateCombat', {
      targets: [{
        type: 'npc',
        name: enemy.name,
        stats: enemy.stats
      }]
    });
  });

  // Listen for combat events
  socket.on('combatStarted', (data) => {
    console.log('Combat started:', data);
    gameContainer.classList.add('hidden');
    combatContainer.classList.remove('hidden');

    // Initialize combat UI with combat data
    combatUI.initializeCombat(data);
  });

  socket.on('combatUpdate', (data) => {
    console.log('Combat update:', data);
    combatUI.updateCombatState(data);
  });

  socket.on('turnChange', (data) => {
    console.log('Turn change:', data);
    combatUI.updateTurn(data);
  });

  socket.on('combatEnded', (data) => {
    console.log('Combat ended:', data);
    combatUI.showCombatResults(data);

    // Show return to lobby button
    const returnBtn = document.createElement('button');
    returnBtn.textContent = 'Return to Lobby';
    returnBtn.classList.add('return-btn');
    returnBtn.addEventListener('click', () => {
      combatContainer.classList.add('hidden');
      gameContainer.classList.remove('hidden');

      // Clean up combat UI
      combatUI.reset();

      // Remove return button
      returnBtn.remove();
    });

    combatContainer.appendChild(returnBtn);
  });

  socket.on('combatError', (data) => {
    console.error('Combat error:', data);
    alert(`Combat error: ${data.message}`);
  });
});