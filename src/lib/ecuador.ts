import { compiledDataset } from "../data/compiledDataset";
import { ecuadorPathData } from "../data/ecuadorPathData";
import { thirdPlaceLookup } from "../data/thirdPlaceLookup";
import type {
  EcuadorGroupData,
  EcuadorGroupMatch,
  EcuadorStanding,
  EcuadorRoundOf32Slot,
} from "./types";

type ScoreOverride = { home?: string; away?: string };
type TieOverrideMap = Record<string, string[]>;

export interface GroupResolvedRow extends EcuadorStanding {
  rank: number;
  resolution: "auto" | "manual" | "manual-needed";
  tieKey?: string;
}

export interface ResolvedGroupState {
  group: string;
  matches: EcuadorGroupMatch[];
  ordered: GroupResolvedRow[];
  unresolved: TieContext[];
}

export interface ThirdPlaceRow extends GroupResolvedRow {
  third_rank: number;
  unresolvedCutoff?: boolean;
  rankingResolution: "auto" | "manual" | "manual-needed";
}

export interface EcuadorSummary {
  headline: string;
  detail: string;
  pills: Array<{ label: string; tone: "good" | "warn" | "bad" }>;
}

export interface EcuadorScenario {
  groupStates: Record<string, ResolvedGroupState>;
  thirdRanking: ThirdPlaceRow[];
  comboKey: string;
  summary: EcuadorSummary;
  unresolvedGroupTies: TieContext[];
  unresolvedThirdTies: TieContext[];
  route: EcuadorRouteOverview;
  advancingGroups: string[];
}

export interface TieContext {
  key: string;
  type: "group" | "third";
  group?: string;
  title: string;
  description: string;
  teams: string[];
}

export interface EcuadorRouteOverview {
  finish: "first" | "second" | "third" | "fourth" | "unknown";
  slot: string | null;
  opponent: string | null;
  venue: string | null;
  city: string | null;
  target: string | null;
}

function makePill(
  label: string,
  tone: "good" | "warn" | "bad",
): EcuadorSummary["pills"][number] {
  return { label, tone };
}

const TEAM_MAP: Record<string, string> = {
  ALG: "Algeria",
  ARG: "Argentina",
  AUS: "Australia",
  AUT: "Austria",
  BEL: "Belgium",
  BIH: "Bosnia & Herzegovina",
  BRA: "Brazil",
  CAN: "Canada",
  CIV: "Ivory Coast",
  COD: "DR Congo",
  COL: "Colombia",
  CPV: "Cape Verde",
  CRO: "Croatia",
  CUW: "Curaçao",
  CZE: "Czech Republic",
  ECU: "Ecuador",
  EGY: "Egypt",
  ENG: "England",
  ESP: "Spain",
  FRA: "France",
  GER: "Germany",
  GHA: "Ghana",
  HAI: "Haiti",
  IRN: "Iran",
  IRQ: "Iraq",
  JOR: "Jordan",
  JPN: "Japan",
  KOR: "South Korea",
  KSA: "Saudi Arabia",
  MAR: "Morocco",
  MEX: "Mexico",
  NED: "Netherlands",
  NOR: "Norway",
  NZL: "New Zealand",
  PAN: "Panama",
  PAR: "Paraguay",
  POR: "Portugal",
  QAT: "Qatar",
  RSA: "South Africa",
  SCO: "Scotland",
  SEN: "Senegal",
  SUI: "Switzerland",
  SWE: "Sweden",
  TUN: "Tunisia",
  TUR: "Turkey",
  URU: "Uruguay",
  USA: "USA",
  UZB: "Uzbekistan",
};

