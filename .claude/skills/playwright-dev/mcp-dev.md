# MCP Tools and CLI Commands

## Adding MCP Tools

### Step 1: Create the Tool File

Create `packages/playwright/src/mcp/browser/tools/<your-tool>.ts`.

Import zod from the MCP bundle and use `defineTool` or `defineTabTool`:

```typescript
import { z } from 'playwright-core/lib/mcpBundle';
import { defineTool, defineTabTool } from './tool';
```

**Choose `defineTabTool` vs `defineTool`:**
- `defineTabTool` — most tools use this. Receives a `Tab` object, auto-handles modal state (dialogs/file choosers).
- `defineTool` — receives the full `Context`. Use when you need `context.ensureBrowserContext()` without a specific tab, or need custom tab management.

**Tool definition pattern:**

```typescript
const myTool = defineTabTool({
  capability: 'core',  // ToolCapability — see step 2

  // Optional: only available in skill mode (not exposed via MCP)
  // skillOnly: true,

  // Optional: this tool clears a modal state ('dialog' | 'fileChooser')
  // clearsModalState: 'dialog',

  schema: {
    name: 'browser_my_tool',       // MCP tool name (browser_ prefix)
    title: 'My Tool',              // Human-readable title
    description: 'Does something', // Description shown to LLM
    inputSchema: z.object({
      ref: z.string().describe('Element reference from snapshot'),
      value: z.string().optional().describe('Optional value'),
    }),
    type: 'action',  // 'input' | 'assertion' | 'action' | 'readOnly'
  },

  handle: async (tab, params, response) => {
    // Implementation using tab.page (Playwright Page object)
    await tab.page.click(`[ref="${params.ref}"]`);

    // Add generated Playwright code
    response.addCode(`await page.click('[ref="${params.ref}"]');`);

    // Include page snapshot in response (for navigation/state changes)
    response.setIncludeSnapshot();

    // Or add text result
    response.addTextResult('Done');
  },
});

export default [myTool];
```

**Schema type values:**
- `'action'` — state-changing operations (navigate, click, fill)
- `'input'` — user input (typing, keyboard)
- `'readOnly'` — queries that don't modify state (list cookies, get snapshot)
- `'assertion'` — testing/verification tools

**Response API:**
- `response.addTextResult(text)` — add text to result section
- `response.addError(error)` — add error message
- `response.addCode(code)` — add generated Playwright code snippet
- `response.setIncludeSnapshot()` — include ARIA snapshot in response
- `response.setIncludeFullSnapshot(filename?)` — force full snapshot
- `response.addResult(title, data, fileTemplate)` — add file result
- `response.registerImageResult(data, 'png'|'jpeg')` — add image

**Context tool example** (for browser-context-level operations):

```typescript
const myContextTool = defineTool({
  capability: 'storage',
  schema: { /* ... */ type: 'readOnly' },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    const cookies = await browserContext.cookies();
    response.addTextResult(cookies.map(c => `${c.name}=${c.value}`).join('\n'));
  },
});
```

### Step 2: Add ToolCapability (if needed)

If your tool doesn't fit an existing capability, add a new one to `packages/playwright/src/mcp/config.d.ts`:

```typescript
export type ToolCapability =
  'config' |
  'core' |           // Always enabled
  'core-navigation' | // Always enabled
  'core-tabs' |      // Always enabled
  'core-input' |     // Always enabled
  'core-install' |   // Always enabled
  'network' |
  'pdf' |
  'storage' |
  'testing' |
  'vision' |
  'devtools';        // Add yours here
```

**Capability filtering rules:**
- Tools with `core*` capabilities are always enabled
- Other capabilities must be enabled via `--caps` or config `capabilities` array
- `skillOnly: true` tools are only available in skill mode, never via MCP

### Step 3: Register the Tool

In `packages/playwright/src/mcp/browser/tools.ts`:

```typescript
import myTool from './tools/myTool';

export const browserTools: Tool<any>[] = [
  // ... existing tools ...
  ...myTool,
];
```

### Step 4: Write Tests

Create `tests/mcp/<category>.spec.ts`. Use the fixtures from `./fixtures`:

