/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {XPCOMUtils} = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
const {ComponentUtils} = ChromeUtils.import("resource://gre/modules/ComponentUtils.jsm");
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const {Dispatcher} = ChromeUtils.import("chrome://juggler/content/protocol/Dispatcher.js");
const {BrowserHandler} = ChromeUtils.import("chrome://juggler/content/protocol/BrowserHandler.js");
const {NetworkObserver} = ChromeUtils.import("chrome://juggler/content/NetworkObserver.js");
const {TargetRegistry} = ChromeUtils.import("chrome://juggler/content/TargetRegistry.js");
const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const helper = new Helper();

const Cc = Components.classes;
const Ci = Components.interfaces;

const FRAME_SCRIPT = "chrome://juggler/content/content/main.js";

// Command Line Handler
function CommandLineHandler() {
};

CommandLineHandler.prototype = {
  classDescription: "Sample command-line handler",
  classID: Components.ID('{f7a74a33-e2ab-422d-b022-4fb213dd2639}'),
  contractID: "@mozilla.org/remote/juggler;1",
  _xpcom_categories: [{
    category: "command-line-handler",
    entry: "m-juggler"
  }],

  /* nsICommandLineHandler */
  handle: async function(cmdLine) {
    const jugglerFlag = cmdLine.handleFlagWithParam("juggler", false);
    const jugglerPipeFlag = cmdLine.handleFlag("juggler-pipe", false);
    if (!jugglerPipeFlag && (!jugglerFlag || isNaN(jugglerFlag)))
      return;
    const silent = cmdLine.preventDefault;
    if (silent)
      Services.startup.enterLastWindowClosingSurvivalArea();

    const targetRegistry = new TargetRegistry();
    new NetworkObserver(targetRegistry);

    const loadFrameScript = () => {
      Services.mm.loadFrameScript(FRAME_SCRIPT, true /* aAllowDelayedLoad */);
      if (Cc["@mozilla.org/gfx/info;1"].getService(Ci.nsIGfxInfo).isHeadless) {
        const styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Components.interfaces.nsIStyleSheetService);
        const ioService = Cc["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
        const uri = ioService.newURI('chrome://juggler/content/content/hidden-scrollbars.css', null, null);
        styleSheetService.loadAndRegisterSheet(uri, styleSheetService.AGENT_SHEET);
      }
    };

    // Force create hidden window here, otherwise its creation later closes the web socket!
    Services.appShell.hiddenDOMWindow;

    if (jugglerFlag) {
      const port = parseInt(jugglerFlag, 10);
      const { require } = ChromeUtils.import("resource://devtools/shared/Loader.jsm");
      const WebSocketServer = require('devtools/server/socket/websocket-server');
      this._server = Cc["@mozilla.org/network/server-socket;1"].createInstance(Ci.nsIServerSocket);
      this._server.initSpecialConnection(port, Ci.nsIServerSocket.KeepWhenOffline | Ci.nsIServerSocket.LoopbackOnly, 4);
      const token = helper.generateId();
      this._server.asyncListen({
        onSocketAccepted: async(socket, transport) => {
          const input = transport.openInputStream(0, 0, 0);
          const output = transport.openOutputStream(0, 0, 0);
          const webSocket = await WebSocketServer.accept(transport, input, output, "/" + token);
          const dispatcher = new Dispatcher(webSocket);
          const browserHandler = new BrowserHandler(dispatcher.rootSession(), dispatcher, targetRegistry, () => {
            if (silent)
              Services.startup.exitLastWindowClosingSurvivalArea();
          });
          dispatcher.rootSession().registerHandler('Browser', browserHandler);
        }
      });
      loadFrameScript();
      dump(`Juggler listening on ws://127.0.0.1:${this._server.port}/${token}\n`);
    } else if (jugglerPipeFlag) {
      const pipe = Cc['@mozilla.org/juggler/remotedebuggingpipe;1'].getService(Ci.nsIRemoteDebuggingPipe);
      const connection = {
        QueryInterface: ChromeUtils.generateQI([Ci.nsIRemoteDebuggingPipeClient]),
        receiveMessage(message) {
          if (this.onmessage)
            this.onmessage({ data: message });
        },
        send(message) {
          pipe.sendMessage(message);
        },
      };
      pipe.init(connection);
      const dispatcher = new Dispatcher(connection);
      const browserHandler = new BrowserHandler(dispatcher.rootSession(), dispatcher, targetRegistry, () => {
        if (silent)
          Services.startup.exitLastWindowClosingSurvivalArea();
        // Send response to the Browser.close, and then stop in the next microtask.
        Promise.resolve().then(() => {
          connection.onclose();
          pipe.stop();
        });
      });
      dispatcher.rootSession().registerHandler('Browser', browserHandler);
      loadFrameScript();
      dump(`Juggler listening to the pipe\n`);
    }
  },

  QueryInterface: ChromeUtils.generateQI([ Ci.nsICommandLineHandler ]),

  // CHANGEME: change the help info as appropriate, but
  // follow the guidelines in nsICommandLineHandler.idl
  // specifically, flag descriptions should start at
  // character 24, and lines should be wrapped at
  // 72 characters with embedded newlines,
  // and finally, the string should end with a newline
  helpInfo : "  --juggler            Enable Juggler automation\n"
};

var NSGetFactory = ComponentUtils.generateNSGetFactory([CommandLineHandler]);
