const  { isValidSpread, calculateHandScore, sortCardsByValue } = require('./cards');
const { wouldHitSpread, findPlayableSpreads, canPlayerDrop } = require('./gameRules');

// AI difficulty levels
const AI_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

// AI decision making for drawing a card
function decideDrawSource(game, aiPlayer, difficulty = AI_DIFFICULTY.MEDIUM) {
  const discardPile = game.discardPile;
  
  // If discard pile is empty, draw from deck
  if (discardPile.length === 0) {
    return 'deck';
  }
  
  const topDiscard = discardPile[0];
  
  // Analyze the value of taking the discard card
  const drawValue = analyzeDiscardValue(aiPlayer.hand, topDiscard, game, difficulty);
  
  // Decision threshold based on difficulty
  const threshold = difficulty === AI_DIFFICULTY.EASY ? 0.3 : 
                   difficulty === AI_DIFFICULTY.MEDIUM ? 0.5 : 0.7;
  
  return drawValue > threshold ? 'discard' : 'deck';
}

// Analyze the value of taking a discard card
function analyzeDiscardValue(hand, card, game, difficulty) {
  let value = 0;
  
  // Check if card completes a spread
  const completesSpread = wouldCompleteSpread(hand, card);
  if (completesSpread) value += 0.8;
  
  // Check if card improves potential spreads
  const improvesSpread = wouldImproveSpread(hand, card);
  if (improvesSpread) value += 0.4;
  
  // Prefer low-value cards
  if (card.value <= 3) value += 0.3;
  else if (card.value >= 10) value -= 0.2;
  
  // Avoid cards that might help opponents (advanced AI only)
  if (difficulty === AI_DIFFICULTY.HARD) {
    const helpsOpponents = wouldHelpOpponents(card, game);
    if (helpsOpponents) value -= 0.3;
  }
  
  return Math.max(0, Math.min(1, value));
}

// Check if card would complete a spread
function wouldCompleteSpread(hand, card) {
  // Test all combinations of 2 cards from hand + the new card
  for (let i = 0; i < hand.length - 1; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (isValidSpread([hand[i], hand[j], card])) {
        return true;
      }
    }
  }
  return false;
}

// Check if card would improve potential spreads
function wouldImproveSpread(hand, card) {
  const currentSpreads = findPlayableSpreads(hand);
  const newHand = [...hand, card];
  const newSpreads = findPlayableSpreads(newHand);
  
  return newSpreads.length > currentSpreads.length || 
         newSpreads.some(spread => spread.cards.length > 3);
}

// Check if card would help opponents (advanced strategy)
function wouldHelpOpponents(card, game) {
  // This is a simplified check - in a full implementation,
  // we'd analyze what cards opponents might need
  return false;
}

// AI decision making for discarding a card
function decideCardToDiscard(hand, game, difficulty = AI_DIFFICULTY.MEDIUM) {
  if (hand.length === 0) return null;
  if (hand.length === 1) return hand[0].id;
  
  const candidates = analyzeDiscardCandidates(hand, game, difficulty);
  
  // Sort by discard priority (higher score = better to discard)
  candidates.sort((a, b) => b.priority - a.priority);
  
  return candidates[0]?.card.id || hand[0].id;
}

// Analyze which cards are good candidates for discarding
function analyzeDiscardCandidates(hand, game, difficulty) {
  return hand.map(card => {
    let priority = 0;
    
    // Higher value cards are generally better to discard
    priority += card.value * 0.1;
    
    // Avoid discarding cards that are part of potential spreads
    if (isPartOfPotentialSpread(card, hand)) {
      priority -= 0.5;
    }
    
    // Avoid discarding cards that could complete spreads
    if (couldCompleteSpread(card, hand)) {
      priority -= 0.7;
    }
    
    // Advanced AI considers what opponents might need
    if (difficulty === AI_DIFFICULTY.HARD) {
      if (mightHelpOpponents(card, game)) {
        priority -= 0.3;
      }
    }
    
    return { card, priority };
  });
}

// Check if a card is part of a potential spread
function isPartOfPotentialSpread(card, hand) {
  const otherCards = hand.filter(c => c.id !== card.id);
  
  // Check for same rank (potential set)
  const sameRank = otherCards.filter(c => c.rank === card.rank);
  if (sameRank.length >= 1) {
    return true;
  }
  
  // Check for sequential cards of same suit (potential run)
  const sameSuit = otherCards.filter(c => c.suit === card.suit);
  if (sameSuit.length >= 1) {
    for (const suitCard of sameSuit) {
      if (Math.abs(suitCard.value - card.value) <= 2) {
        return true;
      }
    }
  }
  
  return false;
}

// Check if removing a card would prevent completing spreads
function couldCompleteSpread(card, hand) {
  const withoutCard = hand.filter(c => c.id !== card.id);
  const currentSpreads = findPlayableSpreads(hand);
  const newSpreads = findPlayableSpreads(withoutCard);
  
  return currentSpreads.length > newSpreads.length;
}

