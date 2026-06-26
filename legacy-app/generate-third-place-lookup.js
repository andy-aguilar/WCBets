#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const path = require("path");

const ROOT = __dirname;
const OUTPUT_PATH = path.join(ROOT, "third-place-lookup.json");
const WIKI_API_URL =
  "https://en.wikipedia.org/w/api.php?action=parse&page=Template:2026_FIFA_World_Cup_third-place_table&prop=wikitext&format=json";
const USER_AGENT = "AthenaBot/1.0 (personal research for local dashboard)";
const SLOT_ORDER = ["1A", "1B", "1D", "1E", "1G", "1I", "1K", "1L"];
const GROUP_ORDER = "ABCDEFGHIJKL".split("");

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

function normalize(text) {
  return text.replace(/\r/g, "").trim();
}

function parseRows(wikitext) {
  const sections = normalize(wikitext).split(/\n\|-\s*/);
  const combos = [];

  for (const section of sections) {
    const rowMatch = section.match(/! scope="row" \| (\d+)/);
    if (!rowMatch) continue;

    const option = Number(rowMatch[1]);
    const dataLine = section
      .replace(/! rowspan="495" \|/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!dataLine) continue;

    const possible = dataLine.includes("|| Yes ||") || /\|\s*Yes\s*\|\|/.test(dataLine);
    const dividerRegex = possible
      ? /\|\|\s*Yes\s*\|\|/
      : /\|\|?\s*\{\{No\}\}\s*\|\|?/;
    const parts = dataLine.split(dividerRegex);
    if (parts.length !== 2) continue;

    const leftCells = parts[0]
      .replace(/^\|\s*/, "")
      .split("||")
      .map((cell) => cell.trim());
    const rightCells = parts[1]
      .split("||")
      .map((cell) => cell.trim())
      .filter(Boolean)
      .slice(0, SLOT_ORDER.length);

    if (leftCells.length < GROUP_ORDER.length || rightCells.length !== SLOT_ORDER.length) {
      continue;
    }

    const groups = GROUP_ORDER.filter((group, index) =>
      leftCells[index].includes(`'''${group}'''`)
    );

    const slots = {};
    SLOT_ORDER.forEach((slot, index) => {
      const teamMatch = rightCells[index].match(/3[A-L]/);
      slots[slot] = teamMatch ? teamMatch[0] : rightCells[index];
    });

    combos.push({
      option,
      key: groups.join(""),
      groups,
      still_possible: possible,
      slots,
    });
  }

  return combos;
}

async function main() {
  const payload = await fetchJson(WIKI_API_URL);
  const wikitext = payload?.parse?.wikitext?.["*"];

  if (!wikitext) {
    throw new Error("Wikipedia response did not include template wikitext");
  }

  const combos = parseRows(wikitext);
  const combosByKey = Object.fromEntries(
    combos.map((combo) => [
      combo.key,
      {
        option: combo.option,
        still_possible: combo.still_possible,
        slots: combo.slots,
      },
    ])
  );

  const output = {
    generated_at: new Date().toISOString(),
    source: WIKI_API_URL,
    slot_order: SLOT_ORDER,
    groups: GROUP_ORDER,
    combos,
    combos_by_key: combosByKey,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `Saved ${combos.length} third-place combinations to ${path.basename(OUTPUT_PATH)}`
  );
}

main().catch((error) => {
  console.error("Failed to generate third-place lookup:", error.message);
  process.exit(1);
});
