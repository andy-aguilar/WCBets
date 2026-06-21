#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const { execSync } = require("child_process");
const path = require("path");

// ============================================================
// Configuration
// ============================================================
const ODDS_API_URL =
  "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds?regions=us&oddsFormat=american&apiKey=89b1c1c325930f3bc05bd69fcb293744";

const ROOT = __dirname;

// ============================================================
// Helpers
// ============================================================

/** Get today's date string in M-DD format (Eastern Time) */
function getTodayET() {
  const now = new Date();
  const etString = now.toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  const etDate = new Date(etString);
  const month = etDate.getMonth() + 1;
  const day = etDate.getDate();
  return `${month}-${day}`; // e.g. "6-21"
}

/** Get today's date string in M/DD format for the JSON date field */
function getTodaySlashFormat() {
  const d = getTodayET();
  return d.replace("-", "/"); // "6-21" → "6/21"
}

/** Fetch a URL and return the body as a string (Promise) */
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString()));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

// ============================================================
// 1. Fetch & rotate odds
// ============================================================
async function updateOdds() {
  const today = getTodayET(); // e.g. "6-21"
  const oddsPath = path.join(ROOT, "odds.json");
  const archivePath = path.join(ROOT, `odds-${today}.json`);

  console.log("\n📡 Fetching latest odds from API...");
  const raw = await fetchURL(ODDS_API_URL);

  // Validate JSON
  let oddsData;
  try {
    oddsData = JSON.parse(raw);
  } catch (e) {
    throw new Error("API response is not valid JSON: " + e.message);
  }

  // Archive the current odds.json (if it exists) as a dated file
  if (fs.existsSync(oddsPath)) {
    // Only archive if today's archive doesn't already exist
    if (!fs.existsSync(archivePath)) {
      fs.copyFileSync(oddsPath, archivePath);
      console.log(`📦 Archived current odds → ${path.basename(archivePath)}`);
    } else {
      console.log(
        `⚠️  Archive ${path.basename(archivePath)} already exists — overwriting odds.json only`
      );
    }
  }

  // Write new odds.json
  fs.writeFileSync(oddsPath, JSON.stringify(oddsData, null, 2));
  console.log(
    `✅ Updated odds.json (${oddsData.length} games)`
  );
}

// ============================================================
// 2. Parse model predictions CSV
// ============================================================

/**
 * Parse a row from the CSV into a model-predictions.json object.
 *
 * CSV columns:
 *   Date, Team, Win, GF, Opponent, Win, GF, Draw, Most likely score, penalty_et_results
 *
 * Team column looks like: ":uy: URU" or ":ca: CAN 🏠"
 */
function parseTeamField(raw) {
  let cleaned = raw.trim();
  // Strip emoji flag prefix like ":uy: " or ":gb-eng: "
  cleaned = cleaned.replace(/^:[a-z-]+:\s*/i, "");
  // Check for home field marker 🏠
  const isHome = cleaned.includes("🏠");
  cleaned = cleaned.replace(/🏠/g, "").trim();
  return { code: cleaned, isHomeField: isHome };
}

function parseCSV(csvContent) {
  const lines = csvContent.trim().split("\n");
  // Skip header row
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    // Split by comma — but the CSV is simple (no quoted fields with commas)
    const cols = line.split(",");

    const date = cols[0].trim(); // "6/21"
    const { code: homeTeam, isHomeField: homeField } = parseTeamField(cols[1]);
    const homeWinPct = parseInt(cols[2].trim(), 10);
    const homeXg = parseFloat(cols[3].trim());
    const { code: awayTeam } = parseTeamField(cols[4]);
    const awayWinPct = parseInt(cols[5].trim(), 10);
    const awayXg = parseFloat(cols[6].trim());
    const drawPct = parseInt(cols[7].trim(), 10);
    const predictedScore = cols[8].trim();
    const penaltyEtResults = cols[9] ? cols[9].trim() : "";

    const entry = {
      date,
      home_team: homeTeam,
      home_win_pct: homeWinPct,
      home_xg: homeXg,
      away_team: awayTeam,
      away_win_pct: awayWinPct,
      away_xg: awayXg,
      draw_pct: drawPct,
      predicted_score: predictedScore,
    };

    if (homeField) {
      entry.home_field = true;
    }

    if (penaltyEtResults) {
      entry.penalty_et_results = penaltyEtResults;
    }

    return entry;
  });
}

function updatePredictions() {
  const today = getTodayET(); // e.g. "6-21"
  const csvFile = path.join(ROOT, `${today}_model-predictions.csv`);

  if (!fs.existsSync(csvFile)) {
    console.log(
      `\n⚠️  No CSV found for today (${path.basename(csvFile)}) — skipping predictions update`
    );
    return false;
  }

  console.log(`\n📄 Found predictions CSV: ${path.basename(csvFile)}`);

  const csvContent = fs.readFileSync(csvFile, "utf8");
  const predictions = parseCSV(csvContent);

  console.log(`   Parsed ${predictions.length} game predictions`);

  // Backup current model-predictions.json → previous-predictions.json
  const modelPath = path.join(ROOT, "model-predictions.json");
  const prevPath = path.join(ROOT, "previous-predictions.json");

  if (fs.existsSync(modelPath)) {
    fs.copyFileSync(modelPath, prevPath);
    console.log("📦 Backed up current model-predictions.json → previous-predictions.json");
  }

  // Write new model-predictions.json
  fs.writeFileSync(modelPath, JSON.stringify(predictions, null, 4));
  console.log("✅ Updated model-predictions.json");

  return true;
}

// ============================================================
// 3. Re-compile dataset
// ============================================================
function compileDataset() {
  console.log("\n🔨 Compiling dataset...\n");
  try {
    execSync("node compile-dataset.js", {
      cwd: ROOT,
      stdio: "inherit",
    });
    console.log("\n✅ Dataset compiled successfully");
  } catch (e) {
    console.error("\n❌ Error compiling dataset:", e.message);
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  const args = process.argv.slice(2);
  const oddsOnly = args.includes("--odds-only");
  const predictionsOnly = args.includes("--predictions-only");

  console.log(`\n🗓️  Today (ET): ${getTodayET()}`);
  console.log("=".repeat(50));

  let didUpdate = false;

  // Update odds (unless --predictions-only)
  if (!predictionsOnly) {
    try {
      await updateOdds();
      didUpdate = true;
    } catch (e) {
      console.error(`\n❌ Failed to fetch odds: ${e.message}`);
    }
  }

  // Update predictions (unless --odds-only)
  if (!oddsOnly) {
    const updated = updatePredictions();
    if (updated) didUpdate = true;
  }

  // Re-compile if anything changed
  if (didUpdate) {
    compileDataset();
  } else {
    console.log("\n⚠️  Nothing was updated — skipping compilation");
  }

  console.log("\n" + "=".repeat(50));
  console.log("🏁 Done!\n");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
