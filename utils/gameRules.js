const  { isValidSpread, calculateHandScore } = require('./cards');

// Check if a player can drop based on game rules
function canPlayerDrop(player, isFirstTurn = false) {
  // Player with penalties cannot drop
  if (player.penalties > 0) {
    return false;
  }
  
  // Calculate hand score
  const score = calculateHandScore(player.hand);
  
  // Special case: 11 or under is always droppable (triple payout)
  if (score <= 11) {
    return true;
  }
  
  // First turn rule: 41 or less is droppable (triple payout if exactly 41)
  if (isFirstTurn && score <= 41) {
    return true;
  }
  
  // Regular case: 50 or less is droppable
  return score <= 50;
}

// Calculate winning multiplier based on score and conditions
function calculateWinningMultiplier(score, isFirstTurn = false) {
  // Triple payout: 11 and under
  if (score <= 11) {
    return 3;
  }
  
  // Triple payout: exactly 41 on first turn
  if (isFirstTurn && score === 41) {
    return 3;
  }
  
  // Double payout: exactly 50
  if (score === 50) {
    return 2;
  }
  
  // Regular payout
  return 1;
}

// Check if adding a card would hit an existing spread
function wouldHitSpread(card, targetPlayer, allPlayers) {
  // Check all players' spreads for potential hits
  for (const player of allPlayers) {
    if (player.id === targetPlayer.id) continue;
    
    // Check existing spreads (groups of 3+ cards of same rank or sequential same suit)
    const spreads = findExistingSpreads(player.hand);
    
    for (const spread of spreads) {
      if (cardHitsSpread(card, spread)) {
        return { hit: true, playerId: player.id, spread };
      }
    }
  }
  
  return { hit: false };
}

// Find existing spreads in a hand
function findExistingSpreads(hand) {
  const spreads = [];
  const used = new Set();
  
  // Find sets (same rank)
  const rankGroups = {};
  hand.forEach((card, index) => {
    if (!rankGroups[card.rank]) rankGroups[card.rank] = [];
    rankGroups[card.rank].push({ card, index });
  });
  
  Object.values(rankGroups).forEach(group => {
    if (group.length >= 3) {
      spreads.push({
        type: 'set',
        cards: group.map(g => g.card),
        indices: group.map(g => g.index)
      });
      group.forEach(g => used.add(g.index));
    }
  });
  
  // Find runs (sequential same suit)
  const suitGroups = {};
  hand.forEach((card, index) => {
    if (used.has(index)) return;
    if (!suitGroups[card.suit]) suitGroups[card.suit] = [];
    suitGroups[card.suit].push({ card, index });
  });
  
  Object.values(suitGroups).forEach(group => {
    if (group.length >= 3) {
      // Sort by value
      group.sort((a, b) => a.card.value - b.card.value);
      
      // Find consecutive sequences
      let currentRun = [group[0]];
      
      for (let i = 1; i < group.length; i++) {
        if (group[i].card.value === currentRun[currentRun.length - 1].card.value + 1) {
          currentRun.push(group[i]);
        } else {
          if (currentRun.length >= 3) {
            spreads.push({
              type: 'run',
              cards: currentRun.map(r => r.card),
              indices: currentRun.map(r => r.index)
            });
          }
          currentRun = [group[i]];
        }
      }
      
      if (currentRun.length >= 3) {
        spreads.push({
          type: 'run',
          cards: currentRun.map(r => r.card),
          indices: currentRun.map(r => r.index)
        });
      }
    }
  });
  
  return spreads;
}

// Check if a card would hit a specific spread
function cardHitsSpread(card, spread) {
  if (spread.type === 'set') {
    // Card hits set if same rank
    return card.rank === spread.cards[0].rank;
  } else if (spread.type === 'run') {
    // Card hits run if same suit and extends the sequence
    const sameSuit = card.suit === spread.cards[0].suit;
    if (!sameSuit) return false;
    
    const values = spread.cards.map(c => c.value).sort((a, b) => a - b);
    const minValue = values[0];
    const maxValue = values[values.length - 1];
    
    // Check if card extends the run at either end
    return card.value === minValue - 1 || card.value === maxValue + 1;
  }
  
  return false;
}

