# Playwright Trace System - Comprehensive Guide

## 1. Overview

The Playwright trace system is a comprehensive recording and visualization framework that captures:
- **Actions** (API calls, user interactions)
- **Network traffic** (HAR format)
- **Snapshots** (DOM snapshots at key moments)
- **Screencast frames** (video of page rendering)
- **Console messages** and events
- **Errors** and logs
- **Resources** (images, stylesheets, scripts, etc.)

---

## 2. File Structure

### packages/trace/src/ - Trace Type Definitions
Located in `/home/pfeldman/code/playwright/packages/trace/src/`

**Key Files:**
- **trace.ts** - Core trace event type definitions
- **har.ts** - HTTP Archive format (network traffic)
- **snapshot.ts** - DOM snapshot data structures
- **DEPS.list** - Dependencies marker

**File List:**
```
trace/src/
├── trace.ts        (183 lines) - Main trace event types
├── har.ts          (189 lines) - HAR format types
├── snapshot.ts     (62 lines)  - Snapshot data structures
└── DEPS.list       - Dependencies file
```

---

## 3. Trace Event Types (trace.ts)

### 3.1 Core Event Types

**VERSION: 8** (Current format version)

#### ContextCreatedTraceEvent
```typescript
type ContextCreatedTraceEvent = {
  version: number,
  type: 'context-options',
  origin: 'testRunner' | 'library',
  browserName: string,
  channel?: string,
  platform: string,
  playwrightVersion?: string,
  wallTime: number,  // Milliseconds since epoch
  monotonicTime: number,  // Internal monotonic clock
  title?: string,
  options: BrowserContextEventOptions,
  sdkLanguage?: Language,
  testIdAttributeName?: string,
  contextId?: string,
  testTimeout?: number,
};
```

#### BeforeActionTraceEvent
Emitted when an action starts:
```typescript
type BeforeActionTraceEvent = {
  type: 'before',
  callId: string,           // Unique action identifier
  startTime: number,        // Monotonic time when action started
  title?: string,           // User-facing action name
  class: string,            // API class (e.g., 'Page', 'Frame')
  method: string,           // API method (e.g., 'click', 'goto')
  params: Record<string, any>,  // Method parameters
  stepId?: string,          // Test step identifier
  beforeSnapshot?: string,  // "before@<callId>"
  stack?: StackFrame[],     // Call stack
  pageId?: string,          // Associated page ID
  parentId?: string,        // Parent action (for nested actions)
  group?: string,           // Action group (e.g., 'wait', 'click')
};
```

#### InputActionTraceEvent
For input/pointer interactions:
```typescript
type InputActionTraceEvent = {
  type: 'input',
  callId: string,
  inputSnapshot?: string,   // "input@<callId>"
  point?: Point,            // Mouse/pointer coordinates
};
```

#### AfterActionTraceEvent
Emitted when an action completes:
```typescript
type AfterActionTraceEvent = {
  type: 'after',
  callId: string,
  endTime: number,          // Monotonic time when action ended
  afterSnapshot?: string,   // "after@<callId>"
  error?: SerializedError,  // Error if action failed
  attachments?: AfterActionTraceEventAttachment[],  // Files, screenshots
  annotations?: AfterActionTraceEventAnnotation[],  // Custom annotations
  result?: any,             // Return value
  point?: Point,            // Final pointer position
};
```

#### ActionTraceEvent (Composite)
Combines before, after, and input events:
```typescript
type ActionTraceEvent = {
  type: 'action',
} & Omit<BeforeActionTraceEvent, 'type'>
  & Omit<AfterActionTraceEvent, 'type'>
  & Omit<InputActionTraceEvent, 'type'>;
```

#### Other Event Types

**ScreencastFrameTraceEvent** - Video frame data
```typescript
type ScreencastFrameTraceEvent = {
  type: 'screencast-frame',
  pageId: string,
  sha1: string,             // Resource SHA1
  width: number,            // Frame width
  height: number,           // Frame height
  timestamp: number,        // Frame timestamp
  frameSwapWallTime?: number,
};
```

**EventTraceEvent** - Browser events (dialog, navigation, etc.)
```typescript
type EventTraceEvent = {
  type: 'event',
  time: number,
  class: string,            // Event source class
  method: string,           // Event method
  params: any,              // Event parameters
  pageId?: string,
};
```

