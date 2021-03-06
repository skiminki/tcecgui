// created by Steven Xia -- contributed to TCEC ------------------------------------------------------------------------
// todo: try to remove duplicate code for different colors (in `parse_pgn_for_crosstable()`)
const shlib = require("./lib.js");
const fs = require("fs");
const DISQUALIFIED_ENGINES = new Set([]);
const DQ_ADJUSTED = false;
const DQ_STRIKES = 3;
const argv = require('yargs').argv;                                                                                                                                                                   

// define the result, winner and text lookup tables ------------------------------------------------
const RESULT_LOOKUP = {
    "1-0": 1,
    "0-1": 0,
    "1/2-1/2": 0.5
};

const WINNER_LOOKUP = {
    "1-0": "White",
    "0-1": "Black",
    "1/2-1/2": "None"
};

const TEXT_LOOKUP = {
    1: "1",
    0: "0",
    0.5: "="
};


const NOT_CRASH_REGEX = new RegExp(
    "^(?:TCEC|Syzygy|No result|TB pos|.*to be resumed|adjudication|in progress|(?:White|Black) resigns|(?:White|Black) mates|Stale|Insuff|Fifty|3-[fF]old)",
    "i"
);


// parses event.pgn and converts into crosstable.json ----------------------------------------------
function pgn2crosstable(pgn) {
    // remove annoying Windows line engines... ---------------------------------
    pgn = pgn.replace(new RegExp("\r", "g"), "").trim();
    pgn = shlib.returnPGN(pgn);

    // create the crosstable ---------------------------------------------------
    const crosstable = {
        "Event": null,
        "Order": [],
        "Table": {},
        "Game": 1
    };

    // process the PGNs --------------------------------------------------------
    for (let index = 0; index < pgn.length; index++) {
        parse_pgn_for_crosstable(crosstable, pgn[index]);
        crosstable.Game += 1;
    }

    delete crosstable.Game;

    // calculate the scores (before other extra info) --------------------------
    for (let index = 0; index < crosstable.Order.length; index++) {
        get_score_and_games(crosstable, crosstable.Order[index]);
    }

    // calculate the extra info ------------------------------------------------
    for (let index = 0; index < crosstable.Order.length; index++) {
        get_extra_info(crosstable, crosstable.Order[index]);
    }

    // rank the engines --------------------------------------------------------
    rank_crosstable(crosstable);

    // get the abbreviations for the engines -----------------------------------
    get_abbreviations(crosstable);

    // return the crosstable ---------------------------------------------------
    return JSON.stringify(sort_object(crosstable), null, "\t");
}


