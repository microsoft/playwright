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
- [PANDA DASH AUTO SHOOTING](https://iskillquest.pages.dev/panda-dash-auto-shooting.html)
- [TRICKY CASTLE](https://quizverses.github.io/tricky-castle.html)
- [CATEGORY RELAXING223](https://quizverses.pages.dev/category-relaxing223.html)
- [THATS MY SEAT LOGIC PUZZLE](https://themindskillplayplay.pages.dev/thats-my-seat-logic-puzzle.html)
- [INDEX7](https://quizverses-9d2f2.web.app/index7.html)
- [NOOB JAILBREAK 2](https://learnquester.pages.dev/noob-jailbreak-2.html)
- [CATEGORY 2D1 070](https://themindplay.github.io/category-2d1-070.html)
- [FAMILY TREE EMOJI](https://themindplays.pages.dev/family-tree-emoji.html)
- [POPPING PETS](https://themindplays.pages.dev/popping-pets.html)
- [NINE CARDS OF WINTER](https://theskillquest.pages.dev/nine-cards-of-winter.html)
- [PHYSICS BOX 2](https://theskillquest.pages.dev/physics-box-2.html)
- [HOME RUSH THE FISH WAR](https://theskillquest.pages.dev/home-rush-the-fish-war.html)
- [SUMMER MAZE](https://themindplays.pages.dev/summer-maze.html)
- [PUZZLE MASTERS TRAVELERS](https://themindplay.pages.dev/puzzle-masters-travelers.html)
- [SNAKES](https://theskillquest.pages.dev/snakes.html)
- [BALL DUNK FALL](https://theskillquest.pages.dev/ball-dunk-fall.html)
- [CATEGORY QUIZ](https://studyquests.pages.dev/category-quiz.html)
- [TIED UP](https://studyplayings.web.app/tied-up.html)
- [GETTING OVER IT](https://theskillquest.pages.dev/getting-over-it.html)
- [ITALIAN BRAINROT SURVIVAL ARENA](https://studyplayings.web.app/italian-brainrot-survival-arena.html)
- [GROW A GARDEN ONLINE OFFLINE](https://themindplays.pages.dev/grow-a-garden-online-offline.html)
- [CINEMA EMPIRE IDLE TYCOON](https://themindplaying.web.app/cinema-empire-idle-tycoon.html)
- [HALLOWEEN FRUIT SLICE](https://theskillquest.pages.dev/halloween-fruit-slice.html)
- [CATEGORY JUMPING147](https://thelearnquester.web.app/category-jumping147.html)
- [PUZZLE BLOCKS CLASSIC](https://studyquests.github.io/puzzle-blocks-classic.html)
- [COP SIMULATOR](https://studyplayings.web.app/cop-simulator.html)
- [MATRIX TYPER](https://theskillquest.pages.dev/matrix-typer.html)
- [K WEDDING DREAM](https://quizverses.github.io/k-wedding-dream.html)
- [CRAZY TRAFFIC RACER](https://themindplays.pages.dev/crazy-traffic-racer.html)
- [DRIFTCLICKER](https://thelearnquester.web.app/driftclicker.html)
- [CATEGORY PUZZLE 9](https://iskillquest.pages.dev/category-puzzle-9.html)
- [CAPYBARA MUKBANG ASMR](https://studyquests.github.io/capybara-mukbang-asmr.html)
- [STAR ATTACK 3D](https://themindplays.pages.dev/star-attack-3d.html)
- [BUBBLE SHOOTER NEON](https://themindplay.pages.dev/bubble-shooter-neon.html)
- [MY PERFECT FARM](https://thelearnquesters.pages.dev/my-perfect-farm.html)
- [SIBERIAN ASSAULT](https://studyplayings.web.app/siberian-assault.html)
- [DANCE ON HOTSTEPS MOBILE](https://studyquests.github.io/dance-on-hotsteps-mobile.html)
- [SUMMER RIDER 3D](https://theskillquest.pages.dev/summer-rider-3d.html)
- [CONTRACT DEER HUNTER](https://studyquests.github.io/contract-deer-hunter.html)
- [CATEGORY HORDE SURVIVAL67](https://iskillquest.pages.dev/category-horde-survival67.html)
- [CATEGORY FOOTBALL](https://iskillquest.pages.dev/category-football.html)
- [SUNNY LINK](https://learnquesters.pages.dev/sunny-link.html)
- [BUBLIX BUBBLE HIT](https://studyplayings.web.app/bublix-bubble-hit.html)
- [MOB RUSH](https://studyquests.github.io/mob-rush.html)
- [HERO FIGHT CLASH](https://theskillquest.pages.dev/hero-fight-clash.html)
- [SOLITAIRE KLONDIKE](https://studyquests.github.io/solitaire-klondike.html)
- [MATH WALL SIMULATOR](https://thelearnquesters.pages.dev/math-wall-simulator.html)
- [CATEGORY CASUAL969](https://iskillquest.pages.dev/category-casual969.html)
- [THE SPECIMEN ZERO](https://quizverses.github.io/the-specimen-zero.html)
- [CATEGORY GUN238](https://thequizzone.pages.dev/category-gun238.html)
- [KNIT RESCUE](https://theskillquest.pages.dev/knit-rescue.html)
- [COSMIC AVIATOR](https://theskillquest.pages.dev/cosmic-aviator.html)
- [KNIFE UP 3D](https://quizverses.github.io/knife-up-3d.html)
- [GRAFFITI TAGS SPRAY PAINTING](https://theskillquest.pages.dev/graffiti-tags-spray-painting.html)
- [CATEGORY THINKY 2](https://learnquesters.pages.dev/category-thinky-2.html)
- [WORMS](https://thequizzone.pages.dev/worms.html)
- [CATEGORY SKILL256](https://quizverses-9d2f2.web.app/category-skill256.html)
- [BLACK PINK STPATRICKS DAY CONCERT](https://studyplayings.web.app/black-pink-stpatricks-day-concert.html)
- [BLOCK UP](https://studyquests.github.io/block-up.html)
- [FRUIT GOALS MATCH](https://theskillquest.pages.dev/fruit-goals-match.html)
- [INDEX17](https://themindplays.pages.dev/index17.html)
- [CATEGORY CASUAL 6](https://iskillquest.pages.dev/category-casual-6.html)
- [FUN TOWN PARKING](https://theskillquest.pages.dev/fun-town-parking.html)
- [VORTEX BALL](https://studyplayings.web.app/vortex-ball.html)
- [MONKEY BUBBLE DEFENSE](https://studyplayings.web.app/monkey-bubble-defense.html)
- [CATEGORY INTERSTELLAR](https://iskillquest.pages.dev/category-interstellar.html)
- [TRALALA CONNECT](https://theskillquest.pages.dev/tralala-connect.html)
- [HAPPY TOWN](https://theskillquest.pages.dev/happy-town.html)
- [CATEGORY MATCH 3117](https://learnquester.github.io/category-match-3117.html)
- [VOLLEY BEAN](https://quizverses-9d2f2.web.app/volley-bean.html)
- [BANK BOOM TUNG TUNG SAHUR](https://themindplaying.web.app/bank-boom-tung-tung-sahur.html)
- [WINTER GIFTS](https://theskillquest.pages.dev/winter-gifts.html)
- [STICKMAN ROGUE ONLINE](https://thelearnquesters.pages.dev/stickman-rogue-online.html)
- [INDEX18](https://studyplayings.pages.dev/index18.html)
- [CATEGORY SNIPER39](https://quizverses-9d2f2.web.app/category-sniper39.html)
- [PET SALON](https://theskillquest.pages.dev/pet-salon.html)
- [DIGITAL CIRCUS IO](https://themindplaying.web.app/digital-circus-io.html)
- [FARM MATCH SEASONS 3](https://thelearnquesters.pages.dev/farm-match-seasons-3.html)
- [SPOOKY HALLOWEEN HIDDEN PUMPKIN](https://studyquests.github.io/spooky-halloween-hidden-pumpkin.html)
- [2048 SORT FACTORY](https://themindplaying.web.app/2048-sort-factory.html)
- [CATEGORY TANK](https://thelearnquesters.pages.dev/category-tank.html)
- [MMA SUPER FIGHT](https://thequizzone.pages.dev/mma-super-fight.html)
- [FLICK SHOT SOCCER](https://themindskillplayplay.pages.dev/flick-shot-soccer.html)
- [SNAKE HUNTER](https://iskillplay.web.app/snake-hunter.html)
- [SHADOWMAN RUNNER](https://skillplay.github.io/shadowman-runner.html)
- [BLOSSOM](https://quizverses.github.io/blossom.html)
- [GARAGE MASTER NUTS AND BOLTS](https://theskillquest.pages.dev/garage-master-nuts-and-bolts.html)
- [PRIVACY](https://themindplaying.web.app/privacy.html)
- [CATEGORY LINKS](https://iskillquest.pages.dev/category-links.html)
- [FREECELL](https://studyquests.github.io/freecell.html)
- [SUMMER SPOTLIGHT DIFFERENCES](https://studyplayings.web.app/summer-spotlight-differences.html)
- [BATTLE SHOT ELITE](https://studyquests.github.io/battle-shot-elite.html)
- [CATEGORY MOUSE1 707](https://quizverses-9d2f2.web.app/category-mouse1-707.html)
- [CATEGORY IDLE448](https://iskillquest.pages.dev/category-idle448.html)
- [FEED THE PARROT](https://studyplayings.web.app/feed-the-parrot.html)
- [HYPER WAVE CHALLENGE](https://thelearnquesters.pages.dev/hyper-wave-challenge.html)
- [SQUARE PUNKI LONG HAND](https://studyplayings.web.app/square-punki-long-hand.html)
- [SODA BLOCK JAM](https://thelearnquesters.pages.dev/soda-block-jam.html)
- [CATEGORY JIGSAW](https://studyplayings.pages.dev/category-jigsaw.html)
- [CATEGORY CASUAL](https://iskillquest.pages.dev/category-casual.html)
- [CARGO SKATES](https://theskillquest.pages.dev/cargo-skates.html)
- [CATEGORY BALL175](https://iskillplay.web.app/category-ball175.html)
- [CONQUERIO](https://studyquests.github.io/conquerio.html)
- [CRAZY GOOSE SIMULATOR](https://theskillquest.pages.dev/crazy-goose-simulator.html)
- [SPIDER SOLITAIRE 2 SUITS](https://learnquester.pages.dev/spider-solitaire-2-suits.html)
- [ESCAPE STEAL BRAINROT SAHUR HILLS](https://quizverses.github.io/escape-steal-brainrot-sahur-hills.html)
- [COCKTAILZ](https://theskillquest.pages.dev/cocktailz.html)
- [CATEGORY IDLE445](https://iskillquest.pages.dev/category-idle445.html)
- [CATEGORY DEEP IMMERSIVE24](https://studyplayings.pages.dev/category-deep-immersive24.html)
- [WORDS FROM WORDS](https://studyplayings.pages.dev/words-from-words.html)
- [CATEGORY STICKMAN 2](https://iskillquest.pages.dev/category-stickman-2.html)
- [ARROW SURVIVAL 15 SECONDS](https://themindplay.pages.dev/arrow-survival-15-seconds.html)
- [TWINKLE SHOOTER](https://iskillquest.pages.dev/twinkle-shooter.html)
- [NOOB IN GEOMETRY DASH](https://thelearnquesters.pages.dev/noob-in-geometry-dash.html)
- [STICKMAN BATTLE 1 4 PLAYERS](https://studyquests.github.io/stickman-battle-1-4-players.html)
- [VOLLEY BEAN](https://thequizzone.pages.dev/volley-bean.html)
- [OVERPROTECTIVE BOYFRIEND](https://themindplay.pages.dev/overprotective-boyfriend.html)
- [POWERFUL PUNCH](https://themindzone.pages.dev/powerful-punch.html)
- [SCARY SHAWARMA KIOSK THE ANOMALY](https://themindplay.pages.dev/scary-shawarma-kiosk-the-anomaly.html)
- [MONEY MAN 3D](https://iskillquest.pages.dev/money-man-3d.html)
- [FIRE SNAKE](https://theskillquest.pages.dev/fire-snake.html)
- [CUTE CATS ADVENTURES](https://quizverses.github.io/cute-cats-adventures.html)
- [GRAND MAHJONG CONNECT](https://thequizzone.pages.dev/grand-mahjong-connect.html)
- [CATEGORY CASUAL 14](https://quizverses.github.io/category-casual-14.html)
- [BUTTERFLY TRIPLE](https://thequizzone.pages.dev/butterfly-triple.html)
- [CHICKEN WILD RUN](https://thequizzone.pages.dev/chicken-wild-run.html)
- [SUPERHERO PHONE SIMULATOR](https://thelearnquesters.pages.dev/superhero-phone-simulator.html)
- [CRICKET CLASH PONG](https://studyquests.github.io/cricket-clash-pong.html)
- [DIGITAL CIRCUS RUN](https://studyplayings.pages.dev/digital-circus-run.html)
- [SPACE SHOOTER SPEED TYPING CHALLENGE](https://quizverses.github.io/space-shooter-speed-typing-challenge.html)
