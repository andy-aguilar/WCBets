import { useState } from "react";
import { ecuadorPathData } from "../data/ecuadorPathData";
import {
  ecuadorGroups,
  getProjectedDefaultScore,
  getRoundOf32Slots,
  resolveEcuadorScenario,
} from "../lib/ecuador";
import type { TieContext } from "../lib/ecuador";

type ScoreOverride = { home?: string; away?: string };
type TieOverrideMap = Record<string, string[]>;

const ROUND_OF_32_SLOTS = getRoundOf32Slots();

function formatScoreline(home: string, away: string) {
  if (home === "" || away === "") return "—";
  return `${home}-${away}`;
}

export function EcuadorPathPage() {
  const [scoreOverrides, setScoreOverrides] = useState<
    Record<string, ScoreOverride>
  >({});
  const [tieOverrides, setTieOverrides] = useState<TieOverrideMap>({});
  const [activeTie, setActiveTie] = useState<
    (TieContext & { draft: string[] }) | null
  >(null);

  const simulation = resolveEcuadorScenario(scoreOverrides, tieOverrides);
  const groupERank =
    simulation.groupStates.E?.ordered.findIndex(
      (team) => team.team === "Ecuador",
    ) + 1 || 0;

  return (
    <main className="page-shell">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Ecuador path</p>
          <h1>Scenario desk</h1>
          <p className="tagline">
            Enter projected scores for the remaining group-stage matches and
            ATLAS will recompute the group tables, the third-place race, and
            Ecuador&apos;s current Round of 32 outlook.
          </p>
        </div>
        <div className="hero-stats">
          <div className="status-item">
            <span className="status-label">Generated</span>
            <strong>{ecuadorPathData.generated_at}</strong>
          </div>
          <div className="status-item">
            <span className="status-label">Group E rank</span>
            <strong>{groupERank || "—"}</strong>
          </div>
          <div className="status-item">
            <span className="status-label">Third-place combo</span>
            <strong>{simulation.comboKey || "—"}</strong>
          </div>
        </div>
      </section>

      <section className="controls-card ecuador-controls">
        <div className="ecuador-controls__copy">
          <span className="status-label">Projection controls</span>
          <p>
            Defaults use rounded model xG where available. If a projected tie
            still can&apos;t be separated, I&apos;ll flag it instead of faking
            certainty.
          </p>
        </div>
        <div className="ecuador-controls__actions">
          <button
            type="button"
            className="action-button"
            onClick={() => {
              setScoreOverrides({});
              setTieOverrides({});
              setActiveTie(null);
            }}
          >
            Clear all
          </button>
          <button
            type="button"
            className="action-button action-button--primary"
            onClick={() => {
              const nextOverrides: Record<string, ScoreOverride> = {};
              ecuadorGroups.forEach((group) => {
                group.matches.forEach((match) => {
                  if (match.played) return;
                  const suggested = getProjectedDefaultScore(match);
                  if (suggested.home === "" || suggested.away === "") return;
                  nextOverrides[match.id] = suggested;
                });
              });
              setScoreOverrides(nextOverrides);
            }}
          >
            Apply Model xG
          </button>
        </div>
      </section>

      {simulation.unresolvedGroupTies.length ||
      simulation.unresolvedThirdTies.length ? (
        <section className="tie-alerts-grid">
          {[
            ...simulation.unresolvedGroupTies,
            ...simulation.unresolvedThirdTies,
          ].map((context) => (
            <article className="tie-alert-card" key={context.key}>
              <div>
                <strong>{context.title}</strong>
                <p>{context.description}</p>
                <span>{context.teams.join(" · ")}</span>
              </div>
              <button
                type="button"
                className="mini-button"
                onClick={() =>
                  setActiveTie({
                    ...context,
                    draft: tieOverrides[context.key]
                      ? [...tieOverrides[context.key]]
                      : [...context.teams],
                  })
                }
              >
                Set order
              </button>
            </article>
          ))}
        </section>
      ) : null}

      <section className="ecuador-grid">
        <article className="ecuador-card">
          <div className="ecuador-card__header">
            <div>
              <p className="eyebrow">Projected outcome</p>
              <h2>{simulation.summary.headline}</h2>
            </div>
            <span className="ecuador-card__meta">
              Live from your score inputs
            </span>
          </div>
          <p className="ecuador-summary-text">{simulation.summary.detail}</p>
          <div className="sim-pill-row">
            {simulation.summary.pills.map((pill) => (
              <span className={`sim-pill ${pill.tone}`} key={pill.label}>
                {pill.label}
              </span>
            ))}
          </div>

          <div className="slot-list">
            {ROUND_OF_32_SLOTS.map((slot) => (
              <div className="slot-card" key={slot.slot}>
                <div className="slot-card__top">
                  <strong>{slot.slot}</strong>
                  <span>
                    Match {slot.match_index} · {slot.city}
                  </span>
                </div>
                <p>{slot.heading}</p>
                <span className="slot-card__meta">
                  {slot.date_text} · {slot.time_text}
                </span>
                <span className="slot-card__meta">{slot.venue}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="ecuador-card">
          <div className="ecuador-card__header">
            <div>
              <p className="eyebrow">Third-place race</p>
              <h2>Top 12 snapshot</h2>
            </div>
            <span className="ecuador-card__meta">
              Groups ranked by points, GD, goals for
            </span>
          </div>

          <div className="table-scroll">
            <table className="bets-table ecuador-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>Grp</th>
                  <th>Pts</th>
                  <th>GD</th>
                  <th>GF</th>
                </tr>
              </thead>
              <tbody>
                {simulation.thirdRanking.map((row) => (
                  <tr
                    key={`${row.group}-${row.team}`}
                    className={
                      row.team === "Ecuador"
                        ? "ecuador-table__focus"
                        : row.unresolvedCutoff
                          ? "ecuador-table__warn"
                          : ""
                    }
                  >
                    <td>{row.third_rank}</td>
                    <td>
                      {row.team}
                      {row.rankingResolution === "manual-needed" ? (
                        <span className="inline-status">tie</span>
                      ) : row.rankingResolution === "manual" ? (
                        <span className="inline-status">manual</span>
                      ) : null}
                    </td>
                    <td>{row.group}</td>
                    <td>{row.points}</td>
                    <td>{row.goal_difference}</td>
                    <td>{row.goals_for}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="ecuador-card">
        <div className="ecuador-card__header">
          <div>
            <p className="eyebrow">Projected scores</p>
            <h2>Remaining group matches</h2>
          </div>
          <span className="ecuador-card__meta">
            Groups G through L still affect Ecuador&apos;s 3rd-place path
          </span>
        </div>

        <div className="sim-groups-grid">
          {ecuadorGroups.map((group) => (
            <article className="sim-group-card" key={group.group}>
              <div className="sim-group-card__header">
                <div>
                  <strong>Group {group.group}</strong>
                  <span>
                    {group.matches.filter((match) => !match.played).length}{" "}
                    matches left
                  </span>
                </div>
              </div>
              <div className="sim-match-list">
                {group.matches
                  .filter((match) => !match.played)
                  .map((match) => {
                    const defaults = getProjectedDefaultScore(match);
                    const state = scoreOverrides[match.id] || {};
                    const homeValue = state.home ?? defaults.home;
                    const awayValue = state.away ?? defaults.away;

                    return (
                      <div className="sim-match-card" key={match.id}>
                        <div className="sim-match-card__meta">
                          {match.date_text} · {match.city}
                        </div>
                        <div className="sim-score-grid">
                          <span>{match.home_team}</span>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="1"
                            inputMode="numeric"
                            value={homeValue}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setScoreOverrides((current) => ({
                                ...current,
                                [match.id]: {
                                  ...(current[match.id] || {}),
                                  home: nextValue,
                                  away:
                                    current[match.id]?.away ?? defaults.away,
                                },
                              }));
                            }}
                          />
                        </div>
                        <div className="sim-score-grid">
                          <span>{match.away_team}</span>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="1"
                            inputMode="numeric"
                            value={awayValue}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setScoreOverrides((current) => ({
                                ...current,
                                [match.id]: {
                                  ...(current[match.id] || {}),
                                  home:
                                    current[match.id]?.home ?? defaults.home,
                                  away: nextValue,
                                },
                              }));
                            }}
                          />
                        </div>
                        <div className="sim-match-card__footer">
                          <span>
                            Model default{" "}
                            {formatScoreline(defaults.home, defaults.away)}
                          </span>
                          <button
                            type="button"
                            className="mini-button"
                            onClick={() =>
                              setScoreOverrides((current) => {
                                const next = { ...current };
                                delete next[match.id];
                                return next;
                              })
                            }
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ecuador-card">
        <div className="ecuador-card__header">
          <div>
            <p className="eyebrow">Recomputed standings</p>
            <h2>Affected groups</h2>
          </div>
          <span className="ecuador-card__meta">
            Group ties flagged when the current data can&apos;t fully separate
            them
          </span>
        </div>

        <div className="sim-groups-grid">
          {ecuadorGroups.map((group) => {
            const state = simulation.groupStates[group.group];

            return (
              <article className="sim-group-card" key={`table-${group.group}`}>
                <div className="sim-group-card__header">
                  <div>
                    <strong>Group {group.group}</strong>
                    <span>
                      {state.unresolved.length
                        ? `Tie alert: ${state.unresolved
                            .flatMap((context) => context.teams)
                            .join(" · ")}`
                        : "Resolved"}
                    </span>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="bets-table ecuador-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Team</th>
                        <th>Pts</th>
                        <th>GD</th>
                        <th>GF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.ordered.map((row) => (
                        <tr
                          key={`${state.group}-${row.team}`}
                          className={
                            row.team === "Ecuador"
                              ? "ecuador-table__focus"
                              : row.resolution === "manual-needed"
                                ? "ecuador-table__warn"
                                : ""
                          }
                        >
                          <td>{row.rank}</td>
                          <td>
                            {row.team}
                            {row.resolution === "manual-needed" ? (
                              <span className="inline-status">tie</span>
                            ) : row.resolution === "manual" ? (
                              <span className="inline-status">manual</span>
                            ) : null}
                          </td>
                          <td>{row.points}</td>
                          <td>{row.goal_difference}</td>
                          <td>{row.goals_for}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {activeTie ? (
        <div
          className="tie-modal-backdrop"
          onClick={() => setActiveTie(null)}
          role="presentation"
        >
          <div
            className="tie-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={activeTie.title}
          >
            <div className="tie-modal__header">
              <div>
                <p className="eyebrow">Manual tiebreak</p>
                <h2>{activeTie.title}</h2>
              </div>
              <button
                type="button"
                className="mini-button"
                onClick={() => setActiveTie(null)}
              >
                Close
              </button>
            </div>
            <p className="ecuador-summary-text">{activeTie.description}</p>
            <div className="tie-order-list">
              {activeTie.draft.map((team, index) => (
                <div className="tie-order-row" key={`${activeTie.key}-${team}`}>
                  <strong>{index + 1}</strong>
                  <div>{team}</div>
                  <div className="tie-order-actions">
                    <button
                      type="button"
                      className="mini-button"
                      disabled={index === 0}
                      onClick={() =>
                        setActiveTie((current) => {
                          if (!current || index === 0) return current;
                          const next = [...current.draft];
                          [next[index - 1], next[index]] = [
                            next[index],
                            next[index - 1],
                          ];
                          return { ...current, draft: next };
                        })
                      }
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="mini-button"
                      disabled={index === activeTie.draft.length - 1}
                      onClick={() =>
                        setActiveTie((current) => {
                          if (!current || index === current.draft.length - 1) {
                            return current;
                          }
                          const next = [...current.draft];
                          [next[index], next[index + 1]] = [
                            next[index + 1],
                            next[index],
                          ];
                          return { ...current, draft: next };
                        })
                      }
                    >
                      Down
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="tie-modal__actions">
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  setTieOverrides((current) => {
                    const next = { ...current };
                    delete next[activeTie.key];
                    return next;
                  });
                  setActiveTie(null);
                }}
              >
                Clear override
              </button>
              <button
                type="button"
                className="action-button action-button--primary"
                onClick={() => {
                  setTieOverrides((current) => ({
                    ...current,
                    [activeTie.key]: [...activeTie.draft],
                  }));
                  setActiveTie(null);
                }}
              >
                Save order
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
