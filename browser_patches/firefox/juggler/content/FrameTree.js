/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {SimpleChannel} = ChromeUtils.import('chrome://juggler/content/SimpleChannel.js');
const {EventEmitter} = ChromeUtils.import('resource://gre/modules/EventEmitter.jsm');
const {Runtime} = ChromeUtils.import('chrome://juggler/content/content/Runtime.js');

const helper = new Helper();

class FrameTree {
  constructor(rootDocShell) {
    EventEmitter.decorate(this);

    this._browsingContextGroup = rootDocShell.browsingContext.group;
    if (!this._browsingContextGroup.__jugglerFrameTrees)
      this._browsingContextGroup.__jugglerFrameTrees = new Set();
    this._browsingContextGroup.__jugglerFrameTrees.add(this);
    this._scriptsToEvaluateOnNewDocument = new Map();

    this._bindings = new Map();
    this._runtime = new Runtime(false /* isWorker */);
    this._workers = new Map();
    this._docShellToFrame = new Map();
    this._frameIdToFrame = new Map();
    this._pageReady = false;
    this._mainFrame = this._createFrame(rootDocShell);
    const webProgress = rootDocShell.QueryInterface(Ci.nsIInterfaceRequestor)
                                .getInterface(Ci.nsIWebProgress);
    this.QueryInterface = ChromeUtils.generateQI([
      Ci.nsIWebProgressListener,
      Ci.nsIWebProgressListener2,
      Ci.nsISupportsWeakReference,
    ]);

    this._wdm = Cc["@mozilla.org/dom/workers/workerdebuggermanager;1"].createInstance(Ci.nsIWorkerDebuggerManager);
    this._wdmListener = {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIWorkerDebuggerManagerListener]),
      onRegister: this._onWorkerCreated.bind(this),
      onUnregister: this._onWorkerDestroyed.bind(this),
    };
    this._wdm.addListener(this._wdmListener);
    for (const workerDebugger of this._wdm.getWorkerDebuggerEnumerator())
      this._onWorkerCreated(workerDebugger);

    const flags = Ci.nsIWebProgress.NOTIFY_STATE_DOCUMENT |
                  Ci.nsIWebProgress.NOTIFY_FRAME_LOCATION;
    this._eventListeners = [
      helper.addObserver(this._onDOMWindowCreated.bind(this), 'content-document-global-created'),
      helper.addObserver(this._onDOMWindowCreated.bind(this), 'juggler-dom-window-reused'),
      helper.addObserver(subject => this._onDocShellCreated(subject.QueryInterface(Ci.nsIDocShell)), 'webnavigation-create'),
      helper.addObserver(subject => this._onDocShellDestroyed(subject.QueryInterface(Ci.nsIDocShell)), 'webnavigation-destroy'),
      helper.addProgressListener(webProgress, this, flags),
    ];
  }

  workers() {
    return [...this._workers.values()];
  }

  runtime() {
    return this._runtime;
  }

  _frameForWorker(workerDebugger) {
    if (workerDebugger.type !== Ci.nsIWorkerDebugger.TYPE_DEDICATED)
      return null;
    if (!workerDebugger.window)
      return null;
    const docShell = workerDebugger.window.docShell;
    return this._docShellToFrame.get(docShell) || null;
  }

  _onDOMWindowCreated(window) {
    const frame = this._docShellToFrame.get(window.docShell) || null;
    if (!frame)
      return;
    frame._onGlobalObjectCleared();
    this.emit(FrameTree.Events.GlobalObjectCreated, { frame, window });
  }

  _onWorkerCreated(workerDebugger) {
    // Note: we do not interoperate with firefox devtools.
    if (workerDebugger.isInitialized)
      return;
    const frame = this._frameForWorker(workerDebugger);
    if (!frame)
      return;
    const worker = new Worker(frame, workerDebugger);
    this._workers.set(workerDebugger, worker);
    this.emit(FrameTree.Events.WorkerCreated, worker);
  }

  _onWorkerDestroyed(workerDebugger) {
    const worker = this._workers.get(workerDebugger);
    if (!worker)
      return;
    worker.dispose();
    this._workers.delete(workerDebugger);
    this.emit(FrameTree.Events.WorkerDestroyed, worker);
  }

  allFramesInBrowsingContextGroup(group) {
    const frames = [];
    for (const frameTree of (group.__jugglerFrameTrees || []))
      frames.push(...frameTree.frames());
    return frames;
  }

  isPageReady() {
    return this._pageReady;
  }

  forcePageReady() {
    if (this._pageReady)
      return false;
    this._pageReady = true;
    this.emit(FrameTree.Events.PageReady);
    return true;
  }

  addScriptToEvaluateOnNewDocument(script) {
    const scriptId = helper.generateId();
    this._scriptsToEvaluateOnNewDocument.set(scriptId, script);
    return scriptId;
  }

  removeScriptToEvaluateOnNewDocument(scriptId) {
    this._scriptsToEvaluateOnNewDocument.delete(scriptId);
  }

  addBinding(name, script) {
    this._bindings.set(name, script);
    for (const frame of this.frames())
      frame._addBinding(name, script);
  }

  setColorScheme(colorScheme) {
    const docShell = this._mainFrame._docShell;
    switch (colorScheme) {
      case 'light': docShell.colorSchemeOverride = Ci.nsIDocShell.COLOR_SCHEME_OVERRIDE_LIGHT; break;
      case 'dark': docShell.colorSchemeOverride = Ci.nsIDocShell.COLOR_SCHEME_OVERRIDE_DARK; break;
      case 'no-preference': docShell.colorSchemeOverride = Ci.nsIDocShell.COLOR_SCHEME_OVERRIDE_NO_PREFERENCE; break;
      default: docShell.colorSchemeOverride = Ci.nsIDocShell.COLOR_SCHEME_OVERRIDE_NONE; break;
    }
  }

  frameForDocShell(docShell) {
    return this._docShellToFrame.get(docShell) || null;
  }

  frame(frameId) {
    return this._frameIdToFrame.get(frameId) || null;
  }

  frames() {
    let result = [];
    collect(this._mainFrame);
    return result;

    function collect(frame) {
      result.push(frame);
      for (const subframe of frame._children)
        collect(subframe);
    }
  }

  mainFrame() {
    return this._mainFrame;
  }

  dispose() {
    this._browsingContextGroup.__jugglerFrameTrees.delete(this);
    this._wdm.removeListener(this._wdmListener);
    this._runtime.dispose();
    helper.removeListeners(this._eventListeners);
  }

  onStateChange(progress, request, flag, status) {
    if (!(request instanceof Ci.nsIChannel))
      return;
    const channel = request.QueryInterface(Ci.nsIChannel);
    const docShell = progress.DOMWindow.docShell;
    const frame = this._docShellToFrame.get(docShell);
    if (!frame) {
      dump(`ERROR: got a state changed event for un-tracked docshell!\n`);
      return;
    }

    const isStart = flag & Ci.nsIWebProgressListener.STATE_START;
    const isTransferring = flag & Ci.nsIWebProgressListener.STATE_TRANSFERRING;
    const isStop = flag & Ci.nsIWebProgressListener.STATE_STOP;

    let isDownload = false;
    try {
      isDownload = (channel.contentDisposition === Ci.nsIChannel.DISPOSITION_ATTACHMENT);
    } catch(e) {
      // The method is expected to throw if it's not an attachment.
    }

    if (isStart) {
      // Starting a new navigation.
      frame._pendingNavigationId = this._channelId(channel);
      frame._pendingNavigationURL = channel.URI.spec;
      this.emit(FrameTree.Events.NavigationStarted, frame);
    } else if (isTransferring || (isStop && frame._pendingNavigationId && !status && !isDownload)) {
      // Navigation is committed.
      for (const subframe of frame._children)
        this._detachFrame(subframe);
      const navigationId = frame._pendingNavigationId;
      frame._pendingNavigationId = null;
      frame._pendingNavigationURL = null;
      frame._lastCommittedNavigationId = navigationId;
      frame._url = channel.URI.spec;
      this.emit(FrameTree.Events.NavigationCommitted, frame);
      if (frame === this._mainFrame)
        this.forcePageReady();
    } else if (isStop && frame._pendingNavigationId && (status || isDownload)) {
      // Navigation is aborted.
      const navigationId = frame._pendingNavigationId;
      frame._pendingNavigationId = null;
      frame._pendingNavigationURL = null;
      // Always report download navigation as failure to match other browsers.
      const errorText = isDownload ? 'Will download to file' : helper.getNetworkErrorStatusText(status);
      this.emit(FrameTree.Events.NavigationAborted, frame, navigationId, errorText);
      if (frame === this._mainFrame && status !== Cr.NS_BINDING_ABORTED && !isDownload)
        this.forcePageReady();
    }
  }

  onFrameLocationChange(progress, request, location, flags) {
    const docShell = progress.DOMWindow.docShell;
    const frame = this._docShellToFrame.get(docShell);
    const sameDocumentNavigation = !!(flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT);
    if (frame && sameDocumentNavigation) {
      frame._url = location.spec;
      this.emit(FrameTree.Events.SameDocumentNavigation, frame);
    }
  }

  _channelId(channel) {
    if (channel instanceof Ci.nsIHttpChannel) {
      const httpChannel = channel.QueryInterface(Ci.nsIHttpChannel);
      return String(httpChannel.channelId);
    }
    return helper.generateId();
  }

  _onDocShellCreated(docShell) {
    // Bug 1142752: sometimes, the docshell appears to be immediately
    // destroyed, bailout early to prevent random exceptions.
    if (docShell.isBeingDestroyed())
      return;
    // If this docShell doesn't belong to our frame tree - do nothing.
    let root = docShell;
    while (root.parent)
      root = root.parent;
    if (root === this._mainFrame._docShell)
      this._createFrame(docShell);
  }

  _createFrame(docShell) {
    const parentFrame = this._docShellToFrame.get(docShell.parent) || null;
    const frame = new Frame(this, this._runtime, docShell, parentFrame);
    this._docShellToFrame.set(docShell, frame);
    this._frameIdToFrame.set(frame.id(), frame);
    this.emit(FrameTree.Events.FrameAttached, frame);
    // Create execution context **after** reporting frame.
    // This is our protocol contract.
    if (frame.domWindow())
      frame._onGlobalObjectCleared();
    return frame;
  }

  _onDocShellDestroyed(docShell) {
    const frame = this._docShellToFrame.get(docShell);
    if (frame)
      this._detachFrame(frame);
  }

  _detachFrame(frame) {
    // Detach all children first
    for (const subframe of frame._children)
      this._detachFrame(subframe);
    this._docShellToFrame.delete(frame._docShell);
    this._frameIdToFrame.delete(frame.id());
    if (frame._parentFrame)
      frame._parentFrame._children.delete(frame);
    frame._parentFrame = null;
    frame.dispose();
    this.emit(FrameTree.Events.FrameDetached, frame);
  }
}

