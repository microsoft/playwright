# 🎭 Playwright

[![npm version](https://img.shields.io/npm/v/playwright.svg)](https://www.npmjs.com/package/playwright) <!-- GEN:chromium-version-badge -->[![Chromium version](https://img.shields.io/badge/chromium-154.0.8037.0-blue.svg?logo=google-chrome)](https://www.chromium.org/Home)<!-- GEN:stop --> <!-- GEN:firefox-version-badge -->[![Firefox version](https://img.shields.io/badge/firefox-155.0-blue.svg?logo=firefoxbrowser)](https://www.mozilla.org/en-US/firefox/new/)<!-- GEN:stop --> <!-- GEN:webkit-version-badge -->[![WebKit version](https://img.shields.io/badge/webkit-26.6-blue.svg?logo=safari)](https://webkit.org/)<!-- GEN:stop --> [![Join Discord](https://img.shields.io/badge/join-discord-informational)](https://aka.ms/playwright/discord)

## [Documentation](https://playwright.dev) | [API reference](https://playwright.dev/docs/api/class-playwright)

Playwright is a framework for web automation and testing. It drives Chromium, Firefox, and WebKit with a single API — in your tests, in your scripts, and as a tool for AI agents.

## Get Started

Choose the path that fits your workflow:

| | Best for | Install |
|---|---|---|
| **[Playwright Test](#playwright-test)** | End-to-end testing | `npm init playwright@latest` |
| **[Playwright CLI](#playwright-cli)** | Coding agents (Claude Code, Copilot) | `npm i -g @playwright/cli@latest` |
| **[Playwright MCP](#playwright-mcp)** | AI agents and LLM-driven automation | `npx @playwright/mcp@latest` |
| **[Playwright Library](#playwright-library)** | Browser automation scripts | `npm i playwright` |
| **[VS Code Extension](#vs-code-extension)** | Test authoring and debugging in VS Code | [Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) |

---

## Playwright Test

Playwright Test is a full-featured test runner built for end-to-end testing. It runs tests across Chromium, Firefox, and WebKit with full browser isolation, auto-waiting, and web-first assertions.

### Install

```bash
npm init playwright@latest
```

Or add manually:

```bash
npm i -D @playwright/test
npx playwright install
```

### Write a test

```TypeScript
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
```

### Run tests

```bash
npx playwright test
```

Tests run in parallel across all configured browsers, in headless mode by default. Each test gets a fresh browser context — full isolation with near-zero overhead.

### Key capabilities

**Auto-wait and web-first assertions.** No artificial timeouts. Playwright waits for elements to be actionable, and assertions automatically retry until conditions are met.

**Locators.** Find elements with resilient locators that mirror how users see the page:

```TypeScript
page.getByRole('button', { name: 'Submit' })
page.getByLabel('Email')
page.getByPlaceholder('Search...')
page.getByTestId('login-form')
```

**Test isolation.** Each test runs in its own browser context — equivalent to a fresh browser profile. Save authentication state once and reuse it across tests:

```TypeScript
// Save state after login
await page.context().storageState({ path: 'auth.json' });

// Reuse in other tests
test.use({ storageState: 'auth.json' });
```

**Tracing.** Capture execution traces, screenshots, and videos on failure. Inspect every action, DOM snapshot, network request, and console message in the [Trace Viewer](https://playwright.dev/docs/trace-viewer):

```TypeScript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: 'on-first-retry',
  },
});
```

```bash
npx playwright show-trace trace.zip
```

<!-- TODO: screenshot of trace viewer -->

**Parallelism.** Tests run in parallel by default across all configured browsers.

[Full testing documentation](https://playwright.dev/docs/intro)

---

## Playwright CLI

[Playwright CLI](https://github.com/microsoft/playwright-cli) is a command-line interface for browser automation designed for coding agents. It's more token-efficient than MCP — commands avoid loading large tool schemas and accessibility trees into the model context.

### Install

```bash
npm install -g @playwright/cli@latest
```

Optionally install skills for richer agent integration:

```bash
playwright-cli install --skills
```

### Usage

Point your coding agent at a task:

```
Test the "add todo" flow on https://demo.playwright.dev/todomvc using playwright-cli.
Take screenshots for all successful and failing scenarios.
```

Or run commands directly:

```bash
playwright-cli open https://demo.playwright.dev/todomvc/ --headed
playwright-cli type "Buy groceries"
playwright-cli press Enter
playwright-cli screenshot
```

### Session monitoring

Use `playwright-cli show` to open a visual dashboard with live screencast previews of all running browser sessions. Click any session to zoom in and take remote control.

```bash
playwright-cli show
```

<!-- TODO: screenshot of playwright-cli show dashboard -->

[Full CLI documentation](https://playwright.dev/agent-cli/introduction) | [GitHub](https://github.com/microsoft/playwright-cli)

---

## Playwright MCP

The [Playwright MCP server](https://github.com/microsoft/playwright-mcp) gives AI agents full browser control through the [Model Context Protocol](https://modelcontextprotocol.io). Agents interact with pages using structured accessibility snapshots — no vision models or screenshots required.

### Setup

Add to your MCP client (VS Code, Cursor, Claude Desktop, Windsurf, etc.):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**One-click install for VS Code:**

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20MCP%20Server&color=0098FF" alt="Install in VS Code" />](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)

**For Claude Code:**

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

### How it works

Ask your AI assistant to interact with any web page:

```
Navigate to https://demo.playwright.dev/todomvc and add a few todo items.
```

The agent sees the page as a structured accessibility tree:

```
- heading "todos" [level=1]
- textbox "What needs to be done?" [ref=e5]
- listitem:
  - checkbox "Toggle Todo" [ref=e10]
  - text: "Buy groceries"
```

It uses element refs like `e5` and `e10` to click, type, and interact — deterministically and without visual ambiguity. Tools cover navigation, form filling, screenshots, network mocking, storage management, and more.

[Full MCP documentation](https://playwright.dev/mcp/introduction) | [GitHub](https://github.com/microsoft/playwright-mcp)

---

## Playwright Library

Use `playwright` as a library for browser automation scripts — web scraping, PDF generation, screenshot capture, and any workflow that needs programmatic browser control without a test runner.

### Install

```bash
npm i playwright
```

### Examples

**Take a screenshot:**

```TypeScript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://playwright.dev/');
await page.screenshot({ path: 'screenshot.png' });
await browser.close();
```

**Generate a PDF:**

```TypeScript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://playwright.dev/');
await page.pdf({ path: 'page.pdf', format: 'A4' });
await browser.close();
```

**Emulate a mobile device:**

```TypeScript
import { chromium, devices } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext(devices['iPhone 15']);
const page = await context.newPage();
await page.goto('https://playwright.dev/');
await page.screenshot({ path: 'mobile.png' });
await browser.close();
```

**Intercept network requests:**

```TypeScript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route('**/*.{png,jpg,jpeg}', route => route.abort());
await page.goto('https://playwright.dev/');
await browser.close();
```

[Library documentation](https://playwright.dev/docs/library) | [API reference](https://playwright.dev/docs/api/class-playwright)

---

## VS Code Extension

The [Playwright VS Code extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) brings test running, debugging, and code generation directly into your editor.

<!-- TODO: hero screenshot of VS Code with Playwright sidebar -->

**Run and debug tests** from the editor with a single click. Set breakpoints, inspect variables, and step through test execution with a live browser view.

**Generate tests with CodeGen.** Click "Record new" to open a browser — navigate and interact with your app while Playwright writes the test code for you.

**Pick locators.** Hover over any element in the browser to see the best available locator, then click to copy it to your clipboard.

**Trace Viewer integration.** Enable "Show Trace Viewer" in the sidebar to get a full execution trace after each test run — DOM snapshots, network requests, console logs, and screenshots at every step.

[Install the extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) | [VS Code guide](https://playwright.dev/docs/getting-started-vscode)

---

## Cross-Browser Support

|          | Linux | macOS | Windows |
|   :---   | :---: | :---: | :---:   |
| Chromium<sup>1</sup> <!-- GEN:chromium-version -->154.0.8037.0<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| WebKit <!-- GEN:webkit-version -->26.6<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Firefox <!-- GEN:firefox-version -->155.0<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |

Headless and headed execution on all platforms. <sup>1</sup> Uses [Chrome for Testing](https://developer.chrome.com/blog/chrome-for-testing) by default.

## Other Languages

Playwright is also available for [Python](https://playwright.dev/python/docs/intro), [.NET](https://playwright.dev/dotnet/docs/intro), and [Java](https://playwright.dev/java/docs/intro).

## Resources

* [Documentation](https://playwright.dev)
* [API reference](https://playwright.dev/docs/api/class-playwright)
* [MCP server](https://github.com/microsoft/playwright-mcp)
* [CLI for coding agents](https://github.com/microsoft/playwright-cli)
* [VS Code extension](https://github.com/microsoft/playwright-vscode)
* [Contribution guide](CONTRIBUTING.md)
* [Changelog](https://github.com/microsoft/playwright/releases)
* [Discord](https://aka.ms/playwright/discord)


## 🌐 Web Resources & Interactive Index
- [DESERT ROVER SURVIVAL](https://themindskillplayplay.pages.dev/desert-rover-survival.html)
- [HORROR ESCAPE GRANNY ROOM](https://studyplayings.web.app/horror-escape-granny-room.html)
- [UNICORN PRINCESS DRESS UP](https://quizverses-9d2f2.web.app/unicorn-princess-dress-up.html)
- [POXEL IO](https://thelearnquesters.pages.dev/poxel-io.html)
- [ROOF CAR STUNT](https://quizverses.github.io/roof-car-stunt.html)
- [GUN RACING](https://quizverses.github.io/gun-racing.html)
- [STACKTRIS 2048](https://quizverses.pages.dev/stacktris-2048.html)
- [TANK BATTLEIO](https://thelearnquesters.pages.dev/tank-battleio.html)
- [ONU LIVE](https://learnquester.github.io/onu-live.html)
- [CATEGORY CAR](https://studyplayings.web.app/category-car.html)
- [CATEGORY MISSION207](https://quizverses.github.io/category-mission207.html)
- [INDEX29](https://studyquests.github.io/index29.html)
- [I8 CITY DRIVER](https://quizverses.github.io/i8-city-driver.html)
- [SHIPBUILDING TYCOON](https://thelearnquesters.pages.dev/shipbuilding-tycoon.html)
- [LOOP SURVIVORS ZOMBIE CITY](https://studyquests.github.io/loop-survivors-zombie-city.html)
- [EXCAVATOR SIMULATOR 3D](https://studyplaying.github.io/excavator-simulator-3d.html)
- [WOODEN BOLTS AND NUTS](https://thelearnquesters.pages.dev/wooden-bolts-and-nuts.html)
- [ASTRAL ESCAPE](https://thelearnquesters.pages.dev/astral-escape.html)
- [SITEMAP](https://cryptotify.github.io/sitemap.html)
- [DOLPHIN COUPLE UNDERWATER DRESS UP](https://learnquesters.pages.dev/dolphin-couple-underwater-dress-up.html)
- [ONLINE PORTAL](https://brainquests-fb2c5.web.app/)
- [DUCKLINGS](https://thelearnquester.web.app/ducklings.html)
- [CATEGORY JUMPING147](https://studyquests.pages.dev/category-jumping147.html)
- [TOWER OF HELL OBBY BLOX](https://quizverses.github.io/tower-of-hell-obby-blox.html)
- [VAULT BREAKER](https://studyquesthub.web.app/vault-breaker.html)
- [MY TINY LAND](https://studyplaying.github.io/my-tiny-land.html)
- [ANIMAL BLOCKS](https://studyplaying.github.io/animal-blocks.html)
- [SUPERMARKET SORT GROCERY GAME](https://quizverses.pages.dev/supermarket-sort-grocery-game.html)
- [CINDERELLA DRESS UP GIRL GAMES](https://studyplaying.github.io/cinderella-dress-up-girl-games.html)
- [DUMMIES WORLD CUP](https://studyquests.github.io/dummies-world-cup.html)
- [PAWS OFF MY CLUES](https://studyquesthub.web.app/paws-off-my-clues.html)
- [MY ARCADE CENTER](https://studyplaying.github.io/my-arcade-center.html)
- [TICTOC URBAN OUTFITS](https://studyplaying.github.io/tictoc-urban-outfits.html)
- [INDEX23](https://studyquests.github.io/index23.html)
- [BUBBLE TEA](https://studyquesthub.web.app/bubble-tea.html)
- [ONLINE PORTAL](https://brainquests.github.io/)
- [INDEX33](https://studyquests.github.io/index33.html)
- [HANGMAN SAGA](https://studyplaying.github.io/hangman-saga.html)
- [SMALL WARDROBE](https://studyquests.github.io/small-wardrobe.html)
- [GOLD MINER CLASSIC](https://studyplaying.github.io/gold-miner-classic.html)
- [CATEGORY 2D1 070](https://quizverses.github.io/category-2d1-070.html)
- [SPA EMPIRE](https://studyquesthub.web.app/spa-empire.html)
- [CATEGORY FIGHTING](https://quizverses.github.io/category-fighting.html)
- [THE BIG HIT RUN](https://thelearnquesters.pages.dev/the-big-hit-run.html)
- [KITCHEN SORTING](https://studyplaying.github.io/kitchen-sorting.html)
- [MAGIC TILES 3](https://studyplaying.github.io/magic-tiles-3.html)
- [INDEX27](https://studyquests.github.io/index27.html)
- [TAP AWAY BLOCK PUZZLE 3D](https://quizverses.pages.dev/tap-away-block-puzzle-3d.html)
- [CAT PANCAKE DINER](https://learnquester.pages.dev/cat-pancake-diner.html)
- [CATEGORY STUNT128](https://thelearnquesters.pages.dev/category-stunt128.html)
- [STICKMAN ZOMBIE VS STICKMAN HERO](https://studyplaying.github.io/stickman-zombie-vs-stickman-hero.html)
- [STUDENT AND TEACHER](https://studyplaying.github.io/student-and-teacher.html)
- [SAND BLAST](https://studyquesthub.web.app/sand-blast.html)
- [COIN BLITZ](https://studyquests.github.io/coin-blitz.html)
- [STICKMAN DOORS AND ISLAND](https://studyquesthub.web.app/stickman-doors-and-island.html)
- [RABBIT CARROT](https://studyquests.github.io/rabbit-carrot.html)
- [CUBICA](https://quizverses.github.io/cubica.html)
- [EMERGENCY JAM](https://studyquests.github.io/emergency-jam.html)
- [MOTO CABBIE SIMULATOR](https://studyquests.github.io/moto-cabbie-simulator.html)
- [CATEGORY PUZZLE 9](https://quizverses.github.io/category-puzzle-9.html)
- [EAT DONUTS](https://studyplaying.github.io/eat-donuts.html)
- [CUBE IN CUBE](https://studyplaying.github.io/cube-in-cube.html)
- [RUN FROM BABA YAGA](https://studyplaying.github.io/run-from-baba-yaga.html)
- [ANIMALS MERGE](https://studyplaying.github.io/animals-merge.html)
- [CATEGORY DRESS UP GAMES](https://thelearnquesters.pages.dev/category-dress-up-games.html)
- [HEXA TAP AWAY](https://learnquester.pages.dev/hexa-tap-away.html)
- [NUMBER MERGE 10](https://learnquester.pages.dev/number-merge-10.html)
- [ASMR WASHING FIXING](https://quizverses.github.io/asmr-washing-fixing.html)
- [CRICKET CLASH PONG](https://studyquests.github.io/cricket-clash-pong.html)
- [ESCAPE OR DIE TROLL DEVIL LEVELS](https://studyplaying.github.io/escape-or-die-troll-devil-levels.html)
- [GROW A GARDEN ONLINE OFFLINE](https://studyplaying.github.io/grow-a-garden-online-offline.html)
- [HOOP RIVALS](https://quizverses.pages.dev/hoop-rivals.html)
- [BLOCK BLAST JEWEL PUZZLE](https://studyplaying.github.io/block-blast-jewel-puzzle.html)
- [FLAMES FORTUNE](https://learnquester.pages.dev/flames-fortune.html)
- [ZOMBIES AND GUNS](https://studyplaying.github.io/zombies-and-guns.html)
- [CHICKEN BANANA RUN](https://studyquesthub.web.app/chicken-banana-run.html)
- [GET READY WITH ME CONCERT DAY](https://studyquests.github.io/get-ready-with-me-concert-day.html)
- [HOUSE ROBBER](https://studyquests.github.io/house-robber.html)
- [8 BALL POOL BILLIARDS MULTIPLAYER](https://studyquests.github.io/8-ball-pool-billiards-multiplayer.html)
- [CATEGORY CASUAL](https://studyquests.github.io/category-casual.html)
- [NUBIK CREATE YOUR PLACE](https://studyplaying.github.io/nubik-create-your-place.html)
- [PUZZLE BLOCKS](https://studyplaying.github.io/puzzle-blocks.html)
- [CHRISTMAS MERGE](https://learnquester.pages.dev/christmas-merge.html)
- [PLAYGROUND PARKOUR](https://studyquesthub.web.app/playground-parkour.html)
- [MONONINJA](https://learnquester.pages.dev/mononinja.html)
- [CATEGORY MAHJONG 2](https://studyplayings.web.app/category-mahjong-2.html)
- [CATEGORY MAHJONG 2](https://thelearnquesters.pages.dev/category-mahjong-2.html)
- [POLITON](https://learnquester.pages.dev/politon.html)
- [TILE HEX WORLD RED VS BLUE](https://studyquesthub.web.app/tile-hex-world-red-vs-blue.html)
- [CATEGORY SURVIVAL365](https://quizverses-9d2f2.web.app/category-survival365.html)
- [CATEGORY BASKETBALL 2](https://studyquests.github.io/category-basketball-2.html)
- [SWAT FORCE VS TERRORISTS](https://learnquester.pages.dev/swat-force-vs-terrorists.html)
- [GROW A GARDEN 3D](https://studyplayings.web.app/grow-a-garden-3d.html)
- [MALL ANOMALY](https://studyquesthub.web.app/mall-anomaly.html)
- [PULL THE THREAD PUZZLE](https://studyplaying.github.io/pull-the-thread-puzzle.html)
- [POXEL IO](https://studyplayings.web.app/poxel-io.html)
- [REAL PARKOUR SIMULATOR](https://studyquesthub.web.app/real-parkour-simulator.html)
- [HAPPY FARM THE CROP](https://quizverses.github.io/happy-farm-the-crop.html)
- [INDEX36](https://studyquests.github.io/index36.html)
- [CATEGORY MINECRAFT81](https://thelearnquesters.pages.dev/category-minecraft81.html)
- [SORTING SORCERY](https://studyquests.github.io/sorting-sorcery.html)
- [MINI GRAND THEFT CITY](https://studyplayings.web.app/mini-grand-theft-city.html)
- [CLINIC CLEANUP CREW](https://learnquester.pages.dev/clinic-cleanup-crew.html)
- [FLOAT FOR BRAINROTS](https://studyquests.github.io/float-for-brainrots.html)
- [CATEGORY CASUAL 5](https://learnquester.pages.dev/category-casual-5.html)
- [BURGER EMPIRE](https://studyquesthub.web.app/burger-empire.html)
- [CATEGORY HORROR](https://quizverses-9d2f2.web.app/category-horror.html)
- [NSR STREET CAR RACING](https://studyquests.github.io/nsr-street-car-racing.html)
- [CATEGORY FREE](https://quizverses-9d2f2.web.app/category-free.html)
- [ARMY TRUCK DRIVER ONLINE](https://studyplaying.github.io/army-truck-driver-online.html)
- [CATEGORY AGILITY](https://studyquests.github.io/category-agility.html)
- [CATEGORY CARTOON76](https://quizverses.github.io/category-cartoon76.html)
- [SPOTDIFFERS](https://studyplayings.web.app/spotdiffers.html)
- [JEWEL COLORING](https://learnquesters.pages.dev/jewel-coloring.html)
- [FUTURE WAR BOT BATTLE IN SPACE 3D](https://studyquests.github.io/future-war-bot-battle-in-space-3d.html)
- [EUROPE AT WAR](https://studyplayings.web.app/europe-at-war.html)
- [DIAMOND MOSAIC](https://studyplayings.web.app/diamond-mosaic.html)
- [JELLY MATH 3D](https://studyquests.github.io/jelly-math-3d.html)
- [PANDA ADVENTURE](https://studyquests.github.io/panda-adventure.html)
- [CATEGORY AGILITY 2](https://studyquests.github.io/category-agility-2.html)
- [FASHION CHALLENGE CATWALK RUN](https://learnquesters.pages.dev/fashion-challenge-catwalk-run.html)
- [CATEGORY DESTROY256](https://studyplayings.pages.dev/category-destroy256.html)
- [SUPER FOOTBALL FEVER](https://studyquests.github.io/super-football-fever.html)
- [COLOR MIX JELLY MERGE](https://studyquests.github.io/color-mix-jelly-merge.html)
- [CATEGORY BALL175](https://studyplayings.web.app/category-ball175.html)
- [SHELF SHIFT MATCH](https://quizverses.github.io/shelf-shift-match.html)
- [CATEGORY COLLECT565](https://studyquests.github.io/category-collect565.html)
- [FRUIT CAFE MATCH 3](https://quizverses.github.io/fruit-cafe-match-3.html)
- [ZUMBA STORY](https://quizverses.github.io/zumba-story.html)
- [CATEGORY CASUAL 4](https://studyquests.github.io/category-casual-4.html)
