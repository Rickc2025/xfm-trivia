/* Chimpanzee That! - The Ricky, Steve & Karl trivia game.
   Plain JS, no build step, so it runs straight from GitHub Pages.
   Question data lives in data/*.json and is loaded on demand. */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- helpers */
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return Math.round(n).toLocaleString("en-GB"); }
  function pick(arr, rnd) { return arr[Math.floor((rnd || Math.random)() * arr.length)]; }
  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dayNumber(d) {
    d = d || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  /* seeded random so challenges and the daily round are the same for everyone */
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
    educating: { label: "Educating Ricky", emoji: "📚", accent: "#a3e635" },
    show: { label: "The Show", emoji: "📻", accent: "#b48cff" },
    rock: { label: "Rockbusters", emoji: "🎸", accent: "#ff6fae" },
    who: { label: "Who Said It?", emoji: "💬", accent: "#34d399" }
  };

  /* pools = the folders in data/. Each mode lists the pools it needs. */
  var MCQ_POOLS = ["karl", "ricky", "steve", "monkey", "educating", "show"];
  var ALL_POOLS = MCQ_POOLS.concat(["rock", "who"]);

  var MODES = [
    { id: "mix", title: "The Full Mix", blurb: "15 from everything: Karl, Ricky, Steve, Monkey News, Rockbusters and quotes.", kind: "mix", n: 15, emoji: "🎙️", accent: "#ff8a1f", pools: ALL_POOLS },
    { id: "daily", title: "Daily Challenge", blurb: "The same 10 questions for everyone today. Compare scores with your mates.", kind: "mix", n: 10, daily: true, emoji: "📅", accent: "#ff4d5e", pools: ALL_POOLS },
    { id: "karl", title: "Karl Pilkington", blurb: "Diaries, holidays, Auntie Nora and a head like an orange.", kind: "mcq", cat: "karl", n: 10, pools: ["karl"] },
    { id: "ricky", title: "Ricky Gervais", blurb: "Boxing, salamanders, scratch cards and \"Play a record!\"", kind: "mcq", cat: "ricky", n: 10, pools: ["ricky"] },
    { id: "steve", title: "Stephen Merchant", blurb: "Six foot seven of Bristol's finest. Trowels, goggles, Crouchy.", kind: "mcq", cat: "steve", n: 10, pools: ["steve"] },
    { id: "monkey", title: "Monkey News", blurb: "Oh, chimpanzee that! Space chimps, monkey surgeons and a jockey.", kind: "mcq", cat: "monkey", n: 10, pools: ["monkey"] },
    { id: "educating", title: "Educating Ricky", blurb: "Karl teaches Ricky what he's read this week. Alien gives man a beard, the hairy Chinese kid...", kind: "mcq", cat: "educating", n: 10, pools: ["educating"] },
    { id: "show", title: "The Show", blurb: "XFM 104.9, the podcasts, the Guides, the features and the jingles.", kind: "mcq", cat: "show", n: 10, pools: ["show"] },
    { id: "rock", title: "Rockbusters", blurb: "Karl's \"craptic\" clues. Type the band or artist from the initials.", kind: "rock", n: 8, pools: ["rock"] },
    { id: "who", title: "Who Said It?", blurb: "Ricky, Steve or Karl? Real lines from the shows.", kind: "who", n: 12, pools: ["who"] },
    { id: "quick", title: "Quick-fire 60", blurb: "60 seconds on the clock. As many as you can. No lifelines.", kind: "quick", emoji: "⚡", accent: "#34d399", pools: ALL_POOLS }
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
    { id: "educating", icon: "📚", name: "Alien Gives Man a Beard", desc: "Score 8+ out of 10 in Educating Ricky." },
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
    { id: "share", icon: "📣", name: "Big Mother", desc: "Share your score with someone." },
    { id: "tapes", icon: "📼", name: "Tape Head", desc: "See 500 different questions." }
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
    { what: "Ham the chimp", title: "Ham the chimp (cropped).jpg", url: "https://commons.wikimedia.org/wiki/File:Ham_the_chimp_(cropped).jpg",
      by: "NASA", license: "Public domain", note: "the real 1961 space chimp from the \"final\" Monkey News" }
  ];

  /* ---------------------------------------------------------------- data loading */
  /* Each pool is split into shards of about 150 (data/karl/0.json, data/karl/1.json...), so a round
     only downloads what it needs. An item's id says which pool it's in (first letter) and which shard. */
  var MANIFEST = null;
  var SHARDS = {};
  var loading = {};
  var POOL_OF = { k: "karl", r: "ricky", s: "steve", m: "monkey", e: "educating", h: "show", b: "rock", w: "who" };
  var ID_RE = /^[krsmehbw][0-9a-f]{8}$/;
  function getJSON(url) {
    var v = MANIFEST && MANIFEST.version ? "?v=" + MANIFEST.version : "";
    return fetch(url + v).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }
  function loadManifest() {
    if (!loading.manifest) {
      loading.manifest = fetch("data/manifest.json", { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error("manifest"); return r.json(); })
        .then(function (m) { MANIFEST = m; return m; })
        .catch(function (e) { delete loading.manifest; throw e; });
    }
    return loading.manifest;
  }
  function shardCount(pool) { return MANIFEST && MANIFEST.shards ? (MANIFEST.shards[pool] || 0) : 0; }
  function poolOfId(id) { return ID_RE.test(id) ? POOL_OF[id.charAt(0)] : null; }
  function shardOfId(id, n) { return parseInt(id.substr(1, 4), 16) % n; }
  function loadShard(pool, k) {
    var key = pool + "/" + k;
    if (!loading[key]) {
      loading[key] = getJSON("data/" + key + ".json")
        .then(function (arr) { SHARDS[key] = Array.isArray(arr) ? arr : []; return SHARDS[key]; })
        .catch(function (e) { delete loading[key]; throw e; });
    }
    return loading[key];
  }
  function poolCount(name) {
    return MANIFEST && MANIFEST.counts ? (MANIFEST.counts[name] || 0) : 0;
  }
  function modeCount(m) {
    return m.pools.reduce(function (s, p) { return s + poolCount(p); }, 0);
  }

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

  /* questions you've already seen are skipped until you've been through the whole pool */
  var SEEN_MAX = 15000;
  var seenList = store.get("seen", []);
  if (!Array.isArray(seenList)) seenList = [];
  var seenSet = {};
  seenList.forEach(function (id) { seenSet[id] = 1; });
  function saveSeen() { store.set("seen", seenList); }
  function markSeen(id) {
    if (!id || seenSet[id]) return;
    seenSet[id] = 1; seenList.push(id);
    if (seenList.length > SEEN_MAX) seenList.splice(0, seenList.length - SEEN_MAX).forEach(function (o) { delete seenSet[o]; });
    saveSeen();
  }
  function forgetSeen(ids) {
    var drop = {};
    ids.forEach(function (i) { drop[i] = 1; delete seenSet[i]; });
    seenList = seenList.filter(function (i) { return !drop[i]; });
    saveSeen();
  }
  var cycleNotice = false;

  /* Each player works through a pool's shards in their own random order. When a shard has no unseen
     items left, they move to the next one. After the last shard, every shard is refreshed (its items
     count as unseen again) the next time they reach it. */
  var deck = store.get("deck", {});
  if (!deck || typeof deck !== "object" || Array.isArray(deck)) deck = {};
  function saveDeck() { store.set("deck", deck); }
  function deckFor(pool) {
    var n = shardCount(pool), d = deck[pool];
    if (!d || d.n !== n || !Array.isArray(d.order) || d.order.length !== n || !Array.isArray(d.refresh)) {
      var order = [];
      for (var i = 0; i < n; i++) order.push(i);
      d = deck[pool] = { n: n, order: shuffle(order, Math.random), at: 0, refresh: [] };
    }
    if (!(d.at >= 0 && d.at < n)) d.at = 0;
    return d;
  }
  function uniqueById(arr) {
    var have = {};
    return arr.filter(function (x) { if (have[x.id]) return false; have[x.id] = 1; return true; });
  }
  /* pick n unseen items from a pool (quick-fire tops up with seen ones rather than starting a new cycle) */
  function pickFresh(pool, n, rnd, noCycle) {
    var d = deckFor(pool), got = [], spare = [], steps = 0;
    if (!d.n) return Promise.resolve([]);
    function step() {
      var k = d.order[d.at];
      return loadShard(pool, k).then(function (items) {
        var r = d.refresh.indexOf(k);
        if (r !== -1) {
          d.refresh.splice(r, 1);
          forgetSeen(items.map(function (x) { return x.id; }));
          if (!noCycle) cycleNotice = true;
        }
        var have = {};
        got.forEach(function (x) { have[x.id] = 1; });
        got = got.concat(shuffle(items.filter(function (x) { return !seenSet[x.id] && !have[x.id]; }), rnd).slice(0, n - got.length));
        if (got.length >= n) { saveDeck(); return got; }
        spare = spare.concat(items.filter(function (x) { return seenSet[x.id]; }));
        d.at++;
        if (d.at >= d.n) { d.at = 0; d.refresh = d.order.slice(); }
        steps++;
        if (steps > d.n || (noCycle && steps >= 2)) {
          saveDeck();
          return uniqueById(got.concat(shuffle(spare, rnd))).slice(0, n);
        }
        return step();
      });
    }
    return step();
  }
  /* seeded rounds (the daily, old challenge links) have to come out the same for everyone */
  function pickSeeded(pool, n, rnd) {
    var c = shardCount(pool);
    if (!c) return Promise.resolve([]);
    return loadShard(pool, Math.floor(rnd() * c)).then(function (items) { return shuffle(items, rnd).slice(0, n); });
  }
  /* load the next shard of a pool in the background so the first round starts quickly */
  function warmPool(pool) {
    var d = deckFor(pool);
    if (d.n) loadShard(pool, d.order[d.at]).catch(function () {});
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
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
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
  function mcqItem(q, cat, rnd) {
    return { type: "mcq", id: q.id, cat: cat, d: q.d || 2, text: q.q, options: shuffle([q.a].concat(q.x), rnd), answer: q.a,
      fact: q.f, src: q.s, ex: q.ex };
  }
  function rockItem(r, rnd, typed) {
    return { type: typed ? "rock" : "rockmc", id: r.id, cat: "rock", d: 2, initials: r.i, clue: r.c, answer: r.a, pun: r.pun,
      options: shuffle([r.a].concat(r.x), rnd), src: r.s, ex: r.ex, alt: r.alt || [] };
  }
  function whoItem(w) {
    return { type: "who", id: w.id, cat: "who", d: 1, quote: w.t, answer: w.w, src: w.s, ex: w.ex, hl: w.hl };
  }
  function makeItem(poolName, raw, seed, typedRock) {
    var rnd = mulberry32(hashStr("opts:" + seed + ":" + raw.id));
    if (poolName === "rock") return rockItem(raw, rnd, typedRock);
    if (poolName === "who") return whoItem(raw);
    return mcqItem(raw, poolName, rnd);
  }

  /* weights for the mixed rounds: plenty of Karl, a bit of everything else */
  var MIX_WEIGHTS = [["karl", 32], ["ricky", 12], ["steve", 11], ["monkey", 9], ["educating", 6], ["show", 11], ["rock", 7], ["who", 12]];
  function weightedPool(rnd) {
    var avail = MIX_WEIGHTS.filter(function (w) { return poolCount(w[0]) && shardCount(w[0]); });
    var tot = avail.reduce(function (s, w) { return s + w[1]; }, 0), r = rnd() * tot;
    for (var i = 0; i < avail.length; i++) { r -= avail[i][1]; if (r <= 0) return avail[i][0]; }
    return avail[avail.length - 1][0];
  }

  /* fresh = avoid already-seen questions (normal rounds); seeded rounds must be identical for everyone */
  function buildItems(mode, seed, fresh) {
    var rnd = mulberry32(hashStr(mode.id + ":" + seed));
    function take(name, n) {
      var prnd = mulberry32(hashStr(mode.id + ":" + seed + ":" + name));
      return (fresh ? pickFresh(name, n, prnd, mode.kind === "quick") : pickSeeded(name, n, prnd)).then(function (raw) {
        return raw.map(function (x) { return makeItem(name, x, seed, mode.kind === "rock"); });
      });
    }
    if (mode.kind === "mcq" || mode.kind === "rock" || mode.kind === "who") {
      return take(mode.pools[0], mode.n).then(function (items) {
        if (mode.kind === "mcq") items.sort(function (a, b) { return a.d - b.d; });
        return items;
      });
    }
    var count = mode.kind === "quick" ? 120 : mode.n;
    var want = {};
    for (var i = 0; i < count; i++) { var p = weightedPool(rnd); want[p] = (want[p] || 0) + 1; }
    var names = Object.keys(want).sort();
    return Promise.all(names.map(function (p) { return take(p, want[p]); })).then(function (lists) {
      return shuffle([].concat.apply([], lists), rnd);
    });
  }

  /* rebuild a friend's exact round from the question ids in their challenge link */
  function itemsFromIds(mode, ids, seed) {
    var need = {};
    ids.forEach(function (id) {
      var p = poolOfId(id), n = p && mode.pools.indexOf(p) !== -1 ? shardCount(p) : 0;
      if (n) need[p + "/" + shardOfId(id, n)] = [p, shardOfId(id, n)];
    });
    var keys = Object.keys(need);
    return Promise.all(keys.map(function (k) { return loadShard(need[k][0], need[k][1]); })).then(function () {
      var byId = {};
      keys.forEach(function (k) { (SHARDS[k] || []).forEach(function (x) { byId[x.id] = [need[k][0], x]; }); });
      return ids.filter(function (id) { return byId[id]; }).map(function (id) {
        return makeItem(byId[id][0], byId[id][1], seed, mode.kind === "rock");
      });
    });
  }

  /* ---------------------------------------------------------------- game state */
  var G = null;
  var pendingStart = null;
  var timerRAF = null;
  var incomingChallenge = null;
  var startToken = 0;
  var startingMode = null; // a round whose questions are still loading

  /* ---------------------------------------------------------------- title screen + jingles */
  // a round with a jingle plays it on its title screen (drop the audio file at this path)
  var JINGLES = { monkey: "audio/monkey-news.wav" };
  var INTRO_FX = {
    mix: ["📼", "🎙️", "🍊", "🐒", "🎸"], daily: ["📅", "⭐", "🍊", "📼"], karl: ["🍊", "📔", "🥚", "🐝"],
    ricky: ["😂", "🥊", "🍺", "🎤"], steve: ["🎓", "📏", "🥽", "🎧"], monkey: ["🐒", "🍌", "🚀", "🐵"],
    educating: ["📚", "👽", "🧔", "✏️"], show: ["📻", "🎧", "🎙️", "📼"], rock: ["🎸", "🎤", "🎵", "🥁"],
    who: ["💬", "🗯️", "❓", "🍊"], quick: ["⚡", "⏱️", "🔥", "⚡"]
  };
  var jingle = null;
  function stopJingle() {
    if (jingle) { try { jingle.pause(); } catch (e) {} jingle = null; }
  }
  // called straight from the click, so browsers allow the sound
  function playJingle(modeId) {
    stopJingle();
    var src = JINGLES[modeId];
    if (!src || !soundOn || typeof Audio === "undefined") return;
    try {
      var a = new Audio(src);
      jingle = a;
      var p = a.play();
      if (p && p.catch) p.catch(function () { if (jingle === a) jingle = null; });
      a.addEventListener("error", function () { if (jingle === a) jingle = null; });
    } catch (e) { jingle = null; }
  }
  function hideIntro() { $("#intro").hidden = true; document.body.classList.remove("intro-on"); }
  /* show the round's title screen while the questions load; resolves when it's time to play */
  function runIntro(mode, itemsReady, token) {
    var el = $("#intro"), c = CATS[mode.cat || mode.kind] || {};
    var accent = mode.accent || c.accent || "#ff8a1f";
    var icon = c.img ? '<img src="' + c.img + '" alt="">' : esc(mode.emoji || c.emoji || "🎙️");
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.style.setProperty("--accent", accent);
    $(".intro-icon", el).innerHTML = icon;
    $(".intro-title", el).innerHTML = mode.title.split(" ").map(function (w, i) {
      return '<span style="animation-delay:' + (0.35 + i * 0.12).toFixed(2) + 's">' + esc(w) + "</span>";
    }).join(" ");
    $(".intro-blurb", el).textContent = mode.blurb;
    var fx = INTRO_FX[mode.id] || INTRO_FX.mix, parts = "";
    for (var i = 0; i < 14; i++) {
      parts += '<span style="left:' + ((i * 37) % 100) + "%;animation-duration:" + (5 + (i % 5)) + "s;animation-delay:" + (-(i * 0.7)).toFixed(1) +
        "s;font-size:" + (22 + (i % 4) * 8) + 'px">' + fx[i % fx.length] + "</span>";
    }
    $(".intro-fx", el).innerHTML = reduced ? "" : parts;
    var btn = $("#introGo");
    btn.disabled = true;
    btn.textContent = "Cueing up the tape…";
    // restart the CSS animations
    el.classList.remove("play"); void el.offsetWidth; el.classList.add("play");
    el.hidden = false;
    document.body.classList.add("intro-on");
    var t0 = performance.now(), ready = false, finished = false, poll, resolveFn;
    var done = new Promise(function (r) { resolveFn = r; });
    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(poll);
      if (token === startToken) hideIntro();
      resolveFn();
    }
    btn.onclick = function () { if (ready) finish(); };
    poll = setInterval(function () {
      if (token !== startToken) { finish(); return; }
      var t = performance.now() - t0;
      var playing = jingle && !jingle.paused && !jingle.ended;
      if (ready && t > (reduced ? 1200 : 2800) && (!playing || t > 12000)) finish();
    }, 100);
    itemsReady.then(function () {
      ready = true;
      btn.disabled = false;
      btn.textContent = "Let's go ▶";
    }, finish);
    return done;
  }

  function startGame(modeId, opts) {
    opts = opts || {};
    var mode = modeById(modeId);
    if (!mode) { location.hash = "#/"; return; }
    var token = ++startToken;
    G = null;
    startingMode = modeId;
    stopTimer();
    $("#playTitle").textContent = mode.title;
    $("#scoreNow").textContent = "0";
    $("#streak").hidden = true;
    $("#feedback").hidden = true;
    $("#lifelines").hidden = true;
    hideNextBar();
    $("#qCounter").textContent = "";
    $("#timerText").textContent = "";
    $("#progressBar").style.width = "0";
    $("#timerBar").style.transform = "scaleX(1)";
    $("#qCard").innerHTML = '<div class="loading"><div class="reel" aria-hidden="true"></div><p>Cueing up the tape...</p></div>';
    var seed = opts.seed || (mode.daily ? "daily-" + todayKey() : newSeed());
    cycleNotice = false;
    var itemsReady = loadManifest().then(function () {
      if (token !== startToken) return null;
      return (opts.ids ? itemsFromIds(mode, opts.ids, seed) : Promise.resolve([])).then(function (items) {
        return items.length ? items : buildItems(mode, seed, !mode.daily && !opts.seed);
      });
    });
    var introDone = runIntro(mode, itemsReady, token);
    Promise.all([itemsReady, introDone]).then(function (r) {
      var items = r[0];
      if (token !== startToken) return;
      startingMode = null;
      if (!items || !items.length) throw new Error("no questions");
      G = {
        mode: mode, seed: seed, items: items, i: 0, score: 0, correct: 0,
        streak: 0, bestStreak: 0, answers: [], lifelines: { fifty: 1, karl: 1 }, usedLifeline: false,
        challenge: opts.challenge || null, finished: false, quickEnds: 0, rockTyped: 0, askKarlFail: false
      };
      if (cycleNotice) toast("You've seen every question in this round, so they're shuffled back in. Fresh cycle!");
      if (mode.kind === "quick") {
        G.quickEnds = performance.now() + 60000;
        runQuickTimer();
      }
      renderItem();
    }).catch(function () {
      if (token !== startToken) return;
      startingMode = null;
      hideIntro();
      $("#qCard").innerHTML = '<div class="loading"><p>Couldn\'t load the questions. Check your connection and try again.</p>' +
        '<button class="btn btn-primary" type="button" id="retryLoad">Try again</button></div>';
      $("#retryLoad").addEventListener("click", function () { startGame(modeId, opts); });
    });
  }

  function resetLifelineButtons() {
    $("#llFifty").disabled = !G || !G.lifelines.fifty;
    $("#llKarl").disabled = !G || !G.lifelines.karl;
  }

  function currentItem() { return G && G.items[G.i]; }

  function timeFor(item) {
    if (G.mode.kind === "quick") return 0;
    return { mcq: 25, rockmc: 25, who: 15, rock: 45 }[item.type] || 20;
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
    var me = G;
    (function frame(now) {
      if (!G || G !== me || G.finished) return;
      var left = Math.max(0, (G.quickEnds - now) / 1000);
      bar.style.transform = "scaleX(" + (left / 60) + ")";
      bar.classList.toggle("low", left <= 10); txt.classList.toggle("low", left <= 10);
      txt.textContent = Math.ceil(left) + "s";
      if (left <= 0) { finishGame(); return; }
      requestAnimationFrame(frame);
    })(performance.now());
  }

  function diffLabel(d) { return ["", "●○○ Easy", "●●○ Medium", "●●● Hard"][d] || ""; }
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
    hideNextBar();
    var card = $("#qCard");
    var cat = CATS[item.cat] || CATS.show;
    card.style.setProperty("--accent", cat.accent);
    var head = '<div class="q-top">' + avatarHtml(item.cat) + '<div><div class="q-cat">' + esc(cat.label.toUpperCase()) +
      '</div><div class="q-diff">' + (item.type === "mcq" ? diffLabel(item.d) + " · " : "") + fmt(basePoints(item)) + " pts</div></div></div>";

    if (item.type === "mcq" || item.type === "rockmc") {
      var text = item.type === "mcq" ? esc(item.text)
        : "Rockbusters! Initials <b class=\"hl-initials\">" + esc(item.initials) + "</b>. Karl's clue: \"" + esc(item.clue) + "\"";
      card.innerHTML = head + '<div class="q-text">' + text + "</div>" + optionsHtml(item);
    } else if (item.type === "rock") {
      card.innerHTML = head +
        '<div class="rock-board"><div class="rock-initials" aria-label="Initials ' + esc(item.initials) + '">' + esc(item.initials) + "</div>" +
        '<div class="rock-clue">' + esc(item.clue) + "</div>" +
        '<div class="rock-by">Karl\'s cryptic clue: name the band or artist</div>' +
        '<form class="rock-form" id="rockForm" autocomplete="off"><input id="rockInput" aria-label="Your answer" placeholder="Type the band or artist..." maxlength="60" enterkeyhint="go" autocapitalize="words"><button class="btn btn-primary" type="submit">Guess</button></form>' +
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
      if (!isTouch()) setTimeout(function () { var i = $("#rockInput"); if (i) i.focus(); }, 50);
    } else if (item.type === "who") {
      card.innerHTML = head + '<div class="quote-bubble">' + esc(item.quote) + '</div><div class="who-options">' +
        ["ricky", "steve", "karl"].map(function (k, idx) {
          return '<button class="who-btn" type="button" data-who="' + k + '" aria-label="' + PEOPLE[k].name + '"><img src="' + PEOPLE[k].img + '" alt="">' +
            "<span>" + (idx + 1) + ". " + PEOPLE[k].short + "</span></button>";
        }).join("") + "</div>";
      $$(".who-btn", card).forEach(function (b) {
        b.addEventListener("click", function () { answer(b.getAttribute("data-who")); });
      });
    }
    if (item.type === "mcq" || item.type === "rockmc") bindOptions(item);
    var lifeOk = (item.type === "mcq" || item.type === "rockmc") && !isQuick;
    $("#lifelines").hidden = !lifeOk;
    resetLifelineButtons();
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
      if (!tn) return false;
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
    markSeen(item.id);
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

    var card = $("#qCard");
    if (item.type === "who") {
      $$(".who-btn", card).forEach(function (b) {
        var k = b.getAttribute("data-who");
        b.disabled = true;
        if (k === item.answer) b.classList.add("correct");
        else if (k === choice) b.classList.add("wrong");
      });
    } else if (item.type === "rock" && !$(".opt", card)) {
      var inp = $("#rockInput"); if (inp) { inp.disabled = true; inp.style.borderColor = ok ? "var(--green)" : "var(--red)"; inp.blur(); }
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
      var me = G;
      setTimeout(function () { if (G === me && !G.finished) { G.i++; renderItem(); } }, ok ? 380 : 900);
      return;
    }
    showFeedback(item, ok, pts, meta);
  }

  /* the transcript lines the answer came from */
  function speakerName(sp) {
    if (PEOPLE[sp]) return PEOPLE[sp].short;
    if (!sp || sp === "-") return "";
    return sp.charAt(0).toUpperCase() + sp.slice(1);
  }
  function transcriptHtml(item) {
    if (!item.ex || !item.ex.length) return "";
    var rows = item.ex.map(function (l, idx) {
      if (!l || l[0] === "…") return '<div class="tx-gap" aria-hidden="true">· · ·</div>';
      var sp = l[0], txt = l[1];
      if (sp === "-") return '<div class="tx-line tx-dir">' + esc(txt) + "</div>";
      var cls = "tx-line" + (PEOPLE[sp] ? " sp-" + sp : "") + (item.hl === idx ? " hl" : "");
      return '<div class="' + cls + '"><b class="tx-sp">' + esc(speakerName(sp)) + "</b><span>" + esc(txt) + "</span></div>";
    }).join("");
    return '<details class="tx" open><summary>📼 ' + esc(item.src || "From the show") + '</summary><div class="tx-body">' + rows + "</div></details>";
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
      if (item.fact) body += '<p class="fb-fact">' + esc(item.fact) + "</p>";
    }
    var last = G.i >= G.items.length - 1;
    var label = last ? "See your score ▶" : "Next ▶";
    fb.className = "feedback " + (ok ? "good" : "bad");
    fb.innerHTML = '<div class="fb-head"><span>' + (ok ? "✅" : meta.timeout ? "⏰" : "❌") + "</span><span>" + esc(title) + "</span>" +
      (ok ? '<span class="fb-points">+' + fmt(pts) + "</span>" : "") + "</div>" + body +
      (item.ex && item.ex.length ? transcriptHtml(item) : '<div class="fb-src">📼 ' + esc(item.src) + "</div>") +
      '<div class="fb-actions"><button class="btn btn-primary" id="nextBtn" type="button">' + label + "</button></div>";
    fb.hidden = false;
    $("#nextBtn").addEventListener("click", next);
    showNextBar(label);
    setTimeout(function () {
      if (!$("#nextBtn")) return;
      if (isCompact()) {
        var top = fb.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      } else {
        $("#nextBtn").focus({ preventScroll: true });
        fb.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 60);
  }

  /* on phones and tablets the Next button also sits in a bar fixed to the bottom of the screen */
  function isCompact() { return !!(window.matchMedia && window.matchMedia("(max-width: 820px)").matches); }
  function isTouch() { return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); }
  function showNextBar(label) {
    $("#nextBarBtn").textContent = label;
    $("#nextBar").hidden = false;
    document.body.classList.add("has-nextbar");
  }
  function hideNextBar() {
    $("#nextBar").hidden = true;
    document.body.classList.remove("has-nextbar");
  }

  function next() {
    if (!G || G.finished) return;
    var item = currentItem();
    if (!item || !item._done) return;
    sfx.click();
    G.i++;
    hideNextBar();
    if (G.i >= G.items.length) finishGame();
    else { renderItem(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  /* ---- lifelines */
  function useFifty() {
    var item = currentItem();
    if (!item || item._done || !G.lifelines.fifty || !(item.type === "mcq" || item.type === "rockmc")) return;
    if (!$(".opt", $("#qCard"))) return;
    G.lifelines.fifty = 0; G.usedLifeline = true; item.usedFifty = true;
    var wrong = item.options.filter(function (o) { return o !== item.answer && o !== item.karlPick; });
    var keep = item.karlPick && item.karlPick !== item.answer ? item.karlPick : pick(wrong);
    var removed = 0;
    shuffle(item.options.slice(), Math.random).forEach(function (o) {
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
    if (!$(".opt", $("#qCard"))) return;
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
    hideNextBar();
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
    var isTodaysDaily = mode.daily && (!G.challenge || G.seed === "daily-" + todayKey());
    if (isTodaysDaily && !hadDailyToday) P.dailies[todayKey()] = { p: G.score, k: G.correct, t: total };

    P.scores.push({ n: playerName(), m: mode.id, p: G.score, k: G.correct, t: total, d: Date.now() });
    P.scores.sort(function (a, b) { return b.p - a.p; });
    P.scores = P.scores.slice(0, 60);

    award("first", newBadges);
    if (total >= 8 && G.correct === total) award("perfect", newBadges);
    if (["karl", "ricky", "steve", "monkey", "educating", "show"].indexOf(mode.id) !== -1 && G.correct >= 8) award(mode.id, newBadges);
    if (mode.id === "rock" && G.rockTyped >= 5) award("rock", newBadges);
    if (mode.id === "who" && G.correct >= 10) award("who", newBadges);
    if (mode.id === "quick" && G.correct >= 12) award("quick", newBadges);
    if (G.bestStreak >= 10) award("streak10", newBadges);
    if (Object.keys(P.dailies).length >= 3) award("daily3", newBadges);
    if (!G.usedLifeline && pct >= 0.8 && mode.kind !== "quick" && total >= 8) award("nolife", newBadges);
    if (G.askKarlFail) award("askkarl", newBadges);
    if (total > 0 && G.correct === 0) award("shambles", newBadges);
    if (MODES.every(function (m) { return P.modes[m.id] || modeCount(m) < 30; })) award("all", newBadges);
    if (P.points >= 5000) award("moon", newBadges);
    if (seenList.length >= 500) award("tapes", newBadges);

    var duel = null;
    if (G.challenge) {
      award("challenger", newBadges);
      duel = { d: Date.now(), m: mode.id, them: { n: G.challenge.n, p: G.challenge.p, k: G.challenge.k, t: G.challenge.t },
        me: { n: playerName(), p: G.score, k: G.correct, t: total } };
      if (G.score > G.challenge.p) award("beat", newBadges);
      P.duels.unshift(duel); P.duels = P.duels.slice(0, 30);
    }
    saveProfile();
    G.result = { total: total, pct: pct, newBadges: newBadges, prevBest: prevBest, duel: duel, dailyRepeat: isTodaysDaily && hadDailyToday };
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

  /* the link carries the exact question ids, so the friend gets the same round */
  function challengeUrl() {
    var list = G.mode.kind === "quick" ? G.answers.map(function (a) { return a.item.id; }) : G.items.map(function (it) { return it.id; });
    var data = { m: G.mode.id, s: G.seed, q: list.filter(Boolean), n: playerName().slice(0, 20), p: G.score, k: G.correct, t: G.result.total };
    return location.origin + location.pathname + "?c=" + b64urlEncode(data);
  }
  function shareText() {
    return "I scored " + fmt(G.score) + " points (" + G.correct + "/" + G.result.total + ") in " + G.mode.title +
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
    $("#shCopy").addEventListener("click", function () { copyText(url); shared(); });
    ["#shWa", "#shX", "#shFb"].forEach(function (s) { $(s).addEventListener("click", shared); });
    $("#shCard").addEventListener("click", function () { makeScoreCard(); shared(); });
    $("#shLink").addEventListener("focus", function () { this.select(); });
    $("#againBtn").addEventListener("click", function () {
      var id = G.mode.daily ? "mix" : G.mode.id;
      pendingStart = { mode: id };
      playJingle(id);
      G = null;
      location.hash = "#/play/" + id; route();
    });
    updateNav();
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast("Link copied! Paste it to your mates."); }, fallback);
    } else fallback();
    function fallback() {
      var i = $("#shLink"); i.value = t; i.select();
      try { document.execCommand("copy"); toast("Link copied! Paste it to your mates."); } catch (e) { toast("Select the link and copy it."); }
    }
  }

  /* ---- downloadable score card (1080x1080 PNG) */
  function loadImg(src) {
    return new Promise(function (res) {
      var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src;
    });
  }
  function makeScoreCard() {
    var R = G;
    if (!R || !R.result) return;
    var url = challengeUrl(), text = shareText();
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
      ctx.fillText(playerName() + " · " + R.mode.title, S / 2, 300);
      ctx.fillStyle = "#ffd23f"; ctx.font = "200px Bungee, Impact, sans-serif";
      ctx.fillText(fmt(R.score), S / 2, 500);
      ctx.fillStyle = "#f6f2ea"; ctx.font = "900 50px Nunito, sans-serif";
      ctx.fillText(R.correct + " / " + R.result.total + " correct · " + rankFor(P.points).name, S / 2, 580);
      var r = 120, y = 790, xs = [S / 2 - 290, S / 2, S / 2 + 290], cols = ["#ff5d73", "#ff8a1f", "#4dabf7"];
      imgs.forEach(function (im, i) {
        ctx.save(); ctx.beginPath(); ctx.arc(xs[i], y, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        if (im) {
          var sc = Math.max((2 * r) / im.width, (2 * r) / im.height);
          ctx.drawImage(im, xs[i] - im.width * sc / 2, y - im.height * sc / 2, im.width * sc, im.height * sc);
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
          navigator.share({ files: [file], title: "Chimpanzee That!", text: text + " " + url }).catch(function () { download(blob); });
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
    $("#modes").innerHTML = MODES.filter(function (m) { return !MANIFEST || modeCount(m) >= 30; }).map(function (m) {
      var accent = m.accent || (CATS[m.cat || m.kind] || {}).accent || "#ff8a1f";
      var best = P.best[m.id];
      var tag = m.daily && !daily ? '<span class="tag">NEW TODAY</span>' : "";
      var sub = m.daily && daily ? "Done today: " + fmt(daily.p) + " pts (" + daily.k + "/" + daily.t + ")" : best ? "Best: " + fmt(best) + " pts" : "";
      var cnt = modeCount(m);
      var unit = m.kind === "who" ? " quotes" : m.kind === "rock" ? " clues" : " questions";
      var cntLine = cnt && !m.daily ? '<span class="count">' + fmt(cnt) + unit + "</span>" : "";
      return '<button class="mode' + (m.kind === "mix" ? " featured" : "") + '" type="button" data-start="' + m.id + '" style="--accent:' + accent + '">' + modeIconHtml(m) +
        '<div class="mode-body"><h3>' + esc(m.title) + tag + "</h3><p>" + esc(m.blurb) + "</p>" +
        '<div class="mode-meta">' + cntLine + (sub ? '<span class="best">' + esc(sub) + "</span>" : "") + "</div></div></button>";
    }).join("");
    var acc = P.answered ? Math.round((P.correct / P.answered) * 100) : 0;
    var total = ALL_POOLS.reduce(function (s, p) { return s + poolCount(p); }, 0);
    $("#statsStrip").innerHTML =
      '<div class="stat"><b>' + (total ? fmt(total) : "…") + "</b><span>questions, clues &amp; quotes</span></div>" +
      '<div class="stat"><b>' + fmt(seenList.length) + "</b><span>you've seen so far</span></div>" +
      '<div class="stat"><b>' + acc + "%</b><span>your accuracy</span></div>" +
      '<div class="stat"><b>' + Object.keys(P.badges).length + "/" + BADGES.length + "</b><span>badges unlocked</span></div>";
    $("#playerName").value = P.name || "";
    $("#rankChip").textContent = rankFor(P.points).name;
    renderKarlism();
    renderChallengeBanner();
    updateNav();
  }

  /* Karl's thought for the day: one quote per calendar day, the same for everyone */
  var FALLBACK_KARLISMS = [
    { t: "Well, you don't see, like, an old man having a Twix.", s: "XFM S2E19 · 28 Dec 2002" },
    { t: "Because... bricks don't fall in wars.", s: "XFM S1E21 · 20 Apr 2002" },
    { t: "I was a latecomer to pasta.", s: "The Ricky Gervais Guide to The English · 2009" }
  ];
  var KARLISMS = null;
  var karlismsFailed = false;
  function renderKarlism() {
    var list = KARLISMS && KARLISMS.length ? KARLISMS : null;
    if (!list && !karlismsFailed) { $("#karlism").textContent = "…"; $("#karlismSrc").textContent = ""; return; }
    if (!list) list = FALLBACK_KARLISMS;
    var k = list[hashStr("karlism:" + dayNumber()) % list.length];
    $("#karlismLabel").textContent = "Karl's thought of the day";
    $("#karlism").textContent = "“" + k.t + "”";
    $("#karlismSrc").textContent = "Karl Pilkington · " + k.s;
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
      incomingChallenge = null;
      pendingStart = { mode: c.m, seed: c.s, ids: c.q, challenge: c };
      playJingle(c.m);
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
      '<div class="stat"><b>' + fmt(seenList.length) + '</b><span>questions seen</span></div></div>' +
      '<div class="profile-actions"><button class="btn btn-small btn-ghost" id="resetSeenBtn" type="button">Let old questions come back</button>' +
      '<button class="btn btn-small btn-ghost" id="resetBtn" type="button">Reset my progress</button></div></div>';
    $("#resetSeenBtn").addEventListener("click", function () {
      seenList = []; seenSet = {}; saveSeen(); renderProfile(); toast("Question history cleared.");
    });
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
    // the CC BY photo licences ask for a credit, so keep this one short line
    $("#photoCredits").innerHTML = "Photos via Wikimedia Commons: " + CREDITS.map(function (c) {
      var lic = c.licenseUrl ? '<a href="' + esc(c.licenseUrl) + '" target="_blank" rel="noopener">' + esc(c.license) + "</a>" : esc(c.license);
      return '<a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.what) + "</a> by " + esc(c.by) + " (" + lic + ")";
    }).join(", ") + ".";
    var c = MANIFEST && MANIFEST.counts;
    if (c) {
      $("#aboutCounts").textContent = "Right now there are " + fmt(MCQ_POOLS.reduce(function (s, p) { return s + (c[p] || 0); }, 0)) + " questions, " +
        fmt(c.rock || 0) + " Rockbusters clues and " + fmt(c.who || 0) + " quotes, taken from " + fmt(MANIFEST.episodes || 0) + " episodes.";
    }
  }

  function updateNav() {
    $("#navPoints").textContent = fmt(P.points);
  }

  /* ---------------------------------------------------------------- routing */
  function showScreen(name) {
    $$(".screen").forEach(function (s) { s.hidden = s.getAttribute("data-screen") !== name; });
    document.body.setAttribute("data-screen", name);
  }
  function route() {
    var h = (location.hash || "#/").replace(/^#\/?/, "");
    var parts = h.split("/");
    var r = parts[0] || "";
    if (r !== "play") { stopTimer(); hideNextBar(); hideIntro(); stopJingle(); startToken++; startingMode = null; }
    // leaving a round half-way through abandons it (its points never counted)
    if (r !== "play" && r !== "results" && G && !G.finished) G.finished = true;
    if (r === "play") {
      var id = parts[1];
      var loadingThis = !G && startingMode === id;
      if (pendingStart || (!G && !loadingThis) || (G && (G.finished || G.mode.id !== id))) {
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
    if (r !== "play") window.scrollTo(0, 0);
    $("#main").focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- events */
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-start]") : null;
    if (!t) return;
    var id = t.getAttribute("data-start");
    pendingStart = { mode: id };
    sfx.click();
    playJingle(id);
    if (location.hash === "#/play/" + id) route(); else location.hash = "#/play/" + id;
  });

  document.addEventListener("keydown", function (e) {
    if ($("#screen-play").hidden || !G || G.finished) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    var item = currentItem();
    if (!item) return;
    if (item._done) {
      if ((e.key === "Enter" || e.key === " " || e.key === "ArrowRight") && G.mode.kind !== "quick") {
        if (tag === "BUTTON" || tag === "SUMMARY" || tag === "A") return; // let the focused control handle it
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
  $("#nextBarBtn").addEventListener("click", next);
  $("#quitBtn").addEventListener("click", function () {
    if (G && !G.finished && G.answers.length && !confirm("Quit this round? Your points for it won't count.")) return;
    if (G) G.finished = true;
    startToken++;
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
    var ids = Array.isArray(c.q) ? c.q.filter(function (x) { return typeof x === "string" && x.length < 24; }).slice(0, 150) : null;
    incomingChallenge = {
      m: c.m, s: c.s, q: ids && ids.length ? ids : null, n: String(c.n || "A mate").replace(/[<>]/g, "").slice(0, 20),
      p: Math.max(0, Math.min(1e6, +c.p || 0)), k: Math.max(0, Math.min(200, +c.k || 0)), t: Math.max(1, Math.min(200, +c.t || 1))
    };
    if (history.replaceState) history.replaceState(null, "", location.pathname + (location.hash || "#/"));
  })();

  updateSoundBtn();
  if (!location.hash || location.hash === "#") location.hash = "#/";
  route();
  loadManifest().then(function () {
    if (!$("#screen-home").hidden) renderHome();
    return getJSON("data/karlisms.json").then(function (list) {
      if (Array.isArray(list)) KARLISMS = list.filter(function (k) { return k && typeof k.t === "string"; });
      // warm the cache in the background so the first round starts quickly
      setTimeout(function () { ["karl", "who"].forEach(warmPool); }, 1500);
    });
  }).catch(function () {
    karlismsFailed = true;
  }).then(function () {
    if (!$("#screen-home").hidden) renderKarlism();
  });
})();
