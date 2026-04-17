/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * WebSocket server that bridges Playwright MCP and Chrome Extension
 *
 * Endpoints:
 * - /cdp/guid - Full CDP interface for Playwright MCP
 * - /extension/guid - Extension connection for chrome.debugger forwarding
 */

import { spawn } from 'child_process';
import http from 'http';
import os from 'os';

import { debug, ws, wsServer } from 'playwright-core/lib/utilsBundle';
import { registry } from 'playwright-core/lib/server/registry/index';
import { ManualPromise } from 'playwright-core/lib/utils';

import { addressToString } from '../sdk/http';
import { logUnhandledError } from '../log';
import * as protocol from './protocol';

import type websocket from 'ws';
import type { ClientInfo } from '../sdk/server';
import type { ExtensionCommand, ExtensionEvents } from './protocol';
import type { WebSocket, WebSocketServer } from 'playwright-core/lib/utilsBundle';


const debugLogger = debug('pw:mcp:relay');

type CDPCommand = {
  id: number;
  sessionId?: string;
  method: string;
  params?: any;
};

type CDPResponse = {
  id?: number;
  sessionId?: string;
  method?: string;
  params?: any;
  result?: any;
  error?: { code?: number; message: string };
};

type ExtensionEventMessage = {
  [K in keyof ExtensionEvents]: { method: K; params: ExtensionEvents[K]['params'] }
}[keyof ExtensionEvents];

export class CDPRelayServer {
  private _wsHost: string;
  private _browserChannel: string;
  private _userDataDir?: string;
  private _executablePath?: string;
  private _cdpPath: string;
  private _extensionPath: string;
  private _wss: WebSocketServer;
  private _playwrightConnection: WebSocket | null = null;
  private _extensionConnection: ExtensionConnection | null = null;
  /** Maps synthetic sessionId (e.g. 'pw-tab-1') → tab info. */
  private _connectedTabs = new Map<string, { targetInfo: any; tabId: number; targetId: string; userAgent?: string }>();
  /** Maps Chrome tabId → synthetic sessionId for quick lookup. */
  private _tabIdToSessionId = new Map<number, string>();
  /** The sessionId of the primary (first-attached) tab. */
  private _primarySessionId: string | undefined;
  /** Tabs currently being attached (async gap guard for tabClosed race). */
  private _pendingTabAttach = new Set<number>();
  /** Tabs that closed during the async attach gap — cleaned up after registration. */
  private _closedDuringAttach = new Set<number>();
  /** Internal URL prefixes to skip when auto-adopting new tabs. */
  private static readonly INTERNAL_URL_PREFIXES = ['chrome-extension://', 'chrome://', 'about:'];
  private _nextSessionId: number = 1;
  private _extensionConnectionPromise!: ManualPromise<void>;

  // Fetch.enable pattern merging for inline PDF interception.
  // Tracks Playwright's Fetch.enable params per session (key: sessionId ?? '').
  // Response-stage patterns are merged into every Fetch.enable call so the relay
  // can intercept inline PDFs and inject Content-Disposition: attachment.
  private _playwrightFetchParams = new Map<string, { handleAuthRequests?: boolean; patterns: any[] }>();
  private _pdfInterceptionEnabled = true;

  // Response-stage patterns for PDF interception.
  // Document: navigation responses (main_frame + sub_frame) — inline PDFs.
  // XHR/Fetch: script-initiated responses — PDF.js viewers load PDFs via fetch()/XHR.
  private static readonly RESPONSE_PDF_PATTERNS: Array<{urlPattern: string; requestStage: string; resourceType?: string}> = [
    { urlPattern: '*', requestStage: 'Response', resourceType: 'Document' },
    { urlPattern: '*', requestStage: 'Response', resourceType: 'XHR' },
    { urlPattern: '*', requestStage: 'Response', resourceType: 'Fetch' },
  ];

  /**
   * Callback for captured PDF bodies (XHR/Fetch resources).
   * Set by the consumer (cdpRelayBridge) to receive captured PDFs without
   * round-tripping through the extension.
   */
  onPdfCaptured?: (params: { url: string; mimeType: string; bodyBase64: string; bodySize: number }) => void;

  constructor(server: http.Server, browserChannel: string, userDataDir?: string, executablePath?: string) {
    this._wsHost = addressToString(server.address(), { protocol: 'ws' });
    this._browserChannel = browserChannel;
    this._userDataDir = userDataDir;
    this._executablePath = executablePath;

    const uuid = crypto.randomUUID();
    this._cdpPath = `/cdp/${uuid}`;
    this._extensionPath = `/extension/${uuid}`;

    this._resetExtensionConnection();
    this._wss = new wsServer({ server });
    this._wss.on('connection', this._onConnection.bind(this));
  }

  cdpEndpoint() {
    return `${this._wsHost}${this._cdpPath}`;
  }

