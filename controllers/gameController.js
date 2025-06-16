const  Game = require('../models/Game');
const User = require('../models/User');
const Table = require('../models/Table');
const { createDeck, dealCards, calculateHandScore, removeCardById, needsReshuffle, reshuffleDeck } = require('../utils/cards');
const { canPlayerDrop, calculateWinningMultiplier, wouldHitSpread, applyHitPenalties, isValidMove } = require('../utils/gameRules');
const { decideDrawSource, decideCardToDiscard, shouldDrop, getAIPersonality, getAIThinkingTime } = require('../utils/ai');
const { emitGameUpdate, emitLobbyUpdate } = require('../utils/socketHelpers');

// @route   POST /api/games
// @desc    Create a new game
// @access  Private
exports.createGame = async (req, res) => {
  try {
    const { stake } = req.body;
    
    // Validate stake
    if (!stake || typeof stake !== 'number' || stake <= 0) {
      return res.status(400).json({ error: 'Valid stake amount required' });
    }
    
    // Check if user has sufficient balance
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.balance < stake) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Deduct stake from user's balance
    user.balance -= stake;
    await user.save();
    
    // Create a new deck
    const deck = createDeck();
    
    // Set up players (1 human + 3 AI)
    const players = [
      {
        id: user._id.toString(),
        username: user.username,
        isAI: false,
        hand: [],
        isDropped: false,
        canDrop: false,
        score: 0,
        penalties: 0,
        hitCount: 0,
        avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0D8ABC&color=fff`
      }
    ];
    
    // Add AI players with different personalities
    for (let i = 0; i < 3; i++) {
      const personality = getAIPersonality(`ai-${i + 1}`);
      players.push({
        id: `ai-${i + 1}`,
        username: `${personality.name} AI`,
        isAI: true,
        hand: [],
        isDropped: false,
        canDrop: false,
        score: 0,
        penalties: 0,
        hitCount: 0,
        avatar: `https://ui-avatars.com/api/?name=AI&background=777777&color=fff`
      });
    }
    
    // Deal cards to players
    const { hands, deck: remainingDeck } = dealCards(deck, 4);
    
    // Assign hands to players
    for (let i = 0; i < players.length; i++) {
      players[i].hand = hands[i];
      players[i].score = calculateHandScore(players[i].hand);
    }
    
    // Create discard pile with top card from deck
    const discardPile = [remainingDeck.pop()];
    
    // Create new game
    const game = new Game({
      players,
      currentPlayerIndex: 0, // Human player goes first
      deck: remainingDeck,
      discardPile,
      status: 'playing',
      stake,
      pot: stake * 4,
      gameStarted: true,
      turnStartTime: Date.now()
    });
    
    // Check if players can drop on first turn
    for (let i = 0; i < players.length; i++) {
      players[i].canDrop = canPlayerDrop(players[i], true);
    }
    
    await game.save();
    
    // Find and update the table with appropriate stake
    const table = await Table.findOne({ amount: stake });
    if (table) {
      table.currentPlayers += 1;
      table.activeGames.push(game._id);
      await table.save();
    }
    
    // Emit lobby update
    emitLobbyUpdate();
    
    res.json(sanitizeGameForPlayer(game, user._id.toString()));
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Server error creating game' });
  }
};

// @route   GET /api/games/:id
// @desc    Get game by ID
// @access  Private
exports.getGameById = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Check if user is part of this game
    const userId = req.user.id;
    const isPlayer = game.players.some(p => p.id === userId);
    
    if (!isPlayer) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(sanitizeGameForPlayer(game, userId));
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Server error getting game' });
  }
};