**ConsoleMessageTraceEvent** - Console output
```typescript
type ConsoleMessageTraceEvent = {
  type: 'console',
  time: number,
  pageId?: string,
  messageType: string,      // 'log', 'error', 'warn', etc.
  text: string,
  args?: { preview: string, value: any }[],
  location: { url: string, lineNumber: number, columnNumber: number },
};
```

**LogTraceEvent** - Action logs
```typescript
type LogTraceEvent = {
  type: 'log',
  callId: string,
  time: number,
  message: string,
};
```

**ResourceSnapshotTraceEvent** - Network request
```typescript
type ResourceSnapshotTraceEvent = {
  type: 'resource-snapshot',
  snapshot: ResourceSnapshot,  // HAR Entry
};
```

**FrameSnapshotTraceEvent** - DOM snapshot
```typescript
type FrameSnapshotTraceEvent = {
  type: 'frame-snapshot',
  snapshot: FrameSnapshot,
};
```

**StdioTraceEvent** - Process output (stdout/stderr)
```typescript
type StdioTraceEvent = {
  type: 'stdout' | 'stderr',
  timestamp: number,
  text?: string,
  base64?: string,  // Binary output
};
```

**ErrorTraceEvent** - Unhandled errors
```typescript
type ErrorTraceEvent = {
  type: 'error',
  message: string,
  stack?: StackFrame[],
};
```

---

## 4. HAR Format (har.ts)

Follows HTTP Archive 1.2 specification. Key structure for network traffic:

```typescript
type HARFile = {
  log: Log,
};

type Log = {
  version: string,
  creator: Creator,
  browser?: Browser,
  pages?: Page[],
  entries: Entry[],  // Network requests
};

type Entry = {
  pageref?: string,
  startedDateTime: string,
  time: number,  // Total time (ms)
  request: Request,
  response: Response,
  cache: Cache,
  timings: Timings,
  serverIPAddress?: string,
  connection?: string,
  // Custom Playwright fields:
  _frameref?: string,
  _monotonicTime?: number,
  _serverPort?: number,
  _securityDetails?: SecurityDetails,
  _wasAborted?: boolean,
  _wasFulfilled?: boolean,
  _wasContinued?: boolean,
  _apiRequest?: boolean,  // True for fetch/axios requests
};
```

---

## 5. Snapshot Format (snapshot.ts)

### FrameSnapshot
```typescript
type FrameSnapshot = {
  snapshotName?: string,
  callId: string,           // Associated action
  pageId: string,
  frameId: string,
  frameUrl: string,
  timestamp: number,
  wallTime?: number,
  collectionTime: number,   // Time to capture
  doctype?: string,
  html: NodeSnapshot,       // Encoded DOM tree
  resourceOverrides: ResourceOverride[],  // Inlined resources
  viewport: { width: number, height: number },
  isMainFrame: boolean,
};
```

### NodeSnapshot
Compact encoding of DOM tree:
```typescript
type NodeSnapshot =
  TextNodeSnapshot |                    // string
  SubtreeReferenceSnapshot |            // [ [snapshotIndex, nodeIndex] ]
  NodeNameAttributesChildNodesSnapshot; // [ name, attributes?, ...children ]
```

### ResourceOverride
Embeds resource data in snapshot:
```typescript
type ResourceOverride = {
  url: string,
  sha1?: string,  // External resource SHA1
  ref?: number    // Snapshot index reference
};
```

---

## 6. Trace Storage Format

### File Structure
When a trace is recorded, it creates this structure in the traces directory:

```
traces-dir/
├── <traceName>.trace        # Main events (JSONL format)
├── <traceName>.network      # Network events (JSONL format)
├── <traceName>-chunk1.trace # Additional chunks (if multiple)
├── <traceName>.stacks       # Stack trace metadata (optional)
└── resources/
    ├── <sha1>               # Resource files (images, etc.)
    └── <sha1>
```

### File Formats
- **`.trace` and `.network`**: JSONL (JSON Lines) - one event per line
- **`.zip`**: Optional archive containing all above files
- **`resources/`**: Binary blobs indexed by SHA1 hash

### Live Trace Format
For live tracing (test runner):
```
traces-dir/
├── <testName>.json     # Synthesized trace metadata
├── <testName>/
    ├── events.jsonl
    ├── network.jsonl
    └── resources/
```

---

## 7. Trace Recording (tracing.ts)

Located: `/home/pfeldman/code/playwright/packages/playwright-core/src/server/trace/recorder/tracing.ts`

### Tracing Class Architecture

