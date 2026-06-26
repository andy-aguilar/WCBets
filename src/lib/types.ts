export type MarketSide = "home" | "away" | "draw";

export interface ModelImpliedOdds {
  home: number;
  away: number;
  draw: number;
}

export interface ModelPercentages {
  home: number;
  away: number;
  draw: number;
}

export interface BestMarketOdds {
  home_odds: number | null;
  home_bookmaker: string | null;
  away_odds: number | null;
  away_bookmaker: string | null;
  draw_odds: number | null;
  draw_bookmaker: string | null;
}

export interface MarketOffer {
  bookmaker: string;
  title: string;
  odds: number;
}

export interface AllMarketOdds {
  home: MarketOffer[];
  away: MarketOffer[];
  draw: MarketOffer[];
}

export interface BettingGame {
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  home_field: boolean;
  predicted_score: string;
  home_xg: number;
  away_xg: number;
  model_implied_odds: ModelImpliedOdds;
  model_pct: ModelPercentages;
  best_market_odds: BestMarketOdds | null;
  all_market_odds: AllMarketOdds | null;
  incentive_note: string | null;
}

export interface CompiledDataset {
  last_updated: string;
  games: BettingGame[];
}

export interface EcuadorStanding {
  team: string;
  group: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export interface EcuadorGroupMatch {
  id: string;
  group: string;
  heading: string;
  home_team: string;
  away_team: string;
  date_text: string;
  time_text: string;
  venue: string;
  city: string;
  raw: string;
  played: boolean;
  home_score: number | null;
  away_score: number | null;
}

export interface EcuadorGroupData {
  group: string;
  teams: string[];
  matches: EcuadorGroupMatch[];
}

export interface EcuadorRoundOf32Slot {
  slot: string;
  slot_meta: {
    position: string;
    group: string;
  };
  source: string;
  fixed_opponent_slot: string | null;
  heading: string;
  reference_title: string;
  match_index: number;
  date_text: string;
  time_text: string;
  venue: string;
  city: string;
  raw: string;
  played: boolean;
  home_score: number | null;
  away_score: number | null;
}

export interface EcuadorPathDataset {
  generated_at: string;
  source: {
    groups: Record<string, string>;
    round_of_32: string;
  };
  groups: Record<string, EcuadorGroupData>;
  current_standings: Record<string, EcuadorStanding[]>;
  round_of_32: Record<string, EcuadorRoundOf32Slot>;
}
