import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as mime from 'mime';
import { TimeoutError } from '../Errors';
import { assert, debugError, helper, RegisteredListener } from '../helper';
import { TimeoutSettings } from '../TimeoutSettings';
import { BrowserContext, Target } from './Browser';
import { Connection, JugglerSession, JugglerSessionEvents } from './Connection';
import { Dialog } from './Dialog';
import { Events } from './events';
import { Accessibility } from './features/accessibility';
import { Interception } from './features/interception';
import { FrameManager, FrameManagerEvents, normalizeWaitUntil, Frame } from './FrameManager';
import { RawMouseImpl, RawKeyboardImpl } from './Input';
import { createHandle, ElementHandle, JSHandle } from './JSHandle';
import { NavigationWatchdog } from './NavigationWatchdog';
import { NetworkManager, NetworkManagerEvents, Request, Response } from './NetworkManager';
import * as input from '../input';
import * as types from '../types';

const writeFileAsync = helper.promisify(fs.writeFile);

export class Page extends EventEmitter {
  private _timeoutSettings: TimeoutSettings;
  private _session: JugglerSession;
  private _target: Target;
  private _keyboard: input.Keyboard;
  private _mouse: input.Mouse;
  readonly accessibility: Accessibility;
  readonly interception: Interception;
  private _closed: boolean;
  private _pageBindings: Map<string, Function>;
  private _networkManager: NetworkManager;
  private _frameManager: FrameManager;
  private _eventListeners: RegisteredListener[];
  private _viewport: Viewport;
  private _disconnectPromise: Promise<Error>;
  private _fileChooserInterceptionIsDisabled = false;
  private _fileChooserInterceptors = new Set<(chooser: FileChooser) => void>();

  static async create(session: JugglerSession, target: Target, defaultViewport: Viewport | null) {
    const page = new Page(session, target);
    await Promise.all([
      session.send('Runtime.enable'),
      session.send('Network.enable'),
      session.send('Page.enable'),
      session.send('Page.setInterceptFileChooserDialog', { enabled: true }).catch(e => {
        page._fileChooserInterceptionIsDisabled = true;
      }),
    ]);

    if (defaultViewport)
      await page.setViewport(defaultViewport);
    return page;
  }

  constructor(session: JugglerSession, target: Target) {
    super();
    this._timeoutSettings = new TimeoutSettings();
    this._session = session;
    this._target = target;
    this._keyboard = new input.Keyboard(new RawKeyboardImpl(session));
    this._mouse = new input.Mouse(new RawMouseImpl(session), this._keyboard);
    this.accessibility = new Accessibility(session);
    this._closed = false;
    this._pageBindings = new Map();
    this._networkManager = new NetworkManager(session);
    this._frameManager = new FrameManager(session, this, this._networkManager, this._timeoutSettings);
    this._networkManager.setFrameManager(this._frameManager);
    this.interception = new Interception(this._networkManager);
    this._eventListeners = [
      helper.addEventListener(this._session, 'Page.uncaughtError', this._onUncaughtError.bind(this)),
      helper.addEventListener(this._session, 'Runtime.console', this._onConsole.bind(this)),
      helper.addEventListener(this._session, 'Page.dialogOpened', this._onDialogOpened.bind(this)),
      helper.addEventListener(this._session, 'Page.bindingCalled', this._onBindingCalled.bind(this)),
      helper.addEventListener(this._session, 'Page.fileChooserOpened', this._onFileChooserOpened.bind(this)),
      helper.addEventListener(this._frameManager, FrameManagerEvents.Load, () => this.emit(Events.Page.Load)),
      helper.addEventListener(this._frameManager, FrameManagerEvents.DOMContentLoaded, () => this.emit(Events.Page.DOMContentLoaded)),
      helper.addEventListener(this._frameManager, FrameManagerEvents.FrameAttached, frame => this.emit(Events.Page.FrameAttached, frame)),
      helper.addEventListener(this._frameManager, FrameManagerEvents.FrameDetached, frame => this.emit(Events.Page.FrameDetached, frame)),
      helper.addEventListener(this._frameManager, FrameManagerEvents.FrameNavigated, frame => this.emit(Events.Page.FrameNavigated, frame)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.Request, request => this.emit(Events.Page.Request, request)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.Response, response => this.emit(Events.Page.Response, response)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.RequestFinished, request => this.emit(Events.Page.RequestFinished, request)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.RequestFailed, request => this.emit(Events.Page.RequestFailed, request)),
    ];
    this._viewport = null;
    this._target._isClosedPromise.then(() => {
      this._closed = true;
      this._frameManager.dispose();
      this._networkManager.dispose();
      helper.removeEventListeners(this._eventListeners);
      this.emit(Events.Page.Close);
    });
  }