```typescript
export class Tracing extends SdkObject implements 
  InstrumentationListener,
  SnapshotterDelegate,
  HarTracerDelegate {
  
  // Recording state
  private _state: RecordingState;
  
  // Components
  private _snapshotter?: Snapshotter;      // Captures DOM snapshots
  private _harTracer: HarTracer;           // Records network requests
  private _screencastListeners: ...        // Video recording
  
  // Methods
  start(options: TracerOptions);
  startChunk(progress, options);
  stopChunk(progress, params);
  stop(progress);
}
```

### What Gets Recorded

**1. Before Action (`onBeforeCall`)**
- Action metadata: class, method, parameters
- Stack trace
- "before" DOM snapshot
- Associated page/frame IDs

**2. Input Actions (`onBeforeInputAction`)**
- Pointer coordinates
- Input type
- Snapshot of input

**3. Action Logs (`onCallLog`)**
- API log messages
- User-facing messages

**4. After Action (`onAfterCall`)**
- Execution time
- Return value
- Error information (if failed)
- "after" DOM snapshot
- Attachments (screenshots, files)
- Annotations (custom data)

**5. Network Traffic (`onEntryFinished`)**
- HTTP request/response details
- Headers, cookies, body
- Timing information
- Security details

**6. Snapshots (`onFrameSnapshot`, `onSnapshotterBlob`)**
- Full DOM tree with inlined resources
- Viewport size
- Resource references

**7. Console Messages (`onConsoleMessage`)**
- Message type (log, error, warn)
- Text content
- Arguments
- Source location

**8. Events** 
- Dialogs
- Page errors
- Navigation events
- Downloads

**9. Screencast Frames**
- Video frames (if screenshots enabled)
- Frame dimensions
- Timestamps

**10. Stdio/Errors**
- stdout/stderr output
- Unhandled errors
- Process events

### Recording State
```typescript
type RecordingState = {
  options: TracerOptions,
  traceName: string,
  networkFile: string,
  traceFile: string,
  tracesDir: string,
  resourcesDir: string,
  chunkOrdinal: number,
  networkSha1s: Set<string>,
  traceSha1s: Set<string>,
  recording: boolean,
  callIds: Set<string>,
  groupStack: string[],  // For nested groups
};
```

---

## 8. Trace Loading (traceLoader.ts)

Located: `/home/pfeldman/code/playwright/packages/playwright-core/src/utils/isomorphic/trace/traceLoader.ts`

### TraceLoaderBackend Interface
```typescript
interface TraceLoaderBackend {
  entryNames(): Promise<string[]>;           // List files in trace
  hasEntry(entryName: string): Promise<boolean>;
  readText(entryName: string): Promise<string | undefined>;  // For JSONL
  readBlob(entryName: string): Promise<Blob | undefined>;    // For resources
  isLive(): boolean;  // Is this a live/developing trace?
}
```

### Built-in Backends

**ZipTraceLoaderBackend** (traceParser.ts)
- Loads `.trace.zip` files
- Uses ZipFile utility to read entries
- Converts file paths to file:// URLs

### Load Process
```typescript
async load(backend: TraceLoaderBackend, unzipProgress) {
  1. Find .trace files (ordinals: "0", "1", etc.)
  2. For each ordinal:
     a. Read ordinal.trace (events)
     b. Read ordinal.network (network events)
     c. Parse with TraceModernizer
     d. Read ordinal.stacks (if exists)
     e. Sort actions by startTime
  3. Terminate incomplete actions
  4. Finalize snapshot storage
  5. Build resource content-type map
  6. Push ContextEntry to contextEntries[]
}
```

### Output: ContextEntry[]
```typescript
type ContextEntry = {
  origin: 'testRunner' | 'library',
  startTime: number,      // Min action startTime
  endTime: number,        // Max action endTime
  browserName: string,
  wallTime: number,
  sdkLanguage?: Language,
  testIdAttributeName?: string,
  title?: string,
  options: BrowserContextEventOptions,
  pages: PageEntry[],      // Screencast data
  resources: ResourceSnapshot[],  // HAR entries
  actions: ActionEntry[],   // Merged before/after events
  events: EventTraceEvent[],
  stdio: StdioTraceEvent[],
  errors: ErrorTraceEvent[],
  hasSource: boolean,
  contextId: string,
  testTimeout?: number,
};
```

---

## 9. Trace Model (traceModel.ts)

