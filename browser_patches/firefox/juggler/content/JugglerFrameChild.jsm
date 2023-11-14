"use strict";

const { Helper } = ChromeUtils.import('chrome://juggler/content/Helper.js');
const { initialize } = ChromeUtils.import('chrome://juggler/content/content/main.js');

const Ci = Components.interfaces;
const helper = new Helper();

let sameProcessInstanceNumber = 0;

class JugglerFrameChild extends JSWindowActorChild {
  constructor() {
    super();

    this._eventListeners = [];
  }

  handleEvent(aEvent) {
    if (this._agents && aEvent.type === 'DOMWillOpenModalDialog') {
      this._agents.channel.pause();
      return;
    }
    if (this._agents && aEvent.type === 'DOMModalDialogClosed') {
      this._agents.channel.resumeSoon();
      return;
    }
    if (this._agents && aEvent.target === this.document)
      this._agents.pageAgent.onWindowEvent(aEvent);
    if (this._agents && aEvent.target === this.document)
      this._agents.frameTree.onWindowEvent(aEvent);
  }

  actorCreated() {
    this.actorName = `content::${this.browsingContext.browserId}/${this.browsingContext.id}/${++sameProcessInstanceNumber}`;

    this._eventListeners.push(helper.addEventListener(this.contentWindow, 'load', event => {
      this._agents?.pageAgent.onWindowEvent(event);
    }));

    if (this.document.documentURI.startsWith('moz-extension://'))
      return;
    this._agents = initialize(this.browsingContext, this.docShell, this);
  }

  _dispose() {
    helper.removeListeners(this._eventListeners);
    // We do not cleanup since agents are shared for all frames in the process.

    // TODO: restore the cleanup.
    // Reset transport so that all messages will be pending and will not throw any errors.
    // this._channel.resetTransport();
    // this._agents.pageAgent.dispose();
    // this._agents.frameTree.dispose();
    // this._agents = undefined;
  }

  didDestroy() {
    this._dispose();
  }

  receiveMessage() { }
}

var EXPORTED_SYMBOLS = ['JugglerFrameChild'];
