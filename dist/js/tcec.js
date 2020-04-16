// tcec.js
// included after: common, engine
/*
globals
_, $, Abs, add_timeout, addDataLive, Assign, Attrs, audiobox, bigData, board:true, BOARD_THEMES,
C, Ceil, charts, Chess, ChessBoard, Clamp, Class, clear_timeout, clearInterval, ClipboardJS, columnsEvent, console,
create_charts, crosstableData, Date, DefaultFloat, DEV, document, dummyCross, engine_colors, Exp, Floor, get_int,
get_string, Hide, HTML, Keys,
LS, Max, Min, moment, Now, Pad, PIECE_THEMES, play_sound, Pow, Prop, removeData, reset_charts, Resource, Round,
roundDate, roundDateMan, roundResults:true,
S, save_option, screen, setInterval, setTimeout, Show, Sign, socket, startDateR1, startDateR2, Style, teamsx,
updateChartData, updateChartDataLive, updateCrosstable, window, Y
*/
'use strict';

let _BLACK = 'black',
    _WHITE = 'white',
    activePly = 0,
    activePvKey = [],
    all_engines = ['w', 'b'],          // w,b full engine names
    all_pvs = [[], []],
    isAutoplay,
    BL = 1,
    board,
    clock_intervals = ['', ''],
    COLORS = {
        black: 1,
        Black: 1,
        live: 2,
        white: 0,
        White: 0,
    },
    currentGameActive,
    currentLastMove,                    // used for debugging
    currentMove,
    current_positions = [],
    defaultStartTime = 0,
    ENGINE_FEATURES = {
        AllieStein: 1,                  // & 1 => NN engine
        LCZero: 3,                      // & 2 => Leela variations
    },
    engine2LiveData,
    FEATURE_LEELA = 2,
    FEATURE_NN = 1,
    game,
    LIVE = 2,
    moveFrom,
    moveFromPvs = [],
    moveTo,
    moveToPvs = [],
    newMovesCount = 0,
    pvBoarda,
    pvBoardb,
    pvBoardbc,
    pvBoardw,
    pvBoardwc,
    remain_times = [0, 0],
    started_moves = [0, 0],
    turn = 0,                           // 0:white to play, 1:black to play
    used_times = [0, 0],
    WH = 0,
    WHITE_BLACK = [_WHITE, _BLACK, 'live'];

var timezoneDiffH = -8;
var squareToHighlight = '';
var pvSquareToHighlight = '';
var crossTableInitialized = false;
var gameActive = false;

var viewingActiveMove = true;
var loadedPlies = 0;

var activeFen = '';
var lastMove = '';
var currentPosition = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
var analysFen = currentPosition;
var bookmove = 0;

// use Y.theme instead
var darkMode = 0;

var pageNum = 1;
var gamesDone = 0;
var timeDiff = 0;
var timeDiffRead = 0;
var prevPgnData = 0;
var globalGameno = 1;
var choosePv;

var liveEngineEval1 = [];
var liveEngineEval2 = [];
var debug = 0;
var h2hRetryCount = 0;
var h2hScoreRetryCount = 0;

var livePVHist = [];
var livePvs = [];
var activePv = [];
var highlightpv = 0;
var showLivEng1 = 1;
var showLivEng2 = 1;
var selectedId = 0;
var highlightClass = 'highlight-white highlight-none';
var highlightClassPv = 'highlight-white highlight-none';
var tcecElo = 1;
var engineRatingGlobalData = 0;
var tourInfo = {};
var oldSchedData = null;
var activePvH = [];

var hideDownPv = 0;

var twitchAccount = 'TCEC_Chess_TV';
var twitchChatUrl = 'https://www.twitch.tv/embed/' + twitchAccount + '/chat';
var twitchSRCIframe = 'https://player.twitch.tv/?channel=' + twitchAccount;

var eventNameHeader = 0;
var lastRefreshTime = 0;
var userCount = 0;
var globalRoom = 0;

var standColumns = [];
var prevevalData = {};

/***************************** CUP ***************************************************/
var totalEvents = 32;
var gameDiff = 0;
var eventCross = [];
/***************************** CUP ***************************************************/

var isPvAutoplay = [false, false];
var crash_re = /^(?:TCEC|Syzygy|TB pos|.*to be resumed|in progress|(?:White|Black) resigns|Manual|(?:White|Black) mates|Stale|Insuff|Fifty|3-[fF]old)/; // All possible valid terminations (hopefully).

var gameArrayClass = ['#39FF14', 'red', 'whitesmoke', 'orange'];
var numberEngines = 0;
var regexBlackMove = /^[0-9]{1,3}\.\.\./;
var clearedAnnotation = 0;

var columnsEng = [
    {
       field: 'Name'
    },
    {
       field: 'Value'
    }
    ];

var onMoveEnd = function() {
    Class(`#board .square-${squareToHighlight}`, highlightClass);
};

var onMoveEndPv = function() {
    Class(`#pv-boardb .square-${pvSquareToHighlight}`, highlightClassPv);
};

function getUserS()
{
   socket.emit('getusers', 'd');
}

function updateRefresh()
{
   if (lastRefreshTime)
      return;

   socket.emit('refreshdata', 'data is emitted');
   lastRefreshTime = moment();
   eventCrosstableWrap();
   if (prevPgnData && prevPgnData.Moves)
   {
      //prevPgnData.Moves[0].completed = 0;
   }
   Class('#board-to-sync i', '-fa-retweet fa-ban');
   Class('#board-to-sync', 'disabled');

    add_timeout('update_refresh', () => {
        Class('#board-to-sync i', '-fa-ban fa-retweet');
        Class('#board-to-sync', '-disabled');
        lastRefreshTime = 0;
    }, 30000);
}

function updateAll()
{
   eventNameHeader = 0;
   updatePgn(1);
   add_timeout('update_all', () => {updateTables();}, 5000);
}

function updatePgnDataMain(data)
{
   if (!prevPgnData)
   {
      updateEngineInfo('#whiteenginetable', '#white-engine-info', data.WhiteEngineOptions);
      updateEngineInfo('#blackenginetable', '#black-engine-info', data.BlackEngineOptions);
   }
   else
   {
      if (data.WhiteEngineOptions != prevPgnData.WhiteEngineOptions)
      {
         updateEngineInfo('#whiteenginetable', '#white-engine-info', data.WhiteEngineOptions);
      }
      if (data.BlackEngineOptions != prevPgnData.BlackEngineOptions)
      {
         updateEngineInfo('#blackenginetable', '#black-engine-info', data.BlackEngineOptions);
      }
   }
   setPgn(data);
}

function updatePgnData(data, read)
{
   timeDiff = 0;
   updatePgnDataMain(data);
}

function updatePgn(resettime)
{
    eventNameHeader = 0;
    Resource(`live.json?no-cache${Now()}`, (code, data, xhr) => {
        if (code != 200)
            return;
        if (!resettime)
        {
            let curr_time = new Date(xhr.getResponseHeader('date')),
                last_mod = new Date(xhr.getResponseHeader('last-modified'));
            timeDiff = curr_time.getTime() - last_mod.getTime();
        }
        prevPgnData = 0;
        data.gameChanged = 1;
        updatePgnDataMain(data);
    });
}

/**
 * Start the clock
 * @param {number} color
 * @param {Object} currentMove
 * @param {Object} previousMove
 */
function startClock(color, currentMove, previousMove) {
    stopClock(BL);
    stopClock(WH);

    let other = 1 - color,
        previousTime = previousMove.tl,
        currentTime = currentMove.tl;

    remain_times[color] = DefaultFloat(Ceil(previousTime / 1000) * 1000 + 1000, defaultStartTime);
    remain_times[other] = DefaultFloat(Ceil(currentTime / 1000) * 1000, defaultStartTime);

    setTimeRemaining(other, remain_times[other]);

    started_moves[color] = moment();
    updateClock(color);

    clock_intervals[color] = setInterval(function() {updateClock(color);}, 1000);
    if (currentMove.mt != undefined)
        setTimeUsed(other, currentMove.mt);

   Show(`.${WHITE_BLACK[color]}-to-move`);
}

/**
 * Stop the clock
 * @param {number} color
 */
function stopClock(color) {
    clearInterval(clock_intervals[color]);
    Hide(`.${WHITE_BLACK[color]}-to-move`);
}

/**
 * Update the clock
 * @param {number} color
 */
function updateClock(color) {
    let currentTime = moment(),
        diff = currentTime.diff(started_moves[color] - timeDiff),
        ms = moment.duration(diff);

    used_times[color] = ms;
    setTimeUsed(color, ms);
    setTimeRemaining(color, remain_times[color] - ms + 3000);
}

function secFormatNoH(timeip)
{
   var sec_num = parseInt(timeip/1000, 10); // don't forget the second param
   var hours   = Floor(sec_num / 3600);
   var minutes = Floor((sec_num - (hours * 3600)) / 60);
   var seconds = sec_num - (hours * 3600) - (minutes * 60);

   if (hours   < 10) {hours   = "0"+hours;}
   if (minutes < 10) {minutes = "0"+minutes;}
   if (seconds < 10) {seconds = "0"+seconds;}
   return minutes+':'+seconds;
}

function secFormat(timeip)
{
   var sec_num = parseInt(timeip/1000, 10); // don't forget the second param
   var hours   = Floor(sec_num / 3600);
   var minutes = Floor((sec_num - (hours * 3600)) / 60);
   var seconds = sec_num - (hours * 3600) - (minutes * 60);

   if (hours   < 10) {hours   = "0"+hours;}
   if (minutes < 10) {minutes = "0"+minutes;}
   if (seconds < 10) {seconds = "0"+seconds;}
   return hours+':'+minutes+':'+seconds;
}

function setTimeRemaining(color, time)
{
    if (viewingActiveMove)
        HTML(`.${WHITE_BLACK[color]}-time-remaining`, secFormat(Max(0, time)));
}

function setTimeUsed(color, time) {
   if (viewingActiveMove)
      HTML(`.${WHITE_BLACK[color]}-time-used`, secFormatNoH(time));
}

function setUsers(data)
{
    if (data.count != undefined)
        userCount = data.count;

    setUsersMain(userCount);
}

function setUsersMain(count)
{
    if (count != undefined)
        userCount = count;

    $('#event-overview').bootstrapTable('updateCell', {index: 0, field: 'Viewers', value: userCount});
}

function listPosition()
{
   if (board)
   {
      let getPos = board.position();
      if (getPos)
         return Keys(getPos).length - 6;
   }
   return '-';
}

/**
 * Show a chess move
 * @param {string} sel node selector, ex: #board
 * @param {number} moveFrom
 * @param {number} moveTo
 * @param {string=} class_
 */
function show_move(sel, moveFrom, moveTo, class_) {
    if (!class_)
        class_ = highlightClass;

    Class(`${sel} .square-55d63`, class_, false);
    Class(`${sel} .square-${moveFrom}`, class_);
    Class(`${sel} .square-${moveTo}`, class_);
}

