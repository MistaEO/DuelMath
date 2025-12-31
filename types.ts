
export interface Card {
  id: number;
  name: string;
  type: string;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  race?: string;
  attribute?: string;
  card_images: {
    id: number;
    image_url: string;
    image_url_small: string;
  }[];
  banlist_info?: {
    ban_tcg?: string;
    ban_ocg?: string;
    ban_goat?: string;
  };
}

export interface DeckData {
  main: number[];
  extra: number[];
  side: number[];
}

export interface DeckAnalysis {
  mainDetails: Card[];
  extraDetails: Card[];
  sideDetails: Card[];
  counts: {
    main: number;
    extra: number;
    side: number;
  };
}

export interface TournamentReport {
  id: string;
  round: number;
  matchup: string;
  wonDiceRoll: boolean;
  result: 'win' | 'loss';
  notes: string;
  timestamp: number;
}

export interface TournamentMetadata {
  eventName: string;
  deckName: string;
  deckCounts?: {
    main: number;
    extra: number;
    side: number;
  };
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  CALCULATOR = 'CALCULATOR',
  SWISS_CALCULATOR = 'SWISS_CALCULATOR',
  HYPER_CALC = 'HYPER_CALC',
  DECK_BUILDER = 'DECK_BUILDER',
  TOURNAMENT_TRACKER = 'TOURNAMENT_TRACKER'
}
