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
- [LOVE TILE TRIO](https://quizverses.github.io/love-tile-trio.html)
- [SHELTER SECURITY GATEKEEPER SIMULATOR](https://themindzone.pages.dev/shelter-security-gatekeeper-simulator.html)
- [MATCHING PUZZLE](https://learnquesters.pages.dev/matching-puzzle.html)
- [CUBES 2048IO](https://learnquesters.pages.dev/cubes-2048io.html)
- [INDEX40](https://thelearnquesters.pages.dev/index40.html)
- [STEAL BRAINROT ORIGINAL 3D](https://theskillquest.pages.dev/steal-brainrot-original-3d.html)
- [CHARGER CITY DRIVER](https://theskillquest.pages.dev/charger-city-driver.html)
- [VEGA MIX SEA ADVENTURES](https://themindplay.pages.dev/vega-mix-sea-adventures.html)
- [CAT ESCAPE HIDE AND SEEK](https://theskillquest.pages.dev/cat-escape-hide-and-seek.html)
- [CATEGORY BOXING12](https://iskillquest.pages.dev/category-boxing12.html)
- [CATEGORY TOP DOWN251](https://iskillquest.pages.dev/category-top-down251.html)
- [FUN TOWN PARKING](https://iskillquest.pages.dev/fun-town-parking.html)
- [DRAW WEAPON FIGHT PARTY](https://iskillquest.pages.dev/draw-weapon-fight-party.html)
- [CATEGORY IO](https://iskillquest.pages.dev/category-io.html)
- [CATEGORY UNBLOCKED GAMES](https://iskillquest.pages.dev/category-unblocked-games.html)
- [CATEGORY ART](https://iskillquest.pages.dev/category-art.html)
- [FRUIT JAM](https://theskillquest.pages.dev/fruit-jam.html)
- [OFF ROAD OVERDRIVE](https://theskillquest.pages.dev/off-road-overdrive.html)
- [LUNAAR ORG](https://theskillquest.pages.dev/lunaar-org.html)
- [CATEGORY CASUAL 11](https://iskillquest.pages.dev/category-casual-11.html)
- [CATEGORY DEFENSE](https://iskillquest.pages.dev/category-defense.html)
- [CATEGORY SPOT THE DIFFERENCE](https://iskillquest.pages.dev/category-spot-the-difference.html)
- [ZEN SOLITAIRE](https://theskillquest.pages.dev/zen-solitaire.html)
- [CATEGORY DRESS UP](https://iskillquest.pages.dev/category-dress-up.html)
- [INDEX36](https://iskillquest.pages.dev/index36.html)
- [HOME MATCH TILE MASTER](https://theskillquest.pages.dev/home-match-tile-master.html)
- [REMOVE THE BLOCKS](https://theskillquest.pages.dev/remove-the-blocks.html)
- [CITY BANANA MAN AGENT](https://theskillquest.pages.dev/city-banana-man-agent.html)
- [MERGE 3D MATCH 3 BALLOONS](https://theskillquest.pages.dev/merge-3d-match-3-balloons.html)
- [TARCAT](https://theskillquest.pages.dev/tarcat.html)
- [BARBIECORE AESTHETICS](https://theskillquest.pages.dev/barbiecore-aesthetics.html)
- [BALL BUNKER SNEAKY STACKS](https://theskillquest.pages.dev/ball-bunker-sneaky-stacks.html)
- [CATEGORY CASUAL 6](https://iskillquest.pages.dev/category-casual-6.html)
- [SHINE SEEK](https://theskillquest.pages.dev/shine-seek.html)
- [THE HARDEST PUZZLE EVER](https://theskillquest.pages.dev/the-hardest-puzzle-ever.html)
- [TWINKLE SHOOTER](https://iskillquest.pages.dev/twinkle-shooter.html)
- [HOME PIN 2](https://iskillquest.pages.dev/home-pin-2.html)
- [CATEGORY RAGDOLL57](https://iskillquest.pages.dev/category-ragdoll57.html)
- [BUBBLE SHOOTER NEON](https://theskillquest.pages.dev/bubble-shooter-neon.html)
- [CUBE SPEED DASH](https://iskillquest.pages.dev/cube-speed-dash.html)
- [LABUBU ADVENTURE](https://theskillquest.pages.dev/labubu-adventure.html)
- [TIMEWALKER SURVIVE](https://iskillquest.pages.dev/timewalker-survive.html)
- [PERFECT TIDY](https://theskillquest.pages.dev/perfect-tidy.html)
- [SUDOKU CLASSIC DAILY BRAIN PUZZLE](https://iskillquest.pages.dev/sudoku-classic-daily-brain-puzzle.html)
- [STEALTH MASTER SNEAK CAT](https://theskillquest.pages.dev/stealth-master-sneak-cat.html)
- [EVERMATCH](https://theskillquest.pages.dev/evermatch.html)
- [CATEGORY ART32](https://themindplay.github.io/category-art32.html)
- [PAPER DOLL DIARY CHIBI DOLLS](https://iskillquest.pages.dev/paper-doll-diary-chibi-dolls.html)
- [CATEGORY HORROR 3](https://iskillquest.pages.dev/category-horror-3.html)
- [WATER SORT](https://iskillquest.pages.dev/water-sort.html)
- [HORROR FOREST BEAR](https://theskillquest.pages.dev/horror-forest-bear.html)
- [MATCH MASTER](https://themindplay.github.io/match-master.html)
- [TAG RUN](https://theskillquest.pages.dev/tag-run.html)
- [FARM BUSINESS SAGA](https://themindplay.github.io/farm-business-saga.html)
- [BEGGAR CLICKER](https://theskillquest.pages.dev/beggar-clicker.html)
- [ROYAL PIN](https://iskillquest.pages.dev/royal-pin.html)
- [INDEX35](https://iskillquest.pages.dev/index35.html)
- [FOREST GLADE MYSTERIES](https://iskillquest.pages.dev/forest-glade-mysteries.html)
- [NUTS BOLTS PUZZLE](https://iskillquest.pages.dev/nuts-bolts-puzzle.html)
- [INDEX42](https://iskillquest.pages.dev/index42.html)
- [SPRUNKI 3D SHOOTER](https://theskillquest.pages.dev/sprunki-3d-shooter.html)
- [HUNTER UNDERWATER SPEARFISHING](https://iskillquest.pages.dev/hunter-underwater-spearfishing.html)
- [ULTIMATE YATZY](https://themindplay.github.io/ultimate-yatzy.html)
- [BUBBLE SHOOTER POP](https://themindplay.github.io/bubble-shooter-pop.html)
- [TERMS](https://iskillquest.pages.dev/terms.html)
- [CATEGORY MAHJONG 2](https://iskillquest.pages.dev/category-mahjong-2.html)
- [SUDOKU RELAX](https://theskillquest.pages.dev/sudoku-relax.html)
- [HEROES OF THE ARENA](https://themindzone.pages.dev/heroes-of-the-arena.html)
- [ASMR BEAUTY SUPERSTAR](https://themindzone.pages.dev/asmr-beauty-superstar.html)
- [STICKER BOOK PUZZLE COLOR BY NUMBER](https://theskillquest.pages.dev/sticker-book-puzzle-color-by-number.html)
- [UNBLOCK IT ATLANTIS](https://iskillquest.pages.dev/unblock-it-atlantis.html)
- [BANK ROBBERY 3](https://learnquesters.pages.dev/bank-robbery-3.html)
- [ZOMBIE CHASE](https://iskillquest.pages.dev/zombie-chase.html)
- [BLOOM WITHIN A LIFE SIMULATOR](https://learnquesters.pages.dev/bloom-within-a-life-simulator.html)
- [CATEGORY CASUAL 7](https://thequizzone.pages.dev/category-casual-7.html)
- [CATEGORY 3KH0](https://theskillquest.pages.dev/category-3kh0.html)
- [WAFFLE WORDS](https://themindzone.pages.dev/waffle-words.html)
- [CHICKEN BLAST](https://iskillquest.pages.dev/chicken-blast.html)
- [DOOMSDAY TOWER DEFENSE](https://iskillquest.pages.dev/doomsday-tower-defense.html)
- [TRIVIA NATION](https://learnquesters.pages.dev/trivia-nation.html)
- [MATH OBBY](https://themindzone.pages.dev/math-obby.html)
- [PENGUIN ADVENTURE](https://iskillquest.pages.dev/penguin-adventure.html)
- [CATEGORY MAHJONG CONNECT](https://iskillquest.pages.dev/category-mahjong-connect.html)
- [CATEGORY RAGDOLL57](https://themindzone.pages.dev/category-ragdoll57.html)
- [CATEGORY PUZZLE 4](https://iskillquest.pages.dev/category-puzzle-4.html)
- [REFLECT BEAM LASER LOGIC](https://iskillquest.pages.dev/reflect-beam-laser-logic.html)
- [MR CAPPUCCINO ASSASSINO](https://theskillquest.pages.dev/mr-cappuccino-assassino.html)
- [CATEGORY ADVENTURE 2](https://themindzone.pages.dev/category-adventure-2.html)
- [MASTER ADDICTION SOLITAIRE](https://learnquesters.pages.dev/master-addiction-solitaire.html)
- [CATEGORY MINECRAFT](https://themindzone.pages.dev/category-minecraft.html)
- [NOOB LEGENDS DUNGEON ADVENTURES](https://themindzone.pages.dev/noob-legends-dungeon-adventures.html)
- [SAVAGE DEFENDERS](https://learnquesters.pages.dev/savage-defenders.html)
- [DEEP FISHING](https://iskillquest.pages.dev/deep-fishing.html)
- [ITALIAN BRAINROT NEURO BEASTS](https://theskillquest.pages.dev/italian-brainrot-neuro-beasts.html)
- [BABY PIANO CHILDREN SONG](https://thequizzone.pages.dev/baby-piano-children-song.html)
- [FOOT CHINKO RUSSIA 2018](https://iskillquest.pages.dev/foot-chinko-russia-2018.html)
- [BLOCK CRAFT 3D SCHOOL](https://iskillquest.pages.dev/block-craft-3d-school.html)
- [SMART DOTS RELOADED](https://learnquesters.pages.dev/smart-dots-reloaded.html)
- [RAGDOLL JUMP](https://learnquesters.pages.dev/ragdoll-jump.html)
- [BUBBLE GAME 3D](https://learnquesters.pages.dev/bubble-game-3d.html)
- [ARCADE GP](https://learnquesters.pages.dev/arcade-gp.html)
- [MERGE WAR](https://theskillquest.pages.dev/merge-war.html)
- [INDEX18](https://iskillquest.pages.dev/index18.html)
- [WORD SEARCH UNIVERSE 2](https://themindzone.pages.dev/word-search-universe-2.html)
- [SKYSCRAPER TO THE SKY](https://theskillquest.pages.dev/skyscraper-to-the-sky.html)
- [GIRLY PUZZLE](https://themindzone.pages.dev/girly-puzzle.html)
- [CATEGORY UNBLOCKED](https://iskillquest.pages.dev/category-unblocked.html)
- [MAGIC FINGER](https://themindplay.github.io/magic-finger.html)
- [CATEGORY MOBILE2 112](https://themindplay.web.app/category-mobile2-112.html)
- [CUT THE ROPE 2](https://themindplay.pages.dev/cut-the-rope-2.html)
- [BUILDING MODS FOR MINECRAFT](https://learnquesters.pages.dev/building-mods-for-minecraft.html)
- [CATEGORY LOGIC538](https://themindplay.pages.dev/category-logic538.html)
- [SLINGER BLOCK](https://theskillquest.pages.dev/slinger-block.html)
- [IDLE BASEBALL TYCOON](https://themindplay.pages.dev/idle-baseball-tycoon.html)
- [RAGDOLL BEAT SIMULATOR](https://themindplay.github.io/ragdoll-beat-simulator.html)
- [SPIDER ROPE HERO CITY FIGHT](https://studyplaying.github.io/spider-rope-hero-city-fight.html)
- [MERGE WAR](https://learnquesters.pages.dev/merge-war.html)
- [CATEGORY SHOOTER](https://studyquests.pages.dev/category-shooter.html)
- [CATEGORY DRESS UP97](https://quizverses.github.io/category-dress-up97.html)
- [HIDDEN OBJECT MY HOTEL](https://themindplay.pages.dev/hidden-object-my-hotel.html)
- [SQUARE PUNKI LONG HAND](https://quizverses.pages.dev/square-punki-long-hand.html)
- [BUILD YOUR AQUARIUM](https://learnquesters.pages.dev/build-your-aquarium.html)
- [CATEGORY COLOR197](https://studyplayings.pages.dev/category-color197.html)
- [CAPYBARA SCREW JAM](https://themindzone.pages.dev/capybara-screw-jam.html)
- [MAFIA ROULETTE](https://studyplayings.web.app/mafia-roulette.html)
- [STICK NINJA SURVIVAL](https://learnquesters.pages.dev/stick-ninja-survival.html)
- [STARRY STYLE DORAMA OF DREAM](https://iskillquest.pages.dev/starry-style-dorama-of-dream.html)
- [ECHOLOCATION SHOOTER](https://studyplayings.pages.dev/echolocation-shooter.html)
- [CATEGORY MERGE224](https://themindzone.pages.dev/category-merge224.html)
- [DRAW A PATH TO THE FINISH LINE](https://learnquesters.pages.dev/draw-a-path-to-the-finish-line.html)
