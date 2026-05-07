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
    // See https://github.com/mozilla-firefox/firefox/blob/35e22180b0b61413dd8eccf6c00b1c6fac073eee/testing/mochitest/BrowserTestUtils/BrowserTestUtilsParent.sys.mjs#L15
    if (!this.manager?.isCurrentGlobal)
      return;

    TargetRegistry.instance()?.onActorCreated(this);
  }

  didDestroy() {
    TargetRegistry.instance()?.onActorDestroyed(this);
  }
}
