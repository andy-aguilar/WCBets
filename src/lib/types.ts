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