  async setExtraHTTPHeaders(headers) {
    await this._networkManager.setExtraHTTPHeaders(headers);
  }

  async emulateMedia(options: {
      type?: string,
      colorScheme?: 'dark' | 'light' | 'no-preference' }) {
    assert(!options.type || input.mediaTypes.has(options.type), 'Unsupported media type: ' + options.type);
    assert(!options.colorScheme || input.mediaColorSchemes.has(options.colorScheme), 'Unsupported color scheme: ' + options.colorScheme);
    await this._session.send('Page.setEmulatedMedia', options);
  }

  async exposeFunction(name: string, playwrightFunction: Function) {
    if (this._pageBindings.has(name))
      throw new Error(`Failed to add page binding with name ${name}: window['${name}'] already exists!`);
    this._pageBindings.set(name, playwrightFunction);

    const expression = helper.evaluationString(addPageBinding, name);
    await this._session.send('Page.addBinding', {name: name});
    await this._session.send('Page.addScriptToEvaluateOnNewDocument', {script: expression});
    await Promise.all(this.frames().map(frame => frame.evaluate(expression).catch(debugError)));

    function addPageBinding(bindingName: string) {
      const binding: (string) => void = window[bindingName];
      window[bindingName] = (...args) => {
        const me = window[bindingName];
        let callbacks = me['callbacks'];
        if (!callbacks) {
          callbacks = new Map();
          me['callbacks'] = callbacks;
        }
        const seq = (me['lastSeq'] || 0) + 1;
        me['lastSeq'] = seq;
        const promise = new Promise((resolve, reject) => callbacks.set(seq, {resolve, reject}));
        binding(JSON.stringify({name: bindingName, seq, args}));
        return promise;
      };
    }
  }

  async _onBindingCalled(event: any) {
    const {name, seq, args} = JSON.parse(event.payload);
    let expression = null;
    try {
      const result = await this._pageBindings.get(name)(...args);
      expression = helper.evaluationString(deliverResult, name, seq, result);
    } catch (error) {
      if (error instanceof Error)
        expression = helper.evaluationString(deliverError, name, seq, error.message, error.stack);
      else
        expression = helper.evaluationString(deliverErrorValue, name, seq, error);
    }
    this._session.send('Runtime.evaluate', { expression, executionContextId: event.executionContextId }).catch(debugError);

    function deliverResult(name: string, seq: number, result: any) {
      window[name]['callbacks'].get(seq).resolve(result);
      window[name]['callbacks'].delete(seq);
    }

    function deliverError(name: string, seq: number, message: string, stack: string) {
      const error = new Error(message);
      error.stack = stack;
      window[name]['callbacks'].get(seq).reject(error);
      window[name]['callbacks'].delete(seq);
    }

    function deliverErrorValue(name: string, seq: number, value: any) {
      window[name]['callbacks'].get(seq).reject(value);
      window[name]['callbacks'].delete(seq);
    }
  }

  _sessionClosePromise() {
    if (!this._disconnectPromise)
      this._disconnectPromise = new Promise<Error>(fulfill => this._session.once(JugglerSessionEvents.Disconnected, () => fulfill(new Error('Target closed'))));
    return this._disconnectPromise;
  }

