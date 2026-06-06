/* ==========================================================================
   sound.js — all sound effects are SYNTHESISED with the Web Audio API, so the
   app needs no audio files and still works fully offline. Everything no-ops
   gracefully where Web Audio is unavailable (e.g. the jsdom test harness).
   ========================================================================== */
const Sound = (() => {
  let ctx = null, enabled = true, ambient = null, ambientOn = false, ambientFreqs = null;

  function ac() {
    if (ctx === null) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = false; }
    }
    return ctx || null;
  }

  function tone({ freq = 440, dur = 0.12, type = "sine", gain = 0.18, when = 0, slideTo = null }) {
    const a = ac(); if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.08);
  }

  const sfx = {
    click:   () => tone({ freq: 600, dur: 0.03, type: "square",   gain: 0.05 }),
    place:   () => tone({ freq: 520, dur: 0.05, type: "triangle", gain: 0.10 }),
    pick:    () => tone({ freq: 720, dur: 0.04, type: "triangle", gain: 0.08 }),
    error:   () => { tone({ freq: 200, dur: 0.18, type: "sawtooth", gain: 0.12, slideTo: 120 }); },
    success: () => [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.16, type: "triangle", gain: 0.14, when: i * 0.09 })),
    key:     () => [392, 587].forEach((f, i) => tone({ freq: f, dur: 0.14, type: "sine", gain: 0.15, when: i * 0.08 })),
    unlock:  () => { tone({ freq: 320, dur: 0.04, type: "square", gain: 0.10 }); tone({ freq: 110, dur: 0.2, type: "sawtooth", gain: 0.12, when: 0.05, slideTo: 70 }); },
    escape:  () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.24, type: "triangle", gain: 0.16, when: i * 0.13 })),
    tick:    () => tone({ freq: 1100, dur: 0.02, type: "square", gain: 0.04 })
  };

  function startAmbient() {
    const a = ac(); if (!a || ambient) return;
    const freqs = (ambientFreqs && ambientFreqs.length) ? ambientFreqs : [55, 82.5];
    const g = a.createGain(); g.gain.value = 0.0001; g.connect(a.destination);
    g.gain.linearRampToValueAtTime(0.045, a.currentTime + 1.2);
    const oscs = freqs.map((f, i) => { const o = a.createOscillator(); o.type = i === 0 ? "sine" : "triangle"; o.frequency.value = f; o.connect(g); o.start(); return o; });
    const lfo = a.createOscillator(); lfo.frequency.value = 0.06;
    const lfoG = a.createGain(); lfoG.gain.value = 0.015; lfo.connect(lfoG).connect(g.gain); lfo.start();
    ambient = { oscs, lfo, g };
  }
  function stopAmbient() {
    if (!ambient) return;
    try { ambient.oscs.forEach(o => o.stop()); ambient.lfo.stop(); ambient.g.disconnect(); } catch (e) {}
    ambient = null;
  }

  return {
    play(name) { try { if (enabled && sfx[name]) sfx[name](); } catch (e) {} },
    setEnabled(v) { enabled = !!v; if (!enabled) { ambientOn = false; stopAmbient(); } },
    isEnabled() { return enabled; },
    setAmbient(v) { try { ambientOn = !!v && enabled; if (ambientOn) startAmbient(); else stopAmbient(); } catch (e) {} },
    setAmbientChord(freqs) { ambientFreqs = freqs; try { if (ambientOn) { stopAmbient(); startAmbient(); } } catch (e) {} },
    // browsers require a user gesture before audio can start
    resume() { const a = ac(); if (a && a.state === "suspended") a.resume(); }
  };
})();
