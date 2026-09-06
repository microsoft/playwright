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
- [CATEGORY CAR 2](https://thequizzone.pages.dev/category-car-2.html)
- [REALDRIVE FEEL THE REAL DRIVE](https://studyquesthub.web.app/realdrive-feel-the-real-drive.html)
- [INDEX19](https://thelearnquester.web.app/index19.html)
- [PUSH TO GO](https://studyquests.pages.dev/push-to-go.html)
- [SORCERER MAHJONG MARVELS](https://studyquesthub.web.app/sorcerer-mahjong-marvels.html)
- [INDEX15](https://studyquests.github.io/index15.html)
- [HERO WIZARD SAVE YOUR GIRLFRIEND](https://quizverses.github.io/hero-wizard-save-your-girlfriend.html)
- [HIDDEN PAINT 3D](https://studyquests.github.io/hidden-paint-3d.html)
- [CATEGORY TOWER DEFENSE](https://studyquests.pages.dev/category-tower-defense.html)
- [FOOT HOSPITAL](https://quizverses-9d2f2.web.app/foot-hospital.html)
- [TENNIS MASTERS 2026](https://quizverses.pages.dev/tennis-masters-2026.html)
- [CATEGORY BLOCK94](https://studyplayings.web.app/category-block94.html)
- [BREAK A LUCKY BLOCK](https://quizverses.github.io/break-a-lucky-block.html)
- [FRUIT MATCH JUICY PUZZLE](https://studyquests.github.io/fruit-match-juicy-puzzle.html)
- [SORT WORKS NUTS ORDER](https://quizverses-9d2f2.web.app/sort-works-nuts-order.html)
- [PIPE CONNECT](https://studyquests.github.io/pipe-connect.html)
- [ORDER OF OPERATION CHALLENGE](https://quizverses.pages.dev/order-of-operation-challenge.html)
- [KAWAII FRIENDS TILES MATCHER](https://studyquests.pages.dev/kawaii-friends-tiles-matcher.html)
- [CHICKEN WILD RUN](https://quizverses.pages.dev/chicken-wild-run.html)
- [PARIS KISS](https://studyplaying.github.io/paris-kiss.html)
- [SITEMAP](https://cryptotify9.onrender.com/sitemap.html)
- [SITEMAP](https://cryptotify.netlify.app/sitemap.html)
- [MY DINOSAUR LAND](https://quizverses.pages.dev/my-dinosaur-land.html)
- [MOVE EMOJI](https://quizverses.pages.dev/move-emoji.html)
- [ROPEWAY MASTER](https://quizverses-9d2f2.web.app/ropeway-master.html)
- [TERMS](https://quizverses.github.io/terms.html)
- [WORLD CUP SOCCER CAPS](https://quizverses.github.io/world-cup-soccer-caps.html)
- [GEOMETRY ARROW](https://studyplaying.github.io/geometry-arrow.html)
- [ARMY COMMANDER CRAFT](https://studyquesthub.web.app/army-commander-craft.html)
- [MOTO TRAFFIC RIDER](https://studyquesthub.web.app/moto-traffic-rider.html)
- [STICKMAN DUO ESCAPE THE TOMB](https://studyquests.pages.dev/stickman-duo-escape-the-tomb.html)
- [MERGE HOSPITAL](https://studyplaying.github.io/merge-hospital.html)
- [INDEX2](https://studyplaying.github.io/index2.html)
- [SCREW COLOR SORTING MASTER](https://quizverses.github.io/screw-color-sorting-master.html)
- [CATEGORY UNBLOCKEDGAMES](https://quizverses-9d2f2.web.app/category-unblockedgames.html)
- [ZOMBIE RAFT](https://studyquests.pages.dev/zombie-raft.html)
- [BUBBLE SHOOTER PANDA BLAST](https://quizverses.github.io/bubble-shooter-panda-blast.html)
- [TERMS](https://cryptotify9.onrender.com/terms.html)
- [IBIZA FOAM PARTY](https://quizverses.pages.dev/ibiza-foam-party.html)
- [BACKYARD DIG HOLE 3D SIMULATOR](https://quizverses.pages.dev/backyard-dig-hole-3d-simulator.html)
- [ESCAPE OR DIE TROLL DEVIL LEVELS](https://studyplaying.github.io/escape-or-die-troll-devil-levels.html)
- [PRIVACY](https://brainquests.vercel.app/privacy.html)
- [SNAKE HUNTER](https://quizverses.pages.dev/snake-hunter.html)
- [CATEGORY RETRO27](https://studyquests.pages.dev/category-retro27.html)
- [3D BASKETBALLIO DUNK SPORT](https://quizverses-9d2f2.web.app/3d-basketballio-dunk-sport.html)
- [SMART DOTS RELOADED](https://quizverses.pages.dev/smart-dots-reloaded.html)
- [CATEGORY WEBGAME](https://studyplaying.github.io/category-webgame.html)
- [CATEGORY SPACE57](https://studyplaying.github.io/category-space57.html)
- [TANGRAM PUZZLE](https://quizverses-9d2f2.web.app/tangram-puzzle.html)
- [BUTTERFLY EAR CUFF JEWELRY](https://studyquests.pages.dev/butterfly-ear-cuff-jewelry.html)
- [CRYPTOGRAM](https://studyplaying.github.io/cryptogram.html)
- [CATEGORY CAR](https://quizverses.github.io/category-car.html)
- [CATEGORY CANNON22](https://quizverses.github.io/category-cannon22.html)
- [GHOST ESCAPE 3D](https://studyplayings.web.app/ghost-escape-3d.html)
- [HARD ROCK ZOMBIE TRUCK](https://studyplaying.github.io/hard-rock-zombie-truck.html)
- [CATEGORY COLLECT565](https://quizverses.github.io/category-collect565.html)
- [LITTLE ALCHEMY](https://quizverses-9d2f2.web.app/little-alchemy.html)
- [BLOCKS AND THATS IT](https://studyplayings.web.app/blocks-and-thats-it.html)
- [4 COLORS CARD MANIA](https://studyquests.github.io/4-colors-card-mania.html)
- [CATEGORY BUILDING179](https://studyplaying.github.io/category-building179.html)
- [PHRASLE MASTER](https://studyplayings.web.app/phrasle-master.html)
- [MUSHROOM FEVER MATCH 3](https://quizverses-9d2f2.web.app/mushroom-fever-match-3.html)
- [LABUBU COLORING ADVENTURE](https://quizverses.github.io/labubu-coloring-adventure.html)
- [2048 MERGE CIRCLE](https://quizverses.pages.dev/2048-merge-circle.html)
- [CATEGORY MATCH 3 2](https://studyplayings.pages.dev/category-match-3-2.html)
- [TERMS](https://cryptotify.netlify.app/terms.html)
- [ROBLOX HALLOWEEN COSTUME PARTY](https://studyplaying.github.io/roblox-halloween-costume-party.html)
- [DIG FLOW SAVE WATER](https://quizverses.github.io/dig-flow-save-water.html)
- [CATEGORY MAHJONG CONNECT](https://studyplayings.pages.dev/category-mahjong-connect.html)
- [MERGE RACER STUNTS CAR](https://studyplaying.github.io/merge-racer-stunts-car.html)
- [RANCH ADVENTURES](https://quizverses-9d2f2.web.app/ranch-adventures.html)
- [CATEGORY DRESS UP97](https://studyplayings.pages.dev/category-dress-up97.html)
- [BATTLE SHOT ELITE](https://studyquests.github.io/battle-shot-elite.html)
- [ADDICTION MINI SOLITAIRE](https://studyplayings.pages.dev/addiction-mini-solitaire.html)
- [FUN IQ PUZZLE](https://studyplaying.github.io/fun-iq-puzzle.html)
- [ULTIMATE ROBO DUEL 3D](https://quizverses.github.io/ultimate-robo-duel-3d.html)
- [CATEGORY AVOID295](https://studyplayings.pages.dev/category-avoid295.html)
- [CATEGORY LINKS](https://studyplayings.pages.dev/category-links.html)
- [CATEGORY HERO72](https://quizverses.github.io/category-hero72.html)
- [GOOD TO DRIVE](https://studyquests.github.io/good-to-drive.html)
- [CATEGORY GOGUARDIANBYPASS](https://quizverses-9d2f2.web.app/category-goguardianbypass.html)
- [IDLE FIREFIGHTER 3D](https://studyquests.pages.dev/idle-firefighter-3d.html)
- [POGO MASTERS](https://quizverses-9d2f2.web.app/pogo-masters.html)
- [BED WARS](https://quizverses.github.io/bed-wars.html)
- [HIDDEN OBJECT EMILYS CASE](https://studyquests.github.io/hidden-object-emilys-case.html)
- [SHELL STRIKERS](https://studyplayings.web.app/shell-strikers.html)
- [DOMINO ONLINE MULTIPLAYER](https://studyquesthub.web.app/domino-online-multiplayer.html)
- [ZOMBIE EEASTER BUNNIES](https://quizverses-9d2f2.web.app/zombie-eeaster-bunnies.html)
- [ARCHERY MASTER](https://studyquests.pages.dev/archery-master.html)
- [CATEGORY MATCH 3117](https://quizverses.github.io/category-match-3117.html)
- [POP PUZZLE](https://quizverses-9d2f2.web.app/pop-puzzle.html)
- [HELP ME TRICKY BRAIN PUZZLES](https://studyplaying.github.io/help-me-tricky-brain-puzzles.html)
- [HEROES OF THE ARENA](https://studyquests.github.io/heroes-of-the-arena.html)
- [CATEGORY PUZZLE 7](https://studyplaying.github.io/category-puzzle-7.html)
- [BACK 2 SCHOOL MAKEOVER](https://quizverses.pages.dev/back-2-school-makeover.html)
- [CATEGORY SURVIVAL366](https://studyplayings.pages.dev/category-survival366.html)
- [CATEGORY ONE BUTTON](https://studyplayings.pages.dev/category-one-button.html)
- [CATEGORY CASUAL 12](https://quizverses.github.io/category-casual-12.html)
- [PARKING FURY 3D NIGHT CITY](https://studyquesthub.web.app/parking-fury-3d-night-city.html)
- [BLOCK PIXELS](https://studyquests.github.io/block-pixels.html)
- [CATEGORY PHYSICS371](https://studyplayings.web.app/category-physics371.html)
- [TIC TAC TOE MERGE](https://studyquesthub.web.app/tic-tac-toe-merge.html)
- [PLANTS VS ZOMBIES WAR](https://studyplayings.web.app/plants-vs-zombies-war.html)
- [CHICKEN BANANA RUN](https://studyquesthub.web.app/chicken-banana-run.html)
- [SUPER SWING](https://studyplaying.github.io/super-swing.html)
- [WORMS ZONE](https://quizverses.pages.dev/worms-zone.html)
- [CATEGORY SCRATCH](https://studyplaying.github.io/category-scratch.html)
- [STACKTRIS 2048](https://quizverses.pages.dev/stacktris-2048.html)
- [CATEGORY SIMULATION 4](https://studyplaying.github.io/category-simulation-4.html)
- [PURRFECT PUZZLE](https://studyquesthub.web.app/purrfect-puzzle.html)
- [FRUIT CATCHER](https://studyquesthub.web.app/fruit-catcher.html)
- [PET CONNECT MATCH](https://quizverses.github.io/pet-connect-match.html)
- [VALLEY OF WOLVES AMBUSH](https://studyquests.pages.dev/valley-of-wolves-ambush.html)
- [CUPIDS STORY LOVE ARCHER BOW](https://quizverses-9d2f2.web.app/cupids-story-love-archer-bow.html)
- [IDLE LUNCH](https://studyquests.pages.dev/idle-lunch.html)
- [GUN RACING](https://studyplaying.github.io/gun-racing.html)
- [ROYAL GARDEN MATCH](https://studyplayings.pages.dev/royal-garden-match.html)
- [ITALIAN BRAINROT BABY CLICKER](https://studyplaying.github.io/italian-brainrot-baby-clicker.html)
- [CATEGORY MOBILE2 112](https://studyplayings.pages.dev/category-mobile2-112.html)
- [CHAMPIONS FC](https://studyquests.github.io/champions-fc.html)
- [COLOR SORT MANIA](https://studyquesthub.web.app/color-sort-mania.html)
- [BIKING EXTREME 3D](https://studyplayings.web.app/biking-extreme-3d.html)
- [DUDU ENGINEERING TRUCK](https://quizverses.pages.dev/dudu-engineering-truck.html)
- [CATEGORY CASUAL 2](https://studyplayings.pages.dev/category-casual-2.html)
- [CATEGORY CONTROLLER](https://studyplayings.pages.dev/category-controller.html)
- [OFFICE BRAWL ROOM SMASH](https://studyplayings.web.app/office-brawl-room-smash.html)
- [TENNIS MASTERS 2026](https://quizverses-9d2f2.web.app/tennis-masters-2026.html)
- [MONSTER ARENA](https://quizverses.github.io/monster-arena.html)
- [TILE LIVING](https://quizverses.github.io/tile-living.html)
- [CAPYBARA SUIKA](https://quizverses.pages.dev/capybara-suika.html)