// parses a single PGN for crosstable.json ---------------------------------------------------------
function parse_pgn_for_crosstable(crosstable, pgn) {
    // game object to store the data -------------------------------------------
    const game = {};

    // parse the headers for info ----------------------------------------------
    let inside_header = false;
    let header = null;
    let start_index = 0;
    let char;

    for (let index = 0; index < pgn.length; index++) {
        char = pgn.charAt(index);
        if (!inside_header && char === "[") {
            inside_header = true;
            start_index = index + 1;  // skip the current whitespace
        } else if (inside_header && header == null && char === " ") {
            header = pgn.substring(start_index, index);
            start_index = index + 2;  // skip the quote at the start of value.
        } else if (inside_header && header != null && char === "]") {
            game[header] = pgn.substring(start_index, index - 1);
            inside_header = false;
            header = null;

            if (pgn.charAt(index + 2) !== "[") {  // check if there are more headers
                pgn = pgn.substring(index + 2);
                break;
            }
        }
    }

    if (!game["Time"] && !game["GameDuration"])
    {
       console.log ("Failed for game:" + JSON.stringify(game));
       return;
    }

    // fill in values that haven't been filled in yet --------------------------
    if (crosstable.Event == null) {
        crosstable.Event = game.Event;
    }

    if (!crosstable.Order.includes(game["White"])) {
        crosstable.Order.push(game["White"]);
        crosstable.Table[game["White"]] = {
            // "Abbreviation": null,
            // "Elo": null,
            "Games": 0,
            "GamesAsBlack": 0,
            "GamesAsWhite": 0,
            // "Neustadtl": null,
            // "Performance": null,
            // "Rank": null,
            "Rating": parseInt(game["WhiteElo"]),
            "Results": {},
            "Score": 0,
            "Strikes": 0,
            "WinsAsBlack": 0,
            "WinsAsWhite": 0
        };
    }

    if (isNaN(crosstable.Table[game["White"]].Rating)) {
        crosstable.Table[game["White"]].Rating = Math.floor(3080 + 41 * Math.random());
    }

    if (!crosstable.Order.includes(game["Black"])) {
        crosstable.Order.push(game["Black"]);
        crosstable.Table[game["Black"]] = {
            // "Abbreviation": null,
            // "Elo": null,
            "Games": 0,
            "GamesAsBlack": 0,
            "GamesAsWhite": 0,
            // "Neustadtl": null,
            // "Performance": null,
            // "Rank": null,
            "Rating": parseInt(game["BlackElo"]),
            "Results": {},
            "Score": 0,
            "Strikes": 0,
            "WinsAsBlack": 0,
            "WinsAsWhite": 0
        };
    }

    if (isNaN(crosstable.Table[game["Black"]].Rating)) {
        crosstable.Table[game["Black"]].Rating = Math.floor(3080 + 41 * Math.random());
    }

    // edit the `white` player's crosstable ------------------------------------
    const white_table = crosstable.Table[game["White"]];

    if (typeof (white_table.Results[game["Black"]]) === "undefined") {
        white_table.Results[game["Black"]] = {
            "Scores": [],
            "Text": ""
        }
    }

    white_table.Results[game["Black"]].Scores.push({
        "Game": crosstable.Game,
        "Result": RESULT_LOOKUP[game["Result"]],
        "Winner": WINNER_LOOKUP[game["Result"]],
        "Side": "White"
    });

    white_table.Results[game["Black"]].Text += TEXT_LOOKUP[RESULT_LOOKUP[game["Result"]]];

    // edit the `black` player's crosstable ------------------------------------
    const black_table = crosstable.Table[game["Black"]];

    if (typeof (black_table.Results[game["White"]]) === "undefined") {
        black_table.Results[game["White"]] = {
            "Scores": [],
            "Text": ""
        }
    }

    black_table.Results[game["White"]].Scores.push({
        "Game": crosstable.Game,
        "Result": 1 - RESULT_LOOKUP[game["Result"]],
        "Winner": WINNER_LOOKUP[game["Result"]],
        "Side": "Black"
    });

    black_table.Results[game["White"]].Text += TEXT_LOOKUP[1 - RESULT_LOOKUP[game["Result"]]];

    // add to `Strikes` if needed ----------------------------------------------
    if (!game["TerminationDetails"])
    {
       if (game["Termination"])
       {
          game["TerminationDetails"] = game["Termination"];
       }
    }

    try {
       if (!game["TerminationDetails"].match(NOT_CRASH_REGEX)) {
           if (RESULT_LOOKUP[game["Result"]] === 1) {
               crosstable.Table[game["Black"]].Strikes += 1;
           } else if (RESULT_LOOKUP[game["Result"]] === 0) {
               crosstable.Table[game["White"]].Strikes += 1;
           } else {
               crosstable.Table[game["White"]].Strikes += 1;
               crosstable.Table[game["Black"]].Strikes += 1;
           }

           if (crosstable.Table[game["White"]].Strikes >= DQ_STRIKES) {
               DISQUALIFIED_ENGINES.add(game["White"]);
           }

           if (crosstable.Table[game["Black"]].Strikes >= DQ_STRIKES) {
               DISQUALIFIED_ENGINES.add(game["Black"]);
           }
       }
    }
    catch (err) {
       console.log ("Failed for game:" + JSON.stringify(game) + " ,Errro is :" + err);
       }
}


// process the score and games info ----------------------------------------------------------------
function get_score_and_games(crosstable, engine) {
    const engine_table = crosstable.Table[engine];

    let opponent;
    let opponent_table;
    let score = 0;
    let keys = Object.keys(engine_table.Results);
    for (let opponent_index = 0; opponent_index < keys.length; opponent_index++) {
        opponent = keys[opponent_index];

        if (DQ_ADJUSTED && DISQUALIFIED_ENGINES.has(opponent)) {
            continue;
        }

        opponent_table = engine_table.Results[opponent].Scores;
        for (let index = 0; index < opponent_table.length; index++) {
            if (opponent_table[index].Side === "White") {
                engine_table.GamesAsWhite += 1;
            } else {
                engine_table.GamesAsBlack += 1;
            }
            engine_table.Games += 1;

            score += opponent_table[index].Result;

            if (opponent_table[index].Result === 1) {
                if (opponent_table[index].Winner === "White") {
                    engine_table.WinsAsWhite += 1;
                } else {
                    engine_table.WinsAsBlack += 1;
                }
            }
        }
    }
    engine_table.Score = score;
}


