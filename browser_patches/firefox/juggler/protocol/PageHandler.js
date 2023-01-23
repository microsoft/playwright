/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const {NetworkObserver, PageNetwork} = ChromeUtils.import('chrome://juggler/content/NetworkObserver.js');
const {PageTarget} = ChromeUtils.import('chrome://juggler/content/TargetRegistry.js');
const {setTimeout} = ChromeUtils.import('resource://gre/modules/Timer.jsm');

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const helper = new Helper();

function hashConsoleMessage(params) {
  return params.location.lineNumber + ':' + params.location.columnNumber + ':' + params.location.url;
}

class WorkerHandler {
  constructor(session, contentChannel, workerId) {
    this._session = session;
    this._contentWorker = contentChannel.connect(workerId);
    this._workerConsoleMessages = new Set();
    this._workerId = workerId;

    const emitWrappedProtocolEvent = eventName => {
      return params => {
        this._session.emitEvent('Page.dispatchMessageFromWorker', {
          workerId,
          message: JSON.stringify({method: eventName, params}),
        });
      }
    }

    this._eventListeners = [
      contentChannel.register(workerId, {
        runtimeConsole: (params) => {
          this._workerConsoleMessages.add(hashConsoleMessage(params));
          emitWrappedProtocolEvent('Runtime.console')(params);
        },
        runtimeExecutionContextCreated: emitWrappedProtocolEvent('Runtime.executionContextCreated'),
        runtimeExecutionContextDestroyed: emitWrappedProtocolEvent('Runtime.executionContextDestroyed'),
      }),
    ];
  }

  async sendMessage(message) {
    const [domain, method] = message.method.split('.');
    if (domain !== 'Runtime')
      throw new Error('ERROR: can only dispatch to Runtime domain inside worker');
    const result = await this._contentWorker.send(method, message.params);
    this._session.emitEvent('Page.dispatchMessageFromWorker', {
      workerId: this._workerId,
      message: JSON.stringify({result, id: message.id}),
    });
  }

  dispose() {
    this._contentWorker.dispose();
    helper.removeListeners(this._eventListeners);
  }
}

