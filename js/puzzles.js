/* ==========================================================================
   puzzles.js — the nine interactive puzzle types.
   Each type exposes:  mount(container, room, ctx) -> { check, hint, reveal }
     ctx.onSolved()        call when the puzzle is solved
     ctx.feedback(msg, ok) show an inline message
     ctx.toast(msg)        transient toast
   The engine wires the Check / Hint / Reveal buttons to the returned handle.
   ========================================================================== */

/* tiny DOM helper */
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in props) {
    const v = props[k];
    if (v == null) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k.startsWith("on") && typeof v === "function")
      e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    e.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  return e;
}
const norm = s => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/* seeded shuffle, keyboard-activation helper, and a Caesar encoder used for
   per-game puzzle randomisation + accessibility. */
function shuffleWith(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function kbd(el, label) {                  // make a div/span operable by keyboard
  el.tabIndex = 0;
  if (!el.getAttribute("role")) el.setAttribute("role", "button");
  if (label) el.setAttribute("aria-label", label);
  el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); } });
  return el;
}
function caesarEncode(s, k) {
  return s.replace(/[a-z]/gi, ch => { const b = ch <= "Z" ? 65 : 97; return String.fromCharCode((ch.charCodeAt(0) - b + k) % 26 + b); });
}
// re-encode a word as ASCII codes in a randomly chosen base (denary or hex)
function reencode(answer, rnd) {
  const hex = rnd() < 0.5;
  const raw = [...answer].map(ch => { const c = ch.charCodeAt(0); return hex ? c.toString(16).toUpperCase().padStart(2, "0") : String(c); }).join(" ");
  return { raw, hex, answer };
}
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
// build a letter group of `size` containing the answer letter once at a random
// position, the rest random distractors (different from the answer letter).
function buildGroup(ansCh, size, rnd) {
  const pos = Math.floor(rnd() * size);
  let out = "";
  for (let i = 0; i < size; i++) {
    if (i === pos) { out += ansCh; continue; }
    let c; do { c = LETTERS[Math.floor(rnd() * 26)]; } while (c === ansCh); out += c;
  }
  return out;
}

