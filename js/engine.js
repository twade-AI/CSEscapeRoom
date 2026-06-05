/* ==========================================================================
   engine.js — the escape-room framework: corridor of doors, the key/lock
   mechanic, progress saving, room shell and celebration effects.
   Puzzle rendering itself lives in puzzles.js (global `Puzzles`).
   ========================================================================== */
const Engine = (() => {
  const STORAGE_KEY = "cs-escape-progress-v1";
  const app = () => document.getElementById("app");

  let solved = new Set();      // ids of solved rooms
  let teacherMode = false;

  /* ---------------------------------------------------------------- state */
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      solved = new Set(raw.solved || []);
    } catch (e) { solved = new Set(); }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ solved: [...solved] }));
  }
  function reset() {
    solved = new Set();
    save();
    renderCorridor();
  }

  const isSolved   = (i) => solved.has(ROOMS[i].id);
  const isUnlocked = (i) => i === 0 || isSolved(i - 1);
  const earnedKeys = () => ROOMS.filter((r, i) => isSolved(i) && r.key)
                                .map(r => ({ key: r.key, from: r.name }));

  /* --------------------------------------------------------- corridor view */
  function renderCorridor() {
    const total = ROOMS.length;
    const done = ROOMS.filter((r, i) => isSolved(i)).length;
    const pct = Math.round((done / total) * 100);

    const doors = ROOMS.map((r, i) => {
      const open = isUnlocked(i), got = isSolved(i);
      const cls = got ? "solved" : open ? "open" : "locked";
      const badge = got ? "✓" : open ? "" : "🔒";
      return `
        <button class="door ${cls}" data-index="${i}"
                style="--door:${r.colour}"
                aria-label="${r.name} – ${r.place} (${got ? "completed" : open ? "available" : "locked"})">
          <span class="door-num">${i + 1}</span>
          <span class="door-icon">${r.icon}</span>
          <span class="door-name">${r.name}</span>
          <span class="door-place">${r.place}</span>
          <span class="door-badge">${badge}</span>
        </button>`;
    }).join("");

    const keys = earnedKeys();
    const keyring = keys.length
      ? keys.map(k => `<span class="keychip" title="Earned in ${k.from}">🔑 ${k.key}</span>`).join("")
      : `<span class="keychip empty">No keys yet — solve a room to earn one</span>`;

    app().innerHTML = `
      <header class="hero">
        <h1>${GAME.title}</h1>
        <p class="subtitle">${GAME.subtitle} • Escape Room Challenge</p>
        <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
        <p class="progress-label">${done} of ${total} rooms escaped</p>
      </header>

      <section class="keyring" aria-label="Your keys">
        <span class="keyring-label">Key-ring:</span> ${keyring}
      </section>

      <p class="corridor-hint">Pick the glowing door. Solve the puzzle inside to
        earn a key 🔑 that unlocks the next door.</p>

      <section class="corridor">${doors}</section>

      ${done === total ? `<div class="all-clear">🏆 Every room escaped! Re-open the
        Grey Room to see the escape message again.</div>` : ""}

      <footer class="foot">
        <button class="link-btn" id="btn-teacher">${teacherMode ? "🔓 Teacher mode: ON" : "🔒 Teacher mode"}</button>
        <button class="link-btn" id="btn-reset">↺ Reset all progress</button>
      </footer>`;

    app().querySelectorAll(".door").forEach(d =>
      d.addEventListener("click", () => onDoorClick(+d.dataset.index)));
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (confirm("Reset progress for everyone on this device?")) reset();
    });
    document.getElementById("btn-teacher").addEventListener("click", () => {
      teacherMode = !teacherMode; renderCorridor();
    });
    window.scrollTo({ top: 0 });
  }

  function onDoorClick(i) {
    if (!isUnlocked(i)) {
      const door = app().querySelector(`.door[data-index="${i}"]`);
      door.classList.remove("shake"); void door.offsetWidth; door.classList.add("shake");
      toast(`🔒 Locked. Solve "${ROOMS[i - 1].name}" first to earn its key.`);
      return;
    }
    if (i === 0 || isSolved(i)) return enterRoom(i);
    showLock(i);            // unlocked-but-not-entered → key lock screen
  }

  /* ------------------------------------------------------------ lock screen */
  function showLock(i) {
    const prev = ROOMS[i - 1];
    const room = ROOMS[i];
    app().innerHTML = `
      <div class="room-view" style="--accent:${room.colour}">
        <button class="back" id="back">← Back to corridor</button>
        <div class="lockscreen">
          <div class="padlock">🔐</div>
          <h2>${room.name} — ${room.place}</h2>
          <p>This door is locked. Enter the key you earned in
             <strong>${prev.name}</strong>.</p>
          <div class="lock-entry">
            <input id="keyin" type="text" autocomplete="off" spellcheck="false"
                   placeholder="type the key…" aria-label="Key">
            <button class="btn" id="unlock">Unlock</button>
          </div>
          <button class="link-btn" id="usekey">🔑 Use my key (${prev.key})</button>
          <p class="lock-msg" id="lockmsg"></p>
        </div>
      </div>`;
    document.getElementById("back").addEventListener("click", renderCorridor);
    const input = document.getElementById("keyin");
    const tryUnlock = () => {
      const val = input.value.trim().toUpperCase().replace(/\s+/g, "");
      const want = prev.key.toUpperCase().replace(/\s+/g, "");
      if (val === want) { unlockAnim(i); }
      else {
        document.getElementById("lockmsg").textContent = "❌ That's not the right key — check your key-ring.";
        input.classList.remove("shake"); void input.offsetWidth; input.classList.add("shake");
      }
    };
    document.getElementById("unlock").addEventListener("click", tryUnlock);
    input.addEventListener("keydown", e => { if (e.key === "Enter") tryUnlock(); });
    document.getElementById("usekey").addEventListener("click", () => { input.value = prev.key; tryUnlock(); });
    input.focus();
  }

  function unlockAnim(i) {
    const lock = app().querySelector(".lockscreen");
    if (lock) {
      lock.querySelector(".padlock").textContent = "🔓";
      lock.classList.add("opened");
    }
    setTimeout(() => enterRoom(i), 650);
  }

  /* ------------------------------------------------------------- room shell */
  function enterRoom(i) {
    const room = ROOMS[i];
    const bonusHTML = room.bonus ? `
      <details class="bonus">
        <summary>🧠 Bonus riddle (optional)</summary>
        <p class="bonus-q">${room.bonus.q}</p>
        <div class="bonus-answer-wrap">
          <input id="bonusin" placeholder="your answer…" autocomplete="off">
          <button class="btn small" id="bonuscheck">Check</button>
          <span id="bonusmsg" class="bonus-msg"></span>
        </div>
      </details>` : "";

    app().innerHTML = `
      <div class="room-view" style="--accent:${room.colour}">
        <button class="back" id="back">← Back to corridor</button>
        <header class="room-head">
          <span class="room-ic">${room.icon}</span>
          <div>
            <h2>${room.name}</h2>
            <p class="room-place">${room.place} • Room ${i + 1} of ${ROOMS.length}</p>
          </div>
        </header>
        <p class="instructions">${room.blurb}</p>
        <div id="puzzle" class="puzzle"></div>
        ${bonusHTML}
        <div class="controls">
          <button class="btn ghost" id="hint">💡 Hint</button>
          <button class="btn" id="check">✓ Check answer</button>
          ${teacherMode ? `<button class="btn ghost teacher" id="reveal">👁 Reveal (teacher)</button>` : ""}
        </div>
        <p id="feedback" class="feedback" role="status"></p>
      </div>`;

    document.getElementById("back").addEventListener("click", renderCorridor);

    const ctx = {
      onSolved: () => completeRoom(i),
      toast,
      feedback: (msg, ok) => {
        const f = document.getElementById("feedback");
        f.textContent = msg;
        f.className = "feedback " + (ok ? "ok" : "bad");
      },
      solved: isSolved(i)
    };

    const handle = Puzzles[room.type].mount(document.getElementById("puzzle"), room, ctx);

    document.getElementById("check").addEventListener("click", () => {
      if (handle.check()) completeRoom(i);
    });
    document.getElementById("hint").addEventListener("click", () => handle.hint && handle.hint());
    if (teacherMode) {
      const rv = document.getElementById("reveal");
      if (rv) rv.addEventListener("click", () => handle.reveal && handle.reveal());
    }

    if (room.bonus) wireBonus(room);
    window.scrollTo({ top: 0 });
  }

  function wireBonus(room) {
    const norm = s => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    document.getElementById("bonuscheck").addEventListener("click", () => {
      const v = norm(document.getElementById("bonusin").value);
      const ok = v === norm(room.bonus.a) ||
                 (room.bonus.a.toUpperCase().includes(v) && v.length >= 4);
      const msg = document.getElementById("bonusmsg");
      msg.textContent = ok ? "✅ Correct!" : "❌ Not quite — try again.";
      msg.className = "bonus-msg " + (ok ? "ok" : "bad");
    });
  }

  /* ----------------------------------------------------------- completion */
  function completeRoom(i) {
    const room = ROOMS[i];
    const firstTime = !isSolved(i);
    solved.add(room.id);
    save();
    celebrate();

    const isLast = i === ROOMS.length - 1;
    if (isLast) return showEscape();

    // Show the key-earned screen
    setTimeout(() => {
      app().innerHTML = `
        <div class="room-view" style="--accent:${room.colour}">
          <div class="key-earned">
            <div class="big-key">🔑</div>
            <h2>${firstTime ? "Room escaped!" : "Solved again!"}</h2>
            <p>You earned the key:</p>
            <div class="key-reveal">${room.key}</div>
            <p class="key-hint">Use it to unlock <strong>${ROOMS[i + 1].name} — ${ROOMS[i + 1].place}</strong>.</p>
            <div class="key-actions">
              <button class="btn" id="next">Go to the next door →</button>
              <button class="btn ghost" id="corridor">Back to corridor</button>
            </div>
          </div>
        </div>`;
      document.getElementById("next").addEventListener("click", () => showLock(i + 1));
      document.getElementById("corridor").addEventListener("click", renderCorridor);
    }, 500);
  }

  function showEscape() {
    setTimeout(() => {
      app().innerHTML = `
        <div class="room-view escape">
          <div class="key-earned">
            <div class="big-key">🏆</div>
            <h2>YOU ESCAPED!</h2>
            <p>The final message decodes to your real-world challenge:</p>
            <blockquote class="escape-msg">${GAME.escapeMessage}</blockquote>
            <div class="key-actions">
              <button class="btn" id="corridor">Back to corridor</button>
            </div>
          </div>
        </div>`;
      document.getElementById("corridor").addEventListener("click", renderCorridor);
      celebrate(true);
    }, 500);
  }

  /* ------------------------------------------------------------- effects */
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function celebrate(big = false) {
    const n = big ? 140 : 70;
    const colours = ["#f4c430","#3aa0ff","#ff8c2b","#1fb6b6","#ff5470","#a065ff","#36c46a"];
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
  function init() { load(); renderCorridor(); }

  return { init };
})();

window.addEventListener("DOMContentLoaded", Engine.init);
