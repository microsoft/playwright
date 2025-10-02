/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ComponentUtils } from "resource://gre/modules/ComponentUtils.sys.mjs";

const Cm = Components.manager;

/**
 * This is a nsIChannelEventSink implementation that monitors channel redirects.
 * This has been forked from:
 * https://searchfox.org/mozilla-central/source/devtools/server/actors/network-monitor/channel-event-sink.js
 * The rest of this module is also more or less forking:
 * https://searchfox.org/mozilla-central/source/devtools/server/actors/network-monitor/network-observer.js
 * TODO(try to re-unify /remote/ with /devtools code)
 */
const SINK_CLASS_DESCRIPTION = "NetworkMonitor Channel Event Sink";
const SINK_CLASS_ID = Components.ID("{c2b4c83e-607a-405a-beab-0ef5dbfb7617}");
const SINK_CONTRACT_ID = "@mozilla.org/network/monitor/channeleventsink;1";
const SINK_CATEGORY_NAME = "net-channel-event-sinks";

function ChannelEventSink() {
  this.wrappedJSObject = this;
  this.collectors = new Set();
}

ChannelEventSink.prototype = {
  QueryInterface: ChromeUtils.generateQI(["nsIChannelEventSink"]),

  registerCollector(collector) {
    this.collectors.add(collector);
  },

  unregisterCollector(collector) {
    this.collectors.delete(collector);

    if (this.collectors.size == 0) {
      ChannelEventSinkFactory.unregister();
    }
  },

  asyncOnChannelRedirect(oldChannel, newChannel, flags, callback) {
    for (const collector of this.collectors) {
      try {
        collector._onChannelRedirect(oldChannel, newChannel, flags);
      } catch (ex) {
        console.error(
          "StackTraceCollector.onChannelRedirect threw an exception",
          ex
        );
      }
    }
    callback.onRedirectVerifyCallback(Cr.NS_OK);
  },
};

export const ChannelEventSinkFactory =
  ComponentUtils.generateSingletonFactory(ChannelEventSink);

ChannelEventSinkFactory.register = function () {
  const registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);
  if (registrar.isCIDRegistered(SINK_CLASS_ID)) {
    return;
  }

  registrar.registerFactory(
    SINK_CLASS_ID,
    SINK_CLASS_DESCRIPTION,
    SINK_CONTRACT_ID,
    ChannelEventSinkFactory
  );

  Services.catMan.addCategoryEntry(
    SINK_CATEGORY_NAME,
    SINK_CONTRACT_ID,
    SINK_CONTRACT_ID,
    false,
    true
  );
};

ChannelEventSinkFactory.unregister = function () {
  const registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);
  registrar.unregisterFactory(SINK_CLASS_ID, ChannelEventSinkFactory);

  Services.catMan.deleteCategoryEntry(
    SINK_CATEGORY_NAME,
    SINK_CONTRACT_ID,
    false
  );
};

ChannelEventSinkFactory.getService = function () {
  // Make sure the ChannelEventSink service is registered before accessing it
  ChannelEventSinkFactory.register();

  return Cc[SINK_CONTRACT_ID].getService(Ci.nsIChannelEventSink)
    .wrappedJSObject;
};