FrameTree.Events = {
  BindingCalled: 'bindingcalled',
  FrameAttached: 'frameattached',
  FrameDetached: 'framedetached',
  GlobalObjectCreated: 'globalobjectcreated',
  WorkerCreated: 'workercreated',
  WorkerDestroyed: 'workerdestroyed',
  NavigationStarted: 'navigationstarted',
  NavigationCommitted: 'navigationcommitted',
  NavigationAborted: 'navigationaborted',
  SameDocumentNavigation: 'samedocumentnavigation',
  PageReady: 'pageready',
};

class Frame {
  constructor(frameTree, runtime, docShell, parentFrame) {
    this._frameTree = frameTree;
    this._runtime = runtime;
    this._docShell = docShell;
    this._children = new Set();
    this._frameId = helper.generateId();
    this._parentFrame = null;
    this._url = '';
    if (docShell.domWindow && docShell.domWindow.location)
      this._url = docShell.domWindow.location.href;
    if (parentFrame) {
      this._parentFrame = parentFrame;
      parentFrame._children.add(this);
    }

    this._lastCommittedNavigationId = null;
    this._pendingNavigationId = null;
    this._pendingNavigationURL = null;

    this._textInputProcessor = null;
    this._executionContext = null;
  }

  dispose() {
    if (this._executionContext)
      this._runtime.destroyExecutionContext(this._executionContext);
    this._executionContext = null;
  }