  async waitForRequest(urlOrPredicate: (string | Function), options: { timeout?: number; } | undefined = {}): Promise<Request> {
    const {
      timeout = this._timeoutSettings.timeout(),
    } = options;
    return helper.waitForEvent(this._networkManager, NetworkManagerEvents.Request, request => {
      if (helper.isString(urlOrPredicate))
        return (urlOrPredicate === request.url());
      if (typeof urlOrPredicate === 'function')
        return !!(urlOrPredicate(request));
      return false;
    }, timeout, this._sessionClosePromise());
  }

  async waitForResponse(urlOrPredicate: (string | Function), options: { timeout?: number; } | undefined = {}): Promise<Response> {
    const {
      timeout = this._timeoutSettings.timeout(),
    } = options;
    return helper.waitForEvent(this._networkManager, NetworkManagerEvents.Response, response => {
      if (helper.isString(urlOrPredicate))
        return (urlOrPredicate === response.url());
      if (typeof urlOrPredicate === 'function')
        return !!(urlOrPredicate(response));
      return false;
    }, timeout, this._sessionClosePromise());
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }

  async setUserAgent(userAgent: string) {
    await this._session.send('Page.setUserAgent', {userAgent});
  }

  async setJavaScriptEnabled(enabled) {
    await this._session.send('Page.setJavascriptEnabled', {enabled});
  }

  async setBypassCSP(enabled: boolean) {
    await this._session.send('Page.setBypassCSP', { enabled });
  }

  async setCacheEnabled(enabled) {
    await this._session.send('Page.setCacheDisabled', {cacheDisabled: !enabled});
  }

  async emulate(options: { viewport: Viewport; userAgent: string; }) {
    await Promise.all([
      this.setViewport(options.viewport),
      this.setUserAgent(options.userAgent),
    ]);
  }

  browserContext(): BrowserContext {
    return this._target.browserContext();
  }

  _onUncaughtError(params) {
    const error = new Error(params.message);
    error.stack = params.stack;
    this.emit(Events.Page.PageError, error);
  }

  viewport() {
    return this._viewport;
  }

  async setViewport(viewport: Viewport) {
    const {
      width,
      height,
      isMobile = false,
      deviceScaleFactor = 1,
      hasTouch = false,
      isLandscape = false,
    } = viewport;
    await this._session.send('Page.setViewport', {
      viewport: { width, height, isMobile, deviceScaleFactor, hasTouch, isLandscape },
    });
    const oldIsMobile = this._viewport ? this._viewport.isMobile : false;
    const oldHasTouch = this._viewport ? this._viewport.hasTouch : false;
    this._viewport = viewport;
    if (oldIsMobile !== isMobile || oldHasTouch !== hasTouch)
      await this.reload();
  }

  async evaluateOnNewDocument(pageFunction: Function | string, ...args: Array<any>) {
    const script = helper.evaluationString(pageFunction, ...args);
    await this._session.send('Page.addScriptToEvaluateOnNewDocument', { script });
  }

  browser() {
    return this._target.browser();
  }

  target() {
    return this._target;
  }

  url() {
    return this._frameManager.mainFrame().url();
  }

  frames() {
    return this._frameManager.frames();
  }

  _onDialogOpened(params) {
    this.emit(Events.Page.Dialog, new Dialog(this._session, params));
  }

  mainFrame(): Frame {
    return this._frameManager.mainFrame();
  }

  get keyboard(): input.Keyboard {
    return this._keyboard;
  }

  get mouse(): input.Mouse {
    return this._mouse;
  }

  async waitForNavigation(options: { timeout?: number; waitUntil?: string | Array<string>; } = {}) {
    return this._frameManager.mainFrame().waitForNavigation(options);
  }

  async goto(url: string, options: { timeout?: number; waitUntil?: string | Array<string>; } = {}) {
    return this._frameManager.mainFrame().goto(url, options);
  }

