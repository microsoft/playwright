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
- [STUNT FURY](https://themindplays.pages.dev/stunt-fury.html)
- [MERGE BEASTS](https://thequizzone.pages.dev/merge-beasts.html)
- [HORROR ESCAPE GRANNY ROOM](https://themindzone.pages.dev/horror-escape-granny-room.html)
- [LAQUEUS ESCAPE CHAPTER III](https://themindzone.pages.dev/laqueus-escape-chapter-iii.html)
- [COUNTRYSIDE DRIVING QUEST](https://learnquesters.pages.dev/countryside-driving-quest.html)
- [PULL THE PINS](https://quizverses.pages.dev/pull-the-pins.html)
- [POPCATS MERGE THE CATS](https://iskillplay.web.app/popcats-merge-the-cats.html)
- [CAR COLLISION MASTER](https://quizverses-9d2f2.web.app/car-collision-master.html)
- [CATEGORY MINECRAFT81](https://quizverses.pages.dev/category-minecraft81.html)
- [SAVE THE CROP](https://iskillplay.web.app/save-the-crop.html)
- [OBBY THE LEGENDARY DRAGON](https://quizverses-9d2f2.web.app/obby-the-legendary-dragon.html)
- [KINGDOM PUZZLES](https://quizverses-9d2f2.web.app/kingdom-puzzles.html)
- [CATEGORY TOP DOWN251](https://themindplay.pages.dev/category-top-down251.html)
- [GT FORMULA CHAMPIONSHIP](https://themindplays.pages.dev/gt-formula-championship.html)
- [FARM BUSINESS SAGA](https://quizverses-9d2f2.web.app/farm-business-saga.html)
- [HOUSE ROBBER](https://thequizzone.pages.dev/house-robber.html)
- [TURBO RACE 3D](https://iskillplay.web.app/turbo-race-3d.html)
- [STOP THE BULLET](https://quizverses-9d2f2.web.app/stop-the-bullet.html)
- [CONSTRUCTION TRUCK BUILDING GAMES FOR KIDS](https://themindplays.pages.dev/construction-truck-building-games-for-kids.html)
- [COP RUN 3D](https://theskillquest.pages.dev/cop-run-3d.html)
- [GOBATTLEIO](https://themindskillplayplay.pages.dev/gobattleio.html)
- [UNDERWATER SURVIVAL](https://quizverses-9d2f2.web.app/underwater-survival.html)
- [BRAINROT A DIFFERENCE CHALLENGE](https://iskillquest.pages.dev/brainrot-a-difference-challenge.html)
- [COLLEGE GIRL COLORING DRESS UP](https://skillplay.github.io/college-girl-coloring-dress-up.html)
- [JEWELS COLORING PUZZLE](https://thequizzone.pages.dev/jewels-coloring-puzzle.html)
- [MAKE TWO](https://quizverses-9d2f2.web.app/make-two.html)
- [SKATING PARK](https://quizverses-9d2f2.web.app/skating-park.html)
- [CATEGORY SCHOOL](https://themindplays.pages.dev/category-school.html)
- [CUDDLE MONSTER FUSION](https://themindplays.pages.dev/cuddle-monster-fusion.html)
- [CATEGORY MATCH 3117](https://themindplays.pages.dev/category-match-3117.html)
- [MR LONG HAND](https://quizverses-9d2f2.web.app/mr-long-hand.html)
- [HAPPY JUMP](https://iskillplay.web.app/happy-jump.html)
- [WINTER GIFTS](https://themindskillplayplay.pages.dev/winter-gifts.html)
- [NUMBER BUBBLE SHOOTER WILD WEST](https://quizverses-9d2f2.web.app/number-bubble-shooter-wild-west.html)
- [TAPPY BIRD AVOID THE SPIKES](https://quizverses-9d2f2.web.app/tappy-bird-avoid-the-spikes.html)
- [CUBE SPEED DASH](https://themindplay.github.io/cube-speed-dash.html)
- [POPCAT CLICKER](https://iskillplay.web.app/popcat-clicker.html)
- [THE FLOWERS MERGE AND SELL BOUQUETS](https://quizverses-9d2f2.web.app/the-flowers-merge-and-sell-bouquets.html)
- [PHOTO BLOCK JOURNEY](https://quizverses-9d2f2.web.app/photo-block-journey.html)
- [STICKER JAM PEEL OFF MATCH](https://quizverses-9d2f2.web.app/sticker-jam-peel-off-match.html)
- [BUBBLE SHOOTER WONDERS OF EGYPT](https://skillplay.github.io/bubble-shooter-wonders-of-egypt.html)
- [BLACKRIVER MYSTERY HIDDEN OBJECTS](https://quizverses-9d2f2.web.app/blackriver-mystery-hidden-objects.html)
- [CATEGORY CRAFTING45](https://themindplays.pages.dev/category-crafting45.html)
- [CATEGORY BRAIN261](https://themindplay.pages.dev/category-brain261.html)
- [DRAG MATCH MAZE TILE](https://themindzone.pages.dev/drag-match-maze-tile.html)
- [GROW CASTLE DEFENCE](https://quizverses-9d2f2.web.app/grow-castle-defence.html)
- [ANIME DRESS UP DOLL DRESS UP](https://quizverses-9d2f2.web.app/anime-dress-up-doll-dress-up.html)
- [RETRO STREET FIGHTER](https://quizverses-9d2f2.web.app/retro-street-fighter.html)
- [FRUIT MERGE JUICY DROP GAME](https://quizverses-9d2f2.web.app/fruit-merge-juicy-drop-game.html)
- [MINECRAFT PIXEL WARFARE](https://themindskillplayplay.pages.dev/minecraft-pixel-warfare.html)
- [POWERFUL PUNCH](https://themindzone.pages.dev/powerful-punch.html)
- [CATEGORY PUZZLE 6](https://themindplays.pages.dev/category-puzzle-6.html)
- [FUNNY FRUITS MERGE AND GATHER WATERMELON](https://quizverses-9d2f2.web.app/funny-fruits-merge-and-gather-watermelon.html)
- [ITALIAN BRAINROT QUIZ](https://iskillquest.pages.dev/italian-brainrot-quiz.html)
- [THIEF STICK PUZZLE MAN ESCAPE](https://themindzone.pages.dev/thief-stick-puzzle-man-escape.html)
- [3D KID SLIDING PUZZLE](https://quizverses-9d2f2.web.app/3d-kid-sliding-puzzle.html)
- [QUIZ 10 SECONDS MATH](https://thequizzone.pages.dev/quiz-10-seconds-math.html)
- [CATEGORY UNBLOCKED](https://themindplay.pages.dev/category-unblocked.html)
- [STICKMAN ESCAPES FROM PRISON](https://thequizzone.pages.dev/stickman-escapes-from-prison.html)
- [CRAZYZOMBIES 3D](https://themindzone.pages.dev/crazyzombies-3d.html)
- [HILL RACING EGG DROP](https://themindplay.pages.dev/hill-racing-egg-drop.html)
- [ROAD CHASE SHOOTER REALISTIC GUNS](https://quizverses-9d2f2.web.app/road-chase-shooter-realistic-guns.html)
- [INDEX2](https://skillplay.github.io/index2.html)
- [TRIPEAKS SOLITAIRE ESCAPES](https://quizverses-9d2f2.web.app/tripeaks-solitaire-escapes.html)
- [DOOMSDAY SURVIVAL RPG SHOOTER](https://theskillquest.pages.dev/doomsday-survival-rpg-shooter.html)
- [TANGRAM PUZZLE](https://quizverses-9d2f2.web.app/tangram-puzzle.html)
- [HARD PUZZLE](https://quizverses-9d2f2.web.app/hard-puzzle.html)
- [CATEGORY PHYSICS371](https://quizverses.pages.dev/category-physics371.html)
- [TINY BAKER OCEAN JELLY CAKE](https://quizverses-9d2f2.web.app/tiny-baker-ocean-jelly-cake.html)
- [SOCCER TOURNAMENT](https://quizverses.github.io/soccer-tournament.html)
- [OFFROAD JEEP GAME SIMULATOR](https://themindplay.github.io/offroad-jeep-game-simulator.html)
- [GIRL RESCUE DRAGON OUT](https://studyquests.github.io/girl-rescue-dragon-out.html)
- [SWORD RUN 3D](https://studyquesthub.web.app/sword-run-3d.html)
- [CATEGORY COOKING](https://themindplays.pages.dev/category-cooking.html)
- [BELOTE 3IN1](https://studyquests.github.io/belote-3in1.html)
- [PLUG MAN RACE](https://studyquests.github.io/plug-man-race.html)
- [BARBEE BLACK FRIDAY FASHION](https://quizverses-9d2f2.web.app/barbee-black-friday-fashion.html)
- [HUNGRY NOOB CAFE SIMULATOR](https://thequizzone.pages.dev/hungry-noob-cafe-simulator.html)
- [ANIMALS MERGE](https://themindplays.pages.dev/animals-merge.html)
- [PUBG HACK](https://iskillquest.pages.dev/pubg-hack.html)
- [MERGE FUSION](https://themindzone.pages.dev/merge-fusion.html)
- [MOW IT](https://studyquests.github.io/mow-it.html)
- [CATEGORY STICKMAN175](https://themindplay.pages.dev/category-stickman175.html)
- [CATEGORY ROBOT49](https://iskillquest.pages.dev/category-robot49.html)
- [BALL AND GIRLFRIEND](https://thequizzone.pages.dev/ball-and-girlfriend.html)
- [SPIDER SOLITAIRE 2 SUITS](https://quizverses-9d2f2.web.app/spider-solitaire-2-suits.html)
- [CLIMB UP](https://themindzone.pages.dev/climb-up.html)
- [WORDS WITH PROF WISELY](https://quizverses.github.io/words-with-prof-wisely.html)
- [ARMY DEFENCE DINO SHOOT](https://iskillquest.pages.dev/army-defence-dino-shoot.html)
- [APPLE WORM](https://themindplays.pages.dev/apple-worm.html)
- [MOTO ATTACK BIKE RACING](https://quizverses.github.io/moto-attack-bike-racing.html)
- [WOOD SCREW PUZZLE](https://themindzone.pages.dev/wood-screw-puzzle.html)
- [CATEGORY CAN T STOP PLAYING212](https://studyquesthub.web.app/category-can-t-stop-playing212.html)
- [CATEGORY FREE RAGDOLL GAMES](https://themindplays.pages.dev/category-free-ragdoll-games.html)
- [PRINCESS DRESS UP RUN](https://studyquests.pages.dev/princess-dress-up-run.html)
- [INDEX20](https://themindplay.pages.dev/index20.html)
- [CATEGORY DEFENSE174](https://themindplays.pages.dev/category-defense174.html)
- [MYSTICAL BLADE 3D](https://iskillplay.web.app/mystical-blade-3d.html)
- [CATEGORY JUMPING147](https://iskillquest.pages.dev/category-jumping147.html)
- [CATEGORY ADVENTURE 3](https://themindzone.pages.dev/category-adventure-3.html)
- [PARKING FURY 3D NIGHT CITY](https://quizverses.github.io/parking-fury-3d-night-city.html)
- [CATEGORY PUZZLE 2](https://themindplays.pages.dev/category-puzzle-2.html)
- [PULL THE THREAD PUZZLE](https://themindplays.pages.dev/pull-the-thread-puzzle.html)
- [ZOMBIE RODEO MULTIPLICATION](https://quizverses.github.io/zombie-rodeo-multiplication.html)
- [STICKMAN HALLOWEEN SURVIVE](https://studyplaying.github.io/stickman-halloween-survive.html)
- [KIKI WORLD KAWAII DOLL DECOR](https://quizverses-9d2f2.web.app/kiki-world-kawaii-doll-decor.html)
- [OFFLINE FPS ROYALE](https://quizverses-9d2f2.web.app/offline-fps-royale.html)
- [WHATS GRANDMA HIDING](https://themindplays.pages.dev/whats-grandma-hiding.html)
- [KNIFE UP 3D](https://studyquests.github.io/knife-up-3d.html)
- [DOTS MASTER](https://themindskillplayplay.pages.dev/dots-master.html)
- [CATEGORY MONSTER206](https://quizverses.pages.dev/category-monster206.html)
- [VALENTINES HIDDEN ALPHAWORDS](https://theskillquest.pages.dev/valentines-hidden-alphawords.html)
- [WORD DECK SOLITAIRE](https://themindzone.pages.dev/word-deck-solitaire.html)
- [SNOW RIDER 3D NOSTALGIA](https://themindplays.pages.dev/snow-rider-3d-nostalgia.html)
- [MAZOO](https://studyquests.github.io/mazoo.html)
- [PARK THEM ALL](https://iskillquest.pages.dev/park-them-all.html)
- [BATTLE ARENA RACE TO WIN](https://quizverses.pages.dev/battle-arena-race-to-win.html)
- [PUZZLE MASTERS TRAVELERS](https://quizverses.github.io/puzzle-masters-travelers.html)
- [ULTRAHERO VS MONSTERS ROYALE BATTLE](https://themindzone.pages.dev/ultrahero-vs-monsters-royale-battle.html)
- [MY CAKE SHOP BAKE SERVE](https://studyquests.github.io/my-cake-shop-bake-serve.html)
- [ITALIAN BRAINROT SURVIVE PARKOUR](https://iskillquest.pages.dev/italian-brainrot-survive-parkour.html)
- [MICKEY RUN ADVENTURE GAME](https://studyquesthub.web.app/mickey-run-adventure-game.html)
- [SOCCER DUEL](https://quizverses.pages.dev/soccer-duel.html)
- [GEOMETRY LITE](https://quizverses.github.io/geometry-lite.html)
- [BFF EASTER PHOTOBOOTH PARTY](https://themindplay.pages.dev/bff-easter-photobooth-party.html)
- [AUTO NINJA](https://themindplay.pages.dev/auto-ninja.html)
- [CATEGORY CASUAL 15](https://themindzone.pages.dev/category-casual-15.html)
- [GRUKKLE ONSLAUGHT](https://quizverses-9d2f2.web.app/grukkle-onslaught.html)
- [CATEGORY MAHJONG](https://themindplays.pages.dev/category-mahjong.html)
- [FLOWER BLOCK](https://themindplays.pages.dev/flower-block.html)
