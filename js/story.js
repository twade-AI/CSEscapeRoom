/* ==========================================================================
   story.js — the rogue-AI antagonist (SENTINEL), plus rank and achievement
   logic for the end-game. Content lives in GAME.villain / GAME.ranks.
   ========================================================================== */
const Story = (() => {
  const V = () => GAME.villain;

  // An animated "eye" avatar for SENTINEL, returned as inline SVG.
  function avatar() {
    return `
      <svg class="sentinel-eye" viewBox="0 0 120 120" width="92" height="92" aria-hidden="true">
        <defs>
          <radialGradient id="seye" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ff7a90"/><stop offset="55%" stop-color="#ff2d55"/>
            <stop offset="100%" stop-color="#600"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="54" fill="#0a0e1a" stroke="#ff2d55" stroke-width="2"/>
        <g class="eye-rot"><circle cx="60" cy="60" r="44" fill="none" stroke="#ff2d55" stroke-width="1" stroke-dasharray="6 10" opacity=".6"/></g>
        <ellipse cx="60" cy="60" rx="46" ry="22" fill="url(#seye)"/>
        <circle class="eye-pupil" cx="60" cy="60" r="11" fill="#120006"/>
        <circle cx="60" cy="60" r="20" fill="none" stroke="#ffd0d8" stroke-width="1" opacity=".35"/>
      </svg>`;
  }

  function taunt(n) {
    const t = V().taunts;
    return t[Math.min(n, t.length - 1)] || t[t.length - 1];
  }

  function rankFor(seconds) {
    const r = GAME.ranks.find(x => seconds <= x.max) || GAME.ranks[GAME.ranks.length - 1];
    return r;
  }

  // Achievement badges, computed from a stats object:
  //   { seconds, hints, wrong, bonus, rooms, vault }
  const BADGES = [
    { icon: "🗝️", name: "Escapee",         when: () => true },
    { icon: "🔓", name: "Override Master", when: s => s.vault },
    { icon: "⚡", name: "Speed Run",       when: s => s.seconds > 0 && s.seconds <= 360, hint: "Escape in under 6 minutes" },
    { icon: "🧭", name: "No Hints",        when: s => s.hints === 0 },
    { icon: "🎯", name: "Flawless",        when: s => s.wrong === 0, hint: "No wrong answers" },
    { icon: "🧠", name: "Bonus Brain",     when: s => s.bonus >= 3, hint: "Solve 3+ bonus riddles" },
    { icon: "👑", name: "Perfect Run",     when: s => s.hints === 0 && s.wrong === 0 }
  ];
  function badgesFor(stats) {
    return BADGES.map(b => ({ icon: b.icon, name: b.name, hint: b.hint || "", earned: !!b.when(stats) }));
  }

  return { name: () => V().name, avatar, taunt, rankFor, badgesFor, BADGES };
})();
