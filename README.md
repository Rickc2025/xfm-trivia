# Chimpanzee That! 🍊🐒

**The Ricky, Steve & Karl trivia game.** A fan-made quiz about Ricky Gervais, Stephen Merchant and Karl Pilkington: XFM, the 2005 Radio 2 specials, the Guardian podcasts, the Podfathers, the Fame and NME specials and the Ricky Gervais Guides.

Every question, Rockbusters clue and quote was checked against the episode transcripts from the [official XFM Vault](https://www.therickygervaisshow.com/xfm-vault) and the community-built [Scrimpton.com](https://scrimpton.com) archive. Each answer shows the episode it came from.

## What's in it

Thousands of questions, Rockbusters clues and quotes, all generated from the episode transcripts and then fact-checked line by line. After every answer, the game shows the **transcript lines it came from**.

| Round | What it is |
| --- | --- |
| 🎙️ The Full Mix | 15 from everything |
| 📅 Daily Challenge | The same 10 questions for everyone, every day |
| 🍊 Karl / 😂 Ricky / 🎓 Steve | 10 questions about each of them (Karl's Diary, holidays, Auntie Nora, boxing, trowels...) |
| 🐒 Monkey News | Space chimps, monkey surgeons, the 1950s monkey jockey, Ham, Oliver... |
| 📚 Educating Ricky | Karl's XFM feature: "Alien gives man a beard", the hairy Chinese kid... |
| 📻 The Show | XFM 104.9, features, jingles, guests, the Guides, the Podfathers |
| 🎸 Rockbusters | Karl's real clues. Type the answer for full points, or ask for options |
| 💬 Who Said It? | Real lines: Ricky, Steve or Karl? |
| ⚡ Quick-fire 60 | As many as you can in 60 seconds |

The exact numbers are in `data/manifest.json` and on the About page.

### Game features

* **Rarely repeats**: the game remembers which questions you've seen (in your browser) and only brings them back once you've been through the whole round
* **Transcript excerpt** after every answer, with each speaker's name in their own colour
* **Karl's thought for the day**: one quote per day, the same for everyone, changing at midnight
* Points for difficulty and speed, plus a streak multiplier
* Lifelines: **50/50** and **Ask Karl** (he's right about 40% of the time)
* 9 ranks, from *Little Round Head* to *Karl Has Won!*, and 21 badges
* High scores and profile saved in the browser (no accounts, no server)
* **Challenge links**: send your score and a friend plays the exact same questions, then sees who won
* Share to WhatsApp, X or Facebook, or save a 1080×1080 **score card** image
* Designed for phones (portrait and landscape), tablets and desktops: on phones the Next button sits at the bottom of the screen

## Run it locally

It's plain HTML, CSS and JavaScript with no build step. It loads the questions with `fetch`, so open it through a local web server rather than double-clicking the file:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Put it on GitHub Pages

1. On GitHub, open the repository's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Pick the branch that holds the site (`main` once this is merged, or `claude/ricky-gervais-trivia-site-3096j1` to publish it straight away) and the **/ (root)** folder, then **Save**.
4. After a minute or two it's live. Your account's Pages domain is set to `sonexagamestudios.com`, so the game will be at **https://sonexagamestudios.com/xfm-trivia/** (`rickc2025.github.io/xfm-trivia/` redirects there).

The `.nojekyll` file tells Pages to serve the files exactly as they are.

## How the questions were made

1. All 145 transcripts on scrimpton.com (XFM, Radio 2, the Guardian podcasts, the Podfathers, the Guides, Fame and NME) were split into 230 chunks with numbered lines.
2. For each chunk, one AI agent read the whole thing and wrote questions, quotes and Rockbusters, citing the exact line numbers that prove each answer.
3. A second, independent agent re-read the chunk and fact-checked every item: keep, fix (a better wrong answer, a corrected line range) or drop (unsupported, ambiguous, boring, or relying on offensive stereotypes).
4. A build script pulled the cited lines straight from the transcript as the excerpt players see. It re-checked that every "Who said it?" quote is word-for-word from a line by that speaker, censored strong swearing and removed duplicates.

## Data format

The game loads plain JSON from `data/`. Each round's questions are split into shards of about 150 (`data/karl/0.json`, `data/karl/1.json`...), so a round only downloads what it needs. An item's id starts with a letter for its pool (`k` Karl, `r` Ricky, `s` Steve, `m` Monkey News, `e` Educating Ricky, `h` The Show, `b` Rockbusters, `w` Who Said It?), and the game works out the shard from the id.

* Questions: `id`, `q` question, `a` answer, `x` three wrong answers, `f` fun fact, `s` source episode, `d` difficulty 1–3, `ex` transcript excerpt as `[speaker, text]` pairs
* Rockbusters: `i` initials, `c` Karl's clue, `a` answer, `x` wrong options, `pun` how it works, `s`, `ex`
* Quotes: `t` the quote, `w` who said it (`karl`, `ricky` or `steve`), `s`, `ex`, `hl` (which excerpt line is the quote)
* `manifest.json`: counts and shard counts per pool, plus a cache-busting `version`
* `karlisms.json`: the Karl quotes used for the thought of the day

## Jingles

Each round opens with an animated title screen. A round can also play a jingle there: put the audio file in `audio/` (Monkey News looks for `audio/monkey-news.wav`) and list it in `JINGLES` near the top of the title-screen code in `js/app.js`. If the file isn't there, the round just starts without sound.

## Credits

* Photos from Wikimedia Commons: Ricky Gervais and Stephen Merchant by Raph_PH (CC BY 2.0 and CC BY 4.0), Karl Pilkington by Rick Walker (CC BY 2.0), Ham the Astrochimp by NASA (public domain). The About page has full links.
* Transcripts: therickygervaisshow.com XFM Vault and scrimpton.com contributors.

This is an unofficial fan project. It isn't affiliated with or endorsed by Ricky Gervais, Stephen Merchant, Karl Pilkington, XFM/Radio X, the BBC or Guardian Media Group. Quotes belong to their speakers and are used for fan commentary and trivia.
