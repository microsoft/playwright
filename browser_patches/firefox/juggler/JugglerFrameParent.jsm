"use strict";

const { TargetRegistry } = ChromeUtils.importESModule('chrome://juggler/content/TargetRegistry.js');
const { Helper } = ChromeUtils.importESModule('chrome://juggler/content/Helper.js');

const helper = new Helper();

export class JugglerFrameParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  receiveMessage() { }

  async actorCreated() {
    // Actors are registered per the WindowGlobalParent / WindowGlobalChild pair. We are only
    // interested in those WindowGlobalParent actors that are matching current browsingContext
    // window global.
    // See https://github.com/mozilla/gecko-dev/blob/cd2121e7d83af1b421c95e8c923db70e692dab5f/testing/mochitest/BrowserTestUtils/BrowserTestUtilsParent.sys.mjs#L15
    if (!this.manager?.isCurrentGlobal)
      return;

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
