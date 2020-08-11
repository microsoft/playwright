/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {NetUtil} = ChromeUtils.import('resource://gre/modules/NetUtil.jsm');
const dragService = Cc["@mozilla.org/widget/dragservice;1"].getService(
  Ci.nsIDragService
);
const obs = Cc["@mozilla.org/observer-service;1"].getService(
  Ci.nsIObserverService
);

const helper = new Helper();

class WorkerData {
  constructor(pageAgent, browserChannel, sessionId, worker) {
    this._workerRuntime = worker.channel().connect(sessionId + 'runtime');
    this._browserWorker = browserChannel.connect(sessionId + worker.id());
    this._worker = worker;
    this._sessionId = sessionId;
    const emit = name => {
      return (...args) => this._browserWorker.emit(name, ...args);
    };
    this._eventListeners = [
      worker.channel().register(sessionId + 'runtime', {
        runtimeConsole: emit('runtimeConsole'),
        runtimeExecutionContextCreated: emit('runtimeExecutionContextCreated'),
        runtimeExecutionContextDestroyed: emit('runtimeExecutionContextDestroyed'),
      }),
      browserChannel.register(sessionId + worker.id(), {
        evaluate: (options) => this._workerRuntime.send('evaluate', options),
        callFunction: (options) => this._workerRuntime.send('callFunction', options),
        getObjectProperties: (options) => this._workerRuntime.send('getObjectProperties', options),
        disposeObject: (options) =>this._workerRuntime.send('disposeObject', options),
      }),
    ];
    worker.channel().connect('').emit('attach', {sessionId});
  }

  dispose() {
    this._worker.channel().connect('').emit('detach', {sessionId: this._sessionId});
    this._workerRuntime.dispose();
    this._browserWorker.dispose();
    helper.removeListeners(this._eventListeners);
  }
}

class FrameData {
  constructor(agent, runtime, frame) {
    this._agent = agent;
    this._runtime = runtime;
    this._frame = frame;
    this._isolatedWorlds = new Map();
    this._initialNavigationDone = false;
    this.reset();
  }

  reset() {
    for (const world of this._isolatedWorlds.values())
      this._runtime.destroyExecutionContext(world);
    this._isolatedWorlds.clear();

    for (const {script, worldName} of this._agent._isolatedWorlds.values()) {
      const context = worldName ? this.createIsolatedWorld(worldName) : this._frame.executionContext();
      try {
        let result = context.evaluateScript(script);
        if (result && result.objectId)
          context.disposeObject(result.objectId);
      } catch (e) {
      }
    }
  }

  createIsolatedWorld(name) {
    const principal = [this._frame.domWindow()]; // extended principal
    const sandbox = Cu.Sandbox(principal, {
      sandboxPrototype: this._frame.domWindow(),
      wantComponents: false,
      wantExportHelpers: false,
      wantXrays: true,
    });
    const world = this._runtime.createExecutionContext(this._frame.domWindow(), sandbox, {
      frameId: this._frame.id(),
      name,
    });
    this._isolatedWorlds.set(world.id(), world);
    return world;
  }

  unsafeObject(objectId) {
    const contexts = [this._frame.executionContext(), ...this._isolatedWorlds.values()];
    for (const context of contexts) {
      const result = context.unsafeObject(objectId);
      if (result)
        return result.object;
    }
    throw new Error('Cannot find object with id = ' + objectId);
  }

  dispose() {
    for (const world of this._isolatedWorlds.values())
      this._runtime.destroyExecutionContext(world);
    this._isolatedWorlds.clear();
  }
}

