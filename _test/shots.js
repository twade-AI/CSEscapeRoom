/* Capture screenshots of the main screens to eyeball the design. Dev-only. */
const { chromium } = require("playwright");
const path = require("path");

const url = "file://" + path.join(__dirname, "..", "index.html");
const KEY = "cs-escape-progress-v1";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 950 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  const TPW = Buffer.from("TXJXYWRlaXNHcmVhdA==", "base64").toString();   // teacher password (not in plaintext)
  page.on("dialog", d => d.accept(TPW));               // teacher-password prompt

  const wait = ms => page.waitForTimeout(ms);
  async function fresh(state) {
    await page.goto(url);
    await page.evaluate(s => { s ? localStorage.setItem("cs-escape-progress-v1", JSON.stringify(s)) : localStorage.removeItem("cs-escape-progress-v1"); }, state || null);
    await page.goto(url);
  }

  // Terminal boot intro (let the typewriter finish)
  await fresh(null);
  await page.waitForSelector(".intro-card").catch(() => {});
  await wait(5200);
  await page.screenshot({ path: "_test/shot-intro.png" });

  // Corridor with the live particle background + glowing start door
  if (await page.$("#begin")) await page.click("#begin");
  await page.waitForSelector(".corridor");
  await wait(700);
  await page.screenshot({ path: "_test/shot-corridor.png" });

  // Settings modal
  await page.click("#hud-settings");
  await page.waitForSelector(".modal");
  await page.screenshot({ path: "_test/shot-settings.png" });
  if (await page.$("#set-close")) await page.click("#set-close");

  // A room — force it to be the start so it opens with no lock
  async function room(index, name) {
    const rest = await page.evaluate(i => ROOMS.map((_, k) => k).filter(k => k !== i), index);
    await fresh({ solved: [], order: [index, ...rest], introSeen: true });
    await page.waitForSelector(".corridor");
    await page.click(`.door[data-index="${index}"]`);
    await page.waitForSelector("#puzzle");
    await wait(500);
    await page.screenshot({ path: `_test/shot-${name}.png` });
  }
  await room(5, "6-sudoku");
  await room(0, "1-anagram");

  // Escape + fireworks — pre-solve 8 of 9, then crack the last room
  await page.evaluate(() => {
    const ids = ROOMS.map(r => r.id);
    localStorage.setItem("cs-escape-progress-v1", JSON.stringify({
      solved: ids.slice(0, 8), order: ROOMS.map((_, i) => i), introSeen: true, startedAt: Date.now() - 425000
    }));
  });
  await page.goto(url);
  await page.waitForSelector(".corridor");
  await page.click("#btn-teacher");                 // dialog auto-accepts password
  await wait(150);
  await page.click('.door[data-index="8"]');        // last room → lock
  if (await page.$("#usekey")) { await page.click("#usekey"); await wait(800); }
  if (await page.$("#reveal")) await page.click("#reveal");
  await wait(1400);
  if (await page.$("#check")) await page.click("#check");
  await wait(1200);
  await page.screenshot({ path: "_test/shot-escape.png" });

  console.log(errors.length ? "PAGE ERRORS:\n" + errors.join("\n") : "No page errors.");
  await browser.close();
})();
