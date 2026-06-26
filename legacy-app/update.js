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

const PREDICTIONS_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1XSuXj2oimVFd73q5tw9WXWWqH4LYaqyc-gGrB24FwAI/export?format=csv";

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

/** Fetch a URL and return the body as a string (Promise). Follows redirects. */
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https
        .get(u, (res) => {
          // Follow redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            get(res.headers.location);
            return;
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode} from ${u}`));
            return;
          }
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => resolve(Buffer.concat(chunks).toString()));
          res.on("error", reject);
        })
        .on("error", reject);
    };
    get(url);
  });
}

// ============================================================
// 1. Fetch & rotate odds
// ============================================================
async function updateOdds() {
  const today = getTodayET();
  const oddsPath = path.join(ROOT, "odds.json");
  const archivePath = path.join(ROOT, `odds-${today}.json`);

  console.log("\n📡 Fetching latest odds from API...");
  const raw = await fetchURL(ODDS_API_URL);

  let oddsData;
  try {
    oddsData = JSON.parse(raw);
  } catch (e) {
    throw new Error("API response is not valid JSON: " + e.message);
  }

  // Archive the current odds.json as a dated file
  if (fs.existsSync(oddsPath)) {
    if (!fs.existsSync(archivePath)) {
      fs.copyFileSync(oddsPath, archivePath);
      console.log(`📦 Archived current odds → ${path.basename(archivePath)}`);
    } else {
      console.log(
        `⚠️  Archive ${path.basename(archivePath)} already exists — overwriting odds.json only`
      );
    }
  }

  fs.writeFileSync(oddsPath, JSON.stringify(oddsData, null, 2));
  console.log(`✅ Updated odds.json (${oddsData.length} games)`);
}

// ============================================================
// 2. Parse model predictions CSV
// ============================================================

/**
 * Parse a team field like ":uy: URU" or ":ca: CAN 🏠"
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
  const dataLines = lines.slice(1); // skip header

  return dataLines.map((line) => {
    const cols = line.split(",");

    const date = cols[0].trim();
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

/**
 * Check if predictions data might be stale.
 * Returns a warning string if stale, or null if fresh.
 */
function checkStaleness(predictions) {
  const today = getTodayET(); // "6-21"
  const [todayMonth, todayDay] = today.split("-").map(Number);

  // Find the earliest date in the predictions
  let earliestMonth = 99, earliestDay = 99;
  predictions.forEach((p) => {
    const [m, d] = p.date.split("/").map(Number);
    if (m < earliestMonth || (m === earliestMonth && d < earliestDay)) {
      earliestMonth = m;
      earliestDay = d;
    }
  });

  // If earliest game date is before today, data might not have been updated
  if (
    earliestMonth < todayMonth ||
    (earliestMonth === todayMonth && earliestDay < todayDay)
  ) {
    return `earliest game date is ${earliestMonth}/${earliestDay} but today is ${todayMonth}/${todayDay}`;
  }

  return null;
}

/**
 * Fetch predictions from Google Sheet or read from local CSV.
 */
async function updatePredictions(csvFilePath, forceUpdate) {
  const today = getTodayET();
  let csvContent;
  let source;

  if (csvFilePath) {
    // Manual CSV override
    if (!fs.existsSync(csvFilePath)) {
      console.log(`\n❌ CSV file not found: ${csvFilePath}`);
      return false;
    }
    csvContent = fs.readFileSync(csvFilePath, "utf8");
    source = path.basename(csvFilePath);
    console.log(`\n📄 Using local CSV: ${source}`);
  } else {
    // Auto-fetch from Google Sheet
    console.log("\n📡 Fetching latest predictions from Silver Bulletin...");
    try {
      csvContent = await fetchURL(PREDICTIONS_SHEET_URL);
    } catch (e) {
      console.error(`\n❌ Failed to fetch predictions: ${e.message}`);
      return false;
    }
    source = "Silver Bulletin (Google Sheet)";
    console.log(`✅ Fetched predictions from ${source}`);

    // Save as dated CSV
    const csvArchivePath = path.join(ROOT, `${today}_model-predictions.csv`);
    fs.writeFileSync(csvArchivePath, csvContent);
    console.log(`📦 Saved as ${path.basename(csvArchivePath)}`);
  }

  const predictions = parseCSV(csvContent);
  console.log(`   Parsed ${predictions.length} game predictions`);

  // Staleness check
  const staleWarning = checkStaleness(predictions);
  if (staleWarning && !forceUpdate) {
    console.log(`\n⚠️  Predictions may be stale — ${staleWarning}`);
    console.log(`   The sheet may not have been updated yet.`);
    console.log(`   Use --force to skip this check and update anyway.`);
    return false;
  } else if (staleWarning && forceUpdate) {
    console.log(`\n⚠️  Predictions may be stale — ${staleWarning} (--force used, continuing)`);
  }

  // Backup current model-predictions.json → previous-predictions.json
  const modelPath = path.join(ROOT, "model-predictions.json");
  const prevPath = path.join(ROOT, "previous-predictions.json");

  if (fs.existsSync(modelPath)) {
    fs.copyFileSync(modelPath, prevPath);
    console.log(
      "📦 Backed up current model-predictions.json → previous-predictions.json"
    );
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
    execSync("node generate-third-place-lookup.js", {
      cwd: ROOT,
      stdio: "inherit",
    });

    execSync("node generate-ecuador-path-data.js", {
      cwd: ROOT,
      stdio: "inherit",
    });

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
  const forceUpdate = args.includes("--force");

  // Check for --csv flag: --csv path/to/file.csv
  let csvFilePath = null;
  const csvIdx = args.indexOf("--csv");
  if (csvIdx !== -1 && args[csvIdx + 1]) {
    csvFilePath = path.resolve(args[csvIdx + 1]);
  }

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
    const updated = await updatePredictions(csvFilePath, forceUpdate);
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