Located: `/home/pfeldman/code/playwright/packages/playwright-core/src/utils/isomorphic/trace/traceModel.ts`

### TraceModel Class
High-level data model for trace viewer:

```typescript
class TraceModel {
  // Metadata
  startTime: number;
  endTime: number;
  browserName: string;
  channel?: string;
  platform?: string;
  playwrightVersion?: string;
  wallTime?: number;
  title?: string;
  options: BrowserContextEventOptions;
  sdkLanguage: Language;
  testIdAttributeName?: string;
  traceUri: string;  // URL to trace
  testTimeout?: number;

  // Data arrays
  pages: PageEntry[];          // Page screencast data
  actions: ActionTraceEventInContext[];  // All recorded actions
  attachments: Attachment[];   // Screenshots, files
  visibleAttachments: Attachment[];  // Non-private attachments
  events: (EventTraceEvent | ConsoleMessageTraceEvent)[];
  stdio: StdioTraceEvent[];
  errors: ErrorTraceEvent[];
  resources: ResourceEntry[];  // Network resources
  sources: Map<string, SourceModel>;  // Source code
  errorDescriptors: ErrorDescription[];  // Parsed errors
  
  // Counters
  actionCounters: Map<string, number>;  // Actions per group
  hasSource: boolean;         // Has source code available
  hasStepData: boolean;       // Has test runner data
  
  // Methods
  createRelativeUrl(path: string): string;
  failedAction(): ActionTraceEventInContext;
  filteredActions(actionsFilter: ActionGroup[]): ActionTraceEventInContext[];
}
```

### ActionTraceEventInContext
```typescript
type ActionTraceEventInContext = ActionEntry & {
  context: ContextEntry,
  group?: ActionGroup,  // Added by TraceModel
  log: { time: number, message: string }[],
};
```

---

## 10. Trace Modernizer (traceModernizer.ts)

Located: `/home/pfeldman/code/playwright/packages/playwright-core/src/utils/isomorphic/trace/traceModernizer.ts`

### Version Support
- **Latest:** Version 8
- **Supported:** Versions 3-8
- Upgrades older traces to current format

### TraceModernizer Class
```typescript
class TraceModernizer {
  constructor(contextEntry: ContextEntry, snapshotStorage: SnapshotStorage);
  
  appendTrace(trace: string);  // Parse JSONL trace lines
  actions(): ActionEntry[];    // Get parsed actions
  
  private _modernize(event: any);  // Upgrade event to latest version
  private _innerAppendEvent(event: TraceEvent);  // Process event
}
```

### How It Works
1. Parses JSONL (one JSON object per line)
2. Detects trace version from first `context-options` event
3. Applies version-specific upgrades using `_modernize_N_to_N+1()` functions
4. Consolidates before/after events into unified actions
5. Builds dependency graph for nested actions
6. Stores snapshots in SnapshotStorage

---

## 11. Trace Viewer

Located: `/home/pfeldman/code/playwright/packages/trace-viewer/src/`

### Structure
```
trace-viewer/src/
├── index.tsx              # Entry point
├── sw-main.ts             # Service worker
└── ui/
    ├── workbench.tsx      # Main UI component
    ├── actionList.tsx     # Action timeline
    ├── callTab.tsx        # Action details
    ├── snapshotTab.tsx    # DOM snapshot viewer
    ├── networkTab.tsx     # Network waterfall
    ├── consoleTab.tsx     # Console messages
    ├── timeline.tsx       # Time-based view
    ├── filmStrip.tsx      # Video frames
    ├── logTab.tsx         # Action logs
    ├── attachmentsTab.tsx # Files, screenshots
    ├── playbackControl.tsx # Video playback
    └── [other tabs...]
```

### Data Flow
1. **Service Worker (`sw-main.ts`)** - Intercepts trace URL fetch
2. **Workbench Loader** - Loads trace via TraceLoader
3. **TraceModel** - Parses and indexes loaded data
4. **UI Components** - Display actions, snapshots, network, etc.
5. **Playback Control** - Synchronizes timeline with snapshots

### Key Data Models
- **TraceModel** - Loaded and parsed trace data
- **ActionTraceEventInContext** - Single action with context
- **Attachment** - File or screenshot data
- **SourceModel** - Source code + errors

---

## 12. CLI Commands

Located: `/home/pfeldman/code/playwright/packages/playwright-core/src/cli/program.ts`