function setPgn(pgn)
{
   var currentPlyCount = 0;

   if (!viewingActiveMove)
   {
      Class('#newmove', '-d-none');
      newMovesCount ++;
      Attrs('#newmove', 'data-count', newMovesCount);
   }
   else
   {
      Class('#newmove', 'd-none');
      newMovesCount = 0;
      Attrs('#newmove', 'data-count', 0);
   }

    if (pgn.Moves && (DEV.ply & 1))
        LS("XXX: Entered for pgn.Moves.length:" + pgn.Moves.length + " , round is :" + pgn.Headers.Round);

   if (pgn.gameChanged) {
      eventNameHeader = 0;
      prevPgnData = pgn;
      prevPgnData.gameChanged = 0;
      setInfoFromCurrentHeaders();
      updateH2hData();
      updateScoreHeadersData();
        if (DEV.ply & 1)
            LS("New game, round is :" + parseFloat(pgn.Headers.Round));
   }
   else {
        if (DEV.ply & 1)
            LS("prevPgnData.Moves.length:" + prevPgnData.Moves.length + " ,pgn.lastMoveLoaded:" + pgn.lastMoveLoaded);
      if (parseFloat(prevPgnData.Headers.Round) != parseFloat(pgn.Headers.Round))
      {
         eventNameHeader = 0;
         add_timeout('update_pgn', () => {updatePgn(1);}, 100);
         return;
      }
      if (prevPgnData.Moves.length < pgn.lastMoveLoaded)
      {
         eventNameHeader = 0;
         add_timeout('update_all', () => {updateAll();}, 100);
         return;
      }
      updateH2hData();
      updateScoreHeadersData();
   }

   if (prevPgnData) {
      for (let i = 0 ; i < pgn.totalSent ; i++) {
         prevPgnData.Moves[i + pgn.lastMoveLoaded] = pgn.Moves[i];
      }
      prevPgnData.BlackEngineOptions = pgn.BlackEngineOptions;
      prevPgnData.WhiteEngineOptions = pgn.WhiteEngineOptions;
      prevPgnData.Headers = pgn.Headers;
      prevPgnData.Users = pgn.Users;
      pgn = prevPgnData;
   }
    else if (pgn.Moves)
        prevPgnData = pgn;

   if (pgn.Moves)
      currentPlyCount = pgn.Moves.length;

    if (pgn.Headers) {
        if (pgn.Moves && pgn.Moves.length > 0) {
            currentPosition = pgn.Moves[pgn.Moves.length-1].fen;
            moveFrom = pgn.Moves[pgn.Moves.length-1].from;
            moveTo = pgn.Moves[pgn.Moves.length-1].to;

            currentGameActive = (pgn.Headers.Termination == 'unterminated');
            turn = currentPlyCount % 2;
        }
    }

    if (!currentGameActive) {
        stopClock(WH);
        stopClock(BL);
    }
    else
        stopClock(turn);

    if (DEV.ply & 1)
        LS(`XXX: loadedPlies=${loadedPlies} : currentPlyCount=${currentPlyCount} : currentGameActive=${currentGameActive}`
            + `gameActive=${gameActive} : gameChanged=${pgn.gameChanged}`);
    if (loadedPlies == currentPlyCount && (currentGameActive == gameActive))
        return;

    if (timeDiffRead > 0)
        timeDiff = 0;

    let previousPlies = loadedPlies;

    loadedPlies = currentPlyCount;
    gameActive = currentGameActive;

    if (activePly == 0) {
        activePly = currentPlyCount;
        viewingActiveMove = true;
    }
    if (activePly == currentPlyCount) {
        viewingActiveMove = true;
        Class('#newmove', 'd-none');
        newMovesCount = 0;
        Attrs('#newmove', 'data-count', 0);
        board.clearAnnotation();
    }
    if (viewingActiveMove && activePly != currentPlyCount) {
        activePly = currentPlyCount;
        if (Y.sound)
            play_sound(audiobox, 'move', {ext: 'mp3', interrupt: true});
    }

    // new game has started?
    if (previousPlies > currentPlyCount) {
        create_charts();
        reset_charts();
    }

    let whiteEval = {},
        blackEval = {};

    activeFen = pgn.Moves[pgn.Moves.length - 1].fen;
    if (viewingActiveMove) {
        currentMove = pgn.Moves[pgn.Moves.length - 1];
        lastMove = currentMove.to;
        setMoveMaterial(currentMove.material, 0);
    }

    let eval_ = getEvalFromPly(pgn.Moves.length - 1);
    if (turn)
        whiteEval = eval_;
    else
        blackEval = eval_;

    let clockCurrentMove = currentMove,
        clockPreviousMove = '';

    if (pgn.Moves.length > 1) {
        let eval_ = getEvalFromPly(pgn.Moves.length-2),
            selectedMove = pgn.Moves[pgn.Moves.length-2];
        clockPreviousMove = selectedMove;

        if (!turn)
            whiteEval = eval_;
        else
            blackEval = eval_;
    }

    if (viewingActiveMove) {
        updateMoveValues(whiteEval, blackEval);
        findDiffPv(whiteEval.pv, blackEval.pv);
        updateEnginePv(WH, whiteEval.pv);
        updateEnginePv(BL, blackEval.pv);
    }

    if (!turn)
    {
        if (pgn.Headers.WhiteTimeControl)
            pgn.Headers.TimeControl = pgn.Headers.WhiteTimeControl;
    }
    else if (pgn.Headers.BlackTimeControl)
        pgn.Headers.TimeControl = pgn.Headers.BlackTimeControl;

    let TC = pgn.Headers.TimeControl.split("+"),
        base = Round(TC[0] / 60);

    TC = base + "'+" + TC[1] + '"';
    pgn.Headers.TimeControl = TC;
    defaultStartTime = (base * 60 * 1000);

    if (currentGameActive)
        startClock(turn, clockCurrentMove, clockPreviousMove);
    else
    {
        stopClock(WH);
        stopClock(BL);
    }

    if (viewingActiveMove) {
        if (pgn.Moves.length > 0) {
            show_move('#board', moveFrom, moveTo);
            squareToHighlight = moveTo;
        }
        board.position(currentPosition, false);
    }

    if (pgn.Headers == undefined) {
        if (DEV.ply & 1)
            LS("XXX: Returning here because headers not defined");
        return;
    }

    listPosition();

    // title + favicon
    let title = "TCEC - Live Computer Chess Broadcast";
    if (pgn.Moves.length > 0) {
        title = pgn.Headers.White + ' vs. ' + pgn.Headers.Black + ' - ' + title;
        let is_black = (pgn.Moves.PlyCount % 2 == 0 || pgn.Headers.Termination != 'unterminated');
        Attrs('#favicon', 'href', `img/favicon${is_black? 'b': ''}.ico`);
    }
    document.title = title;

    let termination = pgn.Headers.Termination;
    if (pgn.Moves.length > 0) {
        let adjudication = pgn.Moves[pgn.Moves.length - 1].adjudication,
            piecesleft = listPosition();
        pgn.Headers.piecesleft = piecesleft;

        if (eventNameHeader == 0)
        {
            eventNameHeader = pgn.Headers.Event;
            let eventTmp = eventNameHeader.match(/TCEC Season (.*)/);
            if (eventTmp)
            {
                if (DEV.ply & 1)
                    LS(eventTmp[1]);
                pgn.Headers.Event = "S" + eventTmp[1];
                eventNameHeader = pgn.Headers.Event;
            }
        }
        else
            pgn.Headers.Event = eventNameHeader;

        let finished;

        if (termination == 'unterminated' && adjudication) {
            termination = '-';
            let movesToDraw = 50,
                movesToResignOrWin = 50,
                movesTo50R = 50;

            if (Abs(adjudication.Draw) <= 10 && pgn.Moves.length > 58)
                movesToDraw = Max(Abs(adjudication.Draw), 69 - pgn.Moves.length);

            if (Abs(adjudication.ResignOrWin) < 11)
                movesToResignOrWin = Abs(adjudication.ResignOrWin);

            if (adjudication.FiftyMoves < 51)
                movesTo50R = adjudication.FiftyMoves;

            if (movesTo50R < 50 && movesTo50R < movesToResignOrWin)
            {
                termination = `${movesTo50R} move${(movesTo50R > 1)? 's': ''} 50mr`;
                pgn.Headers.movesTo50R = movesTo50R;
            }

            if (movesToResignOrWin < 50 && movesToResignOrWin < movesToDraw && movesToResignOrWin < movesTo50R)
            {
                termination = `${movesToResignOrWin} pl${(movesToDraw > 1)? 'ies': 'y'} win`;
                pgn.Headers.movesToResignOrWin = movesToResignOrWin;
            }

            if (movesToDraw < 50 && movesToDraw <= movesTo50R && movesToDraw <= movesToResignOrWin)
            {
                termination = `${movesToDraw} pl${(movesToDraw > 1)? 'ies': 'y'} draw`;
                pgn.Headers.movesToDraw = movesToDraw + 'p';
            }
        }
        else {
            pgn.Headers.Termination = pgn.Headers.TerminationDetails;
            if (DEV.ply & 1)
                LS("pgn.Headers.Termination: yes" + pgn.Headers.Termination);

            if (pgn.Headers.Termination && pgn.Headers.Termination != 'undefined')
                finished = true;
        }

        // show/hide
        let class1 = finished? 'show': 'hide',
            class2 = finished? 'hide': 'show';
        $('#event-overview').bootstrapTable(`${class1}Column`, 'Termination');
        $('#event-overview').bootstrapTable(`${class2}Column`, 'movesToDraw');
        $('#event-overview').bootstrapTable(`${class2}Column`, 'movesToResignOrWin');
        $('#event-overview').bootstrapTable(`${class2}Column`, 'movesTo50R');
    }

    $('#event-overview').bootstrapTable('load', [pgn.Headers]);
    setUsersMain(pgn.Users);
    HTML('#event-name', pgn.Headers.Event);

    if (viewingActiveMove)
        setInfoFromCurrentHeaders();

    updateChartData();

    HTML('#engine-history', '');
    Keys(pgn.Moves).forEach(key => {
        key *= 1;
        let move = pgn.Moves[key],
            ply = key + 1;
        if (key % 2 == 0) {
            let number = (key / 2) + 1,
                numlink = "<a class='numsmall'>" + number + ". </a>";
            $('#engine-history').append(numlink);
        }

        let linkClass = "";
        if (activePly == ply)
            linkClass = "active-move";

        if (move.book == true)
        {
            linkClass += " green";
            bookmove = ply;
        }

        let link = "<a href='#' ply='" + ply + "' fen='" + move.fen + "' from='" + move.from + "' to='" + move.to + "' class='change-move " + linkClass + "'>" + move.m + "</a>";
        $('#engine-history').append(link + ' ');
    });
    $('#engine-history').append(pgn.Headers.Result);
    $("#engine-history").scrollTop($("#engine-history")[0].scrollHeight);

    if (pgn.gameChanged && (DEV.ply & 1))
        LS("Came to setpgn need to reread data at end");
}

function copyFenAnalysis()
{
   var clip = new ClipboardJS('.btn', {
      text: function(trigger) {
         return analysFen;
      }
   });
   return false;
}

function copyFenWhite()
{
    let clip = new ClipboardJS('.btn', {
      text: function(trigger) {
         return current_positions[WH];
      }
   });
   return false;
}

function copyFenBlack()
{
    let clip = new ClipboardJS('.btn', {
      text: function(trigger) {
         return current_positions[BL];
      }
   });
   return false;
}

function copyFen()
{
   var clip = new ClipboardJS('.btn', {
      text: function(trigger) {
         return currentPosition;
      }
   });
   return false;
}

/**
 * Get the short name of an engine
 * @param {string} engine Stockfish 20200407DC
 * @returns {string} Stockfish
 */
function getShortEngineName(engine)
{
    return engine.includes('Baron')? 'Baron': engine.split(' ')[0];
}

function setInfoFromCurrentHeaders()
{
    ['White', 'Black'].forEach((key, id) => {
        let color = WHITE_BLACK[id],
            header = prevPgnData.Headers[key],
            name = getShortEngineName(header);
         all_engines[id] = header;

        HTML(`.${color}-engine-name`, name);
        HTML(`.${color}-engine-name-full`, header);
        Attrs(`#${color}-engine`, 'src', `img/engines/${name}.jpg`);
        Attrs(`#${color}-engine`, 'alt', header);
        Attrs(`#${color}-engine-chessprogramming`, 'href', `https://www.chessprogramming.org/${name}`);
    });
}

function getMoveFromPly(ply)
{
   return prevPgnData.Moves[ply];
}

/**
 * Format a number:
 * - B: billion, M: million, K: thousand
 * - NaN => n/a
 * @param {number} number
 * @returns {number}
 */
function formatUnit(number)
{
    if (isNaN(number))
        number = 'N/A';
    else if (number > 1e9)
        number = `${Floor(number / 1e8) / 10}B`;
    else if (number > 1e6)
        number = `${Floor(number / 1e5) / 10}M`;
    else if (number > 1000)
        number = `${Floor(number / 100) / 10}k`;
    else
        number = `${Floor(number)}`;

    return number;
}

function getEvalFromPly(ply)
{
    let selectedMove = prevPgnData.Moves[ply],
        side = turn? 'White': 'Black';

   if (ply < 0)
   {
      return {
         'side': side,
         'eval': "n/a",
         'pv': {},
         'speed': "n/a",
         'nodes': "n/a",
         'mtime': "n/a",
         'depth': "n/a",
         'tbhits': "n/a",
         'timeleft': "n/a"
      };
   }

   //arun
   if (ply < bookmove)
   {
      return {
         'side': side,
         'eval': "book",
         'pv': {},
         'speed': "book",
         'nodes': "book",
         'mtime': "book",
         'depth': "book",
         'tbhits': "book",
         'timeleft': "book"
      };
   }

   //arun
   if (selectedMove == undefined || selectedMove.pv == undefined)
   {
      return {
         'side': side,
         'eval': 0,
         'pv': {},
         'speed': "n/a",
         'nodes': "n/a",
         'mtime': "n/a",
         'depth': "n/a",
         'tbhits': "n/a",
         'timeleft': "n/a"
      };
   }

    let //clockPreviousMove = selectedMove,
        speed = selectedMove.s;
   if (speed < 1000000) {
      speed = Round(speed / 1000) + ' knps';
   } else {
      speed = Round(speed / 1000000) + ' Mnps';
   }

    let nodes = formatUnit(selectedMove.n),
        depth = selectedMove.d + '/' + selectedMove.sd,
        tbHits = formatUnit(selectedMove.tb),
        evalRet = DefaultFloat(selectedMove.wv, 'N/A');

    if (Number.isFinite(evalRet))
        evalRet = evalRet.toFixed(2);

   return {
      'side': side,
      'eval': evalRet,
      'pv': selectedMove.pv.Moves,
      'speed': speed,
      'nodes': nodes,
      'mtime': secFormatNoH(selectedMove.mt),
      'depth': depth,
      'tbhits': tbHits,
      'timeleft': secFormat(selectedMove.tl),
   };
}

// The function was posted by "ya" in the Leela Chess Zero Discord channel
// https://discordapp.com/channels/425419482568196106/430695662108278784/618146099269730342
function leelaCpToQ(cp) {
   return cp < 234.18
      ? 0.0033898305085 * cp -
           (8.76079436769e-38 * Pow(cp, 15)) /
              (3.618208073857e-34 * Pow(cp, 14) + 1.0) +
           (cp * (-3.4456396e-5 * cp + 0.007076010851)) /
              (cp * cp - 487.329812319 * cp + 59486.9337812)
      : cp < 381.73
      ? (-17.03267913 * cp + 3342.55947265) /
           (cp * cp - 360.8419732 * cp + 32568.5395889) +
        0.995103
      : (35073.0 * cp) / (755200.0 + 35014.0 * cp) +
        ((0.4182050082072 * cp - 2942.6269998574) /
           (cp * cp - 128.710949474 * cp - 6632.9691544526)) *
           Exp(-Pow((cp - 400.0) / 7000.0, 3)) -
        5.727639074137869e-8;
}

function leelaEvalToWinPct(eval_) {
    let q = Sign(eval_) * leelaCpToQ(Abs(eval_) * 100);
    return Round(100 * 100 * q) / 200;
}

/**
 * Get eval points
 * - works for AA and NN engines
 * @param {string} engineName full engine name
 * @param {number} eval_
 * @returns {string}
 */
function getPct(engineName, eval_)
{
    if (isNaN(eval_))
        return `${engineName} ${eval_}`;

    let whiteWinPct,
        shortName = getShortEngineName(engineName),
        feature = ENGINE_FEATURES[shortName];

    // adjust the score
    if (feature & FEATURE_NN) {
        if (feature & FEATURE_LEELA)
            whiteWinPct = leelaEvalToWinPct(eval_);
        else
            whiteWinPct = (Math.atan((eval_ * 100) / 290.680623072) / 3.096181612 + 0.5) * 100 - 50;
    }
    else
        whiteWinPct = (50 - (100 / (1 + Pow(10, eval_/ 4))));

    // final output
    let reverse = 0;
    if (eval_ < 0)
    {
        reverse = 1;
        whiteWinPct = -whiteWinPct;
    }
    let winEval = parseFloat(Max(0, whiteWinPct * 2)).toFixed(1),
        drawEval = parseFloat(100 - Max(winEval, 0)).toFixed(1),
        text = `${shortName} ${eval_} `;
    if (winEval == 0)
        text += ` [${drawEval}% D]`;
    else
        text += ` [${winEval}% ${reverse? 'B': 'W'} | ${drawEval}% D]`;
    return text;
}

function updateMoveValues(whiteEval, blackEval)
{
    /* Ben: Not sure why we need to update only if we are not viewing active move */
    if (!viewingActiveMove)
    {
        HTML('.white-time-used', whiteEval.mtime);
        HTML('.black-time-used', blackEval.mtime);
        HTML('.white-time-remaining', whiteEval.timeleft);
        HTML('.black-time-remaining', blackEval.timeleft);
    }
    else
    {
        if (!turn)
        {
            HTML('.black-time-remaining', blackEval.timeleft);
            HTML('.black-time-used', blackEval.mtime);
        }
        else
        {
            HTML('.white-time-used', whiteEval.mtime);
            HTML('.white-time-remaining', whiteEval.timeleft);
        }
    }

    HTML('.white-engine-eval', whiteEval.eval);

    let blackEvalPt = getPct(prevPgnData.Headers.Black, blackEval.eval),
        whiteEvalPt = getPct(prevPgnData.Headers.White, whiteEval.eval);
    HTML('.black-engine-name-full-new', blackEvalPt);
    HTML('.white-engine-name-full-new', whiteEvalPt);
    //$(eval a=(((((Math.atan(($(query)100)/290.680623072))/3.096181612)+0.5)100)-50);
    //lose=Max(0,a-2); draw=(100-Max(win,lose)).toFixed(2); win=win.toFixed(2); lose=lose.toFixed(2);
    HTML('.white-engine-speed', whiteEval.speed);
    HTML('.white-engine-nodes', whiteEval.nodes);
    HTML('.white-engine-depth', whiteEval.depth);
    HTML('.white-engine-tbhits', whiteEval.tbhits);
    findDiffPv(whiteEval.pv, blackEval.pv);
    updateEnginePv(WH, whiteEval.pv);

    HTML('.black-engine-eval', blackEval.eval);
    HTML('.black-engine-speed', blackEval.speed);
    HTML('.black-engine-nodes', blackEval.nodes);
    HTML('.black-engine-depth', blackEval.depth);
    HTML('.black-engine-tbhits', blackEval.tbhits);
    updateEnginePv(BL, blackEval.pv);
}

/**
 * Update engine PV
 * @param {number} color
 * @param {Object} moves
 */
