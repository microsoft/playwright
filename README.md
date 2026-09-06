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
- [TRICKY ARROW 2](https://studyplayings.pages.dev/tricky-arrow-2.html)
- [CATEGORY DIRT BIKE](https://studyquests.pages.dev/category-dirt-bike.html)
- [INDEX27](https://quizverses.github.io/index27.html)
- [CATEGORY BLOCK94](https://studyplaying.github.io/category-block94.html)
- [CATEGORY OBBY](https://thelearnquesters.pages.dev/category-obby.html)
- [BUBBLE SHOOTER REMASTERED](https://quizverses-9d2f2.web.app/bubble-shooter-remastered.html)
- [CATEGORY IBOSS](https://studyplaying.github.io/category-iboss.html)
- [CATEGORY ROBOT49](https://quizverses.github.io/category-robot49.html)
- [CATEGORY SNAKE GAMES](https://quizverses.github.io/category-snake-games.html)
- [SUPERMARKET CASHIER SIMULATOR](https://studyquests.pages.dev/supermarket-cashier-simulator.html)
- [REAL MOTORBIKE SIMULATOR RACE 3D](https://quizverses-9d2f2.web.app/real-motorbike-simulator-race-3d.html)
- [IS IT RIGHT](https://quizverses.pages.dev/is-it-right.html)
- [INDEX14](https://quizverses-9d2f2.web.app/index14.html)
- [ASMR WASHING FIXING](https://quizverses.github.io/asmr-washing-fixing.html)
- [INDEX2](https://studyplaying.github.io/index2.html)
- [CATEGORY ADVENTURE](https://studyquests.pages.dev/category-adventure.html)
- [BUBBLE SHOOTER VINTAGE](https://studyquesthub.web.app/bubble-shooter-vintage.html)
- [CATEGORY BIKE](https://studyquests.pages.dev/category-bike.html)
- [MATE IN CHESS](https://studyquests.github.io/mate-in-chess.html)
- [CATEGORY BUILDING](https://studyplaying.github.io/category-building.html)
- [CATEGORY AGILITY 2](https://studyplaying.github.io/category-agility-2.html)
- [INDEX18](https://studyquests.pages.dev/index18.html)
- [SQUID GAME HUNTER](https://quizverses.pages.dev/squid-game-hunter.html)
- [BOBB S WORLD](https://studyquests.pages.dev/bobb-s-world.html)
- [AMERICAN BLOCK SNIPER ONLINE](https://studyquests.github.io/american-block-sniper-online.html)
- [GLOVES GROW RUSH](https://studyquests.github.io/gloves-grow-rush.html)
- [DRAW TO FLY](https://quizverses.github.io/draw-to-fly.html)
- [WORMS ZONE](https://quizverses.pages.dev/worms-zone.html)
- [3D CHESS MASTER](https://studyquests.pages.dev/3d-chess-master.html)
- [MONSTER MERGE LEGENDS ALIVE](https://studyquests.pages.dev/monster-merge-legends-alive.html)
- [CATEGORY 1 PLAYER139](https://studyquests.github.io/category-1-player139.html)
- [RENT OUT LANDLORD TYCOON](https://quizverses-9d2f2.web.app/rent-out-landlord-tycoon.html)
- [RESTAURANT VIP MASTERCHEF](https://studyquests.pages.dev/restaurant-vip-masterchef.html)
- [CATEGORY GUN238](https://studyplaying.github.io/category-gun238.html)
- [CATEGORY 2D1 175](https://studyquests.pages.dev/category-2d1-175.html)
- [CATEGORY ADVENTURE 3](https://studyquests.pages.dev/category-adventure-3.html)
- [LABUBU COLORING ADVENTURE](https://quizverses.pages.dev/labubu-coloring-adventure.html)
- [MERGE FLOW](https://quizverses-9d2f2.web.app/merge-flow.html)
- [LAST STANDING](https://studyquesthub.web.app/last-standing.html)
- [MK48 IO](https://studyquests.pages.dev/mk48-io.html)
- [INDEX20](https://quizverses.github.io/index20.html)
- [TRACESOCCER UBC](https://studyquesthub.web.app/tracesoccer-ubc.html)
- [CRAZY AXE](https://studyquesthub.web.app/crazy-axe.html)
- [SNIPER VS SNIPER](https://studyplaying.github.io/sniper-vs-sniper.html)
- [RED STICKMAN VS CRAFTMANS](https://studyquesthub.web.app/red-stickman-vs-craftmans.html)
- [DRIVE AHEAD SPORTS](https://studyplaying.github.io/drive-ahead-sports.html)
- [PIN MASTER](https://studyquests.pages.dev/pin-master.html)
- [TAIL GUN CHARLIE](https://studyplaying.github.io/tail-gun-charlie.html)
- [INDEX5](https://studyplaying.github.io/index5.html)
- [XYTRIAN RUNNER](https://studyquests.github.io/xytrian-runner.html)
- [SORT WORKS NUTS ORDER](https://studyplaying.github.io/sort-works-nuts-order.html)
- [IDLE AIRPORT CEO](https://quizverses-9d2f2.web.app/idle-airport-ceo.html)
- [CATEGORY BIKE 2](https://studyquests.github.io/category-bike-2.html)
- [MAHJONG MASTERS](https://studyplaying.github.io/mahjong-masters.html)
- [PULL THE PINS](https://quizverses.pages.dev/pull-the-pins.html)
- [ESCAPE ANCIENT EGYPT](https://studyplaying.github.io/escape-ancient-egypt.html)
- [SLICER DUO](https://studyplaying.github.io/slicer-duo.html)
- [KAWAII CLAW MERGE](https://studyplaying.github.io/kawaii-claw-merge.html)
- [CATEGORY ANIMAL216](https://studyquests.github.io/category-animal216.html)
- [CRAZY GOOSE SIMULATOR](https://studyquesthub.web.app/crazy-goose-simulator.html)
- [HEXANAUT IO](https://studyquests.pages.dev/hexanaut-io.html)
- [CATEGORY LOGIC538](https://quizverses-9d2f2.web.app/category-logic538.html)
- [CATEGORY ARMY40](https://studyplaying.github.io/category-army40.html)
- [WIRED CHICKEN INC](https://quizverses.pages.dev/wired-chicken-inc.html)
- [COP RUN 3D](https://quizverses.pages.dev/cop-run-3d.html)
- [BLOCK PIXELS](https://studyquests.pages.dev/block-pixels.html)
- [DINOSAUR CARDS](https://studyquesthub.web.app/dinosaur-cards.html)
- [WITCHY SISTERS RELAX PUZZLE](https://studyquests.pages.dev/witchy-sisters-relax-puzzle.html)
- [ITALIAN ANIMALS CREATE YOUR OWN BRAINROT](https://studyquests.github.io/italian-animals-create-your-own-brainrot.html)
- [CATEGORY THINKY 2](https://studyquests.github.io/category-thinky-2.html)
- [UNLOCK THE BOLTS](https://studyplaying.github.io/unlock-the-bolts.html)
- [MERGE 2048 CAKE](https://studyplaying.github.io/merge-2048-cake.html)
- [CITY BIKE RACING CHAMPION](https://quizverses-9d2f2.web.app/city-bike-racing-champion.html)
- [OM NOM RUN](https://studyplaying.github.io/om-nom-run.html)
- [AMMO RUSH MASTER](https://studyplaying.github.io/ammo-rush-master.html)
- [POPS QUEST](https://studyplaying.github.io/pops-quest.html)
- [SITEMAP](https://brainquests.netlify.app/sitemap.html)
- [CHRISTMAS SNOWBALL ARENA](https://quizverses.pages.dev/christmas-snowball-arena.html)
- [KNIFE UP 3D](https://studyquests.github.io/knife-up-3d.html)
- [ARCHER DUNGEON HERO](https://studyplaying.github.io/archer-dungeon-hero.html)
- [CATEGORY BUILDING182](https://studyplayings.web.app/category-building182.html)
- [VARIETY MECHA](https://studyplaying.github.io/variety-mecha.html)
- [OBBY GYM SIMULATOR ESCAPE](https://studyquesthub.web.app/obby-gym-simulator-escape.html)
- [CYBERPUNK CITY FASHION](https://studyquests.pages.dev/cyberpunk-city-fashion.html)
- [BOOM STICK BAZOOKA](https://studyplaying.github.io/boom-stick-bazooka.html)
- [CATEGORY JIGSAW](https://quizverses-9d2f2.web.app/category-jigsaw.html)
- [SORT WORKS NUTS ORDER](https://quizverses.github.io/sort-works-nuts-order.html)
- [TRIPEAKS SOLITAIRE ESCAPES](https://studyquests.pages.dev/tripeaks-solitaire-escapes.html)
- [CATEGORY CASUAL 8](https://studyplaying.github.io/category-casual-8.html)
- [TILE MATCH CAFE](https://studyplaying.github.io/tile-match-cafe.html)
- [BRAINROT BOING BOING MERGE](https://studyquests.github.io/brainrot-boing-boing-merge.html)
- [SEA MONSTERS MAHJONG](https://studyplaying.github.io/sea-monsters-mahjong.html)
- [HEXON RUSH](https://studyquests.github.io/hexon-rush.html)
- [CATEGORY CONTROLLER](https://studyquests.pages.dev/category-controller.html)
- [HIGH SPEED CRAZY BIKE](https://studyplaying.github.io/high-speed-crazy-bike.html)
- [MANYUNYA SAVING THE PRINCESS](https://quizverses.github.io/manyunya-saving-the-princess.html)
- [BASE JUMP WINGSUIT FLYING](https://studyquests.pages.dev/base-jump-wingsuit-flying.html)
- [CATEGORY COLOR197](https://studyquests.github.io/category-color197.html)
- [DRIVER MASTER SIMULATOR](https://quizverses.github.io/driver-master-simulator.html)
- [SCREW JAM FUN PUZZLE GAME](https://quizverses.pages.dev/screw-jam-fun-puzzle-game.html)
- [COLORSFORMS](https://studyplaying.github.io/colorsforms.html)
- [CUTE SHEEP SKYBLOCK](https://quizverses.github.io/cute-sheep-skyblock.html)
- [MARBLE BLAST](https://studyquests.github.io/marble-blast.html)
- [MR DISC SLINGSHOT STRIKE](https://studyplaying.github.io/mr-disc-slingshot-strike.html)
- [CATEGORY FLASH 2](https://studyquests.github.io/category-flash-2.html)
- [OBBY PRISON RUN](https://studyquests.github.io/obby-prison-run.html)
- [CATEGORY SPACE57](https://quizverses-9d2f2.web.app/category-space57.html)
- [CATEGORY FPS174](https://studyquests.github.io/category-fps174.html)
- [AIRPORT SECURITY](https://studyplaying.github.io/airport-security.html)
- [CANDY RIDDLES](https://studyquests.github.io/candy-riddles.html)
- [CATEGORY TOP DOWN251](https://studyplaying.github.io/category-top-down251.html)
- [ABOUT A FROG](https://studyplaying.github.io/about-a-frog.html)
- [CATEGORY STRATEGY 2](https://quizverses.github.io/category-strategy-2.html)
- [CATEGORY BATTLE 2](https://studyquesthub.web.app/category-battle-2.html)
- [STUDENT AND TEACHER](https://studyquests.pages.dev/student-and-teacher.html)
- [ANIMAL TRANSFORM RACE](https://quizverses.pages.dev/animal-transform-race.html)
- [COINS](https://studyquests.pages.dev/coins.html)
- [HAMSTERCYCLE](https://studyplaying.github.io/hamstercycle.html)
- [INDEX6](https://studyquests.pages.dev/index6.html)
- [I8 CITY DRIVER](https://quizverses-9d2f2.web.app/i8-city-driver.html)
- [CHAIN CUBE 2048 3D MERGE GAME](https://studyplaying.github.io/chain-cube-2048-3d-merge-game.html)
- [SINGLE STROKE ENERGY LINE PUZZLE](https://studyquests.pages.dev/single-stroke-energy-line-puzzle.html)
- [TRAVEL WITH ME ASMR EDITION](https://quizverses.github.io/travel-with-me-asmr-edition.html)
- [STICK TACTICS DESTRUCTION](https://quizverses.github.io/stick-tactics-destruction.html)
- [CATEGORY FOOD](https://quizverses.pages.dev/category-food.html)
- [AQUA SORT WATER COLOR PUZZLE](https://quizverses-9d2f2.web.app/aqua-sort-water-color-puzzle.html)
- [TERMS](https://brainquests.pages.dev/terms.html)
- [CLASSIC LABYRINTH 3D MAZE](https://quizverses.github.io/classic-labyrinth-3d-maze.html)
- [PET CONNECT MATCH](https://studyplaying.github.io/pet-connect-match.html)
- [BLOCK CUT CLEANER](https://quizverses.github.io/block-cut-cleaner.html)
