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
- [MINI GAMES RELAX COLLECTION 2](https://themindskillplayplay.pages.dev/mini-games-relax-collection-2.html)
- [NINJA DASH COZY TACTIC PUZZLE](https://studyquests.pages.dev/ninja-dash-cozy-tactic-puzzle.html)
- [SOLITAIRE SUMMER KLONDIKE](https://studyquests.github.io/solitaire-summer-klondike.html)
- [SAVAGE DEFENDERS](https://studyplaying.github.io/savage-defenders.html)
- [CHILDREN HAPPY FARM DUDU](https://studyquests.github.io/children-happy-farm-dudu.html)
- [STICKMAN TEAM DETROIT](https://studyquests.github.io/stickman-team-detroit.html)
- [TILEMAN IO](https://studyquests.github.io/tileman-io.html)
- [CONTACT](https://thelearnquester.web.app/contact.html)
- [MIND GAMBIT](https://thelearnquesters.pages.dev/mind-gambit.html)
- [AUTUMN GLAM GALA](https://thelearnquesters.pages.dev/autumn-glam-gala.html)
- [HEXA SORT TRICK OR TREAT](https://thelearnquesters.pages.dev/hexa-sort-trick-or-treat.html)
- [WATERMELON MERGE](https://studyquests.github.io/watermelon-merge.html)
- [HERO TRANSFORM RUN](https://thelearnquesters.pages.dev/hero-transform-run.html)
- [ASMR WASHING FIXING](https://studyquests.github.io/asmr-washing-fixing.html)
- [BUBBLE AROUND](https://studyquesthub.web.app/bubble-around.html)
- [BEARS VS ART](https://studyplaying.github.io/bears-vs-art.html)
- [HERO FIGHT CLASH](https://thelearnquesters.pages.dev/hero-fight-clash.html)
- [FOOTBALL HEADS 2025](https://studyquesthub.web.app/football-heads-2025.html)
- [CRYPTO GALS TIKTOK FASHION](https://studyplayings.pages.dev/crypto-gals-tiktok-fashion.html)
- [CATEGORY CASUAL 8](https://studyquests.pages.dev/category-casual-8.html)
- [CATEGORY TOP DOWN251](https://studyplaying.github.io/category-top-down251.html)
- [FOREST TILES](https://studyquests.github.io/forest-tiles.html)
- [CRUSH THE EGGS](https://learnquester.github.io/crush-the-eggs.html)
- [PRACTICE ON ME](https://studyquests.github.io/practice-on-me.html)
- [MOTO CABBIE SIMULATOR](https://studyquests.github.io/moto-cabbie-simulator.html)
- [ROYAL BUBBLE BLAST](https://studyquesthub.web.app/royal-bubble-blast.html)
- [WATERPARK SORT](https://studyquesthub.web.app/waterpark-sort.html)
- [CATEGORY MAHJONG CONNECT](https://studyquests.pages.dev/category-mahjong-connect.html)
- [CAP](https://learnquester.github.io/cap.html)
- [DOGGI](https://studyquesthub.web.app/doggi.html)
- [SORCERER MAHJONG MARVELS](https://thelearnquesters.pages.dev/sorcerer-mahjong-marvels.html)
- [MAGIC TOWERS SOLITAIRE](https://thelearnquesters.pages.dev/magic-towers-solitaire.html)
- [CATEGORY MATCH 3](https://studyplaying.github.io/category-match-3.html)
- [KITTY MATCH 3 PUZZLE GAME](https://studyquests.github.io/kitty-match-3-puzzle-game.html)
- [GLACIER RUSH](https://studyquests.github.io/glacier-rush.html)
- [CATEGORY BLOCK94](https://learnquester.pages.dev/category-block94.html)
- [FOXY ECO SORT](https://studyplaying.github.io/foxy-eco-sort.html)
- [CATEGORY PUZZLE 6](https://thelearnquester.web.app/category-puzzle-6.html)
- [FEED ME MONSTERS IDLE BATTLE](https://thelearnquester.web.app/feed-me-monsters-idle-battle.html)
- [CAR SIMULATOR 3D CAR GAME 3D](https://studyplaying.github.io/car-simulator-3d-car-game-3d.html)
- [POWER LIGHT](https://learnquesters.pages.dev/power-light.html)
- [CATEGORY PUZZLE 2](https://studyquesthub.web.app/category-puzzle-2.html)
- [CATEGORY QUIZ40](https://studyplaying.github.io/category-quiz40.html)
- [100 HIDDEN CAPYBARAS](https://studyquesthub.web.app/100-hidden-capybaras.html)
- [TOYTOPIA](https://studyplaying.github.io/toytopia.html)
- [SWIPETOWN](https://studyquesthub.web.app/swipetown.html)
- [FAMILY TREE PUZZLE](https://studyquests.github.io/family-tree-puzzle.html)
- [CUT THE ROPE TIME TRAVEL](https://learnquester.github.io/cut-the-rope-time-travel.html)
- [VEGAMIX2 WILD WEST](https://studyquests.github.io/vegamix2-wild-west.html)
- [PICTURES RIDDLE](https://thelearnquesters.pages.dev/pictures-riddle.html)
- [CHAIN PUZZLE](https://learnquester.github.io/chain-puzzle.html)
- [CATEGORY CASUAL 2](https://studyquesthub.web.app/category-casual-2.html)
- [ARROW SURVIVAL 15 SECONDS](https://studyquests.github.io/arrow-survival-15-seconds.html)
- [SUPER MX MOTOCROSS SIMULATOR](https://thelearnquesters.pages.dev/super-mx-motocross-simulator.html)
- [BONNIE FITNESS FRENZY](https://studyquests.github.io/bonnie-fitness-frenzy.html)
- [HAPPY BUBBLES](https://thelearnquester.web.app/happy-bubbles.html)
- [CATEGORY SOLITAIRE](https://studyplaying.github.io/category-solitaire.html)
- [CATEGORY PUZZLE 10](https://studyplaying.github.io/category-puzzle-10.html)
- [QUACKVENTURE](https://studyquesthub.web.app/quackventure.html)
- [HEXA TILE MASTER](https://thelearnquester.web.app/hexa-tile-master.html)
- [RIDDLEMATH](https://learnquester.pages.dev/riddlemath.html)
- [CARS MERGE](https://learnquester.pages.dev/cars-merge.html)
- [BARRY PRISON CHRISTMAS ADVENTURE](https://studyplaying.github.io/barry-prison-christmas-adventure.html)
- [CATEGORY MISSION207](https://thelearnquesters.pages.dev/category-mission207.html)
- [CATEGORY SOCCER 2](https://learnquester.pages.dev/category-soccer-2.html)
- [INDEX6](https://learnquester.github.io/index6.html)
- [BLOCK MERGE CITY](https://studyquesthub.web.app/block-merge-city.html)
- [PARADISE JOURNEY MATCH3](https://studyquests.github.io/paradise-journey-match3.html)
- [DELICIOUS EMILYS NEW BEGINNING VALENTINES EDITION](https://thelearnquester.web.app/delicious-emilys-new-beginning-valentines-edition.html)
- [MAX SPEED](https://studyplayings.pages.dev/max-speed.html)
- [CATEGORY 2D1 060](https://studyquesthub.web.app/category-2d1-060.html)
- [VENETIAN LOVE AFFAIR](https://studyplayings.pages.dev/venetian-love-affair.html)
- [MUSKETEERS GUNPOWDER VS STEEL](https://studyquests.github.io/musketeers-gunpowder-vs-steel.html)
- [POTION MERGE WITCH](https://studyplaying.github.io/potion-merge-witch.html)
- [CATEGORY CONTROLLER](https://studyquesthub.web.app/category-controller.html)
- [COLOR IT IN 3D](https://studyplaying.github.io/color-it-in-3d.html)
- [CATEGORY FREE RAGDOLL GAMES](https://thelearnquesters.pages.dev/category-free-ragdoll-games.html)
- [MAHJONG SORT PUZZLE](https://thelearnquester.web.app/mahjong-sort-puzzle.html)
- [TOPSY TURVY](https://learnquester.github.io/topsy-turvy.html)
- [CUBE STACK 2048](https://thelearnquesters.pages.dev/cube-stack-2048.html)
- [CUBE SPEED DASH](https://learnquester.pages.dev/cube-speed-dash.html)
- [LINK FLOW](https://thelearnquester.web.app/link-flow.html)
- [CATEGORY FPS175](https://thelearnquesters.pages.dev/category-fps175.html)
- [RAGDOLL PARKOUR SIMULATOR](https://learnquester.github.io/ragdoll-parkour-simulator.html)
- [10K](https://studyquests.github.io/10k.html)
- [LIGHT LINE](https://learnquester.pages.dev/light-line.html)
- [CATEGORY PLATFORM](https://studyquests.pages.dev/category-platform.html)
- [AVATAR MASTER FIX UP FACE](https://studyquests.github.io/avatar-master-fix-up-face.html)
- [DAILY JEWELS BLITZ MAHJONG](https://studyplaying.github.io/daily-jewels-blitz-mahjong.html)
- [CATEGORY MINECRAFT 2](https://thelearnquesters.pages.dev/category-minecraft-2.html)
- [SKIBIDI TOILET VS CAMERAMAN SNIPER GAME](https://learnquester.pages.dev/skibidi-toilet-vs-cameraman-sniper-game.html)
- [BUBBITS](https://studyquests.pages.dev/bubbits.html)
- [CATEGORY INCREMENTAL388](https://learnquester.pages.dev/category-incremental388.html)
- [SLIDE BLOCK PUZZLE](https://studyquesthub.web.app/slide-block-puzzle.html)
- [CATEGORY PUZZLE 6](https://studyplaying.github.io/category-puzzle-6.html)
- [SAND BLAST BLOCK GAME](https://learnquester.github.io/sand-blast-block-game.html)
- [FESTIVAL VIBES MAKEUP](https://learnquester.pages.dev/festival-vibes-makeup.html)
- [CATEGORY FLASH](https://studyplayings.pages.dev/category-flash.html)
- [CATEGORY CASUAL 6](https://studyquests.pages.dev/category-casual-6.html)
- [MAGIC KINGDOM HEX MATCH](https://studyquests.github.io/magic-kingdom-hex-match.html)
- [CATEGORY SANDBOX41](https://studyplayings.web.app/category-sandbox41.html)
- [MOUNTAIN BUS DRIVER](https://thelearnquesters.pages.dev/mountain-bus-driver.html)
- [ROBBIE BECOME A BEAST](https://studyquesthub.web.app/robbie-become-a-beast.html)
- [CATEGORY LOVE12](https://thelearnquester.web.app/category-love12.html)
- [GOD OF LIGHT](https://learnquester.pages.dev/god-of-light.html)
- [CATEGORY IDLE445](https://thelearnquesters.pages.dev/category-idle445.html)
- [CATEGORY AVOID295](https://learnquester.pages.dev/category-avoid295.html)
- [CATEGORY FIGHTING124](https://studyquesthub.web.app/category-fighting124.html)
- [AMMO RUSH MASTER](https://studyplaying.github.io/ammo-rush-master.html)
- [CATEGORY HORROR 2](https://thelearnquester.web.app/category-horror-2.html)
- [HEXA SORT TRICK OR TREAT](https://studyquesthub.web.app/hexa-sort-trick-or-treat.html)
- [SOCCER TOURNAMENT](https://themindzone.pages.dev/soccer-tournament.html)
- [LOVE TILE TRIO](https://studyquesthub.web.app/love-tile-trio.html)
- [CATEGORY ARENA255](https://themindplay.pages.dev/category-arena255.html)
- [POOL DUEL](https://learnquester.pages.dev/pool-duel.html)
- [CATEGORY ROGUELIKE GAMES](https://studyquests.pages.dev/category-roguelike-games.html)
- [TICTOC BRAIDED HAIRSTYLES](https://theskillquest.pages.dev/tictoc-braided-hairstyles.html)
- [FISH LOVE PINS](https://themindzone.pages.dev/fish-love-pins.html)
- [KRAKAX COM](https://themindzone.pages.dev/krakax-com.html)
- [INDEX16](https://learnquester.pages.dev/index16.html)
- [COLORWARSIO CONQUEST GAME](https://thequizzone.pages.dev/colorwarsio-conquest-game.html)
- [HIDE MOODENG HIPPO](https://thequizzone.pages.dev/hide-moodeng-hippo.html)
- [BOOM STICK BAZOOKA](https://thequizzone.pages.dev/boom-stick-bazooka.html)
- [WOOD HEXA FACTORY](https://studyplayings.pages.dev/wood-hexa-factory.html)
- [PIRATE ISLAND](https://thequizzone.pages.dev/pirate-island.html)
- [JIXORA JIGSAW SOLITAIRE PUZZLE](https://studyquests.pages.dev/jixora-jigsaw-solitaire-puzzle.html)
- [THREAD SORT](https://themindzone.pages.dev/thread-sort.html)
- [DATA DIGGERS](https://thequizzone.pages.dev/data-diggers.html)
- [WORMSARENAIO](https://studyquests.github.io/wormsarenaio.html)
- [THE KULKA](https://thelearnquester.web.app/the-kulka.html)
