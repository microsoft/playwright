"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "DispatcherConnection", {
  enumerable: true,
  get: function () {
    return _dispatcher.DispatcherConnection;
  }
});
Object.defineProperty(exports, "PlaywrightDispatcher", {
  enumerable: true,
  get: function () {
    return _playwrightDispatcher.PlaywrightDispatcher;
  }
});
Object.defineProperty(exports, "Registry", {
  enumerable: true,
  get: function () {
    return _registry.Registry;
  }
});
Object.defineProperty(exports, "RootDispatcher", {
  enumerable: true,
  get: function () {
    return _dispatcher.RootDispatcher;
  }
});
Object.defineProperty(exports, "SocksProxy", {
  enumerable: true,
  get: function () {
    return _socksProxy.SocksProxy;
  }
});
Object.defineProperty(exports, "createPlaywright", {
  enumerable: true,
  get: function () {
    return _playwright.createPlaywright;
  }
});
Object.defineProperty(exports, "installBrowsersForNpmInstall", {
  enumerable: true,
  get: function () {
    return _registry.installBrowsersForNpmInstall;
  }
});
Object.defineProperty(exports, "installDefaultBrowsersForNpmInstall", {
  enumerable: true,
  get: function () {
    return _registry.installDefaultBrowsersForNpmInstall;
  }
});
Object.defineProperty(exports, "installRootRedirect", {
  enumerable: true,
  get: function () {
    return _traceViewer.installRootRedirect;
  }
});
Object.defineProperty(exports, "openTraceInBrowser", {
  enumerable: true,
  get: function () {
    return _traceViewer.openTraceInBrowser;
  }
});
Object.defineProperty(exports, "openTraceViewerApp", {
  enumerable: true,
  get: function () {
    return _traceViewer.openTraceViewerApp;
  }
});
Object.defineProperty(exports, "registry", {
  enumerable: true,
  get: function () {
    return _registry.registry;
  }
});
Object.defineProperty(exports, "registryDirectory", {
  enumerable: true,
  get: function () {
    return _registry.registryDirectory;
  }
});
Object.defineProperty(exports, "runTraceViewerApp", {
  enumerable: true,
  get: function () {
    return _traceViewer.runTraceViewerApp;
  }
});
Object.defineProperty(exports, "serverSideCallMetadata", {
  enumerable: true,
  get: function () {
    return _instrumentation.serverSideCallMetadata;
  }
});
Object.defineProperty(exports, "startTraceViewerServer", {
  enumerable: true,
  get: function () {
    return _traceViewer.startTraceViewerServer;
  }
});
Object.defineProperty(exports, "writeDockerVersion", {
  enumerable: true,
  get: function () {
    return _registry.writeDockerVersion;
  }
});
var _registry = require("./registry");
var _dispatcher = require("./dispatchers/dispatcher");
var _playwrightDispatcher = require("./dispatchers/playwrightDispatcher");
var _playwright = require("./playwright");
var _traceViewer = require("./trace/viewer/traceViewer");
var _instrumentation = require("./instrumentation");
var _socksProxy = require("../common/socksProxy");