class PageAgent {
  constructor(messageManager, browserChannel, sessionId, frameTree, networkMonitor) {
    this._messageManager = messageManager;
    this._browserChannel = browserChannel;
    this._sessionId = sessionId;
    this._browserPage = browserChannel.connect(sessionId + 'page');
    this._browserRuntime = browserChannel.connect(sessionId + 'runtime');
    this._frameTree = frameTree;
    this._runtime = frameTree.runtime();
    this._networkMonitor = networkMonitor;

    this._frameData = new Map();
    this._workerData = new Map();
    this._scriptsToEvaluateOnNewDocument = new Map();
    this._isolatedWorlds = new Map();

    this._eventListeners = [
      browserChannel.register(sessionId + 'page', {
        addBinding: ({ name, script }) => this._frameTree.addBinding(name, script),
        addScriptToEvaluateOnNewDocument: this._addScriptToEvaluateOnNewDocument.bind(this),
        adoptNode: this._adoptNode.bind(this),
        crash: this._crash.bind(this),
        describeNode: this._describeNode.bind(this),
        dispatchKeyEvent: this._dispatchKeyEvent.bind(this),
        dispatchMouseEvent: this._dispatchMouseEvent.bind(this),
        dispatchTouchEvent: this._dispatchTouchEvent.bind(this),
        getBoundingBox: this._getBoundingBox.bind(this),
        getContentQuads: this._getContentQuads.bind(this),
        getFullAXTree: this._getFullAXTree.bind(this),
        goBack: this._goBack.bind(this),
        goForward: this._goForward.bind(this),
        insertText: this._insertText.bind(this),
        navigate: this._navigate.bind(this),
        reload: this._reload.bind(this),
        removeScriptToEvaluateOnNewDocument: this._removeScriptToEvaluateOnNewDocument.bind(this),
        requestDetails: this._requestDetails.bind(this),
        screenshot: this._screenshot.bind(this),
        scrollIntoViewIfNeeded: this._scrollIntoViewIfNeeded.bind(this),
        setCacheDisabled: this._setCacheDisabled.bind(this),
        setEmulatedMedia: this._setEmulatedMedia.bind(this),
        setFileInputFiles: this._setFileInputFiles.bind(this),
        setInterceptFileChooserDialog: this._setInterceptFileChooserDialog.bind(this),
      }),
      browserChannel.register(sessionId + 'runtime', {
        evaluate: this._runtime.evaluate.bind(this._runtime),
        callFunction: this._runtime.callFunction.bind(this._runtime),
        getObjectProperties: this._runtime.getObjectProperties.bind(this._runtime),
        disposeObject: this._runtime.disposeObject.bind(this._runtime),
      }),
    ];
    this._enabled = false;

    const docShell = frameTree.mainFrame().docShell();
    this._docShell = docShell;
    this._initialDPPX = docShell.contentViewer.overrideDPPX;
    this._customScrollbars = null;
    this._dataTransfer = null;
  }

  _requestDetails({channelId}) {
    return this._networkMonitor.requestDetails(channelId);
  }

  async _setEmulatedMedia({type, colorScheme}) {
    const docShell = this._frameTree.mainFrame().docShell();
    const cv = docShell.contentViewer;
    if (type === '')
      cv.stopEmulatingMedium();
    else if (type)
      cv.emulateMedium(type);
    this._frameTree.setColorScheme(colorScheme);
  }

  _addScriptToEvaluateOnNewDocument({script, worldName}) {
    if (worldName)
      return this._createIsolatedWorld({script, worldName});
    return {scriptId: this._frameTree.addScriptToEvaluateOnNewDocument(script)};
  }

  _createIsolatedWorld({script, worldName}) {
    const scriptId = helper.generateId();
    this._isolatedWorlds.set(scriptId, {script, worldName});
    for (const frameData of this._frameData.values())
      frameData.createIsolatedWorld(worldName);
    return {scriptId};
  }

  _removeScriptToEvaluateOnNewDocument({scriptId}) {
    if (this._isolatedWorlds.has(scriptId))
      this._isolatedWorlds.delete(scriptId);
    else
      this._frameTree.removeScriptToEvaluateOnNewDocument(scriptId);
  }

  _setCacheDisabled({cacheDisabled}) {
    const enable = Ci.nsIRequest.LOAD_NORMAL;
    const disable = Ci.nsIRequest.LOAD_BYPASS_CACHE |
                  Ci.nsIRequest.INHIBIT_CACHING;

    const docShell = this._frameTree.mainFrame().docShell();
    docShell.defaultLoadFlags = cacheDisabled ? disable : enable;
  }