// Check if discarding card might help opponents
function mightHelpOpponents(card, game) {
  // Simplified implementation - could be enhanced with opponent modeling
  return card.value <= 5; // Low cards are generally more useful
}

// Determine if AI should drop
function shouldDrop(aiPlayer, game, difficulty = AI_DIFFICULTY.MEDIUM) {
  // Can't drop with penalties
  if (aiPlayer.penalties > 0) {
    return false;
  }
  
  const score = calculateHandScore(aiPlayer.hand);
  const isFirstTurn = game.players.every(p => !p.isDropped || p.id === aiPlayer.id);
  
  // Check if dropping is even legal
  if (!canPlayerDrop(aiPlayer, isFirstTurn)) {
    return false;
  }
  
  // AI decision based on difficulty and game state
  return makeDropDecision(score, isFirstTurn, game, aiPlayer, difficulty);
}

// Make the drop decision based on various factors
function makeDropDecision(score, isFirstTurn, game, aiPlayer, difficulty) {
  // Always drop with triple payout conditions
  if (score <= 11) return true;
  if (isFirstTurn && score === 41) return true;
  
  // Always drop with double payout
  if (score === 50) return true;
  
  // Risk assessment based on difficulty
  const riskTolerance = getRiskTolerance(difficulty);
  const gameRisk = assessGameRisk(game, aiPlayer);
  
  // Conservative play for good scores
  if (score <= 20) return true;
  if (score <= 30 && gameRisk < riskTolerance) return true;
  if (score <= 40 && gameRisk < riskTolerance * 0.5) return true;
  
  // Risky situations - drop to avoid penalties
  if (gameRisk > riskTolerance * 1.5) return true;
  
  return false;
}

// Get risk tolerance based on AI difficulty
function getRiskTolerance(difficulty) {
  switch (difficulty) {
    case AI_DIFFICULTY.EASY: return 0.7;
    case AI_DIFFICULTY.HARD: return 0.3;
    default: return 0.5; // MEDIUM
  }
}

// Assess the risk level of the current game state
function assessGameRisk(game, aiPlayer) {
  let risk = 0;
  
  // Risk increases with more players who haven't dropped
  const activePlayers = game.players.filter(p => !p.isDropped);
  risk += (activePlayers.length - 1) * 0.1;
  
  // Risk increases if other players have few cards
  const otherPlayers = game.players.filter(p => p.id !== aiPlayer.id && !p.isDropped);
  otherPlayers.forEach(player => {
    if (player.hand.length <= 3) risk += 0.2;
    if (player.hand.length <= 2) risk += 0.3;
  });
  
  // Risk increases late in the game
  const totalCardsPlayed = game.players.reduce((sum, p) => sum + (5 - p.hand.length), 0);
  risk += totalCardsPlayed * 0.02;
  
  return Math.min(1, risk);
}

// AI decision for playing spreads (if implemented)
function shouldPlaySpread(aiPlayer, game, difficulty = AI_DIFFICULTY.MEDIUM) {
  const spreads = findPlayableSpreads(aiPlayer.hand);
  
  if (spreads.length === 0) return null;
  
  // For now, AI doesn't play spreads to keep game simple
  // This could be enhanced to play spreads strategically
  return null;
}

// Get AI player personality/difficulty
function getAIPersonality(aiId) {
  const personalities = {
    'ai-1': { difficulty: AI_DIFFICULTY.EASY, name: 'Rookie' },
    'ai-2': { difficulty: AI_DIFFICULTY.MEDIUM, name: 'Challenger' },
    'ai-3': { difficulty: AI_DIFFICULTY.HARD, name: 'Expert' }
  };
  
  return personalities[aiId] || { difficulty: AI_DIFFICULTY.MEDIUM, name: 'Player' };
}

// Simulate AI thinking time (for realism)
function getAIThinkingTime(difficulty, actionType) {
  const baseTimes = {
    [AI_DIFFICULTY.EASY]: { min: 500, max: 1500 },
    [AI_DIFFICULTY.MEDIUM]: { min: 800, max: 2500 },
    [AI_DIFFICULTY.HARD]: { min: 1200, max: 3500 },
  };
  
  const complexityMultiplier = {
    'draw': 1,
    'discard': 1.2,
    'drop': 1.5,
    'spread': 2
  };
  
  const timeRange = baseTimes[difficulty];
  const baseTime = Math.random() * (timeRange.max - timeRange.min) + timeRange.min;
  
  return Math.floor(baseTime * (complexityMultiplier[actionType] || 1));
}

module.exports = {
  decideDrawSource,
  decideCardToDiscard,
  shouldDrop,
  shouldPlaySpread,
  getAIPersonality,
  getAIThinkingTime,
  AI_DIFFICULTY
};
 
