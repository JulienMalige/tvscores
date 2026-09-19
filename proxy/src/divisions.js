/**
 * Which conference each American team plays in, and its division: the feed
 * carries results but no standings for these leagues, and no division field
 * on a team, so the split is ours. Team names as TheSportsDB spells them.
 * Realignment is rare (the last was 2002); a new team is a one-line change.
 */
const nfl = {
  AFC: {
    East: ["Buffalo Bills", "Miami Dolphins", "New England Patriots", "New York Jets"],
    North: ["Baltimore Ravens", "Cincinnati Bengals", "Cleveland Browns", "Pittsburgh Steelers"],
    South: ["Houston Texans", "Indianapolis Colts", "Jacksonville Jaguars", "Tennessee Titans"],
    West: ["Denver Broncos", "Kansas City Chiefs", "Las Vegas Raiders", "Los Angeles Chargers"],
  },
  NFC: {
    East: ["Dallas Cowboys", "New York Giants", "Philadelphia Eagles", "Washington Commanders"],
    North: ["Chicago Bears", "Detroit Lions", "Green Bay Packers", "Minnesota Vikings"],
    South: ["Atlanta Falcons", "Carolina Panthers", "New Orleans Saints", "Tampa Bay Buccaneers"],
    West: ["Arizona Cardinals", "Los Angeles Rams", "San Francisco 49ers", "Seattle Seahawks"],
  },
};

const nba = {
  east: {
    Atlantic: ["Boston Celtics", "Brooklyn Nets", "New York Knicks", "Philadelphia 76ers", "Toronto Raptors"],
    Central: ["Chicago Bulls", "Cleveland Cavaliers", "Detroit Pistons", "Indiana Pacers", "Milwaukee Bucks"],
    Southeast: ["Atlanta Hawks", "Charlotte Hornets", "Miami Heat", "Orlando Magic", "Washington Wizards"],
  },
  west: {
    Northwest: ["Denver Nuggets", "Minnesota Timberwolves", "Oklahoma City Thunder", "Portland Trail Blazers", "Utah Jazz"],
    Pacific: ["Golden State Warriors", "Los Angeles Clippers", "Los Angeles Lakers", "Phoenix Suns", "Sacramento Kings"],
    Southwest: ["Dallas Mavericks", "Houston Rockets", "Memphis Grizzlies", "New Orleans Pelicans", "San Antonio Spurs"],
  },
};

/**
 * { "Buffalo Bills": { table: "AFC", division: "East", order: 0 }, ... } —
 * `order` keeps the divisions in the order written above, which is how the
 * league lists them, rather than alphabetical.
 */
function flatten(conferences) {
  const out = {};
  for (const [conf, divisions] of Object.entries(conferences)) {
    Object.entries(divisions).forEach(([div, teams], order) => {
      for (const team of teams) out[team] = { table: conf, division: div, order };
    });
  }
  return out;
}

export const DIVISIONS = { nfl: flatten(nfl), nba: flatten(nba) };
