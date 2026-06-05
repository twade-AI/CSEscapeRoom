# 🗝️ Escape the Room — Computer Science

An **interactive, browser-based escape-room challenge** for the classroom.
Pupils work through nine themed rooms. Each room contains a hands-on puzzle
(drag-and-drop, click, type, decode…). Solving a room earns a **key 🔑** that
unlocks the next door — and cracking the final room reveals how to *escape*.

No installation, no accounts, no internet required. It's plain HTML/CSS/JS, so
you can **double-click `index.html`** to run it, drop it on a school network
share, or host it for free on **GitHub Pages**.

![The corridor of doors](docs/screenshots/corridor.png)

---

## ▶️ How pupils play

1. The **corridor** shows nine coloured doors. Only the glowing door is open.
2. Click the open door and solve the puzzle inside.
3. Solving it reveals a **key**. Use it to unlock the next door.
4. Keep going until you crack the **Grey Room** cipher and escape!

Progress is saved automatically in the browser (so a pupil can close the tab and
come back). Each device keeps its own progress.

## 🚪 The nine rooms

| # | Room | Puzzle | Skill |
|---|------|--------|-------|
| 1 | 🟡 Yellow — The Garage | **Anagrams** — unscramble wheels, flag 2 spares | Networking terms |
| 2 | 🔵 Blue — Nowhere | **Letter elimination** — cross out letters | Cyber-security vocab |
| 3 | 🟠 Orange — Corridor 1 | **Crossword** | CPU, registers & memory |
| 4 | 🟢 Teal — Corridor 2 | **Spot the error** — find buggy code | Python debugging |
| 5 | 🔴 Red — The Attic | **Match** terms to definitions (drag & drop) | Operating-system functions |
| 6 | 🟣 Purple — The Dungeon | **Sudoku** → 6-digit code | Logic & problem solving |
| 7 | 🟩 Green — The Entrance | **Code-breaker** — ASCII / Hex → text | Character encoding |
| 8 | ⬜ White — The Restroom | **Jigsaw** — rebuild split words (drag & drop) | CS terminology |
| 9 | ⬛ Grey — The Garden | **Shift (Caesar) cipher** | Cryptography |

Every room also has an optional **bonus riddle** for early finishers.

The puzzles are based on the *Escape the Room – Computer Science* printable pack,
rebuilt as fully interactive activities. Touch-friendly, so they work on tablets
and interactive whiteboards as well as laptops.

---

## 👩‍🏫 For the teacher

* **Answer key:** see [`TEACHER_GUIDE.md`](TEACHER_GUIDE.md) for every solution,
  key code and bonus answer.
* **Teacher mode:** on the corridor screen, click *🔒 Teacher mode*. A
  *👁 Reveal* button then appears in each room so you can demonstrate the answer.
* **Reset:** *↺ Reset all progress* clears the current device.
* **The final escape** decodes to a real-world team challenge you can set up in
  the room (a Rubik's-Cube task). Change it in `js/data.js` → `GAME.escapeMessage`
  and the Grey Room cipher if you'd like a different finish.

### Hosting it for your class (free)

**Option A — just share the files.** Put the whole folder on your shared drive /
VLE and tell pupils to open `index.html`.

**Option B — GitHub Pages (a shareable link).**
1. Merge this branch into `main`.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) publishes the site and
   gives you a link like `https://<you>.github.io/csescaperoom/`.

---

## ✏️ Customising the puzzles

All puzzle content lives in **`js/data.js`** — answers, clues, the sudoku grid,
the cipher, the room keys and the bonus riddles. It's heavily commented; you can
change wording or answers without touching any other file. The matching engine,
validation and styling all read from that one file.

## 🛠️ Project layout

```
index.html          the page (loads the four scripts below)
css/styles.css      all styling / the escape-room theme
js/data.js          puzzle content & answers  ← edit me
js/dragdrop.js      touch + mouse drag-and-drop helper
js/puzzles.js       the nine interactive puzzle types
js/engine.js        corridor, key/lock flow, progress saving
TEACHER_GUIDE.md    full answer key
_test/              developer smoke-tests (not needed to play)
```

## ✅ For developers

A headless smoke-test renders every room, auto-solves it and checks the result:

```bash
npm install        # installs jsdom (dev only)
npm test           # node _test/harness.js
```

`_test/shots.js` captures screenshots with Playwright if you want to regenerate
the images in `docs/`.