### show-trace Command
```bash
playwright show-trace [trace] [options]

Options:
  -b, --browser <browserType>   Browser to use (chromium, firefox, webkit)
  -h, --host <host>            Host to serve on
  -p, --port <port>            Port to serve on (0 = any free port)
  --stdin                       Accept trace URLs over stdin
  
Examples:
  $ show-trace
  $ show-trace https://example.com/trace.zip
  $ show-trace /path/to/trace.zip
  $ show-trace /path/to/trace/dir
```

### Implementation (program.ts: 327-355)
```typescript
program
  .command('show-trace [trace]')
  .option('-b, --browser <browserType>', ..., 'chromium')
  .option('-h, --host <host>', 'Host to serve trace on')
  .option('-p, --port <port>', 'Port to serve trace on')
  .option('--stdin', 'Accept trace URLs over stdin')
  .description('show trace viewer')
  .action(function(trace, options) {
    const openOptions: TraceViewerServerOptions = {
      host: options.host,
      port: +options.port,
      isServer: !!options.stdin,
    };
    
    if (options.port !== undefined || options.host !== undefined)
      runTraceInBrowser(trace, openOptions);  // Opens in browser tab
    else
      runTraceViewerApp(trace, options.browser, openOptions);  // Opens in app window
  });
```

### Trace Viewer Server (traceViewer.ts)
```typescript
startTraceViewerServer(options?: TraceViewerServerOptions): Promise<HttpServer>
  // Routes:
  // GET /trace/file?path=<filePath>        → Serve trace file
  // GET /trace/file?path=<path>.json       → Synthesize trace metadata
  // GET /trace/file?path=<traceDir>/...    → Serve trace.dir contents
  // GET /trace/<other>                     → Serve viewer assets

runTraceViewerApp(traceUrl, browserName, options)
  // Opens trace viewer in persistent browser context

runTraceInBrowser(traceUrl, options)
  // Opens trace viewer in browser tab (tab.open)
```

---

## 13. Data Available Per Action

### Per-Action Data Structure
```typescript
ActionTraceEventInContext {
  // Identifiers
  callId: string;           // Unique action ID
  pageId?: string;          // Associated page
  parentId?: string;        // Parent action (nested)
  stepId?: string;          // Test step ID
  group?: ActionGroup;      // Action category
  
  // Timing
  startTime: number;        // Monotonic time (milliseconds)
  endTime: number;          // When action completed
  
  // API Information
  class: string;            // Class name (Page, Frame, etc.)
  method: string;           // Method name (click, goto, etc.)
  params: Record<string, any>;  // Input parameters
  result?: any;             // Return value
  
  // Code Location
  stack?: StackFrame[];     // Call stack with file/line/column
  title?: string;           // User-facing name
  
  // Snapshots
  beforeSnapshot?: string;  // "before@<callId>" reference
  inputSnapshot?: string;   // "input@<callId>" reference
  afterSnapshot?: string;   // "after@<callId>" reference
  
  // Errors
  error?: SerializedError;  // Error message and stack
  
  // Logging
  log: { time: number, message: string }[];  // Action logs
  
  // Attachments
  attachments?: AfterActionTraceEventAttachment[];
  // { name, contentType, path?, sha1?, base64? }
  
  // Annotations
  annotations?: AfterActionTraceEventAnnotation[];
  // { type, description? }
  
  // Interaction Details
  point?: Point;            // Pointer coordinates {x, y}
  
  // Reference
  context: ContextEntry;    // Associated browser context
}
```

### Snapshot Data
Each snapshot can be accessed via `TraceLoader.storage()`:
```typescript
FrameSnapshot {
  callId: string,              // Associated action
  pageId: string,
  frameId: string,
  frameUrl: string,
  html: NodeSnapshot,          // Encoded DOM tree
  resourceOverrides: [         // Embedded resources
    { url, sha1?, ref? }
  ],
  viewport: { width, height },
  isMainFrame: boolean,
  collectionTime: number,      // ms to capture
  timestamp: number,           // Monotonic time
  wallTime?: number,
}
```

