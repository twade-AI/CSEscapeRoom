/* Capture screenshots of the corridor + several rooms to eyeball the design.
   Dev-only. Uses Playwright with the locally-installed chromium. */
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 950 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

  const url = "file://" + path.join(__dirname, "..", "index.html");
  await page.goto(url);
  await page.waitForSelector(".corridor");
  await page.screenshot({ path: "_test/shot-corridor.png" });

  // Enable teacher mode so we can reveal answers for nicer screenshots
  async function enterRoomAndReveal(index, name) {
    await page.goto(url);
    await page.waitForSelector(".corridor");
    // Force this room to be the (random) starting room so it opens with no lock.
    await page.evaluate((i) => {
      const rest = ROOMS.map((_, k) => k).filter(k => k !== i);
      localStorage.setItem("cs-escape-progress-v1", JSON.stringify({ solved: [], order: [i, ...rest] }));
    }, index);
    await page.goto(url);
    await page.waitForSelector(".corridor");
    await page.click("#btn-teacher");
    await page.click(`.door[data-index="${index}"]`);
    await page.waitForSelector("#puzzle");
    await page.screenshot({ path: `_test/shot-${name}.png` });
  }

  await enterRoomAndReveal(0, "1-anagram");
  await enterRoomAndReveal(2, "3-crossword");
  await enterRoomAndReveal(3, "4-spoterror");
  await enterRoomAndReveal(4, "5-match");
  await enterRoomAndReveal(5, "6-sudoku");
  await enterRoomAndReveal(8, "9-cipher");

  console.log(errors.length ? "PAGE ERRORS:\n" + errors.join("\n") : "No page errors.");
  await browser.close();
})();