  _addBinding(name, script) {
    Cu.exportFunction((...args) => {
      this._frameTree.emit(FrameTree.Events.BindingCalled, {
        frame: this,
        name,
        payload: args[0]
      });
    }, this.domWindow(), {
      defineAs: name,
    });
    this.domWindow().eval(script);
  }

  _onGlobalObjectCleared() {
    if (this._executionContext)
      this._runtime.destroyExecutionContext(this._executionContext);
    this._executionContext = this._runtime.createExecutionContext(this.domWindow(), this.domWindow(), {
      frameId: this._frameId,
      name: '',
    });
    for (const [name, script] of this._frameTree._bindings)
      this._addBinding(name, script);
    for (const script of this._frameTree._scriptsToEvaluateOnNewDocument.values()) {
      try {
        const result = this._executionContext.evaluateScript(script);
        if (result && result.objectId)
          this._executionContext.disposeObject(result.objectId);
      } catch (e) {
        dump(`ERROR: ${e.message}\n${e.stack}\n`);
      }
    }
  }

  executionContext() {
    return this._executionContext;
  }

  textInputProcessor() {
    if (!this._textInputProcessor) {
      this._textInputProcessor = Cc["@mozilla.org/text-input-processor;1"].createInstance(Ci.nsITextInputProcessor);
      this._textInputProcessor.beginInputTransactionForTests(this._docShell.DOMWindow);
    }
    return this._textInputProcessor;
  }

