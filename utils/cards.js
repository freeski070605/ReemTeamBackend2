//  Deck creation and management functions for Tonk

// Create a deck for Tonk (standard deck minus 8s, 9s, and 10s)
function createDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
  const values = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 
    'J': 10, 'Q': 10, 'K': 10
  };
  
  let deck = [];
  let id = 0;
  
  for (let suit of suits) {
    for (let rank of ranks) {
      deck.push({
        id: `card-${id++}`,
        suit,
        rank,
        value: values[rank],
        isHidden: false
      });
    }
  }
  
  return shuffle(deck);
}

// Fisher-Yates shuffle algorithm
function shuffle(array) {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  let temporaryValue, randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    temporaryValue = shuffled[currentIndex];
    shuffled[currentIndex] = shuffled[randomIndex];
    shuffled[randomIndex] = temporaryValue;
  }

  return shuffled;
}

// Deal cards to players
function dealCards(deck, playerCount) {
  const hands = Array(playerCount).fill().map(() => []);
  const deckCopy = [...deck];
  
  // Deal 5 cards to each player
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < playerCount; j++) {
      if (deckCopy.length > 0) {
        hands[j].push(deckCopy.pop());
      }
    }
  }
  
  return { hands, deck: deckCopy };
}

// Check if a set of cards forms a valid spread
function isValidSpread(cards) {
  if (!cards || cards.length < 3) return false;
  
  // Remove any undefined or null cards
  const validCards = cards.filter(card => card && card.rank && card.suit);
  if (validCards.length < 3) return false;
  
  // Check if it's a set (same rank)
  const isSet = validCards.every(card => card.rank === validCards[0].rank);
  if (isSet) return true;
  
  // Check if it's a run (sequential cards of the same suit)
  const sameSuit = validCards.every(card => card.suit === validCards[0].suit);
  if (!sameSuit) return false;
  
  // Order by value for run validation
  const ordered = [...validCards].sort((a, b) => a.value - b.value);
  
  // Check if sequential (no duplicates allowed in runs)
  const values = ordered.map(card => card.value);
  const uniqueValues = [...new Set(values)];
  
  if (uniqueValues.length !== values.length) return false;
  
  // Check if consecutive
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].value !== ordered[i-1].value + 1) {
      return false;
    }
  }
  
  return true;
}

// Calculate hand score
function calculateHandScore(hand) {
  if (!hand || !Array.isArray(hand)) return 0;
  return hand.reduce((sum, card) => sum + (card?.value || 0), 0);
}

// Get card by ID from a collection
function findCardById(cards, cardId) {
  return cards.find(card => card.id === cardId);
}

// Remove card by ID from a collection
function removeCardById(cards, cardId) {
  const index = cards.findIndex(card => card.id === cardId);
  if (index !== -1) {
    return cards.splice(index, 1)[0];
  }
  return null;
}

// Validate card structure
function isValidCard(card) {
  if (!card || typeof card !== 'object') return false;
  
  const requiredFields = ['id', 'suit', 'rank', 'value'];
  return requiredFields.every(field => card.hasOwnProperty(field));
}

// Create a hidden version of a card (for security)
function hideCard(card) {
  if (!isValidCard(card)) return null;
  
  return {
    id: card.id,
    suit: '?',
    rank: '?',
    value: 0,
    isHidden: true
  };
}

// Sort cards by value
function sortCardsByValue(cards, ascending = true) {
  if (!Array.isArray(cards)) return [];
  
  return [...cards].sort((a, b) => {
    return ascending ? a.value - b.value : b.value - a.value;
  });
}

// Sort cards by suit then value
function sortCardsBySuit(cards) {
  if (!Array.isArray(cards)) return [];
  
  const suitOrder = { 'spades': 0, 'hearts': 1, 'diamonds': 2, 'clubs': 3 };
  
  return [...cards].sort((a, b) => {
    const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
    if (suitDiff !== 0) return suitDiff;
    return a.value - b.value;
  });
}

// Group cards by rank
function groupCardsByRank(cards) {
  if (!Array.isArray(cards)) return {};
  
  return cards.reduce((groups, card) => {
    if (!groups[card.rank]) groups[card.rank] = [];
    groups[card.rank].push(card);
    return groups;
  }, {});
}

// Group cards by suit
function groupCardsBySuit(cards) {
  if (!Array.isArray(cards)) return {};
  
  return cards.reduce((groups, card) => {
    if (!groups[card.suit]) groups[card.suit] = [];
    groups[card.suit].push(card);
    return groups;
  }, {});
}

// Check if deck needs reshuffling
function needsReshuffle(deck, discardPile, threshold = 5) {
  return deck.length <= threshold && discardPile.length > 1;
}

// Reshuffle discard pile into deck
function reshuffleDeck(deck, discardPile) {
  if (discardPile.length <= 1) {
    return { deck: [...deck], discardPile: [...discardPile] };
  }
  
  // Keep the top discard card
  const topDiscard = discardPile[0];
  const cardsToShuffle = discardPile.slice(1);
  
  // Add remaining deck cards and shuffle
  const newDeck = shuffle([...deck, ...cardsToShuffle]);
  
  return {
    deck: newDeck,
    discardPile: [topDiscard]
  };
}

module.exports = {
  createDeck,
  shuffle,
  dealCards,
  isValidSpread,
  calculateHandScore,
  findCardById,
  removeCardById,
  isValidCard,
  hideCard,
  sortCardsByValue,
  sortCardsBySuit,
  groupCardsByRank,
  groupCardsBySuit,
  needsReshuffle,
  reshuffleDeck
};
 