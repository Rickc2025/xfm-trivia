/* Chimpanzee That! - The Ricky, Steve & Karl trivia game.
   Plain JS, no build step, so it runs straight from GitHub Pages. */
(function () {
  "use strict";

  var QUESTIONS = window.QUESTIONS || [];
  var ROCK = window.ROCKBUSTERS || [];
  var QUOTES = window.QUOTES || [];

  /* ---------------------------------------------------------------- helpers */
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return Math.round(n).toLocaleString("en-GB"); }
  function pick(arr, rnd) { return arr[Math.floor((rnd || Math.random)() * arr.length)]; }
  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* seeded random so a challenge link replays the exact same questions */
  function hashStr(s) {
    var h = 1779033703 ^ s.length;
    for (var i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function newSeed() { return Math.random().toString(36).slice(2, 10); }

  /* localStorage can be unavailable (private mode etc.) - never let that break the game */
  var mem = {};
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem("ct_" + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return k in mem ? mem[k] : d; }
    },
    set: function (k, v) {
      try { localStorage.setItem("ct_" + k, JSON.stringify(v)); }
      catch (e) { mem[k] = v; }
    }
  };

  function b64urlEncode(obj) {
    var s = unescape(encodeURIComponent(JSON.stringify(obj)));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(str) {
    try {
      str = str.replace(/-/g, "+").replace(/_/g, "/");
      while (str.length % 4) str += "=";
      return JSON.parse(decodeURIComponent(escape(atob(str))));
    } catch (e) { return null; }
  }

  /* ---------------------------------------------------------------- content */
  var PEOPLE = {
    karl: { name: "Karl Pilkington", short: "Karl", img: "img/karl-face.jpg", accent: "#ff8a1f" },
    ricky: { name: "Ricky Gervais", short: "Ricky", img: "img/ricky-face.jpg", accent: "#ff5d73" },
    steve: { name: "Stephen Merchant", short: "Steve", img: "img/steve-face.jpg", accent: "#4dabf7" }
  };

  var CATS = {
    karl: { label: "Karl Pilkington", img: "img/karl-face.jpg", accent: "#ff8a1f" },
    ricky: { label: "Ricky Gervais", img: "img/ricky-face.jpg", accent: "#ff5d73" },
    steve: { label: "Stephen Merchant", img: "img/steve-face.jpg", accent: "#4dabf7" },
    monkey: { label: "Monkey News", img: "img/ham.jpg", emoji: "🐒", accent: "#ffd23f" },
    show: { label: "The Show", emoji: "📻", accent: "#b48cff" },
    rock: { label: "Rockbusters", emoji: "🎸", accent: "#ff6fae" },
    who: { label: "Who Said It?", emoji: "💬", accent: "#34d399" }
  };

  var MODES = [
    { id: "mix", title: "The Full Mix", blurb: "15 from everything: Karl, Ricky, Steve, Monkey News, Rockbusters and quotes.", kind: "mix", n: 15, emoji: "🎙️", accent: "#ff8a1f" },
    { id: "daily", title: "Daily Challenge", blurb: "The same 10 questions for everyone today. Compare scores with your mates.", kind: "mix", n: 10, daily: true, emoji: "📅", accent: "#ff4d5e" },
    { id: "karl", title: "Karl Pilkington", blurb: "Diaries, holidays, Auntie Nora and a head like an orange.", kind: "mcq", cat: "karl", n: 10 },
    { id: "ricky", title: "Ricky Gervais", blurb: "Boxing, salamanders, scratch cards and \"Play a record!\"", kind: "mcq", cat: "ricky", n: 10 },
    { id: "steve", title: "Stephen Merchant", blurb: "Six foot seven of Bristol's finest. Trowels, goggles, Crouchy.", kind: "mcq", cat: "steve", n: 10 },
    { id: "monkey", title: "Monkey News", blurb: "Oh, chimpanzee that! Space chimps, monkey surgeons and a jockey.", kind: "mcq", cat: "monkey", n: 10 },
    { id: "show", title: "The Show", blurb: "XFM 104.9, the podcasts, the Guides, the features and the jingles.", kind: "mcq", cat: "show", n: 10 },
    { id: "rock", title: "Rockbusters", blurb: "Karl's \"craptic\" clues. Type the band or artist from the initials.", kind: "rock", n: 8 },
    { id: "who", title: "Who Said It?", blurb: "Ricky, Steve or Karl? Real lines from the shows.", kind: "who", n: 12 },
    { id: "quick", title: "Quick-fire 60", blurb: "60 seconds on the clock. As many as you can. No lifelines.", kind: "quick", emoji: "⚡", accent: "#34d399" }
  ];
  function modeById(id) { for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i]; return null; }

  var RANKS = [
    [0, "Little Round Head", "Everyone starts here."],
    [500, "Button Presser", "\"I press the buttons.\""],
    [1500, "White Van Karl", "You've got opinions on the news."],
    [3000, "Rockbuster", "Craptic clues hold no fear."],
    [5000, "Monkey Newsreader", "Oh, chimpanzee that!"],
    [8000, "Educated Ricky", "Hippopota-nuse."],
    [12000, "The Professor", "Steve would be proud."],
    [18000, "The Podfather", "The most downloaded brain in the world."],
    [26000, "Karl Has Won!", "Because bricks don't fall in wars."]
  ];
  function rankFor(points) {
    var r = RANKS[0], next = null;
    for (var i = 0; i < RANKS.length; i++) {
      if (points >= RANKS[i][0]) { r = RANKS[i]; next = RANKS[i + 1] || null; }
    }
    return { min: r[0], name: r[1], line: r[2], next: next };
  }

  var BADGES = [
    { id: "first", icon: "🍊", name: "Little Round Head", desc: "Finish your first round." },
    { id: "perfect", icon: "🏆", name: "Karl Has Won!", desc: "Get every question right in a round of 8 or more." },
    { id: "karl", icon: "📔", name: "He's Written It Down", desc: "Score 8+ out of 10 in the Karl round." },
    { id: "ricky", icon: "😂", name: "Play a Record!", desc: "Score 8+ out of 10 in the Ricky round." },
    { id: "steve", icon: "🎓", name: "The Professor", desc: "Score 8+ out of 10 in the Steve round." },
    { id: "monkey", icon: "🐒", name: "Chimpanzee That!", desc: "Score 8+ out of 10 in Monkey News." },
    { id: "show", icon: "📻", name: "104.9", desc: "Score 8+ out of 10 in The Show." },
    { id: "rock", icon: "🎸", name: "Wet Knee Houston", desc: "Type 5+ Rockbusters answers right in one round (no options)." },
    { id: "who", icon: "💬", name: "Just a Bit Livid", desc: "Get 10+ right in Who Said It?" },
    { id: "quick", icon: "⚡", name: "Restless Diesel", desc: "Get 12+ right in Quick-fire 60." },
    { id: "streak10", icon: "🔥", name: "The Great Pilkoni", desc: "Hit a 10-answer streak." },
    { id: "daily3", icon: "🥉", name: "Bronze Certificate", desc: "Play the Daily Challenge on 3 different days. Karl got his for a full week at school." },
    { id: "nolife", icon: "🧠", name: "Brain In Charge", desc: "Score 80%+ in a round without using a lifeline." },
    { id: "askkarl", icon: "🥚", name: "Is It Egg?", desc: "Go with Ask Karl's answer and get it wrong." },
    { id: "shambles", icon: "🙈", name: "Shambles Today, This", desc: "Finish a round without a single right answer." },
    { id: "challenger", icon: "🤝", name: "Challenge Accepted", desc: "Play a friend's challenge link." },
    { id: "beat", icon: "🥊", name: "Bovey Beater", desc: "Beat a friend's challenge score." },
    { id: "all", icon: "🌍", name: "Scrimpton", desc: "Play every round at least once." },
    { id: "moon", icon: "🌕", name: "Twenty Acres on the Moon", desc: "Reach 5,000 total points." },
    { id: "share", icon: "📣", name: "Big Mother", desc: "Share your score with someone." }
  ];

  var CORRECT_LINES = [
    "Karl has won!", "Brilliant. Absolutely brilliant.", "Ooh, chimpanzee that!", "Educational, that.",
    "Steve's nodding. That's rare.", "Ricky's doing the high-pitched laugh. In a good way.", "Spot on. Have a bronze certificate.",
    "Correct. Bricks don't fall in wars.", "Right answer. Play a record!"
  ];
  var WRONG_LINES = [
    "Shambles today, this.", "Ricky's laughing so hard he's gone silent.", "You're an idiot. (Affectionately.)",
    "Ooh, that sounds cryptic. No it isn't.", "Is it egg? No. It's not egg.", "That's the ramblings of a madman.",
    "Mad world though, innit.", "Steve's shaking his head. All six foot seven of it.", "Karl would've got that. Probably not, actually."
  ];
  var TIMEOUT_LINES = ["Too slow! Karl's already gone home.", "Time's up. Steve: \"Time's against us. Come on!\"", "Out of time. Ricky's squeezing your head."];
  var KARL_LINES = [
    "I'd go for {o}. Me mam reckons it's that.",
    "It's {o}, innit? I read it in the paper. Or someone told me.",
    "{o}. Don't ask me why. I just don't like the look of the others.",
    "Not being funny, but {o}. Obviously.",
    "Is it egg? No egg? Go on then, {o}.",
    "I'd say {o}. Mad world though, innit.",
    "{o}. Suzanne would say different, but she's wrong an' all.",
    "{o}. I'm sticking with that. Bricks don't fall in wars."
  ];

  var CREDITS = [
    { what: "Ricky Gervais", title: "GervaisPall230921 (15 of 17)", url: "https://commons.wikimedia.org/wiki/File:GervaisPall230921_(15_of_17)_(51527411486)_(cropped_2).jpg",
      by: "Raph_PH", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", note: "cropped and resized" },
    { what: "Stephen Merchant", title: "Stephen Merchant.jpg", url: "https://commons.wikimedia.org/wiki/File:Stephen_Merchant.jpg",
      by: "Raph_PH", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", note: "cropped and resized" },
    { what: "Karl Pilkington", title: "Karl Pilkington 2008 cropped.jpg", url: "https://commons.wikimedia.org/wiki/File:Karl_Pilkington_2008_cropped.jpg",
      by: "Rick Walker (derivative work: RanZag)", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", note: "cropped and resized" },
    { what: "Ham the Astrochimp (Monkey News round)", title: "Ham the chimp (cropped).jpg", url: "https://commons.wikimedia.org/wiki/File:Ham_the_chimp_(cropped).jpg",
      by: "NASA", license: "Public domain", note: "the real 1961 space chimp from the \"final\" Monkey News" }
  ];

  /* ---------------------------------------------------------------- profile */
  var P = store.get("profile", null) || {
    name: "", points: 0, games: 0, correct: 0, answered: 0, bestStreak: 0,
    modes: {}, best: {}, badges: {}, dailies: {}, scores: [], duels: []
  };
  ["modes", "best", "badges", "dailies"].forEach(function (k) { if (!P[k]) P[k] = {}; });
  ["scores", "duels"].forEach(function (k) { if (!Array.isArray(P[k])) P[k] = []; });
  function saveProfile() { store.set("profile", P); }
  function playerName() { return (P.name || "").trim() || "A mate"; }
  function award(id, list) {
    if (P.badges[id]) return;
    P.badges[id] = Date.now();
    if (list) list.push(id);
  }

  /* ---------------------------------------------------------------- sound */
  var soundOn = store.get("sound", true);
  var actx = null;
  function tone(freq, dur, type, vol, when) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var t0 = actx.currentTime + (when || 0);
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.07, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* no audio, no problem */ }
  }
  var sfx = {
    good: function () { tone(660, 0.1, "triangle"); tone(990, 0.16, "triangle", 0.07, 0.09); },
    bad: function () { tone(220, 0.18, "sawtooth", 0.05); tone(160, 0.28, "sawtooth", 0.05, 0.12); },
    tick: function () { tone(1200, 0.03, "square", 0.02); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.18, "triangle", 0.07, i * 0.11); }); },
    click: function () { tone(500, 0.04, "triangle", 0.03); }
  };
  function updateSoundBtn() {
    var b = $("#soundBtn");
    b.textContent = soundOn ? "🔊" : "🔇";
    b.setAttribute("aria-pressed", soundOn ? "true" : "false");
  }

  /* ---------------------------------------------------------------- toast & confetti */
  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var cv = $("#confetti"), ctx = cv.getContext("2d");
    var W = cv.width = window.innerWidth, H = cv.height = window.innerHeight;
    var colors = ["#ff8a1f", "#ffd23f", "#ff5d73", "#4dabf7", "#34d399", "#b48cff"];
    var parts = [];
    for (var i = 0; i < 140; i++) {
      parts.push({ x: W / 2 + (Math.random() - 0.5) * 200, y: H / 3, vx: (Math.random() - 0.5) * 12, vy: Math.random() * -12 - 4,
        r: Math.random() * 6 + 4, c: pick(colors), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, orange: Math.random() < 0.15 });
    }
    var start = performance.now();
    (function frame(now) {
      var dt = now - start;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.orange) { ctx.font = (p.r * 3) + "px serif"; ctx.fillText("🍊", 0, 0); }
        else { ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); }
        ctx.restore();
      });
      if (dt < 2600) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    })(start);
  }

  /* ---------------------------------------------------------------- building a round */
  function mcqItem(q, rnd) {
    return { type: "mcq", cat: q.c, d: q.d || 2, text: q.q, options: shuffle([q.a].concat(q.x), rnd), answer: q.a, fact: q.f, src: q.s };
  }
  function rockItem(r, rnd, typed) {
    return { type: typed ? "rock" : "rockmc", cat: "rock", d: 2, initials: r.i, clue: r.c, answer: r.a, pun: r.pun,
      options: shuffle([r.a].concat(r.x), rnd), src: r.src, alt: r.alt || [] };
  }
  function whoItem(w) {
    return { type: "who", cat: "who", d: 1, quote: w.t, answer: w.w, src: w.s };
  }

  function buildItems(mode, seed) {
    var rnd = mulberry32(hashStr(mode.id + ":" + seed));
    var items = [];
    if (mode.kind === "mcq") {
      items = shuffle(QUESTIONS.filter(function (q) { return q.c === mode.cat; }), rnd).slice(0, mode.n)
        .map(function (q) { return mcqItem(q, rnd); });
      items.sort(function (a, b) { return a.d - b.d; });
    } else if (mode.kind === "rock") {
      items = shuffle(ROCK, rnd).slice(0, mode.n).map(function (r) { return rockItem(r, rnd, true); });
    } else if (mode.kind === "who") {
      items = shuffle(QUOTES, rnd).slice(0, mode.n).map(whoItem);
    } else if (mode.kind === "mix") {
      var nRock = Math.round(mode.n * 0.2), nWho = Math.round(mode.n * 0.2), nQ = mode.n - nRock - nWho;
      var qs = shuffle(QUESTIONS, rnd).slice(0, nQ).map(function (q) { return mcqItem(q, rnd); });
      var rs = shuffle(ROCK, rnd).slice(0, nRock).map(function (r) { return rockItem(r, rnd, false); });
      var ws = shuffle(QUOTES, rnd).slice(0, nWho).map(whoItem);
      items = shuffle(qs.concat(rs, ws), rnd);
    } else if (mode.kind === "quick") {
      var all = QUESTIONS.map(function (q) { return mcqItem(q, rnd); })
        .concat(ROCK.map(function (r) { return rockItem(r, rnd, false); }))
        .concat(QUOTES.map(whoItem));
      items = shuffle(all, rnd).slice(0, 120);
    }
    return items;
  }

  /* ---------------------------------------------------------------- game state */
  var G = null;
  var pendingStart = null;
  var timerRAF = null;
  var incomingChallenge = null;

  function startGame(modeId, opts) {
    opts = opts || {};
    var mode = modeById(modeId);
    if (!mode) { location.hash = "#/"; return; }
    var seed = opts.seed || (mode.daily ? "daily-" + todayKey() : newSeed());
    G = {
      mode: mode, seed: seed, items: buildItems(mode, seed), i: 0, score: 0, correct: 0,
      streak: 0, bestStreak: 0, answers: [], lifelines: { fifty: 1, karl: 1 }, usedLifeline: false,
      challenge: opts.challenge || null, finished: false, quickEnds: 0, rockTyped: 0, askKarlFail: false
    };
    $("#playTitle").textContent = mode.title;
    $("#scoreNow").textContent = "0";
    $("#streak").hidden = true;
    $("#feedback").hidden = true;
    $("#lifelines").hidden = mode.kind === "quick" || mode.kind === "who" || mode.kind === "rock";
    resetLifelineButtons();
    if (mode.kind === "quick") {
      G.quickEnds = performance.now() + 60000;
      runQuickTimer();
    }
    renderItem();
  }

  function resetLifelineButtons() {
    $("#llFifty").disabled = !G || !G.lifelines.fifty;
    $("#llKarl").disabled = !G || !G.lifelines.karl;
  }

  function currentItem() { return G && G.items[G.i]; }

  function timeFor(item) {
    if (G.mode.kind === "quick") return 0;
    return { mcq: 20, rockmc: 25, who: 15, rock: 45 }[item.type] || 20;
  }

  function stopTimer() { if (timerRAF) cancelAnimationFrame(timerRAF); timerRAF = null; }

  function runItemTimer(item) {
    stopTimer();
    var total = timeFor(item);
    var bar = $("#timerBar"), txt = $("#timerText");
    if (!total) return;
    var start = performance.now(), lastSec = total;
    item._total = total;
    (function frame(now) {
      if (!G || currentItem() !== item || item._done) return;
      var left = Math.max(0, total - (now - start) / 1000);
      item._left = left;
      bar.style.transform = "scaleX(" + (left / total) + ")";
      var low = left <= 5;
      bar.classList.toggle("low", low); txt.classList.toggle("low", low);
      var s = Math.ceil(left);
      txt.textContent = s + "s";
      if (low && s !== lastSec) sfx.tick();
      lastSec = s;
      if (left <= 0) { answer(null, { timeout: true }); return; }
      timerRAF = requestAnimationFrame(frame);
    })(start);
  }

  function runQuickTimer() {
    var bar = $("#timerBar"), txt = $("#timerText");
    (function frame(now) {
      if (!G || G.finished || G.mode.kind !== "quick") return;
      var left = Math.max(0, (G.quickEnds - now) / 1000);
      bar.style.transform = "scaleX(" + (left / 60) + ")";
      bar.classList.toggle("low", left <= 10); txt.classList.toggle("low", left <= 10);
      txt.textContent = Math.ceil(left) + "s";
      if (left <= 0) { finishGame(); return; }
      requestAnimationFrame(frame);
    })(performance.now());
  }

  function diffLabel(d) {
    return ["", "●○○ Easy", "●●○ Medium", "●●● Hard"][d] || "";
  }
  function basePoints(item) {
    if (G.mode.kind === "quick") return 100;
    if (item.type === "rock") return 250;
    if (item.type === "who") return 100;
    if (item.type === "rockmc") return 150;
    return { 1: 100, 2: 150, 3: 200 }[item.d] || 100;
  }

  function avatarHtml(cat) {
    var c = CATS[cat] || CATS.show;
    if (c.img) return '<div class="q-avatar" style="--accent:' + c.accent + '"><img src="' + c.img + '" alt="" onerror="this.replaceWith(document.createTextNode(\'' + (c.emoji || "🍊") + '\'))"></div>';
    return '<div class="q-avatar" style="--accent:' + c.accent + '">' + (c.emoji || "🍊") + "</div>";
  }

  function renderItem() {
    var item = currentItem();
    if (!item) { finishGame(); return; }
    var n = G.items.length;
    var isQuick = G.mode.kind === "quick";
    $("#qCounter").textContent = isQuick ? "Question " + (G.i + 1) : (G.i + 1) + " / " + n;
    $("#progressBar").style.width = isQuick ? "100%" : ((G.i / n) * 100) + "%";
    $("#feedback").hidden = true;
    var card = $("#qCard");
    var cat = CATS[item.cat] || CATS.show;
    card.style.setProperty("--accent", cat.accent);
    var head = '<div class="q-top">' + avatarHtml(item.cat) + '<div><div class="q-cat">' + esc(cat.label.toUpperCase()) +
      '</div><div class="q-diff">' + (item.type === "mcq" ? diffLabel(item.d) + " · " : "") + fmt(basePoints(item)) + " pts</div></div></div>";

    if (item.type === "mcq" || item.type === "rockmc") {
      var text = item.type === "mcq" ? esc(item.text)
        : "Rockbusters! Initials <b style=\"color:var(--banana)\">" + esc(item.initials) + "</b>. Karl's clue: \"" + esc(item.clue) + "\"";
      card.innerHTML = head + '<div class="q-text">' + text + "</div>" + optionsHtml(item);
    } else if (item.type === "rock") {
      card.innerHTML = head +
        '<div class="rock-board"><div class="rock-initials" aria-label="Initials ' + esc(item.initials) + '">' + esc(item.initials) + "</div>" +
        '<div class="rock-clue">' + esc(item.clue) + "</div>" +
        '<div class="rock-by">Karl\'s cryptic clue: name the band or artist</div>' +
        '<form class="rock-form" id="rockForm" autocomplete="off"><input id="rockInput" aria-label="Your answer" placeholder="Type the band or artist..." maxlength="60"><button class="btn btn-primary" type="submit">Guess</button></form>' +
        '<div class="rock-alt"><button class="btn btn-small btn-ghost" id="rockOptions" type="button">🤷 Give us some options (half points)</button></div></div>';
      $("#rockForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var v = $("#rockInput").value;
        if (!v.trim()) { $("#rockInput").focus(); return; }
        answer(v, { typed: true });
      });
      $("#rockOptions").addEventListener("click", function () {
        item.usedOptions = true;
        var board = $(".rock-board", card);
        $(".rock-form", board).remove();
        $(".rock-alt", board).remove();
        board.insertAdjacentHTML("beforeend", optionsHtml(item));
        bindOptions(item);
      });
      setTimeout(function () { var i = $("#rockInput"); if (i) i.focus(); }, 50);
    } else if (item.type === "who") {
      card.innerHTML = head + '<div class="quote-bubble">' + esc(item.quote) + '</div><div class="who-options">' +
        ["ricky", "steve", "karl"].map(function (k, idx) {
          return '<button class="who-btn" type="button" data-who="' + k + '" aria-label="' + PEOPLE[k].name + '"><img src="' + PEOPLE[k].img + '" alt="">' +
            (idx + 1) + ". " + PEOPLE[k].short + "</button>";
        }).join("") + "</div>";
      $$(".who-btn", card).forEach(function (b) {
        b.addEventListener("click", function () { answer(b.getAttribute("data-who")); });
      });
    }
    if (item.type === "mcq" || item.type === "rockmc") bindOptions(item);
    var lifeOk = (item.type === "mcq" || item.type === "rockmc") && G.mode.kind !== "quick";
    $("#lifelines").hidden = !lifeOk;
    resetLifelineButtons();
    item._start = performance.now();
    runItemTimer(item);
  }

  function optionsHtml(item) {
    return '<div class="options">' + item.options.map(function (o, i) {
      return '<button class="opt" type="button" data-opt="' + i + '"><span class="key">' + "ABCD"[i] + '</span><span>' + esc(o) + "</span></button>";
    }).join("") + "</div>";
  }
  function bindOptions(item) {
    $$(".opt", $("#qCard")).forEach(function (b) {
      b.addEventListener("click", function () { answer(item.options[+b.getAttribute("data-opt")]); });
    });
  }

  /* ---- Rockbusters typed-answer matching (forgiving, Karl would want it that way) */
  function norm(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\b(the|a)\b/g, " ").replace(/\s+/g, " ").trim();
  }
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[m][n];
  }
  function rockMatch(input, item) {
    var guess = norm(input).replace(/ /g, "");
    if (!guess) return false;
    var targets = [item.answer].concat(item.alt || []);
    return targets.some(function (t) {
      var tn = norm(t).replace(/ /g, "");
      if (guess === tn) return true;
      if (tn.length >= 5 && guess.indexOf(tn) !== -1) return true;
      return lev(guess, tn) <= Math.max(1, Math.floor(tn.length / 6));
    });
  }

  /* ---- answering */
  function answer(choice, meta) {
    meta = meta || {};
    var item = currentItem();
    if (!item || item._done) return;
    item._done = true;
    stopTimer();
    var ok;
    if (meta.timeout) ok = false;
    else if (item.type === "rock" && meta.typed) ok = rockMatch(choice, item);
    else ok = choice === item.answer;

    var left = item._left != null ? item._left : 0;
    var pts = 0;
    if (ok) {
      var base = basePoints(item);
      if (item.type === "rock" && item.usedOptions) base = Math.round(base / 2);
      var bonus = item._total ? Math.round(50 * left / item._total) : 0;
      var mult = 1 + Math.min(G.streak, 5) * 0.1;
      pts = Math.round((base + bonus) * mult);
      if (item.usedFifty) pts = Math.round(pts / 2);
      G.streak++; G.correct++;
      if (G.streak > G.bestStreak) G.bestStreak = G.streak;
      if (item.type === "rock" && !item.usedOptions) G.rockTyped++;
      sfx.good();
    } else {
      G.streak = 0;
      sfx.bad();
      if (item.karlPick && choice === item.karlPick) G.askKarlFail = true;
    }
    G.score += pts;
    G.answers.push({ item: item, choice: meta.timeout ? null : choice, ok: ok, pts: pts });

    // paint the answer state
    var card = $("#qCard");
    if (item.type === "who") {
      $$(".who-btn", card).forEach(function (b) {
        var k = b.getAttribute("data-who");
        b.disabled = true;
        if (k === item.answer) b.classList.add("correct");
        else if (k === choice) b.classList.add("wrong");
      });
    } else if (item.type === "rock" && meta.typed) {
      var inp = $("#rockInput"); if (inp) { inp.disabled = true; inp.style.borderColor = ok ? "var(--green)" : "var(--red)"; }
      $$(".rock-form button, #rockOptions", card).forEach(function (b) { b.disabled = true; });
    } else {
      $$(".opt", card).forEach(function (b) {
        var o = item.options[+b.getAttribute("data-opt")];
        b.disabled = true;
        if (o === item.answer) b.classList.add("correct");
        else if (o === choice) b.classList.add("wrong");
      });
    }
    $("#llFifty").disabled = true; $("#llKarl").disabled = true;

    var sb = $("#scoreNow").parentNode;
    $("#scoreNow").textContent = fmt(G.score);
    sb.classList.remove("bump"); void sb.offsetWidth; sb.classList.add("bump");
    $("#streak").hidden = G.streak < 2;
    $("#streakNum").textContent = G.streak;

    if (G.mode.kind === "quick") {
      setTimeout(function () { if (G && !G.finished) { G.i++; renderItem(); } }, ok ? 380 : 900);
      return;
    }
    showFeedback(item, ok, pts, meta);
  }

  function showFeedback(item, ok, pts, meta) {
    var fb = $("#feedback");
    var title = meta.timeout ? pick(TIMEOUT_LINES) : ok ? pick(CORRECT_LINES) : pick(WRONG_LINES);
    var body = "";
    if (item.type === "who") {
      body = '<p class="fb-fact">That was <b>' + PEOPLE[item.answer].name + "</b>.</p>";
    } else if (item.type === "rock" || item.type === "rockmc") {
      body = '<p class="fb-fact">The answer was <b>' + esc(item.answer) + '</b>. <span class="rock-pun">' + esc(item.pun) + "</span></p>";
    } else {
      if (!ok) body += '<p class="fb-fact">The answer was <b>' + esc(item.answer) + "</b>.</p>";
      body += '<p class="fb-fact">' + esc(item.fact) + "</p>";
    }
    var last = G.i >= G.items.length - 1;
    fb.className = "feedback " + (ok ? "good" : "bad");
    fb.innerHTML = '<div class="fb-head"><span>' + (ok ? "✅" : meta.timeout ? "⏰" : "❌") + "</span><span>" + esc(title) + "</span>" +
      (ok ? '<span class="fb-points">+' + fmt(pts) + "</span>" : "") + "</div>" + body +
      '<div class="fb-src">📼 Source: ' + esc(item.src) + "</div>" +
      '<div class="fb-actions"><button class="btn btn-primary" id="nextBtn" type="button">' + (last ? "See your score ▶" : "Next ▶") + "</button></div>";
    fb.hidden = false;
    $("#nextBtn").addEventListener("click", next);
    setTimeout(function () {
      var nb = $("#nextBtn");
      if (nb) { nb.focus({ preventScroll: true }); fb.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
    }, 60);
  }

  function next() {
    if (!G) return;
    sfx.click();
    G.i++;
    if (G.i >= G.items.length) finishGame();
    else { renderItem(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  /* ---- lifelines */
  function useFifty() {
    var item = currentItem();
    if (!item || item._done || !G.lifelines.fifty || !(item.type === "mcq" || item.type === "rockmc")) return;
    G.lifelines.fifty = 0; G.usedLifeline = true; item.usedFifty = true;
    var wrong = item.options.filter(function (o) { return o !== item.answer && o !== item.karlPick; });
    var rnd = Math.random;
    var keep = item.karlPick && item.karlPick !== item.answer ? item.karlPick : pick(wrong, rnd);
    var removed = 0;
    shuffle(item.options.slice(), rnd).forEach(function (o) {
      if (removed < 2 && o !== item.answer && o !== keep) {
        var idx = item.options.indexOf(o);
        var b = $('.opt[data-opt="' + idx + '"]', $("#qCard"));
        if (b) { b.classList.add("gone"); b.disabled = true; removed++; }
      }
    });
    $("#llFifty").disabled = true;
    sfx.click();
  }
  function useKarl() {
    var item = currentItem();
    if (!item || item._done || !G.lifelines.karl || !(item.type === "mcq" || item.type === "rockmc")) return;
    G.lifelines.karl = 0; G.usedLifeline = true;
    var live = item.options.filter(function (o, i) {
      var b = $('.opt[data-opt="' + i + '"]', $("#qCard"));
      return !(b && b.classList.contains("gone"));
    });
    var wrong = live.filter(function (o) { return o !== item.answer; });
    var choice = Math.random() < 0.4 || !wrong.length ? item.answer : pick(wrong);
    item.karlPick = choice;
    var idx = item.options.indexOf(choice);
    var b = $('.opt[data-opt="' + idx + '"]', $("#qCard"));
    if (b) b.classList.add("karl-pick");
    var line = pick(KARL_LINES).replace("{o}", "\"" + choice + "\"");
    $("#qCard").insertAdjacentHTML("beforeend", '<div class="karl-says"><img src="img/karl-face.jpg" alt="Karl"><span>' + esc(line) + "</span></div>");
    $("#llKarl").disabled = true;
    sfx.click();
  }

  /* ---------------------------------------------------------------- finishing */
  function finishGame() {
    if (!G || G.finished) return;
    G.finished = true;
    stopTimer();
    var mode = G.mode;
    var total = mode.kind === "quick" ? G.answers.length : G.items.length;
    var pct = total ? G.correct / total : 0;
    var newBadges = [];
    var hadDailyToday = !!P.dailies[todayKey()];

    P.points += G.score; P.games++; P.correct += G.correct; P.answered += total;
    P.bestStreak = Math.max(P.bestStreak || 0, G.bestStreak);
    P.modes[mode.id] = (P.modes[mode.id] || 0) + 1;
    var prevBest = P.best[mode.id] || 0;
    if (G.score > prevBest) P.best[mode.id] = G.score;
    if (mode.daily && !hadDailyToday) P.dailies[todayKey()] = { p: G.score, k: G.correct, t: total };

    P.scores.push({ n: playerName(), m: mode.id, p: G.score, k: G.correct, t: total, d: Date.now() });
    P.scores.sort(function (a, b) { return b.p - a.p; });
    P.scores = P.scores.slice(0, 60);

    award("first", newBadges);
    if (total >= 8 && G.correct === total) award("perfect", newBadges);
    if (["karl", "ricky", "steve", "monkey", "show"].indexOf(mode.id) !== -1 && G.correct >= 8) award(mode.id, newBadges);
    if (mode.id === "rock" && G.rockTyped >= 5) award("rock", newBadges);
    if (mode.id === "who" && G.correct >= 10) award("who", newBadges);
    if (mode.id === "quick" && G.correct >= 12) award("quick", newBadges);
    if (G.bestStreak >= 10) award("streak10", newBadges);
    if (Object.keys(P.dailies).length >= 3) award("daily3", newBadges);
    if (!G.usedLifeline && pct >= 0.8 && mode.kind !== "quick" && total >= 8) award("nolife", newBadges);
    if (G.askKarlFail) award("askkarl", newBadges);
    if (total > 0 && G.correct === 0) award("shambles", newBadges);
    if (MODES.every(function (m) { return P.modes[m.id]; })) award("all", newBadges);
    if (P.points >= 5000) award("moon", newBadges);

    var duel = null;
    if (G.challenge) {
      award("challenger", newBadges);
      duel = { d: Date.now(), m: mode.id, them: G.challenge, me: { n: playerName(), p: G.score, k: G.correct, t: total } };
      if (G.score > G.challenge.p) award("beat", newBadges);
      P.duels.unshift(duel); P.duels = P.duels.slice(0, 30);
    }
    saveProfile();
    G.result = { total: total, pct: pct, newBadges: newBadges, prevBest: prevBest, duel: duel, dailyRepeat: mode.daily && hadDailyToday };
    location.hash = "#/results";
  }

  function verdict(pct) {
    if (pct >= 1) return { img: "img/steve-face.jpg", q: "Karl has won!!", line: "Perfect round. Steve's shouting the house down." };
    if (pct >= 0.8) return { img: "img/ricky-face.jpg", q: "You are the most interesting man I have ever met.", line: "Ricky's impressed, and that never happens." };
    if (pct >= 0.6) return { img: "img/karl-face.jpg", q: "Mad world though, innit.", line: "Solid. You've clearly done your listening." };
    if (pct >= 0.4) return { img: "img/karl-face.jpg", q: "Shambles today, this.", line: "Middling. Have a bronze certificate for turning up." };
    if (pct >= 0.2) return { img: "img/ricky-face.jpg", q: "Play a record!", line: "Ricky's had enough. Go back to the podcasts and have another go." };
    return { img: "img/karl-face.jpg", q: "Right, to every question now I'm going to have egg as the answer.", line: "You may as well do what Karl does on University Challenge and answer \"egg\" to everything." };
  }

  function challengeUrl() {
    var data = { m: G.mode.id, s: G.seed, n: playerName().slice(0, 20), p: G.score, k: G.correct, t: G.result.total };
    return location.origin + location.pathname + "?c=" + b64urlEncode(data);
  }
  function shareText() {
    var mode = G.mode;
    return "I scored " + fmt(G.score) + " points (" + G.correct + "/" + G.result.total + ") in " + mode.title +
      " on Chimpanzee That!, the Ricky, Steve & Karl trivia game. Think you know more about the little round head? 🍊🐒";
  }

  function renderResults() {
    if (!G || !G.finished || !G.result) { location.hash = "#/"; return; }
    var r = G.result, mode = G.mode, v = verdict(r.pct);
    var rank = rankFor(P.points);
    var url = challengeUrl();
    var html = '<div class="res-kicker">' + esc(mode.title.toUpperCase()) + (mode.daily ? " · " + todayKey() : "") + "</div>" +
      '<div class="res-score">' + fmt(G.score) + "</div>" +
      '<div class="res-line">' + G.correct + " out of " + r.total + " right" + (G.score > r.prevBest && r.prevBest > 0 ? " · 🎉 New personal best!" : "") + "</div>" +
      '<div class="res-verdict"><img src="' + v.img + '" alt=""><div><q>' + esc(v.q) + "</q><div class=\"muted\">" + esc(v.line) + "</div></div></div>";

    if (r.duel) {
      var them = r.duel.them, won = G.score > them.p, draw = G.score === them.p;
      html += '<div class="duel"><div class="res-kicker">CHALLENGE RESULT</div>' +
        '<div class="duel-row"><span>' + esc(them.n) + "</span><span>" + fmt(them.p) + " (" + them.k + "/" + them.t + ")</span></div>" +
        '<div class="duel-row"><span>You</span><span>' + fmt(G.score) + " (" + G.correct + "/" + r.total + ")</span></div>" +
        '<p class="res-line">' + (won ? "🥊 You beat " + esc(them.n) + "! Send it back and rub it in." : draw ? "🤝 A draw. Dead even." : "😬 " + esc(them.n) + " wins this one. Have another go?") + "</p></div>";
    }
    if (r.dailyRepeat) html += '<p class="muted small">You\'d already done today\'s challenge, so your first score is the one that counts for the day.</p>';

    html += '<div class="res-grid">' +
      '<div class="stat"><b>' + Math.round(r.pct * 100) + '%</b><span>accuracy</span></div>' +
      '<div class="stat"><b>' + G.bestStreak + '</b><span>best streak</span></div>' +
      '<div class="stat"><b>' + fmt(P.points) + '</b><span>total points</span></div></div>' +
      '<p class="res-line">Rank: <span class="rank-chip">' + esc(rank.name) + "</span></p>";

    if (r.newBadges.length) {
      html += '<div class="res-kicker" style="margin-top:14px">NEW BADGES</div><div class="new-badges">' +
        r.newBadges.map(function (id) { var b = badgeById(id); return '<span class="badge-pill">' + b.icon + " " + esc(b.name) + "</span>"; }).join("") + "</div>";
    }

    html += '<div class="res-kicker" style="margin-top:18px">CHALLENGE YOUR MATES</div>' +
      '<p class="muted small" style="margin:4px 0 0">Your link gives them the exact same questions, and they\'ll see your score to beat.</p>' +
      '<div class="share-row">' +
      (navigator.share ? '<button class="btn btn-primary" id="shNative" type="button">📤 Share</button>' : "") +
      '<button class="btn" id="shCopy" type="button">🔗 Copy link</button>' +
      '<a class="btn" id="shWa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(shareText() + " " + url) + '">💬 WhatsApp</a>' +
      '<a class="btn" id="shX" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText()) + "&url=" + encodeURIComponent(url) + '">𝕏 Post</a>' +
      '<a class="btn" id="shFb" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '">f Facebook</a>' +
      '<button class="btn" id="shCard" type="button">🖼️ Score card</button></div>' +
      '<div class="share-link"><input id="shLink" readonly value="' + esc(url) + '" aria-label="Challenge link"></div>' +
      '<div class="share-row"><button class="btn btn-primary btn-lg" id="againBtn" type="button">↻ Play again</button><a class="btn btn-lg btn-ghost" href="#/">🏠 Pick another round</a></div>';

    html += '<details class="review"><summary>Review your answers</summary><ol>' + G.answers.map(function (a) {
      var it = a.item, q;
      if (it.type === "who") q = "\"" + it.quote + "\"";
      else if (it.type === "rock" || it.type === "rockmc") q = "Rockbusters " + it.initials + ": \"" + it.clue + "\"";
      else q = it.text;
      var right = it.type === "who" ? PEOPLE[it.answer].short : it.answer;
      var yours = a.choice == null ? "(no answer)" : it.type === "who" ? PEOPLE[a.choice].short : a.choice;
      return "<li><div>" + esc(q) + '</div><div class="' + (a.ok ? "ok" : "no") + '">' + (a.ok ? "✔ " : "✘ ") + esc(yours) +
        (a.ok ? "" : ' · <span class="ok">✔ ' + esc(right) + "</span>") + ' <span class="muted small">(' + esc(it.src) + ")</span></div></li>";
    }).join("") + "</ol></details>";

    $("#resultsCard").innerHTML = html;
    if (r.pct >= 0.8) { confetti(); sfx.win(); }

    function shared() { award("share"); saveProfile(); }
    var nat = $("#shNative");
    if (nat) nat.addEventListener("click", function () {
      navigator.share({ title: "Chimpanzee That!", text: shareText(), url: url }).then(shared).catch(function () {});
    });
    $("#shCopy").addEventListener("click", function () { copyText(shareText() + " " + url); shared(); });
    ["#shWa", "#shX", "#shFb"].forEach(function (s) { $(s).addEventListener("click", shared); });
    $("#shCard").addEventListener("click", function () { makeScoreCard(); shared(); });
    $("#shLink").addEventListener("focus", function () { this.select(); });
    $("#againBtn").addEventListener("click", function () {
      if (G.mode.daily) { pendingStart = { mode: "mix" }; location.hash = "#/play/mix"; route(); return; }
      pendingStart = { mode: G.mode.id };
      var id = G.mode.id; G = null;
      location.hash = "#/play/" + id; route();
    });
    updateNav();
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast("Copied! Paste it to your mates."); }, fallback);
    } else fallback();
    function fallback() {
      var i = $("#shLink"); i.value = t; i.select();
      try { document.execCommand("copy"); toast("Copied! Paste it to your mates."); } catch (e) { toast("Select the link and copy it."); }
    }
  }

  /* ---- downloadable score card (1080x1080 PNG) */
  function loadImg(src) {
    return new Promise(function (res) {
      var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src;
    });
  }
  function makeScoreCard() {
    var S = 1080, cv = document.createElement("canvas"); cv.width = S; cv.height = S;
    var ctx = cv.getContext("2d");
    var fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load("80px Bungee"), document.fonts.load("900 40px Nunito")]) : Promise.resolve();
    Promise.all([fontsReady, loadImg("img/ricky-face.jpg"), loadImg("img/karl-face.jpg"), loadImg("img/steve-face.jpg")]).then(function (res) {
      var imgs = res.slice(1);
      var g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, "#0f1226"); g.addColorStop(1, "#2a1446");
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = "rgba(255,138,31,.25)"; ctx.beginPath(); ctx.arc(S - 120, 140, 260, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = "center";
      ctx.fillStyle = "#ff8a1f"; ctx.font = "64px Bungee, Impact, sans-serif";
      ctx.fillText("CHIMPANZEE THAT!", S / 2, 140);
      ctx.fillStyle = "#a9aed0"; ctx.font = "800 34px Nunito, sans-serif";
      ctx.fillText("The Ricky, Steve & Karl Trivia Game", S / 2, 196);
      ctx.fillStyle = "#f6f2ea"; ctx.font = "900 44px Nunito, sans-serif";
      ctx.fillText(playerName() + " · " + G.mode.title, S / 2, 300);
      ctx.fillStyle = "#ffd23f"; ctx.font = "200px Bungee, Impact, sans-serif";
      ctx.fillText(fmt(G.score), S / 2, 500);
      ctx.fillStyle = "#f6f2ea"; ctx.font = "900 50px Nunito, sans-serif";
      ctx.fillText(G.correct + " / " + G.result.total + " correct · " + rankFor(P.points).name, S / 2, 580);
      var r = 120, y = 790, xs = [S / 2 - 290, S / 2, S / 2 + 290], cols = ["#ff5d73", "#ff8a1f", "#4dabf7"];
      imgs.forEach(function (im, i) {
        ctx.save(); ctx.beginPath(); ctx.arc(xs[i], y, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        if (im) {
          var sc = Math.max((2 * r) / im.width, (2 * r) / im.height);
          ctx.drawImage(im, xs[i] - im.width * sc / 2, y - im.height * sc / 2 - 10, im.width * sc, im.height * sc);
        } else { ctx.fillStyle = cols[i]; ctx.fill(); }
        ctx.restore();
        ctx.lineWidth = 10; ctx.strokeStyle = cols[i]; ctx.beginPath(); ctx.arc(xs[i], y, r, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.fillStyle = "#a9aed0"; ctx.font = "800 32px Nunito, sans-serif";
      ctx.fillText("Can you beat me? " + location.host + location.pathname.replace(/index\.html$/, ""), S / 2, 1010);

      cv.toBlob(function (blob) {
        if (!blob) { toast("Couldn't make the image on this browser."); return; }
        var file = typeof File === "function" ? new File([blob], "chimpanzee-that-score.png", { type: "image/png" }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: "Chimpanzee That!", text: shareText() + " " + challengeUrl() }).catch(function () { download(blob); });
        } else download(blob);
      }, "image/png");
    });
    function download(blob) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "chimpanzee-that-score.png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast("Score card saved. Post it anywhere!");
    }
  }

  /* ---------------------------------------------------------------- home / scores / profile */
  function badgeById(id) { for (var i = 0; i < BADGES.length; i++) if (BADGES[i].id === id) return BADGES[i]; return { icon: "⭐", name: id }; }

  function modeIconHtml(m) {
    if (m.cat && CATS[m.cat] && CATS[m.cat].img) {
      return '<div class="mode-icon"><img src="' + CATS[m.cat].img + '" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode(\'' + (CATS[m.cat].emoji || "🍊") + '\'))"></div>';
    }
    var c = CATS[m.cat || m.kind] || {};
    return '<div class="mode-icon">' + (m.emoji || c.emoji || "🎙️") + "</div>";
  }

  function renderHome() {
    var daily = P.dailies[todayKey()];
    $("#modes").innerHTML = MODES.map(function (m) {
      var accent = m.accent || (CATS[m.cat || m.kind] || {}).accent || "#ff8a1f";
      var best = P.best[m.id];
      var tag = m.daily && !daily ? '<span class="tag">NEW TODAY</span>' : "";
      var sub = m.daily && daily ? "Done today: " + fmt(daily.p) + " pts (" + daily.k + "/" + daily.t + ")" : best ? "Best: " + fmt(best) + " pts" : "";
      return '<button class="mode' + (m.kind === "mix" ? " featured" : "") + '" type="button" data-start="' + m.id + '" style="--accent:' + accent + '">' + modeIconHtml(m) +
        "<div><h3>" + esc(m.title) + tag + "</h3><p>" + esc(m.blurb) + "</p>" + (sub ? '<span class="best">' + esc(sub) + "</span>" : "") + "</div></button>";
    }).join("");
    var acc = P.answered ? Math.round((P.correct / P.answered) * 100) : 0;
    $("#statsStrip").innerHTML =
      '<div class="stat"><b>' + fmt(QUESTIONS.length + ROCK.length + QUOTES.length) + "</b><span>questions, clues &amp; quotes</span></div>" +
      '<div class="stat"><b>' + fmt(P.games) + "</b><span>rounds you've played</span></div>" +
      '<div class="stat"><b>' + acc + "%</b><span>your accuracy</span></div>" +
      '<div class="stat"><b>' + Object.keys(P.badges).length + "/" + BADGES.length + "</b><span>badges unlocked</span></div>";
    $("#playerName").value = P.name || "";
    $("#rankChip").textContent = rankFor(P.points).name;
    renderChallengeBanner();
    updateNav();
  }

  function renderChallengeBanner() {
    var b = $("#challengeBanner"), c = incomingChallenge;
    if (!c) { b.hidden = true; return; }
    var m = modeById(c.m);
    b.innerHTML = '<span class="big">🥊</span><p><b>' + esc(c.n) + "</b> scored <b>" + fmt(c.p) + " points</b> (" + c.k + "/" + c.t + ") in <b>" +
      esc(m.title) + "</b> and reckons you can't beat it. Same questions, same order.</p>" +
      '<button class="btn btn-primary" id="acceptBtn" type="button">Accept the challenge</button>' +
      '<button class="btn btn-small btn-ghost" id="dismissBtn" type="button">Not now</button>';
    b.hidden = false;
    $("#acceptBtn").addEventListener("click", function () {
      pendingStart = { mode: c.m, seed: c.s, challenge: c };
      location.hash = "#/play/" + c.m; route();
    });
    $("#dismissBtn").addEventListener("click", function () { incomingChallenge = null; b.hidden = true; });
  }

  var scoreFilter = "all";
  function renderScores() {
    $("#scoreFilters").innerHTML = [{ id: "all", title: "All rounds" }].concat(MODES).map(function (m) {
      return '<button class="chip" type="button" data-f="' + m.id + '" aria-pressed="' + (scoreFilter === m.id) + '">' + esc(m.title) + "</button>";
    }).join("");
    $$("#scoreFilters .chip").forEach(function (c) {
      c.addEventListener("click", function () { scoreFilter = c.getAttribute("data-f"); renderScores(); });
    });
    var list = P.scores.filter(function (s) { return scoreFilter === "all" || s.m === scoreFilter; }).slice(0, 15);
    $("#board").innerHTML = list.length ? list.map(function (s, i) {
      var m = modeById(s.m);
      return '<li><span class="pos">' + (i + 1) + '</span><span><span class="who">' + esc(s.n) + '</span><br><span class="meta">' +
        esc(m ? m.title : s.m) + " · " + s.k + "/" + s.t + " · " + new Date(s.d).toLocaleDateString() + '</span></span><span class="pts">' + fmt(s.p) + "</span></li>";
    }).join("") : '<li class="empty">No scores yet. Go and play a round!</li>';
    $("#duels").innerHTML = P.duels.length ? P.duels.map(function (d) {
      var m = modeById(d.m), won = d.me.p > d.them.p, draw = d.me.p === d.them.p;
      return '<li><span class="pos">' + (won ? "🥊" : draw ? "🤝" : "😬") + '</span><span><span class="who">You vs ' + esc(d.them.n) + '</span><br><span class="meta">' +
        esc(m ? m.title : d.m) + " · " + new Date(d.d).toLocaleDateString() + '</span></span><span class="pts">' + fmt(d.me.p) + " – " + fmt(d.them.p) + "</span></li>";
    }).join("") : '<li class="empty">When a mate sends you a challenge link, the result shows up here.</li>';
  }

  function renderProfile() {
    var rank = rankFor(P.points);
    var pct = rank.next ? Math.min(100, ((P.points - rank.min) / (rank.next[0] - rank.min)) * 100) : 100;
    $("#profileCard").innerHTML = '<img class="big-orange" src="img/logo.svg" alt="">' +
      "<div><div class=\"muted\">" + esc(P.name || "No name yet (set it on the home screen)") + "</div>" +
      '<div class="rank-title">' + esc(rank.name) + '</div><div class="muted">' + esc(rank.line) + "</div>" +
      '<div class="rank-progress"><div style="width:' + pct + '%"></div></div>' +
      '<div class="muted small">' + fmt(P.points) + " pts" + (rank.next ? " · " + fmt(rank.next[0] - P.points) + " to <b>" + esc(rank.next[1]) + "</b>" : " · top rank!") + "</div>" +
      '<div class="res-grid" style="margin-top:12px">' +
      '<div class="stat"><b>' + fmt(P.games) + '</b><span>rounds</span></div>' +
      '<div class="stat"><b>' + fmt(P.correct) + '</b><span>right answers</span></div>' +
      '<div class="stat"><b>' + (P.bestStreak || 0) + '</b><span>best streak</span></div></div>' +
      '<button class="btn btn-small btn-ghost" id="resetBtn" type="button">Reset my progress</button></div>';
    $("#resetBtn").addEventListener("click", function () {
      if (!confirm("Wipe all your points, scores and badges on this device?")) return;
      var name = P.name;
      P = { name: name, points: 0, games: 0, correct: 0, answered: 0, bestStreak: 0, modes: {}, best: {}, badges: {}, dailies: {}, scores: [], duels: [] };
      saveProfile(); renderProfile(); updateNav(); toast("Fresh start. Little Round Head again.");
    });
    $("#badges").innerHTML = BADGES.map(function (b) {
      var got = P.badges[b.id];
      return '<div class="badge ' + (got ? "" : "locked") + '"><div class="b-icon">' + b.icon + "</div><div><b>" + esc(b.name) + "</b><span>" + esc(b.desc) + "</span></div></div>";
    }).join("");
  }

  function renderAbout() {
    $("#photoCredits").innerHTML = CREDITS.map(function (c) {
      return "<li><b>" + esc(c.what) + "</b>: " + (c.url ? '<a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.title || "Wikimedia Commons") + "</a>" : "") +
        (c.by ? " by " + esc(c.by) : "") + (c.license ? ", " + (c.licenseUrl ? '<a href="' + esc(c.licenseUrl) + '" target="_blank" rel="noopener">' + esc(c.license) + "</a>" : esc(c.license)) : "") +
        (c.note ? " (" + esc(c.note) + ")" : "") + "</li>";
    }).join("");
  }

  function updateNav() {
    $("#navPoints").textContent = fmt(P.points);
  }

  /* ---------------------------------------------------------------- Karl's thought for the day */
  var karlQuotes = QUOTES.filter(function (q) { return q.w === "karl"; });
  var kq = Math.floor(Math.random() * karlQuotes.length);
  function rotateKarlism() {
    if (!karlQuotes.length) return;
    var el = $("#karlism"), src = $("#karlismSrc");
    el.style.opacity = 0;
    setTimeout(function () {
      kq = (kq + 1) % karlQuotes.length;
      el.textContent = "“" + karlQuotes[kq].t + "”";
      src.textContent = "Karl Pilkington · " + karlQuotes[kq].s;
      el.style.opacity = 1;
    }, 400);
  }

  /* ---------------------------------------------------------------- routing */
  function showScreen(name) {
    $$(".screen").forEach(function (s) { s.hidden = s.getAttribute("data-screen") !== name; });
  }
  function route() {
    var h = (location.hash || "#/").replace(/^#\/?/, "");
    var parts = h.split("/");
    var r = parts[0] || "";
    if (r !== "play") stopTimer();
    // leaving a round half-way through abandons it (its points never counted)
    if (r !== "play" && r !== "results" && G && !G.finished) G.finished = true;
    if (r === "play") {
      var id = parts[1];
      if (!G || G.finished || G.mode.id !== id || pendingStart) {
        var opts = pendingStart && pendingStart.mode === id ? pendingStart : {};
        pendingStart = null;
        startGame(id, opts);
      }
      showScreen("play");
    } else if (r === "results") {
      showScreen("results"); renderResults();
    } else if (r === "scores") {
      showScreen("scores"); renderScores();
    } else if (r === "profile") {
      showScreen("profile"); renderProfile();
    } else if (r === "about") {
      showScreen("about"); renderAbout();
    } else {
      showScreen("home"); renderHome();
    }
    var main = $("#main");
    if (r !== "play") window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- events */
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-start]") : null;
    if (!t) return;
    var id = t.getAttribute("data-start");
    pendingStart = { mode: id };
    sfx.click();
    if (location.hash === "#/play/" + id) route(); else location.hash = "#/play/" + id;
  });

  document.addEventListener("keydown", function (e) {
    if ($("#screen-play").hidden || !G || G.finished) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    var item = currentItem();
    if (!item) return;
    if (item._done) {
      if ((e.key === "Enter" || e.key === " " || e.key === "ArrowRight") && G.mode.kind !== "quick") {
        if (e.target && e.target.id === "nextBtn") return; // let the button handle it
        e.preventDefault(); next();
      }
      return;
    }
    var k = e.key.toLowerCase();
    if (item.type === "who") {
      var map = { "1": "ricky", "2": "steve", "3": "karl", r: "ricky", s: "steve", k: "karl" };
      if (map[k]) { e.preventDefault(); answer(map[k]); }
    } else if ($(".opt", $("#qCard"))) {
      var idx = "1234".indexOf(k); if (idx < 0) idx = "abcd".indexOf(k);
      if (idx >= 0 && item.options[idx] != null) {
        var b = $('.opt[data-opt="' + idx + '"]', $("#qCard"));
        if (b && !b.disabled) { e.preventDefault(); answer(item.options[idx]); }
      }
    }
  });

  $("#llFifty").addEventListener("click", useFifty);
  $("#llKarl").addEventListener("click", useKarl);
  $("#quitBtn").addEventListener("click", function () {
    if (G && !G.finished && G.answers.length && !confirm("Quit this round? Your points for it won't count.")) return;
    if (G) G.finished = true;
    stopTimer();
    location.hash = "#/";
  });
  $("#soundBtn").addEventListener("click", function () {
    soundOn = !soundOn; store.set("sound", soundOn); updateSoundBtn(); if (soundOn) sfx.click();
  });
  $("#playerName").addEventListener("input", function () {
    P.name = this.value.replace(/[<>]/g, "").slice(0, 20); saveProfile();
  });
  window.addEventListener("hashchange", route);

  /* ---------------------------------------------------------------- boot */
  (function readChallenge() {
    var m = /[?&]c=([^&#]+)/.exec(location.search);
    if (!m) return;
    var c = b64urlDecode(m[1]);
    if (!c || !modeById(c.m) || typeof c.s !== "string" || c.s.length > 40) return;
    incomingChallenge = {
      m: c.m, s: c.s, n: String(c.n || "A mate").replace(/[<>]/g, "").slice(0, 20),
      p: Math.max(0, Math.min(1e6, +c.p || 0)), k: Math.max(0, Math.min(200, +c.k || 0)), t: Math.max(1, Math.min(200, +c.t || 1))
    };
    if (history.replaceState) history.replaceState(null, "", location.pathname + (location.hash || "#/"));
  })();

  updateSoundBtn();
  rotateKarlism();
  setInterval(rotateKarlism, 9000);
  if (!location.hash || location.hash === "#") location.hash = "#/";
  route();
})();
