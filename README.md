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
- [ENGLISH CHECKERS](https://theskillquest.pages.dev/english-checkers.html)
- [BOXTERIA](https://studyplaying.github.io/boxteria.html)
- [GRAVITY SPEED RUN](https://studyquests.github.io/gravity-speed-run.html)
- [JET FIGHTER AIRPLANE RACING](https://quizverses.github.io/jet-fighter-airplane-racing.html)
- [BLUE HEDGEHOG HILL DASH RIDE](https://quizverses.github.io/blue-hedgehog-hill-dash-ride.html)
- [CATEGORY HORROR90](https://quizverses-9d2f2.web.app/category-horror90.html)
- [CATEGORY SHOOTER](https://quizverses.pages.dev/category-shooter.html)
- [EXIT PUZZLE](https://quizverses.github.io/exit-puzzle.html)
- [CANDY COLOR SORT PUZZLE](https://quizverses.github.io/candy-color-sort-puzzle.html)
- [MOSQUITO BITE 3D](https://quizverses.github.io/mosquito-bite-3d.html)
- [MAHJONG CONNECT SPOOKY](https://quizverses.github.io/mahjong-connect-spooky.html)
- [SQUID SPRUNKI SLITHER GAME 2](https://quizverses.github.io/squid-sprunki-slither-game-2.html)
- [GOON BALL](https://quizverses-9d2f2.web.app/goon-ball.html)
- [INDEX3](https://quizverses.github.io/index3.html)
- [WAVE CHIC OCEAN FASHION FRENZY](https://quizverses-9d2f2.web.app/wave-chic-ocean-fashion-frenzy.html)
- [CATEGORY CONTROLLER](https://quizverses.pages.dev/category-controller.html)
- [INCOWORD](https://quizverses.github.io/incoword.html)
- [BLOCK PUZZLE SLIDE BLOCK JAM](https://quizverses-9d2f2.web.app/block-puzzle-slide-block-jam.html)
- [ROBBIE STAND ON THE RIGHT COLOR](https://quizverses.pages.dev/robbie-stand-on-the-right-color.html)
- [HORSEBACK SURVIVAL](https://quizverses.github.io/horseback-survival.html)
- [GRADUATION MAKEUP TRENDS](https://quizverses-9d2f2.web.app/graduation-makeup-trends.html)
- [CATEGORY DEEP IMMERSIVE24](https://studyplayings.pages.dev/category-deep-immersive24.html)
- [DAILY MATCH](https://quizverses-9d2f2.web.app/daily-match.html)
- [CATEGORY BLOCK91](https://quizverses.github.io/category-block91.html)
- [INDEX13](https://quizverses.pages.dev/index13.html)
- [CATEGORY ANIMAL216](https://quizverses.github.io/category-animal216.html)
- [BLOON POP](https://learnquester.github.io/bloon-pop.html)
- [JEWEL LEGEND QUEST](https://quizverses.github.io/jewel-legend-quest.html)
- [TANGLE MASTER 3D](https://studyplayings.web.app/tangle-master-3d.html)
- [CATEGORY HORROR90](https://quizverses.github.io/category-horror90.html)
- [BUBBLE BALL](https://studyplayings.web.app/bubble-ball.html)
- [CATEGORY 2D1 070](https://thelearnquesters.pages.dev/category-2d1-070.html)
- [INDEX14](https://quizverses.pages.dev/index14.html)
- [ROYAL REBELLION PUNK MAGIC](https://studyplayings.pages.dev/royal-rebellion-punk-magic.html)
- [2 PLAYER MINI CHALLENGE](https://studyplayings.pages.dev/2-player-mini-challenge.html)
- [SHELTER SECURITY GATEKEEPER SIMULATOR](https://thelearnquester.web.app/shelter-security-gatekeeper-simulator.html)
- [PARKING MASTER URBAN CHALLENGES](https://learnquesters.pages.dev/parking-master-urban-challenges.html)
- [ALIEN INTELLIGENCE TEST](https://quizverses.pages.dev/alien-intelligence-test.html)
- [CATEGORY PUZZLE 8](https://quizverses.github.io/category-puzzle-8.html)
- [POWER LIGHT](https://learnquesters.pages.dev/power-light.html)
- [TAP ARROW AWAY](https://quizverses.pages.dev/tap-arrow-away.html)
- [INDEX5](https://quizverses.pages.dev/index5.html)
- [CATEGORY DRESS UP97](https://quizverses.github.io/category-dress-up97.html)
- [21 CARDS](https://quizverses-9d2f2.web.app/21-cards.html)
- [HEX SENSE](https://studyplayings.pages.dev/hex-sense.html)
- [SITEMAP](https://studyquests.github.io/sitemap.html)
- [PIN MASTER](https://learnquesters.pages.dev/pin-master.html)
- [TIKTOK TRENDS COLORED DENIM](https://quizverses.github.io/tiktok-trends-colored-denim.html)
- [MAHJONG STACK](https://thelearnquester.web.app/mahjong-stack.html)
- [ZUMBLE STORY](https://thelearnquester.web.app/zumble-story.html)
- [NINJA DASH COZY TACTIC PUZZLE](https://quizverses.github.io/ninja-dash-cozy-tactic-puzzle.html)
- [BARK BLAST](https://learnquesters.pages.dev/bark-blast.html)
- [CATEGORY DRESS UP](https://studyplayings.pages.dev/category-dress-up.html)
- [FISH EAT GROW MEGA](https://studyplayings.pages.dev/fish-eat-grow-mega.html)
- [2 PLAYER GAMES KIDS KITCHEN](https://studyplayings.pages.dev/2-player-games-kids-kitchen.html)
- [ESCAPE STEAL BRAINROT SAHUR HILLS](https://quizverses.github.io/escape-steal-brainrot-sahur-hills.html)
- [FOOT HOSPITAL](https://quizverses-9d2f2.web.app/foot-hospital.html)
- [ARCHERY LEGENDS](https://quizverses.pages.dev/archery-legends.html)
- [HAPPY BROTHERS](https://learnquesters.pages.dev/happy-brothers.html)
- [CATEGORY GAMES](https://studyplayings.pages.dev/category-games.html)
- [KAWAII FRIENDS TILES MATCHER](https://quizverses.github.io/kawaii-friends-tiles-matcher.html)
- [MR DUDE KING OF THE HILL](https://quizverses.github.io/mr-dude-king-of-the-hill.html)
- [HOME RUN BOY](https://thelearnquester.web.app/home-run-boy.html)
- [CATEGORY FASHION105](https://quizverses.github.io/category-fashion105.html)
- [CATEGORY BRAIN](https://quizverses.pages.dev/category-brain.html)
- [CATEGORY AVOID297](https://quizverses.github.io/category-avoid297.html)
- [JEWELS BLITZ LEGENDS](https://quizverses-9d2f2.web.app/jewels-blitz-legends.html)
- [WORDS WITH OWL](https://studyplayings.web.app/words-with-owl.html)
- [MINDBLOW](https://quizverses.github.io/mindblow.html)
- [BUBBLE SHOOTER BILLIARDS POOL](https://thelearnquester.web.app/bubble-shooter-billiards-pool.html)
- [SITEMAP](https://thelearnquesters.pages.dev/sitemap.html)
- [COLOR BUMP DANCER](https://quizverses.github.io/color-bump-dancer.html)
- [GOLD MINER TOWER DEFENSE](https://thelearnquester.web.app/gold-miner-tower-defense.html)
- [LUDO WORLD](https://quizverses.github.io/ludo-world.html)
- [BLOCK DODGER](https://learnquesters.pages.dev/block-dodger.html)
- [ITALIAN BRAINROT CLICKER](https://quizverses-9d2f2.web.app/italian-brainrot-clicker.html)
- [ARROW COUNT MASTER](https://studyplayings.pages.dev/arrow-count-master.html)
- [SNIPER ASSASSIN GOVERNMENT AGENT](https://studyplayings.web.app/sniper-assassin-government-agent.html)
- [STICK TACTICS DESTRUCTION](https://quizverses.github.io/stick-tactics-destruction.html)
- [GOO GOO GAGA CLICKER](https://quizverses.pages.dev/goo-goo-gaga-clicker.html)
- [SMASH THE CAR TO PIECES](https://studyplayings.pages.dev/smash-the-car-to-pieces.html)
- [HAWAII MATCH 6](https://quizverses-9d2f2.web.app/hawaii-match-6.html)
- [CATEGORY PUZZLE 4](https://quizverses-9d2f2.web.app/category-puzzle-4.html)
- [HAPPY FARM THE CROP](https://thelearnquester.web.app/happy-farm-the-crop.html)
- [NATURAL DISASTER SURVIVAL OBBY](https://studyplayings.web.app/natural-disaster-survival-obby.html)
- [DIEPIO](https://quizverses.github.io/diepio.html)
- [INDEX12](https://quizverses.pages.dev/index12.html)
- [UNPUZZLE MASTER](https://quizverses.pages.dev/unpuzzle-master.html)
- [SUPER POP BLAST](https://quizverses.pages.dev/super-pop-blast.html)
- [INDEX8](https://quizverses.pages.dev/index8.html)
- [TILE HEXA SORT](https://quizverses.pages.dev/tile-hexa-sort.html)
- [FLOWER BLOCK](https://quizverses.pages.dev/flower-block.html)
- [WORM APPLE QUEST](https://thelearnquester.web.app/worm-apple-quest.html)
- [OFFLINE FPS ROYALE](https://quizverses.github.io/offline-fps-royale.html)
- [CATEGORY AVOID295](https://quizverses.pages.dev/category-avoid295.html)
- [BUBBLE SHOOTER ULTIMATE](https://quizverses.pages.dev/bubble-shooter-ultimate.html)
- [SUMMER CONNECT](https://thelearnquester.web.app/summer-connect.html)
- [CATEGORY 2D1 070](https://quizverses.pages.dev/category-2d1-070.html)
- [2048 PUZZLE CONNECT THE BALLS](https://learnquesters.pages.dev/2048-puzzle-connect-the-balls.html)
- [EQ TEST PUZZLE](https://studyplayings.pages.dev/eq-test-puzzle.html)
- [SAVE SEAFOOD](https://learnquesters.pages.dev/save-seafood.html)
- [WORD HUNT](https://thelearnquester.web.app/word-hunt.html)
- [OM NOM RUN](https://quizverses.pages.dev/om-nom-run.html)
- [TRAFFIC LIGHT SIMULATOR 3D](https://quizverses-9d2f2.web.app/traffic-light-simulator-3d.html)
- [CAR SERVICE TYCOON](https://learnquesters.pages.dev/car-service-tycoon.html)
- [FIREBOY WATERGIRL 7 AND FRIENDS](https://quizverses.pages.dev/fireboy-watergirl-7-and-friends.html)
- [FURY OF THE STEAMPUNK PRINCESS](https://learnquesters.pages.dev/fury-of-the-steampunk-princess.html)
- [CATEGORY UNBLOCKED GAMES](https://quizverses-9d2f2.web.app/category-unblocked-games.html)
- [CAR PARKING SIMULATOR](https://thelearnquester.web.app/car-parking-simulator.html)
- [BALLOON POP FRENZY](https://studyplayings.web.app/balloon-pop-frenzy.html)
- [BUBBLE SHOOTER WITCH TOWER 2](https://studyplayings.pages.dev/bubble-shooter-witch-tower-2.html)
- [WINTER WOLF](https://thelearnquester.web.app/winter-wolf.html)
- [BULLET SUPERHERO](https://studyplayings.web.app/bullet-superhero.html)
- [PUZZLE LINES AND KNOTS 1](https://studyplayings.pages.dev/puzzle-lines-and-knots-1.html)
- [ADDICTION SOLITAIRE](https://studyplayings.pages.dev/addiction-solitaire.html)
- [COLOR MIX JELLY MERGE](https://studyplayings.web.app/color-mix-jelly-merge.html)
- [OBBY CLIMB RACING](https://quizverses.github.io/obby-climb-racing.html)
- [DOP DRAW ONE PART](https://thelearnquester.web.app/dop-draw-one-part.html)
- [BEAR VS HUMANS](https://quizverses.pages.dev/bear-vs-humans.html)
- [BLOWUP ATM](https://quizverses.github.io/blowup-atm.html)
- [CATEGORY CASUAL 9](https://learnquester.pages.dev/category-casual-9.html)
- [CONSOLE IDLE](https://quizverses-9d2f2.web.app/console-idle.html)
- [TAP HOLD](https://thelearnquester.web.app/tap-hold.html)
- [PHYSICS BOX 2](https://studyplayings.pages.dev/physics-box-2.html)
- [BANANA BOUNCE](https://studyplayings.pages.dev/banana-bounce.html)
- [CATEGORY 204828](https://quizverses.pages.dev/category-204828.html)
- [OBSTACLE CAR DRIVING](https://studyplayings.web.app/obstacle-car-driving.html)
- [MOSCOW METRO DRIVER 3D](https://quizverses.pages.dev/moscow-metro-driver-3d.html)
- [DOORS AWAKENING](https://quizverses.github.io/doors-awakening.html)
- [CATEGORY GROW GAMES](https://quizverses.github.io/category-grow-games.html)
