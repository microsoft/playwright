/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {FrameTree} = ChromeUtils.import('chrome://juggler/content/content/FrameTree.js');
const {SimpleChannel} = ChromeUtils.import('chrome://juggler/content/SimpleChannel.js');
const {PageAgent} = ChromeUtils.import('chrome://juggler/content/content/PageAgent.js');

const browsingContextToAgents = new Map();
const helper = new Helper();

function initialize(browsingContext, docShell, actor) {
  if (browsingContext.parent) {
    // For child frames, return agents from the main frame.
    return browsingContextToAgents.get(browsingContext.top);
  }

  let data = browsingContextToAgents.get(browsingContext);
  if (data) {
    // Rebind from one main frame actor to another one.
    data.channel.bindToActor(actor);
    return data;
  }

  data = { channel: undefined, pageAgent: undefined, frameTree: undefined, failedToOverrideTimezone: false };
  browsingContextToAgents.set(browsingContext, data);

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

    bypassCSP: (bypassCSP) => {
      docShell.bypassCSPEnabled = bypassCSP;
    },

    timezoneId: (timezoneId) => {
      data.failedToOverrideTimezone = !docShell.overrideTimezone(timezoneId);
    },

    locale: (locale) => {
      docShell.languageOverride = locale;
    },

    scrollbarsHidden: (hidden) => {
      data.frameTree.setScrollbarsHidden(hidden);
    },

    javaScriptDisabled: (javaScriptDisabled) => {
      data.frameTree.setJavaScriptDisabled(javaScriptDisabled);
    },
  };

  const contextCrossProcessCookie = Services.cpmm.sharedData.get('juggler:context-cookie-' + browsingContext.originAttributes.userContextId) || { initScripts: [], bindings: [], settings: {} };
  const pageCrossProcessCookie = Services.cpmm.sharedData.get('juggler:page-cookie-' + browsingContext.browserId) || { initScripts: [], bindings: [], interceptFileChooserDialog: false };

  // Enforce focused state for all top level documents.
  docShell.overrideHasFocus = true;
  docShell.forceActiveState = true;
  docShell.disallowBFCache = true;
  data.frameTree = new FrameTree(docShell);
  for (const [name, value] of Object.entries(contextCrossProcessCookie.settings)) {
    if (value !== undefined)
      applySetting[name](value);
  }
  for (const { worldName, name, script } of [...contextCrossProcessCookie.bindings, ...pageCrossProcessCookie.bindings])
    data.frameTree.addBinding(worldName, name, script);
  data.frameTree.setInitScripts([...contextCrossProcessCookie.initScripts, ...pageCrossProcessCookie.initScripts]);
  data.channel = SimpleChannel.createForActor(actor);
  data.pageAgent = new PageAgent(data.channel, data.frameTree);
  docShell.fileInputInterceptionEnabled = !!pageCrossProcessCookie.interceptFileChooserDialog;

  data.channel.register('', {
    setInitScripts(scripts) {
      data.frameTree.setInitScripts(scripts);
    },

    addBinding({worldName, name, script}) {
      data.frameTree.addBinding(worldName, name, script);
    },

    applyContextSetting({name, value}) {
      applySetting[name](value);
    },

    setInterceptFileChooserDialog(enabled) {
      docShell.fileInputInterceptionEnabled = !!enabled;
    },

    ensurePermissions() {
      // noop, just a rountrip.
    },

    hasFailedToOverrideTimezone() {
      return data.failedToOverrideTimezone;
    },

    async awaitViewportDimensions({width, height, deviceSizeIsPageSize}) {
      docShell.deviceSizeIsPageSize = deviceSizeIsPageSize;
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

  return data;
}

var EXPORTED_SYMBOLS = ['initialize'];
this.initialize = initialize;