function updateEnginePv(color, moves)
{
    // 0) skip
    let scolor = WHITE_BLACK[color];
    if (!moves) {
        HTML(`#${scolor}-engine-pv`, '');
        HTML(`.${scolor}-engine-pv`, '');
        return;
    }

    // 1)
    let classhigh = '',
        current = Floor(activePly / 2),
        other = 1 - turn;

    all_pvs[color] = moves;

    let keyOffset = 0;
    if (color == BL && turn)
        current -= 2;

    if (turn)
        current ++;
    if (turn && color == BL)
        current ++;

    let setpvmove = -1;
    HTML(`#${scolor}-engine-pv`, '');
    HTML(`.${scolor}-engine-pv`, '');

    // 2)
    Keys(moves).forEach(key => {
        key *= 1;
        let move = moves[key];

        classhigh = "";
        let effectiveKey = key + keyOffset,
            pvMove = current + Floor(effectiveKey / 2);
            // pvMoveNofloor = current + effectiveKey;

        if (color == turn && highlightpv == key)
        {
            if (DEV.pv &  1)
                LS(`Need to highlight: ${pvMove} : move=${move.m}`);
            classhigh = "active-pv-move";
            setpvmove = effectiveKey;
        }
        if (color == other && highlightpv == key + 1)
        {
            if (DEV.pv & 1)
                LS(`Need to highlight: ${pvMove} : move=${move.m}`);
            classhigh = "active-pv-move";
            setpvmove = effectiveKey;
        }

        let atsymbol = '';
        if (setpvmove > -1 && effectiveKey == setpvmove)
        {
            pvMove = ' @ ' + pvMove;
            // LS("pvMove is : " + pvMove + " setpvmove:" + setpvmove + ", effectiveKey:" + effectiveKey);
            atsymbol = ' @ ';
        }
        if (color == WH)
        {
            if (effectiveKey % 2 == 0 )
            {
                $('#' + scolor + '-engine-pv').append(pvMove + '. ');
                $('#' + scolor + '-engine-pv2').append(pvMove + '. ');
                $('#' + scolor + '-engine-pv3').append(pvMove + '. ');
            }
            else if (effectiveKey % 2 != 0 )
            {
                $('#' + scolor + '-engine-pv').append(atsymbol);
                $('#' + scolor + '-engine-pv2').append(atsymbol);
                $('#' + scolor + '-engine-pv3').append(atsymbol);
            }
        }

        if (color == BL && effectiveKey % 2 != 0 ) {
            $('#' + scolor + '-engine-pv3').append(pvMove + '. ');
            $('#' + scolor + '-engine-pv').append(pvMove + '. ');
            $('#' + scolor + '-engine-pv2').append(pvMove + '. ');
        }

        if (color == BL)
        {
            if (color == BL && key == 0 )
            {
                $('#' + scolor + '-engine-pv').append(pvMove + '. ');
                $('#' + scolor + '-engine-pv2').append(pvMove + '. ');
                $('#' + scolor + '-engine-pv3').append(pvMove + '. ');
                $('#' + scolor + '-engine-pv').append(' .. ');
                $('#' + scolor + '-engine-pv2').append(' .. ');
                $('#' + scolor + '-engine-pv3').append(' .. ');
                current ++;
            }
            else if (effectiveKey % 2 == 0 )
            {
                $('#' + scolor + '-engine-pv3').append(atsymbol);
                $('#' + scolor + '-engine-pv').append(atsymbol);
                $('#' + scolor + '-engine-pv2').append(atsymbol);
            }
        }
        if (color == BL)
            classhigh += ' blue';

        $('#' + scolor + '-engine-pv').append("<a href='#' id='" + scolor + '-' + key + "' class='set-pv-board " + classhigh + "' move-key='" + key + "' color='" + scolor + "'>" + move.m + '</a> ');
        $('#' + scolor + '-engine-pv2').append("<a href='#' id='" + scolor + '-' + key + "' class='set-pv-board " + classhigh + "' move-key='" + key + "' color='" + scolor + "'>" + move.m + '</a> ');
        $('#' + scolor + '-engine-pv3').append("<a href='#' id='c" + scolor + '-' + key + "' class='set-pv-board " + classhigh + "' move-key='" + key + "' color='" + scolor + "'>" + move.m + '</a> ');
    });

    if (DEV.pv & 1)
        LS(`highlightpv=${highlightpv}`);
    if (highlightpv == 0)
        setpvmove = 0;

    // 3)
    Class(`#${scolor}-engine-pv3`, `${scolor}-engine-pv`);
    Class(`#${scolor}-engine-pv3`, 'alert');
    Class(`#${scolor}-engine-pv3`, 'alert-dark');
    Show(`#${scolor}-name-dynamic`);
    all_pvs[color] = moves;
    if (all_pvs[color].length > 0)
    {
        if (Y.ply_diff == 'last')
        {
            setpvmove = all_pvs[color].length - 1;
            if (DEV.pv & 1)
                LS(`ply_diff in white: ${all_pvs[color].length}`);
        }
        activePv = all_pvs[color].slice();
        setPvFromKey(setpvmove, color);
    }
}

function setPlyDiv(ply_diff)
{
    save_option('ply_diff', ply_diff);
    findDiffPv(all_pvs[WH], all_pvs[BL]);
    updateEnginePv(WH, all_pvs[WH]);
    updateEnginePv(BL, all_pvs[BL]);
    Prop(`input[value="ply${ply_diff}"]`, 'checked', true);
}

function setPlyDivDefault()
{
    Y.ply_diff = get_string('ply_diff', 'first');
    Prop(`input[value="ply${Y.ply_diff}"]`, 'checked', true);
}

function findDiffPv(whitemoves, blackmoves)
{
    highlightpv = 0;
    if (Y.ply_diff == 'first')
        return;

   if (whitemoves)
   {
      Keys(whitemoves).forEach(key => {
         // let pvMove = current + key;
         if (!turn)
         {
            if (!highlightpv && blackmoves && blackmoves[key - 1] && (blackmoves[key - 1].m != whitemoves[key].m))
            {
                if (DEV.pv & 1)
                    LS("Need to color this pvmove is :" + key + ", pv:" + whitemoves[key].m + ", black: " + blackmoves[key - 1].m);
               highlightpv = key;
            }
         }
         else
         {
            if (!highlightpv && blackmoves && blackmoves[key + 1] && (blackmoves[key + 1].m != whitemoves[key].m))
            {
                if (DEV.pv & 1)
                    LS("Need to color this pvmove is :" + key + ", pv:" + whitemoves[key].m + ", black: " + blackmoves[key + 1].m);
               highlightpv = key + 1;
            }
         }
      });
   }
}

function boardAutoplay()
{
    if (isAutoplay && activePly >= 1 && activePly < loadedPlies) {
        activePly++;
        handlePlyChange();
        add_timeout('autoplay', () => {boardAutoplay();}, 750);
    } else {
        isAutoplay = false;
        Class('#board-autoplay i', '-fa-pause fa-play');
    }
}

function onLastMove()
{
   activePly = loadedPlies;
   viewingActiveMove = true;
   handlePlyChange();
}

function handlePlyChange(handleclick=true)
{
    selectedId = 0;
    turn = activePly % 2;

    let blackEval = '',
        whiteEval = '';

    /* Ben: since index starts at 0, active ply should be -1 and -2 to be correct */
    if (!turn) {
        whiteEval = getEvalFromPly(activePly - 2);
        blackEval = getEvalFromPly(activePly - 1);
    } else {
        blackEval = getEvalFromPly(activePly - 2);
        whiteEval = getEvalFromPly(activePly - 1);
    }

    /* Arun: we should get move from ply - 1 as index starts at 0 */
    currentMove = getMoveFromPly(activePly - 1);

    if (activePly > 1)
    {
        let prevMove = getMoveFromPly(activePly - 2);
        for (let yy = 1 ; yy <= livePVHist.length ; yy ++)
        {
            if (!livePVHist[yy])
                continue;
            for (let xx = 0 ; xx < livePVHist[yy].moves.length ; xx ++)
            {
                if (parseInt(livePVHist[yy].moves[xx].ply) == activePly)
                {
                    livePVHist[yy].moves[xx].engine = livePVHist[yy].engine;
                    updateLiveEvalData(livePVHist[yy].moves[xx], 0, prevMove.fen, yy, 0);
                    break;
                }
            }
        }
    }

    /* Arun: why do we need to keep swappging the pieces captured */
    if (currentMove)
        setMoveMaterial(currentMove.material, 0);

    updateMoveValues(whiteEval, blackEval);

    // TODO: skip the click
    if (handleclick)
        _(`a[ply="${activePly}"]`).click();
}

function scrollDiv(container, element)
{
   try {
        $(container).scrollTop(
            $(element).offset().top - $(container).offset().top + $(container).scrollTop()
        );
    }
    catch (e) {
    }
}

/**
 * Set PV from a move key
 * @param {number} moveKey
 * @param {number} color
 * @param {Object} choosePvx
 */
function setPvFromKey(moveKey, color, choosePvx)
{
    let activePv;
    if (color == LIVE) {
        if (choosePvx)
        {
            activePv = choosePvx;
            // LS("choosePvx is :" + JSON.stringify(choosePvx));
            choosePv = choosePvx;
        }
        else
        {
            activePv = choosePv;
            LS('live choseny:' + activePv.length + " ,moveKey:" + moveKey);
        }
    }
    else
        activePv = all_pvs[color].slice();

    if (activePv.length < 1) {
        activePvKey[color] = 0;
        return;
    }
    if (moveKey >= activePv.length)
        return;

    activePvKey[color] = moveKey;

    let moveFromPv = activePv[moveKey].from,
        moveToPv = activePv[moveKey].to,
        fen = activePv[moveKey].fen;

    // could this be slow?
    game.load(fen);

    Class('.active-pv-move', '-active-pv-move');

    let pvBoardElbL, pvBoardL;

    if (color == LIVE) {
        pvBoardL = pvBoarda;
        pvBoardElbL = '#pv-boarda';
    }
    else {
        pvBoardL = (color == WH)? pvBoardw: pvBoardb;
        pvBoardElbL = (color == WH)? '#pv-boardw': '#pv-boardb';

        let scolor = WHITE_BLACK[color],
            sother = WHITE_BLACK[1 - color];

        Class(`#${scolor}-engine-pv #${scolor}-${moveKey}`, 'active-pv-move');
        Class(`#${scolor}-engine-pv2 #${scolor}-${moveKey}`, 'active-pv-move');
        Class(`#${scolor}-engine-pv3 #c${scolor}-${moveKey}`, 'active-pv-move');
        Class(`#${sother}-engine-pv #${sother}-${activePvKey[1]}`, 'active-pv-move');
        Class(`#${sother}-engine-pv2 #${sother}-${activePvKey[1]}`, 'active-pv-move');
        Class(`#${sother}-engine-pv3 #c${sother}-${activePvKey[1]}`, 'active-pv-move');
        scrollDiv(`#${scolor}-engine-pv`, `#${scolor}-${moveKey}`);
        scrollDiv(`#${scolor}-engine-pv2`, `#${scolor}-${moveKey}`);
        scrollDiv(`#${scolor}-engine-pv3`, `#c${scolor}-${moveKey}`);

        current_positions[color] = fen;
    }
    moveFromPvs[color] = moveFromPv;
    moveToPvs[color] = moveToPv;

    if (!pvBoardElbL)
        return;
    analysFen = fen;

    // show moves
    show_move(pvBoardElbL, moveFromPv, moveToPv, highlightClassPv);
    pvSquareToHighlight = moveToPv;

    pvBoardL.position(fen, false);
    if (color == WH) {
        show_move('#pv-boardwc', moveFromPv, moveToPv, highlightClassPv);
        pvBoardwc.position(fen, false);
    }
    else if (color == BL) {
        show_move('#pv-boardbc', moveFromPv, moveToPv, highlightClassPv);
        pvBoardbc.position(fen, false);
    }
}

//hack
function pvBoardautoplay(value, color, activePv)
{
    if (isPvAutoplay[value] && activePvKey[value] >= 0 && activePvKey[value] < activePv.length - 1) {
        setPvFromKey(activePvKey[value] + 1, color);
        add_timeout('pv_autoplay', () => {pvBoardautoplay(value, color, activePv);}, 750);
    } else {
        isPvAutoplay[value] = false;
        if (value == 0)
        {
            Class('.pv-board-autoplay1 i', '-fa-pause fa-play');
        }
        else
        {
            Class('.pv-board-autoplay2 i', '-fa-pause fa-play');
        }
    }
}

// CHECK THIS
function setMoveMaterial(material, whiteToPlay)
{
    Keys(material).forEach(key => {
        let value = material[key];
        setPieces(key, value, whiteToPlay);
    });
}

// CHECK THIS
function setPieces(piece, value, whiteToPlay) {
   var target = 'black-material';
   var color = 'b';
   if ((whiteToPlay && value < 0) || (!whiteToPlay && value > 0)) {
      target = 'white-material';
      color = 'w';
   }

   value = Abs(value);

   HTML('#white-material span.' + piece, '');
   HTML('#black-material span.' + piece, '');

   for (let i = 0; i < value; i++) {
      let imgPath = 'img/chesspieces/wikipedia/' + color + piece.toUpperCase() + '.png';
      $('#' + target + ' span.' + piece).append('<img src="' + imgPath + '" class="engine-material" />');
   }
}

function getLinkArch()
{
   var retLink;

   retLink = "http://www.tcec-chess.com/archive.html";

   return (retLink);
}

function openCrossCup(index, gamen)
{
   index ++;
   LS("XXX: Index is :" + index + ",:::" + eventCross[index]);
   var link = getLinkArch();
   var tourLink = '';
   var localGame = gamen;
   var cupname = tourInfo.season;
   var selindex = 0;

   if (index < 17)
   {
      tourLink = 'season=' + cupname + '&round=round32';
      selindex = 0;
   }
   else if (index < 25)
   {
      tourLink = 'season=' + cupname + '&round=round16';
      selindex = 16;
   }
   else if (index < 29)
   {
      tourLink = 'season=' + cupname + '&round=qf';
      selindex = 24;
   }
   else if (index < 31)
   {
      tourLink = 'season=' + cupname + '&round=sf';
      selindex = 28;
   }
   else if (index == 31)
   {
      tourLink = 'season=' + cupname + '&round=bz';
      selindex = 30;
   }
   else if (index == 32)
   {
      tourLink = 'season=' + cupname + '&round=fl';
      selindex = 31;
   }

   globalGameno = gamen;
   localGame -= eventCross[selindex];

   link = link + "?" + tourLink + "&game=" + localGame;
   window.open(link,'_blank');
   scheduleHighlight();
}

function openCross(index, gamen)
{
   if (tourInfo.cup && index)
   {
      openCrossCup(index, gamen);
      return;
   }
   var link = getLinkArch();
   var season = 1;
   var div = "di";
   var divno = 1;
   globalGameno = gamen;

   if (tourInfo.startgame)
   {
      gamen += tourInfo.startgame;
   }

   link = link + "?" + tourInfo.link + "&game=" + gamen;
   window.open(link,'_blank');
   scheduleHighlight();
}

function openLinks(link)
{
   window.open(link,'_blank');
}

function setDarkMode(value)
{
   darkMode = value;
   if (!darkMode)
   {
      gameArrayClass = ['red', 'green', '#696969', 'darkblue'];
   }
   else
   {
      gameArrayClass = ['red', '#39FF14', 'whitesmoke', 'orange'];
   }
}

function crossFormatter(value, row, index, field) {
   if (!value.hasOwnProperty("Score")) // true
   {
      return value;
   }

   var retStr = '';
   let valuex = value.Score;
   var countGames = 0;

   Keys(valuex).forEach(key => {
        let engine = valuex[key],
            gameX = parseInt(countGames / 2),
            gameXColor = parseInt(gameX % 3);

      if (engine.Result == "0.5")
      {
         engine.Result = '&frac12';
         gameXColor = 2;
      }
      else
      {
         gameXColor = parseInt(engine.Result);
      }
      if (retStr == '')
      {
         retStr = '<a title="' + engine.Game + '" style="cursor:pointer; color: ' + gameArrayClass[gameXColor] + ';"onclick="openCross(' + index + ',' + engine.Game + ')">' + engine.Result + '</a>';
      }
      else
      {
         retStr += ' ' + '<a title="' + engine.Game + '" style="cursor:pointer; color: ' + gameArrayClass[gameXColor] + ';"onclick="openCross(' + index + ',' + engine.Game + ')">' + engine.Result + '</a>';
      }
      countGames ++;
      if (countGames % 10 == 0)
      {
         retStr += '<br />';
      }
   });
   return retStr;
}

