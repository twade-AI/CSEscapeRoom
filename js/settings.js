/* ==========================================================================
   settings.js — teacher-facing settings (timer, difficulty, sound, which rooms
   are included, accessibility) plus the ⚙ Settings modal. Persisted separately
   from game progress. Applies accessibility preferences to the page.
   ========================================================================== */
const Settings = (() => {
  const KEY = "cs-escape-settings-v1";
  let state = {};
  let onChange = () => {};            // engine hooks in here

  function defaults() {
    const d = Object.assign({}, GAME.settingsDefaults);
    // Honour the OS "reduce motion" preference the first time.
    try { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) d.reducedMotion = true; }
    catch (e) {}
    return d;
  }
  function load() {
    try { state = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { state = defaults(); }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  function get() { return state; }
  function set(patch) {
    Object.assign(state, patch);
    save(); apply();
    onChange(Object.keys(patch));
  }

  function includedRoomIds() {
    const all = ROOMS.map(r => r.id);
    if (!Array.isArray(state.rooms) || !state.rooms.length) return all;
    const set = state.rooms.filter(id => all.includes(id));
    return set.length ? set : all;
  }
  function hintPolicy() {
    return GAME.hintPolicy[state.difficulty] || GAME.hintPolicy.normal;
  }

  // Apply accessibility + audio preferences to the document.
  function apply() {
    const b = document.body;
    b.classList.toggle("rm", !!state.reducedMotion);
    b.classList.toggle("a11y-dys", !!state.dyslexia);
    b.classList.toggle("a11y-hc", !!state.highContrast);
    b.classList.toggle("a11y-cb", !!state.colourblind);
    document.documentElement.style.setProperty("--text-scale", state.textScale || 1);
    if (window.Sound) { Sound.setEnabled(!!state.sound); Sound.setAmbient(!!state.ambient); }
  }

  /* ------------------------------------------------------------- the modal */
  function openModal() {
    const root = document.getElementById("modal-root");
    const s = state;
    const roomChecks = ROOMS.map(r => {
      const on = includedRoomIds().includes(r.id);
      return `<label class="set-room"><input type="checkbox" data-room="${r.id}" ${on ? "checked" : ""}>
                <span>${r.icon} ${r.name}</span></label>`;
    }).join("");

    root.innerHTML = `
      <div class="modal-backdrop" id="set-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Settings">
          <div class="modal-head">
            <h2>⚙ Settings</h2>
            <button class="icon-btn" id="set-close" aria-label="Close settings">✕</button>
          </div>
          <div class="modal-body">
            <fieldset><legend>⏱ Timer</legend>
              <label><input type="radio" name="tmode" value="off" ${s.timerMode==="off"?"checked":""}> Off</label>
              <label><input type="radio" name="tmode" value="countup" ${s.timerMode==="countup"?"checked":""}> Count up</label>
              <label><input type="radio" name="tmode" value="countdown" ${s.timerMode==="countdown"?"checked":""}> Countdown</label>
              <label class="inline">Minutes <input type="number" id="set-minutes" min="1" max="180" value="${s.timerMinutes}" ${s.timerMode==="countdown"?"":"disabled"}></label>
            </fieldset>

            <fieldset><legend>🎚 Difficulty (hint budget)</legend>
              <select id="set-difficulty">
                <option value="easy"   ${s.difficulty==="easy"?"selected":""}>Easy — unlimited free hints</option>
                <option value="normal" ${s.difficulty==="normal"?"selected":""}>Normal — 6 hints, +30s each</option>
                <option value="hard"   ${s.difficulty==="hard"?"selected":""}>Hard — 3 hints, +60s each</option>
              </select>
            </fieldset>

            <fieldset><legend>🔊 Sound & play</legend>
              <label><input type="checkbox" id="set-sound" ${s.sound?"checked":""}> Sound effects</label>
              <label><input type="checkbox" id="set-ambient" ${s.ambient?"checked":""}> Ambient music</label>
              <label><input type="checkbox" id="set-shuffle" ${s.shuffle?"checked":""}> Shuffle puzzle layouts each game (anti-copying)</label>
              <label class="inline">Team name <input type="text" id="set-team" maxlength="40" value="${(s.teamName||"").replace(/"/g,"&quot;")}" placeholder="e.g. Team Binary"></label>
            </fieldset>

            <fieldset><legend>🚪 Rooms included</legend>
              <p class="set-note">Untick rooms to leave them out (the route uses only ticked rooms). Changing this starts a fresh route.</p>
              <div class="set-rooms">${roomChecks}</div>
            </fieldset>

            <fieldset><legend>♿ Accessibility</legend>
              <label><input type="checkbox" id="set-rm" ${s.reducedMotion?"checked":""}> Reduce motion (no confetti/animation)</label>
              <label><input type="checkbox" id="set-dys" ${s.dyslexia?"checked":""}> Dyslexia-friendly font</label>
              <label><input type="checkbox" id="set-hc" ${s.highContrast?"checked":""}> High contrast</label>
              <label><input type="checkbox" id="set-cb" ${s.colourblind?"checked":""}> Colour-blind-safe doors</label>
              <label class="inline">Text size
                <input type="range" id="set-scale" min="0.9" max="1.5" step="0.1" value="${s.textScale||1}"></label>
            </fieldset>
          </div>
          <div class="modal-foot">
            <button class="btn" id="set-done">Done</button>
          </div>
        </div>
      </div>`;

    const $ = id => document.getElementById(id);
    const close = () => { root.innerHTML = ""; };
    $("set-close").onclick = close;
    $("set-done").onclick = close;
    $("set-backdrop").addEventListener("click", e => { if (e.target.id === "set-backdrop") close(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });

    root.querySelectorAll('input[name="tmode"]').forEach(r =>
      r.addEventListener("change", () => {
        $("set-minutes").disabled = r.value !== "countdown";
        set({ timerMode: root.querySelector('input[name="tmode"]:checked').value });
      }));
    $("set-minutes").addEventListener("change", e => set({ timerMinutes: Math.max(1, +e.target.value || 45) }));
    $("set-difficulty").addEventListener("change", e => set({ difficulty: e.target.value }));
    $("set-sound").addEventListener("change", e => { set({ sound: e.target.checked }); if (e.target.checked) { Sound.resume(); Sound.play("key"); } });
    $("set-ambient").addEventListener("change", e => set({ ambient: e.target.checked }));
    $("set-shuffle").addEventListener("change", e => set({ shuffle: e.target.checked }));
    $("set-team").addEventListener("input", e => set({ teamName: e.target.value }));
    $("set-rm").addEventListener("change", e => set({ reducedMotion: e.target.checked }));
    $("set-dys").addEventListener("change", e => set({ dyslexia: e.target.checked }));
    $("set-hc").addEventListener("change", e => set({ highContrast: e.target.checked }));
    $("set-cb").addEventListener("change", e => set({ colourblind: e.target.checked }));
    $("set-scale").addEventListener("input", e => set({ textScale: +e.target.value }));

    root.querySelectorAll("input[data-room]").forEach(cb =>
      cb.addEventListener("change", () => {
        const ids = [...root.querySelectorAll("input[data-room]")].filter(x => x.checked).map(x => x.dataset.room);
        if (!ids.length) { cb.checked = true; return; }   // never allow zero rooms
        set({ rooms: ids.length === ROOMS.length ? null : ids });
      }));
  }

  return { load, save, get, set, apply, includedRoomIds, hintPolicy, openModal,
           setOnChange(fn) { onChange = fn; } };
})();