```typescript
import { test, expect } from './fixtures';

test('browser_my_tool', async ({ client, server }) => {
  // Setup: navigate to a page first
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Call your tool
  expect(await client.callTool({
    name: 'browser_my_tool',
    arguments: { ref: 'e1' },
  })).toHaveResponse({
    code: `await page.click('[ref="e1"]');`,
    snapshot: expect.stringContaining('some content'),
  });
});

test('browser_my_tool error case', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_my_tool',
    arguments: { ref: 'invalid' },
  })).toHaveResponse({
    error: expect.stringContaining('Error:'),
    isError: true,
  });
});
```

**Test fixtures:**
- `client` — MCP client, call tools via `client.callTool({ name, arguments })`
- `startClient(options?)` — client factory, for custom config/args/roots
- `server` — HTTP test server (`server.PREFIX`, `server.HELLO_WORLD`, `server.setContent(path, html, contentType)`)
- `httpsServer` — HTTPS test server

**Custom matchers:**
- `toHaveResponse({ code?, snapshot?, page?, error?, isError?, result?, events?, modalState? })` — matches parsed response sections
- `toHaveTextResponse(text)` — matches raw text with normalization

**Parsed response sections:**
- `code` — generated Playwright code (without ```js fences)
- `snapshot` — ARIA page snapshot (with ```yaml fences)
- `page` — page info (URL, title)
- `error` — error message
- `result` — text result
- `events` — console messages, downloads
- `modalState` — active dialog/file chooser info
- `tabs` — tab listing
- `isError` — boolean

### Testing MCP Tools
- Run tests: `npm run ctest-mcp <category>`
- Do not run `test --debug`

---

## Adding CLI Commands

CLI commands are thin wrappers over MCP tools. They live in the daemon and map CLI args to MCP tool calls.

### Step 1: Implement the MCP Tool

Implement the corresponding MCP tool first (see section above). CLI commands call MCP tools via `toolName`/`toolParams`.

### Step 2: Add the Command Declaration

In `packages/playwright/src/cli/daemon/commands.ts`, use `declareCommand()`:

```typescript
import { z } from 'playwright-core/lib/mcpBundle';
import { declareCommand } from './command';

const myCommand = declareCommand({
  name: 'my-command',           // CLI command name (kebab-case)
  description: 'Does something', // Shown in help
  category: 'core',             // Category for help grouping

  // Positional arguments (ordered, parsed from CLI positional args)
  args: z.object({
    url: z.string().describe('The URL to navigate to'),
    ref: z.string().optional().describe('Optional element reference'),
  }),

  // Named options (parsed from --flag or --flag=value)
  options: z.object({
    submit: z.boolean().optional().describe('Whether to submit'),
    filename: z.string().optional().describe('Output filename'),
  }),

  // MCP tool name — string or function for dynamic routing
  toolName: 'browser_my_tool',
  // OR dynamic:
  // toolName: ({ submit }) => submit ? 'browser_submit' : 'browser_type',

  // Map CLI args/options to MCP tool params
  toolParams: ({ url, ref, submit, filename }) => ({
    url,
    ref,
    submit,
    filename,
  }),
});
```

Then add to the `commandsArray` at the bottom of the file, in the correct category section:

```typescript
const commandsArray: AnyCommandSchema[] = [
  // core category
  open,
  close,
  // ... existing commands ...
  myCommand,   // <-- add here in the right category
  // ...
];
```

**Categories** (defined in `packages/playwright/src/cli/daemon/command.ts`):

```typescript
type Category = 'core' | 'navigation' | 'keyboard' | 'mouse' | 'export' |
                'storage' | 'tabs' | 'network' | 'devtools' | 'browsers' |
                'config' | 'install';
```

To add a new category:
1. Add it to `Category` type in `packages/playwright/src/cli/daemon/command.ts`
2. Add it to the `categories` array in `packages/playwright/src/cli/daemon/helpGenerator.ts`:
   ```typescript
   const categories: { name: Category, title: string }[] = [
     // ... existing ...
     { name: 'mycat', title: 'My Category' },
   ];
   ```