function formatter(value, _row, index, _field) {
   if (!value.hasOwnProperty("Score")) // true
   {
      return value;
   }

   var retStr = '';
   let valuex = value.Score;
   var countGames = 0;
   var rowcountGames = 0;
   var splitcount = 10;

   Keys(valuex).forEach(key => {
        let engine = valuex[key],
            gameX = parseInt(countGames / 2),
            gameXColor = parseInt(gameX % 3);

      if (engine.Result == "0.5")
      {
         engine.Result = '&frac12';
         gameXColor = 2;
      }
      else
      {
         gameXColor = parseInt(engine.Result);
      }
      if (rowcountGames && (rowcountGames%2 == 0))
      {
         retStr += '&nbsp';
      }
      if (retStr == '')
      {
         retStr = '<a title="' + engine.Game + '" style="cursor:pointer; color: ' + gameArrayClass[gameXColor] + ';"onclick="openCross(' + index + ',' + engine.Game + ')">' + engine.Result + '</a>';
      }
      else
      {
         retStr += ' ' + '<a title="' + engine.Game + '" style="cursor:pointer; color: ' + gameArrayClass[gameXColor] + ';"onclick="openCross(' + index + ',' + engine.Game + ')">' + engine.Result + '</a>';
      }
      countGames ++;
      rowcountGames ++;
      if (countGames % splitcount == 0)
      {
         rowcountGames = 0;
         retStr += '<br />';
      }
   });
   return retStr;
}

function crossCellformatter(value, row, index, field)
{
   return {classes: (row.crashes >= 3)? 'strike': 'normal'};
}

function cellformatter(value, row, index, field) {
   return {classes: (value.Score != undefined)? 'monofont': _BLACK};
}

function updateScoreHeadersData()
{
    if (!crosstableData)
    {
        if (h2hScoreRetryCount < 10)
        {
            add_timeout('update_h2hscore', () => {updateScoreHeadersData();}, 5000);
            LS("H2h score did not get updated:" + h2hScoreRetryCount);
            h2hScoreRetryCount ++;
        }
        return;
    }

   if (crosstableData.whiteCurrent === all_engines[WH] && crosstableData.blackCurrent === all_engines[BL])
      return;

   var scores = {};
   var whiteRes = crosstableData.Table[all_engines[WH]];
   var blackRes = crosstableData.Table[all_engines[BL]];

   if (whiteRes.Rating)
   {
      HTML('#white-engine-elo', whiteRes.Rating);
      scores = getScoreText(crosstableData.Table[all_engines[WH]].Results[all_engines[BL]].Text);
      HTML('.white-engine-score', scores.w.toFixed(1));
      HTML('.black-engine-score', scores.b.toFixed(1));
   }

   if (blackRes.Rating)
   {
      HTML('#black-engine-elo', blackRes.Rating);
   }

   crosstableData.whiteCurrent = all_engines[WH];
   crosstableData.blackCurrent = all_engines[BL];

   return 0;
}

function updateEngRatingData(data)
{
   engineRatingGlobalData = data;
   clear_timeout('cross');
}

function updateTourInfo(data)
{
   tourInfo = data;
}

function readTourInfo()
{
    Resource('tournament.json', (code, data) => {
        if (code == 200)
            updateTourInfo(data);
    });
}

function updateEngRating()
{
    Resource('enginerating.json', (code, data) => {
        if (code == 200)
            updateEngRatingData(data);
    });
}

function shallowCopy(data)
{
   return JSON.parse(JSON.stringify(data));
}

function updateH2hData()
{
    if (tourInfo && tourInfo.cup == 1)
    {
        Hide('#h2hdiv');
        return;
    }

    if (!oldSchedData)
    {
        if (h2hRetryCount < 10)
        {
            add_timeout('update_h2h', () => {updateH2hData();}, 5000);
            LS("H2h did not get updated:" + h2hRetryCount);
            h2hRetryCount = h2hRetryCount + 1;
            return;
        }
    }


    if (!oldSchedData)
        return;
    if (oldSchedData.WhiteEngCurrent === all_engines[WH] && oldSchedData.BlackEngCurrent === all_engines[BL])
        return;

   h2hRetryCount = 0;

   let h2hdata = [];
   var prevDate = 0;
   var momentDate = 0;
   var diff = 0;
   var gameDiff = 0;
   var timezoneDiff = moment().utcOffset() * 60 * 1000 + timezoneDiffH * 3600 * 1000;
   var h2hrank = 0;
//    var schedEntry = {};
   var data = shallowCopy(oldSchedData);

   Keys(data).forEach(key => {
       let engine = data[key];
      engine.Gamesort = engine.Game;
      if (engine.Start)
      {
         momentDate = moment(engine.Start, 'HH:mm:ss on YYYY.MM.DD');
         if (prevDate)
         {
            diff += momentDate.diff(prevDate);
            gameDiff = diff/(engine.Game-1);
         }
         momentDate.add(timezoneDiff);
         engine.Start = getLocalDate(engine.Start);
         prevDate = momentDate;
         //LS("diff is :" + (CurrentDate2 - CurrentDate1));
      }
      else
      {
         if (gameDiff)
         {
            prevDate.add(gameDiff + timezoneDiff);
            engine.Start = "Estd: " + prevDate.format('HH:mm:ss on YYYY.MM.DD');
         }
      }
      if (engine.Moves)
      {
         gamesDone = engine.Game;
         engine.Game = '<a title="TBD" style="cursor:pointer; color: ' + gameArrayClass[3] + ';"onclick="openCross(' + 0 + ',' + engine.Game + ')">' + engine.Game + '</a>';
      }
      engine.FixWhite = engine.White;
      engine.FixBlack = engine.Black;


         if (engine.Result == "1/2-1/2")
         {
            /* do nothing */
         }
         else if (engine.Result == "1-0")
         {
            engine.FixWhite = '<div style="color:' + gameArrayClass[1] + '">' + engine.White + '</div>';
            engine.FixBlack = '<div style="color:' + gameArrayClass[0] + '">' + engine.Black + '</div>';
         }
         else if (engine.Result == "0-1")
         {
            engine.FixWhite = '<div style="color:' + gameArrayClass[0] + '">' + engine.White + '</div>';
            engine.FixBlack = '<div style="color:' + gameArrayClass[1] + '">' + engine.Black + '</div>';
         }

      if ((engine.Black == all_engines[BL] && engine.White == all_engines[WH]) ||
         (engine.Black == all_engines[WH] && engine.White == all_engines[BL]))
      {
         engine.h2hrank = engine.Game;
         if (engine.Result != undefined)
         {
            h2hrank ++;
            if (h2hrank%2 == 0)
            {
               engine.h2hrank = engine.Game + ' (R)';
            }
         }
         h2hdata.push(engine);
      }
   });
   oldSchedData.WhiteEngCurrent = all_engines[WH];
   oldSchedData.BlackEngCurrent = all_engines[BL];

   $('#h2h').bootstrapTable('load', h2hdata);
}

function updateGame(game)
{
   openCross(0, game);
}

function updateTourStat(data)
{
    let scdatainput = shallowCopy(data),
        tinfo = [],
        tinfoData = scheduleToTournamentInfo(scdatainput),
        gameNox = tinfoData.minMoves[1];

   tinfoData.minMoves = tinfoData.minMoves[0] + ' [' + '<a title="' + gameNox + '" style="cursor:pointer; color: ' +
   gameArrayClass[1] + ';"onclick="updateGame(' + gameNox + ')">' + gameNox + '</a>' + ']';
   gameNox = tinfoData.maxMoves[1];
   tinfoData.maxMoves = tinfoData.maxMoves[0] + ' [' + '<a title="' + gameNox + '" style="cursor:pointer; color: ' +
   gameArrayClass[1] + ';"onclick="updateGame(' + gameNox + ')">' + gameNox + '</a>' + ']';
   gameNox = tinfoData.minTime[1];
   tinfoData.minTime = tinfoData.minTime[0] + ' [' + '<a title="' + gameNox + '" style="cursor:pointer; color: ' +
   gameArrayClass[1] + ';"onclick="updateGame(' + gameNox + ')">' + gameNox + '</a>' + ']';
   gameNox = tinfoData.maxTime[1];
   tinfoData.maxTime = tinfoData.maxTime[0] + ' [' + '<a title="' + gameNox + '" style="cursor:pointer; color: ' +
   gameArrayClass[1] + ';"onclick="updateGame(' + gameNox + ')">' + gameNox + '</a>' + ']';

   let crashes = tinfoData.crashes[1];
   // CHECK THIS
   if (crashes.length)
   {
      tinfoData.crashes = tinfoData.crashes[0] + ' [';
      let lines = crashes.map(crash => `<a title="${crash}" style="cursor:pointer; color:${gameArrayClass[0]};"onclick="updateGame(${gameNox})">${gameNox}</a>`);
      tinfoData.crashes += lines.join(',') + ']';
   }
   else
   {
      tinfoData.crashes = 0;
   }

   tinfo.push(tinfoData);
   $('#tf').bootstrapTable('load', tinfo);
}

function updateScheduleData(scdatainput)
{
   let scdata = [];
   var prevDate = 0;
   var momentDate = 0;
   var diff = 0;
   var gameDiff = 0;
   var timezoneDiff = moment().utcOffset() * 60 * 1000 + timezoneDiffH * 3600 * 1000;
//    var schedEntry = {};
   oldSchedData = shallowCopy(scdatainput);
   var data = shallowCopy(scdatainput);
   updateTourStat(scdatainput);
   var gameLocalno = 1;

   Keys(data).forEach(key => {
       let engine = data[key];
      engine.Game = gameLocalno;
      gameLocalno ++;
      engine.Gamesort = engine.Game;
      if (engine.Start)
      {
         momentDate = moment(engine.Start, 'HH:mm:ss on YYYY.MM.DD');
         if (prevDate)
         {
            diff += momentDate.diff(prevDate);
            gameDiff = diff/(engine.Game-1);
         }
         momentDate.add(timezoneDiff);
         engine.Start = getLocalDate(engine.Start);
         prevDate = momentDate;
      }
      else
      {
         if (gameDiff)
         {
            prevDate.add(gameDiff + timezoneDiff);
            engine.Start = "Estd: " + prevDate.format('HH:mm:ss on YYYY.MM.DD');
         }
      }
      if (engine.Moves)
      {
         gamesDone = engine.Game;
         globalGameno = gamesDone;
         engine.agame = engine.Game;
         engine.Game = '<a title="TBD" style="cursor:pointer; color: ' + gameArrayClass[3] + ';"onclick="openCross(' + 0 + ',' + engine.Game + ')">' + engine.Game + '</a>';
      }
      engine.FixWhite = engine.White;
      engine.FixBlack = engine.Black;


         if (engine.Result == "1/2-1/2")
         {
            /* do nothing */
         }
         else if (engine.Result == "1-0")
         {
            engine.FixWhite = '<div style="color:' + gameArrayClass[1] + '">' + engine.White + '</div>';
            engine.FixBlack = '<div style="color:' + gameArrayClass[0] + '">' + engine.Black + '</div>';
         }
         else if (engine.Result == "0-1")
         {
            engine.FixWhite = '<div style="color:' + gameArrayClass[0] + '">' + engine.White + '</div>';
            engine.FixBlack = '<div style="color:' + gameArrayClass[1] + '">' + engine.Black + '</div>';
         }

      scdata.push(engine);
   });

   $('#schedule').bootstrapTable('load', scdata);
   scheduleHighlight();
}

function scheduleHighlight(_noscroll)
{
    let options = $('#schedule').bootstrapTable('getOptions'),
        classSet = 'blacktds';

    pageNum = parseInt(globalGameno / options.pageSize) + 1;
    $('#schedule').bootstrapTable('selectPage', pageNum);

    let index = globalGameno - (pageNum - 1) * options.pageSize;
    if (isNaN(index))
        return;

    // let top = 0;
    // $('#schedule').find('tbody tr').each(function (i) {
    //     if (i < index)
    //         top += $(this).height();
    // });

    if (!darkMode)
        classSet = 'whitetds';

    Class('#schedule tr', classSet, false);
    Class(`#schedule tr:nth-child(${index})`, classSet);
}

function updateWinnersData(winnerData)
{
   let scdata = [];
//    var prevDate = 0;
//    var momentDate = 0;
//    var diff = 0;
//    var gameDiff = 0;
//    var timezoneDiff = moment().utcOffset() * 60 * 1000 + timezoneDiffH * 3600 * 1000;
//    var schedEntry = {};
   let data = shallowCopy(winnerData);

    Keys(data).forEach(key => {
        let engine = data[key],
            // redColor = 'darkred',
            link = "\'" + engine.link + "\'";
        engine.name = '<a title="TBD" style="cursor:pointer; color: ' + gameArrayClass [0] + ';"onclick="openLinks(' + link + ')">' + engine.name + '</a>';
        scdata.push(engine);
    });

   $('#winner').bootstrapTable('load', scdata);
}

function updateWinners()
{
    Resource('winners.json', (code, data) => {
        if (code == 200)
            updateWinnersData(data);
    });
}

function updateSchedule()
{
    Resource('schedule.json', (code, data) => {
        if (code == 200)
            updateScheduleData(data);
    });
}

var onDragStart = function(source, piece, position, orientation)
{
   if (game.game_over() === true ||
      (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1))
   {
      return false;
   }
};

var onDragMove = function(newLocation, oldLocation, source, piece, position, orientation)
{
   var move = game.move({
      from: newLocation,
      to: oldLocation,
      promotion: 'q' // NOTE: always promote to a queen for example simplicity
   });

   // illegal move
   if (move === null) return 'snapback';

   var pvLen = activePvKey[2] + 1;
   var fen = ChessBoard.objToFen(position);
   if (activePvKey[2] == 0)
   {
      activePv[0] = {};
      activePv[0].fen = fen;
   }
   moveFrom = oldLocation;
   moveTo = newLocation;
   if (newLocation == oldLocation)
      return;

   var str = newLocation + '-' + oldLocation;   // + '-' + newLocation;
   pvBoarda.move(str);
   fen = pvBoarda.fen();
   activePv[pvLen] = {};
   activePv[pvLen].fen = fen;
   activePv[pvLen].from = oldLocation;
   activePv[pvLen].to = newLocation;
   Class(this, 'active-pv-move');

   show_move('#pv-boarda', moveFrom, moveTo, highlightClassPv);
   pvSquareToHighlight = moveTo;

   activePvKey[2] = pvLen;
   analysFen = fen;
};

/**
 * Create a new board, with or without drag
 * @param {string} cont
 * @param {boolean} notation
 * @param {boolean=} drag
 */
function createBoard(cont, notation, drag)
{
    let options = {
        appearSpeed: 1,
        boardTheme: BOARD_THEMES[Y.board_theme],
        moveSpeed: 1,
        onMoveEnd: onMoveEnd,
        overlay: true,
        pieceTheme: piece => PIECE_THEMES[Y.piece_theme][piece],
        position: 'start',
        showNotation: notation,
    };

    if (drag)
        Assign(options, {
            draggable: true,
            onDragStart: onDragStart,
            onDrop: onDragMove,
        });

    return ChessBoard(cont, options);
}

/**
 * Create all the boards
 */
function create_boards()
{
    Y.board_theme = get_string('board_theme', Y.board_theme);
    Y.piece_theme = get_string('piece_theme', Y.piece_theme);

    pvBoarda = createBoard('pv-boarda', Y.notation_pv, true);
    board = createBoard('board', Y.notation);

    if (!Y.arrows)
        board.clearAnnotation();

    pvBoardw = createBoard('pv-boardw', Y.notation_pv);
    pvBoardb = createBoard('pv-boardb', Y.notation_pv);
    pvBoardwc = createBoard('pv-boardwc', Y.notation_pv);
    pvBoardbc = createBoard('pv-boardbc', Y.notation_pv);

    save_option('board_theme', Y.board_theme);
    save_option('piece_theme', Y.piece_theme);
    Prop(`input[value="${Y.board_theme}b"]`, 'checked', true);
    Prop(`input[value="${Y.piece_theme}p"]`, 'checked', true);
}