class PageHandler {
  constructor(target, session, contentChannel) {
    this._session = session;
    this._contentChannel = contentChannel;
    this._contentPage = contentChannel.connect('page');
    this._workers = new Map();

    this._pageTarget = target;
    this._pageNetwork = PageNetwork.forPageTarget(target);

    const emitProtocolEvent = eventName => {
      return (...args) => this._session.emitEvent(eventName, ...args);
    }

    this._reportedFrameIds = new Set();
    this._networkEventsForUnreportedFrameIds = new Map();

    // `Page.ready` protocol event is emitted whenever page has completed initialization, e.g.
    // finished all the transient navigations to the `about:blank`.
    //
    // We'd like to avoid reporting meaningful events before the `Page.ready` since they are likely
    // to be ignored by the protocol clients.
    this._isPageReady = false;

    // Whether the page is about to go cross-process after navigation.
    this._isTransferringCrossProcessNavigation = false;
    this._mainFrameId = undefined;
    this._lastMainFrameNavigationId = undefined;

    if (this._pageTarget.videoRecordingInfo())
      this._onVideoRecordingStarted();

    this._eventListeners = [
      helper.on(this._pageTarget, PageTarget.Events.DialogOpened, this._onDialogOpened.bind(this)),
      helper.on(this._pageTarget, PageTarget.Events.DialogClosed, this._onDialogClosed.bind(this)),
      helper.on(this._pageTarget, PageTarget.Events.Crashed, () => {
        this._session.emitEvent('Page.crashed', {});
      }),
      helper.on(this._pageTarget, PageTarget.Events.ScreencastStarted, this._onVideoRecordingStarted.bind(this)),
      helper.on(this._pageTarget, PageTarget.Events.ScreencastFrame, this._onScreencastFrame.bind(this)),
      helper.on(this._pageTarget, PageTarget.Events.TopBrowsingContextReplaced, this._onTopBrowsingContextReplaced.bind(this)),
      helper.on(this._pageNetwork, PageNetwork.Events.Request, this._handleNetworkEvent.bind(this, 'Network.requestWillBeSent')),
      helper.on(this._pageNetwork, PageNetwork.Events.Response, this._handleNetworkEvent.bind(this, 'Network.responseReceived')),
      helper.on(this._pageNetwork, PageNetwork.Events.RequestFinished, this._handleNetworkEvent.bind(this, 'Network.requestFinished')),
      helper.on(this._pageNetwork, PageNetwork.Events.RequestFailed, this._handleNetworkEvent.bind(this, 'Network.requestFailed')),
      contentChannel.register('page', {
        pageBindingCalled: emitProtocolEvent('Page.bindingCalled'),
        pageDispatchMessageFromWorker: emitProtocolEvent('Page.dispatchMessageFromWorker'),
        pageEventFired: emitProtocolEvent('Page.eventFired'),
        pageFileChooserOpened: emitProtocolEvent('Page.fileChooserOpened'),
        pageFrameAttached: this._onFrameAttached.bind(this),
        pageFrameDetached: emitProtocolEvent('Page.frameDetached'),
        pageLinkClicked: emitProtocolEvent('Page.linkClicked'),
        pageWillOpenNewWindowAsynchronously: emitProtocolEvent('Page.willOpenNewWindowAsynchronously'),
        pageNavigationAborted: params => this._handleNavigationEvent('Page.navigationAborted', params),
        pageNavigationCommitted: params => this._handleNavigationEvent('Page.navigationCommitted', params),
        pageNavigationStarted: params => this._handleNavigationEvent('Page.navigationStarted', params),
        pageReady: this._onPageReady.bind(this),
        pageSameDocumentNavigation: emitProtocolEvent('Page.sameDocumentNavigation'),
        pageUncaughtError: emitProtocolEvent('Page.uncaughtError'),
        pageWorkerCreated: this._onWorkerCreated.bind(this),
        pageWorkerDestroyed: this._onWorkerDestroyed.bind(this),
        runtimeConsole: params => {
          const consoleMessageHash = hashConsoleMessage(params);
          for (const worker of this._workers.values()) {
            if (worker._workerConsoleMessages.has(consoleMessageHash)) {
              worker._workerConsoleMessages.delete(consoleMessageHash);
              return;
            }
          }
          this._session.emitEvent('Runtime.console', params);
        },
        runtimeExecutionContextCreated: emitProtocolEvent('Runtime.executionContextCreated'),
        runtimeExecutionContextDestroyed: emitProtocolEvent('Runtime.executionContextDestroyed'),
        runtimeExecutionContextsCleared: emitProtocolEvent('Runtime.executionContextsCleared'),

        webSocketCreated: emitProtocolEvent('Page.webSocketCreated'),
        webSocketOpened: emitProtocolEvent('Page.webSocketOpened'),
        webSocketClosed: emitProtocolEvent('Page.webSocketClosed'),
        webSocketFrameReceived: emitProtocolEvent('Page.webSocketFrameReceived'),
        webSocketFrameSent: emitProtocolEvent('Page.webSocketFrameSent'),
      }),
    ];
  }

  async dispose() {
    this._contentPage.dispose();
    helper.removeListeners(this._eventListeners);
  }

  _onVideoRecordingStarted() {
    const info = this._pageTarget.videoRecordingInfo();
    this._session.emitEvent('Page.videoRecordingStarted', { screencastId: info.sessionId, file: info.file });
  }

  _onScreencastFrame(params) {
    this._session.emitEvent('Page.screencastFrame', params);
  }

  _onTopBrowsingContextReplaced() {
    this._isTransferringCrossProcessNavigation = true;
  }

