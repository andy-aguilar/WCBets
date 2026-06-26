import { Fragment } from "react";
import { compiledDataset } from "../data/compiledDataset";
import { formatAmericanOdds, formatBookmaker, formatEdge } from "../lib/odds";
import type { BettingGame } from "../lib/types";

function groupGamesByDate(games: BettingGame[]) {
  return games.reduce<Record<string, BettingGame[]>>((groups, game) => {
    groups[game.date] ??= [];
    groups[game.date].push(game);
    return groups;
  }, {});
}

export function BettingPage() {
  const gamesByDate = groupGamesByDate(compiledDataset.games);

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

      <section className="table-card">
        {Object.entries(gamesByDate).map(([date, games]) => (
          <div className="date-group" key={date}>
            <div className="date-group__header">
              <h2>{date}</h2>
              <span>{games.length} matches</span>
            </div>

            <div className="table-scroll">
              <table className="bets-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Side</th>
                    <th>Model</th>
                    <th>Best</th>
                    <th>Edge</th>
                    <th>Book</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game) => (
                    <Fragment key={game.game_id}>
                      <tr className="game-row" key={`${game.game_id}-header`}>
                        <td colSpan={6}>
                          <div className="game-row__inner">
                            <div>
                              <strong>
                                {game.home_team} vs {game.away_team}
                              </strong>
                              <span className="game-row__meta">
                                Predicted {game.predicted_score} · xG{" "}
                                {game.home_xg.toFixed(1)}-
                                {game.away_xg.toFixed(1)}
                              </span>
                            </div>
                            <div className="game-row__badge">
                              {game.home_field ? "Home edge spot" : "Neutral"}
                            </div>
                          </div>
                        </td>
                      </tr>
                      <tr key={`${game.game_id}-home`}>
                        <td></td>
                        <td>{game.home_team}</td>
                        <td>
                          {formatAmericanOdds(game.model_implied_odds.home)}
                        </td>
                        <td>
                          {formatAmericanOdds(
                            game.best_market_odds?.home_odds ?? null,
                          )}
                        </td>
                        <td>
                          {formatEdge(
                            game.model_implied_odds.home,
                            game.best_market_odds?.home_odds ?? null,
                          )}
                        </td>
                        <td>
                          {formatBookmaker(
                            game.best_market_odds?.home_bookmaker ?? null,
                          )}
                        </td>
                      </tr>
                      <tr key={`${game.game_id}-draw`}>
                        <td></td>
                        <td>Draw</td>
                        <td>
                          {formatAmericanOdds(game.model_implied_odds.draw)}
                        </td>
                        <td>
                          {formatAmericanOdds(
                            game.best_market_odds?.draw_odds ?? null,
                          )}
                        </td>
                        <td>
                          {formatEdge(
                            game.model_implied_odds.draw,
                            game.best_market_odds?.draw_odds ?? null,
                          )}
                        </td>
                        <td>
                          {formatBookmaker(
                            game.best_market_odds?.draw_bookmaker ?? null,
                          )}
                        </td>
                      </tr>
                      <tr key={`${game.game_id}-away`}>
                        <td></td>
                        <td>{game.away_team}</td>
                        <td>
                          {formatAmericanOdds(game.model_implied_odds.away)}
                        </td>
                        <td>
                          {formatAmericanOdds(
                            game.best_market_odds?.away_odds ?? null,
                          )}
                        </td>
                        <td>
                          {formatEdge(
                            game.model_implied_odds.away,
                            game.best_market_odds?.away_odds ?? null,
                          )}
                        </td>
                        <td>
                          {formatBookmaker(
                            game.best_market_odds?.away_bookmaker ?? null,
                          )}
                        </td>
                      </tr>
                      {game.incentive_note ? (
                        <tr
                          className="incentive-row"
                          key={`${game.game_id}-note`}
                        >
                          <td colSpan={6}>{game.incentive_note}</td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