// @route   POST /api/games/:id/join
// @desc    Join an existing game
// @access  Private
exports.joinGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.status !== 'waiting') {
      return res.status(400).json({ error: 'Game has already started' });
    }
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.balance < game.stake) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Check if user is already in the game
    const existingPlayerIndex = game.players.findIndex(p => p.id === user._id.toString());
    
    if (existingPlayerIndex !== -1) {
      return res.json(sanitizeGameForPlayer(game, user._id.toString()));
    }
    
    // Check if game is full
    if (game.players.filter(p => !p.isAI).length >= 4) {
      return res.status(400).json({ error: 'Game is full' });
    }
    
    // Find an AI player to replace
    const aiPlayerIndex = game.players.findIndex(p => p.isAI);
    
    if (aiPlayerIndex === -1) {
      return res.status(400).json({ error: 'No AI player to replace' });
    }
    
    // Deduct stake from user's balance
    user.balance -= game.stake;
    await user.save();
    
    // Replace AI player with human player
    game.players[aiPlayerIndex] = {
      id: user._id.toString(),
      username: user.username,
      isAI: false,
      hand: game.players[aiPlayerIndex].hand,
      isDropped: false,
      canDrop: canPlayerDrop(game.players[aiPlayerIndex], false),
      score: calculateHandScore(game.players[aiPlayerIndex].hand),
      penalties: 0,
      hitCount: 0,
      avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0D8ABC&color=fff`
    };
    
    await game.save();
    
    // Emit game update to all players
    emitGameUpdate(game._id.toString(), game);
    
    res.json(sanitizeGameForPlayer(game, user._id.toString()));
  } catch (error) {
    console.error('Join game error:', error);
    res.status(500).json({ error: 'Server error joining game' });
  }
};

// @route   POST /api/games/:id/action
// @desc    Perform a game action (draw, discard, drop, spread)
// @access  Private
exports.performAction = async (req, res) => {
  try {
    const { action, cardId, cardIds, source } = req.body;
    const userId = req.user.id;
    
    const game = await Game.findById(req.params.id);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.status !== 'playing') {
      return res.status(400).json({ error: 'Game is not in progress' });
    }
    
    // Find player index
    const playerIndex = game.players.findIndex(p => p.id === userId);
    
    if (playerIndex === -1) {
      return res.status(400).json({ error: 'Not a player in this game' });
    }
    
    // Validate move
    const validation = isValidMove(game, userId, action, { cardId, cardIds, source });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Get current player
    const currentPlayer = game.players[playerIndex];
    
    let updatedGame;
    
    // Process action
    switch (action) {
      case 'draw':
        updatedGame = await handleDraw(game, playerIndex, source === 'discard');
        break;
      
      case 'discard':
        updatedGame = await handleDiscard(game, playerIndex, cardId);
        break;
      
      case 'drop':
        updatedGame = await handleDrop(game, playerIndex);
        break;
      
      case 'spread':
        updatedGame = await handleSpread(game, playerIndex, cardIds);
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Process AI turns if game is still in progress
    if (updatedGame.status === 'playing') {
      updatedGame = await processAITurns(updatedGame);
    }
    
    // Save the updated game
    await updatedGame.save();
    
    // Emit game update to all players in the room
    emitGameUpdate(game._id.toString(), updatedGame);
    
    res.json(sanitizeGameForPlayer(updatedGame, userId));
  } catch (error) {
    console.error('Perform action error:', error);
    res.status(500).json({ error: error.message || 'Server error performing action' });
  }
};

// Helper function to handle draw action
async function handleDraw(game, playerIndex, fromDiscard) {
  const player = game.players[playerIndex];
  let drawnCard;
  
  // Check draw source
  if (fromDiscard) {
    // Drawing from discard pile
    if (game.discardPile.length === 0) {
      throw new Error('Discard pile is empty');
    }
    
    drawnCard = game.discardPile.shift();
    player.hand.push(drawnCard);
  } else {
    // Drawing from deck
    if (needsReshuffle(game.deck, game.discardPile)) {
      const reshuffled = reshuffleDeck(game.deck, game.discardPile);
      game.deck = reshuffled.deck;
      game.discardPile = reshuffled.discardPile;
    }
    
    if (game.deck.length === 0) {
      throw new Error('No cards available to draw');
    }
    
    drawnCard = game.deck.pop();
    player.hand.push(drawnCard);
  }
  
  // Apply hit penalties if drawing from deck
  if (!fromDiscard) {
    const penalties = applyHitPenalties(game, drawnCard, player.id);
    
    // Log penalties for game state
    if (penalties.length > 0) {
      game.lastAction = {
        type: 'penalties',
        player: player.id,
        penalties: penalties,
        timestamp: Date.now()
      };
    }
  }
  
  // Update player state
  player.score = calculateHandScore(player.hand);
  player.canDrop = canPlayerDrop(player, false);
  player.hasDrawn = true;
  
  // Update game state
  game.turnStartTime = Date.now();
  game.lastActionAt = Date.now();
  
  return game;
}

// Helper function to handle discard action
async function handleDiscard(game, playerIndex, cardId) {
  const player = game.players[playerIndex];
  
  // Find and remove the card from player's hand
  const cardIndex = player.hand.findIndex(card => card.id === cardId);
  
  if (cardIndex === -1) {
    throw new Error('Card not found in hand');
  }
  
  // Remove card from hand and add to discard pile
  const card = player.hand.splice(cardIndex, 1)[0];
  game.discardPile.unshift(card);
  
  // Update player state
  player.score = calculateHandScore(player.hand);
  player.canDrop = canPlayerDrop(player, false);
  player.hasDrawn = false;
  
  // Decrement penalties for all players
  game.players.forEach(p => {
    if (p.penalties > 0) {
      p.penalties -= 1;
    }
    p.canDrop = canPlayerDrop(p, false);
  });
  
  // Move to next player
  game.currentPlayerIndex = getNextActivePlayer(game, playerIndex);
  game.turnStartTime = Date.now();
  game.lastActionAt = Date.now();
  
  // Record action
  game.lastAction = {
    type: 'discard',
    player: player.id,
    card: card,
    timestamp: Date.now()
  };
  
  return game;
}

// Helper function to handle drop action
async function handleDrop(game, playerIndex) {
  const player = game.players[playerIndex];
  
  // Calculate score and check for special conditions
  const score = calculateHandScore(player.hand);
  const isFirstTurn = game.players.every(p => !p.isDropped || p.id === player.id);
  const multiplier = calculateWinningMultiplier(score, isFirstTurn);
  
  // Update player state
  player.score = score;
  player.isDropped = true;
  player.dropTime = Date.now();
  
  // Record action
  game.lastAction = {
    type: 'drop',
    player: player.id,
    score: score,
    multiplier: multiplier,
    timestamp: Date.now()
  };
  
  // Check if game is over
  const activePlayers = game.players.filter(p => !p.isDropped);
  
  if (activePlayers.length <= 1) {
    // Game over - determine winner
    await endGame(game, player.id, multiplier);
  } else {
    // Game continues - move to next player
    game.currentPlayerIndex = getNextActivePlayer(game, playerIndex);
    game.turnStartTime = Date.now();
  }
  
  game.lastActionAt = Date.now();
  
  return game;
}

// Helper function to handle spread action (for future implementation)
async function handleSpread(game, playerIndex, cardIds) {
  const player = game.players[playerIndex];
  
  // This is a placeholder for spread functionality
  // In the current Tonk implementation, spreads are not typically played during the game
  // They are mainly used for scoring when dropping
  
  throw new Error('Spread action not implemented in this version');
}

// Helper function to get next active player
function getNextActivePlayer(game, currentPlayerIndex) {
  let nextIndex = (currentPlayerIndex + 1) % game.players.length;
  
  // Skip players who have dropped
  while (game.players[nextIndex].isDropped) {
    nextIndex = (nextIndex + 1) % game.players.length;
    
    // Prevent infinite loop
    if (nextIndex === currentPlayerIndex) {
      break;
    }
  }
  
  return nextIndex;
}

// Helper function to end the game
async function endGame(game, winnerId, multiplier = 1) {
  game.status = 'ended';
  game.winner = winnerId;
  game.winningMultiplier = multiplier;
  game.endTime = Date.now();
  
  // Calculate winnings
  const winnings = game.pot * multiplier;
  
  // Update winner's balance if human player
  if (!winnerId.startsWith('ai-')) {
    const user = await User.findById(winnerId);
    
    if (user) {
      user.balance += winnings;
      user.gamesWon += 1;
      user.totalWinnings = (user.totalWinnings || 0) + winnings;
      await user.save();
    }
  }
  
  // Update stats for all human players
  for (const player of game.players) {
    if (!player.id.startsWith('ai-')) {
      const user = await User.findById(player.id);
      
      if (user) {
        user.gamesPlayed += 1;
        user.totalWagered = (user.totalWagered || 0) + game.stake;
        await user.save();
      }
    }
  }
  
  // Update table
  const table = await Table.findOne({ amount: game.stake });
  if (table) {
    table.currentPlayers = Math.max(0, table.currentPlayers - 1);
    table.activeGames = table.activeGames.filter(gameId => gameId.toString() !== game._id.toString());
    await table.save();
  }
  
  // Emit lobby update
  emitLobbyUpdate();
  
  return game;
}

// Process AI turns with realistic timing
async function processAITurns(game) {
  let currentPlayerIndex = game.currentPlayerIndex;
  let maxAITurns = 10; // Prevent infinite loops
  
  while (game.status === 'playing' && game.players[currentPlayerIndex].isAI && maxAITurns > 0) {
    maxAITurns--;
    
    const aiPlayer = game.players[currentPlayerIndex];
    
    // Skip if AI player is dropped
    if (aiPlayer.isDropped) {
      currentPlayerIndex = getNextActivePlayer(game, currentPlayerIndex);
      continue;
    }
    
    // Get AI personality for decision making
    const personality = getAIPersonality(aiPlayer.id);
    
    // AI decides whether to draw from deck or discard
    const drawSource = decideDrawSource(game, aiPlayer, personality.difficulty);
    
    // Simulate thinking time
    const thinkTime = getAIThinkingTime(personality.difficulty, 'draw');
    await new Promise(resolve => setTimeout(resolve, Math.min(thinkTime, 1000))); // Cap at 1 second for responsiveness
    
    // Draw card
    await handleDraw(game, currentPlayerIndex, drawSource === 'discard');
    
    // AI decides what to discard
    const cardToDiscard = decideCardToDiscard(aiPlayer.hand, game, personality.difficulty);
    
    if (!cardToDiscard) {
      // Fallback: discard highest value card
      const sortedCards = [...aiPlayer.hand].sort((a, b) => b.value - a.value);
      cardToDiscard = sortedCards[0]?.id;
    }
    
    if (cardToDiscard) {
      await handleDiscard(game, currentPlayerIndex, cardToDiscard);
    }
    
    // Check if AI should drop after discard
    if (aiPlayer.canDrop && shouldDrop(aiPlayer, game, personality.difficulty)) {
      const dropThinkTime = getAIThinkingTime(personality.difficulty, 'drop');
      await new Promise(resolve => setTimeout(resolve, Math.min(dropThinkTime, 500)));
      
      await handleDrop(game, currentPlayerIndex);
      break; // AI dropped, no need to continue processing
    }
    
    // Move to next player
    currentPlayerIndex = game.currentPlayerIndex;
    
    // Safety check for all AI games
    const activeNonAI = game.players.filter(p => !p.isAI && !p.isDropped);
    if (activeNonAI.length === 0) {
      // All human players dropped, end game with last AI
      const lastActiveAI = game.players.find(p => p.isAI && !p.isDropped);
      if (lastActiveAI) {
        const aiIndex = game.players.indexOf(lastActiveAI);
        await handleDrop(game, aiIndex);
      }
      break;
    }
  }
  
  return game;
}

// Sanitize game data for specific player (hide other players' cards)
function sanitizeGameForPlayer(game, playerId) {
  const gameData = game.toObject();
  
  gameData.players = gameData.players.map(player => {
    if (player.id !== playerId && !player.isDropped) {
      // Hide other players' cards
      return {
        ...player,
        hand: player.hand.map(card => ({
          id: card.id,
          suit: '?',
          rank: '?',
          value: 0,
          isHidden: true
        }))
      };
    }
    return player;
  });
  
  return gameData;
}

module.exports = {
  createGame: exports.createGame,
  getGameById: exports.getGameById,
  joinGame: exports.joinGame,
  performAction: exports.performAction
};
 