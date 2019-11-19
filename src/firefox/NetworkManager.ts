import {helper, assert, debugError} from '../helper';
import {EventEmitter} from 'events';
import { JugglerSession } from './Connection';
import { FrameManager } from './FrameManager';

export const NetworkManagerEvents = {
  RequestFailed: Symbol('NetworkManagerEvents.RequestFailed'),
  RequestFinished: Symbol('NetworkManagerEvents.RequestFinished'),
  Request: Symbol('NetworkManagerEvents.Request'),
  Response: Symbol('NetworkManagerEvents.Response'),
};

export class NetworkManager extends EventEmitter {
  private _session: JugglerSession;
  private _requests: Map<any, any>;
  private _frameManager: FrameManager;
  private _eventListeners: any[];
  constructor(session) {
    super();
    this._session = session;

    this._requests = new Map();
    this._frameManager = null;

    this._eventListeners = [
      helper.addEventListener(session, 'Network.requestWillBeSent', this._onRequestWillBeSent.bind(this)),
      helper.addEventListener(session, 'Network.responseReceived', this._onResponseReceived.bind(this)),
      helper.addEventListener(session, 'Network.requestFinished', this._onRequestFinished.bind(this)),
      helper.addEventListener(session, 'Network.requestFailed', this._onRequestFailed.bind(this)),
    ];
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }

  setFrameManager(frameManager: FrameManager) {
    this._frameManager = frameManager;
  }

  async setExtraHTTPHeaders(headers) {
    const array = [];
    for (const [name, value] of Object.entries(headers)) {
      assert(helper.isString(value), `Expected value of header "${name}" to be String, but "${typeof value}" is found.`);
      array.push({name, value});
    }
    await this._session.send('Network.setExtraHTTPHeaders', {headers: array});
  }

  async setRequestInterception(enabled) {
    await this._session.send('Network.setRequestInterception', {enabled});
  }

  _onRequestWillBeSent(event) {
    const redirected = event.redirectedFrom ? this._requests.get(event.redirectedFrom) : null;
    const frame = redirected ? redirected.frame() : (this._frameManager && event.frameId ? this._frameManager.frame(event.frameId) : null);
    if (!frame)
      return;
    let redirectChain = [];
    if (redirected) {
      redirectChain = redirected._redirectChain;
      redirectChain.push(redirected);
      this._requests.delete(redirected._id);
    }
    const request = new Request(this._session, frame, redirectChain, event);
    this._requests.set(request._id, request);
    this.emit(NetworkManagerEvents.Request, request);
  }

  _onResponseReceived(event) {
    const request = this._requests.get(event.requestId);
    if (!request)
      return;
    const response = new Response(this._session, request, event);
    request._response = response;
    this.emit(NetworkManagerEvents.Response, response);
  }

  _onRequestFinished(event) {
    const request = this._requests.get(event.requestId);
    if (!request)
      return;
    // Keep redirected requests in the map for future reference in redirectChain.
    const isRedirected = request.response().status() >= 300 && request.response().status() <= 399;
    if (isRedirected) {
      request.response()._bodyLoadedPromiseFulfill.call(null, new Error('Response body is unavailable for redirect responses'));
    } else {
      this._requests.delete(request._id);
      request.response()._bodyLoadedPromiseFulfill.call(null);
    }
    this.emit(NetworkManagerEvents.RequestFinished, request);
  }

  _onRequestFailed(event) {
    const request = this._requests.get(event.requestId);
    if (!request)
      return;
    this._requests.delete(request._id);
    if (request.response())
      request.response()._bodyLoadedPromiseFulfill.call(null);
    request._errorText = event.errorCode;
    this.emit(NetworkManagerEvents.RequestFailed, request);
  }
}

const causeToResourceType = {
  TYPE_INVALID: 'other',
  TYPE_OTHER: 'other',
  TYPE_SCRIPT: 'script',
  TYPE_IMAGE: 'image',
  TYPE_STYLESHEET: 'stylesheet',
  TYPE_OBJECT: 'other',
  TYPE_DOCUMENT: 'document',
  TYPE_SUBDOCUMENT: 'document',
  TYPE_REFRESH: 'document',
  TYPE_XBL: 'other',
  TYPE_PING: 'other',
  TYPE_XMLHTTPREQUEST: 'xhr',
  TYPE_OBJECT_SUBREQUEST: 'other',
  TYPE_DTD: 'other',
  TYPE_FONT: 'font',
  TYPE_MEDIA: 'media',
  TYPE_WEBSOCKET: 'websocket',
  TYPE_CSP_REPORT: 'other',
  TYPE_XSLT: 'other',
  TYPE_BEACON: 'other',
  TYPE_FETCH: 'fetch',
  TYPE_IMAGESET: 'images',
  TYPE_WEB_MANIFEST: 'manifest',
};

