/* ==========================================================================
   fx.js — visual flair: a living particle-network background, screen flashes,
   celebratory bursts/fireworks and a typewriter. All GPU-light and guarded, so
   it degrades to nothing where there's no <canvas> (e.g. the test harness) and
   goes static when the user prefers reduced motion.
   ========================================================================== */
const FX = (() => {
  let canvas, ctx, raf = null, running = false, inited = false;
  let W = 0, H = 0, dpr = 1;
  let particles = [], sparks = [];
  let rgb = { r: 106, g: 208, b: 255 };
  const DIST = 132, DIST2 = DIST * DIST;

  function reduced() {
    try {
      if (window.Settings && Settings.get && typeof Settings.get().reducedMotion === "boolean") return Settings.get().reducedMotion;
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { return false; }
  }
  function toRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : rgb;
  }
  function size() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function seed() {
    const n = Math.max(28, Math.min(80, Math.floor(W * H / 20000)));
    particles = [];
    for (let i = 0; i < n; i++)
      particles.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28, r: Math.random() * 1.7 + .6 });
  }
  function drawNetwork() {
    const { r, g, b } = rgb;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const c = particles[j], dx = a.x - c.x, dy = a.y - c.y, d2 = dx * dx + dy * dy;
        if (d2 < DIST2) {
          ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - d2 / DIST2) * .33})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
        }
      }
    }
    for (const p of particles) {
      ctx.fillStyle = `rgba(${r},${g},${b},.85)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
    }
  }
  function drawSparks() {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx; s.y += s.vy; s.vy += .05; s.life -= .018;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
    }
    drawNetwork(); drawSparks();
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() { if (running || !ctx) return; if (reduced()) { ctx.clearRect(0, 0, W, H); drawNetwork(); return; } running = true; frame(); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  function init() {
    if (inited) return;
    canvas = document.getElementById("fx-bg");
    if (!canvas || !canvas.getContext) return;
    ctx = canvas.getContext("2d");
    if (!ctx) return;
    inited = true;
    size(); seed(); start();
    window.addEventListener("resize", () => { size(); seed(); if (!running) start(); });
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    window.addEventListener("pointermove", e => {
      document.documentElement.style.setProperty("--mx", e.clientX + "px");
      document.documentElement.style.setProperty("--my", e.clientY + "px");
    }, { passive: true });
  }

  function setAccent(hex) {
    rgb = toRgb(hex);
    try { document.documentElement.style.setProperty("--fx-accent", hex); } catch (e) {}
    if (inited && !running) start();           // refresh the static frame
  }
  function flash(color) {
    if (reduced()) return;
    const el = document.getElementById("fx-flash"); if (!el) return;
    el.style.background = color || "#fff";
    el.classList.remove("go"); void el.offsetWidth; el.classList.add("go");
  }
  function burst(x, y, color, n) {
    if (!ctx || reduced()) return;
    const cols = color ? [color] : ["#f4c430", "#6ad0ff", "#ff5470", "#36c46a", "#a065ff"];
    for (let i = 0; i < (n || 26); i++) {
      const a = Math.random() * 6.2832, sp = Math.random() * 3.6 + 1;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, r: Math.random() * 2.2 + 1, life: 1, color: cols[i % cols.length] });
    }
    if (!running) { running = true; frame(); }
  }
  function fireworks() {
    if (reduced()) return;
    let i = 0;
    const t = setInterval(() => {
      burst(W * (.2 + Math.random() * .6), H * (.2 + Math.random() * .4), null, 30);
      if (++i >= 6) clearInterval(t);
    }, 280);
  }
  function typeWriter(el, text, done) {
    if (!el) return;
    if (reduced()) { el.textContent = text; if (done) done(); return; }
    el.textContent = ""; let i = 0;
    (function step() {
      if (i <= text.length) { el.textContent = text.slice(0, i++); setTimeout(step, 16); }
      else if (done) done();
    })();
  }

  return { init, setAccent, flash, burst, fireworks, typeWriter, stop, start };
})();