  async goBack(options: { timeout?: number; waitUntil?: string | Array<string>; } = {}) {
    const {
      timeout = this._timeoutSettings.navigationTimeout(),
      waitUntil = ['load'],
    } = options;
    const frame = this._frameManager.mainFrame();
    const normalizedWaitUntil = normalizeWaitUntil(waitUntil);
    const {navigationId, navigationURL} = await this._session.send('Page.goBack', {
      frameId: frame._frameId,
    });
    if (!navigationId)
      return null;

    const timeoutError = new TimeoutError('Navigation timeout of ' + timeout + ' ms exceeded');
    let timeoutCallback;
    const timeoutPromise = new Promise(resolve => timeoutCallback = resolve.bind(null, timeoutError));
    const timeoutId = timeout ? setTimeout(timeoutCallback, timeout) : null;

    const watchDog = new NavigationWatchdog(this._session, frame, this._networkManager, navigationId, navigationURL, normalizedWaitUntil);
    const error = await Promise.race([
      timeoutPromise,
      watchDog.promise(),
    ]);
    watchDog.dispose();
    clearTimeout(timeoutId);
    if (error)
      throw error;
    return watchDog.navigationResponse();
  }

  async goForward(options: { timeout?: number; waitUntil?: string | Array<string>; } = {}) {
    const {
      timeout = this._timeoutSettings.navigationTimeout(),
      waitUntil = ['load'],
    } = options;
    const frame = this._frameManager.mainFrame();
    const normalizedWaitUntil = normalizeWaitUntil(waitUntil);
    const {navigationId, navigationURL} = await this._session.send('Page.goForward', {
      frameId: frame._frameId,
    });
    if (!navigationId)
      return null;

    const timeoutError = new TimeoutError('Navigation timeout of ' + timeout + ' ms exceeded');
    let timeoutCallback;
    const timeoutPromise = new Promise(resolve => timeoutCallback = resolve.bind(null, timeoutError));
    const timeoutId = timeout ? setTimeout(timeoutCallback, timeout) : null;

    const watchDog = new NavigationWatchdog(this._session, frame, this._networkManager, navigationId, navigationURL, normalizedWaitUntil);
    const error = await Promise.race([
      timeoutPromise,
      watchDog.promise(),
    ]);
    watchDog.dispose();
    clearTimeout(timeoutId);
    if (error)
      throw error;
    return watchDog.navigationResponse();
  }

  async reload(options: { timeout?: number; waitUntil?: string | Array<string>; } = {}) {
    const {
      timeout = this._timeoutSettings.navigationTimeout(),
      waitUntil = ['load'],
    } = options;
    const frame = this._frameManager.mainFrame();
    const normalizedWaitUntil = normalizeWaitUntil(waitUntil);
    const {navigationId, navigationURL} = await this._session.send('Page.reload', {
      frameId: frame._frameId,
    });
    if (!navigationId)
      return null;

    const timeoutError = new TimeoutError('Navigation timeout of ' + timeout + ' ms exceeded');
    let timeoutCallback;
    const timeoutPromise = new Promise(resolve => timeoutCallback = resolve.bind(null, timeoutError));
    const timeoutId = timeout ? setTimeout(timeoutCallback, timeout) : null;

    const watchDog = new NavigationWatchdog(this._session, frame, this._networkManager, navigationId, navigationURL, normalizedWaitUntil);
    const error = await Promise.race([
      timeoutPromise,
      watchDog.promise(),
    ]);
    watchDog.dispose();
    clearTimeout(timeoutId);
    if (error)
      throw error;
    return watchDog.navigationResponse();
  }

  async screenshot(options: { fullPage?: boolean; clip?: { width: number; height: number; x: number; y: number; }; encoding?: string; path?: string; } = {}): Promise<string | Buffer> {
    const {data} = await this._session.send('Page.screenshot', {
      mimeType: getScreenshotMimeType(options),
      fullPage: options.fullPage,
      clip: processClip(options.clip),
    });
    const buffer = options.encoding === 'base64' ? data : Buffer.from(data, 'base64');
    if (options.path)
      await writeFileAsync(options.path, buffer);
    return buffer;

    function processClip(clip) {
      if (!clip)
        return undefined;
      const x = Math.round(clip.x);
      const y = Math.round(clip.y);
      const width = Math.round(clip.width + clip.x - x);
      const height = Math.round(clip.height + clip.y - y);
      return {x, y, width, height};
    }
  }