  enable() {
    if (this._enabled)
      return;

    this._enabled = true;
    // Dispatch frameAttached events for all initial frames
    for (const frame of this._frameTree.frames()) {
      this._onFrameAttached(frame);
      if (frame.url())
        this._onNavigationCommitted(frame);
      if (frame.pendingNavigationId())
        this._onNavigationStarted(frame);
    }

    for (const worker of this._frameTree.workers())
      this._onWorkerCreated(worker);

    this._eventListeners.push(...[
      helper.addObserver(this._linkClicked.bind(this, false), 'juggler-link-click'),
      helper.addObserver(this._linkClicked.bind(this, true), 'juggler-link-click-sync'),
      helper.addObserver(this._onWindowOpenInNewContext.bind(this), 'juggler-window-open-in-new-context'),
      helper.addObserver(this._filePickerShown.bind(this), 'juggler-file-picker-shown'),
      helper.addEventListener(this._messageManager, 'DOMContentLoaded', this._onDOMContentLoaded.bind(this)),
      helper.addEventListener(this._messageManager, 'pageshow', this._onLoad.bind(this)),
      helper.addObserver(this._onDocumentOpenLoad.bind(this), 'juggler-document-open-loaded'),
      helper.addEventListener(this._messageManager, 'error', this._onError.bind(this)),
      helper.on(this._frameTree, 'bindingcalled', this._onBindingCalled.bind(this)),
      helper.on(this._frameTree, 'frameattached', this._onFrameAttached.bind(this)),
      helper.on(this._frameTree, 'framedetached', this._onFrameDetached.bind(this)),
      helper.on(this._frameTree, 'globalobjectcreated', this._onGlobalObjectCreated.bind(this)),
      helper.on(this._frameTree, 'navigationstarted', this._onNavigationStarted.bind(this)),
      helper.on(this._frameTree, 'navigationcommitted', this._onNavigationCommitted.bind(this)),
      helper.on(this._frameTree, 'navigationaborted', this._onNavigationAborted.bind(this)),
      helper.on(this._frameTree, 'samedocumentnavigation', this._onSameDocumentNavigation.bind(this)),
      helper.on(this._frameTree, 'pageready', () => this._browserPage.emit('pageReady', {})),
      helper.on(this._frameTree, 'workercreated', this._onWorkerCreated.bind(this)),
      helper.on(this._frameTree, 'workerdestroyed', this._onWorkerDestroyed.bind(this)),
      helper.addObserver(this._onWindowOpen.bind(this), 'webNavigation-createdNavigationTarget-from-js'),
      this._runtime.events.onErrorFromWorker((domWindow, message, stack) => {
        const frame = this._frameTree.frameForDocShell(domWindow.docShell);
        if (!frame)
          return;
        this._browserPage.emit('pageUncaughtError', {
          frameId: frame.id(),
          message,
          stack,
        });
      }),
      this._runtime.events.onConsoleMessage(msg => this._browserRuntime.emit('runtimeConsole', msg)),
      this._runtime.events.onExecutionContextCreated(this._onExecutionContextCreated.bind(this)),
      this._runtime.events.onExecutionContextDestroyed(this._onExecutionContextDestroyed.bind(this)),
    ]);
    for (const context of this._runtime.executionContexts())
      this._onExecutionContextCreated(context);

    if (this._frameTree.isPageReady()) {
      this._browserPage.emit('pageReady', {});
      const mainFrame = this._frameTree.mainFrame();
      const domWindow = mainFrame.domWindow();
      const document = domWindow ? domWindow.document : null;
      const readyState = document ? document.readyState : null;
      // Sometimes we initialize later than the first about:blank page is opened.
      // In this case, the page might've been loaded already, and we need to issue
      // the `DOMContentLoaded` and `load` events.
      if (mainFrame.url() === 'about:blank' && readyState === 'complete')
        this._emitAllEvents(this._frameTree.mainFrame());
    }
  }

  _emitAllEvents(frame) {
    this._browserPage.emit('pageEventFired', {
      frameId: frame.id(),
      name: 'DOMContentLoaded',
    });
    this._browserPage.emit('pageEventFired', {
      frameId: frame.id(),
      name: 'load',
    });
  }

  _onExecutionContextCreated(executionContext) {
    this._browserRuntime.emit('runtimeExecutionContextCreated', {
      executionContextId: executionContext.id(),
      auxData: executionContext.auxData(),
    });
  }

  _onExecutionContextDestroyed(executionContext) {
    this._browserRuntime.emit('runtimeExecutionContextDestroyed', {
      executionContextId: executionContext.id(),
    });
  }

  _onWorkerCreated(worker) {
    const workerData = new WorkerData(this, this._browserChannel, this._sessionId, worker);
    this._workerData.set(worker.id(), workerData);
    this._browserPage.emit('pageWorkerCreated', {
      workerId: worker.id(),
      frameId: worker.frame().id(),
      url: worker.url(),
    });
  }

  _onWorkerDestroyed(worker) {
    const workerData = this._workerData.get(worker.id());
    if (!workerData)
      return;
    this._workerData.delete(worker.id());
    workerData.dispose();
    this._browserPage.emit('pageWorkerDestroyed', {
      workerId: worker.id(),
    });
  }

  _onWindowOpen(subject) {
    if (!(subject instanceof Ci.nsIPropertyBag2))
      return;
    const props = subject.QueryInterface(Ci.nsIPropertyBag2);
    const hasUrl = props.hasKey('url');
    const createdDocShell = props.getPropertyAsInterface('createdTabDocShell', Ci.nsIDocShell);
    if (!hasUrl && createdDocShell === this._docShell && this._frameTree.forcePageReady())
      this._emitAllEvents(this._frameTree.mainFrame());
  }

