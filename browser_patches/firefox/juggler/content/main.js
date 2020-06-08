/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {FrameTree} = ChromeUtils.import('chrome://juggler/content/content/FrameTree.js');
const {NetworkMonitor} = ChromeUtils.import('chrome://juggler/content/content/NetworkMonitor.js');
const {SimpleChannel} = ChromeUtils.import('chrome://juggler/content/SimpleChannel.js');
const {PageAgent} = ChromeUtils.import('chrome://juggler/content/content/PageAgent.js');

let frameTree;
let networkMonitor;
const helper = new Helper();
const messageManager = this;

const sessions = new Map();

function createContentSession(channel, sessionId) {
  const pageAgent = new PageAgent(messageManager, channel, sessionId, frameTree, networkMonitor);
  sessions.set(sessionId, [pageAgent]);
  pageAgent.enable();
}

function disposeContentSession(sessionId) {
  const handlers = sessions.get(sessionId);
  sessions.delete(sessionId);
  for (const handler of handlers)
    handler.dispose();
}

let failedToOverrideTimezone = false;

const applySetting = {
  geolocation: (geolocation) => {
    if (geolocation) {
      docShell.setGeolocationOverride({
        coords: {
          latitude: geolocation.latitude,
          longitude: geolocation.longitude,
          accuracy: geolocation.accuracy,
          altitude: NaN,
          altitudeAccuracy: NaN,
          heading: NaN,
          speed: NaN,
        },
        address: null,
        timestamp: Date.now()
      });
    } else {
      docShell.setGeolocationOverride(null);
    }
  },

  onlineOverride: (onlineOverride) => {
    if (!onlineOverride) {
      docShell.onlineOverride = Ci.nsIDocShell.ONLINE_OVERRIDE_NONE;
      return;
    }
    docShell.onlineOverride = onlineOverride === 'online' ?
        Ci.nsIDocShell.ONLINE_OVERRIDE_ONLINE : Ci.nsIDocShell.ONLINE_OVERRIDE_OFFLINE;
  },

  userAgent: (userAgent) => {
    docShell.browsingContext.customUserAgent = userAgent;
  },

  bypassCSP: (bypassCSP) => {
    docShell.bypassCSPEnabled = bypassCSP;
  },

  timezoneId: (timezoneId) => {
    failedToOverrideTimezone = !docShell.overrideTimezone(timezoneId);
  },

  locale: (locale) => {
    docShell.languageOverride = locale;
  },

  javaScriptDisabled: (javaScriptDisabled) => {
    docShell.allowJavascript = !javaScriptDisabled;
  },

  hasTouch: (hasTouch) => {
    docShell.touchEventsOverride = hasTouch ? Ci.nsIDocShell.TOUCHEVENTS_OVERRIDE_ENABLED : Ci.nsIDocShell.TOUCHEVENTS_OVERRIDE_NONE;
  },

  colorScheme: (colorScheme) => {
    frameTree.setColorScheme(colorScheme);
  },

  deviceScaleFactor: (deviceScaleFactor) => {
    docShell.contentViewer.overrideDPPX = deviceScaleFactor || this._initialDPPX;
    docShell.deviceSizeIsPageSize = !!deviceScaleFactor;
  },
};

function initialize() {
  const loadContext = docShell.QueryInterface(Ci.nsILoadContext);
  const userContextId = loadContext.originAttributes.userContextId;

  const response = sendSyncMessage('juggler:content-ready', { userContextId })[0];
  const {
    sessionIds = [],
    scriptsToEvaluateOnNewDocument = [],
    bindings = [],
    settings = {}
  } = response || {};

  // Enforce focused state for all top level documents.
  docShell.overrideHasFocus = true;
  frameTree = new FrameTree(docShell);
  for (const [name, value] of Object.entries(settings)) {
    if (value !== undefined)
      applySetting[name](value);
  }
  for (const script of scriptsToEvaluateOnNewDocument)
    frameTree.addScriptToEvaluateOnNewDocument(script);
  for (const { name, script } of bindings)
    frameTree.addBinding(name, script);
  networkMonitor = new NetworkMonitor(docShell, frameTree);

  const channel = SimpleChannel.createForMessageManager('content::page', messageManager);

  for (const sessionId of sessionIds)
    createContentSession(channel, sessionId);

  channel.register('', {
    attach({sessionId}) {
      createContentSession(channel, sessionId);
    },

    detach({sessionId}) {
      disposeContentSession(sessionId);
    },

    addScriptToEvaluateOnNewDocument(script) {
      frameTree.addScriptToEvaluateOnNewDocument(script);
    },

    addBinding({name, script}) {
      frameTree.addBinding(name, script);
    },

    applyContextSetting({name, value}) {
      applySetting[name](value);
    },

    ensurePermissions() {
      // noop, just a rountrip.
    },

    hasFailedToOverrideTimezone() {
      return failedToOverrideTimezone;
    },

    async awaitViewportDimensions({width, height}) {
      const win = docShell.domWindow;
      if (win.innerWidth === width && win.innerHeight === height)
        return;
      await new Promise(resolve => {
        const listener = helper.addEventListener(win, 'resize', () => {
          if (win.innerWidth === width && win.innerHeight === height) {
            helper.removeListeners([listener]);
            resolve();
          }
        });
      });
    },

    dispose() {
    },
  });

  const gListeners = [
    helper.addEventListener(messageManager, 'unload', msg => {
      helper.removeListeners(gListeners);
      channel.dispose();

      for (const sessionId of sessions.keys())
        disposeContentSession(sessionId);

      networkMonitor.dispose();
      frameTree.dispose();
    }),
  ];
}

initialize();
