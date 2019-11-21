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
import { FrameManager, FrameManagerEvents, normalizeWaitUntil } from './FrameManager';
import { Keyboard, Mouse } from './Input';
import { createHandle, ElementHandle, JSHandle } from './JSHandle';
import { NavigationWatchdog } from './NavigationWatchdog';
import { NetworkManager, NetworkManagerEvents, Request, Response } from './NetworkManager';


const writeFileAsync = helper.promisify(fs.writeFile);

export class Page extends EventEmitter {
  private _timeoutSettings: TimeoutSettings;
  private _session: JugglerSession;
  private _target: Target;
  private _keyboard: Keyboard;
  private _mouse: Mouse;
  readonly accessibility: Accessibility;
  readonly interception: Interception;
  private _closed: boolean;
  private _pageBindings: Map<string, Function>;
  private _networkManager: NetworkManager;
  private _frameManager: FrameManager;
  private _eventListeners: RegisteredListener[];
  private _viewport: Viewport;
  private _disconnectPromise: Promise<Error>;

  static async create(session, target: Target, defaultViewport: Viewport | null) {
    const page = new Page(session, target);
    await Promise.all([
      session.send('Runtime.enable'),
      session.send('Network.enable'),
      session.send('Page.enable'),
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
    this._keyboard = new Keyboard(session);
    this._mouse = new Mouse(session, this._keyboard);
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

  async cookies(...urls: Array<string>): Promise<Array<any>> {
    const connection = Connection.fromSession(this._session);
    const {cookies} = await connection.send('Browser.getCookies', {
      browserContextId: this._target._context._browserContextId || undefined,
      urls: urls.length ? urls : [this.url()]
    });
    // Firefox's cookies are missing sameSite when it is 'None'
    return cookies.map(cookie => ({sameSite: 'None', ...cookie}));
  }

  async deleteCookie(...cookies: Array<any>) {
    const pageURL = this.url();
    const items = [];
    for (const cookie of cookies) {
      const item = {
        url: cookie.url,
        domain: cookie.domain,
        path: cookie.path,
        name: cookie.name,
      };
      if (!item.url && pageURL.startsWith('http'))
        item.url = pageURL;
      items.push(item);
    }

    const connection = Connection.fromSession(this._session);
    await connection.send('Browser.deleteCookies', {
      browserContextId: this._target._context._browserContextId || undefined,
      cookies: items,
    });
  }

  async setCookie(...cookies: Array<any>) {
    const pageURL = this.url();
    const startsWithHTTP = pageURL.startsWith('http');
    const items = cookies.map(cookie => {
      const item = Object.assign({}, cookie);
      if (!item.url && startsWithHTTP)
        item.url = pageURL;
      assert(item.url !== 'about:blank', `Blank page can not have cookie "${item.name}"`);
      assert(!String.prototype.startsWith.call(item.url || '', 'data:'), `Data URL page can not have cookie "${item.name}"`);
      return item;
    });
    await this.deleteCookie(...items);
    if (items.length) {
      const connection = Connection.fromSession(this._session);
      await connection.send('Browser.setCookies', {
        browserContextId: this._target._context._browserContextId || undefined,
        cookies: items
      });
    }
  }

  async setExtraHTTPHeaders(headers) {
    await this._networkManager.setExtraHTTPHeaders(headers);
  }

  async emulateMedia(type: string): Promise<void> {
    await this.emulateMediaType(type);
  }

  async emulateMediaType(type: string | null) {
    assert(type === 'screen' || type === 'print' || type === null, 'Unsupported media type: ' + type);
    await this._session.send('Page.setEmulatedMedia', {media: type || ''});
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

  mainFrame() {
    return this._frameManager.mainFrame();
  }

  get keyboard(){
    return this._keyboard;
  }

  get mouse(){
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

  async evaluate(pageFunction, ...args) {
    return await this._frameManager.mainFrame().evaluate(pageFunction, ...args);
  }

  async addScriptTag(options: { content?: string; path?: string; type?: string; url?: string; }): Promise<ElementHandle> {
    return await this._frameManager.mainFrame().addScriptTag(options);
  }

  async addStyleTag(options: { content?: string; path?: string; url?: string; }): Promise<ElementHandle> {
    return await this._frameManager.mainFrame().addStyleTag(options);
  }

  async click(selector: string, options: { delay?: number; button?: string; clickCount?: number; } | undefined = {}) {
    return await this._frameManager.mainFrame().click(selector, options);
  }

  async type(selector: string, text: string, options: { delay: (number | undefined); } | undefined) {
    return await this._frameManager.mainFrame().type(selector, text, options);
  }

  async focus(selector: string) {
    return await this._frameManager.mainFrame().focus(selector);
  }

  async hover(selector: string) {
    return await this._frameManager.mainFrame().hover(selector);
  }

  async waitFor(selectorOrFunctionOrTimeout: (string | number | Function), options: { polling?: string | number; timeout?: number; visible?: boolean; hidden?: boolean; } | undefined = {}, ...args: Array<any>): Promise<JSHandle> {
    return await this._frameManager.mainFrame().waitFor(selectorOrFunctionOrTimeout, options, ...args);
  }

  async waitForFunction(pageFunction: Function | string, options: { polling?: string | number; timeout?: number; } | undefined = {}, ...args): Promise<JSHandle> {
    return await this._frameManager.mainFrame().waitForFunction(pageFunction, options, ...args);
  }

  async waitForSelector(selector: string, options: { timeout?: number; visible?: boolean; hidden?: boolean; } | undefined = {}): Promise<ElementHandle> {
    return await this._frameManager.mainFrame().waitForSelector(selector, options);
  }

  async waitForXPath(xpath: string, options: { timeout?: number; visible?: boolean; hidden?: boolean; } | undefined = {}): Promise<ElementHandle> {
    return await this._frameManager.mainFrame().waitForXPath(xpath, options);
  }

  async title(): Promise<string> {
    return await this._frameManager.mainFrame().title();
  }

  async $(selector: string): Promise<ElementHandle | null> {
    return await this._frameManager.mainFrame().$(selector);
  }

  async $$(selector: string): Promise<Array<ElementHandle>> {
    return await this._frameManager.mainFrame().$$(selector);
  }

  async $eval(selector: string, pageFunction: Function | string, ...args: Array<any>): Promise<(object | undefined)> {
    return await this._frameManager.mainFrame().$eval(selector, pageFunction, ...args);
  }

  async $$eval(selector: string, pageFunction: Function | string, ...args: Array<any>): Promise<(object | undefined)> {
    return await this._frameManager.mainFrame().$$eval(selector, pageFunction, ...args);
  }

  async $x(expression: string): Promise<Array<ElementHandle>> {
    return await this._frameManager.mainFrame().$x(expression);
  }

  async evaluateHandle(pageFunction, ...args) {
    return await this._frameManager.mainFrame().evaluateHandle(pageFunction, ...args);
  }

  async select(selector: string, ...values: Array<string>): Promise<Array<string>> {
    return await this._frameManager.mainFrame().select(selector, ...values);
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