  _setInterceptFileChooserDialog({enabled}) {
    this._docShell.fileInputInterceptionEnabled = !!enabled;
  }

  _linkClicked(sync, anchorElement) {
    if (anchorElement.ownerGlobal.docShell !== this._docShell)
      return;
    this._browserPage.emit('pageLinkClicked', { phase: sync ? 'after' : 'before' });
  }

  _onWindowOpenInNewContext(docShell) {
    // TODO: unify this with _onWindowOpen if possible.
    const frame = this._frameTree.frameForDocShell(docShell);
    if (!frame)
      return;
    this._browserPage.emit('pageWillOpenNewWindowAsynchronously');
  }

  _filePickerShown(inputElement) {
    if (inputElement.ownerGlobal.docShell !== this._docShell)
      return;
    const frameData = this._findFrameForNode(inputElement);
    this._browserPage.emit('pageFileChooserOpened', {
      executionContextId: frameData._frame.executionContext().id(),
      element: frameData._frame.executionContext().rawValueToRemoteObject(inputElement)
    });
  }

  _findFrameForNode(node) {
    return Array.from(this._frameData.values()).find(data => {
      const doc = data._frame.domWindow().document;
      return node === doc || node.ownerDocument === doc;
    });
  }

  _onDOMContentLoaded(event) {
    if (!event.target.ownerGlobal)
      return;
    const docShell = event.target.ownerGlobal.docShell;
    const frame = this._frameTree.frameForDocShell(docShell);
    if (!frame)
      return;
    this._browserPage.emit('pageEventFired', {
      frameId: frame.id(),
      name: 'DOMContentLoaded',
    });
  }

  _onError(errorEvent) {
    const docShell = errorEvent.target.ownerGlobal.docShell;
    const frame = this._frameTree.frameForDocShell(docShell);
    if (!frame)
      return;
    this._browserPage.emit('pageUncaughtError', {
      frameId: frame.id(),
      message: errorEvent.message,
      stack: errorEvent.error ? errorEvent.error.stack : '',
    });
  }

  _onDocumentOpenLoad(document) {
    const docShell = document.ownerGlobal.docShell;
    const frame = this._frameTree.frameForDocShell(docShell);
    if (!frame)
      return;
    this._browserPage.emit('pageEventFired', {
      frameId: frame.id(),
      name: 'load'
    });
  }

  _onLoad(event) {
    const docShell = event.target.ownerGlobal.docShell;
    const frame = this._frameTree.frameForDocShell(docShell);
    if (!frame)
      return;
    this._browserPage.emit('pageEventFired', {
      frameId: frame.id(),
      name: 'load'
    });
  }

  _onNavigationStarted(frame) {
    this._browserPage.emit('pageNavigationStarted', {
      frameId: frame.id(),
      navigationId: frame.pendingNavigationId(),
      url: frame.pendingNavigationURL(),
    });
  }

  _onNavigationAborted(frame, navigationId, errorText) {
    this._browserPage.emit('pageNavigationAborted', {
      frameId: frame.id(),
      navigationId,
      errorText,
    });
    const frameData = this._frameData.get(frame);
    if (!frameData._initialNavigationDone && frame !== this._frameTree.mainFrame())
      this._emitAllEvents(frame);
    frameData._initialNavigationDone = true;
  }

  _onSameDocumentNavigation(frame) {
    this._browserPage.emit('pageSameDocumentNavigation', {
      frameId: frame.id(),
      url: frame.url(),
    });
  }

  _onNavigationCommitted(frame) {
    this._browserPage.emit('pageNavigationCommitted', {
      frameId: frame.id(),
      navigationId: frame.lastCommittedNavigationId() || undefined,
      url: frame.url(),
      name: frame.name(),
    });
    this._frameData.get(frame)._initialNavigationDone = true;
  }

  _onGlobalObjectCreated({ frame }) {
    this._frameData.get(frame).reset();
  }

  _onFrameAttached(frame) {
    this._browserPage.emit('pageFrameAttached', {
      frameId: frame.id(),
      parentFrameId: frame.parentFrame() ? frame.parentFrame().id() : undefined,
    });
    this._frameData.set(frame, new FrameData(this, this._runtime, frame));
  }

  _onFrameDetached(frame) {
    this._frameData.delete(frame);
    this._browserPage.emit('pageFrameDetached', {
      frameId: frame.id(),
    });
  }

