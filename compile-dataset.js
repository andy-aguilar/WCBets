const fs = require("fs");
const teamMap = require("./team-map.js");
const predictions = require("./model-predictions.json");
const oddsData = require("./odds.json");

// ============================================================
// 1. Convert win probability (%) to implied American odds
// ============================================================
function pctToAmericanOdds(pct) {
  const prob = pct / 100;
  if (prob >= 1) return -Infinity;
  if (prob <= 0) return Infinity;
  if (prob === 0.5) return 100; // even money

  if (prob > 0.5) {
    // Favorite: negative odds
    return Math.round(-(prob / (1 - prob)) * 100);
  } else {
    // Underdog: positive odds
    return Math.round(((1 - prob) / prob) * 100);
  }
}

// ============================================================
// 2. Preferred bookmakers for tie-breaking (higher index = higher priority)
// ============================================================
const PREFERRED_BOOKS = ["draftkings", "fanduel", "betmgm"];

function getBookPriority(bookKey) {
  const idx = PREFERRED_BOOKS.indexOf(bookKey);
  return idx >= 0 ? idx : -1; // non-preferred books get -1
}

// ============================================================
// 3. Process odds.json — find best odds across ALL bookmakers
// ============================================================
// Find best odds by team name (not by home/away position in odds.json)
// Returns a map: { "TeamName": { odds, bookmaker }, "Draw": { odds, bookmaker } }
// Tie-breaking: when two books have the same price, prefer BetMGM > FanDuel > DraftKings
function findBestOddsByName(game) {
  const best = {}; // keyed by outcome name (team name or "Draw")

  game.bookmakers.forEach((bookmaker) => {
    const h2h = bookmaker.markets.find((m) => m.key === "h2h");
    if (!h2h) return;

    h2h.outcomes.forEach((outcome) => {
      const current = best[outcome.name];
      if (!current) {
        best[outcome.name] = {
          odds: outcome.price,
          bookmaker: bookmaker.key,
        };
      } else if (outcome.price > current.odds) {
        best[outcome.name] = {
          odds: outcome.price,
          bookmaker: bookmaker.key,
        };
      } else if (outcome.price === current.odds) {
        // Tie-break: prefer higher-priority book
        if (getBookPriority(bookmaker.key) > getBookPriority(current.bookmaker)) {
          best[outcome.name] = {
            odds: outcome.price,
            bookmaker: bookmaker.key,
          };
        }
      }
    });
  });

  return best;
}

// Collect ALL bookmaker odds for each outcome (for popover display)
function getAllOddsByName(game) {
  const all = {}; // keyed by outcome name → array of { bookmaker, odds }

  game.bookmakers.forEach((bookmaker) => {
    const h2h = bookmaker.markets.find((m) => m.key === "h2h");
    if (!h2h) return;

    h2h.outcomes.forEach((outcome) => {
      if (!all[outcome.name]) all[outcome.name] = [];
      all[outcome.name].push({
        bookmaker: bookmaker.key,
        title: bookmaker.title,
        odds: outcome.price,
      });
    });
  });

  // Sort each outcome's array by odds descending (best first)
  Object.keys(all).forEach((name) => {
    all[name].sort((a, b) => b.odds - a.odds);
  });

  return all;
}

// Build a lookup for odds games by the two team names (sorted for consistent key)
function makeOddsKey(teamA, teamB) {
  return [teamA, teamB].sort().join(" vs ");
}

const oddsLookup = {};
oddsData.forEach((game) => {
  const key = makeOddsKey(game.home_team, game.away_team);
  oddsLookup[key] = game;
});

// ============================================================
// 4. Convert UTC commence_time to Eastern "game day" date
//    Buffer: subtract 4 extra hours so games at midnight–3AM ET
//    still count as the previous day's slate.
// ============================================================
function getGameDateET(commenceTimeUTC) {
  const utcDate = new Date(commenceTimeUTC);
  // Convert to ET (UTC-4 for EDT, UTC-5 for EST)
  // Use Intl to get the actual offset dynamically
  const etString = utcDate.toLocaleString("en-US", { timeZone: "America/New_York" });
  const etDate = new Date(etString);
  // Subtract 4-hour buffer so midnight–3:59AM ET games show as previous day
  etDate.setHours(etDate.getHours() - 4);
  const month = etDate.getMonth() + 1;
  const day = etDate.getDate();
  return `${month}/${day}`;
}

// ============================================================
// 5. Compile the joint dataset
// ============================================================
const compiled = [];