function setBoard()
{
    let fen = board.fen();
    board = createBoard('board', Y.notation);
    board.position(fen, false);

    fen = pvBoardb.fen();
    pvBoardb = createBoard('pv-boardb', Y.notation_pv);
    pvBoardb.position(fen, false);

    fen = pvBoardw.fen();
    pvBoardw = createBoard('pv-boardw', Y.notation_pv);
    pvBoardw.position(fen, false);

    fen = pvBoarda.fen();
    pvBoarda = createBoard('pv-boarda', Y.notation_pv, true);
    pvBoarda.position(fen, false);

    fen = pvBoardwc.fen();
    pvBoardwc = createBoard('pv-boardwc', Y.notation_pv, true);
    pvBoardwc.position(fen, false);

    fen = pvBoardbc.fen();
    pvBoardbc = createBoard('pv-boardbc', Y.notation_pv, true);
    pvBoardbc.position(fen, false);

    save_option('board_theme', Y.board_theme);
    save_option('piece_theme', Y.piece_theme);

    Prop(`input[value="${Y.board_theme}b"]`, 'checked', true);
    Prop(`input[value="${Y.piece_theme}p"]`, 'checked', true);

    if (prevPgnData && prevPgnData.Moves.length > 0)
    {
        show_move('#board', moveFrom, moveTo);
        if (moveFromPvs[1])
            show_move('#pv-boardb', moveFromPvs[1], moveToPvs[1], highlightClassPv);
        if (moveFromPvs[0])
            show_move('#pv-boardw', moveFromPvs[0], moveToPvs[0], highlightClassPv);
        if (moveFromPvs[2])
            show_move('#pv-boarda', moveFromPvs[2], moveToPvs[2], highlightClassPv);
    }
}

function updateTables()
{
    readTourInfo();
    updateEngRating();
    updateSchedule();
    updateCrash();

    add_timeout('update_tables', () => {
        updateCrosstable();
        eventCrosstableWrap();
    }, 1000);
}

function setTwitchChatUrl(darkmode)
{
    Attrs('#chatright', 'src', twitchChatUrl + (darkmode? '?darkpopout': ''));
}

function setTwitchBackgroundInit(backg)
{
   var setValue = 0;
   if (backg == 1)
   {
      setTwitchChatUrl(false);
      setValue = 1;
   }
   else if (backg == 2)
   {
      setTwitchChatUrl(true);
      setValue = 2;
   }
   else
   {
        let dark_mode = get_int('dark_mode', 10);
        if (darkMode == 20)
        {
            setTwitchChatUrl(true);
            setValue = 2;
        }
        else
        {
            setTwitchChatUrl(false);
            setValue = 1;
        }
   }
   save_option('twitch_back_mode', setValue);
}

function setTwitchBackground(backg)
{
    let setValue = 0,
        twitch_back_mode = get_string('twitch_back_mode');

    if (twitch_back_mode == 1)
    {
        setTwitchChatUrl(false);
        setValue = 1;
    }
    else if (twitch_back_mode == 2)
    {
        setTwitchChatUrl(true);
        setValue = 2;
    }
    else
        setTwitchChatUrl(backg != 1);

    save_option('twitch_back_mode', setValue);
    Prop(`input[value="${setValue}"]`, 'checked', true);
}

function setDark()
{
    Class('.toggleDark i', '-fa-moon fa-sun');
    Class('body', 'dark');
    setTwitchBackground(2);
    setTwitchChatUrl(true);
    Attrs('#info-frame', 'src', 'info.html?body=dark');
    Class('#crosstable, #h2h, #infotable, #schedule, #standtable, #winner', 'table-dark');
    Prop('#themecheck', 'checked', false);
    Class('.graphs', 'blackcanvas -whitecanvas');
    setDarkMode(1);
}

function setLight()
{
    Class('.toggleDark i', 'fa-moon -fa-sun');
    Class('body', '-dark');
    Prop('input.toggleDark', 'checked', false);
    Class('#crosstable, #h2h, #infotable, #schedule, #standtable, #winner', '-table-dark');
    setTwitchBackground(1);
    Attrs('#info-frame', 'src', 'info.html?body=light');
    Prop('#themecheck', 'checked', true);
    Class('.graphs', 'whitecanvas -blackcanvas');
    setDarkMode(0);
}

function setDefaults()
{
   setSound();
   setLivePvUpdate();
   showTabDefault();
   setHighlightDefault();
   setHighlightDefaultPv();
   setDefaultThemes();
   setliveEngine();
   setNotationDefault();
   setNotationPvDefault();
   setMoveArrowsDefault();
   setBoard();
   setCrash();
   loadBoardMiddle();
   setDefaultLiveLog();
}

function setDefaultThemes()
{
    let dark_mode = get_int('dark_mode', 10);
    if (dark_mode == 20)
        setDark();
    else
        setLight();
    setPlyDivDefault();
}

function setBoardUser(board_theme)
{
    if (board_theme)
        Y.board_theme = board_theme;
    setBoard();
}

function setPieceUser(piece_theme)
{
    if (piece_theme)
        Y.piece_theme = piece_theme;
    setBoard();
}

function updateLiveEvalDataHistory(datum, fen, container, contno)
{
    let score = DefaultFloat(datum.eval, `${datum.eval}`);

    // Check if black
    if (datum.pv.search(/.*\.\.\..*/i) == 0)
    {
        if (!isNaN(score))
        {
            // Invert the score
            score = -parseFloat(score);
        }
    }

    datum.eval = score;
    datum.tbhits = formatUnit(datum.tbhits);
    datum.nodes = formatUnit(datum.nodes);

    if (!datum.pv.length || datum.pv.trim() == "no info")
        return;

    let chess = new Chess(fen),
        currentFen = fen,
        moveContainer = [],
        pvs = [],
        split = datum.pv.replace("...","... ").split(' '),
        length = split.length;

    for (let i = 0, moveCount = 0; i < length; i++) {
        let str = split[i];
        if (isNaN(str[0])) {
            let moveResponse = chess.move(str);
            if (!moveResponse || !moveResponse) {
                if (DEV.eval & 1)
                    LS("undefine move" + str);
                return;
            }
            else {
                currentFen = chess.fen();
                let newPv = {
                    from: moveResponse.from,
                    to: moveResponse.to,
                    m: moveResponse.san,
                    fen: currentFen
                };

                //we can build the html and the PV in the same loop. no need to do it three times
                moveContainer.push("<a href='#' class='set-pv-board' live-pv-key='0' move-key='" + moveCount +
                    "' engine='" + (contno) + "' color='live'>" + moveResponse.san + '</a>');
                currentLastMove = str.slice(-2);
                //pushing is the same as a union of an array with one item...
                pvs.push(newPv);
                moveCount++;
            }
        }
        else
            moveContainer.push(str);
    }

    livePvs[contno] = [];
    HTML(container, '');
    board.clearAnnotation();

    let evalStr = getPct(datum.engine, score);
    $(container).append('<h6>' + evalStr + ' PV(A) ' + '</h6><small>[D: ' + datum.depth + ' | TB: ' + datum.tbhits + ' | Sp: ' + datum.speed + ' | N: ' + datum.nodes +']</small>');
    if (Y.arrows) {
        let color;
        if (contno == 2) {
            color = 'reds';
        }
        else {
            color = 'blues';
        }
        if (pvs[0]) {
            board.addArrowAnnotation(pvs[0].from, pvs[0].to, color, board.orientation());
        }
    }

    $(container).append('<div class="engine-pv engine-pv-live alert alert-dark">' + moveContainer.join(' ') + '</div>');
    livePvs[contno] = pvs;
    activePvH[contno] =pvs;
    datum.eval = datum.origeval;
}

/**
 * Updates the Kibitzings' engine PV and arrow if enabled.
 * Called by the socket when new PV info comes in.
 * @param {Object} datum object: {engine: String, pv:String, tbHits:String, Nodes:String/Integer, eval:String/Integer, speed:String/Integer, depth:String}
 * @param {boolean} update has to do with updating
 * @param {string} fen fen of current position
 * @param {number} contno index of kibitzing engine
 * @param {boolean} initial Unknown behavior
 */
function updateLiveEvalData(datum, update, fen, contno, initial) {
    if (!datum)
        return;
   var container = '#live-eval-cont' + contno;

   if (contno == 1 && !showLivEng1)  {
      HTML(container, '');
      return;
   } else if (contno == 2 && !showLivEng2) {
      HTML(container, '');
      return;
   } else if (!initial && contno == 1){
      board.clearAnnotation();
      clearedAnnotation = 1;
   }

   if (clearedAnnotation < 1 && contno == 2) {
      board.clearAnnotation();
   }

   if (contno == 2) {
      clearedAnnotation = 0;
   }

   if (update && !viewingActiveMove) {
      return;
   } else if (!update) {
      datum.origeval = datum.eval;
      updateLiveEvalDataHistory(datum, fen, container, contno);
      return;
   }

    let score = '';
    if (datum)
        score = (parseFloat(datum.eval || 0)).toFixed(2);
    score = "" + score;
    datum.eval = score;

    datum.tbhits = formatUnit(datum.tbhits);
    datum.nodes = formatUnit(datum.nodes);

   var pvs = [];

   var moveContainer = [];
   if (datum.pv.length > 0 && datum.pv.trim() != "no info") {
      fen = fen ? fen : activeFen;
      var chess = new Chess(fen);
      var currentFen = fen;

      var split = datum.pv.replace("...","... ").split(' ');
      var length = split.length;
      for (let i = 0, moveCount = 0; i < length; i++) {
         let str = split[i];
         if (isNaN(str[0])) {
            let moveResponse = chess.move(str);
            if (!moveResponse || !moveResponse) {
                if (DEV.eval & 1)
                    LS("undefine move" + str);
               return;
            } else {
               currentFen = chess.fen();
               let newPv = {
                  from: moveResponse.from,
                  to: moveResponse.to,
                  m: moveResponse.san,
                  fen: currentFen,
               };

               //we can build the html and the PV in the same loop. no need to do it three times
               moveContainer.push("<a href='#' class='set-pv-board' live-pv-key='0' move-key='" + moveCount +
                  "' engine='" + (contno) +
                  "' color='live'>" + moveResponse.san +
                  '</a>');
               currentLastMove = str.slice(-2);
               //pushing is the same as a union of an array with one item...
               pvs.push(newPv);
               moveCount++;
            }
         } else {
            moveContainer.push(str);
         }
      }
   } else {
      return;
   }

   livePvs[contno] = [];
   HTML(container, '');

   var evalStr = getPct(datum.engine, datum.eval);
   $(container).append('<h6>' + evalStr + ' PV(A) ' + '</h6><small>[D: ' + datum.depth + ' | TB: ' + datum.tbhits + ' | Sp: ' + datum.speed + ' | N: ' + datum.nodes +']</small>');

   if (Y.arrows) {
       let color;
      if (contno == 2) {
         color = 'reds';
      }
      else {
         color = 'blues';
      }
      if (pvs[0]) {
         board.addArrowAnnotation(pvs[0].from, pvs[0].to, color, board.orientation());
      }
   }

   $(container).append('<div class="engine-pv engine-pv-live alert alert-dark">' + moveContainer.join(' ') + '</div>');
   livePvs[contno] = pvs;
   var colorx = 0;
   var x = 0;
   datum.plynum = datum.ply + 1;
   if (datum.plynum % 2 == 0)
   {
      x = datum.plynum/2;
      colorx = 1;
   }
   else
   {
      x = (datum.plynum + 1)/2;
      colorx = 0;
   }
    datum.x = x;
    if (Y.live_pv)
        addDataLive(charts.eval, datum, colorx, contno);
}

function updateLiveEvalDataNew(datum, _update, fen, contno, _initial) {
    if (!datum || !Y.live_pv || !viewingActiveMove)
        return;

    let classhigh = '',
        container = '#white-engine-pv3',
        scolor = _WHITE;

    if (datum.color == 1)
    {
        scolor = _BLACK;
        container = '#black-engine-pv3';
        classhigh += ' lightblue';
    }

    for (let key of ['eval', 'speed', 'nodes', 'depth', 'tbhits'])
        HTML(`.${scolor}-engine-${key}`, datum[key]);

    if (DEV.eval & 1)
        LS("updateLiveEvalDataNew::: Entered for color:" + datum.color);

    let score = '';
    if (datum)
        score = (parseFloat(datum.eval || 0)).toFixed(2);
    score = "" + score;
    datum.eval = score;

    let pvs = [],
        moveContainer = [];
    if (!datum.pv.length || datum.pv.trim() == "no info")
        return;

    fen = fen || activeFen;
    let chess = new Chess(fen),
        currentFen = fen;

    let split = datum.pv.replace("...","... ").split(' '),
        length = split.length;
    for (let i = 0, moveCount = 0; i < length; i++) {
        let str = split[i];
        if (isNaN(str[0])) {
            let moveResponse = chess.move(str);
            if (!moveResponse || !moveResponse) {
                if (DEV.eval & 1)
                    LS("undefine move" + str);
                return;
            }
            else {
                currentFen = chess.fen();
                let newPv = {
                    from: moveResponse.from,
                    to: moveResponse.to,
                    m: moveResponse.san,
                    fen: currentFen
                };

                // we can build the html and the PV in the same loop. no need to do it three times
                moveContainer.push("<a href='#' class='set-pv-board' live-pv-key='0' move-key='" + moveCount +
                    "' engine='" + (contno) + "' color='live'>" + moveResponse.san + '</a>');

                currentLastMove = str.slice(-2);
                pvs.push(newPv);
                moveCount ++;
            }
        }
        else
            moveContainer.push(str);
    }

    let evalStr = getPct(datum.engine, datum.eval),
        addClass = 'white-engine-pv';
    HTML(container, '');
    if (datum.color == 0)
    {
        Class(container, '-white-engine-pv');
        Hide('#white-name-dynamic');
    }
    else
    {
        Class(container, '-black-engine-pv');
        Hide('#black-name-dynamic');
        addClass = 'black-engine-pv';
    }
    Class(container, '-alert -alert-dark');
    $(container).append('<h6>' + evalStr + ' PV(A) ' + '</h6>');
    $(container).append('<div class="' + addClass + ' ' + classhigh + ' alert alert-dark">' + moveContainer.join(' ') + '</div>');
    //updateChartData();

    datum.plynum ++;
    let x = Floor((datum.plynum + 1) / 2),
        evalData = {
            x: x,
            y: score,
            ply: datum.plynum,
            eval: score
        };

    if (prevevalData.ply != datum.plynum)
        prevevalData = {};

    if (prevevalData.eval != evalData.eval)
    {
        // LS("XXX: movecount:" + x + "datum.plynum," + datum.plynum + " ,prevevalData.eval:" + prevevalData.eval + " ,evalData.eval:" + evalData.eval);
        if (Y.live_pv)
            removeData(charts.eval, evalData, datum.color);
    }
    else if (DEV.eval & 1)
        LS(`XXX: not updating movecount=${x} : datum.plynum=${datum.plynum}`);

    prevevalData = evalData;
}

function updateLiveEval() {
    Resource(`data.json?no-cache${Now()}`, (code, data) => {
        if (code == 200) {
            updateLiveEvalData(data, 1, null, 1, 1);
            updateLiveEvalData(engine2LiveData, 1, null, 2, 1);
        }
    });

    Resource(`data1.json?no-cache${Now()}`, (code, data) => {
        engine2LiveData = data;
    });
}

function updateLiveChartData(data, contno)
{
   if (data.moves)
   {
      if (contno == 1)
      {
         liveEngineEval1 = data.moves;
         livePVHist[contno] = data;
         updateChartDataLive(contno);
      }
      else
      {
         liveEngineEval2 = data.moves;
         livePVHist[contno] = data;
         updateChartDataLive(contno);
      }
   } else {
      if (contno == 1)
      {
         liveEngineEval1 = [];
      }
      if (contno == 2)
      {
         liveEngineEval2 = [];
      }
   }
}

function updateLiveChart()
{
    Resource('liveeval.json', (code, data) => {
        if (code == 200)
            updateLiveChartData(data, 1);
    });
    Resource('liveeval1.json', (code, data) => {
        if (code == 200)
            updateLiveChartData(data, 2);
    });
}