### Network Data (HAR Entry)
```typescript
Entry {
  request: {
    method: string,        // GET, POST, etc.
    url: string,
    httpVersion: string,
    headers: Header[],
    cookies: Cookie[],
    queryString: { name, value }[],
    postData?: {
      mimeType: string,
      params: Param[],
      text: string,
      _sha1?: string,      // Reference to resources/
    },
  },
  response: {
    status: number,        // 200, 404, etc.
    statusText: string,
    headers: Header[],
    cookies: Cookie[],
    content: {
      size: number,
      mimeType: string,
      text?: string,
      _sha1?: string,      // Reference to resources/
      compression?: number,
    },
    redirectURL: string,
  },
  timings: {               // All in milliseconds
    blocked?: number,
    dns?: number,
    connect?: number,
    send: number,
    wait: number,          // Time to first byte
    receive: number,
    ssl?: number,
  },
  time: number,            // Total time
  _monotonicTime?: number, // Monotonic timestamp
  _wasFulfilled?: boolean,
  _wasAborted?: boolean,
  _apiRequest?: boolean,   // fetch/axios
}
```

---

## 14. Quick Reference: Accessing Trace Data

### In Trace Viewer
```typescript
// Load trace
const traceLoader = new TraceLoader();
const backend = new ZipTraceLoaderBackend('trace.zip');
await traceLoader.load(backend, (done, total) => {});

// Access context
const contextEntries = traceLoader.contextEntries;

// Get trace model
const traceModel = new TraceModel(traceUri, contextEntries);

// Iterate actions
for (const action of traceModel.actions) {
  console.log(action.method);        // e.g., "click"
  console.log(action.params);        // parameters
  console.log(action.result);        // return value
  console.log(action.error);         // error if failed
  console.log(action.log);           // log messages
}

// Get snapshots
const snapshotStorage = traceLoader.storage();
const snapshot = snapshotStorage.snapshotByName('before@<callId>');

// Get resource
const blob = await traceLoader.resourceForSha1(sha1);
```

### In Test Runner
```typescript
// Access via trace via browser context
const trace = await context.tracing.stop({ path: 'trace.zip' });

// Use server-side Tracing class
const tracing = new Tracing(context, tracesDir);
tracing.start({ snapshots: true, screenshots: true });
// ... run test ...
await tracing.stopChunk(progress, { mode: 'archive' });
await tracing.stop(progress);
```

---

## 15. Version Information

### Trace Format Versions
- **Version 3**: Early format (~1.35)
- **Version 4**: Updates (~1.36)
- **Version 5**: Improvements (~1.37)
- **Version 6**: Major changes (~10/2023, ~1.40)
- **Version 7**: Further updates (~05/2024, ~1.45)
- **Version 8**: Current format (latest)

### Compatibility
- Trace viewer automatically upgrades traces
- Newer viewer can read older traces
- Older viewer cannot read newer traces (TraceVersionError)

---

## 16. Key Design Patterns

### 1. Call ID Correlation
Every action uses a unique `callId` to correlate:
- Before event
- Input events
- Log messages
- After event
- Snapshots (before@callId, input@callId, after@callId)
- Attachments
- Network requests (indirect via timing)

### 2. Lazy Loading
- Snapshots stored by SHA1
- Resources fetched on demand
- JSONL format allows streaming

### 3. Snapshot References
- Instead of storing full DOM repeatedly
- Later snapshots reference earlier ones: `[[snapshotIndex, nodeIndex]]`
- Resources inlined via `resourceOverrides`

### 4. Dual Time Bases
- **wallTime**: Milliseconds since epoch (for display)
- **monotonicTime**: Internal monotonic clock (for correlation)

### 5. Chunked Recording
- Tests can have multiple chunks
- Each chunk has separate `.trace` file
- Network resources preserved across chunks

### 6. Grouping
- Actions can be grouped with `group()` / `groupEnd()`
- Used for test steps, fixtures
- Group tracking in `RecordingState.groupStack`

---

## 17. File Reference Guide

| File | Size | Purpose |
|------|------|---------|
| `trace/src/trace.ts` | 183 lines | Trace event types |
| `trace/src/har.ts` | 189 lines | Network HAR types |
| `trace/src/snapshot.ts` | 62 lines | Snapshot types |
| `playwright-core/.../tracing.ts` | 700+ lines | Recording engine |
| `playwright-core/.../traceParser.ts` | 62 lines | ZIP backend |
| `playwright-core/.../traceViewer.ts` | 288 lines | Viewer server |
| `playwright-core/.../traceLoader.ts` | 158 lines | Load traces |
| `playwright-core/.../traceModel.ts` | 300+ lines | Data model |
| `playwright-core/.../traceModernizer.ts` | 500+ lines | Version upgrades |
| `trace-viewer/src/index.tsx` | 48 lines | Viewer entry |
| `trace-viewer/src/ui/workbench.tsx` | Main UI | Display |