function normalizeTeamName(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

const TEAM_NAME_TO_CODE = Object.fromEntries(
  Object.entries(TEAM_MAP).map(([code, name]) => [
    normalizeTeamName(name),
    code,
  ]),
);
TEAM_NAME_TO_CODE[normalizeTeamName("Bosnia and Herzegovina")] = "BIH";
TEAM_NAME_TO_CODE[normalizeTeamName("United States")] = "USA";
TEAM_NAME_TO_CODE[normalizeTeamName("Cote d'Ivoire")] = "CIV";
TEAM_NAME_TO_CODE[normalizeTeamName("Côte d'Ivoire")] = "CIV";

const MODEL_MATCH_LOOKUP = Object.fromEntries(
  compiledDataset.games.flatMap((game) => [
    [
      `${game.home_team}::${game.away_team}`,
      { home_xg: game.home_xg, away_xg: game.away_xg },
    ],
    [
      `${game.away_team}::${game.home_team}`,
      { home_xg: game.away_xg, away_xg: game.home_xg },
    ],
  ]),
);

export const ecuadorGroups = Object.values(ecuadorPathData.groups).filter(
  (group) => group.matches.some((match) => !match.played),
);

export function getProjectedDefaultScore(match: EcuadorGroupMatch) {
  const homeCode = TEAM_NAME_TO_CODE[normalizeTeamName(match.home_team)];
  const awayCode = TEAM_NAME_TO_CODE[normalizeTeamName(match.away_team)];
  if (!homeCode || !awayCode) {
    return { home: "", away: "" };
  }

  const game = MODEL_MATCH_LOOKUP[`${homeCode}::${awayCode}`];
  if (!game) {
    return { home: "", away: "" };
  }

  return {
    home: String(Math.round(game.home_xg)),
    away: String(Math.round(game.away_xg)),
  };
}

function cloneProjectedMatch(
  match: EcuadorGroupMatch,
  scoreState: Record<string, ScoreOverride>,
) {
  const state = scoreState[match.id] || {};
  const suggested = getProjectedDefaultScore(match);
  const homeRaw = state.home ?? suggested.home;
  const awayRaw = state.away ?? suggested.away;
  const hasProjection =
    homeRaw !== undefined &&
    homeRaw !== "" &&
    awayRaw !== undefined &&
    awayRaw !== "";

  if (match.played) {
    return { ...match };
  }

  if (!hasProjection) {
    return {
      ...match,
      played: false,
      home_score: null,
      away_score: null,
      raw: match.raw,
    };
  }

  return {
    ...match,
    played: true,
    home_score: Number(homeRaw),
    away_score: Number(awayRaw),
    raw: `${homeRaw}-${awayRaw}`,
  };
}

function buildTableMap(
  group: { group: string; teams: string[] },
  matches: EcuadorGroupMatch[],
) {
  const table = Object.fromEntries(
    group.teams.map((team) => [
      team,
      {
        team,
        group: group.group,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
      },
    ]),
  ) as Record<string, EcuadorStanding>;

  matches.forEach((match) => {
    if (!match.played || match.home_score == null || match.away_score == null)
      return;
    const home = table[match.home_team];
    const away = table[match.away_team];
    home.played += 1;
    away.played += 1;
    home.goals_for += match.home_score;
    home.goals_against += match.away_score;
    away.goals_for += match.away_score;
    away.goals_against += match.home_score;

    if (match.home_score > match.away_score) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (match.home_score < match.away_score) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  Object.values(table).forEach((row) => {
    row.goal_difference = row.goals_for - row.goals_against;
  });

  return table;
}

function compareDesc(a: number, b: number) {
  return b - a;
}

function compareGroupTieRows(
  a: EcuadorStanding & {
    hh_points: number;
    hh_goal_difference: number;
    hh_goals_for: number;
  },
  b: EcuadorStanding & {
    hh_points: number;
    hh_goal_difference: number;
    hh_goals_for: number;
  },
) {
  return (
    compareDesc(a.hh_points, b.hh_points) ||
    compareDesc(a.hh_goal_difference, b.hh_goal_difference) ||
    compareDesc(a.hh_goals_for, b.hh_goals_for) ||
    compareDesc(a.goal_difference, b.goal_difference) ||
    compareDesc(a.goals_for, b.goals_for) ||
    a.team.localeCompare(b.team)
  );
}

function compareThirdRows(a: EcuadorStanding, b: EcuadorStanding) {
  return (
    compareDesc(a.points, b.points) ||
    compareDesc(a.goal_difference, b.goal_difference) ||
    compareDesc(a.goals_for, b.goals_for) ||
    a.group.localeCompare(b.group)
  );
}

function makeGroupTieKey(
  groupLetter: string,
  rows: Array<
    EcuadorStanding & {
      hh_points: number;
      hh_goal_difference: number;
      hh_goals_for: number;
    }
  >,
) {
  const fingerprint = rows
    .map((row) =>
      [
        row.team,
        row.points,
        row.hh_points,
        row.hh_goal_difference,
        row.hh_goals_for,
        row.goal_difference,
        row.goals_for,
      ].join(":"),
    )
    .sort()
    .join("|");

  return `group:${groupLetter}:${fingerprint}`;
}

function makeThirdTieKey(rows: EcuadorStanding[]) {
  const fingerprint = rows
    .map((row) =>
      [
        row.group,
        row.team,
        row.points,
        row.goal_difference,
        row.goals_for,
      ].join(":"),
    )
    .sort()
    .join("|");

  return `third:${fingerprint}`;
}

function applyManualOrder<T extends { team: string }>(
  rows: T[],
  key: string,
  tieOverrides: TieOverrideMap,
) {
  const order = tieOverrides[key];
  if (!order) return null;
  const orderIndex = Object.fromEntries(
    order.map((team, index) => [team, index]),
  );
  if (rows.some((row) => !(row.team in orderIndex))) return null;
  return [...rows].sort((a, b) => orderIndex[a.team] - orderIndex[b.team]);
}

function resolveGroupTie(
  groupLetter: string,
  tiedTeams: string[],
  matches: EcuadorGroupMatch[],
  overallMap: Record<string, EcuadorStanding>,
  tieOverrides: TieOverrideMap,
) {
  if (tiedTeams.length === 1) {
    return {
      ordered: [{ ...overallMap[tiedTeams[0]], resolution: "auto" as const }],
      unresolved: [] as TieContext[],
    };
  }

  const headToHeadMatches = matches.filter(
    (match) =>
      match.played &&
      tiedTeams.includes(match.home_team) &&
      tiedTeams.includes(match.away_team),
  );
  const hhMap = buildTableMap(
    { group: groupLetter, teams: tiedTeams },
    headToHeadMatches,
  );
  const rows = tiedTeams.map((team) => ({
    ...overallMap[team],
    hh_points: hhMap[team].points,
    hh_goal_difference: hhMap[team].goal_difference,
    hh_goals_for: hhMap[team].goals_for,
  }));
  const sorted = [...rows].sort(compareGroupTieRows);
  const ordered: Array<
    (typeof rows)[number] & {
      resolution: "auto" | "manual" | "manual-needed";
      tieKey?: string;
    }
  > = [];
  const unresolved: TieContext[] = [];

  for (let index = 0; index < sorted.length; ) {
    let end = index + 1;
    while (
      end < sorted.length &&
      sorted[end].hh_points === sorted[index].hh_points &&
      sorted[end].hh_goal_difference === sorted[index].hh_goal_difference &&
      sorted[end].hh_goals_for === sorted[index].hh_goals_for &&
      sorted[end].goal_difference === sorted[index].goal_difference &&
      sorted[end].goals_for === sorted[index].goals_for
    ) {
      end += 1;
    }

    const subset = sorted.slice(index, end);
    if (subset.length === 1) {
      ordered.push({ ...subset[0], resolution: "auto" });
    } else {
      const key = makeGroupTieKey(groupLetter, subset);
      const manual = applyManualOrder(subset, key, tieOverrides);
      if (manual) {
        manual.forEach((row) =>
          ordered.push({ ...row, resolution: "manual", tieKey: key }),
        );
      } else {
        subset.forEach((row) =>
          ordered.push({ ...row, resolution: "manual-needed", tieKey: key }),
        );
        unresolved.push({
          key,
          type: "group",
          group: groupLetter,
          title: `Set Group ${groupLetter} order`,
          description:
            "These teams are still tied after points, head-to-head, goal difference, and goals scored.",
          teams: subset.map((row) => row.team),
        });
      }
    }
    index = end;
  }

  return { ordered, unresolved };
}

export function resolveGroupState(
  group: EcuadorGroupData,
  scoreState: Record<string, ScoreOverride>,
  tieOverrides: TieOverrideMap,
): ResolvedGroupState {
  const matches = group.matches.map((match) =>
    cloneProjectedMatch(match, scoreState),
  );
  const overallMap = buildTableMap(group, matches);
  const byPoints: Record<number, string[]> = {};
  Object.values(overallMap).forEach((row) => {
    byPoints[row.points] = byPoints[row.points] || [];
    byPoints[row.points].push(row.team);
  });

  const ordered: GroupResolvedRow[] = [];
  const unresolved: TieContext[] = [];

  Object.keys(byPoints)
    .map(Number)
    .sort((a, b) => b - a)
    .forEach((points) => {
      const resolved = resolveGroupTie(
        group.group,
        byPoints[points],
        matches,
        overallMap,
        tieOverrides,
      );
      resolved.ordered.forEach((row, index) => {
        ordered.push({
          team: row.team,
          group: row.group,
          played: row.played,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
          goals_for: row.goals_for,
          goals_against: row.goals_against,
          goal_difference: row.goal_difference,
          points: row.points,
          resolution: row.resolution,
          tieKey: "tieKey" in row ? row.tieKey : undefined,
          rank: ordered.length + index + 1,
        });
      });
      unresolved.push(...resolved.unresolved);
    });

  return { group: group.group, matches, ordered, unresolved };
}

function rankThirdPlaceTeams(
  groupStates: Record<string, ResolvedGroupState>,
  tieOverrides: TieOverrideMap,
) {
  const rows = Object.values(groupStates)
    .map((groupState) => groupState.ordered[2])
    .filter(Boolean);
  const sorted = [...rows].sort(compareThirdRows);
  const ordered: ThirdPlaceRow[] = [];
  const unresolved: TieContext[] = [];

  for (let index = 0; index < sorted.length; ) {
    let end = index + 1;
    while (
      end < sorted.length &&
      sorted[end].points === sorted[index].points &&
      sorted[end].goal_difference === sorted[index].goal_difference &&
      sorted[end].goals_for === sorted[index].goals_for
    ) {
      end += 1;
    }

    const subset = sorted.slice(index, end);
    const spansCutoff = index < 8 && end > 8;
    if (subset.length === 1 || !spansCutoff) {
      subset.forEach((row) =>
        ordered.push({
          ...row,
          third_rank: ordered.length + 1,
          unresolvedCutoff: false,
          rankingResolution: "auto",
        }),
      );
    } else {
      const key = makeThirdTieKey(subset);
      const manual = applyManualOrder(subset, key, tieOverrides);
      if (manual) {
        manual.forEach((row) =>
          ordered.push({
            ...row,
            third_rank: ordered.length + 1,
            unresolvedCutoff: false,
            rankingResolution: "manual",
            tieKey: key,
          }),
        );
      } else {
        subset.forEach((row) =>
          ordered.push({
            ...row,
            third_rank: ordered.length + 1,
            unresolvedCutoff: true,
            rankingResolution: "manual-needed",
            tieKey: key,
          }),
        );
        unresolved.push({
          key,
          type: "third",
          title: "Set third-place cutoff order",
          description:
            "This exact tie crosses the 8th-place cutoff for advancing third-place teams.",
          teams: subset.map((row) => row.team),
        });
      }
    }
    index = end;
  }

  return { ordered, unresolved };
}

function getGroupPositionTeam(
  groupStates: Record<string, ResolvedGroupState>,
  groupLetter: string,
  positionIndex: number,
) {
  const state = groupStates[groupLetter];
  if (!state || !state.ordered[positionIndex]) return null;
  return state.ordered[positionIndex];
}

function buildSummary(
  groupStates: Record<string, ResolvedGroupState>,
  thirdRanking: ThirdPlaceRow[],
  unresolvedThirdTies: TieContext[],
  comboKey: string,
) {
  const combo = thirdPlaceLookup.combos_by_key[comboKey] || null;
  const ecuador = groupStates.E?.ordered.find((row) => row.team === "Ecuador");
  const unresolvedThirdCutoff = unresolvedThirdTies.length > 0;

  const summary: EcuadorSummary = {
    headline: "Need more scores",
    detail: "Enter the remaining scorelines to resolve Ecuador’s path.",
    pills: [],
  };

  if (!ecuador) {
    return summary;
  }

  if (ecuador.resolution === "manual-needed") {
    return {
      headline: "Group E order still needs a tiebreak",
      detail:
        "Ecuador’s exact finish is still tied after the available rules we’re using.",
      pills: [makePill("Group E unresolved", "warn")],
    };
  }

  if (ecuador.rank === 4) {
    return {
      headline: "Ecuador are out",
      detail: "Projected 4th in Group E.",
      pills: [makePill("Group E 4th", "bad")],
    };
  }

  if (ecuador.rank === 2) {
    const opponent = getGroupPositionTeam(groupStates, "I", 1);
    const meta = ecuadorPathData.round_of_32["2E"];
    return {
      headline: "Ecuador finish 2nd",
      detail: opponent
        ? `Round of 32 vs ${opponent.team} in ${meta.city}.`
        : "Round of 32 opponent comes from Group I runner-up.",
      pills: [
        makePill("Group E runner-up", "good"),
        makePill(`${meta.venue}, ${meta.city}`, "warn"),
      ],
    };
  }

  if (ecuador.rank === 1 && combo) {
    const target = combo.slots["1E"];
    const opponentGroup = target ? target.replace(/^3/, "") : null;
    const opponent = opponentGroup
      ? getGroupPositionTeam(groupStates, opponentGroup, 2)
      : null;
    const meta = ecuadorPathData.round_of_32["1E"];
    return {
      headline: "Ecuador win Group E",
      detail: opponent
        ? `Round of 32 vs ${opponent.team} in ${meta.city}.`
        : "Round of 32 opponent comes from the advancing third-place pool.",
      pills: [
        makePill(`Faces ${target || "3rd place TBD"}`, "good"),
        makePill(`${meta.venue}, ${meta.city}`, "warn"),
      ],
    };
  }

  if (ecuador.rank === 3) {
    const ecuadorThird = thirdRanking.find((row) => row.team === "Ecuador");
    const advancing = thirdRanking
      .slice(0, 8)
      .some((row) => row.team === "Ecuador");

    if (unresolvedThirdCutoff) {
      return {
        headline: "Third-place cutoff still tied",
        detail:
          "Ecuador are in the 3rd-place mix, but the 8th-place line is still unresolved.",
        pills: [makePill("Third-place cutoff unresolved", "warn")],
      };
    }

    if (!advancing) {
      return {
        headline: "Ecuador finish 3rd and miss the cut",
        detail: "Projected outside the top eight third-placed teams.",
        pills: [makePill("3rd place, not enough", "bad")],
      };
    }

    if (combo) {
      const slotEntry = Object.entries(combo.slots).find(
        ([, team]) => team === "3E",
      );
      const slot = slotEntry ? slotEntry[0] : null;
      const opponentGroup = slot ? slot.replace(/^1/, "") : null;
      const opponent = opponentGroup
        ? getGroupPositionTeam(groupStates, opponentGroup, 0)
        : null;
      const meta = slot ? ecuadorPathData.round_of_32[slot] : null;

      return {
        headline: "Ecuador advance as a 3rd-place team",
        detail:
          slot && opponent && meta
            ? `Round of 32 in ${meta.city} vs ${opponent.team}.`
            : "Round of 32 slot resolves from the eight-group combo.",
        pills: [
          slot ? makePill(`Slot ${slot}`, "good") : null,
          ecuadorThird
            ? makePill(`Top-8 third place #${ecuadorThird.third_rank}`, "warn")
            : null,
          meta ? makePill(`${meta.venue}, ${meta.city}`, "warn") : null,
        ].filter(Boolean) as EcuadorSummary["pills"],
      };
    }
  }

  return summary;
}

function buildRouteOverview(
  groupStates: Record<string, ResolvedGroupState>,
  thirdRanking: ThirdPlaceRow[],
  unresolvedThirdTies: TieContext[],
  comboKey: string,
): EcuadorRouteOverview {
  const combo = thirdPlaceLookup.combos_by_key[comboKey] || null;
  const ecuador = groupStates.E?.ordered.find((row) => row.team === "Ecuador");

  if (!ecuador) {
    return {
      finish: "unknown",
      slot: null,
      opponent: null,
      venue: null,
      city: null,
      target: null,
    };
  }

  if (ecuador.rank === 4) {
    return {
      finish: "fourth",
      slot: null,
      opponent: null,
      venue: null,
      city: null,
      target: null,
    };
  }

  if (ecuador.rank === 2) {
    const opponent = getGroupPositionTeam(groupStates, "I", 1);
    const meta = ecuadorPathData.round_of_32["2E"];
    return {
      finish: "second",
      slot: "2E",
      opponent: opponent?.team ?? null,
      venue: meta.venue,
      city: meta.city,
      target: "2I",
    };
  }

  if (ecuador.rank === 1 && combo) {
    const target = combo.slots["1E"];
    const opponentGroup = target ? target.replace(/^3/, "") : null;
    const opponent = opponentGroup
      ? getGroupPositionTeam(groupStates, opponentGroup, 2)
      : null;
    const meta = ecuadorPathData.round_of_32["1E"];
    return {
      finish: "first",
      slot: "1E",
      opponent: opponent?.team ?? null,
      venue: meta.venue,
      city: meta.city,
      target,
    };
  }

  if (ecuador.rank === 3 && !unresolvedThirdTies.length && combo) {
    const advancing = thirdRanking
      .slice(0, 8)
      .some((row) => row.team === "Ecuador");
    if (!advancing) {
      return {
        finish: "third",
        slot: null,
        opponent: null,
        venue: null,
        city: null,
        target: null,
      };
    }

    const slotEntry = Object.entries(combo.slots).find(
      ([, team]) => team === "3E",
    );
    const slot = slotEntry ? slotEntry[0] : null;
    const opponentGroup = slot ? slot.replace(/^1/, "") : null;
    const opponent = opponentGroup
      ? getGroupPositionTeam(groupStates, opponentGroup, 0)
      : null;
    const meta = slot ? ecuadorPathData.round_of_32[slot] : null;
    return {
      finish: "third",
      slot,
      opponent: opponent?.team ?? null,
      venue: meta?.venue ?? null,
      city: meta?.city ?? null,
      target: "3E",
    };
  }

  return {
    finish:
      ecuador.rank === 1 ? "first" : ecuador.rank === 3 ? "third" : "unknown",
    slot: null,
    opponent: null,
    venue: null,
    city: null,
    target: null,
  };
}

export function resolveEcuadorScenario(
  scoreState: Record<string, ScoreOverride>,
  tieOverrides: TieOverrideMap,
): EcuadorScenario {
  const groupStates = Object.fromEntries(
    Object.values(ecuadorPathData.groups).map((group) => [
      group.group,
      resolveGroupState(group, scoreState, tieOverrides),
    ]),
  ) as Record<string, ResolvedGroupState>;

  const unresolvedGroupTies = Object.values(groupStates).flatMap(
    (state) => state.unresolved,
  );
  const thirdResults = rankThirdPlaceTeams(groupStates, tieOverrides);
  const thirdRanking = thirdResults.ordered;
  const unresolvedThirdTies = thirdResults.unresolved;
  const advancingGroups = thirdRanking.slice(0, 8).map((row) => row.group);
  const comboKey = thirdRanking
    .slice(0, 8)
    .map((row) => row.group)
    .sort()
    .join("");

  return {
    groupStates,
    thirdRanking,
    comboKey,
    summary: buildSummary(
      groupStates,
      thirdRanking,
      unresolvedThirdTies,
      comboKey,
    ),
    unresolvedGroupTies,
    unresolvedThirdTies,
    route: buildRouteOverview(
      groupStates,
      thirdRanking,
      unresolvedThirdTies,
      comboKey,
    ),
    advancingGroups,
  };
}

export function getRoundOf32Slots() {
  return ["1E", "2E"]
    .map((slot) => ecuadorPathData.round_of_32[slot])
    .filter(Boolean) as EcuadorRoundOf32Slot[];
}
