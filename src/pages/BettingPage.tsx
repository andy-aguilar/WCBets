import { compiledDataset } from "../data/compiledDataset";
import { formatAmericanOdds, formatBookmaker, formatEdge } from "../lib/odds";

export function BettingPage() {
  return (
    <main className="page-shell">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Betting dashboard</p>
          <h1>ATLAS Bets</h1>
          <p className="tagline">
            Real game data is now flowing through the React app. This is the
            first migration slice before we rebuild the full table interactions.
          </p>
        </div>
        <div className="hero-stats">
          <div className="status-item">
            <span className="status-label">Games loaded</span>
            <strong>{compiledDataset.games.length}</strong>
          </div>
          <div className="status-item">
            <span className="status-label">Updated</span>
            <strong>{compiledDataset.last_updated}</strong>
          </div>
        </div>
      </section>

      <section className="cards-grid">
        {compiledDataset.games.map((game) => (
          <article className="bet-card" key={game.game_id}>
            <div className="bet-card-top">
              <div>
                <p className="card-date">{game.date}</p>
                <h2>
                  {game.home_team} vs {game.away_team}
                </h2>
              </div>
              <div className="predicted-score">{game.predicted_score}</div>
            </div>

            <div className="xg-row">
              <span>Expected goals</span>
              <strong>
                {game.home_team} {game.home_xg.toFixed(1)} -{" "}
                {game.away_xg.toFixed(1)} {game.away_team}
              </strong>
            </div>

            <div className="market-table">
              <div className="market-row market-row--header">
                <span>Side</span>
                <span>Model</span>
                <span>Best line</span>
                <span>Edge</span>
              </div>
              <div className="market-row">
                <span>{game.home_team}</span>
                <span>{formatAmericanOdds(game.model_implied_odds.home)}</span>
                <span>
                  {formatAmericanOdds(game.best_market_odds?.home_odds ?? null)}
                </span>
                <span>
                  {formatEdge(
                    game.model_implied_odds.home,
                    game.best_market_odds?.home_odds ?? null,
                  )}
                </span>
              </div>
              <div className="market-row">
                <span>Draw</span>
                <span>{formatAmericanOdds(game.model_implied_odds.draw)}</span>
                <span>
                  {formatAmericanOdds(game.best_market_odds?.draw_odds ?? null)}
                </span>
                <span>
                  {formatEdge(
                    game.model_implied_odds.draw,
                    game.best_market_odds?.draw_odds ?? null,
                  )}
                </span>
              </div>
              <div className="market-row">
                <span>{game.away_team}</span>
                <span>{formatAmericanOdds(game.model_implied_odds.away)}</span>
                <span>
                  {formatAmericanOdds(game.best_market_odds?.away_odds ?? null)}
                </span>
                <span>
                  {formatEdge(
                    game.model_implied_odds.away,
                    game.best_market_odds?.away_odds ?? null,
                  )}
                </span>
              </div>
            </div>

            <div className="book-row">
              <span>Best books</span>
              <strong>
                Home:{" "}
                {formatBookmaker(game.best_market_odds?.home_bookmaker ?? null)}
                {" · "}Draw:{" "}
                {formatBookmaker(game.best_market_odds?.draw_bookmaker ?? null)}
                {" · "}Away:{" "}
                {formatBookmaker(game.best_market_odds?.away_bookmaker ?? null)}
              </strong>
            </div>

            {game.incentive_note ? (
              <p className="incentive-note">{game.incentive_note}</p>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