  _handleNavigationEvent(event, params) {
    if (this._isTransferringCrossProcessNavigation && params.frameId === this._mainFrameId) {
      // During a cross-process navigation, http channel in the new process might not be
      // the same as the original one in the old process, for example after a redirect/interception.
      // Therefore, the new proces has a new navigationId.
      //
      // To preserve protocol consistency, we replace the new navigationId with
      // the old navigationId.
      params.navigationId = this._lastMainFrameNavigationId || params.navigationId;
      if (event === 'Page.navigationCommitted' || event === 'Page.navigationAborted')
        this._isTransferringCrossProcessNavigation = false;
    }

    if (event === 'Page.navigationStarted' && params.frameId === this._mainFrameId)
      this._lastMainFrameNavigationId = params.navigationId;
    this._session.emitEvent(event, params);
  }

  _onPageReady(event) {
    this._isPageReady = true;
    this._session.emitEvent('Page.ready');
    for (const dialog of this._pageTarget.dialogs())
      this._onDialogOpened(dialog);
  }

  _onDialogOpened(dialog) {
    if (!this._isPageReady)
      return;
    this._session.emitEvent('Page.dialogOpened', {
      dialogId: dialog.id(),
      type: dialog.type(),
      message: dialog.message(),
      defaultValue: dialog.defaultValue(),
    });
  }

  _onDialogClosed(dialog) {
    if (!this._isPageReady)
      return;
    this._session.emitEvent('Page.dialogClosed', { dialogId: dialog.id(), });
  }

  _onWorkerCreated({workerId, frameId, url}) {
    const worker = new WorkerHandler(this._session, this._contentChannel, workerId);
    this._workers.set(workerId, worker);
    this._session.emitEvent('Page.workerCreated', {workerId, frameId, url});
  }

  _onWorkerDestroyed({workerId}) {
    const worker = this._workers.get(workerId);
    if (!worker)
      return;
    this._workers.delete(workerId);
    worker.dispose();
    this._session.emitEvent('Page.workerDestroyed', {workerId});
  }

  _handleNetworkEvent(protocolEventName, eventDetails, frameId) {
    if (!this._reportedFrameIds.has(frameId)) {
      let events = this._networkEventsForUnreportedFrameIds.get(frameId);
      if (!events) {
        events = [];
        this._networkEventsForUnreportedFrameIds.set(frameId, events);
      }
      events.push({eventName: protocolEventName, eventDetails});
    } else {
      this._session.emitEvent(protocolEventName, eventDetails);
    }
  }

  _onFrameAttached({frameId, parentFrameId}) {
    if (!parentFrameId)
      this._mainFrameId = frameId;
    this._session.emitEvent('Page.frameAttached', {frameId, parentFrameId});
    this._reportedFrameIds.add(frameId);
    const events = this._networkEventsForUnreportedFrameIds.get(frameId) || [];
    this._networkEventsForUnreportedFrameIds.delete(frameId);
    for (const {eventName, eventDetails} of events)
      this._session.emitEvent(eventName, eventDetails);
  }

  async ['Page.close']({runBeforeUnload}) {
    // Postpone target close to deliver response in session.
    Services.tm.dispatchToMainThread(() => {
      this._pageTarget.close(runBeforeUnload);
    });
  }

  async ['Page.setViewportSize']({viewportSize}) {
    await this._pageTarget.setViewportSize(viewportSize === null ? undefined : viewportSize);
  }

  async ['Runtime.evaluate'](options) {
    return await this._contentPage.send('evaluate', options);
  }

  async ['Runtime.callFunction'](options) {
    return await this._contentPage.send('callFunction', options);
  }

  async ['Runtime.getObjectProperties'](options) {
    return await this._contentPage.send('getObjectProperties', options);
  }

  async ['Runtime.disposeObject'](options) {
    return await this._contentPage.send('disposeObject', options);
  }

  async ['Network.getResponseBody']({requestId}) {
    return this._pageNetwork.getResponseBody(requestId);
  }

  async ['Network.setExtraHTTPHeaders']({headers}) {
    this._pageNetwork.setExtraHTTPHeaders(headers);
  }

  async ['Network.setRequestInterception']({enabled}) {
    if (enabled)
      this._pageNetwork.enableRequestInterception();
    else
      this._pageNetwork.disableRequestInterception();
  }