**Special tool patterns:**
- `toolName: ''` — command handled specially by daemon (e.g., `close`, `list`, `install`)
- Use `numberArg` for numeric CLI args: `x: numberArg.describe('X coordinate')`
- Param renaming: `toolParams: ({ w: width, h: height }) => ({ width, height })`
- Dynamic toolName: `toolName: ({ clear }) => clear ? 'browser_clear' : 'browser_list'`

### Step 3: Update SKILL File

Update `packages/playwright/src/skill/SKILL.md` with the new command documentation.
Add reference docs in `packages/playwright/src/skill/references/` if the feature is complex.

Run `npm run playwright-cli -- --help` to verify the help output includes your new command.

### Step 4: Write CLI Tests

Create `tests/mcp/cli-<category>.spec.ts`. Use fixtures from `./cli-fixtures`:

```typescript
import { test, expect } from './cli-fixtures';

test('my-command', async ({ cli, server }) => {
  // Open a page first
  await cli('open', server.PREFIX);

  // Run your command
  const { output, snapshot } = await cli('my-command', 'arg1', '--option=value');
  expect(output).toContain('expected text');
  expect(snapshot).toContain('expected snapshot content');
});
```

**CLI test fixtures:**
- `cli(...args)` — run CLI command, returns `{ output, error, exitCode, snapshot, attachments }`
  - `output` — stdout text
  - `snapshot` — extracted ARIA snapshot (if present)
  - `attachments` — file attachments `{ name, data }[]`
  - `error` — stderr text
  - `exitCode` — process exit code

### Testing CLI Commands
- Run tests: `npm run ctest-mcp cli-<category>`
- Do not run `test --debug`

---

## Adding Config Options

When you need to add a new config option, update these files in order:

### 1. Type definition: `packages/playwright/src/mcp/config.d.ts`

Add the option to the `Config` type with JSDoc:

```typescript
export type Config = {
  // ... existing ...

  /**
   * Description of the new option.
   */
  myOption?: string;
};
```

### 2. CLI options type: `packages/playwright/src/mcp/browser/config.ts`

Add to `CLIOptions` type:

```typescript
export type CLIOptions = {
  // ... existing ...
  myOption?: string;
};
```

If the option needs to be in `FullConfig` (with required/resolved values), update `FullConfig` and `defaultConfig`:

```typescript
export type FullConfig = Config & {
  // ... existing ...
  myOption: string;  // required in resolved config
};

export const defaultConfig: FullConfig = {
  // ... existing ...
  myOption: 'default-value',
};
```

### 3. Config from CLI: `configFromCLIOptions()` in `config.ts`

Map CLI option to config:

```typescript
const config: Config = {
  // ... existing ...
  myOption: cliOptions.myOption,
};
```

### 4. Config from env: `configFromEnv()` in `config.ts`

Add environment variable mapping:

```typescript
options.myOption = envToString(process.env.PLAYWRIGHT_MCP_MY_OPTION);
// For booleans: envToBoolean(process.env.PLAYWRIGHT_MCP_MY_OPTION)
// For numbers: numberParser(process.env.PLAYWRIGHT_MCP_MY_OPTION)
// For comma lists: commaSeparatedList(process.env.PLAYWRIGHT_MCP_MY_OPTION)
// For semicolon lists: semicolonSeparatedList(process.env.PLAYWRIGHT_MCP_MY_OPTION)
```

### 5. MCP server CLI: `packages/playwright/src/mcp/program.ts`

Add CLI flag:

```typescript
command
  .option('--my-option <value>', 'description of option')
```

### 6. Merge config (if nested)

If the option is nested, update `mergeConfig()` in `config.ts` to deep-merge it.

**Config resolution order:** `defaultConfig` → config file → env vars → CLI args (last wins).

---

## SKILL File

The skill file is located at `packages/playwright/src/skill/SKILL.md`. It contains documentation for all available CLI commands and MCP tools. Update it whenever you add new commands or tools.

