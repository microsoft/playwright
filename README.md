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
- [BRAINROT CLICKER](https://studyquests.github.io/brainrot-clicker.html)
- [CATEGORY BUILDING182](https://studyplayings.pages.dev/category-building182.html)
- [STOLEN HOUSE](https://iskillquest.pages.dev/stolen-house.html)
- [BLOCK BLASTY SAGA](https://studyquests.github.io/block-blasty-saga.html)
- [CATEGORY BIKE](https://studyquesthub.web.app/category-bike.html)
- [BRAINROT MEGA PARKOUR](https://studyquests.github.io/brainrot-mega-parkour.html)
- [BUBBLE MATCH MERGE](https://studyplaying.github.io/bubble-match-merge.html)
- [DIY PHONE CASE SHOP](https://studyplaying.github.io/diy-phone-case-shop.html)
- [PLANETARIUM 2](https://studyplaying.github.io/planetarium-2.html)
- [WORLDCRAFT 3](https://studyplaying.github.io/worldcraft-3.html)
- [WORLD SOCCER](https://studyplaying.github.io/world-soccer.html)
- [DUNGEONS N DUCKS](https://studyplaying.github.io/dungeons-n-ducks.html)
- [SORT MY PARKING AREA](https://studyplaying.github.io/sort-my-parking-area.html)
- [GOODS TRIPLE MATCH 3D](https://studyplaying.github.io/goods-triple-match-3d.html)
- [ANGRY CHIBI RUN](https://studyplaying.github.io/angry-chibi-run.html)
- [NONOGRAM DAILY](https://studyplaying.github.io/nonogram-daily.html)
- [LADDER MASTER COLOR RUN](https://studyquests.github.io/ladder-master-color-run.html)
- [GOING BALLS ADVENTURE 2](https://studyquests.github.io/going-balls-adventure-2.html)
- [BACKYARD DIG HOLE 3D SIMULATOR](https://quizverses.pages.dev/backyard-dig-hole-3d-simulator.html)
- [SNOW RUSH 3D](https://studyplaying.github.io/snow-rush-3d.html)
- [BRICK BLAZE](https://studyquests.github.io/brick-blaze.html)
- [REAL FLIGHT SIMULATOR](https://quizverses.pages.dev/real-flight-simulator.html)
- [THATS NOT MY NEIGHBOR](https://studyquests.github.io/thats-not-my-neighbor.html)
- [DRIFTCLICKER](https://studyquests.github.io/driftclicker.html)
- [LULUS FASHION WORLD](https://studyquests.github.io/lulus-fashion-world.html)
- [ESCAPE AGAIN](https://studyplaying.github.io/escape-again.html)
- [PIXEL SHOOT](https://studyplaying.github.io/pixel-shoot.html)
- [BUBBLE SHOOTER POP](https://quizverses.pages.dev/bubble-shooter-pop.html)
- [GROW A GARDEN ONLINE OFFLINE](https://studyplaying.github.io/grow-a-garden-online-offline.html)
- [SNIPER VS SNIPER](https://studyplaying.github.io/sniper-vs-sniper.html)
- [BFFS SPRING BREAK FASHIONISTA](https://studyplaying.github.io/bffs-spring-break-fashionista.html)
- [CATEGORY SCRATCH](https://studyplaying.github.io/category-scratch.html)
- [DETECTIVE LOGIC PUZZLES](https://studyplaying.github.io/detective-logic-puzzles.html)
- [RICH CHOICE RUN](https://studyquests.github.io/rich-choice-run.html)
- [MERGE CUBES 2048 3D](https://studyplaying.github.io/merge-cubes-2048-3d.html)
- [AMERICAN BLOCK SNIPER ONLINE](https://studyquests.github.io/american-block-sniper-online.html)
- [LAZY WORKERS](https://studyplaying.github.io/lazy-workers.html)
- [SHEEP SHEEP DUCK](https://quizverses.pages.dev/sheep-sheep-duck.html)
- [COOL CARS RACING AT ALTITUDE](https://quizverses.pages.dev/cool-cars-racing-at-altitude.html)
- [PING PONG BATTLE TABLE TENNIS](https://quizverses.pages.dev/ping-pong-battle-table-tennis.html)
- [SOCCER DUEL](https://quizverses.pages.dev/soccer-duel.html)
- [9 BLOCKS](https://studyquests.github.io/9-blocks.html)
- [CUTE KITTY MERGE](https://quizverses.pages.dev/cute-kitty-merge.html)
- [CS COMMAND SNIPERS](https://studyquests.github.io/cs-command-snipers.html)
- [AGENTS IO](https://studyplaying.github.io/agents-io.html)
- [FITNESS CLUB 3D](https://studyquests.github.io/fitness-club-3d.html)
- [CLASSIC LABYRINTH 3D MAZE](https://studyplaying.github.io/classic-labyrinth-3d-maze.html)
- [CUBICA](https://studyquests.github.io/cubica.html)
- [BATTLE SIMULATOR SANDBOX](https://studyplaying.github.io/battle-simulator-sandbox.html)
- [HIDDEN EASTER EGG HUNT](https://studyquests.github.io/hidden-easter-egg-hunt.html)
- [PING PONG AIR](https://studyplaying.github.io/ping-pong-air.html)
- [FOREST TILES](https://studyplaying.github.io/forest-tiles.html)
- [CATEGORY WORLD CUP17](https://studyplaying.github.io/category-world-cup17.html)
- [CATEGORY THINKY 2](https://studyplaying.github.io/category-thinky-2.html)
- [CATEGORY MEME BLOXY24](https://studyplayings.web.app/category-meme-bloxy24.html)
- [AVATAR LIFE MY TOWN](https://quizverses.pages.dev/avatar-life-my-town.html)
- [MERGE FRUIT](https://quizverses.pages.dev/merge-fruit.html)
- [FIGHT FOR THE TREE](https://studyplaying.github.io/fight-for-the-tree.html)
- [INDEX3](https://studyplayings.web.app/index3.html)
- [DRAW THE WEAPON](https://quizverses.pages.dev/draw-the-weapon.html)
- [CATEGORY MATH29](https://studyplayings.web.app/category-math29.html)
- [BOXTERIA](https://studyplaying.github.io/boxteria.html)
- [MERGEDUELIO](https://quizverses.pages.dev/mergeduelio.html)
- [TAP TO COLOR PAINTING BOOK](https://studyplaying.github.io/tap-to-color-painting-book.html)
- [SORTSTORE](https://studyplaying.github.io/sortstore.html)
- [CAT CUT](https://quizverses.pages.dev/cat-cut.html)
- [HOSPITAL SURGEON DOCTOR GAME](https://studyplaying.github.io/hospital-surgeon-doctor-game.html)
- [SAMURAI MADNESS](https://studyquesthub.web.app/samurai-madness.html)
- [SAVE MY HERO](https://quizverses.pages.dev/save-my-hero.html)
- [DRAW CLIMB RACE THE ULTIMATE HILL CLIMBING CHALLENGE](https://quizverses.pages.dev/draw-climb-race-the-ultimate-hill-climbing-challenge.html)
- [SHARK CHOMP CHASE](https://quizverses.pages.dev/shark-chomp-chase.html)
- [BLAST CUBES](https://quizverses.pages.dev/blast-cubes.html)
- [CATEGORY GROW99](https://studyquesthub.web.app/category-grow99.html)
- [BUILD AND RUN](https://quizverses.pages.dev/build-and-run.html)
- [HEXA SORT WINTER EDITION](https://quizverses.pages.dev/hexa-sort-winter-edition.html)
- [MOJICON EMOJI CONNECT](https://studyplaying.github.io/mojicon-emoji-connect.html)
- [TILE CONNECT PAIR MATCH PUZZLE](https://studyplaying.github.io/tile-connect-pair-match-puzzle.html)
- [CATEGORY SOCCER 2](https://studyquesthub.web.app/category-soccer-2.html)
- [COLOR WOOD ANIMAL JAM](https://quizverses.pages.dev/color-wood-animal-jam.html)
- [UNPUZZLE MASTER](https://quizverses.pages.dev/unpuzzle-master.html)
- [SKIBIDI TOILET VS CAMERAMAN SNIPER GAME](https://studyplaying.github.io/skibidi-toilet-vs-cameraman-sniper-game.html)
- [ZOMBIE DEFENSE WAR](https://studyquests.github.io/zombie-defense-war.html)
- [CATEGORY MINECRAFT81](https://studyplayings.web.app/category-minecraft81.html)
- [YUMMY TALES 4](https://quizverses.pages.dev/yummy-tales-4.html)
- [RACING BALL ADVENTURE](https://studyplaying.github.io/racing-ball-adventure.html)
- [CATEGORY IO](https://studyplayings.web.app/category-io.html)
- [CATEGORY RPG](https://studyplaying.github.io/category-rpg.html)
- [TWO STUNT RACERS](https://quizverses.pages.dev/two-stunt-racers.html)
- [COLOR NUTS BOLTS PUZZLE](https://studyquests.github.io/color-nuts-bolts-puzzle.html)
- [WORM APPLE QUEST](https://studyplaying.github.io/worm-apple-quest.html)
- [PIXEL JOURNEY](https://quizverses.pages.dev/pixel-journey.html)
- [FLOWER SHOP](https://studyplaying.github.io/flower-shop.html)
- [INDEX13](https://studyplayings.web.app/index13.html)
- [SUPER RACING](https://studyquests.github.io/super-racing.html)
- [FIND IT OUT COLORFUL BOOK](https://studyquesthub.web.app/find-it-out-colorful-book.html)
- [SWORD AND SPIN](https://studyplaying.github.io/sword-and-spin.html)
- [BRAINROT CLICKER](https://studyplaying.github.io/brainrot-clicker.html)
- [MAHJONG EARTH](https://studyplaying.github.io/mahjong-earth.html)
- [GRASS LAND](https://studyquests.github.io/grass-land.html)
- [BLOCK TEAM DEATHMATCH](https://quizverses.pages.dev/block-team-deathmatch.html)
- [TAP GO DELUXE](https://quizverses.pages.dev/tap-go-deluxe.html)
- [CUTE CRAFT LAB](https://studyplaying.github.io/cute-craft-lab.html)
- [KOMARU CAT](https://studyplaying.github.io/komaru-cat.html)
- [CATEGORY SNAKE40](https://studyquesthub.web.app/category-snake40.html)
- [FLICK SHOT SOCCER](https://studyplaying.github.io/flick-shot-soccer.html)
- [OBBY CARDS THE LEGEND HUNT](https://studyplaying.github.io/obby-cards-the-legend-hunt.html)
- [SLITHORIA](https://studyquests.github.io/slithoria.html)
- [WOOD BLOCKS JAM](https://studyplaying.github.io/wood-blocks-jam.html)
- [BESTIES CHINESE NEW YEAR CELEBRATION](https://studyplaying.github.io/besties-chinese-new-year-celebration.html)
- [LEAP OF LIFE](https://studyquests.github.io/leap-of-life.html)
- [CATEGORY CONTROLLER 2](https://studyplayings.web.app/category-controller-2.html)
- [STICKMAN ESCAPES FROM PRISON](https://quizverses.pages.dev/stickman-escapes-from-prison.html)
- [MONSTER IMPACT](https://studyquesthub.web.app/monster-impact.html)
- [ANNOYING BOSS PUNCH GAME](https://studyquests.github.io/annoying-boss-punch-game.html)
- [X TO Y ALMOST IMPOSSIBLE](https://studyquests.github.io/x-to-y-almost-impossible.html)
- [SWORD LIFE](https://studyplaying.github.io/sword-life.html)
- [GROSS OUT RUN](https://studyplaying.github.io/gross-out-run.html)
- [WATERPARK SORT](https://studyplaying.github.io/waterpark-sort.html)
- [CATEGORY SPACE57](https://studyquesthub.web.app/category-space57.html)
- [ESCAPE SCHOOL DUEL](https://studyplaying.github.io/escape-school-duel.html)
- [MAHJONG CUTE TILES](https://studyplaying.github.io/mahjong-cute-tiles.html)
- [KITTY MATCH 3 PUZZLE GAME](https://studyquests.github.io/kitty-match-3-puzzle-game.html)
- [CATEGORY HORROR 2](https://studyplayings.web.app/category-horror-2.html)
- [TIKTOK TRENDS COLORED DENIM](https://studyquests.github.io/tiktok-trends-colored-denim.html)
- [CATEGORY SPEED158](https://studyquesthub.web.app/category-speed158.html)
- [CHECKERS DELUXE EDITION](https://studyplaying.github.io/checkers-deluxe-edition.html)
- [CATEGORY SOCCER](https://studyquesthub.web.app/category-soccer.html)
- [CUT N FILL](https://studyquests.github.io/cut-n-fill.html)
- [CATEGORY GUN238](https://studyquesthub.web.app/category-gun238.html)
- [CATEGORY EDUCATIONAL](https://studyquests.github.io/category-educational.html)