// Apply penalties for hitting spreads
function applyHitPenalties(game, card, playerId) {
  const penalties = [];
  
  game.players.forEach(player => {
    if (player.id === playerId) return;
    
    const hitResult = wouldHitSpread(card, player, game.players);
    if (hitResult.hit) {
      // Apply penalty: prevent dropping for 2 turns for first hit, +1 turn for each additional hit
      const basePenalty = 2;
      const additionalPenalty = player.hitCount || 0;
      player.penalties = basePenalty + additionalPenalty;
      player.hitCount = (player.hitCount || 0) + 1;
      
      penalties.push({
        playerId: player.id,
        penaltyTurns: player.penalties,
        hitSpread: hitResult.spread
      });
    }
  });
  
  return penalties;
}

// Check for valid spreads that can be played from hand
function findPlayableSpreads(hand) {
  const playableSpreads = [];
  
  // Check all combinations of 3 or more cards
  for (let size = 3; size <= hand.length; size++) {
    const combinations = getCombinations(hand, size);
    
    combinations.forEach(combo => {
      if (isValidSpread(combo)) {
        playableSpreads.push({
          cards: combo,
          type: combo.every(c => c.rank === combo[0].rank) ? 'set' : 'run',
          score: combo.reduce((sum, card) => sum + card.value, 0)
        });
      }
    });
  }
  
  return playableSpreads;
}

// Generate combinations of cards
function getCombinations(arr, size) {
  if (size === 1) return arr.map(item => [item]);
  if (size > arr.length) return [];
  
  const combinations = [];
  
  for (let i = 0; i <= arr.length - size; i++) {
    const smaller = getCombinations(arr.slice(i + 1), size - 1);
    smaller.forEach(combo => {
      combinations.push([arr[i], ...combo]);
    });
  }
  
  return combinations;
}

// Validate if a move is legal
function isValidMove(game, playerId, action, data = {}) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return { valid: false, error: 'Player not found' };
  
  if (player.isDropped) return { valid: false, error: 'Player already dropped' };
  
  if (game.currentPlayerIndex !== game.players.indexOf(player)) {
    return { valid: false, error: 'Not your turn' };
  }
  
  switch (action) {
    case 'draw':
      return validateDraw(game, player, data);
    case 'discard':
      return validateDiscard(game, player, data);
    case 'drop':
      return validateDrop(game, player, data);
    case 'spread':
      return validateSpread(game, player, data);
    default:
      return { valid: false, error: 'Invalid action' };
  }
}

function validateDraw(game, player, data) {
  const { source } = data;
  
  if (source === 'discard' && game.discardPile.length === 0) {
    return { valid: false, error: 'Discard pile is empty' };
  }
  
  if (source === 'deck' && game.deck.length === 0 && game.discardPile.length <= 1) {
    return { valid: false, error: 'No cards available to draw' };
  }
  
  return { valid: true };
}

function validateDiscard(game, player, data) {
  const { cardId } = data;
  
  if (!cardId) {
    return { valid: false, error: 'Card ID required' };
  }
  
  const cardExists = player.hand.some(card => card.id === cardId);
  if (!cardExists) {
    return { valid: false, error: 'Card not in hand' };
  }
  
  return { valid: true };
}

function validateDrop(game, player, data) {
  if (player.penalties > 0) {
    return { valid: false, error: `Cannot drop for ${player.penalties} more turns due to penalties` };
  }
  
  const score = calculateHandScore(player.hand);
  const isFirstTurn = game.players.every(p => !p.isDropped || p.id === player.id);
  
  if (!canPlayerDrop(player, isFirstTurn)) {
    return { valid: false, error: `Cannot drop with score ${score}` };
  }
  
  return { valid: true };
}

function validateSpread(game, player, data) {
  const { cardIds } = data;
  
  if (!cardIds || cardIds.length < 3) {
    return { valid: false, error: 'At least 3 cards required for spread' };
  }
  
  const cards = cardIds.map(id => player.hand.find(card => card.id === id));
  if (cards.some(card => !card)) {
    return { valid: false, error: 'One or more cards not in hand' };
  }
  
  if (!isValidSpread(cards)) {
    return { valid: false, error: 'Invalid spread combination' };
  }
  
  return { valid: true };
}

module.exports = {
  canPlayerDrop,
  calculateWinningMultiplier,
  wouldHitSpread,
  findExistingSpreads,
  applyHitPenalties,
  findPlayableSpreads,
  isValidMove,
  validateDraw,
  validateDiscard,
  validateDrop,
  validateSpread
};
 