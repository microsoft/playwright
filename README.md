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
- [STICKMAN RESCUE DRAW 2 SAVE](https://themindplay.pages.dev/stickman-rescue-draw-2-save.html)
- [STICK TACTICS DESTRUCTION](https://quizverses.github.io/stick-tactics-destruction.html)
- [PACKING LINE](https://studyplayings.web.app/packing-line.html)
- [CATEGORY MYSTERY45](https://thelearnquesters.pages.dev/category-mystery45.html)
- [CATEGORY TOP DOWN251](https://thelearnquester.web.app/category-top-down251.html)
- [INDEX18](https://studyquests.pages.dev/index18.html)
- [CATEGORY SPACE](https://studyquesthub.web.app/category-space.html)
- [CATEGORY HORROR](https://studyplayings.web.app/category-horror.html)
- [LITTLE BUGS](https://quizverses.github.io/little-bugs.html)
- [PRINCESS DRESS UP RUN](https://thelearnquester.web.app/princess-dress-up-run.html)
- [CATEGORY HUB](https://thelearnquester.web.app/category-hub.html)
- [COSMIC TETRIZ PUZZLES](https://studyplaying.github.io/cosmic-tetriz-puzzles.html)
- [DRAW BRIDGE CHALLENGE](https://studyquests.github.io/draw-bridge-challenge.html)
- [CATEGORY SHOOTER 2](https://thelearnquester.web.app/category-shooter-2.html)
- [CATEGORY SOCCER60](https://thelearnquester.web.app/category-soccer60.html)
- [CATEGORY PUZZLE 3](https://thelearnquester.web.app/category-puzzle-3.html)
- [LAND CRUISER OFFROAD DRIVER](https://studyquests.github.io/land-cruiser-offroad-driver.html)
- [HEAD JUMP](https://studyquests.github.io/head-jump.html)
- [SPIDER ROPE HERO CITY FIGHT](https://studyquests.github.io/spider-rope-hero-city-fight.html)
- [CATEGORY HORROR 2](https://thelearnquester.web.app/category-horror-2.html)
- [CATEGORY MINING75](https://studyquests.github.io/category-mining75.html)
- [CATEGORY CASUAL 5](https://studyplayings.web.app/category-casual-5.html)
- [HIPPO SUPERMARKET](https://studyquests.pages.dev/hippo-supermarket.html)
- [JELLY MATH 3D](https://quizverses-9d2f2.web.app/jelly-math-3d.html)
- [CATEGORY BRAIN261](https://studyplayings.web.app/category-brain261.html)
- [CATEGORY PROXY LIST](https://thelearnquester.web.app/category-proxy-list.html)
- [SID GINNY Y2K GLAM CLASH](https://studyplaying.github.io/sid-ginny-y2k-glam-clash.html)
- [CATEGORY BATTLESHIP19](https://studyquests.pages.dev/category-battleship19.html)
- [PUPPY TREAT SORTING](https://quizverses.github.io/puppy-treat-sorting.html)
- [CATEGORY MISSION207](https://thelearnquester.web.app/category-mission207.html)
- [CATEGORY CAR 2](https://studyquests.github.io/category-car-2.html)
- [COSMO PET STARRY CARE](https://quizverses.github.io/cosmo-pet-starry-care.html)
- [FLAG MASTER WORLD FLAGS QUIZ](https://studyplayings.web.app/flag-master-world-flags-quiz.html)
- [TILEMAN IO](https://studyplaying.github.io/tileman-io.html)
- [MONSTER SCHOOL VS SIREN HEAD](https://studyquests.github.io/monster-school-vs-siren-head.html)
- [ARROW ESCAPE MASTER](https://quizverses.github.io/arrow-escape-master.html)
- [JUMPERS QUEST](https://quizverses-9d2f2.web.app/jumpers-quest.html)
- [CATEGORY STRATEGY](https://studyplayings.web.app/category-strategy.html)
- [STYLE ICONS 2024 REWIND EDITION](https://thelearnquester.web.app/style-icons-2024-rewind-edition.html)
- [SPRUNKI TORCHES MAZE](https://quizverses-9d2f2.web.app/sprunki-torches-maze.html)
- [GLAMOUR BEACHLIFE](https://studyquests.github.io/glamour-beachlife.html)
- [CUBEREALM IO](https://studyplaying.github.io/cuberealm-io.html)
- [CATEGORY QUIZ40](https://studyplaying.github.io/category-quiz40.html)
- [CATEGORY MOUSE1 707](https://thelearnquester.web.app/category-mouse1-707.html)
- [MOVE EMOJI](https://quizverses.pages.dev/move-emoji.html)
- [CATEGORY LOVE12](https://thelearnquester.web.app/category-love12.html)
- [CATEGORY RAGDOLL57](https://thelearnquester.web.app/category-ragdoll57.html)
- [CATEGORY BASKETBALL 2](https://thelearnquester.web.app/category-basketball-2.html)
- [CATEGORY BATTLE GAMES](https://studyquests.pages.dev/category-battle-games.html)
- [CATEGORY PIXEL313](https://thelearnquester.web.app/category-pixel313.html)
- [ZOMBIES AND GUNS](https://studyplaying.github.io/zombies-and-guns.html)
- [CATEGORY PREMIUM PERKS74](https://thelearnquester.web.app/category-premium-perks74.html)
- [CHROME CARS GARAGE](https://studyquests.github.io/chrome-cars-garage.html)
- [INDEX10](https://studyquests.pages.dev/index10.html)
- [CATEGORY IDLE448](https://quizverses.pages.dev/category-idle448.html)
- [NINJA CLIMB](https://studyquests.github.io/ninja-climb.html)
- [MEDIEVAL ESCAPE](https://studyplayings.web.app/medieval-escape.html)
- [SQUID ESCAPE BUT BLOCKWORLD](https://quizverses-9d2f2.web.app/squid-escape-but-blockworld.html)
- [HOUSE ROBBER](https://studyquests.pages.dev/house-robber.html)
- [WORDS MATCH](https://studyplaying.github.io/words-match.html)
- [MAGIC PIANO MUSIC](https://studyquests.github.io/magic-piano-music.html)
- [CATEGORY SURVIVAL366](https://studyplayings.web.app/category-survival366.html)
- [SUPER TANK WRESTLE](https://quizverses.pages.dev/super-tank-wrestle.html)
- [STEAL BRAINROT DUEL](https://quizverses.github.io/steal-brainrot-duel.html)
- [CATEGORY FPS](https://learnquester.pages.dev/category-fps.html)
- [MONSTER TRUCK CRUSH](https://quizverses-9d2f2.web.app/monster-truck-crush.html)
- [POTION SORT](https://quizverses.github.io/potion-sort.html)
- [BLOSSOM](https://quizverses.pages.dev/blossom.html)
- [CATEGORY BIKE 2](https://studyplayings.web.app/category-bike-2.html)
- [CATEGORY SHOOTER](https://studyplayings.web.app/category-shooter.html)
- [CATEGORY POINT AND CLICK124](https://thelearnquester.web.app/category-point-and-click124.html)
- [THE SUPERHERO LEAGUE](https://quizverses.pages.dev/the-superhero-league.html)
- [GOLDEN FRONTIER](https://studyquests.github.io/golden-frontier.html)
- [GOBATTLEIO](https://quizverses-9d2f2.web.app/gobattleio.html)
- [FLOWER BLOCK](https://learnquester.github.io/flower-block.html)
- [ZOMBIE ARENA 2 FURY ROAD](https://quizverses-9d2f2.web.app/zombie-arena-2-fury-road.html)
- [MATH KING MATH SKILL GAME](https://studyquests.pages.dev/math-king-math-skill-game.html)
- [FRUIT PARTY](https://thelearnquester.web.app/fruit-party.html)
- [INDEX22](https://studyplaying.github.io/index22.html)
- [CATEGORY CASUAL971](https://studyplaying.github.io/category-casual971.html)
- [ALCHEMY PUZZLE](https://studyplaying.github.io/alchemy-puzzle.html)
- [BUBBLE SHOOTER VALENTINE](https://studyquests.github.io/bubble-shooter-valentine.html)
- [GEOMETRY VIBES X BALL](https://studyplayings.web.app/geometry-vibes-x-ball.html)
- [RIDDLEMATH](https://quizverses.github.io/riddlemath.html)
- [FARM DEFENSE](https://thelearnquester.web.app/farm-defense.html)
- [BRAINROT BRIDGE RACE 3D](https://studyquests.pages.dev/brainrot-bridge-race-3d.html)
- [CATEGORY BASKETBALL 2](https://studyplaying.github.io/category-basketball-2.html)
- [FOOT HOSPITAL](https://studyplaying.github.io/foot-hospital.html)
- [TRAFFIC RUN PUZZLE](https://thelearnquester.web.app/traffic-run-puzzle.html)
- [ALIEN HUNTERS](https://studyquests.github.io/alien-hunters.html)
- [OBBY CARDS THE LEGEND HUNT](https://quizverses-9d2f2.web.app/obby-cards-the-legend-hunt.html)
- [TWO DOTS REMASTERED](https://studyquests.github.io/two-dots-remastered.html)
- [CATEGORY GUN241](https://quizverses-9d2f2.web.app/category-gun241.html)
- [INDEX15](https://studyplaying.github.io/index15.html)
- [THE SUPERHERO LEAGUE](https://quizverses.github.io/the-superhero-league.html)
- [DRAW TO FLY](https://quizverses.github.io/draw-to-fly.html)
- [CATEGORY ANIMAL216](https://studyquests.pages.dev/category-animal216.html)
- [HALLOWEEN CHALLENGE](https://studyplaying.github.io/halloween-challenge.html)
- [BRIDGE FIGHT](https://quizverses.github.io/bridge-fight.html)
- [CATEGORY SECURLY](https://thelearnquester.web.app/category-securly.html)
- [ANIMAL MERGE BUBBLE SHOOTER](https://quizverses.github.io/animal-merge-bubble-shooter.html)
- [CATEGORY OBBY56](https://quizverses.pages.dev/category-obby56.html)
- [MUSHROOM FEVER MATCH 3](https://quizverses-9d2f2.web.app/mushroom-fever-match-3.html)
- [HIDE AND SEEK BLUE MONSTER](https://quizverses.github.io/hide-and-seek-blue-monster.html)
- [1945 AIR FORCE SPACE SHOOTER](https://thelearnquester.web.app/1945-air-force-space-shooter.html)
- [CATEGORY MOBILE2 095](https://thelearnquester.web.app/category-mobile2-095.html)
- [PING PONG AIR](https://learnquester.github.io/ping-pong-air.html)
- [CATEGORY BOOKMARK](https://studyplaying.github.io/category-bookmark.html)
- [ISOMETRIC ESCAPE 2](https://studyquests.github.io/isometric-escape-2.html)
- [MOBILE PHONE CASE DIY](https://studyplaying.github.io/mobile-phone-case-diy.html)
- [SNAKE CLASH](https://quizverses.github.io/snake-clash.html)
- [POWER PUZZLE](https://studyquesthub.web.app/power-puzzle.html)
- [BARRY PRISON CHRISTMAS ADVENTURE](https://studyplayings.web.app/barry-prison-christmas-adventure.html)
- [GAS STATION JUNKYARD TYCOON](https://studyplaying.github.io/gas-station-junkyard-tycoon.html)
- [CATEGORY SNAKE](https://thelearnquester.web.app/category-snake.html)
- [OBBY TOWER PARKOUR CLIMB](https://studyplaying.github.io/obby-tower-parkour-climb.html)
- [COWBOYS DUEL](https://studyquests.github.io/cowboys-duel.html)
- [WORLDCRAFT 3](https://studyplaying.github.io/worldcraft-3.html)
- [CANDY MATCH PUZZLE](https://learnquester.github.io/candy-match-puzzle.html)
- [CUBE DROP PUZZLE](https://quizverses.github.io/cube-drop-puzzle.html)
- [CRAZY ALIEN ADVENTURE](https://studyplaying.github.io/crazy-alien-adventure.html)
- [FRUIT MERGE JUICY DROP GAME](https://quizverses.github.io/fruit-merge-juicy-drop-game.html)
- [LAST WAR SURVIVAL](https://studyplaying.github.io/last-war-survival.html)
- [FIND OBJECTS HIDDEN ITEM](https://quizverses.pages.dev/find-objects-hidden-item.html)
- [NONOGRAM DAILY](https://studyplaying.github.io/nonogram-daily.html)
- [LOVIE CHICS SPRING BREAK FASHION](https://quizverses-9d2f2.web.app/lovie-chics-spring-break-fashion.html)
- [TAP GO DELUXE](https://thelearnquester.web.app/tap-go-deluxe.html)
- [STREET RACING MOTO DRIFT](https://studyquests.pages.dev/street-racing-moto-drift.html)
- [SCARY PAIRS](https://studyplayings.web.app/scary-pairs.html)
- [TOWER OF HELL OBBY BLOX](https://quizverses.github.io/tower-of-hell-obby-blox.html)
