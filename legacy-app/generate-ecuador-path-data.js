#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const path = require("path");

const ROOT = __dirname;
const OUTPUT_PATH = path.join(ROOT, "ecuador-path-data.json");
const OVERRIDES_PATH = path.join(ROOT, "ecuador-path-overrides.json");
const USER_AGENT = "AthenaBot/1.0 (personal research for local dashboard)";
const GROUP_LETTERS = "ABCDEFGHIJKL".split("");
const GROUP_PAGES = Object.fromEntries(
  GROUP_LETTERS.map((letter) => [letter, `2026_FIFA_World_Cup_Group_${letter}`])
);

const ROUND_OF_32_PAGE = "2026_FIFA_World_Cup_round_of_32";

const SLOT_METADATA = {
  "1A": { position: "winner", group: "A" },
  "1B": { position: "winner", group: "B" },
  "1E": { position: "winner", group: "E" },
  "1K": { position: "winner", group: "K" },
  "1L": { position: "winner", group: "L" },
  "2E": { position: "runner_up", group: "E" },
  "2I": { position: "runner_up", group: "I" },
};

const ROUND_OF_32_TARGETS = {
  "Germany vs 3ABCDF": { slot: "1E", source: "lookup" },
  "Côte d'Ivoire vs 2I": { slot: "2E", fixed_opponent_slot: "2I" },
  "Mexico vs 3CEFHI": { slot: "1A", source: "lookup" },
  "1L vs 3EHIJK": { slot: "1L", source: "lookup" },
  "Switzerland vs 3EFGIJ": { slot: "1B", source: "lookup" },
  "1K vs 3DEIJL": { slot: "1K", source: "lookup" },
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": USER_AGENT,
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            res.resume();
            return;
          }

          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch (error) {
              reject(error);
            }
          });
          res.on("error", reject);
        }
      )
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchJson(url);
    } catch (error) {
      const isLastAttempt = attempt === attempts;
      const isRateLimit = /HTTP 429/.test(error.message);
      if (isLastAttempt || !isRateLimit) {
        throw error;
      }
      await sleep(750 * attempt);
    }
  }

  throw new Error(`Failed to fetch ${url}`);
}