function setLastMoveTime(data)
{
   LS("Setting last move time:" + data);
}

function checkTwitch(checkbox)
{
    let checked = checkbox.checked;
    if (!checked)
        Attrs('iframe#twitchvid', 'src', twitchSRCIframe);

   S('iframe#twitchvid', !checked);
   save_option('twitch_video', checked? 1: 0);
}

/**
 * Resize the window
 */
function resize() {
    board.resize();
    let height = Max(350, Round(Min(screen.availHeight, window.innerHeight) - 80));
    Style('#chatright', `height:${height}px;width:100%`);
}

function setTwitch()
{
    let twitch_video = get_int('twitch_video', 0);
    if (!twitch_video)
        Attrs('iframe#twitchvid', 'src', twitchSRCIframe);

    S('iframe#twitchvid', !twitch_video);
    Prop('#twitchcheck', 'checked', !!twitch_video);
    resize();
}

function showEvalCont()
{
    S('#evalcont', showLivEng1 || showLivEng2);
    if (showLivEng1)
    {
        Class('#pills-eval-tab1, #pills-eval1', 'active show');
        Class('#pills-eval-tab2, #pills-eval2', '-active');
    }
    else if (showLivEng2)
    {
        Class('#pills-eval-tab2, #pills-eval2', 'active show');
        Class('#pills-eval-tab1, #pills-eval1', '-active');
    }
}

function liveEngine(checkbox, checknum)
{
    let ichecked = checkbox.checked? 1: 0,
        config = `live_engine${checknum}`;

    save_option(config, ichecked);
    if (checknum == 1)
        showLivEng1 = ichecked;
    else
        showLivEng2 = ichecked;

    showEvalCont();
    updateLiveEval();
    updateChartData();
}

function setliveEngineInit(value)
{
    let config = `live_engine${value}`,
        getlive = get_int(config, 1),
        cont = `#liveenginecheck${value}`,
        checknum = value;

    if (getlive == 1)
    {
        if (checknum == 1)
        {
            showLivEng1 = 1;
            $('#pills-tab a[href="#pills-eval' + 1 + '"]').tab('show');
        }
        else
        {
            showLivEng2 = 1;
            if (!showLivEng1)
            {
                $('#pills-tab a[href="#pills-eval' + 2 + '"]').tab('show');
            }
        }
        Prop(cont, 'checked', true);
    }
    else
    {
        if (checknum == 1)
            showLivEng1 = 0;
        else
            showLivEng2 = 0;

        Prop(cont, 'checked', false);
    }
}

function setliveEngine()
{
   setliveEngineInit(1);
   setliveEngineInit(2);
   showEvalCont();
}

function checkSort(checkbox)
{
    save_option('cross_crash', checkbox.checked? 1: 0);
    updateTables();
}

function checkLivePv(checkbox)
{
    save_option('live_pv', checkbox.checked? 0: 1);
}

function checkSound(checkbox)
{
    let checked = checkbox.checked;
    save_option('sound', checked? 1: 0);
}

function setCrash()
{
    Y.cross_crash = get_int('cross_crash', 0);
    Prop('#crosscheck', 'checked', !Y.cross_crash);
}

function setSound()
{
    Y.sound = get_int('sound', 1);
    Prop('#soundcheck', 'checked', !Y.sound);
}

function setLivePvUpdate()
{
    Y.live_pv = get_int('live_pv', 1);
    Prop('#livepvcheck', 'checked', !Y.live_pv);
}

function setNotationPvDefault()
{
    Y.notation_pv = get_int('notation_pv', 1);
    Prop('#nottcheckpv', 'checked', !Y.notation_pv);
}

function setNotationDefault()
{
    Y.notation = get_int('notation', 1);
    Prop('#nottcheck', 'checked', !Y.notation);
}

function setNotationPv(checkbox)
{
    let is_check = checkbox.checked;
    save_option('notation_pv', is_check? 0: 1);
    Y.notation_pv = !is_check;
    setBoard();
}

function setNotation(checkbox)
{
    let is_check = checkbox.checked;
    save_option('notation', is_check? 1: 0);
    Y.notation = !is_check;
    setBoard();
}

function setHighLightMainPv(getHighL)
{
    highlightClassPv = `highlight-white highlight-${(getHighL == 0)? 'none': getHighL}`;
}

function setHighlightDefaultPv()
{
    let getHighL = get_int('highlight_pv', 2);
    setHighLightMainPv(getHighL);
    Prop(`input[value="highlightPvRadio${getHighL}"]`, 'checked', true);
}

function setHighlightPv(value)
{
    save_option('highlight_pv', value);
    setHighLightMainPv(value);
    setBoard();
}

function setHighLightMain(getHighL)
{
    highlightClass = `highlight-white highlight-${(getHighL == 0)? 'none': getHighL}`;
}

function setHighlightDefault()
{
    let getHighL = get_int('highlight', 2);
    setHighLightMain(getHighL);
    Prop(`input[value="highlightRadio${getHighL}"]`, 'checked', true);
}

function setHighlight(value)
{
    save_option('highlight', value);
    setHighLightMain(value);
    setBoard();
}

function setMoveArrowsDefault()
{
    Y.arrows = get_int('tcec-move-arrows', 1);
    Prop('#notacheck', 'checked', !Y.arrows);
}

function setMoveArrows(checkbox)
{
    save_option('arrows', checkbox.checked? 0: 1);
    setBoard();
}

function goMoveFromChart(chartx, evt)
{
    let activePoints = chartx.getElementAtEvent(evt),
        firstPoint = activePoints[0];
    if (!firstPoint)
        return;

    let plyNum = chartx.data.datasets[firstPoint._datasetIndex].data[firstPoint._index].ply;
    if (plyNum)
        $('a[ply=' + plyNum + ']').click();
}

function addToolTip(divx, divimg)
{
   var htmlx = '<table class="table table-dark table-striped table-dark">' + HTML(divx) + '</table>';
   $(divimg).tooltipster('content', htmlx);
}

function updateEngineInfo(divx, divimg, data)
{
   $(divx).bootstrapTable('load', data);
   addToolTip(divx, divimg);
}

function addToolTipInit(_divx, divimg, direction)
{
   $(divimg).tooltipster({
      contentAsHTML: true,
      interactive: true,
      side: [direction],
      theme: 'tooltipster-shadow',
    //   trigger: 'hover',
      delay: [500, 200],
      contentCloning: true,
      delayTouch: [10, 2000],
      trigger: 'custom',
      triggerOpen: {
         mouseenter: true,
         click: true,
         touchstart: true,
         tap: true
      },
      triggerClose: {
         mouseleave: true,
         click: true,
         touchleave: true,
         tap: true,
         originClick: true
      }
   });
}

function initToolTip()
{
   $('#whiteenginetable').bootstrapTable({
      columns: columnsEng,
      showHeader: false
   });
   $('#blackenginetable').bootstrapTable({
      columns: columnsEng,
      showHeader: false
   });
   addToolTipInit('#whiteenginetable', '#white-engine-info', 'right');
   addToolTipInit('#blackenginetable', '#black-engine-info', 'left');
}

function stopEvProp(e) {
   e.cancelBubble = !0;
   if (e.stopPropagation) {
      e.stopPropagation();
   }
   if (e.preventDefault) {
      e.preventDefault();
   }
   return !1;
}

function firstButtonMain()
{
   activePly = 1;
   handlePlyChange();
}

function firstButton()
{
   if (selectedId == 0)
   {
      firstButtonMain();
   }
   else
   {
      if (selectedId == 'white-engine-pv')
      {
         $('.pv-board-to-first1').click();
      }
      else if (selectedId == 'black-engine-pv')
      {
         $('.pv-board-to-first2').click();
      }
   }
}

function backButtonMain()
{
   if (activePly > 1) {
      activePly--;
   }
   handlePlyChange();

   return false;
}

function backButton()
{
   if (selectedId == 0)
   {
      backButtonMain();
   }
   else
   {
      if (selectedId == 'white-engine-pv')
      {
         $('.pv-board-previous1').click();
      }
      else if (selectedId == 'black-engine-pv')
      {
         $('.pv-board-previous2').click();
      }
   }
}

function forwardButtonMain()
{
   if (activePly < loadedPlies) {
      activePly++;
   } else {
      viewingActiveMove = true;
   }
   handlePlyChange();

   return false;
}

function forwardButton()
{
   if (selectedId == 0)
   {
      forwardButtonMain();
   }
   else
   {
      if (selectedId == 'white-engine-pv')
      {
         $('.pv-board-next1').click();
      }
      else if (selectedId == 'black-engine-pv')
      {
         $('.pv-board-next2').click();
      }
   }
}

function endButtonMain()
{
   onLastMove();
}

function endButton()
{
   if (selectedId == 0)
   {
      endButtonMain();
   }
   else
   {
      if (selectedId == 'white-engine-pv')
      {
         $('.pv-board-to-last1').click();
      }
      else if (selectedId == 'black-engine-pv')
      {
         $('.pv-board-to-last2').click();
      }
   }
}

function tcecHandleKey(e)
{
   var keycode;     // , oldPly, oldVar, colRow, colRowList;
   if (!e)
   {
      e = window.event;
   }
   keycode = e.keyCode;
   if (e.altKey || e.ctrlKey || e.metaKey) {
      return !0;
   }

   switch (keycode)
   {
      case 37:
      backButton();
      break;
      case 38:
      firstButton();
      break;
      case 39:
      forwardButton();
      break;
      case 40:
      endButton();
      break;
      default:
      return !0;
   }
   return stopEvProp(e);
}

function simpleAddEvent(obj, evt, cbk)
{
   if (obj.addEventListener)
   {
      obj.addEventListener(evt, cbk, !1);
   }
   else if (obj.attachEvent)
   {
      obj.attachEvent("on" + evt, cbk);
   }
}
simpleAddEvent(document, "keydown", tcecHandleKey);

function schedSorted(a,b)
{
   if (a < b) return -1;
   if (a > b) return 1;
   return 0;
}

function crossSorted(a,b)
{
   if (a < b) return -1;
   if (a > b) return 1;
   return 0;
}

function initTables()
{
   $('#event-overview').bootstrapTable({
      classes: 'table table-striped table-no-bordered',
      columns: [
      {
         field: 'TimeControl',
         title: 'TC'
      },
      {
         field: 'Termination',
         title: 'Adj Rule'
      },
      {
         field: 'movesTo50R',
         title: '50'
      },
      {
         field: 'movesToDraw',
         title: 'Draw'
      },
      {
         field: 'movesToResignOrWin',
         title: 'Win'
      },
      {
         field: 'piecesleft',
         title: 'TB'
      },
      {
         field: 'Result',
         title: 'Result'
      },
      {
         field: 'Round',
         title: 'Round'
      },
      {
         field: 'Opening',
         title: 'Opening'
      },
      {
         field: 'ECO',
         title: 'ECO'
      },
      {
         field: 'Event',
         title: 'Event'
      },
      {
         field: 'Viewers',
         title: 'Viewers'
      }
      ]
   });

   $('#h2h').bootstrapTable({
      classes: 'table table-striped table-no-bordered',
      pagination: true,
      paginationLoop: true,
      striped: true,
      smartDisplay: true,
      sortable: true,
      pageList: [10,20,50,100],
      pageSize:10,
      rememberOrder: true,
      columns: [
      {
         field: 'Gamesort',
         title: 'sortnumber',
         visible: false,
      },
      {
         field: 'h2hrank',
         title: 'Game#',
         sortable: true,
         sorter: schedSorted,
         sortName: 'Gamesort',
         align: 'left',
      },
      {
         field: 'FixWhite',
         title: 'White',
         sortable: true,
      },
      {
         field: 'WhiteEv',
         title: 'W.Ev',
         sortable: true,
      },
      {
         field: 'BlackEv',
         title: 'B.Ev',
         sortable: true,
      },
      {
         field: 'FixBlack',
         title: 'Black',
         sortable: true,
      },
      {
         field: 'Result',
         title: 'Result',
         sortable: true,
      },
      {
         field: 'Moves',
         title: 'Moves',
         sortable: true,
      },
      {
         field: 'Duration',
         title: 'Duration',
         sortable: true,
      },
      {
         field: 'Opening',
         title: 'Opening',
         sortable: true,
         align: 'left',
      },
      {
         field: 'Termination',
         title: 'Termination',
         sortable: true,
      },
      {
         field: 'ECO',
         title: 'ECO',
         sortable: true,
      },
      {
         field: 'FinalFen',
         title: 'Final Fen',
         align: 'left',
      },
      {
         field: 'Start',
         title: 'Start',
      }
      ]
   });

   $('#schedule').bootstrapTable({
      classes: 'table table-striped table-no-bordered',
      pagination: true,
      paginationLoop: true,
      striped: true,
      smartDisplay: true,
      sortable: true,
      pageList: [10,20,50,100],
      pageSize:10,
      rememberOrder: true,
      search: true,
      columns: [
      {
         field: 'Gamesort',
         title: 'sortnumber',
         visible: false
      },
      {
         field: 'Game',
         title: 'Game#',
         sortable: true,
         sorter: schedSorted,
         sortName: 'Gamesort',
      },
      {
         field: 'FixWhite',
         title: 'White',
         sortable: true,
      },
      {
         field: 'WhiteEv',
         title: 'Ev',
         sortable: true,
      },
      {
         field: 'FixBlack',
         title: 'Black',
         sortable: true,
      },
      {
         field: 'BlackEv',
         title: 'Ev',
         sortable: true,
      },
      {
         field: 'Result',
         title: 'Result',
         sortable: true,
      },
      {
         field: 'Moves',
         title: 'Moves',
         sortable: true,
      },
      {
         field: 'Duration',
         title: 'Duration',
         sortable: true,
      },
      {
         field: 'Opening',
         title: 'Opening',
         sortable: true,
         align: 'left',
      },
      {
         field: 'Termination',
         title: 'Termination',
         sortable: true,
      },
      {
         field: 'ECO',
         title: 'ECO',
         sortable: true,
      },
      {
         field: 'FinalFen',
         title: 'Final Fen',
         align: 'left',
      },
      {
         field: 'Start',
         title: 'Start',
      }
      ]
   });

   $('#tf').bootstrapTable({
      classes: 'table table-striped table-no-bordered',
      striped: true,
      smartDisplay: true,
      sortable: true,
      rememberOrder: true,
      columns: [
      {
         field: 'startTime',
         title: 'Start time'
      },
      {
         field: 'endTime',
         title: 'End time'
      },
      {
         field: 'totalTime',
         title: 'Duration',
      },
      {
         field: 'avgMoves',
         title: 'Avg Moves'
      },
      {
         field: 'avgTime',
         title: 'Avg Time'
      },
      {
         field: 'whiteWins',
         title: 'White wins'
      },
      {
         field: 'blackWins',
         title: 'Black wins'
      },
      {
         field: 'drawRate',
         title: 'Draw Rate'
      },
      {
         field: 'crashes',
         title: 'Crashes'
      },
      {
         field: 'minMoves',
         title: 'Min Moves'
      },
      {
         field: 'maxMoves',
         title: 'Max Moves'
      },
      {
         field: 'minTime',
         title: 'Min Time'
      },
      {
         field: 'maxTime',
         title: 'Max Time'
      }
      ]
   });


   $('#winner').bootstrapTable({
      classes: 'table table-striped table-no-bordered',
      pagination: true,
      paginationLoop: true,
      striped: true,
      smartDisplay: true,
      sortable: true,
      pageList: [10,20,50,100],
      pageSize:10,
      rememberOrder: true,
      search: true,
      columns: [
      {
         field: 'name',
         title: 'S#',
         visible: true
      },
      {
         field: 'winner',
         title: 'Champion',
         sortable: true
      },
      {
         field: 'runner',
         title: 'Runner-up',
         sortable: true
      },
      {
         field: 'score',
         title: 'Score',
         sortable: true
      },
      {
         field: 'date',
         title: 'Date',
         sortable: false
      }
      ]
   });

   standColumns = [
   {
      field: 'rank',
      title: 'Rank',
      sortable: true,
      width: '4%',
   },
   {
      field: 'name',
      title: 'Engine',
      sortable: true,
      width: '18%',
   },
   {
      field: 'points',
      title: 'Points',
      sortable: true,
      width: '7%',
   }
   ];

   $('#crash').bootstrapTable({
      classes: 'table table-striped table-no-bordered',
      striped: true,
      smartDisplay: true,
      sortable: true,
      rememberOrder: true,
      columns: [
      {
         field: 'gameno',
         title: 'G#',
      },
      {
         field: _WHITE,
         title: 'White',
      },
      {
         field: _BLACK,
         title: 'Black',
      },
      {
         field: 'reason',
         title: 'Reason',
         width: '55%'
      },
      {
         field: 'decision',
         title: 'Final decision',
         width: '15%'
      },
      {
         field: 'action',
         title: 'Action taken',
      },
      {
         field: 'result',
         title: 'Result',
      },
      {
         field: 'log',
         title: 'Log',
      }
      ]
   });

   let crossColumns = [
   {
      field: 'rank',
      title: 'Rank',
      sortable: true,
      width: '4%',
      cellStyle: crossCellformatter,
   },
   {
      field: 'name',
      title: 'Engine',
      sortable: true,
      width: '28%',
      cellStyle: crossCellformatter,
   },
   {
      field: 'games',
      title: '# Games',
      sortable: true,
      width: '4%',
      cellStyle: crossCellformatter,
   },
   {
      field: 'points',
      title: 'Points',
      sortable: true,
      width: '7%',
      cellStyle: crossCellformatter,
   },
   {
      field: 'crashes',
      title: 'Crashes',
      sortable: true,
      width: '4%',
      cellStyle: crossCellformatter,
   },
   {
      field: 'wins',
      title: 'Wins [W/B]',
      width: '10%',
      cellStyle: crossCellformatter,
   },
   {
      field: 'loss',
      title: 'Loss [W/B]',
      width: '10%',
      cellStyle: crossCellformatter,
   },
   {
      field: 'sb',
      title: 'SB',
      sortable: true,
      cellStyle: crossCellformatter,
      width: '4%',
   },
   {
      field: 'elo',
      title: 'Elo',
      cellStyle: crossCellformatter,
      sortable: true,
      width: '5%',
   },
   {
      field: 'elo_diff',
      title: 'Diff [Live]',
      width: '7%',
      cellStyle: crossCellformatter,
   }
   ];

   $('#crosstable').bootstrapTable({
      classes: 'table table-striped table-no-bordered',
      columns: crossColumns,
      sortName: 'rank'
   });
}

