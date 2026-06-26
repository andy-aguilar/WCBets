import { Fragment, useEffect, useState } from "react";
import { compiledDataset } from "../data/compiledDataset";
import {
  formatAmericanOdds,
  formatBookmaker,
  formatCurrency,
  formatEdge,
  getEdgePercent,
  getKellyFraction,
  toDecimalOdds,
} from "../lib/odds";
import type { BettingGame, MarketSide } from "../lib/types";

interface OutcomeRow {
  side: MarketSide;
  label: string;
  modelPercent: number;
  modelOdds: number;
  marketOdds: number | null;
  bookmaker: string | null;
  edgePercent: number | null;
  kellyFraction: number;
}

interface GameWithRows {
  game: BettingGame;
  rows: OutcomeRow[];
}

const KELLY_OPTIONS = [
  { value: 0.1, label: "10% Kelly" },
  { value: 0.25, label: "25% Kelly" },
  { value: 0.33, label: "33% Kelly" },
  { value: 0.5, label: "50% Kelly" },
  { value: 0.75, label: "75% Kelly" },
  { value: 1, label: "100% Kelly" },
];

function buildRows(game: BettingGame): OutcomeRow[] {
  return [
    {
      side: "home",
      label: game.home_team,
      modelPercent: game.model_pct.home,
      modelOdds: game.model_implied_odds.home,
      marketOdds: game.best_market_odds?.home_odds ?? null,
      bookmaker: game.best_market_odds?.home_bookmaker ?? null,
      edgePercent: getEdgePercent(
        game.model_implied_odds.home,
        game.best_market_odds?.home_odds ?? null,
      ),
      kellyFraction: getKellyFraction(
        game.model_pct.home / 100,
        game.best_market_odds?.home_odds ?? null,
      ),
    },
    {
      side: "draw",
      label: "Draw",
      modelPercent: game.model_pct.draw,
      modelOdds: game.model_implied_odds.draw,
      marketOdds: game.best_market_odds?.draw_odds ?? null,
      bookmaker: game.best_market_odds?.draw_bookmaker ?? null,
      edgePercent: getEdgePercent(
        game.model_implied_odds.draw,
        game.best_market_odds?.draw_odds ?? null,
      ),
      kellyFraction: getKellyFraction(
        game.model_pct.draw / 100,
        game.best_market_odds?.draw_odds ?? null,
      ),
    },
    {
      side: "away",
      label: game.away_team,
      modelPercent: game.model_pct.away,
      modelOdds: game.model_implied_odds.away,
      marketOdds: game.best_market_odds?.away_odds ?? null,
      bookmaker: game.best_market_odds?.away_bookmaker ?? null,
      edgePercent: getEdgePercent(
        game.model_implied_odds.away,
        game.best_market_odds?.away_odds ?? null,
      ),
      kellyFraction: getKellyFraction(
        game.model_pct.away / 100,
        game.best_market_odds?.away_odds ?? null,
      ),
    },
  ];
}

function groupGamesByDate(games: BettingGame[]) {
  return games.reduce<Record<string, BettingGame[]>>((groups, game) => {
    groups[game.date] ??= [];
    groups[game.date].push(game);
    return groups;
  }, {});
}