function decodeHtml(value) {
  if (!value) return "";
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function getPageUrl(page) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(page)}`;
}

async function fetchHtml(page) {
  const url = getPageUrl(page);
  const payload = await new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": USER_AGENT,
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            res.resume();
            return;
          }

          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          res.on("error", reject);
        }
      )
      .on("error", reject);
  });

  return payload;
}

function extractMatchSections(html) {
  const matchesHeading = html.indexOf('<h2 id="Matches">');
  if (matchesHeading === -1) {
    throw new Error("Could not locate Matches section");
  }

  const reportsHeading = html.indexOf('<h3 id="Reports">', matchesHeading);
  const slice = html.slice(matchesHeading, reportsHeading === -1 ? undefined : reportsHeading);

  const headingRegex =
    /<div class="mw-heading mw-heading3"><h3 id="[^"]+">(?:<span[^>]*><\/span>)?([^<]+)<\/h3>/g;

  const sections = [];
  let match = headingRegex.exec(slice);
  while (match) {
    sections.push({
      heading: stripTags(match[1]),
      start: match.index,
      end: null,
    });
    match = headingRegex.exec(slice);
  }

  sections.forEach((section, index) => {
    const next = sections[index + 1];
    section.end = next ? next.start : slice.length;
    section.html = slice.slice(section.start, section.end);
  });

  return sections;
}

function parseTeamName(sectionHtml, sideClass) {
  const regex = new RegExp(
    `<th class="${sideClass}"[\\s\\S]*?<span itemprop="name">([\\s\\S]*?)<\\/span><\\/th>`
  );
  const match = sectionHtml.match(regex);
  if (!match) {
    throw new Error(`Could not parse ${sideClass} team`);
  }

  const nameHtml = match[1];
  const anchorMatch = nameHtml.match(/<a [^>]*>([^<]+)<\/a>/);
  return stripTags(anchorMatch ? anchorMatch[1] : nameHtml);
}

function parseScore(sectionHtml) {
  const match = sectionHtml.match(/<th class="fscore">([^<]+)<\/th>/);
  const raw = stripTags(match ? match[1] : "");
  const scoreMatch = raw.match(/^(\d+)\s*[–-]\s*(\d+)$/);
  if (!scoreMatch) {
    return {
      raw,
      played: false,
      home_score: null,
      away_score: null,
    };
  }

  return {
    raw,
    played: true,
    home_score: Number(scoreMatch[1]),
    away_score: Number(scoreMatch[2]),
  };
}

function parseMatchMeta(sectionHtml) {
  const dateMatch = sectionHtml.match(/<div class="fdate">([\s\S]*?)<\/div>/);
  const timeMatch = sectionHtml.match(/<div class="ftime">([\s\S]*?)<\/div>/);
  const locationMatch = sectionHtml.match(
    /itemprop="name address">([\s\S]*?)<\/span><\/div>/
  );

  const locationText = stripTags(locationMatch ? locationMatch[1] : "");
  const [venue = "", city = ""] = locationText.split(",").map((part) => part.trim());

  return {
    date_text: stripTags(dateMatch ? dateMatch[1] : ""),
    time_text: stripTags(timeMatch ? timeMatch[1] : ""),
    venue,
    city,
  };
}

function parseGroupPage(letter, html) {
  const sections = extractMatchSections(html);
  const matches = sections.map((section, index) => {
    const home_team = parseTeamName(section.html, "fhome");
    const away_team = parseTeamName(section.html, "faway");
    const score = parseScore(section.html);
    const meta = parseMatchMeta(section.html);

    return {
      id: `${letter}-${index + 1}`,
      group: letter,
      heading: section.heading,
      home_team,
      away_team,
      ...meta,
      ...score,
    };
  });

  const teams = [...new Set(matches.flatMap((match) => [match.home_team, match.away_team]))].sort();

  return {
    group: letter,
    teams,
    matches,
  };
}

function extractRoundOf32Sections(html) {
  const matchesHeading = html.indexOf('<h2 id="Matches">');
  const reportsHeading = html.indexOf('<h2 id="Reports">', matchesHeading);
  const slice = html.slice(matchesHeading, reportsHeading === -1 ? undefined : reportsHeading);

  const headingRegex =
    /<div class="mw-heading mw-heading3"><h3 id="[^"]+">(?:<span[^>]*><\/span>)?([^<]+)<\/h3>/g;
  const referenceRegex =
    /"([^"]+ \| Round of 32 \| FIFA World Cup 2026)"/g;

  const headings = [];
  let match = headingRegex.exec(slice);
  while (match) {
    headings.push({
      heading: stripTags(match[1]),
      start: match.index,
      end: null,
    });
    match = headingRegex.exec(slice);
  }

  headings.forEach((section, index) => {
    const next = headings[index + 1];
    section.end = next ? next.start : slice.length;
    section.html = slice.slice(section.start, section.end);
  });

  const referenceTitles = [];
  let refMatch = referenceRegex.exec(html);
  while (refMatch) {
    referenceTitles.push(refMatch[1].split(" | ")[0]);
    refMatch = referenceRegex.exec(html);
  }

  const matchReferences = referenceTitles.slice(0, headings.length);
  return headings.map((section, index) => ({
    ...section,
    reference_title: matchReferences[index] || section.heading,
  }));
}

function parseRoundOf32(html) {
  const sections = extractRoundOf32Sections(html);
  const targets = {};

  sections.forEach((section, index) => {
    const meta = parseMatchMeta(section.html);
    const score = parseScore(section.html);
    const referenceTitle = section.reference_title;
    const target = ROUND_OF_32_TARGETS[referenceTitle];
    if (!target) return;

    targets[target.slot] = {
      slot: target.slot,
      slot_meta: SLOT_METADATA[target.slot],
      source: target.source || "fixed",
      fixed_opponent_slot: target.fixed_opponent_slot || null,
      heading: section.heading,
      reference_title: referenceTitle,
      match_index: index + 1,
      ...meta,
      ...score,
    };
  });

  return targets;
}

function buildCurrentStandings(groups) {
  const summary = {};

  Object.values(groups).forEach((group) => {
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
      ])
    );

    group.matches.forEach((match) => {
      if (!match.played) return;
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

    summary[group.group] = Object.values(table).map((row) => ({
      ...row,
      goal_difference: row.goals_for - row.goals_against,
    }));
  });

  return summary;
}

function loadScoreOverrides() {
  if (!fs.existsSync(OVERRIDES_PATH)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
}

function applyScoreOverrides(groups, overrides) {
  if (!overrides || typeof overrides !== "object") {
    return;
  }

  Object.values(groups).forEach((group) => {
    group.matches = group.matches.map((match) => {
      const override = overrides[match.id];
      if (!override) return match;

      return {
        ...match,
        raw: `${override.home_score}-${override.away_score}`,
        played: true,
        home_score: Number(override.home_score),
        away_score: Number(override.away_score),
      };
    });
  });
}

async function main() {
  const groupHtmlPages = [];
  for (const letter of GROUP_LETTERS) {
    const html = await fetchHtml(GROUP_PAGES[letter]);
    groupHtmlPages.push([letter, html]);
    await sleep(150);
  }

  const groups = Object.fromEntries(
    groupHtmlPages.map(([letter, html]) => [letter, parseGroupPage(letter, html)])
  );
  applyScoreOverrides(groups, loadScoreOverrides());

  const roundHtml = await fetchHtml(ROUND_OF_32_PAGE);

  const current_standings = buildCurrentStandings(groups);
  const round_of_32 = parseRoundOf32(roundHtml);

  const output = {
    generated_at: new Date().toISOString(),
    source: {
      groups: Object.fromEntries(
        GROUP_LETTERS.map((letter) => [letter, getPageUrl(GROUP_PAGES[letter])])
      ),
      round_of_32: getPageUrl(ROUND_OF_32_PAGE),
    },
    groups,
    current_standings,
    round_of_32,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `Saved Ecuador path data for ${GROUP_LETTERS.length} groups to ${path.basename(
      OUTPUT_PATH
    )}`
  );
}

main().catch((error) => {
  console.error("Failed to generate Ecuador path data:", error.message);
  process.exit(1);
});
