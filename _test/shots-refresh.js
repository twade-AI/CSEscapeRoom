/* Capture the refreshed corridor + a few room environments. Dev-only. */
const { chromium } = require("playwright");
const path = require("path");
const url = "file://" + path.join(__dirname, "..", "index.html");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 920 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  const wait = ms => page.waitForTimeout(ms);

  async function start(order) {
    await page.goto(url);
    await page.evaluate(o => localStorage.setItem("cs-escape-progress-v1", JSON.stringify({ solved: [], order: o, introSeen: true })), order);
    await page.goto(url);
    await page.waitForSelector(".corridor");
  }
  // corridor (room 0 is the start ★)
  await start([0,1,2,3,4,5,6,7,8]);
  await wait(900);
  await page.screenshot({ path: "_test/shot-corridor.png" });

  // a few rooms, each made the start so it's enterable, to show hue variety
  const rooms = { garage: 0, dungeon: 5, garden: 8 };
  for (const [name, idx] of Object.entries(rooms)) {
    const order = [idx, ...[0,1,2,3,4,5,6,7,8].filter(i => i !== idx)];
    await start(order);
    await page.click(`.door[data-index="${idx}"]`);
    await page.waitForSelector("#puzzle");
    await wait(700);
    await page.screenshot({ path: `_test/shot-env-${name}.png` });
  }
  console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "No page errors.");
  await browser.close();
})();
