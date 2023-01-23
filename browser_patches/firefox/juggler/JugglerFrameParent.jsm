"use strict";

const { TargetRegistry } = ChromeUtils.import('chrome://juggler/content/TargetRegistry.js');
const { Helper } = ChromeUtils.import('chrome://juggler/content/Helper.js');

const helper = new Helper();

var EXPORTED_SYMBOLS = ['JugglerFrameParent'];

class JugglerFrameParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  receiveMessage() { }

  async actorCreated() {
    // Only interested in main frames for now.
    if (this.browsingContext.parent)
      return;

    this._target = TargetRegistry.instance()?.targetForBrowserId(this.browsingContext.browserId);
    if (!this._target)
      return;

    this.actorName = `browser::page[${this._target.id()}]/${this.browsingContext.browserId}/${this.browsingContext.id}/${this._target.nextActorSequenceNumber()}`;
    this._target.setActor(this);
  }

  didDestroy() {
    if (!this._target)
      return;
    this._target.removeActor(this);
  }
}
