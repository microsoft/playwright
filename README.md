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
- [CATEGORY MAHJONG CONNECT](https://studyplayings.web.app/category-mahjong-connect.html)
- [CATEGORY BLOCK91](https://thequizzone.pages.dev/category-block91.html)
- [UNSCREW WOOD PUZZLE](https://studyplayings.pages.dev/unscrew-wood-puzzle.html)
- [CRYSTAL CONNECT](https://learnquester.github.io/crystal-connect.html)
- [SPRUNKI 3D SHOOTER](https://studyplayings.pages.dev/sprunki-3d-shooter.html)
- [CATEGORY PARKOUR55](https://studyquests.pages.dev/category-parkour55.html)
- [INDEX28](https://studyplaying.github.io/index28.html)
- [HAMSTERCYCLE](https://studyplaying.github.io/hamstercycle.html)
- [ABOUT A FROG](https://studyplayings.pages.dev/about-a-frog.html)
- [FLIGHT PILOT AIRPLANE GAMES 24](https://studyplayings.pages.dev/flight-pilot-airplane-games-24.html)
- [CATEGORY RUNNING107](https://studyplaying.github.io/category-running107.html)
- [FASHION BATTLE FOR SURVIVAL](https://studyplaying.github.io/fashion-battle-for-survival.html)
- [CLEANING SIMULATOR](https://studyplayings.pages.dev/cleaning-simulator.html)
- [LATUTU HOLIDAY GIFT HUNT](https://studyplayings.pages.dev/latutu-holiday-gift-hunt.html)
- [DRAW TO CRUSH MONSTER GAME](https://studyplayings.pages.dev/draw-to-crush-monster-game.html)
- [CATEGORY CASUAL 5](https://studyplaying.github.io/category-casual-5.html)
- [FEED ME MONSTERS IDLE BATTLE](https://studyplayings.pages.dev/feed-me-monsters-idle-battle.html)
- [CRYPTO GALS TIKTOK FASHION](https://studyplayings.pages.dev/crypto-gals-tiktok-fashion.html)
- [ITALIAN BRAINROT QUIZ](https://studyplayings.pages.dev/italian-brainrot-quiz.html)
- [BLOONS SURVIVALIO](https://studyplayings.pages.dev/bloons-survivalio.html)
- [CAKE MERGE 2](https://studyplayings.pages.dev/cake-merge-2.html)
- [FREECELL](https://studyplayings.pages.dev/freecell.html)
- [CARD MASTER](https://studyplayings.pages.dev/card-master.html)
- [FIND HIDDEN SECRETS](https://studyplayings.pages.dev/find-hidden-secrets.html)
- [BLOCK CRAFT 3D](https://studyplayings.pages.dev/block-craft-3d.html)
- [TREASURE CHAMPION CHEST CAPTURE](https://studyplayings.pages.dev/treasure-champion-chest-capture.html)
- [AVATAR MASTER FIX UP FACE](https://studyplaying.github.io/avatar-master-fix-up-face.html)
- [CATEGORY ESCAPE](https://studyplaying.github.io/category-escape.html)
- [WAVE DASH GEOMETRY ARROW](https://studyplayings.pages.dev/wave-dash-geometry-arrow.html)
- [SPIDER SOLITAIRE 2 SUITS](https://studyplaying.github.io/spider-solitaire-2-suits.html)
- [FUN IQ PUZZLE](https://studyplayings.web.app/fun-iq-puzzle.html)
- [CATEGORY BATTLE524](https://studyplaying.github.io/category-battle524.html)
- [PERFECT JOB RUN](https://studyplayings.web.app/perfect-job-run.html)
- [THE PRISM CITY DETECTIVES](https://studyplayings.web.app/the-prism-city-detectives.html)
- [PLANTS VS ZOMBIES WAR](https://studyquesthub.web.app/plants-vs-zombies-war.html)
- [CATEGORY RPG](https://studyquests.pages.dev/category-rpg.html)
- [FRUIT BLOCK TETRA PUZZLE](https://studyplayings.pages.dev/fruit-block-tetra-puzzle.html)
- [OBBY SURVIVE PARKOUR](https://studyplaying.github.io/obby-survive-parkour.html)
- [CATEGORY BIKE](https://studyplaying.github.io/category-bike.html)
- [STREET TRAFFIC RACER](https://studyplayings.pages.dev/street-traffic-racer.html)
- [WINTER SOLITAIRE TRIPEAKS](https://studyplayings.web.app/winter-solitaire-tripeaks.html)
- [COLOR SCREW RESCUE PUZZLE](https://studyplayings.web.app/color-screw-rescue-puzzle.html)
- [ULTIMATE TRANSPORT DRIVING SIM](https://studyquests.pages.dev/ultimate-transport-driving-sim.html)
- [QUACKVENTURE](https://studyplayings.web.app/quackventure.html)
- [CATEGORY BLOCK91](https://studyplaying.github.io/category-block91.html)
- [FENNEC THE FOX CLICK ADVENTURE](https://studyplaying.github.io/fennec-the-fox-click-adventure.html)
- [TRIPLE SHELF MATCH](https://quizverses.github.io/triple-shelf-match.html)
- [INSPECTOR CAT](https://studyplayings.web.app/inspector-cat.html)
- [CATEGORY CONTROLLER 2](https://studyplayings.pages.dev/category-controller-2.html)
- [BEAT BLADER 3D](https://quizverses-9d2f2.web.app/beat-blader-3d.html)
- [CATEGORY LOGIC538](https://studyplaying.github.io/category-logic538.html)
- [ULTIMATE TOWER DEFENSE](https://studyplaying.github.io/ultimate-tower-defense.html)
- [CATEGORY AGILITY 3](https://studyplaying.github.io/category-agility-3.html)
- [SAUSAGE MAN SHOOTING ADVENTURE](https://quizverses.github.io/sausage-man-shooting-adventure.html)
- [COLLECT BRAINROT ARENA](https://studyplayings.web.app/collect-brainrot-arena.html)
- [ROYAL JEWELS MATCH](https://studyquesthub.web.app/royal-jewels-match.html)
- [HEXA SORT WINTER EDITION](https://studyplayings.pages.dev/hexa-sort-winter-edition.html)
- [NINJA TIME](https://studyplaying.github.io/ninja-time.html)
- [SWORD AND SPIN](https://studyplaying.github.io/sword-and-spin.html)
- [CRIME THEFT GANGSTER PARADISE](https://studyplaying.github.io/crime-theft-gangster-paradise.html)
- [CATEGORY IDLE GAMES](https://studyquests.github.io/category-idle-games.html)
- [IDLE BATHROOM EMPIRE TYCOON](https://studyplayings.web.app/idle-bathroom-empire-tycoon.html)
- [CATEGORY PHYSICS371](https://studyquests.github.io/category-physics371.html)
- [CATEGORY OBSTACLE299](https://studyquests.pages.dev/category-obstacle299.html)
- [HEXANAUT IO](https://quizverses.github.io/hexanaut-io.html)
- [BLOCK PUZZLE SLIDE BLOCK JAM](https://quizverses.github.io/block-puzzle-slide-block-jam.html)
- [NOOB SHOOTER GUN BATTLE 3D](https://studyquests.pages.dev/noob-shooter-gun-battle-3d.html)
- [CATEGORY CONTROLLER](https://quizverses.pages.dev/category-controller.html)
- [INDEX24](https://quizverses.github.io/index24.html)
- [SINGLE STROKE ENERGY LINE PUZZLE](https://studyquests.pages.dev/single-stroke-energy-line-puzzle.html)
- [MICROPLASTICS FEEDING](https://quizverses.pages.dev/microplastics-feeding.html)
- [HOOP WORLD 3D](https://studyquests.pages.dev/hoop-world-3d.html)
- [ISLAND BATTLE 3D](https://studyplayings.pages.dev/island-battle-3d.html)
- [EPIC STUNTS PVP 3D](https://studyplayings.web.app/epic-stunts-pvp-3d.html)
- [CATEGORY FPS174](https://studyquests.github.io/category-fps174.html)
- [RACE TIME](https://studyplaying.github.io/race-time.html)
- [DIY MAKEUP SALON SPA MAKEOVER STUDIO](https://studyplaying.github.io/diy-makeup-salon-spa-makeover-studio.html)
- [CANNON MERGE](https://studyquests.github.io/cannon-merge.html)
- [MOTO X3M DEAD AHEAD](https://studyplayings.web.app/moto-x3m-dead-ahead.html)
- [SNOW BALL RACING MUTLIPLAYER](https://thelearnquesters.pages.dev/snow-ball-racing-mutliplayer.html)
- [HAPPY FARM THE CROP](https://quizverses-9d2f2.web.app/happy-farm-the-crop.html)
- [CATEGORY ARCHERY52](https://theskillquest.pages.dev/category-archery52.html)
- [DRAW BRIDGE CHALLENGE](https://studyquests.pages.dev/draw-bridge-challenge.html)
- [BLAST CUBES](https://thequizzone.pages.dev/blast-cubes.html)
- [CATEGORY MISSION207](https://studyquests.github.io/category-mission207.html)
- [PUPPY TREAT SORTING](https://studyplayings.pages.dev/puppy-treat-sorting.html)
- [MONSTER MAKEUP 3D](https://quizverses.pages.dev/monster-makeup-3d.html)
- [ASOKA MAKEUP INDIAN BRIDE](https://quizverses.pages.dev/asoka-makeup-indian-bride.html)
- [MONSTER SLAYERS](https://thelearnquesters.pages.dev/monster-slayers.html)
- [BRAIN PUZZLES QUESTS](https://learnquesters.pages.dev/brain-puzzles-quests.html)
- [FLAMES FORTUNE](https://thelearnquester.web.app/flames-fortune.html)
- [FALLING ART RAGDOLL SIMULATOR](https://thequizzone.pages.dev/falling-art-ragdoll-simulator.html)
- [LOVIE CHICS SPRING BREAK FASHION](https://thelearnquesters.pages.dev/lovie-chics-spring-break-fashion.html)
- [TOWER OF HELL OBBY BLOX](https://quizverses.pages.dev/tower-of-hell-obby-blox.html)
- [CATCH THE PIG](https://learnquester.pages.dev/catch-the-pig.html)
- [COLOR RINGS BLOCK PUZZLE](https://thelearnquesters.pages.dev/color-rings-block-puzzle.html)
- [VEGAMIX MATCH 3 VILLAGE](https://quizverses.github.io/vegamix-match-3-village.html)
- [BRAINROT CLEANING](https://studyplayings.pages.dev/brainrot-cleaning.html)
- [CATEGORY TITANIUMNETWORK](https://studyquests.github.io/category-titaniumnetwork.html)
- [NEIGHBORHOOD DEFENSE](https://learnquester.pages.dev/neighborhood-defense.html)
- [GOOBER DASH](https://studyquests.pages.dev/goober-dash.html)
- [ZINDEX](https://thelearnquesters.pages.dev/zindex.html)
- [THE PRISM CITY DETECTIVES](https://thelearnquester.web.app/the-prism-city-detectives.html)
- [CATEGORY LIGHTSPEED FILTER](https://thequizzone.pages.dev/category-lightspeed-filter.html)
- [GARTEN OF BANBAN 1 ESCAPE](https://quizverses-9d2f2.web.app/garten-of-banban-1-escape.html)
- [FUN GOLF](https://learnquester.pages.dev/fun-golf.html)
- [MURDER MYSTERY](https://thelearnquesters.pages.dev/murder-mystery.html)
- [MERGE BLOCKS 2048 STYLE](https://thequizzone.pages.dev/merge-blocks-2048-style.html)
- [TINY BAKER RAINBOW BUTTERCREAM CAKE](https://studyplayings.web.app/tiny-baker-rainbow-buttercream-cake.html)
- [CARGO SKATES](https://studyplayings.pages.dev/cargo-skates.html)
- [MOUNTAIN BUS DRIVER](https://quizverses.github.io/mountain-bus-driver.html)
- [3 TILES](https://thelearnquesters.pages.dev/3-tiles.html)
- [DUNGEON MASTER CULT CRAFT](https://quizverses.github.io/dungeon-master-cult-craft.html)
- [RAINBOW FRIENDS HIDE AND SEEK](https://studyplayings.web.app/rainbow-friends-hide-and-seek.html)
- [CRAZY VAN](https://thelearnquester.web.app/crazy-van.html)
- [BEAT MUSIC BATTLE](https://thequizzone.pages.dev/beat-music-battle.html)
- [CATEGORY ADVENTURE 3](https://studyquests.pages.dev/category-adventure-3.html)
- [WORD STARS](https://thelearnquesters.pages.dev/word-stars.html)
- [BRAIN TEST IQ CHALLENGE 2](https://thequizzone.pages.dev/brain-test-iq-challenge-2.html)
- [CUTE SHEEP SKYBLOCK](https://thelearnquester.web.app/cute-sheep-skyblock.html)
- [MUKI WIZARD](https://quizverses-9d2f2.web.app/muki-wizard.html)
- [FRUIT JAM MERGE PUZZLE GAME](https://quizverses.pages.dev/fruit-jam-merge-puzzle-game.html)
- [IDLE MERGE CAR AND RACE](https://thequizzone.pages.dev/idle-merge-car-and-race.html)
- [CATEGORY SHOOTER](https://thelearnquester.web.app/category-shooter.html)
- [HEXA TILE MASTER](https://thelearnquester.web.app/hexa-tile-master.html)
- [SWIPETOWN](https://quizverses-9d2f2.web.app/swipetown.html)
- [FOOTBALL SUPERSTARS 2026](https://thequizzone.pages.dev/football-superstars-2026.html)
- [GOKARTS IO](https://thelearnquesters.pages.dev/gokarts-io.html)
- [CAR JAM ESCAPE](https://thelearnquesters.pages.dev/car-jam-escape.html)
- [SPRUNKI FIND THE DIFFERENCES](https://studyplaying.github.io/sprunki-find-the-differences.html)
