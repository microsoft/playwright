/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const helper = new Helper();

class WorkerHandler {
  constructor(session, contentChannel, workerId) {
    this._session = session;
    this._contentWorker = contentChannel.connect(session.sessionId() + workerId);
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
      contentChannel.register(session.sessionId() + workerId, {
        runtimeConsole: emitWrappedProtocolEvent('Runtime.console'),
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
    this._contentPage = contentChannel.connect(session.sessionId() + 'page');
    this._workers = new Map();

    const emitProtocolEvent = eventName => {
      return (...args) => this._session.emitEvent(eventName, ...args);
    }

    this._eventListeners = [
      contentChannel.register(session.sessionId() + 'page', {
        pageBindingCalled: emitProtocolEvent('Page.bindingCalled'),
        pageDispatchMessageFromWorker: emitProtocolEvent('Page.dispatchMessageFromWorker'),
        pageEventFired: emitProtocolEvent('Page.eventFired'),
        pageFileChooserOpened: emitProtocolEvent('Page.fileChooserOpened'),
        pageFrameAttached: emitProtocolEvent('Page.frameAttached'),
        pageFrameDetached: emitProtocolEvent('Page.frameDetached'),
        pageLinkClicked: emitProtocolEvent('Page.linkClicked'),
        pageWillOpenNewWindowAsynchronously: emitProtocolEvent('Page.willOpenNewWindowAsynchronously'),
        pageNavigationAborted: emitProtocolEvent('Page.navigationAborted'),
        pageNavigationCommitted: emitProtocolEvent('Page.navigationCommitted'),
        pageNavigationStarted: emitProtocolEvent('Page.navigationStarted'),
        pageReady: emitProtocolEvent('Page.ready'),
        pageSameDocumentNavigation: emitProtocolEvent('Page.sameDocumentNavigation'),
        pageUncaughtError: emitProtocolEvent('Page.uncaughtError'),
        pageWorkerCreated: this._onWorkerCreated.bind(this),
        pageWorkerDestroyed: this._onWorkerDestroyed.bind(this),
      }),
    ];
    this._pageTarget = target;
    this._browser = target.linkedBrowser();
    this._dialogs = new Map();

    this._enabled = false;
    this._videoSessionId = -1;
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

  async close({runBeforeUnload}) {
    // Postpone target close to deliver response in session.
    Services.tm.dispatchToMainThread(() => {
      this._pageTarget.close(runBeforeUnload);
    });
  }

  async enable() {
    if (this._enabled)
      return;
    this._enabled = true;
    this._updateModalDialogs();

    this._eventListeners.push(...[
      helper.addEventListener(this._browser, 'DOMWillOpenModalDialog', async (event) => {
        // wait for the dialog to be actually added to DOM.
        await Promise.resolve();
        this._updateModalDialogs();
      }),
      helper.addEventListener(this._browser, 'DOMModalDialogClosed', event => this._updateModalDialogs()),
      helper.on(this._pageTarget, 'crashed', () => {
        this._session.emitEvent('Page.crashed', {});
      }),
    ]);
  }

  dispose() {
    this._contentPage.dispose();
    helper.removeListeners(this._eventListeners);
    if (this._videoSessionId !== -1)
      this.stopVideoRecording().catch(e => dump(`stopVideoRecording failed:\n${e}\n`));
  }

  async setViewportSize({viewportSize}) {
    await this._pageTarget.setViewportSize(viewportSize === null ? undefined : viewportSize);
  }

  _updateModalDialogs() {
    const prompts = new Set(this._browser.tabModalPromptBox ? this._browser.tabModalPromptBox.listPrompts() : []);
    for (const dialog of this._dialogs.values()) {
      if (!prompts.has(dialog.prompt())) {
        this._dialogs.delete(dialog.id());
        this._session.emitEvent('Page.dialogClosed', {
          dialogId: dialog.id(),
        });
      } else {
        prompts.delete(dialog.prompt());
      }
    }
    for (const prompt of prompts) {
      const dialog = Dialog.createIfSupported(prompt);
      if (!dialog)
        continue;
      this._dialogs.set(dialog.id(), dialog);
      this._session.emitEvent('Page.dialogOpened', {
        dialogId: dialog.id(),
        type: dialog.type(),
        message: dialog.message(),
        defaultValue: dialog.defaultValue(),
      });
    }
  }

  async setFileInputFiles(options) {
    return await this._contentPage.send('setFileInputFiles', options);
  }

  async setEmulatedMedia(options) {
    return await this._contentPage.send('setEmulatedMedia', options);
  }

  async bringToFront(options) {
    this._pageTarget._window.focus();
  }

  async setCacheDisabled(options) {
    return await this._contentPage.send('setCacheDisabled', options);
  }

  async addBinding(options) {
    return await this._contentPage.send('addBinding', options);
  }

  async adoptNode(options) {
    return await this._contentPage.send('adoptNode', options);
  }

  async screenshot(options) {
    return await this._contentPage.send('screenshot', options);
  }

  async getBoundingBox(options) {
    return await this._contentPage.send('getBoundingBox', options);
  }

  async getContentQuads(options) {
    return await this._contentPage.send('getContentQuads', options);
  }

  /**
   * @param {{frameId: string, url: string}} options
   */
  async navigate(options) {
    return await this._contentPage.send('navigate', options);
  }

  /**
   * @param {{frameId: string, url: string}} options
   */
  async goBack(options) {
    return await this._contentPage.send('goBack', options);
  }

  /**
   * @param {{frameId: string, url: string}} options
   */
  async goForward(options) {
    return await this._contentPage.send('goForward', options);
  }

  /**
   * @param {{frameId: string, url: string}} options
   */
  async reload(options) {
    return await this._contentPage.send('reload', options);
  }

  async describeNode(options) {
    return await this._contentPage.send('describeNode', options);
  }

  async scrollIntoViewIfNeeded(options) {
    return await this._contentPage.send('scrollIntoViewIfNeeded', options);
  }

  async addScriptToEvaluateOnNewDocument(options) {
    return await this._contentPage.send('addScriptToEvaluateOnNewDocument', options);
  }

  async removeScriptToEvaluateOnNewDocument(options) {
    return await this._contentPage.send('removeScriptToEvaluateOnNewDocument', options);
  }

  async dispatchKeyEvent(options) {
    return await this._contentPage.send('dispatchKeyEvent', options);
  }

  async dispatchTouchEvent(options) {
    return await this._contentPage.send('dispatchTouchEvent', options);
  }

  async dispatchMouseEvent(options) {
    return await this._contentPage.send('dispatchMouseEvent', options);
  }

  async insertText(options) {
    return await this._contentPage.send('insertText', options);
  }

  async crash(options) {
    return await this._contentPage.send('crash', options);
  }

  async handleDialog({dialogId, accept, promptText}) {
    const dialog = this._dialogs.get(dialogId);
    if (!dialog)
      throw new Error('Failed to find dialog with id = ' + dialogId);
    if (accept)
      dialog.accept(promptText);
    else
      dialog.dismiss();
  }

  async setInterceptFileChooserDialog(options) {
    return await this._contentPage.send('setInterceptFileChooserDialog', options);
  }

  async sendMessageToWorker({workerId, message}) {
    const worker = this._workers.get(workerId);
    if (!worker)
      throw new Error('ERROR: cannot find worker with id ' + workerId);
    return await worker.sendMessage(JSON.parse(message));
  }

  startVideoRecording({file, width, height, scale}) {
    if (width < 10 || width > 10000 || height < 10 || height > 10000)
      throw new Error("Invalid size");
    if (scale && (scale <= 0 || scale > 1))
      throw new Error("Unsupported scale");

    const screencast = Cc['@mozilla.org/juggler/screencast;1'].getService(Ci.nsIScreencastService);
    const docShell = this._pageTarget._gBrowser.ownerGlobal.docShell;
    // Exclude address bar and navigation control from the video.
    const rect = this._pageTarget.linkedBrowser().getBoundingClientRect();
    const devicePixelRatio = this._pageTarget._window.devicePixelRatio;
    this._videoSessionId = screencast.startVideoRecording(docShell, file, width, height, scale || 0, devicePixelRatio * rect.top);
  }

  async stopVideoRecording() {
    if (this._videoSessionId === -1)
      throw new Error('No video recording in progress');
    const videoSessionId = this._videoSessionId;
    this._videoSessionId = -1;
    const screencast = Cc['@mozilla.org/juggler/screencast;1'].getService(Ci.nsIScreencastService);
    const result = new Promise(resolve =>
      Services.obs.addObserver(function onStopped(subject, topic, data) {
        if (videoSessionId != data)
          return;

        Services.obs.removeObserver(onStopped, 'juggler-screencast-stopped');
        resolve();
      }, 'juggler-screencast-stopped')
    );
    screencast.stopVideoRecording(videoSessionId);
    return result;
  }
}

class Dialog {
  static createIfSupported(prompt) {
    const type = prompt.args.promptType;
    switch (type) {
      case 'alert':
      case 'prompt':
      case 'confirm':
        return new Dialog(prompt, type);
      case 'confirmEx':
        return new Dialog(prompt, 'beforeunload');
      default:
        return null;
    };
  }

  constructor(prompt, type) {
    this._id = helper.generateId();
    this._type = type;
    this._prompt = prompt;
  }

  id() {
    return this._id;
  }

  message() {
    return this._prompt.ui.infoBody.textContent;
  }

  type() {
    return this._type;
  }

  prompt() {
    return this._prompt;
  }

  dismiss() {
    if (this._prompt.ui.button1)
      this._prompt.ui.button1.click();
    else
      this._prompt.ui.button0.click();
  }

  defaultValue() {
    return this._prompt.ui.loginTextbox.value;
  }

  accept(promptValue) {
    if (typeof promptValue === 'string' && this._type === 'prompt')
      this._prompt.ui.loginTextbox.value = promptValue;
    this._prompt.ui.button0.click();
  }
}

var EXPORTED_SYMBOLS = ['PageHandler'];
this.PageHandler = PageHandler;