predictions.forEach((pred) => {
  const homeFullName = teamMap[pred.home_team];
  const awayFullName = teamMap[pred.away_team];

  if (!homeFullName || !awayFullName) {
    console.warn(
      `WARNING: Could not map teams: ${pred.home_team} vs ${pred.away_team}`
    );
    return;
  }

  // Look up odds game by team names
  const oddsKey = makeOddsKey(homeFullName, awayFullName);
  const oddsGame = oddsLookup[oddsKey];

  // Convert model percentages to implied American odds
  const modelOdds = {
    home: pctToAmericanOdds(pred.home_win_pct),
    away: pctToAmericanOdds(pred.away_win_pct),
    draw: pctToAmericanOdds(pred.draw_pct),
  };

  let bestMarketOdds = null;
  let allMarketOdds = null;
  if (oddsGame) {
    // Get best odds keyed by actual team name (not home/away position)
    const bestByName = findBestOddsByName(oddsGame);
    // Get ALL odds keyed by team name (for popover display)
    const allByName = getAllOddsByName(oddsGame);

    // Map to our model's home/away using the full team names
    const homeOdds = bestByName[homeFullName] || { odds: null, bookmaker: null };
    const awayOdds = bestByName[awayFullName] || { odds: null, bookmaker: null };
    const drawOdds = bestByName["Draw"] || { odds: null, bookmaker: null };

    bestMarketOdds = {
      home_odds: homeOdds.odds,
      home_bookmaker: homeOdds.bookmaker,
      away_odds: awayOdds.odds,
      away_bookmaker: awayOdds.bookmaker,
      draw_odds: drawOdds.odds,
      draw_bookmaker: drawOdds.bookmaker,
    };

    allMarketOdds = {
      home: allByName[homeFullName] || [],
      away: allByName[awayFullName] || [],
      draw: allByName["Draw"] || [],
    };
  }

  // Derive date from odds commence_time (converted to ET with buffer),
  // falling back to the model prediction date if no odds match
  const gameDate = oddsGame
    ? getGameDateET(oddsGame.commence_time)
    : pred.date;

  compiled.push({
    date: gameDate,
    home_team: pred.home_team,
    away_team: pred.away_team,
    home_field: pred.home_field || false,
    predicted_score: pred.predicted_score,
    home_xg: pred.home_xg,
    away_xg: pred.away_xg,
    model_implied_odds: {
      home: modelOdds.home,
      away: modelOdds.away,
      draw: modelOdds.draw,
    },
    model_pct: {
      home: pred.home_win_pct,
      away: pred.away_win_pct,
      draw: pred.draw_pct,
    },
    best_market_odds: bestMarketOdds,
    all_market_odds: allMarketOdds,
  });
});

// ============================================================
// 6. Report & write output
// ============================================================
const matched = compiled.filter((g) => g.best_market_odds !== null).length;
const unmatched = compiled.filter((g) => g.best_market_odds === null).length;

console.log(`\nCompiled ${compiled.length} games`);
console.log(`  Matched with odds data: ${matched}`);
console.log(`  No odds data found:     ${unmatched}`);

if (unmatched > 0) {
  console.log("\nGames without odds data:");
  compiled
    .filter((g) => g.best_market_odds === null)
    .forEach((g) =>
      console.log(`  ${g.date}: ${g.home_team} vs ${g.away_team}`)
    );
}

// Generate last-updated timestamp in Eastern time
const lastUpdated = new Date().toLocaleString("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const output = {
  last_updated: lastUpdated,
  games: compiled,
};

const outputPath = "./compiled-dataset.json";
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\nCompiled at: ${lastUpdated} ET`);
console.log(`Output written to ${outputPath}`);

// Also update index.html if it exists with a DATASET_PLACEHOLDER or previous data
const htmlPath = "./index.html";
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, "utf8");
  // Replace the DATA assignment line (matches both placeholder and previous data)
  const dataRegex = /const DATA = .+?;\n/s;
  const newData = `const DATA = ${JSON.stringify(compiled)};\n`;
  if (dataRegex.test(html)) {
    html = html.replace(dataRegex, newData);
  }

  // Replace or insert the LAST_UPDATED assignment line
  const updatedRegex = /const LAST_UPDATED = .+?;\n/s;
  const newUpdated = `const LAST_UPDATED = ${JSON.stringify(lastUpdated)};\n`;
  if (updatedRegex.test(html)) {
    html = html.replace(updatedRegex, newUpdated);
  } else {
    // Insert right after the DATA line
    html = html.replace(
      /const DATA = .+?;\n/s,
      (match) => match + newUpdated
    );
  }

  fs.writeFileSync(htmlPath, html);
  console.log("Updated index.html with latest data");
}