  pendingNavigationId() {
    return this._pendingNavigationId;
  }

  pendingNavigationURL() {
    return this._pendingNavigationURL;
  }

  lastCommittedNavigationId() {
    return this._lastCommittedNavigationId;
  }

  docShell() {
    return this._docShell;
  }

  domWindow() {
    return this._docShell.domWindow;
  }

  name() {
    const frameElement = this._docShell.domWindow.frameElement;
    let name = '';
    if (frameElement)
      name = frameElement.getAttribute('name') || frameElement.getAttribute('id') || '';
    return name;
  }

  parentFrame() {
    return this._parentFrame;
  }

  id() {
    return this._frameId;
  }

  url() {
    return this._url;
  }

}

class Worker {
  constructor(frame, workerDebugger) {
    this._frame = frame;
    this._workerId = helper.generateId();
    this._workerDebugger = workerDebugger;

    workerDebugger.initialize('chrome://juggler/content/content/WorkerMain.js');

    this._channel = new SimpleChannel(`content::worker[${this._workerId}]`);
    this._channel.transport = {
      sendMessage: obj => workerDebugger.postMessage(JSON.stringify(obj)),
      dispose: () => {},
    };
    this._workerDebuggerListener = {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIWorkerDebuggerListener]),
      onMessage: msg => void this._channel._onMessage(JSON.parse(msg)),
      onClose: () => void this._channel.dispose(),
      onError: (filename, lineno, message) => {
        dump(`Error in worker: ${message} @${filename}:${lineno}\n`);
      },
    };
    workerDebugger.addListener(this._workerDebuggerListener);
  }

  channel() {
    return this._channel;
  }

  frame() {
    return this._frame;
  }

  id() {
    return this._workerId;
  }

  url() {
    return this._workerDebugger.url;
  }

  dispose() {
    this._channel.dispose();
    this._workerDebugger.removeListener(this._workerDebuggerListener);
  }
}

var EXPORTED_SYMBOLS = ['FrameTree'];
this.FrameTree = FrameTree;

