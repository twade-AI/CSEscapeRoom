/* ==========================================================================
   engine.js — the escape-room framework: story screens, the corridor of doors,
   the key/lock mechanic, a timer + HUD, hint economy, certificate, sound and
   progress saving. Puzzle rendering lives in puzzles.js (global `Puzzles`).
   ========================================================================== */
const Engine = (() => {
  const STORAGE_KEY = "cs-escape-progress-v1";
  const app = () => document.getElementById("app");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Teacher mode is gated by a password. We store only a hash of it (cyrb53) so
  // the password itself isn't sitting in the source. (Client-side, so it deters
  // casual pupil access rather than being unbreakable.)
  const TEACHER_HASH = 1693877825283578;
  function cyrb53(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  let solved = new Set();   // ids of solved rooms (only ones included in the game)
  let order = [];           // randomised route: a permutation of INCLUDED room indices
  let seed = 1;             // per-game seed for puzzle-content shuffling
  let startedAt = null, finishedAt = null;   // timer timestamps (ms)
  let hintsUsed = 0, wrong = 0, introSeen = false, teacherMode = false;
  let bonusSolved = new Set();   // room ids whose bonus riddle is solved
  let lost = false, tauntIdx = 0, scored = false;
  let timerLoop = null;
  const SCORES_KEY = "cs-escape-scores-v1";

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
    wrong = raw.wrong || 0;
    bonusSolved = new Set(raw.bonusSolved || []);
    introSeen = !!raw.introSeen;
    scored = !!raw.scored;
    const inc = Settings.includedRoomIds();
    solved = new Set((raw.solved || []).filter(id => inc.includes(id)));
    const incIdx = includedIdx();
    const same = Array.isArray(raw.order) && raw.order.length === incIdx.length &&
      raw.order.slice().sort((a, b) => a - b).join() === incIdx.slice().sort((a, b) => a - b).join();
    order = same ? raw.order : shuffleIdx(incIdx);
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      { solved: [...solved], order, seed, startedAt, finishedAt, hintsUsed, wrong,
        bonusSolved: [...bonusSolved], introSeen, scored }));
  }
  function newGame(keepIntro = true) {
    solved = new Set(); seed = Rand.newSeed(); Rand.setSeed(seed);
    startedAt = null; finishedAt = null; hintsUsed = 0; wrong = 0;
    bonusSolved = new Set(); lost = false; tauntIdx = 0; scored = false;
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
  // fragments recovered so far (for the journal + the final vault meta-puzzle)
  const collectedFragments = () => order.filter(isSolved)
    .map(i => ({ letter: ROOMS[i].fragment, slot: ROOMS[i].slot, room: ROOMS[i].name, colour: ROOMS[i].colour }));
  const allFragments = () => order.map(i => ({ letter: ROOMS[i].fragment, slot: ROOMS[i].slot, room: ROOMS[i].name, colour: ROOMS[i].colour }))
    .sort((a, b) => a.slot - b.slot);
  const statsNow = (vault) => ({ seconds: Math.floor(timerInfo().elapsed / 1000), hints: hintsUsed, wrong, bonus: bonusSolved.size, rooms: order.length, vault: !!vault });

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
    const journal = (t.started || solved.size) ? `<button class="hud-btn" id="hud-journal" aria-label="Open datapad (clue journal)">📓</button>` : "";
    hud.innerHTML = `${timer}${journal}
      <button class="hud-btn" id="hud-sound" aria-label="${s.sound ? "Mute sound" : "Unmute sound"}" aria-pressed="${s.sound}">${s.sound ? "🔊" : "🔇"}</button>
      <button class="hud-btn" id="hud-settings" aria-label="Open settings">⚙</button>`;
    document.getElementById("hud-sound").onclick = () => { Settings.set({ sound: !Settings.get().sound }); if (Settings.get().sound) { Sound.resume(); Sound.play("key"); } renderHud(); };
    document.getElementById("hud-settings").onclick = () => { Sound.resume(); Settings.openModal(); };
    const jb = document.getElementById("hud-journal"); if (jb) jb.onclick = () => { Sound.resume(); openJournal(); };
  }
  function startTimerLoop() {
    if (timerLoop) return;
    timerLoop = setInterval(() => {
      const t = timerInfo(), countdown = Settings.get().timerMode === "countdown";
      if (countdown && t.started && finishedAt == null && !lost && t.over) { document.body.classList.remove("timer-low"); return showLose(); }
      const low = countdown && t.started && finishedAt == null && t.show > 0 && t.show <= 10000;
      document.body.classList.toggle("timer-low", low);
      if (t.started && finishedAt == null) {
        renderHud();
        if (low) Sound.play("tick");
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
          <p class="intro-story" id="story-type"></p>
          <p class="intro-meta">${total} rooms • randomised route${Settings.get().timerMode !== "off" ? " • timed" : ""}</p>
          <button class="btn big" id="begin">Enter the first room →</button>
        </div>
      </div>`;
    const story = document.getElementById("story-type");
    if (window.FX) { FX.setAccent("#36c46a"); FX.typeWriter(story, GAME.story.intro); }
    else story.textContent = GAME.story.intro;
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
          <span class="door-handle" aria-hidden="true"></span>
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
      <div class="corridor-floor" aria-hidden="true"></div>

      ${done === total ? `<div class="all-clear">🏆 Every room escaped! Press <em>New game</em> for a fresh random route.</div>` : ""}

      <footer class="foot">
        <button class="link-btn" id="btn-story">ℹ Story</button>
        <button class="link-btn" id="btn-teacher">${teacherMode ? "🔓 Teacher mode: ON" : "🔒 Teacher mode"}</button>
        ${teacherMode ? `<button class="link-btn" id="btn-answers">🖨 Print answer key</button>` : ""}
        <button class="link-btn" id="btn-reset">↺ New game</button>
      </footer>`;

    app().querySelectorAll(".door").forEach(d => d.addEventListener("click", () => onDoorClick(+d.dataset.index)));
    document.getElementById("btn-reset").addEventListener("click", () => { if (confirm("Start a new game with a fresh route? This clears current progress on this device.")) reset(); });
    document.getElementById("btn-teacher").addEventListener("click", () => {
      if (teacherMode) { teacherMode = false; renderCorridor(); return; }
      const pw = window.prompt("Enter the teacher password:");
      if (pw == null) return;
      if (cyrb53(pw) === TEACHER_HASH) { teacherMode = true; Sound.play("unlock"); toast("🔓 Teacher mode unlocked."); renderCorridor(); }
      else { Sound.play("error"); toast("❌ Incorrect teacher password."); }
    });
    document.getElementById("btn-story").addEventListener("click", showIntro);
    if (teacherMode) document.getElementById("btn-answers").addEventListener("click", printAnswerKey);
    renderHud();
    if (window.FX) FX.setAccent("#6ad0ff");
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
    if (window.FX) FX.flash(ROOMS[i].colour);
    setTimeout(() => enterRoom(i), 600);
  }

  /* ------------------------------------------------------------- room shell */
  function enterRoom(i) {
    startTimerIfNeeded();
    renderHud();                 // show the clock immediately on first entry
    const room = ROOMS[i];
    if (window.FX) { FX.setAccent(room.colour); FX.flash(room.colour); }
    if (window.Sound) Sound.setAmbientChord(room.ambient);
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
      <div class="room-view ${room.theme || ""}" style="--accent:${room.colour}">
        <div class="scene-fx" aria-hidden="true"></div>
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
      if (handle.check()) { Sound.play("success"); completeRoom(i); }
      else { Sound.play("error"); wrong++; save(); }
    });
    document.getElementById("hint").addEventListener("click", () => {
      const pol = Settings.hintPolicy();
      if (pol.count !== Infinity && hintsUsed >= pol.count) { Sound.play("error"); toast("No hints left — you'll have to crack it!"); return; }
      if (handle.hint) handle.hint();
      hintsUsed++; save(); Sound.play("pick");
      if (pol.penalty) addPenalty(pol.penalty);
      let msg = pol.penalty ? `Hint used — +${pol.penalty}s on the clock` : "Hint used";
      if (hintsUsed === 1) msg += "  ·  🛰 " + GAME.villain.name + ": " + GAME.villain.onHint;
      toast(msg);
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
      if (ok) { bonusSolved.add(room.id); save(); }
      Sound.play(ok ? "success" : "error");
    });
  }

  /* ----------------------------------------------------------- completion */
  function completeRoom(i) {
    const room = ROOMS[i], firstTime = !isSolved(i);
    solved.add(room.id); save();
    Sound.play("key"); celebrate();
    if (window.FX) FX.burst(window.innerWidth / 2, window.innerHeight * 0.34, room.colour, 30);
    if (solved.size === order.length) return setTimeout(showVault, 650);

    const nextIdx = successor(i), hasNext = nextIdx >= 0 && !isSolved(nextIdx);
    const taunt = Story.taunt(tauntIdx++);
    setTimeout(() => {
      app().innerHTML = `
        <div class="room-view" style="--accent:${room.colour}">
          <div class="key-earned">
            <div class="big-key">🔑</div>
            <h2>${firstTime ? "Room escaped!" : "Solved again!"}</h2>
            <p>You earned the key:</p>
            <div class="key-reveal">${esc(room.key)}</div>
            <div class="fragment-card">🧩 Fragment recovered — slot <b>#${room.slot}</b>:
              <span class="frag-letter">${esc(room.fragment)}</span></div>
            <div class="transmission small">${Story.avatar()}
              <p class="tx-line"><b>${esc(Story.name())}</b> <span id="tx-type"></span></p></div>
            <p class="key-hint">${hasNext
              ? `Use the key to unlock <strong>${esc(ROOMS[nextIdx].name)} — ${esc(ROOMS[nextIdx].place)}</strong>.`
              : "Head back to the corridor for your next door."}</p>
            <div class="key-actions">
              ${hasNext ? `<button class="btn" id="next">Go to the next door →</button>` : ""}
              <button class="btn ghost" id="corridor">Back to corridor</button>
            </div>
          </div>
        </div>`;
      const tl = document.getElementById("tx-type");
      if (window.FX) FX.typeWriter(tl, taunt); else tl.textContent = taunt;
      if (hasNext) document.getElementById("next").addEventListener("click", () => showLock(nextIdx));
      document.getElementById("corridor").addEventListener("click", renderCorridor);
    }, 500);
  }

  /* ----------------------------------------- meta-puzzle: the vault */
  function kbdLike(el) { if (typeof kbd === "function") kbd(el); else el.tabIndex = 0; }

  function showVault() {
    if (window.FX) { FX.setAccent("#ff5470"); FX.flash("#ff5470"); }
    const frags = allFragments();                       // targets, sorted by slot
    app().innerHTML = `
      <div class="room-view vault" style="--accent:#ff5470">
        <div class="scene-fx" aria-hidden="true"></div>
        <div class="transmission">${Story.avatar()}
          <p class="tx-line"><b>${esc(Story.name())}</b> <span id="vault-tx"></span></p></div>
        <header class="room-head"><span class="room-ic" aria-hidden="true">🧷</span>
          <div><h2>Compile the Master Override</h2>
            <p class="room-place">Final lock • ${frags.length} fragments</p></div></header>
        <p class="instructions">${esc(GAME.meta.prompt)}</p>
        <div id="vault-slots" class="vault-slots"></div>
        <div id="vault-tray" class="vault-tray"></div>
        <div id="vault-word" class="vault-word"></div>
        <div class="controls">
          <button class="btn" id="vault-check">⚙ Compile</button>
          ${teacherMode ? '<button class="btn ghost teacher" id="vault-skip">⏭ Compile (teacher)</button>' : ""}
          <button class="btn ghost" id="vault-back">← Corridor</button>
        </div>
        <p id="vault-msg" class="feedback" role="status" aria-live="polite"></p>
      </div>`;
    const tx = document.getElementById("vault-tx");
    if (window.FX) FX.typeWriter(tx, GAME.villain.vault); else tx.textContent = GAME.villain.vault;

    const slotsEl = document.getElementById("vault-slots");
    const trayEl = document.getElementById("vault-tray");
    const slotByNum = {}, tiles = [];
    const returnTile = t => { if (t._slot) { t._slot._tile = null; t._slot = null; } trayEl.appendChild(t); t.classList.remove("placed"); };
    const placeTile = (t, slot) => {
      if (slot._tile && slot._tile !== t) returnTile(slot._tile);
      if (t._slot) t._slot._tile = null;
      slot.appendChild(t); slot._tile = t; t._slot = slot; t.classList.add("placed");
      Sound.play("place"); check(false);
    };
    frags.forEach(f => {
      const slot = h("div", { class: "vslot" }, h("span", { class: "vslot-num" }, "#" + f.slot));
      slot._num = f.slot;
      DnD.makeDropzone(slot, { onDrop: t => placeTile(t, slot) });
      slot.addEventListener("click", () => { if (slot._tile) returnTile(slot._tile); });
      kbdLike(slot); slotByNum[f.slot] = slot; slotsEl.appendChild(slot);
    });
    const rnd = window.Rand ? Rand.forKey("vault") : Math.random;
    frags.slice().sort(() => rnd() - 0.5).forEach(f => {
      const tile = h("div", { class: "vtile", style: { "--door": f.colour } },
        h("span", { class: "vtile-letter" }, f.letter), h("span", { class: "vtile-num" }, "#" + f.slot));
      tile._num = f.slot;
      DnD.makeDraggable(tile, {});
      tile.addEventListener("click", () => { if (tile._slot) return returnTile(tile); const e = frags.map(x => slotByNum[x.slot]).find(s => !s._tile); if (e) placeTile(tile, e); });
      kbdLike(tile); tiles.push(tile); trayEl.appendChild(tile);
    });
    const wordEl = document.getElementById("vault-word");
    let won = false;
    function check(announce) {
      wordEl.textContent = frags.map(f => slotByNum[f.slot]._tile ? slotByNum[f.slot]._tile.querySelector(".vtile-letter").textContent : "·").join("");
      const ok = frags.every(f => slotByNum[f.slot]._tile && slotByNum[f.slot]._tile._num === f.slot);
      wordEl.classList.toggle("ok", ok);
      if (ok && !won) {
        won = true; Sound.play("escape"); if (window.FX) FX.flash("#36c46a");
        const m = document.getElementById("vault-msg"); m.textContent = "✅ OVERRIDE COMPILED"; m.className = "feedback ok";
        setTimeout(showResults, 1200);
      } else if (announce && !ok) {
        const m = document.getElementById("vault-msg"); m.textContent = "❌ Not compiled — match each fragment to its slot number."; m.className = "feedback bad"; Sound.play("error");
      }
    }
    document.getElementById("vault-check").addEventListener("click", () => check(true));
    document.getElementById("vault-back").addEventListener("click", renderCorridor);
    const vs = document.getElementById("vault-skip");
    if (vs) vs.addEventListener("click", () => { frags.forEach(f => { const t = tiles.find(x => x._num === f.slot && x._slot !== slotByNum[f.slot]); if (t) placeTile(t, slotByNum[f.slot]); }); check(false); });
    renderHud(); window.scrollTo({ top: 0 });
  }

  /* ----------------------------------------- results / badges / share */
  const loadScores = () => { try { return JSON.parse(localStorage.getItem(SCORES_KEY) || "[]"); } catch (e) { return []; } };
  function saveScore(entry) { const a = loadScores(); a.push(entry); a.sort((x, y) => x.seconds - y.seconds); localStorage.setItem(SCORES_KEY, JSON.stringify(a.slice(0, 50))); }

  function showResults() {
    if (finishedAt == null) { finishedAt = Date.now(); save(); }
    if (window.FX) { FX.setAccent("#36c46a"); FX.fireworks(); }
    Sound.play("escape"); celebrate(true);
    const st = statsNow(true), rank = Story.rankFor(st.seconds), badges = Story.badgesFor(st);
    const team = (Settings.get().teamName || "").trim() || "Your team";
    if (!scored) { saveScore({ team, seconds: st.seconds, rank: rank.name, hints: st.hints, date: Date.now() }); scored = true; save(); }
    const timeStr = fmt(st.seconds * 1000);
    const badgeHTML = badges.map(b => `<span class="badge ${b.earned ? "earned" : ""}" title="${esc(b.hint || b.name)}">${b.icon}<small>${esc(b.name)}</small></span>`).join("");
    app().innerHTML = `
      <div class="room-view escape" style="--accent:#36c46a">
        <div class="key-earned">
          <div class="big-key">🏆</div>
          <h2>YOU ESCAPED!</h2>
          <div class="transmission defeated">${Story.avatar()}
            <p class="tx-line"><b>${esc(Story.name())}</b> <span id="res-tx"></span></p></div>
          <p class="intro-story">${esc(GAME.story.outro)}</p>
          <div class="result-stats">
            <div><b>${timeStr}</b><small>Time</small></div>
            <div><b>${st.hints}</b><small>Hints</small></div>
            <div><b>${st.wrong}</b><small>Wrong</small></div>
            <div><b>${st.bonus}</b><small>Bonuses</small></div>
          </div>
          <div class="rank">${rank.icon} Rank: <strong>${esc(rank.name)}</strong></div>
          <div class="badges">${badgeHTML}</div>
          <p>Your final real-world challenge:</p>
          <blockquote class="escape-msg">${esc(GAME.escapeMessage)}</blockquote>
          <div class="key-actions">
            <button class="btn" id="cert">🏆 Certificate</button>
            <button class="btn ghost" id="card">📤 Result card</button>
            <button class="btn ghost" id="lb">🏅 Leaderboard</button>
            <button class="btn ghost" id="again">↺ Play again</button>
            <button class="btn ghost" id="corridor">Corridor</button>
          </div>
        </div>
      </div>`;
    const tx = document.getElementById("res-tx");
    if (window.FX) FX.typeWriter(tx, GAME.villain.win); else tx.textContent = GAME.villain.win;
    document.getElementById("cert").addEventListener("click", printCertificate);
    document.getElementById("card").addEventListener("click", () => shareCard(st, rank, badges, team));
    document.getElementById("lb").addEventListener("click", showLeaderboard);
    document.getElementById("again").addEventListener("click", () => { if (confirm("Play again with a fresh random route?")) reset(); });
    document.getElementById("corridor").addEventListener("click", renderCorridor);
    renderHud(); window.scrollTo({ top: 0 });
  }

  function showLeaderboard() {
    const scores = loadScores().slice(0, 12);
    const rows = scores.length
      ? scores.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.team)}</td><td>${fmt(s.seconds * 1000)}</td><td>${esc(s.rank)}</td><td>${s.hints}</td></tr>`).join("")
      : `<tr><td colspan="5">No escapes recorded on this device yet.</td></tr>`;
    app().innerHTML = `
      <div class="room-view" style="--accent:#f4c430">
        <button class="back" id="back">← Back</button>
        <header class="room-head"><span class="room-ic" aria-hidden="true">🏅</span>
          <div><h2>Leaderboard</h2><p class="room-place">Fastest escapes on this device</p></div></header>
        <table class="lb-table"><thead><tr><th>#</th><th>Team</th><th>Time</th><th>Rank</th><th>Hints</th></tr></thead>
          <tbody>${rows}</tbody></table>
        <div class="key-actions"><button class="btn ghost" id="clear">Clear leaderboard</button></div>
      </div>`;
    document.getElementById("back").addEventListener("click", () => (finishedAt != null ? showResults() : renderCorridor()));
    document.getElementById("clear").addEventListener("click", () => { if (confirm("Clear all saved scores on this device?")) { localStorage.removeItem(SCORES_KEY); showLeaderboard(); } });
    renderHud();
  }

  function showLose() {
    lost = true;
    if (window.FX) { FX.setAccent("#ff2d55"); FX.flash("#ff2d55"); }
    Sound.play("error");
    app().innerHTML = `
      <div class="room-view lose" style="--accent:#ff2d55">
        <div class="key-earned">
          <div class="big-key">💀</div>
          <h2>SERVER PURGED</h2>
          <div class="transmission">${Story.avatar()}
            <p class="tx-line"><b>${esc(Story.name())}</b> <span id="lose-tx"></span></p></div>
          <p class="key-hint">SENTINEL ran out the clock. Your team didn't escape in time.</p>
          <div class="key-actions">
            <button class="btn" id="retry">↺ Try again</button>
            <button class="btn ghost" id="corridor">Corridor</button>
          </div>
        </div>
      </div>`;
    const tx = document.getElementById("lose-tx");
    if (window.FX) FX.typeWriter(tx, GAME.villain.lose); else tx.textContent = GAME.villain.lose;
    document.getElementById("retry").addEventListener("click", reset);
    document.getElementById("corridor").addEventListener("click", renderCorridor);
    renderHud();
  }

  function openJournal() {
    const frags = allFragments(), have = new Set(collectedFragments().map(f => f.slot));
    const cells = frags.map(f => `<div class="jfrag ${have.has(f.slot) ? "got" : "missing"}" style="--door:${f.colour}">
        <span class="jfrag-num">#${f.slot}</span><span class="jfrag-letter">${have.has(f.slot) ? esc(f.letter) : "?"}</span>
        <small>${have.has(f.slot) ? esc(f.room) : "locked"}</small></div>`).join("");
    document.getElementById("modal-root").innerHTML = `
      <div class="modal-backdrop" id="j-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Datapad">
          <div class="modal-head"><h2>📓 Datapad</h2><button class="icon-btn" id="j-close" aria-label="Close datapad">✕</button></div>
          <div class="modal-body">
            <p class="set-note">${esc(Story.name())} split the master override into ${frags.length} fragments — one per room. Recover them all, then compile them in order at the final lock.</p>
            <div class="jfrags">${cells}</div>
            <p class="jprogress">${have.size} / ${frags.length} fragments recovered</p>
          </div>
          <div class="modal-foot"><button class="btn" id="j-done">Close</button></div>
        </div>
      </div>`;
    const close = () => { document.getElementById("modal-root").innerHTML = ""; };
    document.getElementById("j-close").onclick = close;
    document.getElementById("j-done").onclick = close;
    document.getElementById("j-backdrop").addEventListener("click", e => { if (e.target.id === "j-backdrop") close(); });
  }

  function shareCard(st, rank, badges, team) {
    const c = document.createElement("canvas"); c.width = 800; c.height = 420;
    const x = c.getContext && c.getContext("2d");
    if (!x) { toast("Result card isn't supported on this browser."); return; }
    const g = x.createLinearGradient(0, 0, 800, 420); g.addColorStop(0, "#101630"); g.addColorStop(1, "#0a0e1a");
    x.fillStyle = g; x.fillRect(0, 0, 800, 420);
    x.strokeStyle = "#6ad0ff"; x.lineWidth = 4; x.strokeRect(14, 14, 772, 392);
    x.textAlign = "center";
    x.fillStyle = "#6ad0ff"; x.font = "bold 34px Segoe UI, Arial"; x.fillText("ESCAPED — Computer Science", 400, 78);
    x.fillStyle = "#eaf0ff"; x.font = "bold 50px Segoe UI, Arial"; x.fillText(team, 400, 152);
    x.fillStyle = "#9fb0d4"; x.font = "26px Segoe UI, Arial";
    x.fillText("Time " + fmt(st.seconds * 1000) + "   ·   " + st.hints + " hints   ·   " + st.wrong + " wrong", 400, 206);
    x.fillStyle = "#f4c430"; x.font = "bold 34px Segoe UI, Arial"; x.fillText(rank.icon + " " + rank.name, 400, 262);
    x.fillStyle = "#eaf0ff"; x.font = "32px Segoe UI, Arial"; x.fillText(badges.filter(b => b.earned).map(b => b.icon).join("   "), 400, 322);
    x.fillStyle = "#6b7aa0"; x.font = "18px Segoe UI, Arial"; x.fillText(new Date().toLocaleDateString(), 400, 378);
    try { const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "escape-result.png"; a.click(); toast("Result card downloaded 📤"); }
    catch (e) { toast("Couldn't export the card on this browser."); }
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
    if (window.FX) FX.init();
    const t = timerInfo();
    if (Settings.get().timerMode === "countdown" && t.started && finishedAt == null && t.over) showLose();
    else if (order.length && solved.size === order.length) (finishedAt != null ? showResults() : showVault());
    else if (!introSeen && solved.size === 0) showIntro();
    else renderCorridor();
  }

  return { init };
})();

// Init once the DOM is ready — or immediately if it already is.
if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", Engine.init);
else Engine.init();
