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
- [GOON BALL](https://quizverses-9d2f2.web.app/goon-ball.html)
- [CATEGORY BALL173](https://studyquests.github.io/category-ball173.html)
- [ASMR NAIL TREATMENT](https://quizverses.github.io/asmr-nail-treatment.html)
- [CAPYBARA MUKBANG ASMR](https://themindzone.pages.dev/capybara-mukbang-asmr.html)
- [CATEGORY HORROR90](https://quizverses.github.io/category-horror90.html)
- [GT FLYING CAR RACING](https://studyquests.github.io/gt-flying-car-racing.html)
- [SITEMAP](https://brainquests-fb2c5.web.app/sitemap.html)
- [CATEGORY AGILITY 2](https://studyquests.github.io/category-agility-2.html)
- [SITEMAP](https://cryptotify.vercel.app/sitemap.html)
- [ONLINE PORTAL](https://cryptotify.pages.dev/)
- [TERMS](https://cryptotify.web.app/terms.html)
- [INDEX27](https://quizverses.github.io/index27.html)
- [CATEGORY BUBBLE SHOOTER27](https://quizverses.github.io/category-bubble-shooter27.html)
- [LEAP OF LIFE](https://studyquests.github.io/leap-of-life.html)
- [CATEGORY IO](https://quizverses.github.io/category-io.html)
- [BOMB HEAD HOT POTATO](https://studyquests.github.io/bomb-head-hot-potato.html)
- [CATEGORY 1 PLAYER139](https://quizverses.github.io/category-1-player139.html)
- [TRUCK STACK COLORS](https://studyquesthub.web.app/truck-stack-colors.html)
- [CATEGORY 3D1 371](https://studyquests.github.io/category-3d1-371.html)
- [DRAGON EGG MASTER](https://studyquests.github.io/dragon-egg-master.html)
- [INDEX31](https://quizverses.github.io/index31.html)
- [INDEX36](https://quizverses.github.io/index36.html)
- [TERMS](https://cryptotify.github.io/terms.html)
- [CATEGORY CLASSIC98](https://studyquests.github.io/category-classic98.html)
- [INDEX19](https://quizverses.github.io/index19.html)
- [CAT PANCAKE DINER](https://studyquests.github.io/cat-pancake-diner.html)
- [MOTO STUNTS DRIVING RACING](https://studyquests.github.io/moto-stunts-driving-racing.html)
- [CATEGORY ADVENTURE 3](https://quizverses.github.io/category-adventure-3.html)
- [SITEMAP](https://brainquests.netlify.app/sitemap.html)
- [NO PAIN NO GAIN RAGDOLL SANDBOX](https://quizverses.pages.dev/no-pain-no-gain-ragdoll-sandbox.html)
- [OM NOM RUN](https://quizverses.pages.dev/om-nom-run.html)
- [FIND OBJECTS HIDDEN ITEM](https://quizverses.pages.dev/find-objects-hidden-item.html)
- [INDEX23](https://quizverses.github.io/index23.html)
- [TB AVATARIA LIFE GIRL](https://quizverses.pages.dev/tb-avataria-life-girl.html)
- [FAMILY SQUID CHALLENGE](https://studyquests.github.io/family-squid-challenge.html)
- [ONLINE PORTAL](https://cryptotify.web.app/)
- [CATEGORY DRESS UP97](https://studyquests.github.io/category-dress-up97.html)
- [INDEX28](https://quizverses.github.io/index28.html)
- [PRIVACY](https://cryptotify.web.app/privacy.html)
- [ONLINE PORTAL](https://brainquests.netlify.app/)
- [TERMS](https://cryptotify.netlify.app/terms.html)
- [CRAZY AXE](https://quizverses.pages.dev/crazy-axe.html)
- [GLAMOUR BEACHLIFE](https://studyquests.github.io/glamour-beachlife.html)
- [WIRE CONNECT](https://quizverses.github.io/wire-connect.html)
- [COLOR BLOCK SORT](https://quizverses.github.io/color-block-sort.html)
- [PARKOUR BLOCK OBBY](https://quizverses.github.io/parkour-block-obby.html)
- [YOUTUBER MCRAFT 2PLAYER](https://studyquests.github.io/youtuber-mcraft-2player.html)
- [CATEGORY PUZZLE 11](https://quizverses.github.io/category-puzzle-11.html)
- [MY HAPPY FARM](https://quizverses.pages.dev/my-happy-farm.html)
- [GLACIER RUSH](https://quizverses.github.io/glacier-rush.html)
- [MUSIC CAT PIANO TILES GAME 3D](https://quizverses.pages.dev/music-cat-piano-tiles-game-3d.html)
- [PARK FEVER](https://quizverses.github.io/park-fever.html)
- [SLIDING PUZZLE](https://quizverses.pages.dev/sliding-puzzle.html)
- [OCEAN KIDS BACK TO SCHOOL](https://quizverses.pages.dev/ocean-kids-back-to-school.html)
- [CATEGORY FPS](https://studyquests.github.io/category-fps.html)
- [MAGIC CHRISTMAS TREE MATCH 3](https://quizverses.github.io/magic-christmas-tree-match-3.html)
- [VALENTINE HIDDEN HEART](https://quizverses.pages.dev/valentine-hidden-heart.html)
- [INDEX24](https://studyquests.github.io/index24.html)
- [DIRTY MONEY THE RICH GET RICH](https://studyquests.github.io/dirty-money-the-rich-get-rich.html)
- [CATEGORY 3D1 383](https://studyquests.github.io/category-3d1-383.html)
- [LIPSTICK COLLECTOR RUN](https://quizverses.github.io/lipstick-collector-run.html)
- [CATEGORY AGILITY](https://quizverses.github.io/category-agility.html)
- [WOODOKU BLOCK PUZZLE](https://quizverses.github.io/woodoku-block-puzzle.html)
- [2048 BLOCK FUSION](https://studyquests.github.io/2048-block-fusion.html)
- [CATEGORY RACING127](https://quizverses.github.io/category-racing127.html)
- [CATEGORY BALL175](https://studyquests.github.io/category-ball175.html)
- [SUMMER AESTHETICS](https://quizverses.github.io/summer-aesthetics.html)
- [INDEX19](https://studyquests.github.io/index19.html)
- [ARROW CUBE ESCAPE](https://studyquests.github.io/arrow-cube-escape.html)
- [AIR STRIKE 2D](https://quizverses.github.io/air-strike-2d.html)
- [CATEGORY ADVENTURE](https://quizverses.github.io/category-adventure.html)
- [KNIFE MASTER BALL RACING](https://quizverses.github.io/knife-master-ball-racing.html)
- [DOMINO ADVENTURE](https://studyquests.github.io/domino-adventure.html)
- [HUNGRY CORGI CUTE MUSIC GAME](https://quizverses.github.io/hungry-corgi-cute-music-game.html)
- [CATEGORY BLOCK91](https://studyquests.github.io/category-block91.html)
- [UNSCREW THEM ALL](https://quizverses.github.io/unscrew-them-all.html)
- [INDEX6](https://quizverses.github.io/index6.html)
- [MAKEUP FRUITS](https://quizverses.pages.dev/makeup-fruits.html)
- [STICKMAN PUNISHMENT](https://studyquests.github.io/stickman-punishment.html)
- [CATEGORY ANIMAL215](https://studyquesthub.web.app/category-animal215.html)
- [CATEGORY SOLITAIRE27](https://quizverses.github.io/category-solitaire27.html)
- [CATEGORY FPS175](https://studyquests.github.io/category-fps175.html)
- [INDEX25](https://quizverses.github.io/index25.html)
- [FUNNY FEVER HOSPITAL](https://quizverses.pages.dev/funny-fever-hospital.html)
- [FASHION MAKEOVER DASH](https://quizverses.github.io/fashion-makeover-dash.html)
- [CAR JAM ESCAPE](https://quizverses.github.io/car-jam-escape.html)
- [PAPERWARIO](https://quizverses.github.io/paperwario.html)
- [CATEGORY ROBOT49](https://quizverses.github.io/category-robot49.html)
- [DRAW TO HOME 3D](https://studyquests.github.io/draw-to-home-3d.html)
- [CATEGORY INCREMENTAL388](https://quizverses-9d2f2.web.app/category-incremental388.html)
- [FLAPPY RUSH](https://studyquests.github.io/flappy-rush.html)
- [CATEGORY POOL 2](https://quizverses.pages.dev/category-pool-2.html)
- [ICE CREAM SORT](https://studyquests.github.io/ice-cream-sort.html)
- [PECKSHOT](https://quizverses.pages.dev/peckshot.html)
- [PERFECT TIDY](https://quizverses.pages.dev/perfect-tidy.html)
- [FOOT HOSPITAL](https://quizverses-9d2f2.web.app/foot-hospital.html)
- [WIRE CONNECT](https://quizverses.pages.dev/wire-connect.html)
- [ELLIE CHRISTMAS MAKEUP](https://studyquests.github.io/ellie-christmas-makeup.html)
- [CAPYBARA XMAS MERGE](https://quizverses.pages.dev/capybara-xmas-merge.html)
- [INDEX30](https://quizverses.github.io/index30.html)
- [MR RECKLESS CAR CHASE SIMULATOR](https://quizverses.pages.dev/mr-reckless-car-chase-simulator.html)
- [PARKING FURY 3D BEACH CITY 2](https://quizverses.pages.dev/parking-fury-3d-beach-city-2.html)
- [CATEGORY SHOOTER 2](https://thelearnquester.web.app/category-shooter-2.html)
- [TIC TAC TOE MATCH THREE](https://studyplayings.web.app/tic-tac-toe-match-three.html)
- [CARNAGE BATTLE ARENA](https://studyplayings.web.app/carnage-battle-arena.html)
- [CUBE DROP PUZZLE](https://quizverses-9d2f2.web.app/cube-drop-puzzle.html)
- [GIANT CROWD IO HOUSE CAPTURE](https://quizverses.pages.dev/giant-crowd-io-house-capture.html)
- [SUPER KID ADVENTURE](https://studyplayings.web.app/super-kid-adventure.html)
- [CATEGORY MAGIC46](https://studyplayings.pages.dev/category-magic46.html)
- [MR BOUNCE](https://studyplayings.pages.dev/mr-bounce.html)
- [SLAP MAN](https://studyplayings.web.app/slap-man.html)
- [HIGH HEELS COLLECT RUN](https://studyquests.github.io/high-heels-collect-run.html)
- [THE SORTING MART](https://studyquests.github.io/the-sorting-mart.html)
- [HORSE RACING DERBY QUEST](https://studyquests.github.io/horse-racing-derby-quest.html)
- [CATEGORY IDLE CLICKER GAME](https://quizverses.pages.dev/category-idle-clicker-game.html)
- [TERMS](https://brainquests.netlify.app/terms.html)
- [CHILDCARE MASTER ONLINE](https://studyplayings.web.app/childcare-master-online.html)
- [MERGE HAVEN](https://quizverses.pages.dev/merge-haven.html)
- [MINER CAT 4](https://studyplayings.web.app/miner-cat-4.html)
- [CATEGORY FOOTBALL](https://studyplayings.pages.dev/category-football.html)
- [HEXANAUT IO](https://studyplayings.web.app/hexanaut-io.html)
- [PHOTO BLOCK JOURNEY](https://quizverses-9d2f2.web.app/photo-block-journey.html)
- [CATEGORY FASHION](https://studyplayings.pages.dev/category-fashion.html)
- [MIRACLE MAHJONG](https://studyquests.github.io/miracle-mahjong.html)
- [INDEX13](https://studyquesthub.web.app/index13.html)
- [THE TRENDY MERMAID](https://studyplayings.web.app/the-trendy-mermaid.html)
- [COFFEE CRAZE SORTING GAME](https://studyplayings.web.app/coffee-craze-sorting-game.html)
- [CATEGORY BATTLE](https://studyplayings.pages.dev/category-battle.html)
- [LIMITED DEFENSE](https://quizverses-9d2f2.web.app/limited-defense.html)
- [CATEGORY CASUAL971](https://quizverses-9d2f2.web.app/category-casual971.html)