  evaluate: types.Evaluate<JSHandle> = (pageFunction, ...args) => {
    return this.mainFrame().evaluate(pageFunction, ...args as any);
  }

  addScriptTag(options: { content?: string; path?: string; type?: string; url?: string; }): Promise<ElementHandle> {
    return this.mainFrame().addScriptTag(options);
  }

  addStyleTag(options: { content?: string; path?: string; url?: string; }): Promise<ElementHandle> {
    return this.mainFrame().addStyleTag(options);
  }

  click(selector: string, options?: input.ClickOptions) {
    return this.mainFrame().click(selector, options);
  }

  dblclick(selector: string, options?: input.MultiClickOptions) {
    return this.mainFrame().dblclick(selector, options);
  }

  tripleclick(selector: string, options?: input.MultiClickOptions) {
    return this.mainFrame().tripleclick(selector, options);
  }

  fill(selector: string, value: string) {
    return this.mainFrame().fill(selector, value);
  }

  select(selector: string, ...values: Array<string>): Promise<Array<string>> {
    return this._frameManager.mainFrame().select(selector, ...values);
  }

  type(selector: string, text: string, options: { delay: (number | undefined); } | undefined) {
    return this._frameManager.mainFrame().type(selector, text, options);
  }

  focus(selector: string) {
    return this._frameManager.mainFrame().focus(selector);
  }

  hover(selector: string) {
    return this._frameManager.mainFrame().hover(selector);
  }

  waitFor(selectorOrFunctionOrTimeout: (string | number | Function), options: { polling?: string | number; timeout?: number; visible?: boolean; hidden?: boolean; } | undefined = {}, ...args: Array<any>): Promise<JSHandle> {
    return this._frameManager.mainFrame().waitFor(selectorOrFunctionOrTimeout, options, ...args);
  }

  waitForFunction(pageFunction: Function | string, options: { polling?: string | number; timeout?: number; } | undefined = {}, ...args): Promise<JSHandle> {
    return this._frameManager.mainFrame().waitForFunction(pageFunction, options, ...args);
  }

  waitForSelector(selector: string, options: { timeout?: number; visible?: boolean; hidden?: boolean; } | undefined = {}): Promise<ElementHandle> {
    return this._frameManager.mainFrame().waitForSelector(selector, options);
  }

  waitForXPath(xpath: string, options: { timeout?: number; visible?: boolean; hidden?: boolean; } | undefined = {}): Promise<ElementHandle> {
    return this._frameManager.mainFrame().waitForXPath(xpath, options);
  }

  title(): Promise<string> {
    return this._frameManager.mainFrame().title();
  }

  $(selector: string): Promise<ElementHandle | null> {
    return this._frameManager.mainFrame().$(selector);
  }

  $$(selector: string): Promise<Array<ElementHandle>> {
    return this._frameManager.mainFrame().$$(selector);
  }

  $eval: types.$Eval<JSHandle> = (selector, pageFunction, ...args) => {
    return this._frameManager.mainFrame().$eval(selector, pageFunction, ...args as any);
  }

  $$eval: types.$$Eval<JSHandle> = (selector, pageFunction, ...args) => {
    return this._frameManager.mainFrame().$$eval(selector, pageFunction, ...args as any);
  }

  $x(expression: string): Promise<Array<ElementHandle>> {
    return this._frameManager.mainFrame().$x(expression);
  }

  evaluateHandle: types.EvaluateHandle<JSHandle> = async (pageFunction, ...args) => {
    return this._frameManager.mainFrame().evaluateHandle(pageFunction, ...args as any);
  }

  async close(options: any = {}) {
    const {
      runBeforeUnload = false,
    } = options;
    await this._session.send('Page.close', { runBeforeUnload });
    if (!runBeforeUnload)
      await this._target._isClosedPromise;
  }

