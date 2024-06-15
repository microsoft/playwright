/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Helper, EventWatcher} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {NetUtil} = ChromeUtils.import('resource://gre/modules/NetUtil.jsm');
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

    this._isDragging = false;
    this._lastMousePosition = { x: 0, y: 0 };

    this._reportedFrameIds = new Set();
    this._networkEventsForUnreportedFrameIds = new Map();

    // `Page.ready` protocol event is emitted whenever page has completed initialization, e.g.
    // finished all the transient navigations to the `about:blank`.
    //
    // We'd like to avoid reporting meaningful events before the `Page.ready` since they are likely
    // to be ignored by the protocol clients.
    this._isPageReady = false;

    if (this._pageTarget.videoRecordingInfo())
      this._onVideoRecordingStarted();

    this._pageEventSink = {};
    helper.decorateAsEventEmitter(this._pageEventSink);

    this._pendingEventWatchers = new Set();
    this._eventListeners = [
      helper.on(this._pageTarget, PageTarget.Events.DialogOpened, this._onDialogOpened.bind(this)),
      helper.on(this._pageTarget, PageTarget.Events.DialogClosed, this._onDialogClosed.bind(this)),
      helper.on(this._pageTarget, PageTarget.Events.Crashed, () => {
        this._session.emitEvent('Page.crashed', {});
      }),
      helper.on(this._pageTarget, PageTarget.Events.ScreencastStarted, this._onVideoRecordingStarted.bind(this)),
      helper.on(this._pageTarget, PageTarget.Events.ScreencastFrame, this._onScreencastFrame.bind(this)),
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
        pageNavigationAborted: emitProtocolEvent('Page.navigationAborted'),
        pageNavigationCommitted: emitProtocolEvent('Page.navigationCommitted'),
        pageNavigationStarted: emitProtocolEvent('Page.navigationStarted'),
        pageReady: this._onPageReady.bind(this),
        pageInputEvent: (event) => this._pageEventSink.emit(event.type, event),
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
    for (const watcher of this._pendingEventWatchers)
      watcher.dispose();
    helper.removeListeners(this._eventListeners);
  }

  _onVideoRecordingStarted() {
    const info = this._pageTarget.videoRecordingInfo();
    this._session.emitEvent('Page.videoRecordingStarted', { screencastId: info.sessionId, file: info.file });
  }

  _onScreencastFrame(params) {
    this._session.emitEvent('Page.screencastFrame', params);
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
    await this._pageTarget.activateAndRun(() => {});
  }

  async ['Page.setCacheDisabled']({cacheDisabled}) {
    return await this._pageTarget.setCacheDisabled(cacheDisabled);
  }

  async ['Page.addBinding']({ worldName, name, script }) {
    return await this._pageTarget.addBinding(worldName, name, script);
  }

  async ['Page.adoptNode'](options) {
    return await this._contentPage.send('adoptNode', options);
  }

  async ['Page.screenshot']({ mimeType, clip, omitDeviceScaleFactor, quality = 80}) {
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

    if (mimeType === 'image/jpeg') {
      if (quality < 0 || quality > 100)
        throw new Error('Quality must be an integer value between 0 and 100; received ' + quality);
      quality /= 100;
    } else {
      quality = undefined;
    }
    const dataURL = canvas.toDataURL(mimeType, quality);
    return { data: dataURL.substring(dataURL.indexOf(',') + 1) };
  }

  async ['Page.getContentQuads'](options) {
    return await this._contentPage.send('getContentQuads', options);
  }

  async ['Page.navigate']({frameId, url, referer}) {
    const browsingContext = this._pageTarget.frameIdToBrowsingContext(frameId);
    let sameDocumentNavigation = false;
    try {
      const uri = NetUtil.newURI(url);
      // This is the same check that verifes browser-side if this is the same-document navigation.
      // See CanonicalBrowsingContext::SupportsLoadingInParent.
      sameDocumentNavigation = browsingContext.currentURI && uri.hasRef && uri.equalsExceptRef(browsingContext.currentURI);
    } catch (e) {
      throw new Error(`Invalid url: "${url}"`);
    }
    let referrerURI = null;
    let referrerInfo = null;
    if (referer) {
      try {
        referrerURI = NetUtil.newURI(referer);
        const ReferrerInfo = Components.Constructor(
          '@mozilla.org/referrer-info;1',
          'nsIReferrerInfo',
          'init'
        );
        referrerInfo = new ReferrerInfo(Ci.nsIReferrerInfo.UNSAFE_URL, true, referrerURI);
      } catch (e) {
        throw new Error(`Invalid referer: "${referer}"`);
      }
    }

    let navigationId;
    const unsubscribe = helper.addObserver((browsingContext, topic, loadIdentifier) => {
      navigationId = helper.toProtocolNavigationId(loadIdentifier);
    }, 'juggler-navigation-started-browser');
    browsingContext.loadURI(Services.io.newURI(url), {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      loadFlags: Ci.nsIWebNavigation.LOAD_FLAGS_IS_LINK,
      referrerInfo,
      // postData: null,
      // headers: null,
      // Fake user activation.
      hasValidUserGestureActivation: true,
    });
    unsubscribe();

    return {
      navigationId: sameDocumentNavigation ? null : navigationId,
    };
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

  async ['Page.reload']() {
    await this._pageTarget.activateAndRun(() => {
      const doc = this._pageTarget._tab.linkedBrowser.ownerDocument;
      doc.getElementById('Browser:Reload').doCommand();
    });
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

  async ['Page.dispatchKeyEvent']({type, keyCode, code, key, repeat, location, text}) {
    // key events don't fire if we are dragging.
    if (this._isDragging) {
      if (type === 'keydown' && key === 'Escape') {
        await this._contentPage.send('dispatchDragEvent', {
          type: 'dragover',
          x: this._lastMousePosition.x,
          y: this._lastMousePosition.y,
          modifiers: 0
        });
        await this._contentPage.send('dispatchDragEvent', {type: 'dragend'});
        this._isDragging = false;
      }
      return;
    }
    return await this._contentPage.send('dispatchKeyEvent', {type, keyCode, code, key, repeat, location, text});
  }

  async ['Page.dispatchTouchEvent'](options) {
    return await this._contentPage.send('dispatchTouchEvent', options);
  }

  async ['Page.dispatchTapEvent'](options) {
    return await this._contentPage.send('dispatchTapEvent', options);
  }

  async ['Page.dispatchMouseEvent']({type, x, y, button, clickCount, modifiers, buttons}) {
    const win = this._pageTarget._window;
    const sendEvents = async (types) => {
      // 1. Scroll element to the desired location first; the coordinates are relative to the element.
      this._pageTarget._linkedBrowser.scrollRectIntoViewIfNeeded(x, y, 0, 0);
      // 2. Get element's bounding box in the browser after the scroll is completed.
      const boundingBox = this._pageTarget._linkedBrowser.getBoundingClientRect();
      // 3. Make sure compositor is flushed after scrolling.
      if (win.windowUtils.flushApzRepaints())
        await helper.awaitTopic('apz-repaints-flushed');

      const watcher = new EventWatcher(this._pageEventSink, types, this._pendingEventWatchers);
      const promises = [];
      for (const type of types) {
        // This dispatches to the renderer synchronously.
        const jugglerEventId = win.windowUtils.jugglerSendMouseEvent(
          type,
          x + boundingBox.left,
          y + boundingBox.top,
          button,
          clickCount,
          modifiers,
          false /* aIgnoreRootScrollFrame */,
          0.0 /* pressure */,
          0 /* inputSource */,
          true /* isDOMEventSynthesized */,
          false /* isWidgetEventSynthesized */,
          buttons,
          win.windowUtils.DEFAULT_MOUSE_POINTER_ID /* pointerIdentifier */,
          false /* disablePointerEvent */
        );
        promises.push(watcher.ensureEvent(type, eventObject => eventObject.jugglerEventId === jugglerEventId));
      }
      await Promise.all(promises);
      await watcher.dispose();
    };

    // We must switch to proper tab in the tabbed browser so that
    // 1. Event is dispatched to a proper renderer.
    // 2. We receive an ack from the renderer for the dispatched event.
    await this._pageTarget.activateAndRun(async () => {
      this._pageTarget.ensureContextMenuClosed();
      // If someone asks us to dispatch mouse event outside of viewport, then we normally would drop it.
      const boundingBox = this._pageTarget._linkedBrowser.getBoundingClientRect();
      if (x < 0 || y < 0 || x > boundingBox.width || y > boundingBox.height) {
        if (type !== 'mousemove')
          return;

        // A special hack: if someone tries to do `mousemove` outside of
        // viewport coordinates, then move the mouse off from the Web Content.
        // This way we can eliminate all the hover effects.
        // NOTE: since this won't go inside the renderer, there's no need to wait for ACK.
        win.windowUtils.sendMouseEvent(
          'mousemove',
          0 /* x */,
          0 /* y */,
          button,
          clickCount,
          modifiers,
          false /* aIgnoreRootScrollFrame */,
          0.0 /* pressure */,
          0 /* inputSource */,
          true /* isDOMEventSynthesized */,
          false /* isWidgetEventSynthesized */,
          buttons,
          win.windowUtils.DEFAULT_MOUSE_POINTER_ID /* pointerIdentifier */,
          false /* disablePointerEvent */
        );
        return;
      }

      if (type === 'mousedown') {
        if (this._isDragging)
          return;

        const eventNames = button === 2 ? ['mousedown', 'contextmenu'] : ['mousedown'];
        await sendEvents(eventNames);
        return;
      }

      if (type === 'mousemove') {
        this._lastMousePosition = { x, y };
        if (this._isDragging) {
          const watcher = new EventWatcher(this._pageEventSink, ['dragover'], this._pendingEventWatchers);
          await this._contentPage.send('dispatchDragEvent', {type:'dragover', x, y, modifiers});
          await watcher.ensureEventsAndDispose(['dragover']);
          return;
        }

        const watcher = new EventWatcher(this._pageEventSink, ['dragstart', 'juggler-drag-finalized'], this._pendingEventWatchers);
        await sendEvents(['mousemove']);

        // The order of events after 'mousemove' is sent:
        // 1. [dragstart] - might or might NOT be emitted
        // 2. [mousemove] - always emitted. This was awaited as part of `sendEvents` call.
        // 3. [juggler-drag-finalized] - only emitted if dragstart was emitted.

        if (watcher.hasEvent('dragstart')) {
          const eventObject = await watcher.ensureEvent('juggler-drag-finalized');
          this._isDragging = eventObject.dragSessionStarted;
        }
        watcher.dispose();
        return;
      }

      if (type === 'mouseup') {
        if (this._isDragging) {
          const watcher = new EventWatcher(this._pageEventSink, ['dragover'], this._pendingEventWatchers);
          await this._contentPage.send('dispatchDragEvent', {type: 'dragover', x, y, modifiers});
          await this._contentPage.send('dispatchDragEvent', {type: 'drop', x, y, modifiers});
          await this._contentPage.send('dispatchDragEvent', {type: 'dragend', x, y, modifiers});
          // NOTE:
          // - 'drop' event might not be dispatched at all, depending on dropAction.
          // - 'dragend' event might not be dispatched at all, if the source element was removed
          //   during drag. However, it'll be dispatched synchronously in the renderer.
          await watcher.ensureEventsAndDispose(['dragover']);
          this._isDragging = false;
        } else {
          await sendEvents(['mouseup']);
        }
        return;
      }
    }, { muteNotificationsPopup: true });
  }

  async ['Page.dispatchWheelEvent']({x, y, button, deltaX, deltaY, deltaZ, modifiers }) {
    const deltaMode = 0; // WheelEvent.DOM_DELTA_PIXEL
    const lineOrPageDeltaX = deltaX > 0 ? Math.floor(deltaX) : Math.ceil(deltaX);
    const lineOrPageDeltaY = deltaY > 0 ? Math.floor(deltaY) : Math.ceil(deltaY);

    await this._pageTarget.activateAndRun(async () => {
      this._pageTarget.ensureContextMenuClosed();

      // 1. Scroll element to the desired location first; the coordinates are relative to the element.
      this._pageTarget._linkedBrowser.scrollRectIntoViewIfNeeded(x, y, 0, 0);
      // 2. Get element's bounding box in the browser after the scroll is completed.
      const boundingBox = this._pageTarget._linkedBrowser.getBoundingClientRect();

      const win = this._pageTarget._window;
      // 3. Make sure compositor is flushed after scrolling.
      if (win.windowUtils.flushApzRepaints())
        await helper.awaitTopic('apz-repaints-flushed');

      win.windowUtils.sendWheelEvent(
        x + boundingBox.left,
        y + boundingBox.top,
        deltaX,
        deltaY,
        deltaZ,
        deltaMode,
        modifiers,
        lineOrPageDeltaX,
        lineOrPageDeltaY,
        0 /* options */);
    }, { muteNotificationsPopup: true });
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