Reference docs live in `packages/playwright/src/skill/references/`:
- `request-mocking.md` — network mocking patterns
- `running-code.md` — code execution
- `session-management.md` — session handling
- `storage-state.md` — state persistence
- `test-generation.md` — test creation
- `tracing.md` — trace recording
- `video-recording.md` — video capture

Run `npm run playwright-cli -- --help` to see the latest available commands and use them to update the skill file.

---

## Architecture Reference

### Directory Structure

```
packages/playwright/src/
├── mcp/
│   ├── browser/
│   │   ├── tools/           # All MCP tool implementations
│   │   │   ├── tool.ts      # Tool/TabTool types, defineTool(), defineTabTool()
│   │   │   ├── common.ts    # close, resize
│   │   │   ├── navigate.ts  # navigate, goBack, goForward, reload
│   │   │   ├── snapshot.ts  # page snapshot
│   │   │   ├── form.ts      # click, type, fill, select, check
│   │   │   ├── keyboard.ts  # press, keydown, keyup
│   │   │   ├── mouse.ts     # mouse move, click, wheel
│   │   │   ├── tabs.ts      # tab management
│   │   │   ├── cookies.ts   # cookie CRUD
│   │   │   ├── webstorage.ts # localStorage, sessionStorage
│   │   │   ├── storage.ts   # storage state save/load
│   │   │   ├── network.ts   # network requests listing
│   │   │   ├── route.ts     # request mocking/routing
│   │   │   ├── console.ts   # console messages
│   │   │   ├── evaluate.ts  # JS evaluation
│   │   │   ├── screenshot.ts # screenshots
│   │   │   ├── pdf.ts       # PDF generation
│   │   │   ├── files.ts     # file upload
│   │   │   ├── dialogs.ts   # dialog handling
│   │   │   ├── verify.ts    # assertions
│   │   │   ├── wait.ts      # wait operations
│   │   │   ├── tracing.ts   # trace recording
│   │   │   ├── video.ts     # video recording
│   │   │   ├── runCode.ts   # run Playwright code
│   │   │   ├── devtools.ts  # DevTools integration
│   │   │   ├── config.ts    # config tool
│   │   │   ├── install.ts   # browser install
│   │   │   └── utils.ts     # shared utilities
│   │   ├── tools.ts         # Tool registry (browserTools array, filteredTools)
│   │   ├── config.ts        # Config resolution, CLIOptions, FullConfig
│   │   ├── context.ts       # Browser context management
│   │   ├── response.ts      # Response class, parseResponse()
│   │   └── tab.ts           # Tab management
│   ├── sdk/
│   │   ├── server.ts        # MCP server
│   │   └── tool.ts          # ToolSchema type, toMcpTool()
│   ├── config.d.ts          # Config type, ToolCapability type
│   └── program.ts           # MCP server CLI setup
├── cli/
│   ├── client/
│   │   ├── program.ts       # CLI client entry (argument parsing)
│   │   ├── session.ts       # Session management
│   │   └── registry.ts      # Session registry
│   └── daemon/
│       ├── command.ts        # Category type, CommandSchema, declareCommand(), parseCommand()
│       ├── commands.ts       # All CLI command declarations
│       ├── helpGenerator.ts  # Help text generation (generateHelp, generateHelpJSON)
│       └── daemon.ts         # Daemon server
└── skill/
    ├── SKILL.md              # Skill documentation
    └── references/           # Reference docs

tests/mcp/
├── fixtures.ts               # MCP test fixtures (client, startClient, server)
├── cli-fixtures.ts           # CLI test fixtures (cli helper)
├── <category>.spec.ts        # MCP tool tests
└── cli-<category>.spec.ts    # CLI command tests
```

### Execution Flow

```
MCP Server mode:
  LLM → MCP protocol → Server.callTool(name, args)
    → zod validates input → Tool.handle(context|tab, params, response)
    → response.serialize() → MCP protocol → LLM

CLI mode:
  User → `playwright-cli my-command arg1 --opt=val`
    → Client parses with minimist → sends to Daemon via socket
    → parseCommand() maps CLI args to MCP tool params via zod
    → backend.callTool(toolName, toolParams)
    → Response formatted → printed to stdout
```
