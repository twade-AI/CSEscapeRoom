/* Capture screenshots of the main screens to eyeball the design. Dev-only. */
const { chromium } = require("playwright");
const path = require("path");

const url = "file://" + path.join(__dirname, "..", "index.html");
const KEY = "cs-escape-progress-v1";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 980 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  const TPW = Buffer.from("TXJXYWRlaXNHcmVhdA==", "base64").toString();
  page.on("dialog", d => d.accept(TPW));               // teacher-password prompt

  const wait = ms => page.waitForTimeout(ms);
  const has = sel => page.$(sel);
  async function setState(state) {
    await page.goto(url);
    await page.evaluate(s => { s ? localStorage.setItem("cs-escape-progress-v1", JSON.stringify(s)) : localStorage.removeItem("cs-escape-progress-v1"); }, state || null);
    await page.goto(url);
  }
  async function solveCurrent() {
    if (await has("#reveal")) await page.click("#reveal");
    await wait(1200);
    if (await has("#check")) { await page.click("#check"); await wait(700); }
  }

  // 1. Terminal boot intro
  await setState(null);
  await page.waitForSelector(".intro-card").catch(() => {});
  await wait(5200);
  await page.screenshot({ path: "_test/shot-intro.png" });

  // 2. Corridor
  if (await has("#begin")) await page.click("#begin");
  await page.waitForSelector(".corridor"); await wait(700);
  await page.screenshot({ path: "_test/shot-corridor.png" });

  // 3. Settings
  await page.click("#hud-settings"); await page.waitForSelector(".modal");
  await page.screenshot({ path: "_test/shot-settings.png" });
  if (await has("#set-close")) await page.click("#set-close");

  // 4. SENTINEL transmission + fragment (key-earned screen of a non-final room)
  await setState({ solved: [], order: [0, 1, 2, 3, 4, 5, 6, 7, 8], introSeen: true });
  await page.waitForSelector(".corridor");
  await page.click("#btn-teacher"); await wait(150);     // dialog accepts password
  await page.click('.door[data-index="0"]');
  await page.waitForSelector("#puzzle");
  await page.screenshot({ path: "_test/shot-room-themed.png" });   // themed room
  await solveCurrent();
  await wait(900); await wait(2600);                      // key screen + taunt typing
  await page.screenshot({ path: "_test/shot-transmission.png" });

  // 5. Datapad / journal
  if (await has("#hud-journal")) { await page.click("#hud-journal"); await page.waitForSelector(".jfrags"); await page.screenshot({ path: "_test/shot-journal.png" }); if (await has("#j-close")) await page.click("#j-close"); }

  // 6. Vault meta-puzzle + 7. Results — pre-solve 8 of 9, crack the last
  await setState({ solved: ["garage","nowhere","corridor1","corridor2","attic","dungeon","entrance","restroom"],
                   order: [0,1,2,3,4,5,6,7,8], introSeen: true, startedAt: Date.now() - 300000 });
  await page.waitForSelector(".corridor");
  await page.click("#btn-teacher"); await wait(150);
  await page.click('.door[data-index="8"]');
  if (await has("#usekey")) { await page.click("#usekey"); await wait(800); }
  await solveCurrent();
  await wait(1000);
  if (await has(".vault")) { await page.screenshot({ path: "_test/shot-vault.png" }); }
  if (await has("#vault-skip")) { await page.click("#vault-skip"); await wait(1600); }
  await wait(800);
  await page.screenshot({ path: "_test/shot-results.png" });

  console.log(errors.length ? "PAGE ERRORS:\n" + errors.join("\n") : "No page errors.");
  await browser.close();
})();
