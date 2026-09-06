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
- [3D FPS TARGET SHOOTING](https://studyquests.github.io/3d-fps-target-shooting.html)
- [ASTRO KITTY RUSH](https://theskillquest.pages.dev/astro-kitty-rush.html)
- [ASOKA MAKEUP INDIAN BRIDE](https://quizverses.pages.dev/asoka-makeup-indian-bride.html)
- [CATEGORY FIGHTING124](https://studyquesthub.web.app/category-fighting124.html)
- [CINEMA EMPIRE IDLE TYCOON](https://studyquests.github.io/cinema-empire-idle-tycoon.html)
- [LINGO DREAMS](https://quizverses-9d2f2.web.app/lingo-dreams.html)
- [GTA GRAND VEGAS CRIME](https://quizverses-9d2f2.web.app/gta-grand-vegas-crime.html)
- [FRUIT CATCHER](https://studyquests.github.io/fruit-catcher.html)
- [ARROW TAP PUZZLE](https://quizverses-9d2f2.web.app/arrow-tap-puzzle.html)
- [RANCH ADVENTURES](https://quizverses-9d2f2.web.app/ranch-adventures.html)
- [CONNECT IMAGE](https://quizverses-9d2f2.web.app/connect-image.html)
- [FUN GOLF](https://studyquests.github.io/fun-golf.html)
- [SOCCER ARENA X](https://studyquests.github.io/soccer-arena-x.html)
- [ZOMBIE SHOOTING KING](https://quizverses-9d2f2.web.app/zombie-shooting-king.html)
- [PUZZLE BLOCKS CLASSIC](https://studyquests.github.io/puzzle-blocks-classic.html)
- [SKY ASSAULT](https://studyquests.pages.dev/sky-assault.html)
- [FROM NERD TO SCHOOL POPULAR](https://studyquests.github.io/from-nerd-to-school-popular.html)
- [CATEGORY SOLITAIRE](https://quizverses-9d2f2.web.app/category-solitaire.html)
- [FOREST SURVIVOR ROUGELIKE](https://studyquests.pages.dev/forest-survivor-rougelike.html)
- [CATEGORY UNBLOCKERS](https://quizverses-9d2f2.web.app/category-unblockers.html)
- [MY LITTLE CAR WASH](https://studyquests.github.io/my-little-car-wash.html)
- [CATEGORY STRATEGY](https://quizverses-9d2f2.web.app/category-strategy.html)
- [CAFE OWNER BUSINESS SIMULATOR](https://studyquests.github.io/cafe-owner-business-simulator.html)
- [FUN OBBY EXTREME](https://studyquests.github.io/fun-obby-extreme.html)
- [SNOW RIDER 3D NOSTALGIA](https://studyquests.github.io/snow-rider-3d-nostalgia.html)
- [WINTER GIFTS](https://studyquests.pages.dev/winter-gifts.html)
- [CAPYBARA SUIKA](https://quizverses-9d2f2.web.app/capybara-suika.html)
- [CATEGORY SCRATCH17](https://quizverses-9d2f2.web.app/category-scratch17.html)
- [SUPER BITCOIN BOY](https://quizverses-9d2f2.web.app/super-bitcoin-boy.html)
- [CRASH THE ROBOT](https://quizverses-9d2f2.web.app/crash-the-robot.html)
- [SCHOOL TEACHER SIMULATOR](https://quizverses-9d2f2.web.app/school-teacher-simulator.html)
- [CANDY SMASH](https://studyquests.pages.dev/candy-smash.html)
- [ELEMENTZ](https://quizverses.pages.dev/elementz.html)
- [CATEGORY SURVIVAL365](https://quizverses-9d2f2.web.app/category-survival365.html)
- [CATEGORY THINKY](https://studyquests.pages.dev/category-thinky.html)
- [CATEGORY MISSION207](https://quizverses-9d2f2.web.app/category-mission207.html)
- [CATEGORY TOP DOWN251](https://quizverses-9d2f2.web.app/category-top-down251.html)
- [NINJA SURVIVOR](https://studyquests.pages.dev/ninja-survivor.html)
- [HEROIC KNIGHT](https://quizverses.pages.dev/heroic-knight.html)
- [MIRACLE MAHJONG](https://studyquests.github.io/miracle-mahjong.html)
- [CITY TOWER BUILDER](https://quizverses.pages.dev/city-tower-builder.html)
- [QUACKVENTURE](https://studyquests.github.io/quackventure.html)
- [MERGE SQUARES](https://studyquests.pages.dev/merge-squares.html)
- [MERGE CUBES 2048 3D](https://quizverses-9d2f2.web.app/merge-cubes-2048-3d.html)
- [BIRD SORT CHALLENGES](https://quizverses-9d2f2.web.app/bird-sort-challenges.html)
- [DRAW TO SMASH ZOMBIE](https://quizverses.pages.dev/draw-to-smash-zombie.html)
- [BLOCK MERGE CITY](https://studyquests.pages.dev/block-merge-city.html)
- [ECO BLOCK PUZZLE](https://quizverses-9d2f2.web.app/eco-block-puzzle.html)
- [CATEGORY CAN T STOP PLAYING212](https://studyquests.github.io/category-can-t-stop-playing212.html)
- [CRICKET CLASH PONG](https://quizverses.pages.dev/cricket-clash-pong.html)
- [GEOMETRY VIBES 3D](https://studyquests.github.io/geometry-vibes-3d.html)
- [PRESS A TO PARTY](https://studyquests.github.io/press-a-to-party.html)
- [IDLE FIREFIGHTER 3D](https://studyquests.github.io/idle-firefighter-3d.html)
- [PANDA ADVENTURE](https://studyquests.github.io/panda-adventure.html)
- [BARBEE BLACK FRIDAY FASHION](https://studyquests.pages.dev/barbee-black-friday-fashion.html)
- [CONTRACT DEER HUNTER](https://studyquests.github.io/contract-deer-hunter.html)
- [CRAFT MAN VS GIANT TNT](https://studyquests.pages.dev/craft-man-vs-giant-tnt.html)
- [DIGITAL CIRCUS RUN](https://quizverses-9d2f2.web.app/digital-circus-run.html)
- [MEDIEVAL ESCAPE](https://quizverses-9d2f2.web.app/medieval-escape.html)
- [MONSTER SCHOOL 2](https://quizverses-9d2f2.web.app/monster-school-2.html)
- [DRAW BRIDGE CHALLENGE](https://studyquests.pages.dev/draw-bridge-challenge.html)
- [UGC MATH RACE](https://quizverses-9d2f2.web.app/ugc-math-race.html)
- [DRAW TO KILL](https://quizverses-9d2f2.web.app/draw-to-kill.html)
- [TRIPEAKS SOLITAIRE ESCAPES](https://studyquests.pages.dev/tripeaks-solitaire-escapes.html)
- [GUESS WORD](https://quizverses-9d2f2.web.app/guess-word.html)
- [CATEGORY SNIPER39](https://quizverses-9d2f2.web.app/category-sniper39.html)
- [MAHJONG RIDDLES EGYPT](https://quizverses.pages.dev/mahjong-riddles-egypt.html)
- [MATCH FIND 3D](https://studyquests.github.io/match-find-3d.html)
- [4 HEXA](https://quizverses-9d2f2.web.app/4-hexa.html)
- [SAVE THE DADDY](https://quizverses-9d2f2.web.app/save-the-daddy.html)
- [ALIEN INTELLIGENCE TEST](https://studyquests.github.io/alien-intelligence-test.html)
- [POP THEM](https://quizverses.pages.dev/pop-them.html)
- [BLOX FRUITS](https://studyquests.pages.dev/blox-fruits.html)
- [WARPING BAT](https://studyquests.github.io/warping-bat.html)
- [BLAST CUBES](https://quizverses.pages.dev/blast-cubes.html)
- [CHICKEN SCREAM RACE](https://quizverses.pages.dev/chicken-scream-race.html)
- [MURDER](https://studyquests.pages.dev/murder.html)
- [TRAFFIC RACING](https://studyquests.pages.dev/traffic-racing.html)
- [DOP PUZZLE ERASE MASTER](https://studyquests.github.io/dop-puzzle-erase-master.html)
- [BLOCK CRAFT 3D](https://quizverses-9d2f2.web.app/block-craft-3d.html)
- [TOWER WARS ARENA](https://quizverses-9d2f2.web.app/tower-wars-arena.html)
- [ARROW SLIDE PUZZLE](https://quizverses.pages.dev/arrow-slide-puzzle.html)
- [DINO HUNTER KING](https://quizverses.pages.dev/dino-hunter-king.html)
- [SUPERWINGS COLORSWITCH](https://studyquests.pages.dev/superwings-colorswitch.html)
- [DREAM ROOM MAKEOVER](https://studyquests.pages.dev/dream-room-makeover.html)
- [SHAPE SHIFTING](https://quizverses.pages.dev/shape-shifting.html)
- [SCREW JAM](https://studyquests.github.io/screw-jam.html)
- [CATEGORY UNBLOCKEDGAMES](https://quizverses-9d2f2.web.app/category-unblockedgames.html)
- [CATEGORY TOP DOWN251](https://quizverses.pages.dev/category-top-down251.html)
- [CANNONS BLAST 3D](https://studyquests.pages.dev/cannons-blast-3d.html)
- [BUBBLE SKY](https://studyquests.pages.dev/bubble-sky.html)
- [CATEGORY THINKY](https://quizverses.pages.dev/category-thinky.html)
- [TRIPLE TILE TWISTER MATCH GAME](https://studyquests.github.io/triple-tile-twister-match-game.html)
- [ORGANIZER MASTER](https://quizverses.pages.dev/organizer-master.html)
- [CAT CHAOS SIMULATOR](https://quizverses.pages.dev/cat-chaos-simulator.html)
- [CATEGORY ARENA255](https://studyquests.github.io/category-arena255.html)
- [SNAKEMAXX](https://studyquests.github.io/snakemaxx.html)
- [HIGH HEELS COLLECT RUN](https://studyquests.github.io/high-heels-collect-run.html)
- [SUBMARINE ATTACK](https://studyquests.pages.dev/submarine-attack.html)
- [DROP BRICKS BREAKER](https://quizverses-9d2f2.web.app/drop-bricks-breaker.html)
- [DOOMSDAY SURVIVAL RPG SHOOTER](https://studyquests.github.io/doomsday-survival-rpg-shooter.html)
- [COSMOS 404](https://quizverses.pages.dev/cosmos-404.html)
- [NETQUEL COM](https://quizverses.pages.dev/netquel-com.html)
- [CATEGORY MATH29](https://quizverses-9d2f2.web.app/category-math29.html)
- [FISH SHOOTING FISH HUNTER](https://quizverses.pages.dev/fish-shooting-fish-hunter.html)
- [UNSCREW WOOD PUZZLE](https://studyquests.github.io/unscrew-wood-puzzle.html)
- [JUST LUDO](https://studyquests.github.io/just-ludo.html)
- [SLITHORIA](https://studyquests.github.io/slithoria.html)
- [LIMITED DEFENSE](https://quizverses-9d2f2.web.app/limited-defense.html)
- [STRIKE BREAKOUT](https://quizverses-9d2f2.web.app/strike-breakout.html)
- [NINJA CROSSWORD CHALLENGE](https://studyquests.pages.dev/ninja-crossword-challenge.html)
- [HEXA GO](https://quizverses-9d2f2.web.app/hexa-go.html)
- [MERGE FRUIT](https://quizverses.pages.dev/merge-fruit.html)
- [NUBIK IN THE MONSTER WORLD](https://quizverses.pages.dev/nubik-in-the-monster-world.html)
- [BOBB S WORLD](https://studyquests.pages.dev/bobb-s-world.html)
- [SUPER SNIPER MISSIONS](https://quizverses.pages.dev/super-sniper-missions.html)
- [HAMSTERCYCLE](https://studyquests.pages.dev/hamstercycle.html)
- [FLOWBALL](https://quizverses-9d2f2.web.app/flowball.html)
- [GUIVOIO](https://studyquests.pages.dev/guivoio.html)
- [ARROW ESCAPE PUZZLE](https://quizverses-9d2f2.web.app/arrow-escape-puzzle.html)
- [HALLOWEEN MATCH TRIO](https://quizverses.pages.dev/halloween-match-trio.html)
- [COOKING RESTAURANT KITCHEN](https://studyquests.github.io/cooking-restaurant-kitchen.html)
- [LORENZO THE RUNNER](https://quizverses.pages.dev/lorenzo-the-runner.html)
- [CRAFT MAN VS GIANT TNT](https://quizverses-9d2f2.web.app/craft-man-vs-giant-tnt.html)
- [HYPERSPACE   QUANTUM FRACTURE FEZ](https://quizverses-9d2f2.web.app/hyperspace---quantum-fracture-fez.html)
- [SPA EMPIRE](https://studyquests.pages.dev/spa-empire.html)
- [SUDOBLOCK DAILY](https://studyquests.github.io/sudoblock-daily.html)
- [PYRAMID SOLITAIRE ANCIENT EGYPT](https://quizverses-9d2f2.web.app/pyramid-solitaire-ancient-egypt.html)
- [FRUIT MATCH JUICY PUZZLE](https://studyquests.github.io/fruit-match-juicy-puzzle.html)
- [MATCH FIGHTER](https://studyquests.pages.dev/match-fighter.html)