function removeClassEngineInfo(cont)
{
   Class(cont, '-d-sm-none -d-md-none -d-lg-none -d-xl-none');
}

function addClassEngineInfo(cont)
{
   Class(cont, 'd-sm-none d-md-none d-lg-none d-xl-none');
}

function showEngInfo()
{
    hideDownPv = 1;
    for (let i = 1 ; i < 5 ; i++)
    {
        removeClassEngineInfo('#boardinfod2' + i);
        removeClassEngineInfo('#boardinfod1' + i);
    }
    save_option('top_tab', 2);
}

function hideEngInfo()
{
    hideDownPv = 0;
    for (let i = 1 ; i < 5 ; i++)
    {
        addClassEngineInfo('#boardinfod2' + i);
        addClassEngineInfo('#boardinfod1' + i);
    }
    save_option('top_tab', 1);
}

function showTabDefault()
{
    let topTab = get_int('top_tab', 1);
    if (topTab == 1)
        _('#v-pills-gameinfo-tab').click();
    else
        _('#v-pills-pv-top-tab').click();
}

function toggleTheme()
{
    let dark_mode = get_int('dark_mode', 10);
    save_option('dark_mode', (dark_mode == 20)? 10: 20);
    setDefaultThemes();
    updateTables();
    $(".navbar-toggle").click();
}

function hideBanner(timeout=30000)
{
    add_timeout('banner', () => {Hide('#note');}, timeout);
}

function showBanner(data)
{
   let note = _("#note");
   note.style.display = 'inline';
   _("#notetext").textContent = data.message;
   if (data.timeout == undefined)
   {
      data.timeout = 30000;
   }
   else
   {
      data.timeout = data.timeout * 1000;
   }
   hideBanner(data.timeout);
}

function setCheckBoardMiddle(value, id)
{
    Class('#middle-data-column', 'order-first', value);
    Prop(id, 'checked', !!value);
    save_option('board_middle', value? 1: 0);
}

function checkBoardMiddle(checkbox)
{
    setCheckBoardMiddle(checkbox.checked? 1: 0, '#middlecheck');
}

function loadBoardMiddle()
{
    let middle = get_int('board_middle', 0);
    setCheckBoardMiddle(middle? 1: 0, '#middlecheck');
}

function scheduleToTournamentInfo(schedJson)
{
   let start = null;
   let end = null;
   if (schedJson.length > 0)
   {
      let s = schedJson[0];
      let l = schedJson[schedJson.length-1];
      start = s.Start;
      if (l.Start)
      {
         end = l.Start;
      }
   }

   let data = {
      startTime: getLocalDate(start),
      endTime: 0,
      minMoves: [9999999,-1],
      maxMoves: [0,-1],
      avgMoves: 0,
      minTime: ["99:59:59",-1],
      maxTime: ["00:00:00",-1],
      avgTime: new Date(0),
      totalTime: -1,
      winRate: 0,
      drawRate: 0,
      whiteWins: 0,
      blackWins: 0,
      crashes: [0, []],
   };

   let len = schedJson.length;
   let avgTime = 0;
   let compGames = 0;

   for (let i = 0; i < len; i++)
   {
      let cur = schedJson[i];
      cur.Game = i + 1;
      if (cur.Moves && !crash_re.test(cur.Termination)) {
         data.crashes[0] ++;
         data.crashes[1].push(cur.Game);
      }
      if (cur.Moves != null) {
         compGames ++;
         if (cur.Moves < data.minMoves[0])  {
            data.minMoves = [cur.Moves, cur.Game];
         }
         if (cur.Moves > data.maxMoves[0])  {
            data.maxMoves = [cur.Moves, cur.Game];
         }
         data.avgMoves += cur.Moves;
      }

      if (cur.Duration != null) {
         if (cur.Duration < data.minTime[0])  {
            data.minTime = [cur.Duration, cur.Game];
         }
         if (cur.Duration > data.maxTime[0])  {
            data.maxTime = [cur.Duration, cur.Game];
         }

         avgTime += hmsToSecondsOnly(cur.Duration);
      }

      if (cur.Result == "1-0") {
         data.whiteWins ++;
      } else if (cur.Result == "0-1") {
         data.blackWins ++;
      }
   }
   data.avgMoves = Round(data.avgMoves/compGames);

   let draws = compGames - data.whiteWins - data.blackWins;
   data.drawRate = divide2Decimals(draws * 100, compGames) + "%";

   data.winRateW = divide2Decimals(data.whiteWins *100, compGames) + "%";
   data.winRateB = parseFloat(divide2Decimals(data.blackWins *100, compGames)).toFixed(1) + "%";
   data.avgTime = hhmm(avgTime/compGames);
   data.totalTime = hhmmss((avgTime/compGames)*len);
   data.endTime = getLocalDate(start, (avgTime/compGames)*(len/60));
   data.whiteWins = data.whiteWins + ' [ ' + data.winRateW + ' ]';
   data.blackWins = data.blackWins + ' [ ' + data.winRateB + ' ]';
   return data;
}

function divide2Decimals(num,div)
{
   return Round((num +0.000001) / div * 100) / 100;
}

function hmsToSecondsOnly(str) {
   var p = str.split(':'),
   s = 0,
   m = 1;

   while (p.length > 0) {
      s += m * parseInt(p.pop(), 10);
      m *= 60;
   }

   return s;
}

function hhmm(secs)
{
   var minutes = Floor(secs / 60);
   secs = secs%60;
   var hours = Floor(minutes/60);
   minutes = minutes%60;
   return `${Pad(hours)}:${Pad(minutes)}`;
}

function hhmmss(secs)
{
   var minutes = Floor(secs / 60);
   secs = secs%60;
   var hours = Floor(minutes/60);
   minutes = minutes%60;
   var days = Floor(hours/24);
   hours = hours%24;
   if (days > 0)
   {
      return `${Pad(days)}d, ${Pad(hours)}:${Pad(minutes)}:${Pad(secs)}`;
   }
   else
   {
      return `${Pad(hours)}:${Pad(minutes)}:${Pad(secs)}`;
   }
}

function getLocalDate(startDate, minutes)
{
   let momentDate = moment(startDate, 'HH:mm:ss on YYYY.MM.DD');
   var timezoneDiff = moment().utcOffset() * 60 * 1000 + timezoneDiffH * 3600 * 1000;
   if (minutes)
      momentDate.add(minutes * 60 * 1000);

   momentDate.add(timezoneDiff);
   return(momentDate.format('HH:mm:ss on YYYY.MM.DD'));
}

function setDefaultLiveLog()
{
    globalRoom = get_string('engine_livelog', 'room10');
    Prop(`input[value="${globalRoom}"]`, 'checked', true);
}

function setLiveLog(livelog)
{
    save_option('engine_livelog', livelog.value);
    unlistenLogMain(0);
    if (livelog.value)
        globalRoom = livelog.value;

    listenLog();
}

function listenLogMain(room)
{
   if (socket)
   {
      socket.emit('room', room);
   }
}

function unlistenLogMain(room)
{
   globalRoom = 0;
   if (socket)
   {
      socket.emit('noroom', room);
   }
}

function listenLog()
{
   if (globalRoom == 0)
   {
      globalRoom = 'room10';
   }
   listenLogMain(globalRoom);
}

function unlistenLog()
{
   unlistenLogMain('livelog');
}

function setTwitchChange(data)
{
   updateTourInfo(data);
   var newtwitchChatUrl = 'https://www.twitch.tv/embed/' + data.twitchaccount + '/chat';
   if (newtwitchChatUrl == twitchChatUrl)
   {
      return;
   }
   twitchChatUrl = 'https://www.twitch.tv/embed/' + data.twitchaccount + '/chat';
   setTwitchChatUrl(darkMode);
}

function getImg(engine)
{
   return('<div class="right-align"><img class="right-align-pic" src="img/engines/'+ getShortEngineName(engine) +'.jpg" />' + '<a class="right-align-name">' + engine + '</a></div>');
}

/**
 * Calculate White and Black points
 * @param {string} text
 * @returns {Object}
 */
function getScoreText(text) {
    let black = 0,
        white = 0;

    for (let i=0, length=text.length; i<length; i++) {
        let char = text[i];
        if (char == '0')
            black ++;
        else if (char == '1')
            white ++;
        else if (char == '=') {
            black += 0.5;
            white += 0.5;
        }
    }

    return {w: white, b: black};
}

function updateCrashData(data)
{
   let scdata = [];
//    var crashEntry = {};

    Keys(data).forEach(key => {
        let engine = data[key];

      engine.gameno = '<a title="TBD" style="cursor:pointer; color: ' + gameArrayClass[3] + ';"onclick="openCross(' + 0 + ',' + engine.gameno + ')">' + engine.gameno + '</a>';
      let link = "\'" + engine.log + "\'";
      engine.log = '<a title="TBD" style="cursor:pointer; color: ' + gameArrayClass[1] + ';"onclick="openLinks(' + link + ')">' + engine.log + '</a>';
      if (engine.gpulog != undefined)
      {
         link = "\'" + engine.gpulog + "\'";
         engine.gpulog = '<a title="TBD" style="cursor:pointer; color: ' + gameArrayClass[1] + ';"onclick="openLinks(' + link + ')">' + engine.gpulog + '</a>';
      }
      scdata.push(engine);
   });

   $('#crash').bootstrapTable('load', scdata);
}

function updateCrash()
{
    Resource('crash.json', (code, data) => {
        if (code == 200)
            updateCrashData(data);
    });
}

function eventCrosstableWrap()
{
   if (tourInfo)
   {
      if (tourInfo.cup != 1)
      {
         Hide('#bracketdiv, #eventdiv');
         Show('.nav-pills a[href="#pills-stand"]');
         return;
      }
   }

    Resource('crash.json', (_code, data) => {
        // handle success + error
        bracketDataMain(data);
    });
}

function bracketDataMain(data)
{
   if (data)
   {
      bigData.teams = data.teams;
      roundResults = data.matchresults;
      bigData.results = data.results;
   }
   for (let i = roundResults.length + 1; i <= 32; i++)
   {
      roundResults[i-1] = [{lead:-1, score: -1}, {lead:-1, score: -1}];
   }
   for (let i = bigData.teams.length + 1; i <= 16; i++)
   {
      bigData.teams[i-1] = [{name: getSeededName(teamsx[i-1][0][0]), flag: getShortEngineName(teamsx[i-1][0][0]),
                             score: -1, rank: '1', date: '', lead: 0},
                            {name: getSeededName(teamsx[i-1][1][0]), flag: getShortEngineName(teamsx[i-1][1][0]),
                             score: -1, rank: '2', date: '', lead: 0}];
   }

   drawBracket1();
   eventCrosstable(data.EventTable);
}

