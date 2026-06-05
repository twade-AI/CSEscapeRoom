/* Headless smoke-test: render every room in jsdom, auto-solve via reveal(),
   confirm check() then passes, and confirm the engine wiring runs error-free.
   Dev-only (not shipped). Uses runScripts:"dangerously" so injected <script>
   tags execute in the real window context (mirroring the browser). */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const vc = new VirtualConsole();
vc.on("log", (...a) => console.log(...a));
vc.on("error", (...a) => console.log("PAGE-ERROR:", a[0] && a[0].message ? a[0].message : a[0]));
vc.on("jsdomError", e => console.log("JSDOM-ERROR:", e.message));

const dom = new JSDOM(`<!DOCTYPE html><body><main id="app"></main></body>`, {
  url: "http://localhost/", pretendToBeVisual: true, runScripts: "dangerously", virtualConsole: vc
});
const { window } = dom;
window.scrollTo = () => {};
window.confirm = () => true;
if (!window.localStorage) {
  const store = {};
  window.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
}
window.document.elementFromPoint = () => null;
window.HTMLElement.prototype.setPointerCapture = () => {};
window.HTMLElement.prototype.releasePointerCapture = () => {};

function inject(code) {
  const s = window.document.createElement("script");
  s.textContent = code;
  window.document.body.appendChild(s);
}
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
["js/data.js", "js/dragdrop.js", "js/puzzles.js", "js/engine.js"].forEach(f => inject(read(f)));
// expose script-scoped consts to the Node side of the harness
inject("window.Engine=Engine;window.ROOMS=ROOMS;window.Puzzles=Puzzles;window.GAME=GAME;window.DnD=DnD;");

inject(`
window.__fails = 0;
(function(){
  console.log("Testing " + ROOMS.length + " rooms…");
  ROOMS.forEach(function(room, i){
    try {
      var mount = document.createElement("div");
      document.body.appendChild(mount);
      var solvedCalled = false;
      var ctx = { onSolved:function(){solvedCalled=true;}, feedback:function(){}, toast:function(){}, solved:false };
      var handle = Puzzles[room.type].mount(mount, room, ctx);
      var before = handle.check();
      handle.reveal();
      var after = handle.check();
      handle.hint();
      if(!after) window.__fails++;
      console.log("  " + (after?"PASS":"FAIL") + "  " + (i+1) + ". " + room.name +
                  " (" + room.type + ")  before=" + before + " afterReveal=" + after +
                  " onSolved=" + (solvedCalled||after));
      mount.remove();
    } catch(e){
      window.__fails++;
      console.log("  FAIL  " + (i+1) + ". " + room.name + " (" + room.type + ") THREW: " + e.message);
      console.log(String(e.stack).split("\\n").slice(0,4).join("\\n"));
    }
  });
  try {
    localStorage.removeItem("cs-escape-progress-v1");
    Engine.init();
    var doors = document.querySelectorAll(".door").length;
    if(doors !== ROOMS.length){ window.__fails++; console.log("  FAIL corridor rendered "+doors+" doors"); }
    else console.log("  PASS corridor rendered "+doors+" doors");
  } catch(e){ window.__fails++; console.log("  FAIL engine flow threw: " + e.message); }
})();
`);

/* ---- async flow test: random route → solve every room → escape ---- */
const KEY = "cs-escape-progress-v1";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const click = el => el.dispatchEvent(new window.Event("click", { bubbles: true }));

(async () => {
  let flowFails = 0;
  const $ = sel => window.document.querySelector(sel);
  const ROOMS = window.ROOMS;
  const fail = m => { flowFails++; console.log("  FAIL " + m); };

  // Solve the room currently on screen via teacher Reveal (+ Check if needed).
  async function solveCurrentRoom() {
    if (!$("#puzzle")) throw new Error("expected to be in a room");
    if ($("#reveal")) click($("#reveal"));
    await sleep(1050);                 // let auto-completing puzzles (sudoku/cipher) fire
    if ($("#check")) { click($("#check")); await sleep(700); }
  }

  try {
    // jsdom dispatches DOMContentLoaded late; let the engine's auto-init fire
    // once now so it can't re-render the corridor mid-flow.
    await sleep(150);
    window.localStorage.removeItem(KEY);
    window.Engine.init();
    const order = JSON.parse(window.localStorage.getItem(KEY)).order;

    // route must be a permutation of all room indices
    const perm = [...order].sort((a, b) => a - b).join(",");
    if (perm !== ROOMS.map((_, i) => i).join(",")) fail("route is not a permutation: " + order);

    // exactly one door open at the start, and it is order[0]
    const open = [...window.document.querySelectorAll(".door.open")];
    if (open.length !== 1 || +open[0].dataset.index !== order[0])
      fail("start should be the single open door order[0]=" + order[0] + ", got " + open.map(d => d.dataset.index));
    else console.log("  PASS random start = room " + order[0] + " (" + ROOMS[order[0]].name + ")");

    click($("#btn-teacher"));                       // enable teacher mode
    click(window.document.querySelector('.door[data-index="' + order[0] + '"]')); // enter start

    for (let k = 0; k < order.length; k++) {
      const idx = order[k];
      const head = $(".room-head h2");
      if (!head || head.textContent !== ROOMS[idx].name)
        throw new Error("step " + (k + 1) + ": expected room " + ROOMS[idx].name + ", got " + (head && head.textContent));
      await solveCurrentRoom();

      if (k < order.length - 1) {
        if (!$(".key-reveal")) throw new Error("step " + (k + 1) + ": no key-earned screen");
        if ($(".key-reveal").textContent.trim() !== ROOMS[idx].key)
          fail("step " + (k + 1) + ": wrong key shown");
        click($("#next"));                          // → lock screen for next route stop
        if (!$(".lockscreen")) throw new Error("step " + (k + 1) + ": no lock screen");
        click($("#usekey"));                        // auto-fill predecessor's key
        await sleep(750);                           // unlock animation → next room
      }
    }
    if ($(".escape-msg")) console.log("  PASS drove full random route of " + order.length + " rooms → ESCAPED");
    else fail("did not reach the escape screen after solving every room");

    // wrong key must be rejected
    window.localStorage.removeItem(KEY);
    window.Engine.init();
    const ord2 = JSON.parse(window.localStorage.getItem(KEY)).order;
    click(window.document.querySelector('.door[data-index="' + ord2[0] + '"]')); // enter start
    // mark start solved so its successor becomes unlocked, then open the lock
    window.localStorage.setItem(KEY, JSON.stringify({ solved: [ROOMS[ord2[0]].id], order: ord2 }));
    window.Engine.init();
    click(window.document.querySelector('.door[data-index="' + ord2[1] + '"]')); // second stop → lock
    if ($(".lockscreen")) {
      $("#keyin").value = "WRONGKEY";
      click($("#unlock"));
      if ($(".lock-msg") && $(".lock-msg").textContent.includes("not the right key"))
        console.log("  PASS wrong key rejected at locked door");
      else fail("wrong key was not rejected");
    } else fail("second stop did not show a lock screen");
  } catch (e) { fail("flow threw: " + e.message); console.log(String(e.stack).split("\n").slice(0, 3).join("\n")); }

  const fails = window.__fails + flowFails;
  console.log(fails === 0 ? "\n✅ ALL SMOKE-TESTS PASSED" : `\n❌ ${fails} FAILURE(S)`);
  process.exit(fails ? 1 : 0);
})();