// process the extra info for a particular engine --------------------------------------------------
function get_extra_info(crosstable, engine) {
    const engine_table = crosstable.Table[engine];

    // find performance --------------------------------------------------------
    engine_table.Performance = 100 * engine_table.Score / engine_table.Games;

    // find Neustadtl (Sonneborn–Berger) score ---------------------------------
    let neustadtl_score = 0;
    let opponent;
    let opponent_score;
    let keys = Object.keys(engine_table.Results);
    for (let opponent_index = 0; opponent_index < keys.length; opponent_index++) {
        opponent = keys[opponent_index];

        if (DQ_ADJUSTED && DISQUALIFIED_ENGINES.has(opponent)) {
            continue;
        }

        opponent_score = crosstable.Table[opponent].Score;
        for (let index = 0; index < engine_table.Results[opponent].Scores.length; index++) {
            neustadtl_score += engine_table.Results[opponent].Scores[index].Result * opponent_score;
        }
    }
    engine_table.Neustadtl = neustadtl_score;

    // todo: finish this ... (calculate "Elo")
}


// get the rankings of all the engines and sort `crosstable.Order` ---------------------------------
function rank_crosstable(crosstable) {
    const compare_function = function (engine1, engine2) {
        engine1 = crosstable.Table[engine1];
        engine2 = crosstable.Table[engine2];
        if (DQ_ADJUSTED && engine1.Strikes >= DQ_STRIKES && engine2.Strikes < DQ_STRIKES) {
            return 1;
        } else if (DQ_ADJUSTED && engine1.Strikes < DQ_STRIKES && engine2.Strikes >= DQ_STRIKES) {
            return -1;
        } else if (engine1.Score === engine2.Score) {
            return engine2.Neustadtl - engine1.Neustadtl;
        } else {
            return engine2.Score - engine1.Score;
        }
    };

    crosstable.Order = crosstable.Order.sort(compare_function);

    for (let index = 0; index < crosstable.Order.length; index++) {
        crosstable.Table[crosstable.Order[index]].Rank = index + 1;
    }
}


// get the abbreviations of the engines ------------------------------------------------------------
function get_abbreviations(crosstable) {
    let abb = [];
    for (let i = 0; i < crosstable.Order.length; i++) {
        let cur = crosstable.Order[i];
        let abbrev = cur.substring(0, 2);
        for (let j = 2; abb.indexOf(abbrev) !== -1 && j < cur.length; j++) {
            abbrev = cur.charAt(0) + cur.charAt(j);
        }
        crosstable.Table[cur].Abbreviation = abbrev;
        abb.push(abbrev);
    }
}


// copied from https://alpha.tcecbeta.club/dist/js/pgnutil.js ----------------------------------------------------------
function splitPgnsString(text) {
    let arr = text.split(/((?:1-0|1\/2-1\/2|0-1)\n\n)/);
    let res = [];
    let j = 0;
    for (let i = 0; i < arr.length; i = i + 2) {
        res[j++] = arr[i] + arr[i + 1];
    }
    return res;
}


// copied from `pgn2json.js` -------------------------------------------------------------------------------------------
// sort an object (only to better compare it in testing, it's fast enough to keep in the final code though)
function sort_object(object) {
    if (Array.isArray(object)) {
        for (let index = 0; index < object.length; index++) {
            if (typeof object[index] === "object") {
                object[index] = sort_object(object[index]);
            } else {
                object[index] = object[index];
            }
        }

        return object;
    } else {
        const sorted_object = {};

        const keys = Object.keys(object).sort();
        let key;
        for (let index = 0; index < keys.length; index++) {
            key = keys[index];

            // Uncomment for removing the extra `Side` attribute that I created
            // to count the games per side that I didn't actually need because
            // it was already done in the gui... :/ that's dabad.
            // if (key === "Side") {
            //     continue
            // }

            if (typeof object[key] === "object") {
                sorted_object[key] = sort_object(object[key]);
            } else {
                sorted_object[key] = object[key];
            }
        }

        return sorted_object;
    }
}

var filename = argv.tag;
var seasonFileName = argv.filename;
var pgnPath = '/var/www/json/archive/';
var seasonFileNameFull = pgnPath + seasonFileName;
const pgn = fs.readFileSync(seasonFileNameFull, "utf-8");
var crossName = filename + '_' + 'Crosstable.cjson';

var res = shlib.returnPGN(pgn);
var force = argv.force;

if (force == undefined || force == 'undefined')
{
   force = 0;
}

console.log ("Res lenght is :" + res.length);

if (force || !fs.existsSync(crossName))
{
   console.log ("Generating schedule file:" + crossName);
   const output_json = pgn2crosstable(pgn);
   fs.writeFileSync(crossName, output_json);
}

console.log ("done Converting file:" + filename);