export function BettingPage() {
  const [bankrollInput, setBankrollInput] = useState("");
  const [kellyOption, setKellyOption] = useState("0.25");
  const [customKellyInput, setCustomKellyInput] = useState("");
  const [valueOnly, setValueOnly] = useState(false);
  const [openIncentiveId, setOpenIncentiveId] = useState<string | null>(null);
  const [openOddsId, setOpenOddsId] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside() {
      setOpenIncentiveId(null);
      setOpenOddsId(null);
    }

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const bankroll = Number.parseFloat(bankrollInput) || 0;
  const activeKellyFraction =
    customKellyInput && Number.parseFloat(customKellyInput) > 0
      ? Number.parseFloat(customKellyInput) / 100
      : Number.parseFloat(kellyOption) || 0.25;

  const gamesWithRows: GameWithRows[] = compiledDataset.games.map((game) => ({
    game,
    rows: buildRows(game),
  }));

  const valueGames = gamesWithRows.map(({ game, rows }) => ({
    game,
    rows: valueOnly ? rows.filter((row) => row.kellyFraction > 0) : rows,
    hasValue: rows.some((row) => row.kellyFraction > 0),
  }));

  const visibleGames = valueGames.filter(
    ({ rows, hasValue }) => rows.length > 0 && (!valueOnly || hasValue),
  );

  const gamesByDate = groupGamesByDate(visibleGames.map(({ game }) => game));
  const visibleLookup = new Map(
    visibleGames.map((entry) => [entry.game.game_id, entry]),
  );

  const totalValueBets = visibleGames.reduce(
    (count, entry) =>
      count + entry.rows.filter((row) => row.kellyFraction > 0).length,
    0,
  );
  const totalSuggested = visibleGames.reduce(
    (sum, entry) =>
      sum +
      entry.rows.reduce(
        (inner, row) =>
          inner + row.kellyFraction * activeKellyFraction * bankroll,
        0,
      ),
    0,
  );

  return (
    <main className="page-shell">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Betting dashboard</p>
          <h1>ATLAS Bets</h1>
          <p className="tagline">
            The React dashboard is now using real controls, real Kelly math, and
            a denser table flow closer to the original app.
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
          <div className="status-item">
            <span className="status-label">Value bets</span>
            <strong>{totalValueBets}</strong>
          </div>
          <div className="status-item">
            <span className="status-label">Suggested total</span>
            <strong>
              {bankroll > 0 ? formatCurrency(totalSuggested) : "—"}
            </strong>
          </div>
        </div>
      </section>

      <section className="controls-card">
        <label className="control-field">
          <span>Bankroll</span>
          <input
            type="number"
            min="0"
            step="100"
            placeholder="e.g. 1000"
            value={bankrollInput}
            onChange={(event) => setBankrollInput(event.target.value)}
          />
        </label>

        <label className="control-field">
          <span>Kelly fraction</span>
          <select
            value={customKellyInput ? "" : kellyOption}
            onChange={(event) => {
              setKellyOption(event.target.value);
              setCustomKellyInput("");
            }}
          >
            {KELLY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="control-field">
          <span>Custom Kelly %</span>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 15"
            value={customKellyInput}
            onChange={(event) => setCustomKellyInput(event.target.value)}
          />
        </label>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={valueOnly}
            onChange={(event) => setValueOnly(event.target.checked)}
          />
          <span>Value bets only</span>
        </label>
      </section>

      <section className="table-card">
        {Object.entries(gamesByDate).map(([date, games]) => {
          const dateEntries = games.map(
            (game) => visibleLookup.get(game.game_id)!,
          );
          const dateValueBets = dateEntries.reduce(
            (count, entry) =>
              count + entry.rows.filter((row) => row.kellyFraction > 0).length,
            0,
          );
          const dateSuggested = dateEntries.reduce(
            (sum, entry) =>
              sum +
              entry.rows.reduce(
                (inner, row) =>
                  inner + row.kellyFraction * activeKellyFraction * bankroll,
                0,
              ),
            0,
          );

          return (
            <div className="date-group" key={date}>
              <div className="date-group__header">
                <h2>{date}</h2>
                <span>
                  {games.length} matches · {dateValueBets} value bets
                  {bankroll > 0
                    ? ` · ${formatCurrency(dateSuggested)} suggested`
                    : ""}
                </span>
              </div>

              <div className="table-scroll">
                <table className="bets-table">
                  <thead>
                    <tr>
                      <th>Game</th>
                      <th>Side</th>
                      <th>Model %</th>
                      <th>Model</th>
                      <th>Best</th>
                      <th>Book</th>
                      <th>Edge</th>
                      <th>Kelly %</th>
                      <th>Bet</th>
                      <th>Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((game) => {
                      const entry = visibleLookup.get(game.game_id)!;

                      return (
                        <Fragment key={game.game_id}>
                          <tr className="game-row">
                            <td colSpan={10}>
                              <div className="game-row__inner">
                                <div>
                                  <div className="game-row__title">
                                    <strong>
                                      {game.home_team} vs {game.away_team}
                                    </strong>
                                    {game.incentive_note ? (
                                      <button
                                        type="button"
                                        className="info-trigger"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOpenIncentiveId((current) =>
                                            current === game.game_id
                                              ? null
                                              : game.game_id,
                                          );
                                        }}
                                      >
                                        <span className="info-icon">i</span>
                                      </button>
                                    ) : null}
                                    {openIncentiveId === game.game_id &&
                                    game.incentive_note ? (
                                      <div
                                        className="inline-popover info-popover show"
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                      >
                                        <div className="popover-title">
                                          Match incentives
                                        </div>
                                        <div className="popover-body">
                                          {game.incentive_note}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                  <span className="game-row__meta">
                                    Predicted {game.predicted_score} · xG{" "}
                                    {game.home_xg.toFixed(1)}-
                                    {game.away_xg.toFixed(1)}
                                  </span>
                                </div>
                                <div className="game-row__badge">
                                  {game.home_field
                                    ? "Home edge spot"
                                    : "Neutral"}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {entry.rows.map((row) => {
                            const betAmount =
                              row.kellyFraction *
                              activeKellyFraction *
                              bankroll;
                            const payout =
                              row.marketOdds != null
                                ? betAmount * toDecimalOdds(row.marketOdds)
                                : null;

                            return (
                              <tr key={`${game.game_id}-${row.side}`}>
                                <td></td>
                                <td>{row.label}</td>
                                <td>{row.modelPercent}%</td>
                                <td>{formatAmericanOdds(row.modelOdds)}</td>
                                <td>
                                  <div className="popover-anchor">
                                    {row.marketOdds != null ? (
                                      <button
                                        type="button"
                                        className="odds-trigger"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOpenOddsId((current) =>
                                            current ===
                                            `${game.game_id}-${row.side}`
                                              ? null
                                              : `${game.game_id}-${row.side}`,
                                          );
                                        }}
                                      >
                                        {formatAmericanOdds(row.marketOdds)}
                                      </button>
                                    ) : (
                                      "—"
                                    )}
                                    {openOddsId ===
                                      `${game.game_id}-${row.side}` &&
                                    game.all_market_odds?.[row.side]?.length ? (
                                      <div
                                        className="inline-popover odds-popover"
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                      >
                                        <div className="popover-title">
                                          Market odds
                                        </div>
                                        <div className="popover-body">
                                          {game.all_market_odds[row.side].map(
                                            (offer) => (
                                              <div
                                                key={`${game.game_id}-${row.side}-${offer.bookmaker}-${offer.odds}`}
                                                className={`popover-row${offer.odds === row.marketOdds ? " popover-row--best" : ""}`}
                                              >
                                                <span className="pop-book">
                                                  {formatBookmaker(
                                                    offer.bookmaker,
                                                  )}
                                                </span>
                                                <span className="pop-odds">
                                                  {formatAmericanOdds(
                                                    offer.odds,
                                                  )}
                                                </span>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                                <td>{formatBookmaker(row.bookmaker)}</td>
                                <td>
                                  {formatEdge(row.modelOdds, row.marketOdds)}
                                </td>
                                <td>
                                  {row.kellyFraction > 0
                                    ? `${(row.kellyFraction * activeKellyFraction * 100).toFixed(2)}%`
                                    : "—"}
                                </td>
                                <td>
                                  {row.kellyFraction > 0 && bankroll > 0
                                    ? formatCurrency(betAmount)
                                    : "—"}
                                </td>
                                <td>
                                  {row.kellyFraction > 0 && bankroll > 0
                                    ? formatCurrency(payout)
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
