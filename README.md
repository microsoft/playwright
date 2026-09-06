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
- [MR RECKLESS CAR CHASE SIMULATOR](https://themindzone.pages.dev/mr-reckless-car-chase-simulator.html)
- [MONA LISA FASHION EXPERIMENTS](https://learnquester.github.io/mona-lisa-fashion-experiments.html)
- [IDLE BATHROOM EMPIRE TYCOON](https://studyquests.pages.dev/idle-bathroom-empire-tycoon.html)
- [CATEGORY RPG80](https://studyquests.pages.dev/category-rpg80.html)
- [SOFT GIRLS WINTER AESTHETICS](https://studyplaying.github.io/soft-girls-winter-aesthetics.html)
- [HORROR MINECRAFT PARTYTIME](https://studyplaying.github.io/horror-minecraft-partytime.html)
- [CATEGORY COLLECT565](https://studyplayings.web.app/category-collect565.html)
- [RIDE SHOOTER](https://studyplayings.web.app/ride-shooter.html)
- [LABO BRICK TRAIN GAME FOR KIDS](https://studyplaying.github.io/labo-brick-train-game-for-kids.html)
- [CATEGORY RAGDOLL57](https://studyplayings.web.app/category-ragdoll57.html)
- [CATCH THE GOOSE](https://studyplaying.github.io/catch-the-goose.html)
- [GUN BUILDER](https://quizverses.github.io/gun-builder.html)
- [CATEGORY MAHJONG CONNECT](https://studyplayings.web.app/category-mahjong-connect.html)
- [GUN BUILDER](https://studyplaying.github.io/gun-builder.html)
- [ROBLOX CRAFT RUN](https://studyquests.github.io/roblox-craft-run.html)
- [CATEGORY LOL41](https://studyplayings.web.app/category-lol41.html)
- [ROOM SORT](https://studyplaying.github.io/room-sort.html)
- [BRAT GIRL SUMMER](https://quizverses.github.io/brat-girl-summer.html)
- [ITALIAN ANIMALS CREATE YOUR OWN BRAINROT](https://studyquests.github.io/italian-animals-create-your-own-brainrot.html)
- [CATEGORY PARTY23](https://studyplayings.web.app/category-party23.html)
- [UNICORN FIND THE DIFFERENCES](https://quizverses.github.io/unicorn-find-the-differences.html)
- [FLOW BLOCK](https://studyplaying.github.io/flow-block.html)
- [CATEGORY CONTROLLER 2](https://studyplayings.web.app/category-controller-2.html)
- [GT FLYING CAR RACING](https://studyquests.github.io/gt-flying-car-racing.html)
- [CATEGORY CASUAL 7](https://studyplayings.web.app/category-casual-7.html)
- [CATEGORY THINKY](https://studyquests.pages.dev/category-thinky.html)
- [BLOCK DIGGER](https://thelearnquester.web.app/block-digger.html)
- [HERO TOWER WAR](https://thelearnquester.web.app/hero-tower-war.html)
- [MEGA ESCAPE CAR PARKING PUZZLE](https://studyquests.pages.dev/mega-escape-car-parking-puzzle.html)
- [HIGH HEELS 2](https://thelearnquester.web.app/high-heels-2.html)
- [CATEGORY SOLITAIRE27](https://thelearnquester.web.app/category-solitaire27.html)
- [HARVESTING VEGGIES](https://studyplayings.pages.dev/harvesting-veggies.html)
- [BRAINROT HOOK SWING](https://studyquests.github.io/brainrot-hook-swing.html)
- [INDEX34](https://quizverses.github.io/index34.html)
- [BUILD A QUEEN 2025](https://studyquests.pages.dev/build-a-queen-2025.html)
- [ASMR TATTOO TREATMENT](https://studyquests.github.io/asmr-tattoo-treatment.html)
- [DYNAMONS 7](https://thelearnquester.web.app/dynamons-7.html)
- [HORROR ESCAPE GRANNY ROOM](https://studyplayings.web.app/horror-escape-granny-room.html)
- [CATEGORY FPS](https://quizverses.github.io/category-fps.html)
- [PRACTICE ON ME](https://studyquests.github.io/practice-on-me.html)
- [IDLE DRIVE MERGE UPGRADE DRIVE](https://studyplayings.web.app/idle-drive-merge-upgrade-drive.html)
- [CATEGORY CASUAL](https://studyplayings.web.app/category-casual.html)
- [IMPOSTER 3D](https://quizverses.github.io/imposter-3d.html)
- [CATEGORY SCRATCH17](https://studyplayings.web.app/category-scratch17.html)
- [MARBLE RUN ULTIMATE RACE](https://studyplayings.web.app/marble-run-ultimate-race.html)
- [CATEGORY FOOD95](https://studyquesthub.web.app/category-food95.html)
- [CATEGORY TOWER DEFENSE](https://studyquests.github.io/category-tower-defense.html)
- [HIT BALL](https://quizverses.github.io/hit-ball.html)
- [BRAIN PUZZLE TRICKY CHOICES](https://studyquests.github.io/brain-puzzle-tricky-choices.html)
- [CATEGORY BATTLE ROYALE](https://quizverses.github.io/category-battle-royale.html)
- [TYPE SPRINT](https://studyplayings.web.app/type-sprint.html)
- [CATEGORY SOLITAIRE27](https://studyquesthub.web.app/category-solitaire27.html)
- [RESCUE RIFT](https://quizverses.pages.dev/rescue-rift.html)
- [ROLLING BALLS SEA RACE](https://thelearnquester.web.app/rolling-balls-sea-race.html)
- [MERGE FLOWERS](https://studyplayings.web.app/merge-flowers.html)
- [HIDE ME](https://studyquests.pages.dev/hide-me.html)
- [FIND THE GHOST CAT](https://studyquests.pages.dev/find-the-ghost-cat.html)
- [INDEX7](https://quizverses.github.io/index7.html)
- [BUILD A GO KART](https://studyplayings.web.app/build-a-go-kart.html)
- [FIND THE GHOST CAT](https://quizverses.github.io/find-the-ghost-cat.html)
- [CATEGORY MERGE](https://quizverses.github.io/category-merge.html)
- [CATEGORY FASHION105](https://studyquesthub.web.app/category-fashion105.html)
- [SWEET HAUNT 2](https://studyquests.github.io/sweet-haunt-2.html)
- [MOTORCYCLE RACER ROAD MAYHEM](https://studyquests.github.io/motorcycle-racer-road-mayhem.html)
- [CATEGORY HORROR90](https://studyquesthub.web.app/category-horror90.html)
- [VEGAMIX DA VINCI PUZZLES](https://studyplayings.web.app/vegamix-da-vinci-puzzles.html)
- [3D SUPER ROLLING BALL RACE](https://thelearnquester.web.app/3d-super-rolling-ball-race.html)
- [WORLD SOCCER](https://studyplaying.github.io/world-soccer.html)
- [CATEGORY 2D1 060](https://studyplayings.pages.dev/category-2d1-060.html)
- [CATEGORY PUZZLE 3](https://quizverses.github.io/category-puzzle-3.html)
- [SHOP SORTING 2](https://quizverses.github.io/shop-sorting-2.html)
- [DINO SIMULATOR CITY ATTACK](https://studyplayings.web.app/dino-simulator-city-attack.html)
- [WOODS OF NEVIA FOREST SURVIVAL](https://studyquests.github.io/woods-of-nevia-forest-survival.html)
- [SPACEFLIGHT SIMULATOR](https://studyquests.pages.dev/spaceflight-simulator.html)
- [CATEGORY QUIZ](https://studyplayings.web.app/category-quiz.html)
- [DEAD ZONE MECH OPS](https://studyquests.github.io/dead-zone-mech-ops.html)
- [BALLS VS LASERS](https://studyplaying.github.io/balls-vs-lasers.html)
- [CATEGORY CAT](https://studyplayings.web.app/category-cat.html)
- [CATEGORY MATCH 3117](https://studyquesthub.web.app/category-match-3117.html)
- [NG FLOW LINES](https://studyquests.github.io/ng-flow-lines.html)
- [BACKWOODS](https://quizverses.github.io/backwoods.html)
- [INDEX11](https://studyplayings.pages.dev/index11.html)
- [TILEMAN IO](https://thelearnquester.web.app/tileman-io.html)
- [MOTO ATTACK BIKE RACING](https://studyplaying.github.io/moto-attack-bike-racing.html)
- [FIND HIDDEN SECRETS](https://thelearnquesters.pages.dev/find-hidden-secrets.html)
- [TERMS](https://learnquesters.pages.dev/terms.html)
- [BLOCK PUZZLE SLIDE BLOCK JAM](https://thequizzone.pages.dev/block-puzzle-slide-block-jam.html)
- [MANSION STORY MATCH](https://studyplayings.web.app/mansion-story-match.html)
- [CATEGORY SPACE](https://thelearnquester.web.app/category-space.html)
- [ELEMENTAL GLOVES MAGIC POWER](https://thelearnquesters.pages.dev/elemental-gloves-magic-power.html)
- [LAST UFO DEFENSE](https://studyquests.github.io/last-ufo-defense.html)
- [CATEGORY BIKE 2](https://thelearnquesters.pages.dev/category-bike-2.html)
- [OBBY ESCAPE FROM TSUNAMI BRAINROT](https://studyplayings.web.app/obby-escape-from-tsunami-brainrot.html)
- [CATEGORY MAHJONG 2](https://studyquesthub.web.app/category-mahjong-2.html)
- [CATEGORY LOVE12](https://thelearnquester.web.app/category-love12.html)
- [CATEGORY BATTLE524](https://thequizzone.pages.dev/category-battle524.html)
- [AUTO NINJA](https://studyquests.github.io/auto-ninja.html)
- [CATEGORY BLOCK94](https://studyquesthub.web.app/category-block94.html)
- [METAXIS](https://quizverses.github.io/metaxis.html)
- [CATEGORY FASHION](https://learnquester.pages.dev/category-fashion.html)
- [CATEGORY SPACE](https://thequizzone.pages.dev/category-space.html)
- [CATEGORY BLOCK94](https://thelearnquesters.pages.dev/category-block94.html)
- [MERGE SQUARES](https://thelearnquesters.pages.dev/merge-squares.html)
- [EAT DONUTS](https://studyplaying.github.io/eat-donuts.html)
- [CATEGORY CASUAL 17](https://thelearnquesters.pages.dev/category-casual-17.html)
- [POPPY STRIKE 5](https://thelearnquesters.pages.dev/poppy-strike-5.html)
- [COUNTRY LIFE MEADOWS](https://studyquests.pages.dev/country-life-meadows.html)
- [ROMANTIC MATCH TACTICS](https://thelearnquesters.pages.dev/romantic-match-tactics.html)
- [MR LONG HAND](https://studyquests.pages.dev/mr-long-hand.html)
- [CATEGORY DRESS UP](https://studyquests.github.io/category-dress-up.html)
- [CATEGORY MAKEUP51](https://thelearnquesters.pages.dev/category-makeup51.html)
- [ZOMBIE SURVIVAL](https://thelearnquesters.pages.dev/zombie-survival.html)
- [CUT THE GRASS 3D](https://quizverses.github.io/cut-the-grass-3d.html)
- [BALL MANIA](https://thelearnquesters.pages.dev/ball-mania.html)
- [CATEGORY IDLE](https://thequizzone.pages.dev/category-idle.html)
- [TILE HEX WORLD RED VS BLUE](https://quizverses.github.io/tile-hex-world-red-vs-blue.html)
- [CATEGORY PHYSICS371](https://thequizzone.pages.dev/category-physics371.html)
- [PUZZLE BLOCKS FILL IT COMPLETELY](https://studyplayings.web.app/puzzle-blocks-fill-it-completely.html)
- [LIVE 100 DAYS](https://studyplayings.web.app/live-100-days.html)
- [CATEGORY CASUAL 5](https://studyquesthub.web.app/category-casual-5.html)
- [CATEGORY CAR 3](https://thelearnquesters.pages.dev/category-car-3.html)
- [CATEGORY BATTLE](https://studyplayings.pages.dev/category-battle.html)
- [COSMO VOID](https://quizverses.github.io/cosmo-void.html)
- [CATEGORY PUZZLE 10](https://thelearnquesters.pages.dev/category-puzzle-10.html)
- [DELTA FORCE AIRBORNE](https://studyplayings.web.app/delta-force-airborne.html)
- [CUBE STACK 2048](https://thelearnquesters.pages.dev/cube-stack-2048.html)
- [TOILET ROLL](https://thelearnquesters.pages.dev/toilet-roll.html)
- [CATEGORY RACING DRIVING](https://quizverses.github.io/category-racing-driving.html)
- [CATEGORY MYSTERY45](https://thelearnquesters.pages.dev/category-mystery45.html)
- [ECHOLOCATION SHOOTER](https://thequizzone.pages.dev/echolocation-shooter.html)