function drawBracket1()
{
   var roundNox = 2;
   getDateRound();

//    function onClick(data)
//    {
//       //alert(data);
//    }
//    /* Edit function is called when team label is clicked */
//    function edit_fn1(container, data, doneCb) {
//      var input = $('<input type="text">')
//      input.val(data ? data.flag + ':' + data.name : '');
//      container.html(input);
//      input.focus();
//      input.blur(function() {
//        var inputValue = input.val();
//        if (inputValue.length === 0) {
//          doneCb(null); // Drop the team and replace with BYE
//        } else {
//          var flagAndName = inputValue.split(':'); // Expects correct input
//          doneCb({flag: flagAndName[0], name: flagAndName[1]});
//        }
//      });
//    }
   function edit_fn(_container, _data, _doneCb) {
      return;
   }

   function render_fn2(container, data, _score, state) {
        var localRound = parseInt(roundNox/2) - 1;
        var isFirst = roundNox%2;
        var dataName = 0;

        //LS("Came to round: " + roundNox + " data.name is: " + data.name);
        roundNox ++;
        if (data && data.name)
        {
           data.origname = data.name;
           dataName = getSeededName(data.name);
        }

        switch(state) {
          case "empty-bye":
            container.append("No team");
            return;
          case "empty-tbd":
            if (roundNox%2 == 1)
            {
               let befStr = '<div class="labelbracket"> <a class="roundleft"> #' + (localRound + 1) + '</a> ';
               befStr += '</div>';
               $(befStr).insertBefore(container);
            }
            container.append("TBD");
            return;

          case "entry-no-score":
          case "entry-default-win":
          case "entry-complete":
            if (roundResults[localRound][isFirst].name != undefined)
            {
               if (getShortEngineName(roundResults[localRound][isFirst].name) != getShortEngineName(data.origname))
               {
                  if (isFirst)
                  {
                     isFirst = 0;
                  }
                  else
                  {
                     isFirst = 1;
                  }
               }
            }
            var scoreL = roundResults[localRound][isFirst].score;

            if (scoreL >= 0)
            {
               var appendStr = '';
               var lead = roundResults[localRound][isFirst].lead;
               var manual = roundResults[localRound][isFirst].manual;
               if (manual == 1)
               {
                  appendStr = '<div class="bracket-name"> <a> ' + dataName + '</a> </div>' +
                              '<div class="bracket-score orange"> <a> (' + scoreL + ')</a> </div>';
                  $(container).parent().addClass('bracket-name-orange');
               }
               else if (lead == 0)
               {
                  appendStr = '<div class="bracket-name"> <a> ' + dataName + '</a> </div>' +
                              '<div class="bracket-score redb "> <a> (' + scoreL + ')</a> </div>';
                  $(container).parent().addClass('bracket-name-red');
               }
               else if (lead == 1)
               {
                  appendStr = '<div class="bracket-name"> <a> ' + dataName + '</a> </div>' +
                              '<div class="bracket-score green"> <a> (' + scoreL + ')</a> </div>';
                  $(container).parent().addClass('bracket-name-green');
               }
               else
               {
                  if (scoreL == undefined)
                  {
                     scoreL = 0;
                  }
                  appendStr = '<div class="bracket-name"> <a> ' + dataName + '</a> </div>' +
                              '<div class="bracket-score"> <a> (' + scoreL + ')</a> </div>';
                  $(container).parent().addClass('bracket-name-current');
               }
               if (roundNox%2 == 1)
               {
                  let localRoundL = localRound + 1;
                  if (localRoundL == 31)
                  {
                     localRoundL = 32;
                  }
                  else if (localRoundL == 32)
                  {
                     localRoundL = 31;
                  }
                  let befStr = '<div class="labelbracket"> <a class="roundleft"> #' + (localRoundL) + '</a> ';
                  if (roundDate[localRound] != undefined)
                  {
                     //befStr += '<a> ' + roundDate[localRound] + '</a> </div>';
                     befStr += '</div>';
                  }
                  else
                  {
                     befStr += '</div>';
                  }
                  $(befStr).insertBefore(container);
               }
               container.append('<img class="bracket-material" src="img/engines/'+ data.flag +'.jpg" />').append(appendStr);
            }
            else
            {
               let localRoundL = localRound + 1;
               if (localRoundL == 31)
               {
                  localRoundL = 32;
               }
               else if (localRoundL == 32)
               {
                  localRoundL = 31;
               }
               if (roundNox%2 == 1)
               {
                  let befStr = '<div class="labelbracket"> <a class="roundleft"> #' + (localRoundL) + '</a> ';
                  befStr += '</div>';
                  $(befStr).insertBefore(container);
               }
               container
                    .append('<img class="bracket-material" src="img/engines/'+data.flag+'.jpg" />')
                    .append('<div class="bracket-name"> <a> ' + dataName + '</a> </div>');
            }

            if (roundNox > 64)
            {
               $(container).parent().append('<div class="bubblex third">3rd</div>');
            }
            return;
        }
   }

   var direction = 'lr';
   try {
      $(function () {
         $('#bracket').bracket({
            centerConnectors: true,
            dir: direction,
            teamWidth: 220,
            scoreWidth: 35,
            matchMargin: 45,
            roundMargin: 18,
            init: bigData,
            //skipConsolationRound: true,
            decorator: {edit: edit_fn, render: render_fn2}
         });
      });
   }
    catch (err)
    {
        LS(`Error in bracket`);
        LS(err);
    }
}

function getSeededName(name)
{
   let engineName = 0;

    Keys(teamsx).forEach(key => {
        let engine = teamsx[key];

        if (getShortEngineName(engine[0][0]).toUpperCase() == getShortEngineName(name).toUpperCase())
      {
         //engineName = "S#" + engine[0][1] + " " + engine[0][0];
         engineName = engine[0][0];
         engineName = "#" + engine[0][1] + " " + engine[0][0];
         if (engineName.length > 24)
         {
            engineName = engineName.slice(0, 22) + "..";
         }
         return false;
      }
      else if (getShortEngineName(engine[1][0]).toUpperCase() == getShortEngineName(name).toUpperCase())
      {
         //engineName = "S#" + engine[1][1] + " " + engine[1][0];
         engineName = engine[1][0];
         engineName = "#" + engine[1][1] + " " + engine[1][0];
         if (engineName.length > 24)
         {
            engineName = engineName.slice(0, 22) + "..";
         }
         return false;
      }
   });
   if (engineName == 0)
   {
      engineName = name;
   }
   return engineName;
}

function getDateRound()
{
   let roundDate = [];
   var diffData = 0;

   for (let x = 0 ; x <= totalEvents; x++)
   {
      if (roundDateMan[x])
      {
         roundDate[x] = getCurrDate(roundDateMan[x], 0);
      }
      else
      {
         let y = x + 1;
         if (diffData)
         {
            if (y % 2 == 1)
            {
               roundDate[x] = getCurrDate(startDateR1, 1440 * (parseInt(y/2)));
            }
            else
            {
               roundDate[x] = getCurrDate(startDateR2, 1440 * (parseInt((y-1)/2)));
            }
         }
         else
         {
            let gameDiffL = gameDiff * 8 / (60 * 1000);
            //gameDiffL = gameDiffL/1.5;
            roundDate[x] = getCurrDate(startDateR1, gameDiffL * x / 2);
         }
      }
   }
}

function getCurrDate(currdate, mins)
{
   var timezoneDiff = moment().utcOffset() * 60 * 1000 + mins * 60 * 1000;
   let momentDate = moment(currdate, 'HH:mm:ss on YYYY.MM.DD');
   momentDate.add(timezoneDiff);
   return momentDate.format('MMM DD YYYY, HH:mm');
}

async function eventCrosstable(data)
{
    let divname = '#crosstableevent',
        standings = [];

    $(divname).bootstrapTable({
        classes: 'table table-striped table-no-bordered',
        columns: columnsEvent,
        sortName: 'rank',
        sortOrder: 'desc'
    });

    eventCross[0] = 0;

    // CHECK THIS
    Keys(data).forEach((key, id) => {
        let matchdum = data[key];
        Assign(matchdum, {
            match: id + 1,
            Runner: getImg(matchdum.Runner),
            Winner: getImg(matchdum.Winner),
        });
        standings.push(matchdum);
        eventCross[id + 1] = eventCross[id] + parseInt(matchdum.Games);
    });

    $(divname).bootstrapTable('load', standings);
}

function formatterEvent(value, row, index, _field) {
   var retStr = '';
   var countGames = 0;
   var gameArray =  row.Gamesno.split(",");

    Keys(value).forEach(key => {
        let engine = value[key],
            gameX = parseInt(countGames / 2),
            gameXColor = parseInt(gameX % 3);

      if (engine == "=")
      {
         engine = '&frac12';
         gameXColor = 2;
      }
      else
      {
         gameXColor = parseInt(engine);
      }
      var gameNum = gameArray[key];
      if (retStr == '')
      {
         retStr = '<a title="' + gameNum + '" style="cursor:pointer; color: ' + gameArrayClass[gameXColor] + ';"onclick="openCross(' + index + ',' + gameNum + ')">' + engine + '</a>';
      }
      else
      {
         retStr += ' ' + '<a title="' + gameNum + '" style="cursor:pointer; color: ' + gameArrayClass[gameXColor] + ';"onclick="openCross(' +  index + ',' + gameNum + ')">' + engine + '</a>';
      }
      countGames ++;
      if (countGames % 8 == 0)
      {
         retStr += '<br />';
      }
   });
  return retStr;
}

/**
 * Set UI events
 */
function set_ui_events() {
    $(document).on('click', '.set-pv-board', function(e) {
        let moveKey = $(this).attr('move-key') * 1,
            pvColor = $(this).attr('color'),
            color = COLORS[pvColor],
            hist = $(this).attr('hist');

        if (color == LIVE)
        {
            $('#v-pills-pv-analys-tab').click();

            let liveKey = $(this).attr('engine');
            LS("liveKey is :" + liveKey);
            activePv = livePvs[liveKey];
            if (hist)
            {
                if (activePvH && activePvH[liveKey] && (activePvH[liveKey].length > 0))
                    setPvFromKey(moveKey, color, activePvH[liveKey]);
            }
            else
                setPvFromKey(moveKey, color, activePv);
        }
        else
        {
            if (hideDownPv == 0)
                $('#v-pills-pv-tab').click();

            activePv = all_pvs[color].slice();
            setPvFromKey(moveKey, color);
        }

        e.preventDefault();
        return false;
     });

     $(document).on('click', '.change-move', function(e) {
        let clickedPly = $(this).attr('ply'),
            clickedFen = $(this).attr('fen');
        LS(`clickedPly=${clickedPly} : clickedFen=${clickedFen}`);
       moveFrom = $(this).attr('from');
       moveTo = $(this).attr('to');

       viewingActiveMove = false;

       Class('.active-move', '-active-move');
       Class(this, 'active-move');

       show_move('#board', moveFrom, moveTo);
       squareToHighlight = moveTo;

       board.position(clickedFen, false);
       currentPosition = clickedFen;
       activePly = clickedPly;
       e.preventDefault();
       listPosition();

       if (clickedPly == loadedPlies)
       {
          viewingActiveMove = true;
          Class('#newmove', 'd-none');
          newMovesCount = 0;
          Attrs('#newmove', 'data-count', 0);
       }

       handlePlyChange(false);
       return false;
    });

    $(document).on('click', '#board-to-first', function(e) {
       activePly = 1;
       handlePlyChange();
       e.preventDefault();
    });

    $(document).on('click', '#board-previous', function(e) {
       if (activePly > 1) {
          activePly--;
       }
       handlePlyChange();
       e.preventDefault();

       return false;
    });

    $(document).on('click', '#board-autoplay', function(e) {
        e.preventDefault();
        Class('#board-autoplay i', '-fa-pause fa-play', isAutoplay);
        if (isAutoplay) {
           isAutoplay = false;
        } else {
           isAutoplay = true;
           boardAutoplay();
        }

        return false;
     });

     $(document).on('click', '#board-next', function(e) {
        if (activePly < loadedPlies) {
           activePly++;
        } else {
           viewingActiveMove = true;
        }
        handlePlyChange();
        e.preventDefault();

        return false;
     });

     $(document).on('click', '#board-to-last', function(e) {
        onLastMove();
        e.preventDefault();

        return false;
     });

     $(document).on('click', '#board-reverse', function(e) {
        board.flip();

         let oldOrientation = (board.orientation() == _BLACK)? _WHITE: _BLACK,
             newOrientation = board.orientation();

        $('.board-bottom-engine-eval.' + oldOrientation + '-engine-name').removeClass(oldOrientation + '-engine-name').addClass(newOrientation + '-engine-name');
        $('.board-bottom-engine-eval.' + oldOrientation + '-time-remaining').removeClass(oldOrientation + '-time-remaining').addClass(newOrientation + '-time-remaining');
        $('.board-bottom-engine-eval.' + oldOrientation + '-time-used').removeClass(oldOrientation + '-time-used').addClass(newOrientation + '-time-used');
        $('.board-bottom-engine-eval.' + oldOrientation + '-engine-eval').removeClass(oldOrientation + '-engine-eval').addClass(newOrientation + '-engine-eval');

        $('.board-top-engine-eval.' + newOrientation + '-engine-name').removeClass(newOrientation + '-engine-name').addClass(oldOrientation + '-engine-name');
        $('.board-top-engine-eval.' + newOrientation + '-time-remaining').removeClass(newOrientation + '-time-remaining').addClass(oldOrientation + '-time-remaining');
        $('.board-top-engine-eval.' + newOrientation + '-time-used').removeClass(newOrientation + '-time-used').addClass(oldOrientation + '-time-used');
        $('.board-top-engine-eval.' + newOrientation + '-engine-eval').removeClass(newOrientation + '-engine-eval').addClass(oldOrientation + '-engine-eval');
        Class('#board-top-engine-eval', `${oldOrientation}Fill -${newOrientation}Fill`);
        Class('#board-bottom-engine-eval', `${newOrientation}Fill -${oldOrientation}Fill`);

        setInfoFromCurrentHeaders();
        handlePlyChange(false);

        e.preventDefault();

        return false;
     });

     $("#schedule").on("click-cell.bs.table", function (field, value, row, $el) {
        if ($el.agame <= gamesDone)
        {
           openCross(0, $el.agame);
        }
     });

     //
     $('#pv-board-black').click(function(e) {
      activePv = all_pvs[BL];
      setPvFromKey(0, LIVE, all_pvs[BL]);
      e.preventDefault();
      return false;
   });

   $('#pv-board-white').click(function(e) {
      activePv = all_pvs[WH];
      setPvFromKey(0, LIVE, all_pvs[WH]);
      e.preventDefault();
      return false;
   });

   $('#pv-board-live1').click(function(e) {
      setPvFromKey(0, LIVE, livePvs[1]);
      e.preventDefault();
      return false;
   });

   $('#pv-board-live2').click(function(e) {
      setPvFromKey(0, LIVE, livePvs[2]);
      e.preventDefault();
      return false;
   });

   $('#pv-board-to-first').click(function(e) {
      setPvFromKey(0, LIVE);
      e.preventDefault();
      return false;
   });

   $('#pv-board-previous').click(function(e) {
      if (activePvKey[2] > 0) {
         setPvFromKey(activePvKey[2] - 1, LIVE);
      }
      e.preventDefault();

      return false;
   });

   $('#pv-board-next').click(function(e) {
      if (activePvKey[2] < choosePv.length) {
         setPvFromKey(activePvKey[2] + 1, LIVE);
      }
      e.preventDefault();

      return false;
   });

   $('.pv-board-to-first1').click(function(e) {
      setPvFromKey(0, WH);
      e.preventDefault();
      return false;
   });

   $('.pv-board-to-first2').click(function(e) {
      setPvFromKey(0, BL);
      e.preventDefault();
      return false;
   });

   $('.pv-board-previous1').click(function(e) {
      if (activePvKey[0] > 0) {
         setPvFromKey(activePvKey[0] - 1, WH);
      }
      e.preventDefault();

      return false;
   });

   $('.pv-board-previous2').click(function(e) {
      if (activePvKey[1] > 0) {
         setPvFromKey(activePvKey[1] - 1, BL);
      }
      e.preventDefault();

      return false;
   });

   $('.pv-board-autoplay1').click(function(e) {
      Class('.pv-board-autoplay1 i', '-fa-pause fa-play', isPvAutoplay[0]);
     if (isPvAutoplay[0]) {
        isPvAutoplay[0] = false;
     } else {
        isPvAutoplay[0] = true;
        pvBoardautoplay(0, WH, all_pvs[WH]);
     }
     e.preventDefault();

     return false;
  });

  $('.pv-board-autoplay2').click(function(e) {
      Class('.pv-board-autoplay1 i', '-fa-pause fa-play', isPvAutoplay[1]);
     if (isPvAutoplay[1]) {
        isPvAutoplay[1] = false;
     } else {
        isPvAutoplay[1] = true;
        pvBoardautoplay(1, BL, all_pvs[BL]);
     }
     e.preventDefault();

     return false;
  });

  //
  $('.pv-board-next1').click(function(e) {
    if (activePvKey[0] < all_pvs[WH].length) {
       setPvFromKey(activePvKey[0] + 1, WH);
    }
    e.preventDefault();
    return false;
 });

 $('.pv-board-next2').click(function(e) {
    if (activePvKey[1] < all_pvs[BL].length) {
       setPvFromKey(activePvKey[1] + 1, BL);
    }
    e.preventDefault();
    return false;
 });

 $('.pv-board-to-last1').click(function(e) {
    setPvFromKey(all_pvs[WH].length - 1, WH);
    e.preventDefault();
    return false;
 });

 $('.pv-board-to-last2').click(function(e) {
    setPvFromKey(all_pvs[BL].length - 1, BL);
    e.preventDefault();
    return false;
 });

 $('.pv-board-reverse1').click(function(e) {
    pvBoardw.flip();
    pvBoardwc.flip();
    e.preventDefault();
    return false;
 });

 $('.pv-board-reverse2').click(function(e) {
    pvBoardb.flip();
    pvBoardbc.flip();
    e.preventDefault();
    return false;
 });

 $('#pv-board-reverse').click(function(e) {
    pvBoarda.flip();
    e.preventDefault();
    return false;
 });

    // charts
    Keys(charts).forEach(key => {
        C(`#chart-${key}`, e => {
            goMoveFromChart(charts[key], e);
        });
    });
}

/**
 * First initialisation of TCEC
 */
function startup_tcec() {
    game = new Chess();
    create_boards();
}
