import { Card, DeckData, DeckAnalysis } from '../types';

const API_BASE = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const CACHE_KEY = 'duelmath_card_cache';
const CACHE_TIMESTAMP_KEY = 'duelmath_cache_time';
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours

// Helper to load cache from localStorage
const loadPersistentCache = (): Map<number, Card> => {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    const savedTime = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    
    if (saved && savedTime && Date.now() - parseInt(savedTime) < CACHE_EXPIRATION) {
      const parsed = JSON.parse(saved);
      return new Map(Object.entries(parsed).map(([id, card]) => [parseInt(id), card as Card]));
    }
  } catch (e) {
    console.warn("Failed to load persistent cache", e);
  }
  return new Map<number, Card>();
};

const cardCache = loadPersistentCache();

const savePersistentCache = () => {
  try {
    const obj = Object.fromEntries(cardCache.entries());
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (e) {
    console.warn("Failed to save persistent cache", e);
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      localStorage.clear(); 
    }
  }
};

export const searchCards = async (name: string): Promise<Card[]> => {
  if (name.length < 3) return [];
  try {
    const response = await fetch(`${API_BASE}?fname=${encodeURIComponent(name)}&misc=yes`);
    const data = await response.json();
    if (data.data) {
      // Seed cache with search results to prevent future fetches
      data.data.forEach((card: Card) => cardCache.set(card.id, card));
      savePersistentCache();
      return data.data.slice(0, 50); // Limit results for UI performance
    }
  } catch (error) {
    console.error("Search failed", error);
  }
  return [];
};

export const fetchCardData = async (ids: number[]): Promise<Card[]> => {
  const uniqueIds = Array.from(new Set(ids));
  const missingIds = uniqueIds.filter(id => !cardCache.has(id));

  if (missingIds.length > 0) {
    try {
      // Chunk size of 40 ensures most decks are fetched in 1-2 requests total
      const CHUNK_SIZE = 40;
      let newlyFetched = false;

      for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
        const chunk = missingIds.slice(i, i + CHUNK_SIZE);
        const url = `${API_BASE}?id=${chunk.join(',')}&misc=yes`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.data) {
          data.data.forEach((card: Card) => {
            cardCache.set(card.id, card);
          });
          newlyFetched = true;
        }
      }

      if (newlyFetched) {
        savePersistentCache();
      }
    } catch (error) {
      console.error("Failed to fetch card data", error);
    }
  }

  return ids.map(id => cardCache.get(id)).filter((c): c is Card => !!c);
};

export const parseYDK = (content: string): DeckData => {
  const lines = content.split('\n').map(l => l.trim());
  const deck: DeckData = { main: [], extra: [], side: [] };
  let currentSection: 'main' | 'extra' | 'side' | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('#main')) {
      currentSection = 'main';
      continue;
    }
    if (line.startsWith('#extra')) {
      currentSection = 'extra';
      continue;
    }
    if (line.startsWith('!side')) {
      currentSection = 'side';
      continue;
    }

    const id = parseInt(line, 10);
    if (!isNaN(id) && currentSection) {
      deck[currentSection].push(id);
    }
  }

  return deck;
};

export const analyzeDeck = async (deck: DeckData): Promise<DeckAnalysis> => {
  const mainCards = await fetchCardData(deck.main);
  const extraCards = await fetchCardData(deck.extra);
  const sideCards = await fetchCardData(deck.side);

  return {
    mainDetails: mainCards,
    extraDetails: extraCards,
    sideDetails: sideCards,
    counts: {
      main: deck.main.length,
      extra: deck.extra.length,
      side: deck.side.length
    }
  };
};