  _onBindingCalled({frame, name, payload}) {
    this._browserPage.emit('pageBindingCalled', {
      executionContextId: frame.executionContext().id(),
      name,
      payload
    });
  }

  dispose() {
    for (const workerData of this._workerData.values())
      workerData.dispose();
    this._workerData.clear();
    for (const frameData of this._frameData.values())
      frameData.dispose();
    this._frameData.clear();
    helper.removeListeners(this._eventListeners);
  }

  async _navigate({frameId, url, referer}) {
    try {
      const uri = NetUtil.newURI(url);
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
        referrerInfo = new ReferrerInfo(Ci.nsIHttpChannel.REFERRER_POLICY_UNSET, true, referrerURI);
      } catch (e) {
        throw new Error(`Invalid referer: "${referer}"`);
      }
    }
    const frame = this._frameTree.frame(frameId);
    const docShell = frame.docShell().QueryInterface(Ci.nsIWebNavigation);
    docShell.loadURI(url, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      flags: Ci.nsIWebNavigation.LOAD_FLAGS_NONE,
      referrerInfo,
      postData: null,
      headers: null,
    });
    return {navigationId: frame.pendingNavigationId(), navigationURL: frame.pendingNavigationURL()};
  }

  async _reload({frameId, url}) {
    const frame = this._frameTree.frame(frameId);
    const docShell = frame.docShell().QueryInterface(Ci.nsIWebNavigation);
    docShell.reload(Ci.nsIWebNavigation.LOAD_FLAGS_NONE);
  }

  async _goBack({frameId, url}) {
    const frame = this._frameTree.frame(frameId);
    const docShell = frame.docShell();
    if (!docShell.canGoBack)
      return {success: false};
    docShell.goBack();
    return {success: true};
  }

  async _goForward({frameId, url}) {
    const frame = this._frameTree.frame(frameId);
    const docShell = frame.docShell();
    if (!docShell.canGoForward)
      return {success: false};
    docShell.goForward();
    return {success: true};
  }

  async _adoptNode({frameId, objectId, executionContextId}) {
    const frame = this._frameTree.frame(frameId);
    if (!frame)
      throw new Error('Failed to find frame with id = ' + frameId);
    const unsafeObject = this._frameData.get(frame).unsafeObject(objectId);
    const context = this._runtime.findExecutionContext(executionContextId);
    const fromPrincipal = unsafeObject.nodePrincipal;
    const toFrame = this._frameTree.frame(context.auxData().frameId);
    const toPrincipal = toFrame.domWindow().document.nodePrincipal;
    if (!toPrincipal.subsumes(fromPrincipal))
      return { remoteObject: null };
    return { remoteObject: context.rawValueToRemoteObject(unsafeObject) };
  }

  async _setFileInputFiles({objectId, frameId, files}) {
    const frame = this._frameTree.frame(frameId);
    if (!frame)
      throw new Error('Failed to find frame with id = ' + frameId);
    const unsafeObject = this._frameData.get(frame).unsafeObject(objectId);
    if (!unsafeObject)
      throw new Error('Object is not input!');
    const nsFiles = await Promise.all(files.map(filePath => File.createFromFileName(filePath)));
    unsafeObject.mozSetFileArray(nsFiles);
  }

  _getContentQuads({objectId, frameId}) {
    const frame = this._frameTree.frame(frameId);
    if (!frame)
      throw new Error('Failed to find frame with id = ' + frameId);
    const unsafeObject = this._frameData.get(frame).unsafeObject(objectId);
    if (!unsafeObject.getBoxQuads)
      throw new Error('RemoteObject is not a node');
    const quads = unsafeObject.getBoxQuads({relativeTo: this._frameTree.mainFrame().domWindow().document}).map(quad => {
      return {
        p1: {x: quad.p1.x, y: quad.p1.y},
        p2: {x: quad.p2.x, y: quad.p2.y},
        p3: {x: quad.p3.x, y: quad.p3.y},
        p4: {x: quad.p4.x, y: quad.p4.y},
      };
    });
    return {quads};
  }

  _describeNode({objectId, frameId}) {
    const frame = this._frameTree.frame(frameId);
    if (!frame)
      throw new Error('Failed to find frame with id = ' + frameId);
    const unsafeObject = this._frameData.get(frame).unsafeObject(objectId);
    const browsingContextGroup = frame.docShell().browsingContext.group;
    const frames = this._frameTree.allFramesInBrowsingContextGroup(browsingContextGroup);
    let contentFrame;
    let ownerFrame;
    for (const frame of frames) {
      if (unsafeObject.contentWindow && frame.docShell() === unsafeObject.contentWindow.docShell)
        contentFrame = frame;
      const document = frame.domWindow().document;
      if (unsafeObject === document || unsafeObject.ownerDocument === document)
        ownerFrame = frame;
    }
    return {
      contentFrameId: contentFrame ? contentFrame.id() : undefined,
      ownerFrameId: ownerFrame ? ownerFrame.id() : undefined,
    };
  }

  async _scrollIntoViewIfNeeded({objectId, frameId, rect}) {
    const frame = this._frameTree.frame(frameId);
    if (!frame)
      throw new Error('Failed to find frame with id = ' + frameId);
    const unsafeObject = this._frameData.get(frame).unsafeObject(objectId);
    if (!unsafeObject.isConnected)
      throw new Error('Node is detached from document');
    if (!rect)
      rect = { x: -1, y: -1, width: -1, height: -1};
    if (unsafeObject.scrollRectIntoViewIfNeeded)
      unsafeObject.scrollRectIntoViewIfNeeded(rect.x, rect.y, rect.width, rect.height);
    else
      throw new Error('Node does not have a layout object');
  }

  _getNodeBoundingBox(unsafeObject) {
    if (!unsafeObject.getBoxQuads)
      throw new Error('RemoteObject is not a node');
    const quads = unsafeObject.getBoxQuads({relativeTo: this._frameTree.mainFrame().domWindow().document});
    if (!quads.length)
      return;
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const quad of quads) {
      const boundingBox = quad.getBounds();
      x1 = Math.min(boundingBox.x, x1);
      y1 = Math.min(boundingBox.y, y1);
      x2 = Math.max(boundingBox.x + boundingBox.width, x2);
      y2 = Math.max(boundingBox.y + boundingBox.height, y2);
    }
    return {x: x1, y: y1, width: x2 - x1, height: y2 - y1};
  }

  async _getBoundingBox({frameId, objectId}) {
    const frame = this._frameTree.frame(frameId);
    if (!frame)
      throw new Error('Failed to find frame with id = ' + frameId);
    const unsafeObject = this._frameData.get(frame).unsafeObject(objectId);
    const box = this._getNodeBoundingBox(unsafeObject);
    if (!box)
      return {boundingBox: null};
    return {boundingBox: {x: box.x + frame.domWindow().scrollX, y: box.y + frame.domWindow().scrollY, width: box.width, height: box.height}};
  }

  async _screenshot({mimeType, fullPage, clip}) {
    const content = this._messageManager.content;
    if (clip) {
      const data = takeScreenshot(content, clip.x, clip.y, clip.width, clip.height, mimeType);
      return {data};
    }
    if (fullPage) {
      const rect = content.document.documentElement.getBoundingClientRect();
      const width = content.innerWidth + content.scrollMaxX - content.scrollMinX;
      const height = content.innerHeight + content.scrollMaxY - content.scrollMinY;
      const data = takeScreenshot(content, 0, 0, width, height, mimeType);
      return {data};
    }
    const data = takeScreenshot(content, content.scrollX, content.scrollY, content.innerWidth, content.innerHeight, mimeType);
    return {data};
  }

  async _dispatchKeyEvent({type, keyCode, code, key, repeat, location, text}) {
    // key events don't fire if we are dragging.
    if (this._dataTransfer) {
      if (type === 'keydown' && key === 'Escape')
        this._cancelDragIfNeeded();
      return;
    }
    const frame = this._frameTree.mainFrame();
    const tip = frame.textInputProcessor();
    if (key === 'Meta' && Services.appinfo.OS !== 'Darwin')
      key = 'OS';
    else if (key === 'OS' && Services.appinfo.OS === 'Darwin')
      key = 'Meta';
    let keyEvent = new (frame.domWindow().KeyboardEvent)("", {
      key,
      code,
      location,
      repeat,
      keyCode
    });
    if (type === 'keydown') {
      if (text && text !== key) {
        tip.commitCompositionWith(text, keyEvent);
      } else {
        const flags = 0;
        tip.keydown(keyEvent, flags);
      }
    } else if (type === 'keyup') {
      if (text)
        throw new Error(`keyup does not support text option`);
      const flags = 0;
      tip.keyup(keyEvent, flags);
    } else {
      throw new Error(`Unknown type ${type}`);
    }
  }

  async _dispatchTouchEvent({type, touchPoints, modifiers}) {
    const frame = this._frameTree.mainFrame();
    const defaultPrevented = frame.domWindow().windowUtils.sendTouchEvent(
      type.toLowerCase(),
      touchPoints.map((point, id) => id),
      touchPoints.map(point => point.x),
      touchPoints.map(point => point.y),
      touchPoints.map(point => point.radiusX === undefined ? 1.0 : point.radiusX),
      touchPoints.map(point => point.radiusY === undefined ? 1.0 : point.radiusY),
      touchPoints.map(point => point.rotationAngle === undefined ? 0.0 : point.rotationAngle),
      touchPoints.map(point => point.force === undefined ? 1.0 : point.force),
      touchPoints.length,
      modifiers);
    return {defaultPrevented};
  }

  _startDragSessionIfNeeded() {
    const sess = dragService.getCurrentSession();
    if (sess) return;
    dragService.startDragSessionForTests(
      Ci.nsIDragService.DRAGDROP_ACTION_MOVE |
        Ci.nsIDragService.DRAGDROP_ACTION_COPY |
        Ci.nsIDragService.DRAGDROP_ACTION_LINK
    );
  }

  _simulateDragEvent(type, x, y, modifiers) {
    const window = this._frameTree.mainFrame().domWindow();
    const element = window.windowUtils.elementFromPoint(x, y, false, false);
    const event = window.document.createEvent('DragEvent');

    event.initDragEvent(
      type,
      true /* bubble */,
      true /* cancelable */,
      window,
      0 /* clickCount */,
      window.mozInnerScreenX + x,
      window.mozInnerScreenY + y,
      x,
      y,
      modifiers & 2 /* ctrlkey */,
      modifiers & 1 /* altKey */,
      modifiers & 4 /* shiftKey */,
      modifiers & 8 /* metaKey */,
      0 /* button */, // firefox always has the button as 0 on drops, regardless of which was pressed
      null /* relatedTarget */,
      this._dataTransfer
    );

    window.windowUtils.dispatchDOMEventViaPresShellForTesting(element, event);
    if (type === 'drop')
      dragService.endDragSession(true);
  }

  _cancelDragIfNeeded() {
    this._dataTransfer = null;
    const sess = dragService.getCurrentSession();
    if (sess)
      dragService.endDragSession(false);
  }

  async _dispatchMouseEvent({type, x, y, button, clickCount, modifiers, buttons}) {
    this._startDragSessionIfNeeded();
    const trapDrag = subject => {
      this._dataTransfer = subject.mozCloneForEvent('drop');
    }

    const frame = this._frameTree.mainFrame();

    obs.addObserver(trapDrag, 'on-datatransfer-available');
    frame.domWindow().windowUtils.sendMouseEvent(
      type,
      x,
      y,
      button,
      clickCount,
      modifiers,
      false /*aIgnoreRootScrollFrame*/,
      undefined /*pressure*/,
      undefined /*inputSource*/,
      undefined /*isDOMEventSynthesized*/,
      undefined /*isWidgetEventSynthesized*/,
      buttons);
    obs.removeObserver(trapDrag, 'on-datatransfer-available');

    if (type === 'mousedown' && button === 2) {
      frame.domWindow().windowUtils.sendMouseEvent(
        'contextmenu',
        x,
        y,
        button,
        clickCount,
        modifiers,
        false /*aIgnoreRootScrollFrame*/,
        undefined /*pressure*/,
        undefined /*inputSource*/,
        undefined /*isDOMEventSynthesized*/,
        undefined /*isWidgetEventSynthesized*/,
        buttons);
    }

    // update drag state
    if (this._dataTransfer) {
      if (type === 'mousemove')
        this._simulateDragEvent('dragover', x, y, modifiers);
      else if (type === 'mouseup') // firefox will do drops when any mouse button is released
        this._simulateDragEvent('drop', x, y, modifiers);
    } else {
      this._cancelDragIfNeeded();
    }
  }

  async _insertText({text}) {
    const frame = this._frameTree.mainFrame();
    frame.textInputProcessor().commitCompositionWith(text);
  }

  async _crash() {
    dump(`Crashing intentionally\n`);
    // This is to intentionally crash the frame.
    // We crash by using js-ctypes and dereferencing
    // a bad pointer. The crash should happen immediately
    // upon loading this frame script.
    const { ctypes } = ChromeUtils.import('resource://gre/modules/ctypes.jsm');
    ChromeUtils.privateNoteIntentionalCrash();
    const zero = new ctypes.intptr_t(8);
    const badptr = ctypes.cast(zero, ctypes.PointerType(ctypes.int32_t));
    badptr.contents;
  }

  async _getFullAXTree({objectId}) {
    let unsafeObject = null;
    if (objectId) {
      unsafeObject = this._frameData.get(this._frameTree.mainFrame()).unsafeObject(objectId);
      if (!unsafeObject)
        throw new Error(`No object found for id "${objectId}"`);
    }

    const service = Cc["@mozilla.org/accessibilityService;1"]
      .getService(Ci.nsIAccessibilityService);
    const document = this._frameTree.mainFrame().domWindow().document;
    const docAcc = service.getAccessibleFor(document);

    while (docAcc.document.isUpdatePendingForJugglerAccessibility)
      await new Promise(x => this._frameTree.mainFrame().domWindow().requestAnimationFrame(x));

    async function waitForQuiet() {
      let state = {};
      docAcc.getState(state, {});
      if ((state.value & Ci.nsIAccessibleStates.STATE_BUSY) == 0)
        return;
      let resolve, reject;
      const promise = new Promise((x, y) => {resolve = x, reject = y});
      let eventObserver = {
        observe(subject, topic) {
          if (topic !== "accessible-event") {
            return;
          }

          // If event type does not match expected type, skip the event.
          let event = subject.QueryInterface(Ci.nsIAccessibleEvent);
          if (event.eventType !== Ci.nsIAccessibleEvent.EVENT_STATE_CHANGE) {
            return;
          }

          // If event's accessible does not match expected accessible,
          // skip the event.
          if (event.accessible !== docAcc) {
            return;
          }

          Services.obs.removeObserver(this, "accessible-event");
          resolve();
        },
      };
      Services.obs.addObserver(eventObserver, "accessible-event");
      return promise;
    }
    function buildNode(accElement) {
      let a = {}, b = {};
      accElement.getState(a, b);
      const tree = {
        role: service.getStringRole(accElement.role),
        name: accElement.name || '',
      };
      if (unsafeObject && unsafeObject === accElement.DOMNode)
        tree.foundObject = true;
      for (const userStringProperty of [
        'value',
        'description'
      ]) {
        tree[userStringProperty] = accElement[userStringProperty] || undefined;
      }

      const states = {};
      for (const name of service.getStringStates(a.value, b.value))
        states[name] = true;
      for (const name of ['selected',
        'focused',
        'pressed',
        'focusable',
        'haspopup',
        'required',
        'invalid',
        'modal',
        'editable',
        'busy',
        'checked',
        'multiselectable']) {
        if (states[name])
          tree[name] = true;
      }

      if (states['multi line'])
        tree['multiline'] = true;
      if (states['editable'] && states['readonly'])
        tree['readonly'] = true;
      if (states['checked'])
        tree['checked'] = true;
      if (states['mixed'])
        tree['checked'] = 'mixed';
      if (states['expanded'])
        tree['expanded'] = true;
      else if (states['collapsed'])
        tree['expanded'] = false;
      if (!states['enabled'])
        tree['disabled'] = true;

      const attributes = {};
      if (accElement.attributes) {
        for (const { key, value } of accElement.attributes.enumerate()) {
          attributes[key] = value;
        }
      }
      for (const numericalProperty of ['level']) {
        if (numericalProperty in attributes)
          tree[numericalProperty] = parseFloat(attributes[numericalProperty]);
      }
      for (const stringProperty of ['tag', 'roledescription', 'valuetext', 'orientation', 'autocomplete', 'keyshortcuts']) {
        if (stringProperty in attributes)
          tree[stringProperty] = attributes[stringProperty];
      }
      const children = [];

      for (let child = accElement.firstChild; child; child = child.nextSibling) {
        children.push(buildNode(child));
      }
      if (children.length)
        tree.children = children;
      return tree;
    }
    await waitForQuiet();
    return {
      tree: buildNode(docAcc)
    };
  }
}

function takeScreenshot(win, left, top, width, height, mimeType) {
  const MAX_SKIA_DIMENSIONS = 32767;

  const scale = win.devicePixelRatio;
  const canvasWidth = width * scale;
  const canvasHeight = height * scale;

  if (canvasWidth > MAX_SKIA_DIMENSIONS || canvasHeight > MAX_SKIA_DIMENSIONS)
    throw new Error('Cannot take screenshot larger than ' + MAX_SKIA_DIMENSIONS);

  const canvas = win.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  let ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.drawWindow(win, left, top, width, height, 'rgb(255,255,255)', ctx.DRAWWINDOW_DRAW_CARET);
  const dataURL = canvas.toDataURL(mimeType);
  return dataURL.substring(dataURL.indexOf(',') + 1);
};

var EXPORTED_SYMBOLS = ['PageAgent'];
this.PageAgent = PageAgent;