const Puzzles = {

  /* =====================================================================
     1. ANAGRAM  (Yellow – The Garage)
     Drag/click letter tiles into slots; flag the two spare wheels.
     ===================================================================== */
  anagram: {
    mount(container, room, ctx) {
      const rnd = ctx.rnd || Math.random, shuffle = !!ctx.shuffle;
      const rescramble = ans => { let a; do { a = shuffleWith(ans.split(""), rnd).join(""); } while (a === ans && ans.length > 1); return a; };
      const cards = room.wheels.map(w => {
        const scrambledStr = shuffle ? (w.answer ? rescramble(w.answer) : shuffleWith(w.scrambled.split(""), rnd).join("")) : w.scrambled;
        const letters = scrambledStr.split("");
        const card = h("div", { class: "wheel" });
        const slotsRow = h("div", { class: "slots" });
        const tray = h("div", { class: "tray" });
        const slotEls = [], tileEls = [];
        const state = { spare: false };

        const returnTile = t => {
          if (t._slot) { t._slot._tile = null; t._slot = null; }
          tray.appendChild(t); t.classList.remove("placed");
        };
        const placeTile = (t, slot) => {
          if (state.spare) return;
          if (slot._tile && slot._tile !== t) returnTile(slot._tile);
          if (t._slot) t._slot._tile = null;
          slot.appendChild(t); slot._tile = t; t._slot = slot; t.classList.add("placed");
        };

        for (let s = 0; s < letters.length; s++) {
          const slot = h("div", { class: "slot" });
          DnD.makeDropzone(slot, { onDrop: t => placeTile(t, slot) });
          slot.addEventListener("click", () => { if (slot._tile) returnTile(slot._tile); });
          kbd(slot, "letter slot " + (s + 1));
          slotEls.push(slot); slotsRow.appendChild(slot);
        }
        letters.forEach(ch => {
          const tile = h("div", { class: "tile" }, ch);
          tile._char = ch;
          DnD.makeDraggable(tile, {});
          tile.addEventListener("click", () => {
            if (tile._slot) return returnTile(tile);
            const empty = slotEls.find(s => !s._tile);
            if (empty) placeTile(tile, empty);
          });
          kbd(tile, "letter " + ch);
          tileEls.push(tile); tray.appendChild(tile);
        });

        const spareBtn = h("button", {
          class: "spare-btn", type: "button",
          onclick: () => {
            state.spare = !state.spare;
            card.classList.toggle("is-spare", state.spare);
            card.classList.remove("right", "wrong");
            spareBtn.textContent = state.spare ? "🛞 Marked SPARE (click to undo)" : "🛞 Mark as spare wheel";
            if (state.spare) tileEls.forEach(t => { if (t._slot) returnTile(t); });
          }
        }, "🛞 Mark as spare wheel");

        card.append(
          h("div", { class: "wheel-head" },
            h("span", { class: "wheel-num" }, w.label),
            h("span", { class: "wheel-scram" }, scrambledStr)),
          slotsRow, tray, spareBtn);

        Object.assign(card, { _w: w, _state: state, _slotEls: slotEls, _tileEls: tileEls,
                              _spareBtn: spareBtn, _placeTile: placeTile, _returnTile: returnTile });
        return card;
      });

      container.append(
        h("p", { class: "mini-hint" }, "💡 Tip: drag letters into the boxes, or click a letter to place it. Two wheels are spares — don't solve those, flag them!"),
        h("div", { class: "wheels" }, cards));

      const solveWheel = card => {
        const w = card._w;
        if (w.answer === "") { if (!card._state.spare) card._spareBtn.click(); return; }
        card._tileEls.forEach(t => card._returnTile(t));
        w.answer.split("").forEach((ch, i) => {
          const t = card._tileEls.find(x => x._char === ch && !x._slot);
          if (t) card._placeTile(t, card._slotEls[i]);
        });
      };

      return {
        check() {
          let ok = true;
          cards.forEach(card => {
            const w = card._w, st = card._state;
            card.classList.remove("right", "wrong");
            if (w.answer === "") {
              if (st.spare) card.classList.add("right"); else { ok = false; card.classList.add("wrong"); }
            } else if (st.spare) { ok = false; card.classList.add("wrong"); }
            else {
              const word = card._slotEls.map(s => s._tile ? s._tile._char : "").join("");
              if (word === w.answer) card.classList.add("right"); else { ok = false; card.classList.add("wrong"); }
            }
          });
          ctx.feedback(ok ? "✅ Every wheel correct — key unlocked!" : "❌ Not all wheels are right yet. Remember: 4 real words, 2 spares.", ok);
          return ok;
        },
        hint() {
          const bad = cards.find(c => c._w.answer && c._slotEls.map(s => s._tile ? s._tile._char : "").join("") !== c._w.answer && !c._state.spare);
          if (bad) { solveWheel(bad); ctx.toast("Solved one wheel for you 🔧"); }
          else ctx.toast("There are exactly TWO spare wheels — flag them with 🛞.");
        },
        reveal() { cards.forEach(solveWheel); ctx.feedback("Revealed all answers.", true); }
      };
    }
  },

  /* =====================================================================
     2. ELIMINATE  (Blue – Nowhere)
     Click letters to cross them out until one remains per group.
     ===================================================================== */
  eliminate: {
    mount(container, room, ctx) {
      const rnd = ctx.rnd || Math.random, shuffle = !!ctx.shuffle;
      const rowEls = room.rows.map((row, ri) => {
        const groupStrs = shuffle ? row.groups.map((g, gi) => buildGroup(row.answer[gi], g.length, rnd)) : row.groups;
        const groups = groupStrs.map(g => {
          const gEl = h("span", { class: "elim-group" });
          g.split("").forEach(ch => {
            const b = h("button", { class: "elim-letter", type: "button" }, ch);
            b._char = ch; b._out = false;
            b.addEventListener("click", () => { b._out = !b._out; b.classList.toggle("out", b._out); });
            gEl.appendChild(b);
          });
          return gEl;
        });
        const rEl = h("div", { class: "elim-row" },
          h("span", { class: "elim-num" }, String(ri + 1)),
          h("div", { class: "elim-groups" }, groups),
          h("span", { class: "elim-result" }, "= ?"));
        rEl._groups = groups; rEl._answer = row.answer;
        rEl._result = rEl.querySelector(".elim-result");
        return rEl;
      });
      container.append(
        h("p", { class: "mini-hint" }, "💡 Click a letter to cross it out. Leave exactly one letter in each group — together they spell a cyber-security word."),
        h("div", { class: "elim" }, rowEls));

      const wordOf = rEl => rEl._groups.map(g =>
        [...g.children].filter(b => !b._out).map(b => b._char).join("")).join("");

      return {
        check() {
          let ok = true;
          rowEls.forEach(rEl => {
            const w = wordOf(rEl);
            const good = w === rEl._answer;
            rEl._result.textContent = "= " + (w || "?");
            rEl._result.className = "elim-result " + (good ? "ok" : (w ? "bad" : ""));
            if (!good) ok = false;
          });
          ctx.feedback(ok ? "✅ All six words revealed!" : "❌ Each group must have exactly ONE letter left.", ok);
          return ok;
        },
        hint() {
          const rEl = rowEls.find(r => wordOf(r) !== r._answer);
          if (!rEl) return ctx.toast("All rows already correct!");
          rEl._groups.forEach((g, gi) => [...g.children].forEach(b => {
            b._out = b._char !== rEl._answer[gi]; b.classList.toggle("out", b._out);
          }));
          ctx.toast("Solved one row for you 🧩");
        },
        reveal() {
          rowEls.forEach(rEl => rEl._groups.forEach((g, gi) => [...g.children].forEach(b => {
            b._out = b._char !== rEl._answer[gi]; b.classList.toggle("out", b._out);
          })));
          this.check();
        }
      };
    }
  },

  /* =====================================================================
     3. CROSSWORD  (Orange – Corridor 1)
     ===================================================================== */
  crossword: {
    mount(container, room, ctx) {
      const cw = room.crossword, H = cw.height, W = cw.width;
      const sol = cw.solution, nums = cw.numbers;
      const inputs = {};                       // "r,c" -> input
      const gridEl = h("div", { class: "cw-grid", style: { gridTemplateColumns: `repeat(${W}, 1fr)` } });

      let dir = "A";
      const openAt = (r, c) => sol[r][c] !== "";

      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (!openAt(r, c)) { gridEl.appendChild(h("div", { class: "cw-blank" })); continue; }
        const cell = h("div", { class: "cw-cell" });
        if (nums[r][c]) cell.appendChild(h("span", { class: "cw-num" }, String(nums[r][c])));
        const inp = h("input", { class: "cw-in", maxlength: "1", inputmode: "text",
                                  "aria-label": `row ${r + 1} column ${c + 1}` });
        inp._r = r; inp._c = c;
        inp.addEventListener("focus", () => highlight(r, c));
        inp.addEventListener("input", () => {
          inp.value = (inp.value.toUpperCase().match(/[A-Z]/) || [""])[0];
          if (inp.value) move(r, c, 1);
          autoCheck();
        });
        inp.addEventListener("keydown", e => onKey(e, r, c));
        cell.appendChild(inp); inputs[r + "," + c] = inp; gridEl.appendChild(cell);
      }

      function move(r, c, d) {
        let nr = r, nc = c;
        for (let i = 0; i < Math.max(H, W); i++) {
          if (dir === "A") nc += d; else nr += d;
          if (nr < 0 || nc < 0 || nr >= H || nc >= W) return;
          if (openAt(nr, nc)) { inputs[nr + "," + nc].focus(); return; }
          else return;
        }
      }
      function onKey(e, r, c) {
        if (e.key === "Backspace" && !e.target.value) { move(r, c, -1); }
        else if (e.key === "ArrowRight") { dir = "A"; move(r, c, 1); e.preventDefault(); }
        else if (e.key === "ArrowLeft") { dir = "A"; move(r, c, -1); e.preventDefault(); }
        else if (e.key === "ArrowDown") { dir = "D"; move(r, c, 1); e.preventDefault(); }
        else if (e.key === "ArrowUp") { dir = "D"; move(r, c, -1); e.preventDefault(); }
      }
      function highlight(r, c) {
        Object.values(inputs).forEach(i => i.parentElement.classList.remove("active"));
        const entry = cw.entries.find(en => onWord(en, r, c, dir)) ||
                      cw.entries.find(en => onWord(en, r, c, dir === "A" ? "D" : "A"));
        if (!entry) return;
        if (entry.dir !== dir) dir = entry.dir;
        cellsOf(entry).forEach(([rr, cc]) => inputs[rr + "," + cc].parentElement.classList.add("active"));
      }
      function onWord(en, r, c, d) {
        if (en.dir !== d) return false;
        return cellsOf(en).some(([rr, cc]) => rr === r && cc === c);
      }
      function cellsOf(en) {
        const out = [];
        for (let i = 0; i < en.answer.length; i++)
          out.push(en.dir === "A" ? [en.row, en.col + i] : [en.row + i, en.col]);
        return out;
      }

      const clueList = dirn => h("div", { class: "cw-clues" },
        h("h4", {}, dirn === "A" ? "Across" : "Down"),
        h("ol", {},
          cw.entries.filter(e => e.dir === dirn).sort((a, b) => a.num - b.num).map(en =>
            h("li", { onclick: () => { dir = dirn; inputs[en.row + "," + en.col].focus(); } },
              h("b", {}, en.num + ". "), en.clue))));

      container.append(
        h("div", { class: "cw-wrap" }, gridEl,
          h("div", { class: "cw-cluebox" }, clueList("A"), clueList("D"))));

      function allCorrect() {
        return Object.values(inputs).every(i => i.value.toUpperCase() === sol[i._r][i._c]);
      }
      function paintWords() {
        cw.entries.forEach(en => {
          const cells = cellsOf(en);
          const done = cells.every(([r, c]) => inputs[r + "," + c].value.toUpperCase() === sol[r][c]);
          cells.forEach(([r, c]) => inputs[r + "," + c].classList.toggle("locked-in", done));
        });
      }
      let won = false;
      function autoCheck() { paintWords(); if (!won && allCorrect()) { won = true; ctx.onSolved(); } }

      return {
        check() {
          paintWords();
          const ok = allCorrect();
          Object.values(inputs).forEach(i =>
            i.classList.toggle("wrong", i.value !== "" && i.value.toUpperCase() !== sol[i._r][i._c]));
          ctx.feedback(ok ? "✅ Crossword complete!" : "❌ Some squares are wrong or empty.", ok);
          return ok;
        },
        hint() {
          const empties = Object.values(inputs).filter(i => !i.value);
          if (!empties.length) return ctx.toast("Grid is full — use Check.");
          const i = empties[Math.floor(Math.random() * empties.length)];
          i.value = sol[i._r][i._c]; paintWords(); autoCheck();
          ctx.toast("Filled one square 🧠");
        },
        reveal() { Object.values(inputs).forEach(i => i.value = sol[i._r][i._c]); paintWords(); this.check(); }
      };
    }
  },

  /* =====================================================================
     4. SPOT THE ERROR  (Teal – Corridor 2)
     ===================================================================== */
  spoterror: {
    mount(container, room, ctx) {
      const rnd = ctx.rnd || Math.random, shuffle = !!ctx.shuffle;
      const mons = shuffle ? shuffleWith(room.monitors, rnd) : room.monitors;
      const cards = mons.map((m, i) => {
        const card = h("div", { class: "monitor" },
          h("div", { class: "screen" }, h("pre", {}, m.code)),
          h("div", { class: "cross" }, "✗"),
          h("div", { class: "stand" }),
          h("div", { class: "why" }, ""));
        card._m = m; card._marked = false;
        card.setAttribute("aria-pressed", "false");
        card.addEventListener("click", () => {
          card._marked = !card._marked;
          card.classList.toggle("marked", card._marked);
          card.setAttribute("aria-pressed", String(card._marked));
          if (window.Sound) Sound.play("click");
        });
        kbd(card, "computer " + (i + 1) + " — mark as buggy");
        return card;
      });
      container.append(
        h("p", { class: "mini-hint" }, "💡 Click a monitor to put a ✗ on it if its code has a bug. Five are broken, one works perfectly."),
        h("div", { class: "monitors" }, cards));

      return {
        check() {
          const ok = cards.every(c => c._marked === c._m.hasError);
          if (ok) ctx.feedback("✅ You found exactly the buggy programs!", true);
          else {
            const right = cards.filter(c => c._marked === c._m.hasError).length;
            ctx.feedback(`❌ ${right} of ${cards.length} monitors judged correctly. Keep looking.`, false);
          }
          return ok;
        },
        hint() { ctx.toast("Look for: missing quotes, missing colons, wrong capital letters and odd operators."); },
        reveal() {
          cards.forEach(c => {
            c._marked = c._m.hasError; c.classList.toggle("marked", c._marked);
            c.classList.add("explained");
            c.querySelector(".why").textContent = c._m.hasError ? "🐞 " + c._m.why : "✅ " + c._m.why;
          });
          ctx.feedback("Revealed which programs have bugs.", true);
        }
      };
    }
  },

  /* =====================================================================
     5. MATCH  (Red – The Attic)
     Drag the key terms onto their definitions; 3 terms are spare.
     ===================================================================== */
  match: {
    mount(container, room, ctx) {
      const rnd = ctx.rnd || Math.random;
      const tray = h("div", { class: "term-tray" });
      let picked = null;                         // click-to-place support

      const makeChip = term => {
        const chip = h("div", { class: "term-chip" }, term);
        chip._term = term;
        DnD.makeDraggable(chip, {});
        chip.addEventListener("click", () => {
          if (picked === chip) { picked = null; chip.classList.remove("picked"); }
          else { if (picked) picked.classList.remove("picked"); picked = chip; chip.classList.add("picked"); }
        });
        kbd(chip, "term " + term + " — pick up, then choose a definition");
        return chip;
      };
      const shuffled = shuffleWith(room.terms, rnd);
      const chips = shuffled.map(makeChip);
      chips.forEach(c => tray.appendChild(c));

      const dropIntoTray = chip => { chip.classList.remove("placed", "picked"); tray.appendChild(chip); };
      DnD.makeDropzone(tray, { onDrop: chip => dropIntoTray(chip) });

      const defEls = room.definitions.map((d, i) => {
        const drop = h("div", { class: "def-drop" });
        const placeHere = chip => {
          if (drop._chip && drop._chip !== chip) dropIntoTray(drop._chip);
          if (chip.parentElement && chip.parentElement.classList.contains("def-drop"))
            chip.parentElement._chip = null;
          drop.appendChild(chip); drop._chip = chip; chip.classList.add("placed");
        };
        DnD.makeDropzone(drop, { onDrop: placeHere });
        drop.addEventListener("click", () => {
          if (picked) { placeHere(picked); picked.classList.remove("picked"); picked = null; }
          else if (drop._chip) dropIntoTray(drop._chip);
        });
        kbd(drop, "place the picked term on this definition");
        drop._placeHere = placeHere;
        const def = h("div", { class: "def-row" },
          h("div", { class: "def-text" }, d.text),
          drop);
        def._d = d; def._drop = drop;
        return def;
      });

      container.append(
        h("p", { class: "mini-hint" }, "💡 Drag a term onto its definition (or click a term then click a box). Three terms have no home — leave them in the tray."),
        h("div", { class: "match" },
          h("div", { class: "defs" }, defEls),
          h("div", { class: "tray-wrap" }, h("h4", {}, "Key terms"), tray)));

      return {
        check() {
          let ok = true;
          defEls.forEach(def => {
            const got = def._drop._chip ? def._drop._chip._term : null;
            const good = got === def._d.answer;
            def.classList.toggle("right", good);
            def.classList.toggle("wrong", !good);
            if (!good) ok = false;
          });
          const leftovers = [...tray.children].map(c => c._term).sort();
          const sparesOk = JSON.stringify(leftovers) === JSON.stringify([...room.spares].sort());
          if (!sparesOk) ok = false;
          ctx.feedback(ok ? "✅ Perfect matching — the 3 spares are right too!" : "❌ Not quite. Each box needs its matching term; 3 spares stay in the tray.", ok);
          return ok;
        },
        hint() {
          const def = defEls.find(d => !d._drop._chip || d._drop._chip._term !== d._d.answer);
          if (!def) return ctx.toast("All definitions matched!");
          const chip = chips.find(c => c._term === def._d.answer);
          def._drop._placeHere(chip);
          ctx.toast("Matched one for you 📂");
        },
        reveal() {
          room.definitions.forEach((d, i) => {
            const chip = chips.find(c => c._term === d.answer);
            defEls[i]._drop._placeHere(chip);
          });
          this.check();
        }
      };
    }
  },

  /* =====================================================================
     6. SUDOKU  (Purple – The Dungeon)
     ===================================================================== */
  sudoku: {
    mount(container, room, ctx) {
      const S = room.sudoku, P = S.puzzle, SOL = S.solution;
      const labelAt = {};                       // "r,c" -> "A".."F"
      for (const L in S.labels) labelAt[S.labels[L].join(",")] = L;

      const grid = h("div", { class: "sudoku" });
      const inputs = {};
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        const given = P[r][c] !== 0;
        const cell = h("div", { class: "su-cell" });
        if (c % 3 === 2 && c !== 8) cell.classList.add("br");
        if (r % 3 === 2 && r !== 8) cell.classList.add("bb");
        const lab = labelAt[r + "," + c];
        if (lab) cell.appendChild(h("span", { class: "su-label" }, lab));
        if (given) { cell.classList.add("given"); cell.appendChild(h("span", {}, String(P[r][c]))); }
        else {
          const inp = h("input", { class: "su-in", maxlength: "1", inputmode: "numeric",
                                    "aria-label": `row ${r + 1} column ${c + 1}` });
          inp._r = r; inp._c = c;
          inp.addEventListener("input", () => {
            inp.value = (inp.value.match(/[1-9]/) || [""])[0];
            inp.classList.remove("wrong");
            updateCode();
          });
          cell.appendChild(inp); inputs[r + "," + c] = inp;
        }
        grid.appendChild(cell);
      }

      const codeBoxes = S.order.map(L => h("span", { class: "code-box", "data-l": L }, "•"));
      const codeRow = h("div", { class: "code-readout" },
        h("span", {}, "Code "),
        ...S.order.map((L, i) => h("span", { class: "code-cell" },
          h("small", {}, L), codeBoxes[i])));

      container.append(
        h("p", { class: "mini-hint" }, "💡 Type 1–9 into the empty squares. When the six lettered cells A–F are correct, the escape code appears below."),
        h("div", { class: "sudoku-wrap" }, grid, codeRow));

      function valAt(r, c) {
        if (P[r][c]) return P[r][c];
        const i = inputs[r + "," + c];
        return i && i.value ? +i.value : 0;
      }
      function codeNow() { return S.order.map(L => { const [r, c] = S.labels[L]; return valAt(r, c); }); }
      let won = false;
      function updateCode() {
        const code = codeNow();
        S.order.forEach((L, i) => {
          const [r, c] = S.labels[L];
          const ok = valAt(r, c) === SOL[r][c];
          codeBoxes[i].textContent = ok ? String(SOL[r][c]) : (valAt(r, c) ? "?" : "•");
          codeBoxes[i].classList.toggle("ok", ok);
        });
        if (!won && S.order.every(L => { const [r, c] = S.labels[L]; return valAt(r, c) === SOL[r][c]; })) {
          won = true; ctx.onSolved();
        }
      }

      return {
        check() {
          let conflicts = false;
          Object.values(inputs).forEach(i => {
            if (i.value && +i.value !== SOL[i._r][i._c]) { i.classList.add("wrong"); conflicts = true; }
            else i.classList.remove("wrong");
          });
          const codeOk = S.order.every(L => { const [r, c] = S.labels[L]; return valAt(r, c) === SOL[r][c]; });
          updateCode();
          if (codeOk) ctx.feedback(`✅ Code found: ${codeNow().join("")}`, true);
          else ctx.feedback(conflicts ? "❌ Red squares are wrong. The six lettered cells aren't right yet." : "❌ Keep solving — the lettered cells A–F aren't all correct.", false);
          return codeOk;
        },
        hint() {
          const empties = Object.values(inputs).filter(i => !i.value || +i.value !== SOL[i._r][i._c]);
          if (!empties.length) return ctx.toast("Grid already solved!");
          // prefer a lettered cell
          const labelCells = empties.filter(i => labelAt[i._r + "," + i._c]);
          const i = (labelCells[0]) || empties[Math.floor(Math.random() * empties.length)];
          i.value = String(SOL[i._r][i._c]); i.classList.remove("wrong"); updateCode();
          ctx.toast("Filled one cell 🔢");
        },
        reveal() {
          Object.values(inputs).forEach(i => { i.value = String(SOL[i._r][i._c]); i.classList.remove("wrong"); });
          updateCode(); ctx.feedback(`Revealed. Code = ${codeNow().join("")}.`, true);
        }
      };
    }
  },

  /* =====================================================================
     7. DECODE  (Green – The Entrance)  ASCII / HEX -> text
     ===================================================================== */
  decode: {
    mount(container, room, ctx) {
      const rnd = ctx.rnd || Math.random, shuffle = !!ctx.shuffle;
      const codes = shuffle ? room.codes.map(co => reencode(co.answer, rnd)) : room.codes;
      const rows = codes.map((co, i) => {
        const chips = co.raw.trim().split(/\s+/).map(tok => {
          const dec = co.hex ? parseInt(tok, 16) : parseInt(tok, 10);
          const ch = dec === 32 ? "␣" : String.fromCharCode(dec);
          const chip = h("span", { class: "ascii-chip" + (co.hex ? " hex" : ""), title: "click to decode" },
            h("span", { class: "code-val" }, tok),
            h("span", { class: "code-ch" }, ""));
          chip.addEventListener("click", () => chip.querySelector(".code-ch").textContent = ch);
          kbd(chip, "code " + tok + ", reveal letter");
          return chip;
        });
        const input = h("input", { class: "decode-in", placeholder: "decoded answer…", autocomplete: "off" });
        const row = h("div", { class: "decode-row" },
          h("span", { class: "decode-num" }, String(i + 1)),
          h("div", { class: "ascii-line" }, chips),
          h("div", { class: "decode-answer" }, input, h("span", { class: "decode-msg" })));
        row._input = input; row._answer = co.answer;
        row._msg = row.querySelector(".decode-msg");
        return row;
      });

      const table = h("div", { class: "ascii-table hidden" },
        Array.from({ length: 26 }, (_, k) =>
          h("span", {}, h("b", {}, String.fromCharCode(65 + k)),
            ` ${65 + k}/0x${(65 + k).toString(16).toUpperCase()}`)));
      const toggle = h("button", { class: "btn ghost small", type: "button",
        onclick: () => table.classList.toggle("hidden") }, "📋 ASCII reference");

      container.append(
        h("p", { class: "mini-hint" }, "💡 Click any code to reveal its letter. Underlined codes are HEX. 32 = space. Type each decoded answer."),
        toggle, table,
        h("div", { class: "decode" }, rows));

      return {
        check() {
          let ok = true;
          rows.forEach(r => {
            const good = norm(r._input.value) === norm(r._answer);
            r._msg.textContent = good ? "✓" : (r._input.value ? "✗" : "");
            r._msg.className = "decode-msg " + (good ? "ok" : "bad");
            if (!good) ok = false;
          });
          ctx.feedback(ok ? "✅ All six codes cracked!" : "❌ Some answers are still wrong.", ok);
          return ok;
        },
        hint() {
          const r = rows.find(x => norm(x._input.value) !== norm(x._answer));
          if (!r) return ctx.toast("All decoded!");
          r._input.value = r._answer.slice(0, Math.ceil(r._answer.length / 2));
          ctx.toast("Gave you the first half of one answer 📟");
        },
        reveal() { rows.forEach(r => r._input.value = r._answer); this.check(); }
      };
    }
  },

  /* =====================================================================
     8. JIGSAW  (White – The Restroom)  match word halves
     ===================================================================== */
  jigsaw: {
    mount(container, room, ctx) {
      const rnd = ctx.rnd || Math.random;
      const tray = h("div", { class: "frag-tray" });
      let picked = null;
      const dropToTray = chip => { chip.classList.remove("placed", "picked"); tray.appendChild(chip); };
      DnD.makeDropzone(tray, { onDrop: chip => dropToTray(chip) });

      const rights = shuffleWith([...room.pairs.map(p => p.right), ...room.spares], rnd);
      const chips = rights.map(txt => {
        const chip = h("div", { class: "frag-chip" }, txt);
        chip._txt = txt;
        DnD.makeDraggable(chip, {});
        chip.addEventListener("click", () => {
          if (picked === chip) { picked = null; chip.classList.remove("picked"); }
          else { if (picked) picked.classList.remove("picked"); picked = chip; chip.classList.add("picked"); }
        });
        kbd(chip, "piece " + txt + " — pick up, then choose a word");
        tray.appendChild(chip);
        return chip;
      });

      const slots = room.pairs.map(p => {
        const drop = h("div", { class: "frag-slot" });
        const place = chip => {
          if (drop._chip && drop._chip !== chip) dropToTray(drop._chip);
          if (chip.parentElement && chip.parentElement.classList.contains("frag-slot"))
            chip.parentElement._chip = null;
          drop.appendChild(chip); drop._chip = chip; chip.classList.add("placed");
        };
        DnD.makeDropzone(drop, { onDrop: place });
        drop.addEventListener("click", () => {
          if (picked) { place(picked); picked.classList.remove("picked"); picked = null; }
          else if (drop._chip) dropToTray(drop._chip);
        });
        kbd(drop, "complete the word " + p.left);
        drop._place = place; drop._pair = p;
        return h("div", { class: "frag-word" },
          h("span", { class: "frag-left" }, p.left),
          h("span", { class: "frag-join" }, "+"), drop);
      });

      container.append(
        h("p", { class: "mini-hint" }, "💡 Drag each second half onto the first half it completes. Three pieces are spare — leave them for the teacher."),
        h("div", { class: "jigsaw" },
          h("div", { class: "frag-words" }, slots),
          h("div", { class: "tray-wrap" }, h("h4", {}, "Loose pieces"), tray)));

      return {
        check() {
          let ok = true;
          slots.forEach(s => {
            const drop = s.querySelector(".frag-slot");
            const got = drop._chip ? drop._chip._txt : null;
            const good = got === drop._pair.right;
            s.classList.toggle("right", good); s.classList.toggle("wrong", !good);
            if (!good) ok = false;
          });
          const left = [...tray.children].map(c => c._txt).sort();
          if (JSON.stringify(left) !== JSON.stringify([...room.spares].sort())) ok = false;
          ctx.feedback(ok ? "✅ Every word rebuilt — spares set aside!" : "❌ Not all words are right. Three pieces should stay loose.", ok);
          return ok;
        },
        hint() {
          const s = slots.find(x => { const d = x.querySelector(".frag-slot"); return !d._chip || d._chip._txt !== d._pair.right; });
          if (!s) return ctx.toast("All words complete!");
          const drop = s.querySelector(".frag-slot");
          drop._place(chips.find(c => c._txt === drop._pair.right));
          ctx.toast("Joined one word 🧷");
        },
        reveal() {
          slots.forEach(s => { const d = s.querySelector(".frag-slot"); d._place(chips.find(c => c._txt === d._pair.right)); });
          this.check();
        }
      };
    }
  },

  /* =====================================================================
     9. CIPHER  (Grey – The Garden)  Caesar shift dial
     ===================================================================== */
  cipher: {
    mount(container, room, ctx) {
      const rnd = ctx.rnd || Math.random, shuffle = !!ctx.shuffle;
      const k = shuffle ? (1 + Math.floor(rnd() * 25)) : room.cipher.shift;
      const C = shuffle ? { text: caesarEncode(GAME.escapeMessage, k), shift: k } : room.cipher;
      const target = C.shift;
      let shift = 0;

      const decode = s => s.replace(/[a-z]/gi, ch => {
        const base = ch <= "Z" ? 65 : 97;
        return String.fromCharCode((ch.charCodeAt(0) - base - shift + 26) % 26 + base);
      });

      const out = h("div", { class: "cipher-out" });
      const wheelTop = h("div", { class: "wheel-row" });
      const wheelBot = h("div", { class: "wheel-row" });
      const shiftLabel = h("span", { class: "shift-val" }, "0");
      const slider = h("input", { type: "range", min: "0", max: "25", value: "0", class: "shift-slider" });

      function renderWheels() {
        wheelTop.innerHTML = ""; wheelBot.innerHTML = "";
        for (let k = 0; k < 26; k++) {
          wheelTop.appendChild(h("span", {}, String.fromCharCode(65 + k)));
          wheelBot.appendChild(h("span", {}, String.fromCharCode(65 + (k + shift) % 26)));
        }
      }
      let won = false;
      function update() {
        shiftLabel.textContent = String(shift);
        out.textContent = decode(C.text);
        renderWheels();
        out.classList.toggle("solved", shift === target);
        if (!won && shift === target) { won = true; setTimeout(ctx.onSolved, 400); }
      }
      slider.addEventListener("input", () => { shift = +slider.value; update(); });

      const minus = h("button", { class: "btn ghost small", type: "button",
        onclick: () => { shift = (shift + 25) % 26; slider.value = shift; update(); } }, "◀ shift");
      const plus = h("button", { class: "btn ghost small", type: "button",
        onclick: () => { shift = (shift + 1) % 26; slider.value = shift; update(); } }, "shift ▶");

      container.append(
        h("p", { class: "mini-hint" }, "💡 Slide the dial to shift every letter. When the message reads clearly in English, you've cracked it."),
        h("div", { class: "cipher" },
          h("div", { class: "cipher-text" }, h("h4", {}, "Scrambled message"),
            h("div", { class: "cipher-in" }, C.text)),
          h("div", { class: "cipher-controls" },
            minus, h("div", { class: "shift-dial" }, h("span", {}, "Shift: "), shiftLabel), plus,
            slider),
          h("div", { class: "caesar-wheel" }, wheelTop, wheelBot),
          h("div", { class: "cipher-text" }, h("h4", {}, "Decoded message"), out)));
      update();

      return {
        check() {
          const ok = norm(decode(C.text)).includes(norm(GAME.escapeMessage).slice(0, 20));
          ctx.feedback(ok ? "✅ Message decoded — you can escape!" : "❌ Not readable yet. Try another shift.", ok);
          return ok;
        },
        hint() { ctx.toast("Look at the wheel: in the answer the letter K becomes A. How big is that jump?"); },
        reveal() { shift = target; slider.value = target; update(); ctx.feedback("Revealed the correct shift.", true); }
      };
    }
  }
};