  async ['Network.resumeInterceptedRequest']({requestId, url, method, headers, postData}) {
    this._pageNetwork.resumeInterceptedRequest(requestId, url, method, headers, postData);
  }

  async ['Network.abortInterceptedRequest']({requestId, errorCode}) {
    this._pageNetwork.abortInterceptedRequest(requestId, errorCode);
  }

  async ['Network.fulfillInterceptedRequest']({requestId, status, statusText, headers, base64body}) {
    this._pageNetwork.fulfillInterceptedRequest(requestId, status, statusText, headers, base64body);
  }

  async ['Accessibility.getFullAXTree'](params) {
    return await this._contentPage.send('getFullAXTree', params);
  }

  async ['Page.setFileInputFiles'](options) {
    return await this._contentPage.send('setFileInputFiles', options);
  }

  async ['Page.setEmulatedMedia']({colorScheme, type, reducedMotion, forcedColors}) {
    this._pageTarget.setColorScheme(colorScheme || null);
    this._pageTarget.setReducedMotion(reducedMotion || null);
    this._pageTarget.setForcedColors(forcedColors || null);
    this._pageTarget.setEmulatedMedia(type);
  }

  async ['Page.bringToFront'](options) {
    this._pageTarget._window.focus();
  }

  async ['Page.setCacheDisabled'](options) {
    return await this._contentPage.send('setCacheDisabled', options);
  }

  async ['Page.addBinding']({ worldName, name, script }) {
    return await this._pageTarget.addBinding(worldName, name, script);
  }

  async ['Page.adoptNode'](options) {
    return await this._contentPage.send('adoptNode', options);
  }

  async ['Page.screenshot']({ mimeType, clip, omitDeviceScaleFactor }) {
    const rect = new DOMRect(clip.x, clip.y, clip.width, clip.height);

    const browsingContext = this._pageTarget.linkedBrowser().browsingContext;
    // `win.devicePixelRatio` returns a non-overriden value to priveleged code.
    // See https://bugzilla.mozilla.org/show_bug.cgi?id=1761032
    // See https://phabricator.services.mozilla.com/D141323
    const devicePixelRatio = browsingContext.overrideDPPX || this._pageTarget._window.devicePixelRatio;
    const scale = omitDeviceScaleFactor ? 1 : devicePixelRatio;
    const canvasWidth = rect.width * scale;
    const canvasHeight = rect.height * scale;

    const MAX_CANVAS_DIMENSIONS = 32767;
    const MAX_CANVAS_AREA = 472907776;
    if (canvasWidth > MAX_CANVAS_DIMENSIONS || canvasHeight > MAX_CANVAS_DIMENSIONS)
      throw new Error('Cannot take screenshot larger than ' + MAX_CANVAS_DIMENSIONS);
    if (canvasWidth * canvasHeight > MAX_CANVAS_AREA)
      throw new Error('Cannot take screenshot with more than ' + MAX_CANVAS_AREA + ' pixels');

    let snapshot;
    while (!snapshot) {
      try {
        //TODO(fission): browsingContext will change in case of cross-group navigation.
        snapshot = await browsingContext.currentWindowGlobal.drawSnapshot(
          rect,
          scale,
          "rgb(255,255,255)"
        );
      } catch (e) {
        // The currentWindowGlobal.drawSnapshot might throw
        // NS_ERROR_LOSS_OF_SIGNIFICANT_DATA if called during navigation.
        // wait a little and re-try.
        await new Promise(x => setTimeout(x, 50));
      }
    }

    const win = browsingContext.topChromeWindow.ownerGlobal;
    const canvas = win.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    let ctx = canvas.getContext('2d');
    ctx.drawImage(snapshot, 0, 0);
    snapshot.close();
    const dataURL = canvas.toDataURL(mimeType);
    return { data: dataURL.substring(dataURL.indexOf(',') + 1) };
  }

  async ['Page.getContentQuads'](options) {
    return await this._contentPage.send('getContentQuads', options);
  }