  async content() {
    return await this._frameManager.mainFrame().content();
  }

  async setContent(html: string) {
    return await this._frameManager.mainFrame().setContent(html);
  }

  _onConsole({type, args, executionContextId, location}) {
    const context = this._frameManager.executionContextById(executionContextId);
    this.emit(Events.Page.Console, new ConsoleMessage(type, args.map(arg => createHandle(context, arg)), location));
  }

  isClosed(): boolean {
    return this._closed;
  }

  async waitForFileChooser(options: { timeout?: number; } = {}): Promise<FileChooser> {
    if (this._fileChooserInterceptionIsDisabled)
      throw new Error('File chooser handling does not work with multiple connections to the same page');
    const {
      timeout = this._timeoutSettings.timeout(),
    } = options;
    let callback;
    const promise = new Promise<FileChooser>(x => callback = x);
    this._fileChooserInterceptors.add(callback);
    return helper.waitWithTimeout<FileChooser>(promise, 'waiting for file chooser', timeout).catch(e => {
      this._fileChooserInterceptors.delete(callback);
      throw e;
    });
  }

  async _onFileChooserOpened({executionContextId, element}) {
    const context = this._frameManager.executionContextById(executionContextId);
    if (!this._fileChooserInterceptors.size) {
      this._session.send('Page.handleFileChooser', { action: 'fallback' }).catch(debugError);
      return;
    }
    const handle = createHandle(context, element) as ElementHandle;
    const interceptors = Array.from(this._fileChooserInterceptors);
    this._fileChooserInterceptors.clear();
    const multiple = await handle.evaluate((element: HTMLInputElement) => !!element.multiple);
    const fileChooser = new FileChooser(this, this._session, handle, multiple);
    for (const interceptor of interceptors)
      interceptor.call(null, fileChooser);
  }
}

export class ConsoleMessage {
  private _type: string;
  private _args: any[];
  private _location: any;
  constructor(type: string, args: Array<JSHandle>, location) {
    this._type = type;
    this._args = args;
    this._location = location;
  }

  location() {
    return this._location;
  }

  type(): string {
    return this._type;
  }

  args(): Array<JSHandle> {
    return this._args;
  }

  text(): string {
    return this._args.map(arg => {
      if (arg._objectId)
        return arg.toString();
      return arg._deserializeValue(arg._protocolValue);
    }).join(' ');
  }
}

function getScreenshotMimeType(options) {
  // options.type takes precedence over inferring the type from options.path
  // because it may be a 0-length file with no extension created beforehand (i.e. as a temp file).
  if (options.type) {
    if (options.type === 'png')
      return 'image/png';
    if (options.type === 'jpeg')
      return 'image/jpeg';
    throw new Error('Unknown options.type value: ' + options.type);
  }
  if (options.path) {
    const fileType = mime.getType(options.path);
    if (fileType === 'image/png' || fileType === 'image/jpeg')
      return fileType;
    throw new Error('Unsupported screenshot mime type: ' + fileType);
  }
  return 'image/png';
}

export type Viewport = {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  isLandscape?: boolean;
  hasTouch?: boolean;
}

type MediaFeature = {
  name: string,
  value: string
};

export class FileChooser {
  private _page; Page;
  private _client: JugglerSession;
  private _element: ElementHandle;
  private _multiple: boolean;
  private _handled = false;

  constructor(page: Page, client: JugglerSession, element: ElementHandle, multiple: boolean) {
    this._page = page;
    this._client = client;
    this._element = element;
    this._multiple = multiple;
  }

  isMultiple(): boolean {
    return this._multiple;
  }

  async accept(filePaths: string[]): Promise<any> {
    assert(!this._handled, 'Cannot accept FileChooser which is already handled!');
    this._handled = true;
    await this._element.uploadFile(...filePaths);
  }

  async cancel(): Promise<any> {
    assert(!this._handled, 'Cannot cancel FileChooser which is already handled!');
    this._handled = true;
  }
}
