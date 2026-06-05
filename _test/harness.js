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

/* ---- async flow test: solve a room → key screen → lock → use key → next ---- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const click = el => el.dispatchEvent(new window.Event("click", { bubbles: true }));

(async () => {
  let flowFails = 0;
  const $ = sel => window.document.querySelector(sel);
  try {
    window.localStorage.removeItem("cs-escape-progress-v1");
    window.Engine.init();
    click($("#btn-teacher"));                              // enable teacher mode
    click(window.document.querySelector('.door[data-index="0"]')); // enter room 1
    if (!$("#puzzle")) throw new Error("room 1 did not open");
    click($("#reveal"));                                   // teacher reveal answers
    click($("#check"));                                    // check → completes room
    await sleep(650);                                      // wait for key-earned screen
    if (!$(".key-reveal")) throw new Error("key-earned screen not shown");
    const shownKey = $(".key-reveal").textContent.trim();
    if (shownKey !== window.ROOMS[0].key) { flowFails++; console.log("  FAIL wrong key shown:", shownKey); }
    click($("#next"));                                     // go to next door
    if (!$(".lockscreen")) throw new Error("lock screen not shown");
    click($("#usekey"));                                   // use earned key
    await sleep(750);                                      // wait for unlock anim → room 2
    const head = $(".room-head h2");
    if (!head || head.textContent !== window.ROOMS[1].name) { flowFails++; console.log("  FAIL did not enter room 2, got:", head && head.textContent); }
    else console.log("  PASS full flow: solved room 1 → used key → entered", head.textContent);

    // wrong key should NOT unlock
    window.Engine.init();
    click(window.document.querySelector('.door[data-index="1"]')); // room 2 unlocked now (room1 solved)
    if ($(".lockscreen")) {
      $("#keyin").value = "WRONGKEY";
      click($("#unlock"));
      if (!$(".lock-msg") || !$(".lock-msg").textContent.includes("not the right key")) { flowFails++; console.log("  FAIL wrong key not rejected"); }
      else console.log("  PASS wrong key rejected");
    }
  } catch (e) { flowFails++; console.log("  FAIL flow threw:", e.message); }

  const fails = window.__fails + flowFails;
  console.log(fails === 0 ? "\n✅ ALL SMOKE-TESTS PASSED" : `\n❌ ${fails} FAILURE(S)`);
  process.exit(fails ? 1 : 0);
})();