  extensionEndpoint() {
    return `${this._wsHost}${this._extensionPath}`;
  }

  async ensureExtensionConnectionForMCPContext(clientInfo: ClientInfo, abortSignal: AbortSignal, toolName: string | undefined) {
    debugLogger('Ensuring extension connection for MCP context');
    if (this._extensionConnection)
      return;
    this._connectBrowser(clientInfo, toolName);
    debugLogger('Waiting for incoming extension connection');
    await Promise.race([
      this._extensionConnectionPromise,
      new Promise((_, reject) => setTimeout(() => {
        reject(new Error(`Extension connection timeout. Make sure the "Playwright MCP Bridge" extension is installed. See https://github.com/microsoft/playwright-mcp/blob/main/extension/README.md for installation instructions.`));
      }, process.env.PWMCP_TEST_CONNECTION_TIMEOUT ? parseInt(process.env.PWMCP_TEST_CONNECTION_TIMEOUT, 10) : 5_000)),
      new Promise((_, reject) => abortSignal.addEventListener('abort', reject))
    ]);
    debugLogger('Extension connection established');
  }

  private _connectBrowser(clientInfo: ClientInfo, toolName: string | undefined) {
    const mcpRelayEndpoint = `${this._wsHost}${this._extensionPath}`;
    // Need to specify "key" in the manifest.json to make the id stable when loading from file.
    const url = new URL('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    url.searchParams.set('mcpRelayUrl', mcpRelayEndpoint);
    const client = {
      name: clientInfo.name,
      version: clientInfo.version,
    };
    url.searchParams.set('client', JSON.stringify(client));
    url.searchParams.set('protocolVersion', process.env.PWMCP_TEST_PROTOCOL_VERSION ?? protocol.VERSION.toString());
    if (toolName)
      url.searchParams.set('newTab', String(toolName === 'browser_navigate'));
    const token = process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN;
    if (token)
      url.searchParams.set('token', token);
    const href = url.toString();

    let executablePath = this._executablePath;
    if (!executablePath) {
      const executableInfo = registry.findExecutable(this._browserChannel);
      if (!executableInfo)
        throw new Error(`Unsupported channel: "${this._browserChannel}"`);
      executablePath = executableInfo.executablePath('javascript');
      if (!executablePath)
        throw new Error(`"${this._browserChannel}" executable not found. Make sure it is installed at a standard location.`);
    }

    const args: string[] = [];
    if (this._userDataDir)
      args.push(`--user-data-dir=${this._userDataDir}`);
    if (os.platform() === 'linux' && this._browserChannel === 'chromium')
      args.push('--no-sandbox');
    args.push(href);
    spawn(executablePath, args, {
      windowsHide: true,
      detached: true,
      shell: false,
      stdio: 'ignore',
    });
  }

  stop(): void {
    this.closeConnections('Server stopped');
    this._wss.close();
  }

  closeConnections(reason: string) {
    this._closePlaywrightConnection(reason);
    this._closeExtensionConnection(reason);
  }

  private _onConnection(ws: WebSocket, request: http.IncomingMessage): void {
    const url = new URL(`http://localhost${request.url}`);
    debugLogger(`New connection to ${url.pathname}`);
    if (url.pathname === this._cdpPath) {
      this._handlePlaywrightConnection(ws);
    } else if (url.pathname === this._extensionPath) {
      this._handleExtensionConnection(ws);
    } else {
      debugLogger(`Invalid path: ${url.pathname}`);
      ws.close(4004, 'Invalid path');
    }
  }

  private _handlePlaywrightConnection(ws: WebSocket): void {
    if (this._playwrightConnection) {
      debugLogger('Rejecting second Playwright connection');
      ws.close(1000, 'Another CDP client already connected');
      return;
    }
    this._playwrightConnection = ws;
    ws.on('message', async data => {
      try {
        const message = JSON.parse(data.toString());
        await this._handlePlaywrightMessage(message);
      } catch (error: any) {
        debugLogger(`Error while handling Playwright message\n${data.toString()}\n`, error);
      }
    });
    ws.on('close', () => {
      if (this._playwrightConnection !== ws)
        return;
      this._playwrightConnection = null;
      // Keep extension connection alive so the next PW client can reconnect
      // (multi-agent flows: LoginAgent → AccountValidationAgent use the same relay).
      // Reset tab maps so the next client re-attaches via Target.setAutoAttach.
      this._connectedTabs.clear();
      this._tabIdToSessionId.clear();
      this._primarySessionId = undefined;
      this._pendingTabAttach.clear();
      this._closedDuringAttach.clear();
      this._playwrightFetchParams.clear();
      debugLogger('Playwright WebSocket closed, extension connection kept alive');
    });
    ws.on('error', error => {
      debugLogger('Playwright WebSocket error:', error);
    });
    debugLogger('Playwright MCP connected');
  }

  private _closeExtensionConnection(reason: string) {
    this._extensionConnection?.close(reason);
    this._extensionConnectionPromise.reject(new Error(reason));
    this._resetExtensionConnection();
  }

  private _resetExtensionConnection() {
    this._connectedTabs.clear();
    this._tabIdToSessionId.clear();
    this._primarySessionId = undefined;
    this._pendingTabAttach.clear();
    this._closedDuringAttach.clear();
    this._extensionConnection = null;
    this._playwrightFetchParams.clear();
    this._extensionConnectionPromise = new ManualPromise();
    void this._extensionConnectionPromise.catch(logUnhandledError);
  }

  private _closePlaywrightConnection(reason: string) {
    if (this._playwrightConnection?.readyState === ws.OPEN)
      this._playwrightConnection.close(1000, reason);
    this._playwrightConnection = null;
  }

  private _handleExtensionConnection(ws: WebSocket): void {
    if (this._extensionConnection) {
      ws.close(1000, 'Another extension connection already established');
      return;
    }
    this._extensionConnection = new ExtensionConnection(ws);
    this._extensionConnection.onclose = (c, reason) => {
      debugLogger('Extension WebSocket closed:', reason, c === this._extensionConnection);
      if (this._extensionConnection !== c)
        return;
      this._resetExtensionConnection();
      this._closePlaywrightConnection(`Extension disconnected: ${reason}`);
    };
    this._extensionConnection.onmessage = this._handleExtensionMessage.bind(this);
    this._extensionConnectionPromise.resolve();
  }

  private _handleExtensionMessage(msg: ExtensionEventMessage) {
    switch (msg.method) {
      case 'forwardCDPEvent': {
        const eventParams = msg.params;
        // Resolve sessionId: use tabId from extension to look up synthetic sessionId,
        // fall back to child OOPIF sessionId, then primary sessionId.
        let sessionId: string | undefined;
        if (eventParams.sessionId) {
          // OOPIF child session — pass through as-is
          sessionId = eventParams.sessionId;
        } else if (eventParams.tabId !== undefined) {
          // Tab-level event — map tabId to our synthetic sessionId
          sessionId = this._tabIdToSessionId.get(eventParams.tabId);
        }
        if (!sessionId)
          sessionId = this._primarySessionId;

        const eventMethod = eventParams.method;

        // Filter response-stage Fetch.requestPaused — handle internally for PDF detection.
        // CRITICAL: response-stage events must NEVER reach Playwright's crNetworkManager.
        // It has zero response-stage awareness and would hang the request permanently.
        if (eventMethod === 'Fetch.requestPaused' && this._pdfInterceptionEnabled) {
          const ep = eventParams.params;
          if (ep?.responseStatusCode !== undefined || ep?.responseErrorReason !== undefined) {
            void this._handleResponseStagePaused(ep, sessionId);
            return;
          }
        }

        // Proactive response-stage Fetch.enable for OOPIF child sessions.
        // When Chrome creates an out-of-process iframe, it emits Target.attachedToTarget
        // with a new sessionId. We must enable response-stage Fetch on the child session
        // because Playwright MCP won't call Fetch.enable for it (no routes configured).
        if (eventMethod === 'Target.attachedToTarget' && this._pdfInterceptionEnabled) {
          const childSessionId = eventParams.params?.sessionId;
          if (childSessionId) {
            this._forwardToExtension('Fetch.enable', {
              patterns: [...CDPRelayServer.RESPONSE_PDF_PATTERNS],
            }, childSessionId).catch((e: Error) => {
              debugLogger(`OOPIF Fetch.enable failed for session ${childSessionId}: ${e.message}`);
            });
          }
        }

        if (eventMethod.startsWith('Page.') || eventMethod.startsWith('Target.') || eventMethod.startsWith('Network.'))
          debugLogger(`← Extension event: ${eventMethod} (sid=${sessionId ?? 'none'}) → PW=${!!this._playwrightConnection}`);

        // Keep the _connectedTabs targetInfo cache in sync with navigation.
        // Target.getTargetInfo responses otherwise return the URL captured at attach time.
        if (eventMethod === 'Page.frameNavigated') {
          const frame = (eventParams.params as any)?.frame;
          // Main frame only — skip subframe nav (parentId defined == subframe)
          if (frame && frame.parentId === undefined && sessionId) {
            const entry = this._connectedTabs.get(sessionId);
            if (entry?.targetInfo)
              entry.targetInfo = { ...entry.targetInfo, url: frame.url };
          }
        } else if (eventMethod === 'Target.targetInfoChanged') {
          const ti = (eventParams.params as any)?.targetInfo;
          if (ti?.targetId) {
            for (const entry of this._connectedTabs.values()) {
              if (entry.targetId === ti.targetId) {
                entry.targetInfo = { ...entry.targetInfo, ...ti };
                break;
              }
            }
          }
        }

        this._sendToPlaywright({
          sessionId,
          method: eventMethod,
          params: eventParams.params
        });
        break;
      }
      case 'tabCreated': {
        const tabId = msg.params.tabId;
        this._handleTabCreated(tabId, msg.params.sourceTabId, msg.params.url).catch((e: Error) => {
          debugLogger(`Error handling tabCreated for tab ${tabId}: ${e.message}`);
        });
        break;
      }
      case 'tabClosed': {
        this._handleTabClosed(msg.params.tabId);
        break;
      }
    }
  }

  private async _handleTabCreated(tabId: number, sourceTabId?: number, url?: string): Promise<void> {
    if (!this._extensionConnection)
      return;

    // Skip if already registered (dedup against race with Phase 2 createTab)
    if (this._tabIdToSessionId.has(tabId)) {
      debugLogger(`Tab ${tabId} already registered, skipping`);
      return;
    }

    debugLogger(`Tab created: ${tabId}${sourceTabId ? ` (source=${sourceTabId})` : ''}, attaching`);
    this._pendingTabAttach.add(tabId);
    let targetInfo: any;
    let userAgent: string | undefined;
    try {
      const result = await this._extensionConnection.send('attachToNewTab', { tabId });
      targetInfo = result?.targetInfo;
      userAgent = result?.userAgent;
    } catch (e: any) {
      // Tab may have closed before we could attach — ignore
      debugLogger(`Failed to attach to new tab ${tabId}: ${e.message}`);
      this._pendingTabAttach.delete(tabId);
      this._closedDuringAttach.delete(tabId);
      return;
    }

    if (!targetInfo) {
      debugLogger(`No targetInfo for tab ${tabId}, ignoring`);
      this._pendingTabAttach.delete(tabId);
      this._closedDuringAttach.delete(tabId);
      return;
    }

    // Filter internal URLs (chrome-extension://, chrome://, about:) —
    // these are not automation targets.
    const tabUrl: string = targetInfo.url ?? '';
    if (CDPRelayServer.INTERNAL_URL_PREFIXES.some(prefix => tabUrl.startsWith(prefix))) {
      debugLogger(`Tab ${tabId} has internal URL (${tabUrl}), detaching`);
      this._pendingTabAttach.delete(tabId);
      this._closedDuringAttach.delete(tabId);
      this._extensionConnection?.send('forwardCDPCommand', {
        tabId,
        method: 'Target.detachFromTarget',
        params: {},
      }).catch(() => { /* best effort */ });
      return;
    }

    // Enrich openerId from sourceTabId (provided by webNavigation.onCreatedNavigationTarget).
    // This makes Playwright's page.waitForEvent('popup') work for noopener popups.
    if (sourceTabId !== undefined && !targetInfo.openerId) {
      for (const entry of this._connectedTabs.values()) {
        if (entry.tabId === sourceTabId) {
          targetInfo = { ...targetInfo, openerId: entry.targetId };
          debugLogger(`Enriched openerId for tab ${tabId} from sourceTabId ${sourceTabId}`);
          break;
        }
      }
    }

    // Check if the tab closed during the async attach gap
    this._pendingTabAttach.delete(tabId);
    if (this._closedDuringAttach.has(tabId)) {
      debugLogger(`Tab ${tabId} closed during attach — skipping registration`);
      this._closedDuringAttach.delete(tabId);
      return;
    }

    // Register the tab — we own the entire Chrome window, so every tab is ours
    await this._registerTab(tabId, targetInfo, url ?? `openerId=${targetInfo.openerId ?? 'none'}`, userAgent);
  }

  private _handleTabClosed(tabId: number): void {
    // If this tab is still being attached asynchronously, defer cleanup
    if (this._pendingTabAttach.has(tabId)) {
      debugLogger(`Tab ${tabId} closed during pending attach — deferring`);
      this._closedDuringAttach.add(tabId);
      return;
    }

    const sessionId = this._tabIdToSessionId.get(tabId);
    if (!sessionId)
      return;

    const entry = this._connectedTabs.get(sessionId);
    const targetId = entry?.targetId;

    debugLogger(`Tab ${tabId} closed (${sessionId}, targetId=${targetId})`);
    this._connectedTabs.delete(sessionId);
    this._tabIdToSessionId.delete(tabId);

    // Synthesize Target.detachedFromTarget for Playwright.
    // CRITICAL: must include targetId — Playwright's _onDetachedFromTarget looks up
    // crPages by targetId. Without it, page.didClose() is never called and
    // page.close() hangs forever awaiting _closedPromise.
    this._sendToPlaywright({
      method: 'Target.detachedFromTarget',
      params: { sessionId, targetId },
    });
  }

  private async _handlePlaywrightMessage(message: CDPCommand): Promise<void> {
    debugLogger('← Playwright:', `${message.method} (id=${message.id}), ext_pending=${this._extensionConnection?._pendingCount ?? '?'}`);
    const { id, sessionId, method, params } = message;
    try {
      const result = await this._handleCDPCommand(method, params, sessionId);
      this._sendToPlaywright({ id, sessionId, result });
    } catch (e) {
      debugLogger('Error in the extension:', e);
      this._sendToPlaywright({
        id,
        sessionId,
        error: { message: (e as Error).message }
      });
    }
  }

  private async _handleCDPCommand(method: string, params: any, sessionId: string | undefined): Promise<any> {
    switch (method) {
      case 'Browser.getVersion': {
        // Return the real Chrome version reported by the extension (via attachToTab
        // userAgent field) so Playwright's version-gated CDP paths behave correctly.
        // Falls back to a safe minimum if no tab has attached yet.
        const primary = this._primarySessionId ? this._connectedTabs.get(this._primarySessionId) : undefined;
        const ua = primary?.userAgent;
        const chromeMatch = ua?.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
        const version = chromeMatch?.[1] ?? '120.0.0.0';
        return {
          protocolVersion: '1.3',
          product: `Chrome/${version}`,
          userAgent: ua ?? 'CDP-Bridge-Server/1.0.0',
        };
      }
      case 'Browser.setDownloadBehavior': {
        return { };
      }
      case 'Browser.getWindowForTarget': {
        // No-op stub: Browser.* domain is blocked in chrome.debugger, so forwarding
        // would crash. Playwright only calls this when !noDefaultViewport, which is
        // false for connectOverCDP today — this is defense for future callers.
        return { windowId: 0, bounds: {} };
      }
      case 'Browser.setWindowBounds': {
        return { };
      }
      case 'Target.closeTarget': {
        // Playwright sends Target.closeTarget on the root session (no sessionId)
        // with { targetId }. We need to find the matching tab and close it via
        // chrome.tabs.remove instead of forwarding the raw CDP command (which
        // would target the primary tab's debuggee and may not work).
        const targetId = params?.targetId;
        if (targetId) {
          for (const [sid, entry] of this._connectedTabs.entries()) {
            if (entry.targetId === targetId) {
              debugLogger(`Target.closeTarget: closing tab ${entry.tabId} (${sid}) via extension`);
              // Close via chrome.tabs.remove — this triggers onRemoved → tabClosed → _handleTabClosed
              await this._extensionConnection!.send('forwardCDPCommand', {
                tabId: entry.tabId,
                method: 'Page.close',
                params: {},
              }).catch(() => { /* best effort — tab may already be closing */ });
              return { };
            }
          }
        }
        debugLogger(`Target.closeTarget: targetId ${targetId} not found in tracked tabs`);
        return { };
      }
      case 'Target.setAutoAttach': {
        // Forward child session handling.
        if (sessionId)
          break;
        // Simulate auto-attach behavior with real target info
        const attachResult = await this._extensionConnection!.send('attachToTab', { });
        const targetInfo = attachResult?.targetInfo;
        const realTabId: number = attachResult?.tabId ?? 0;
        const userAgent: string | undefined = attachResult?.userAgent;
        const primarySessionId = `pw-tab-${this._nextSessionId++}`;
        const targetId = targetInfo?.targetId ?? `tab-primary`;
        this._connectedTabs.set(primarySessionId, { targetInfo, tabId: realTabId, targetId, userAgent });
        this._tabIdToSessionId.set(realTabId, primarySessionId);
        this._primarySessionId = primarySessionId;

        debugLogger('Simulating auto-attach');
        this._sendToPlaywright({
          method: 'Target.attachedToTarget',
          params: {
            sessionId: primarySessionId,
            targetInfo: {
              ...targetInfo,
              attached: true,
            },
            waitingForDebugger: false
          }
        });
        // Proactively enable response-stage Fetch interception for inline PDF capture.
        // Playwright MCP may never call Fetch.enable (it only does so when routes or
        // credentials are configured). We must ensure response-stage patterns are active
        // regardless. Awaited to prevent race with Playwright's subsequent Fetch.enable.
        if (this._pdfInterceptionEnabled) {
          try {
            await this._forwardToExtension('Fetch.enable', {
              patterns: [...CDPRelayServer.RESPONSE_PDF_PATTERNS],
            }, primarySessionId);
            debugLogger('Proactive response-stage Fetch.enable succeeded');
          } catch (e) {
            debugLogger(`Proactive response-stage Fetch.enable failed: ${(e as Error).message}`);
          }
        }
        return { };
      }
      case 'Target.getTargetInfo': {
        // Look up by sessionId if provided, otherwise return primary
        const entry = sessionId ? this._connectedTabs.get(sessionId) : undefined;
        if (entry)
          return entry.targetInfo;
        const primaryEntry = this._primarySessionId ? this._connectedTabs.get(this._primarySessionId) : undefined;
        return primaryEntry?.targetInfo;
      }
      case 'Fetch.enable': {
        const sessionKey = sessionId ?? '';
        this._playwrightFetchParams.set(sessionKey, {
          handleAuthRequests: params?.handleAuthRequests,
          patterns: params?.patterns ?? [],
        });
        const merged = this._buildMergedFetchParams(sessionKey);
        debugLogger(`Fetch.enable merge: PW patterns=${params?.patterns?.length ?? 0}, merged=${merged.patterns.length} (sid=${sessionId ?? 'none'})`);
        return await this._forwardToExtension('Fetch.enable', merged, sessionId);
      }
      case 'Fetch.disable': {
        const sessionKey = sessionId ?? '';
        this._playwrightFetchParams.delete(sessionKey);
        if (this._pdfInterceptionEnabled) {
          debugLogger('Fetch.disable → converting to response-only Fetch.enable for PDF interception');
          return await this._forwardToExtension('Fetch.enable', {
            patterns: [...CDPRelayServer.RESPONSE_PDF_PATTERNS],
          }, sessionId);
        }
        return await this._forwardToExtension('Fetch.disable', params, sessionId);
      }
    }
    // New-tab detection is handled entirely by chrome.tabs.onCreated → tabCreated events.
    // The observational monkey-patch lets window.open() create real tabs, so there's no
    // need to poll __sapotoOpenCalls after click/keypress events.

    return await this._forwardToExtension(method, params, sessionId);
  }

  /**
   * Register a new tab with Playwright — synthesizes Target.attachedToTarget
   * and optionally enables PDF interception. Shared by both pending-tab claiming
   * and relay-created-tab registration to avoid duplicated logic.
   */
  private async _registerTab(tabId: number, targetInfo: any, debugLabel?: string, userAgent?: string): Promise<void> {
    // Final dedup guard — prevent duplicate Target.attachedToTarget for the same tab
    if (this._tabIdToSessionId.has(tabId)) {
      debugLogger(`_registerTab: tab ${tabId} already registered as ${this._tabIdToSessionId.get(tabId)}, skipping`);
      return;
    }
    targetInfo = this._ensureBrowserContextId(targetInfo);
    const newSessionId = `pw-tab-${this._nextSessionId++}`;
    const targetId = targetInfo.targetId ?? `tab-${tabId}`;
    this._connectedTabs.set(newSessionId, { targetInfo, tabId, targetId, userAgent });
    this._tabIdToSessionId.set(tabId, newSessionId);

    debugLogger(`Tab ${tabId} registered as ${newSessionId}${debugLabel ? ` for ${debugLabel}` : ''}`);

    // Synthesize Target.attachedToTarget for Playwright
    this._sendToPlaywright({
      method: 'Target.attachedToTarget',
      params: {
        sessionId: newSessionId,
        targetInfo: { ...targetInfo, attached: true },
        waitingForDebugger: false,
      },
    });

    // Proactive Fetch.enable for PDF interception on the new tab
    if (this._pdfInterceptionEnabled) {
      try {
        await this._forwardToExtension('Fetch.enable', {
          patterns: [...CDPRelayServer.RESPONSE_PDF_PATTERNS],
        }, newSessionId);
        debugLogger(`Proactive Fetch.enable for tab ${tabId} (${newSessionId})`);
      } catch (e) {
        debugLogger(`Fetch.enable failed for tab ${tabId}: ${(e as Error).message}`);
      }
    }
  }

  /**
   * Ensure targetInfo has a browserContextId, falling back to the primary tab's value.
   * Playwright hard-asserts this field (crBrowser.ts:166), but CDP may omit it.
   */
  private _ensureBrowserContextId(targetInfo: any): any {
    if (targetInfo?.browserContextId)
      return targetInfo;
    if (this._primarySessionId) {
      const primary = this._connectedTabs.get(this._primarySessionId);
      if (primary?.targetInfo?.browserContextId)
        return { ...targetInfo, browserContextId: primary.targetInfo.browserContextId };
    }
    return targetInfo;
  }

  private async _forwardToExtension(method: string, params: any, sessionId: string | undefined): Promise<any> {
    if (!this._extensionConnection)
      throw new Error('Extension not connected');

    const tabEntry = sessionId ? this._connectedTabs.get(sessionId) : undefined;
    if (tabEntry) {
      // Tab-level command: strip synthetic sessionId, route by tabId
      return await this._extensionConnection.send('forwardCDPCommand', {
        tabId: tabEntry.tabId,
        method,
        params,
      });
    }

    // OOPIF child session or root — pass sessionId through as-is.
    // For primary tab: sessionId won't be in _connectedTabs if it's an OOPIF child.
    // Strip the primary synthetic sessionId (extension doesn't know about it).
    if (sessionId === this._primarySessionId)
      sessionId = undefined;
    return await this._extensionConnection.send('forwardCDPCommand', { sessionId, method, params });
  }

  private _buildMergedFetchParams(sessionKey: string): any {
    const pwParams = this._playwrightFetchParams.get(sessionKey);
    if (!this._pdfInterceptionEnabled)
      return pwParams;
    const pwPatterns = pwParams?.patterns ?? [];
    return {
      handleAuthRequests: pwParams?.handleAuthRequests,
      patterns: [...pwPatterns, ...CDPRelayServer.RESPONSE_PDF_PATTERNS],
    };
  }

  private async _handleResponseStagePaused(eventParams: any, sessionId: string | undefined): Promise<void> {
    const { requestId, request, responseStatusCode, responseHeaders, responseErrorReason, resourceType } = eventParams;

    // Error responses — continue immediately, nothing to intercept
    if (responseErrorReason) {
      debugLogger(`Response-stage error: ${responseErrorReason} url=${request?.url}`);
      this._continueFetchResponse(requestId, sessionId);
      return;
    }

    const contentType = (responseHeaders as Array<{ name: string; value: string }>)
        ?.find((h: { name: string }) => h.name.toLowerCase() === 'content-type')
        ?.value ?? '';

    const url = request?.url ?? 'unknown';
    const shortUrl = url.length > 120 ? url.slice(0, 120) + '...' : url;
    debugLogger(`Response-stage: status=${responseStatusCode} ct="${contentType}" url=${shortUrl}`);

    if (!contentType.toLowerCase().includes('application/pdf')) {
      this._continueFetchResponse(requestId, sessionId);
      return;
    }

    // XHR/Fetch PDFs: capture body and forward to desktop (Content-Disposition injection
    // has no effect on script-initiated responses — they don't trigger downloads)
    if (resourceType === 'XHR' || resourceType === 'Fetch') {
      await this._captureAndForwardPdf(requestId, request?.url, responseStatusCode, responseHeaders, sessionId);
      return;
    }

    // Skip if already has Content-Disposition: attachment — Layer 2 handles these
    const hasAttachment = (responseHeaders as Array<{ name: string; value: string }>)
        ?.some((h: { name: string; value: string }) =>
          h.name.toLowerCase() === 'content-disposition' &&
        h.value.toLowerCase().startsWith('attachment'));
    if (hasAttachment) {
      this._continueFetchResponse(requestId, sessionId);
      return;
    }

    // Inject Content-Disposition: attachment to convert inline PDF to download
    debugLogger(`PDF interception: injecting Content-Disposition: attachment for ${request?.url}`);
    const newHeaders = [
      ...(responseHeaders ?? []).filter(
          (h: { name: string }) => h.name.toLowerCase() !== 'content-disposition'
      ),
      { name: 'Content-Disposition', value: 'attachment' },
    ];

    try {
      await this._forwardToExtension('Fetch.continueResponse', {
        requestId, responseCode: responseStatusCode, responseHeaders: newHeaders,
      }, sessionId);
    } catch (e) {
      debugLogger(`Error in continueResponse for PDF: ${(e as Error).message}`);
      // MUST continue to avoid hanging the request — fall back to unmodified response
      this._continueFetchResponse(requestId, sessionId);
    }
  }

  /**
   * Capture the body of a PDF response from XHR/Fetch and forward to the desktop
   * via the onPdfCaptured callback. Content-Disposition injection has no effect on
   * script-initiated responses (they don't trigger downloads), so we must capture
   * the body directly and hand it to the download pipeline.
   */
  private async _captureAndForwardPdf(
    requestId: string,
    url: string | undefined,
    responseStatusCode: number | undefined,
    responseHeaders: Array<{ name: string; value: string }> | undefined,
    sessionId: string | undefined,
  ): Promise<void> {
    try {
      const bodyResult = await this._forwardToExtension('Fetch.getResponseBody', { requestId }, sessionId) as {
        body: string;
        base64Encoded: boolean;
      };

      if (!bodyResult?.body) {
        debugLogger(`PDF body capture: empty body for ${url ?? 'unknown'}`);
        this._continueFetchResponse(requestId, sessionId);
        return;
      }

      const bodyBase64 = bodyResult.base64Encoded
        ? bodyResult.body
        : Buffer.from(bodyResult.body, 'binary').toString('base64');

      const bodySize = Math.ceil(bodyBase64.length * 0.75); // approximate decoded size

      debugLogger(`PDF body capture: ${url ?? 'unknown'} (${(bodySize / 1024).toFixed(0)}KB)`);

      // Forward captured PDF to the desktop via callback (set by cdpRelayBridge)
      if (this.onPdfCaptured) {
        this.onPdfCaptured({
          url: url ?? 'unknown',
          mimeType: 'application/pdf',
          bodyBase64,
          bodySize,
        });
      } else {
        debugLogger('PDF body capture: no onPdfCaptured callback registered, dropping');
      }

      // Continue the response so the page receives the PDF normally
      this._continueFetchResponse(requestId, sessionId);
    } catch (e) {
      debugLogger(`PDF body capture failed: ${(e as Error).message}`);
      this._continueFetchResponse(requestId, sessionId);
    }
  }

  private _continueFetchResponse(requestId: string, sessionId: string | undefined): void {
    this._forwardToExtension('Fetch.continueResponse', { requestId }, sessionId).catch((e: Error) => {
      debugLogger(`Error continuing fetch response: ${e.message}`);
    });
  }

  private _sendToPlaywright(message: CDPResponse): void {
    const desc = message.method ?? `response(id=${message.id})`;
    const wsState = this._playwrightConnection?.readyState;
    debugLogger(`→ Playwright: ${desc} (ws=${wsState})`);
    if (!this._playwrightConnection) {
      debugLogger(`⚠ DROP: no PW connection for ${desc}`);
      return;
    }
    if (this._playwrightConnection.readyState !== ws.OPEN) {
      debugLogger(`⚠ DROP: PW ws not OPEN (state=${wsState}) for ${desc}`);
      return;
    }
    this._playwrightConnection.send(JSON.stringify(message));
  }
}

type ExtensionResponse = {
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: string;
};

class ExtensionConnection {
  private readonly _ws: WebSocket;
  private readonly _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: Error) => void, error: Error, timer?: ReturnType<typeof setTimeout> }>();
  private _lastId = 0;

  onmessage?: (msg: ExtensionEventMessage) => void;
  onclose?: (self: ExtensionConnection, reason: string) => void;

  get _pendingCount(): number {
    return this._callbacks.size;
  }

  constructor(ws: WebSocket) {
    this._ws = ws;
    this._ws.on('message', this._onMessage.bind(this));
    this._ws.on('close', this._onClose.bind(this));
    this._ws.on('error', this._onError.bind(this));
  }

  async send<M extends keyof ExtensionCommand>(method: M, params: ExtensionCommand[M]['params']): Promise<any> {
    if (this._ws.readyState !== ws.OPEN)
      throw new Error(`Unexpected WebSocket state: ${this._ws.readyState}`);
    const id = ++this._lastId;
    const t0 = Date.now();
    debugLogger(`→ Extension: ${method} (id=${id}), pending=${this._callbacks.size}`);
    this._ws.send(JSON.stringify({ id, method, params }));
    const error = new Error(`Protocol error: ${method}`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._callbacks.delete(id);
        debugLogger(`⚠ TIMEOUT: ${method} (id=${id}) after ${Date.now() - t0}ms, pending=${this._callbacks.size}`);
        reject(new Error(`Extension command timeout: ${method} (60s). Pending callbacks: ${this._callbacks.size}`));
      }, 60_000);
      this._callbacks.set(id, {
        resolve: (v: any) => {
          debugLogger(`← Extension: ${method} (id=${id}) +${Date.now() - t0}ms`);
          resolve(v);
        },
        reject,
        error,
        timer,
      });
    });
  }

  close(message: string) {
    debugLogger('closing extension connection:', message);
    if (this._ws.readyState === ws.OPEN)
      this._ws.close(1000, message);
  }

  private _onMessage(event: websocket.RawData) {
    const eventData = event.toString();
    let parsedJson;
    try {
      parsedJson = JSON.parse(eventData);
    } catch (e: any) {
      debugLogger(`<closing ws> Closing websocket due to malformed JSON. eventData=${eventData} e=${e?.message}`);
      this._ws.close();
      return;
    }
    try {
      this._handleParsedMessage(parsedJson);
    } catch (e: any) {
      debugLogger(`<closing ws> Closing websocket due to failed onmessage callback. eventData=${eventData} e=${e?.message}`);
      this._ws.close();
    }
  }

  private _handleParsedMessage(object: ExtensionResponse) {
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id)!;
      this._callbacks.delete(object.id);
      if (callback.timer)
        clearTimeout(callback.timer);
      if (object.error) {
        const error = callback.error;
        error.message = object.error;
        callback.reject(error);
      } else {
        callback.resolve(object.result);
      }
    } else if (object.id) {
      debugLogger('← Extension: unexpected response', object);
    } else {
      this.onmessage?.({
        method: object.method! as keyof ExtensionEvents,
        params: object.params,
      } as ExtensionEventMessage);
    }
  }

  private _onClose(event: websocket.CloseEvent) {
    debugLogger(`<ws closed> code=${event.code} reason=${event.reason}`);
    this._dispose();
    this.onclose?.(this, event.reason);
  }

  private _onError(event: websocket.ErrorEvent) {
    debugLogger(`<ws error> message=${event.message} type=${event.type} target=${event.target}`);
    this._dispose();
  }

  private _dispose() {
    for (const callback of this._callbacks.values()) {
      if (callback.timer)
        clearTimeout(callback.timer);
      callback.reject(new Error('WebSocket closed'));
    }
    this._callbacks.clear();
  }
}