export class Request {
  _id(_id: any, request: Request) {
    throw new Error('Method not implemented.');
  }
  _session: any;
  _frame: any;
  _redirectChain: any;
  _url: any;
  _postData: any;
  _suspended: any;
  _response: any;
  _errorText: any;
  _isNavigationRequest: any;
  _method: any;
  _resourceType: any;
  _headers: {};
  _interceptionHandled: boolean;
  constructor(session, frame, redirectChain, payload) {
    this._session = session;
    this._frame = frame;
    this._id = payload.requestId;
    this._redirectChain = redirectChain;
    this._url = payload.url;
    this._postData = payload.postData;
    this._suspended = payload.suspended;
    this._response = null;
    this._errorText = null;
    this._isNavigationRequest = payload.isNavigationRequest;
    this._method = payload.method;
    this._resourceType = causeToResourceType[payload.cause] || 'other';
    this._headers = {};
    this._interceptionHandled = false;
    for (const {name, value} of payload.headers)
      this._headers[name.toLowerCase()] = value;
  }

  failure() {
    return this._errorText ? {errorText: this._errorText} : null;
  }

  async continue(overrides: any = {}) {
    assert(!overrides.url, 'Playwright-Firefox does not support overriding URL');
    assert(!overrides.method, 'Playwright-Firefox does not support overriding method');
    assert(!overrides.postData, 'Playwright-Firefox does not support overriding postData');
    assert(this._suspended, 'Request Interception is not enabled!');
    assert(!this._interceptionHandled, 'Request is already handled!');
    this._interceptionHandled = true;
    const {
      headers,
    } = overrides;
    await this._session.send('Network.resumeSuspendedRequest', {
      requestId: this._id,
      headers: headers ? Object.entries(headers).filter(([, value]) => !Object.is(value, undefined)).map(([name, value]) => ({name, value})) : undefined,
    }).catch(error => {
      debugError(error);
    });
  }

  async abort() {
    assert(this._suspended, 'Request Interception is not enabled!');
    assert(!this._interceptionHandled, 'Request is already handled!');
    this._interceptionHandled = true;
    await this._session.send('Network.abortSuspendedRequest', {
      requestId: this._id,
    }).catch(error => {
      debugError(error);
    });
  }

  postData() {
    return this._postData;
  }

  headers() {
    return {...this._headers};
  }

  redirectChain() {
    return this._redirectChain.slice();
  }

  resourceType() {
    return this._resourceType;
  }

  url() {
    return this._url;
  }

  method() {
    return this._method;
  }

  isNavigationRequest() {
    return this._isNavigationRequest;
  }

  frame() {
    return this._frame;
  }

  response() {
    return this._response;
  }
}

export class Response {
  _session: any;
  _request: any;
  _remoteIPAddress: any;
  _remotePort: any;
  _status: any;
  _statusText: any;
  _headers: {};
  _securityDetails: SecurityDetails;
  _bodyLoadedPromise: Promise<unknown>;
  _bodyLoadedPromiseFulfill: (value?: unknown) => void;
  _contentPromise: any;
  constructor(session, request, payload) {
    this._session = session;
    this._request = request;
    this._remoteIPAddress = payload.remoteIPAddress;
    this._remotePort = payload.remotePort;
    this._status = payload.status;
    this._statusText = payload.statusText;
    this._headers = {};
    this._securityDetails = payload.securityDetails ? new SecurityDetails(payload.securityDetails) : null;
    for (const {name, value} of payload.headers)
      this._headers[name.toLowerCase()] = value;
    this._bodyLoadedPromise = new Promise(fulfill => {
      this._bodyLoadedPromiseFulfill = fulfill;
    });
  }

  buffer(): Promise<Buffer> {
    if (!this._contentPromise) {
      this._contentPromise = this._bodyLoadedPromise.then(async error => {
        if (error)
          throw error;
        const response = await this._session.send('Network.getResponseBody', {
          requestId: this._request._id
        });
        if (response.evicted)
          throw new Error(`Response body for ${this._request.method()} ${this._request.url()} was evicted!`);
        return Buffer.from(response.base64body, 'base64');
      });
    }
    return this._contentPromise;
  }

  async text(): Promise<string> {
    const content = await this.buffer();
    return content.toString('utf8');
  }

  async json(): Promise<object> {
    const content = await this.text();
    return JSON.parse(content);
  }

  securityDetails() {
    return this._securityDetails;
  }

  headers() {
    return {...this._headers};
  }

  status() {
    return this._status;
  }

  statusText() {
    return this._statusText;
  }

  ok() {
    return this._status >= 200 && this._status <= 299;
  }

  remoteAddress() {
    return {
      ip: this._remoteIPAddress,
      port: this._remotePort,
    };
  }

  frame() {
    return this._request.frame();
  }

  url() {
    return this._request.url();
  }

  request() {
    return this._request;
  }
}

export class SecurityDetails {
  _subjectName: string;
  _issuer: string;
  _validFrom: number;
  _validTo: number;
  _protocol: string;
  constructor(securityPayload: any) {
    this._subjectName = securityPayload['subjectName'];
    this._issuer = securityPayload['issuer'];
    this._validFrom = securityPayload['validFrom'];
    this._validTo = securityPayload['validTo'];
    this._protocol = securityPayload['protocol'];
  }

  subjectName(): string {
    return this._subjectName;
  }

  issuer(): string {
    return this._issuer;
  }

  validFrom(): number {
    return this._validFrom;
  }

  validTo(): number {
    return this._validTo;
  }

  protocol(): string {
    return this._protocol;
  }
}
