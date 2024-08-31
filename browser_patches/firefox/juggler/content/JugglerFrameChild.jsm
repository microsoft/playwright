"use strict";

const { Helper } = ChromeUtils.import('chrome://juggler/content/Helper.js');
const { initialize } = ChromeUtils.import('chrome://juggler/content/content/main.js');

const Ci = Components.interfaces;
const helper = new Helper();

let sameProcessInstanceNumber = 0;
const topBrowingContextToAgents = new Map();

class JugglerFrameChild extends JSWindowActorChild {
  constructor() {
    super();
    this._eventListeners = [];
  }

  handleEvent(aEvent) {
    const agents = this._agents();
    if (!agents) return;

    switch (aEvent.type) {
      case 'DOMWillOpenModalDialog':
        agents.channel.pause();
        break;
      case 'DOMModalDialogClosed':
        agents.channel.resumeSoon();
        break;
      default:
        if (aEvent.target === this.document) {
          agents.pageAgent.onWindowEvent(aEvent);
          agents.frameTree.onWindowEvent(aEvent);
        }
        break;
    }
  }

  _agents() {
    return topBrowingContextToAgents.get(this.browsingContext.top);
  }

  actorCreated() {
    this.actorName = `content::${this.browsingContext.browserId}/${this.browsingContext.id}/${++sameProcessInstanceNumber}`;

    this._eventListeners.push(helper.addEventListener(this.contentWindow, 'load', event => {
      this._agents()?.pageAgent.onWindowEvent(event);
    }));

    if (this._isMozExtension()) return;

    if (!this.browsingContext.parent) {
      let agents = topBrowingContextToAgents.get(this.browsingContext);
      if (!agents) {
        agents = initialize(this.browsingContext, this.docShell);
        topBrowingContextToAgents.set(this.browsingContext, agents);
      }
      agents.channel.bindToActor(this);
      agents.actor = this;
    }
  }

  didDestroy() {
    helper.removeListeners(this._eventListeners);

    if (this.browsingContext.parent) return;

    const agents = topBrowingContextToAgents.get(this.browsingContext);
    if (agents.actor !== this) return;

    topBrowingContextToAgents.delete(this.browsingContext);
    agents.channel.resetTransport();
    agents.pageAgent.dispose();
    agents.frameTree.dispose();
  }

  _isMozExtension() {
    return this.document.documentURI.startsWith('moz-extension://');
  }

  receiveMessage() {}
}

var EXPORTED_SYMBOLS = ['JugglerFrameChild'];
