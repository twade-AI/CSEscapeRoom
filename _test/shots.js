/* Capture screenshots of the main screens to eyeball the design. Dev-only.
   Uses Playwright with the locally-installed chromium. */
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

  async function fresh(state) {
    await page.goto(url);
    await page.evaluate(s => { s ? localStorage.setItem("cs-escape-progress-v1", JSON.stringify(s)) : localStorage.removeItem("cs-escape-progress-v1"); }, state || null);
    await page.goto(url);
  }

  // Intro / story screen
  await fresh(null);
  await page.waitForSelector(".intro-card", { timeout: 4000 }).catch(() => {});
  await page.screenshot({ path: "_test/shot-intro.png" });

  // Corridor (with HUD) — dismiss intro
  if (await page.$("#begin")) await page.click("#begin");
  await page.waitForSelector(".corridor");
  await page.screenshot({ path: "_test/shot-corridor.png" });

  // Settings modal
  await page.click("#hud-settings");
  await page.waitForSelector(".modal");
  await page.screenshot({ path: "_test/shot-settings.png" });
  if (await page.$("#set-close")) await page.click("#set-close");

  // A room — force a chosen room to be the start so it opens without a lock
  async function room(index, name) {
    const rest = await page.evaluate(i => ROOMS.map((_, k) => k).filter(k => k !== i), index);
    await fresh({ solved: [], order: [index, ...rest], introSeen: true });
    await page.waitForSelector(".corridor");
    await page.click(`.door[data-index="${index}"]`);
    await page.waitForSelector("#puzzle");
    await page.screenshot({ path: `_test/shot-${name}.png` });
  }
  await room(0, "1-anagram");
  await room(4, "5-match");

  console.log(errors.length ? "PAGE ERRORS:\n" + errors.join("\n") : "No page errors.");
  await browser.close();
})();
