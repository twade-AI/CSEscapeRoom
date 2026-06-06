/* ==========================================================================
   engine.js — the escape-room framework: story screens, the corridor of doors,
   the key/lock mechanic, a timer + HUD, hint economy, certificate, sound and
   progress saving. Puzzle rendering lives in puzzles.js (global `Puzzles`).
   ========================================================================== */
const Engine = (() => {
  const STORAGE_KEY = "cs-escape-progress-v1";
  const app = () => document.getElementById("app");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let solved = new Set();   // ids of solved rooms (only ones included in the game)
  let order = [];           // randomised route: a permutation of INCLUDED room indices
  let seed = 1;             // per-game seed for puzzle-content shuffling
  let startedAt = null, finishedAt = null;   // timer timestamps (ms)
  let hintsUsed = 0, introSeen = false, teacherMode = false;
  let timerLoop = null;

  /* ---------------------------------------------------------------- state */
  function shuffleIdx(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const includedIdx = () => Settings.includedRoomIds().map(id => ROOMS.findIndex(r => r.id === id));

  function load() {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (e) {}
    seed = (raw.seed >>> 0) || Rand.newSeed();
    startedAt = typeof raw.startedAt === "number" ? raw.startedAt : null;
    finishedAt = typeof raw.finishedAt === "number" ? raw.finishedAt : null;
    hintsUsed = raw.hintsUsed || 0;
    introSeen = !!raw.introSeen;
    const inc = Settings.includedRoomIds();
    solved = new Set((raw.solved || []).filter(id => inc.includes(id)));
    const incIdx = includedIdx();
    const same = Array.isArray(raw.order) && raw.order.length === incIdx.length &&
      raw.order.slice().sort((a, b) => a - b).join() === incIdx.slice().sort((a, b) => a - b).join();
    order = same ? raw.order : shuffleIdx(incIdx);
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      { solved: [...solved], order, seed, startedAt, finishedAt, hintsUsed, introSeen }));
  }
  function newGame(keepIntro = true) {
    solved = new Set(); seed = Rand.newSeed(); Rand.setSeed(seed);
    startedAt = null; finishedAt = null; hintsUsed = 0;
    if (!keepIntro) introSeen = false;
    order = shuffleIdx(includedIdx());
    save();
  }
  function reset() { newGame(); renderHud(); renderCorridor(); }

  // Route helpers operate over `order` (indices of included rooms).
  const pathPos     = (i) => order.indexOf(i);
  const predecessor = (i) => { const p = pathPos(i); return p > 0 ? order[p - 1] : -1; };
  const successor   = (i) => { const p = pathPos(i); return p >= 0 && p < order.length - 1 ? order[p + 1] : -1; };
  const isStart     = (i) => order[0] === i;
  const isSolved    = (i) => solved.has(ROOMS[i].id);
  const isUnlocked  = (i) => isStart(i) || (predecessor(i) >= 0 && isSolved(predecessor(i)));
  const earnedKeys  = () => order.filter(i => isSolved(i) && ROOMS[i].key).map(i => ({ key: ROOMS[i].key, from: ROOMS[i].name }));

  /* ----------------------------------------------------------------- timer */
  function timerInfo() {
    const s = Settings.get();
    const started = startedAt != null;
    const elapsed = started ? ((finishedAt || Date.now()) - startedAt) : 0;
    let show = elapsed, over = false;
    if (s.timerMode === "countdown") { const lim = (s.timerMinutes || 45) * 60000; show = Math.max(0, lim - elapsed); over = elapsed >= lim; }
    return { started, elapsed, show, over };
  }
  const fmt = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
  function startTimerIfNeeded() { if (startedAt == null) { startedAt = Date.now(); save(); } }
  function addPenalty(sec) { if (sec > 0 && startedAt != null && finishedAt == null) { startedAt -= sec * 1000; save(); renderHud(); } }

  function renderHud() {
    const hud = document.getElementById("hud"); if (!hud) return;
    const s = Settings.get(), t = timerInfo();
    const timer = (s.timerMode === "off" || !t.started) ? "" :
      `<span class="hud-timer ${t.over ? "over" : ""}" role="timer" aria-label="${s.timerMode === "countdown" ? "Time remaining" : "Time elapsed"}">⏱ ${fmt(t.show)}</span>`;
    hud.innerHTML = `${timer}
      <button class="hud-btn" id="hud-sound" aria-label="${s.sound ? "Mute sound" : "Unmute sound"}" aria-pressed="${s.sound}">${s.sound ? "🔊" : "🔇"}</button>
      <button class="hud-btn" id="hud-settings" aria-label="Open settings">⚙</button>`;
    document.getElementById("hud-sound").onclick = () => { Settings.set({ sound: !Settings.get().sound }); if (Settings.get().sound) { Sound.resume(); Sound.play("key"); } renderHud(); };
    document.getElementById("hud-settings").onclick = () => { Sound.resume(); Settings.openModal(); };
  }
  function startTimerLoop() {
    if (timerLoop) return;
    timerLoop = setInterval(() => {
      const t = timerInfo();
      if (t.started && finishedAt == null) {
        renderHud();
        if (Settings.get().timerMode === "countdown") { const r = Math.ceil(t.show / 1000); if (r > 0 && r <= 10) Sound.play("tick"); }
      }
    }, 1000);
  }

  /* ----------------------------------------------------------- story intro */
  function showIntro() {
    const total = order.length;
    app().innerHTML = `
      <div class="room-view intro">
        <div class="intro-card">
          <div class="intro-key">🗝️</div>
          <h1>${esc(GAME.title)}</h1>
          <p class="subtitle">${esc(GAME.subtitle)} • Escape Room</p>
          <p class="intro-story">${esc(GAME.story.intro)}</p>
          <p class="intro-meta">${total} rooms • randomised route${Settings.get().timerMode !== "off" ? " • timed" : ""}</p>
          <button class="btn big" id="begin">Enter the first room →</button>
        </div>
      </div>`;
    document.getElementById("begin").addEventListener("click", () => {
      introSeen = true; save(); Sound.resume(); Sound.play("key"); renderCorridor();
    });
  }

  /* --------------------------------------------------------- corridor view */
  function renderCorridor() {
    const display = ROOMS.map((_, i) => i).filter(i => order.includes(i));
    const total = order.length;
    const done = display.filter(isSolved).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    const doors = display.map(i => {
      const r = ROOMS[i], open = isUnlocked(i), got = isSolved(i);
      const cls = got ? "solved" : open ? "open" : "locked";
      const badge = got ? "✓" : open ? (isStart(i) ? "★" : "🔓") : "🔒";
      return `
        <button class="door ${cls}" data-index="${i}" style="--door:${r.colour}"
                aria-label="${esc(r.name)} – ${esc(r.place)} (${got ? "completed" : open ? "available" : "locked"})">
          <span class="door-icon" aria-hidden="true">${r.icon}</span>
          <span class="door-name">${esc(r.name)}</span>
          <span class="door-place">${esc(r.place)}</span>
          <span class="door-badge" aria-hidden="true">${badge}</span>
        </button>`;
    }).join("");

    const keys = earnedKeys();
    const keyring = keys.length
      ? keys.map(k => `<span class="keychip" title="Earned in ${esc(k.from)}">🔑 ${esc(k.key)}</span>`).join("")
      : `<span class="keychip empty">No keys yet — solve a room to earn one</span>`;

    app().innerHTML = `
      <header class="hero">
        <h1>${esc(GAME.title)}</h1>
        <p class="subtitle">${esc(GAME.subtitle)} • Escape Room Challenge</p>
        <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
        <p class="progress-label">${done} of ${total} rooms escaped</p>
      </header>

      <section class="keyring" aria-label="Your keys">
        <span class="keyring-label">Key-ring:</span> ${keyring}
      </section>

      <p class="corridor-hint">Your route is <strong>randomised</strong> — your start (★)
        and the order are different every game. Solve the glowing door to earn a key 🔑
        that reveals where to go next.</p>

      <section class="corridor">${doors}</section>

      ${done === total ? `<div class="all-clear">🏆 Every room escaped! Press <em>New game</em> for a fresh random route.</div>` : ""}

      <footer class="foot">
        <button class="link-btn" id="btn-story">ℹ Story</button>
        <button class="link-btn" id="btn-teacher">${teacherMode ? "🔓 Teacher mode: ON" : "🔒 Teacher mode"}</button>
        ${teacherMode ? `<button class="link-btn" id="btn-answers">🖨 Print answer key</button>` : ""}
        <button class="link-btn" id="btn-reset">↺ New game</button>
      </footer>`;

    app().querySelectorAll(".door").forEach(d => d.addEventListener("click", () => onDoorClick(+d.dataset.index)));
    document.getElementById("btn-reset").addEventListener("click", () => { if (confirm("Start a new game with a fresh route? This clears current progress on this device.")) reset(); });
    document.getElementById("btn-teacher").addEventListener("click", () => { teacherMode = !teacherMode; renderCorridor(); });
    document.getElementById("btn-story").addEventListener("click", showIntro);
    if (teacherMode) document.getElementById("btn-answers").addEventListener("click", printAnswerKey);
    renderHud();
    window.scrollTo({ top: 0 });
  }

  function onDoorClick(i) {
    Sound.resume();
    if (!isUnlocked(i)) {
      const door = app().querySelector(`.door[data-index="${i}"]`);
      door.classList.remove("shake"); void door.offsetWidth; door.classList.add("shake");
      Sound.play("error");
      const need = predecessor(i);
      toast(need >= 0 ? `🔒 Locked. Solve "${ROOMS[need].name}" first to earn its key.` : "🔒 Locked.");
      return;
    }
    Sound.play("click");
    if (isStart(i) || isSolved(i)) return enterRoom(i);
    showLock(i);
  }

  /* ------------------------------------------------------------ lock screen */
  function showLock(i) {
    const prev = ROOMS[predecessor(i)], room = ROOMS[i];
    app().innerHTML = `
      <div class="room-view" style="--accent:${room.colour}">
        <button class="back" id="back">← Back to corridor</button>
        <div class="lockscreen">
          <div class="padlock">🔐</div>
          <h2>${esc(room.name)} — ${esc(room.place)}</h2>
          <p>This door is locked. Enter the key you earned in <strong>${esc(prev.name)}</strong>.</p>
          <div class="lock-entry">
            <input id="keyin" type="text" autocomplete="off" spellcheck="false" placeholder="type the key…" aria-label="Key">
            <button class="btn" id="unlock">Unlock</button>
          </div>
          <button class="link-btn" id="usekey">🔑 Use my key (${esc(prev.key)})</button>
          <p class="lock-msg" id="lockmsg" role="status"></p>
        </div>
      </div>`;
    document.getElementById("back").addEventListener("click", renderCorridor);
    const input = document.getElementById("keyin");
    const tryUnlock = () => {
      const val = input.value.trim().toUpperCase().replace(/\s+/g, "");
      if (val === prev.key.toUpperCase().replace(/\s+/g, "")) { Sound.play("unlock"); unlockAnim(i); }
      else { Sound.play("error"); document.getElementById("lockmsg").textContent = "❌ That's not the right key — check your key-ring."; input.classList.remove("shake"); void input.offsetWidth; input.classList.add("shake"); }
    };
    document.getElementById("unlock").addEventListener("click", tryUnlock);
    input.addEventListener("keydown", e => { if (e.key === "Enter") tryUnlock(); });
    document.getElementById("usekey").addEventListener("click", () => { input.value = prev.key; tryUnlock(); });
    input.focus();
  }
  function unlockAnim(i) {
    const lock = app().querySelector(".lockscreen");
    if (lock) { lock.querySelector(".padlock").textContent = "🔓"; lock.classList.add("opened"); }
    setTimeout(() => enterRoom(i), 600);
  }

  /* ------------------------------------------------------------- room shell */
  function enterRoom(i) {
    startTimerIfNeeded();
    renderHud();                 // show the clock immediately on first entry
    const room = ROOMS[i];
    const policy = Settings.hintPolicy();
    const hintsLeft = policy.count === Infinity ? Infinity : Math.max(0, policy.count - hintsUsed);
    const hintLabel = policy.count === Infinity ? "💡 Hint" : `💡 Hint (${hintsLeft} left)`;

    const bonusHTML = room.bonus ? `
      <details class="bonus">
        <summary>🧠 Bonus riddle (optional)</summary>
        <p class="bonus-q">${esc(room.bonus.q)}</p>
        <div class="bonus-answer-wrap">
          <input id="bonusin" placeholder="your answer…" autocomplete="off" aria-label="Bonus riddle answer">
          <button class="btn small" id="bonuscheck">Check</button>
          <span id="bonusmsg" class="bonus-msg" role="status"></span>
        </div>
      </details>` : "";

    app().innerHTML = `
      <div class="room-view" style="--accent:${room.colour}">
        <button class="back" id="back">← Back to corridor</button>
        <header class="room-head">
          <span class="room-ic" aria-hidden="true">${room.icon}</span>
          <div><h2>${esc(room.name)}</h2>
            <p class="room-place">${esc(room.place)} • Step ${pathPos(i) + 1} of ${order.length}</p></div>
        </header>
        <p class="instructions">${esc(room.blurb)}</p>
        <div id="puzzle" class="puzzle"></div>
        ${bonusHTML}
        <div class="controls">
          <button class="btn ghost" id="hint">${hintLabel}</button>
          <button class="btn" id="check">✓ Check answer</button>
          ${teacherMode ? `<button class="btn ghost teacher" id="reveal">👁 Reveal</button>
                           <button class="btn ghost teacher" id="skip">⏭ Skip</button>` : ""}
        </div>
        <p id="feedback" class="feedback" role="status" aria-live="polite"></p>
      </div>`;

    document.getElementById("back").addEventListener("click", renderCorridor);

    const ctx = {
      onSolved: () => completeRoom(i),
      toast,
      feedback: (msg, ok) => { const f = document.getElementById("feedback"); f.textContent = msg; f.className = "feedback " + (ok ? "ok" : "bad"); },
      solved: isSolved(i),
      shuffle: !!Settings.get().shuffle,
      rnd: (window.Rand ? Rand.forKey(room.id) : Math.random)
    };
    const handle = Puzzles[room.type].mount(document.getElementById("puzzle"), room, ctx);

    document.getElementById("check").addEventListener("click", () => {
      if (handle.check()) { Sound.play("success"); completeRoom(i); } else { Sound.play("error"); }
    });
    document.getElementById("hint").addEventListener("click", () => {
      const pol = Settings.hintPolicy();
      if (pol.count !== Infinity && hintsUsed >= pol.count) { Sound.play("error"); toast("No hints left — you'll have to crack it!"); return; }
      if (handle.hint) handle.hint();
      hintsUsed++; save(); Sound.play("pick");
      if (pol.penalty) { addPenalty(pol.penalty); toast(`Hint used — +${pol.penalty}s on the clock`); }
      const left = pol.count === Infinity ? Infinity : Math.max(0, pol.count - hintsUsed);
      document.getElementById("hint").textContent = pol.count === Infinity ? "💡 Hint" : `💡 Hint (${left} left)`;
    });
    if (teacherMode) {
      const rv = document.getElementById("reveal"); if (rv && handle.reveal) rv.addEventListener("click", () => handle.reveal());
      const sk = document.getElementById("skip"); if (sk) sk.addEventListener("click", () => completeRoom(i));
    }
    if (room.bonus) wireBonus(room);
    window.scrollTo({ top: 0 });
  }

  function wireBonus(room) {
    const norm = s => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    document.getElementById("bonuscheck").addEventListener("click", () => {
      const v = norm(document.getElementById("bonusin").value);
      const ok = v === norm(room.bonus.a) || (room.bonus.a.toUpperCase().includes(v) && v.length >= 4);
      const msg = document.getElementById("bonusmsg");
      msg.textContent = ok ? "✅ Correct!" : "❌ Not quite — try again.";
      msg.className = "bonus-msg " + (ok ? "ok" : "bad");
      Sound.play(ok ? "success" : "error");
    });
  }

  /* ----------------------------------------------------------- completion */
  function completeRoom(i) {
    const room = ROOMS[i], firstTime = !isSolved(i);
    solved.add(room.id); save();
    if (solved.size === order.length) return showEscape();
    Sound.play("key"); celebrate();

    const nextIdx = successor(i), hasNext = nextIdx >= 0 && !isSolved(nextIdx);
    setTimeout(() => {
      app().innerHTML = `
        <div class="room-view" style="--accent:${room.colour}">
          <div class="key-earned">
            <div class="big-key">🔑</div>
            <h2>${firstTime ? "Room escaped!" : "Solved again!"}</h2>
            <p>You earned the key:</p>
            <div class="key-reveal">${esc(room.key)}</div>
            <p class="key-hint">${hasNext
              ? `Use it to unlock <strong>${esc(ROOMS[nextIdx].name)} — ${esc(ROOMS[nextIdx].place)}</strong>, the next stop on your route.`
              : "Head back to the corridor for your next door."}</p>
            <div class="key-actions">
              ${hasNext ? `<button class="btn" id="next">Go to the next door →</button>` : ""}
              <button class="btn ghost" id="corridor">Back to corridor</button>
            </div>
          </div>
        </div>`;
      if (hasNext) document.getElementById("next").addEventListener("click", () => showLock(nextIdx));
      document.getElementById("corridor").addEventListener("click", renderCorridor);
    }, 500);
  }

  function showEscape() {
    if (finishedAt == null) { finishedAt = Date.now(); save(); }
    renderHud();
    Sound.play("escape");
    const time = fmt(timerInfo().elapsed);
    setTimeout(() => {
      app().innerHTML = `
        <div class="room-view escape">
          <div class="key-earned">
            <div class="big-key">🏆</div>
            <h2>YOU ESCAPED!</h2>
            <p class="intro-story">${esc(GAME.story.outro)}</p>
            ${Settings.get().timerMode !== "off" ? `<p class="escape-time">⏱ Your time: <strong>${time}</strong></p>` : ""}
            <p>The final message decodes to your real-world challenge:</p>
            <blockquote class="escape-msg">${esc(GAME.escapeMessage)}</blockquote>
            <div class="key-actions">
              <button class="btn" id="cert">🏆 Print certificate</button>
              <button class="btn ghost" id="again">↺ Play again</button>
              <button class="btn ghost" id="corridor">Back to corridor</button>
            </div>
          </div>
        </div>`;
      document.getElementById("cert").addEventListener("click", printCertificate);
      document.getElementById("again").addEventListener("click", () => { if (confirm("Play again with a fresh random route?")) reset(); });
      document.getElementById("corridor").addEventListener("click", renderCorridor);
      celebrate(true);
    }, 500);
  }

  /* --------------------------------------------------------- printing */
  function printCertificate() {
    const s = Settings.get(), team = (s.teamName || "").trim() || "Your team";
    const time = fmt(timerInfo().elapsed), date = new Date().toLocaleDateString();
    document.getElementById("print-root").innerHTML = `
      <div class="certificate"><div class="cert-border">
        <div class="cert-key">🗝️</div>
        <h1>${esc(GAME.certificate.title)}</h1>
        <p class="cert-team">${esc(team)}</p>
        <p class="cert-line">${esc(GAME.certificate.line)}</p>
        <p class="cert-meta">${esc(GAME.subtitle)}${s.timerMode !== "off" ? " • Time: " + time : ""} • ${esc(date)}</p>
        <p class="cert-rooms">${order.length} rooms escaped 🏆</p>
      </div></div>`;
    document.body.classList.add("printing");
    window.print();
    setTimeout(() => document.body.classList.remove("printing"), 500);
  }
  function printAnswerKey() {
    const rows = ROOMS.map((r, i) => {
      let ans = "";
      if (r.type === "anagram") ans = r.wheels.filter(w => w.answer).map(w => w.answer).join(", ") + " (spares flagged)";
      else if (r.type === "eliminate") ans = r.rows.map(x => x.answer).join(", ");
      else if (r.type === "crossword") ans = r.crossword.entries.map(e => e.num + e.dir[0] + " " + e.answer).join(", ");
      else if (r.type === "spoterror") ans = "Bug in monitors " + r.monitors.map((m, n) => m.hasError ? n + 1 : null).filter(Boolean).join(",") + "; correct = " + r.monitors.map((m, n) => !m.hasError ? n + 1 : null).filter(Boolean).join(",");
      else if (r.type === "match") ans = r.definitions.map(d => d.answer).join(", ") + "; spares: " + r.spares.join(", ");
      else if (r.type === "sudoku") ans = "code " + r.sudoku.order.map(L => { const [a, b] = r.sudoku.labels[L]; return r.sudoku.solution[a][b]; }).join("");
      else if (r.type === "decode") ans = r.codes.map(c => c.answer).join(", ");
      else if (r.type === "jigsaw") ans = r.pairs.map(p => p.left + p.right).join(", ") + "; spares: " + r.spares.join(", ");
      else if (r.type === "cipher") ans = "shift " + r.cipher.shift + " → " + GAME.escapeMessage;
      return `<tr><td>${i + 1}</td><td>${esc(r.name)} — ${esc(r.place)}</td><td>${esc(ans)}</td><td>${esc(r.key || "")}</td>${r.bonus ? `<td>${esc(r.bonus.a)}</td>` : "<td></td>"}</tr>`;
    }).join("");
    document.getElementById("print-root").innerHTML = `
      <div class="answerkey">
        <h1>${esc(GAME.title)} — Teacher Answer Key</h1>
        <p>${esc(GAME.subtitle)}. With "Shuffle puzzle layouts" on, the wording/positions vary per device but the answers above hold. The room route is randomised per device.</p>
        <table><thead><tr><th>#</th><th>Room</th><th>Answer</th><th>Key</th><th>Bonus</th></tr></thead><tbody>${rows}</tbody></table>
        <p><strong>Final escape:</strong> ${esc(GAME.escapeMessage)}</p>
      </div>`;
    document.body.classList.add("printing");
    window.print();
    setTimeout(() => document.body.classList.remove("printing"), 500);
  }

  /* ------------------------------------------------------------- effects */
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove("show"), 2600);
  }
  function celebrate(big = false) {
    if (Settings.get().reducedMotion) return;
    const n = big ? 140 : 70;
    const colours = ["#f4c430", "#3aa0ff", "#ff8c2b", "#1fb6b6", "#ff5470", "#a065ff", "#36c46a"];
    for (let i = 0; i < n; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = colours[i % colours.length];
      c.style.animationDelay = (Math.random() * 0.4) + "s";
      c.style.animationDuration = (1.6 + Math.random() * 1.4) + "s";
      c.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3200);
    }
  }

  /* ---------------------------------------------------------------- init */
  function onSettingsChange(keys) {
    if (keys.includes("rooms")) { newGame(); }
    renderHud();
    if (app().querySelector(".hero") || keys.includes("rooms")) renderCorridor();
  }
  function init() {
    Settings.load(); Settings.apply(); Settings.setOnChange(onSettingsChange);
    load(); Rand.setSeed(seed); save();
    renderHud(); startTimerLoop();
    if (!introSeen && solved.size === 0) showIntro(); else renderCorridor();
  }

  return { init };
})();

// Init once the DOM is ready — or immediately if it already is.
if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", Engine.init);
else Engine.init();