  async ['Page.navigate'](options) {
    return await this._contentPage.send('navigate', options);
  }

  async ['Page.goBack']({}) {
    const browsingContext = this._pageTarget.linkedBrowser().browsingContext;
    if (!browsingContext.embedderElement?.canGoBack)
      return { success: false };
    browsingContext.goBack();
    return { success: true };
  }

  async ['Page.goForward']({}) {
    const browsingContext = this._pageTarget.linkedBrowser().browsingContext;
    if (!browsingContext.embedderElement?.canGoForward)
      return { success: false };
    browsingContext.goForward();
    return { success: true };
  }

  async ['Page.reload']({}) {
    const browsingContext = this._pageTarget.linkedBrowser().browsingContext;
    browsingContext.reload(Ci.nsIWebNavigation.LOAD_FLAGS_NONE);
  }

  async ['Page.describeNode'](options) {
    return await this._contentPage.send('describeNode', options);
  }

  async ['Page.scrollIntoViewIfNeeded'](options) {
    return await this._contentPage.send('scrollIntoViewIfNeeded', options);
  }

  async ['Page.setInitScripts']({ scripts }) {
    return await this._pageTarget.setInitScripts(scripts);
  }

  async ['Page.dispatchKeyEvent'](options) {
    return await this._contentPage.send('dispatchKeyEvent', options);
  }

  async ['Page.dispatchTouchEvent'](options) {
    return await this._contentPage.send('dispatchTouchEvent', options);
  }

  async ['Page.dispatchTapEvent'](options) {
    return await this._contentPage.send('dispatchTapEvent', options);
  }

  async ['Page.dispatchMouseEvent'](options) {
    return await this._contentPage.send('dispatchMouseEvent', options);
  }

  async ['Page.dispatchWheelEvent']({x, y, button, deltaX, deltaY, deltaZ, modifiers }) {
    const boundingBox = this._pageTarget._linkedBrowser.getBoundingClientRect();
    x += boundingBox.left;
    y += boundingBox.top;
    const deltaMode = 0; // WheelEvent.DOM_DELTA_PIXEL
    const lineOrPageDeltaX = deltaX > 0 ? Math.floor(deltaX) : Math.ceil(deltaX);
    const lineOrPageDeltaY = deltaY > 0 ? Math.floor(deltaY) : Math.ceil(deltaY);

    const win = this._pageTarget._window;
    win.windowUtils.sendWheelEvent(
      x,
      y,
      deltaX,
      deltaY,
      deltaZ,
      deltaMode,
      modifiers,
      lineOrPageDeltaX,
      lineOrPageDeltaY,
      0 /* options */);
  }

  async ['Page.insertText'](options) {
    return await this._contentPage.send('insertText', options);
  }

  async ['Page.crash'](options) {
    return await this._contentPage.send('crash', options);
  }

  async ['Page.handleDialog']({dialogId, accept, promptText}) {
    const dialog = this._pageTarget.dialog(dialogId);
    if (!dialog)
      throw new Error('Failed to find dialog with id = ' + dialogId);
    if (accept)
      dialog.accept(promptText);
    else
      dialog.dismiss();
  }

  async ['Page.setInterceptFileChooserDialog']({ enabled }) {
    return await this._pageTarget.setInterceptFileChooserDialog(enabled);
  }

  async ['Page.startScreencast'](options) {
    return await this._pageTarget.startScreencast(options);
  }

  async ['Page.screencastFrameAck'](options) {
    await this._pageTarget.screencastFrameAck(options);
  }

  async ['Page.stopScreencast'](options) {
    await this._pageTarget.stopScreencast(options);
  }

  async ['Page.sendMessageToWorker']({workerId, message}) {
    const worker = this._workers.get(workerId);
    if (!worker)
      throw new Error('ERROR: cannot find worker with id ' + workerId);
    return await worker.sendMessage(JSON.parse(message));
  }
}

var EXPORTED_SYMBOLS = ['PageHandler'];
this.PageHandler = PageHandler;
