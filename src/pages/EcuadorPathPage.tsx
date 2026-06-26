import { ecuadorPathData } from "../data/ecuadorPathData";
import type {
  EcuadorGroupMatch,
  EcuadorRoundOf32Slot,
  EcuadorStanding,
} from "../lib/types";

function sortStandings(standings: EcuadorStanding[]) {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) {
      return b.goal_difference - a.goal_difference;
    }
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    return a.team.localeCompare(b.team);
  });
}

function formatScore(match: EcuadorGroupMatch) {
  if (!match.played || match.home_score == null || match.away_score == null) {
    return match.raw;
  }

  return `${match.home_score}-${match.away_score}`;
}

const GROUP_E_STANDINGS = sortStandings(
  ecuadorPathData.current_standings.E ?? [],
);
const GROUP_E_MATCHES = ecuadorPathData.groups.E?.matches ?? [];
const ECUADOR_SLOTS = ["1E", "2E"]
  .map((slot) => ecuadorPathData.round_of_32[slot])
  .filter(Boolean) as EcuadorRoundOf32Slot[];

export function EcuadorPathPage() {
  return (
    <main className="page-shell">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Ecuador path</p>
          <h1>Scenario desk</h1>
          <p className="tagline">
            This is the first real shell for the Ecuador route: current Group E
            table, match ledger, and Ecuador&apos;s fixed Round of 32 landing
            spots. The full score-driven simulator is the next layer.
          </p>
        </div>
        <div className="hero-stats">
          <div className="status-item">
            <span className="status-label">Data source</span>
            <strong>Wikipedia + lookup map</strong>
          </div>
          <div className="status-item">
            <span className="status-label">Generated</span>
            <strong>{ecuadorPathData.generated_at}</strong>
          </div>
          <div className="status-item">
            <span className="status-label">Group E rank</span>
            <strong>
              {GROUP_E_STANDINGS.findIndex((team) => team.team === "Ecuador") +
                1 || "—"}
            </strong>
          </div>
        </div>
      </section>

      <section className="ecuador-grid">
        <article className="ecuador-card">
          <div className="ecuador-card__header">
            <div>
              <p className="eyebrow">Current table</p>
              <h2>Group E</h2>
            </div>
            <span className="ecuador-card__meta">
              Sorted by points, GD, goals for
            </span>
          </div>

          <div className="table-scroll">
            <table className="bets-table ecuador-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Pts</th>
                  <th>GD</th>
                  <th>GF</th>
                  <th>GA</th>
                  <th>P</th>
                </tr>
              </thead>
              <tbody>
                {GROUP_E_STANDINGS.map((team) => (
                  <tr
                    key={team.team}
                    className={
                      team.team === "Ecuador" ? "ecuador-table__focus" : ""
                    }
                  >
                    <td>{team.team}</td>
                    <td>{team.points}</td>
                    <td>{team.goal_difference}</td>
                    <td>{team.goals_for}</td>
                    <td>{team.goals_against}</td>
                    <td>{team.played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="ecuador-card">
          <div className="ecuador-card__header">
            <div>
              <p className="eyebrow">Landing spots</p>
              <h2>Round of 32</h2>
            </div>
            <span className="ecuador-card__meta">
              Fixed slots if Ecuador advances directly
            </span>
          </div>

          <div className="slot-list">
            {ECUADOR_SLOTS.map((slot) => (
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
      </section>

      <section className="ecuador-card">
        <div className="ecuador-card__header">
          <div>
            <p className="eyebrow">Match ledger</p>
            <h2>Group E results</h2>
          </div>
          <span className="ecuador-card__meta">
            Raw group-state feed we&apos;ll use for the simulator
          </span>
        </div>

        <div className="match-list">
          {GROUP_E_MATCHES.map((match) => (
            <article className="match-card" key={match.id}>
              <div className="match-card__top">
                <strong>{match.heading}</strong>
                <span>{formatScore(match)}</span>
              </div>
              <p>
                {match.date_text} · {match.time_text}
              </p>
              <span>
                {match.venue}, {match.city}
              </span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
