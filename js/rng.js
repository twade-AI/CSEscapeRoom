/* ==========================================================================
   rng.js — a tiny seeded pseudo-random generator so each *game* can shuffle
   puzzle content deterministically (stable across page reloads via a saved
   seed) while differing from device to device.
   ========================================================================== */
const Rand = (() => {
  let gameSeed = 1;

  // FNV-1a string hash → 32-bit
  function strHash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // mulberry32 PRNG → function returning [0,1)
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  return {
    setSeed(s) { gameSeed = (s >>> 0) || 1; },
    newSeed()  { return (Math.floor(Math.random() * 4294967295) >>> 0) || 1; },
    // a stable RNG for a given room/key within this game
    forKey(key) { return mulberry32((gameSeed ^ strHash(String(key))) >>> 0); },
    shuffle(arr, rnd) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    int(rnd, n) { return Math.floor(rnd() * n); },
    pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
  };
})();
