/**
 * @license
 * Copyright 2024 Google Inc.
 * Modifications copyright (c) Microsoft Corporation.
 * SPDX-License-Identifier: Apache-2.0
 */

// Copied from upstream: https://github.com/GoogleChromeLabs/webdriver-bidi-protocol/blob/main/src/index.ts

import type * as Bidi from './bidiProtocol';

export interface Commands {
  'bluetooth.handleRequestDevicePrompt': {
    params: BidiBluetooth.Bluetooth.HandleRequestDevicePromptParameters;
    returnType: Bidi.EmptyResult;
  };
  'bluetooth.disableSimulation': {
    params: BidiBluetooth.Bluetooth.DisableSimulationParameters;
    returnType: Bidi.EmptyResult;
  };
  'bluetooth.simulateAdapter': {
    params: BidiBluetooth.Bluetooth.SimulateAdapterParameters;
    returnType: Bidi.EmptyResult;
  };
  'bluetooth.simulateAdvertisement': {
    params: BidiBluetooth.Bluetooth.SimulateAdvertisementParameters;
    returnType: Bidi.EmptyResult;
  };
  'bluetooth.simulatePreconnectedPeripheral': {
    params: BidiBluetooth.Bluetooth.SimulatePreconnectedPeripheralParameters;
    returnType: Bidi.EmptyResult;
  };
  'bluetooth.simulateGattDisconnection': {
    params: BidiBluetooth.Bluetooth.SimulateGattDisconnectionParameters;
    returnType: Bidi.EmptyResult;
  };
  'bluetooth.simulateDescriptor': {
    params: BidiBluetooth.Bluetooth.SimulateDescriptorParameters;
    returnType: Bidi.EmptyResult;
  };
  'bluetooth.simulateDescriptorResponse': {
    params: BidiBluetooth.Bluetooth.SimulateDescriptorResponseParameters;
    returnType: Bidi.EmptyResult;
  };

  'browser.close': {
    params: Bidi.EmptyParams;
    returnType: Bidi.EmptyResult;
  };
  'browser.getClientWindows': {
    params: Bidi.EmptyParams;
    returnType: Bidi.Browser.GetClientWindowsResult;
  };
  'browser.createUserContext': {
    params: Bidi.EmptyParams;
    returnType: Bidi.Browser.CreateUserContextResult;
  };
  'browser.getUserContexts': {
    params: Bidi.EmptyParams;
    returnType: Bidi.Browser.GetUserContextsResult;
  };
  'browser.removeUserContext': {
    params: {
      userContext: Bidi.Browser.UserContext;
    };
    returnType: Bidi.Browser.RemoveUserContext;
  };
  'browser.setClientWindowState': {
    params: Bidi.Browser.SetClientWindowStateParameters;
    returnType: Bidi.Browser.ClientWindowInfo;
  };

  'browsingContext.activate': {
    params: Bidi.BrowsingContext.ActivateParameters;
    returnType: Bidi.EmptyResult;
  };
  'browsingContext.create': {
    params: Bidi.BrowsingContext.CreateParameters;
    returnType: Bidi.BrowsingContext.CreateResult;
  };
  'browsingContext.close': {
    params: Bidi.BrowsingContext.CloseParameters;
    returnType: Bidi.EmptyResult;
  };
  'browsingContext.getTree': {
    params: Bidi.BrowsingContext.GetTreeParameters;
    returnType: Bidi.BrowsingContext.GetTreeResult;
  };
  'browsingContext.locateNodes': {
    params: Bidi.BrowsingContext.LocateNodesParameters;
    returnType: Bidi.BrowsingContext.LocateNodesResult;
  };
  'browsingContext.navigate': {
    params: Bidi.BrowsingContext.NavigateParameters;
    returnType: Bidi.BrowsingContext.NavigateResult;
  };
  'browsingContext.reload': {
    params: Bidi.BrowsingContext.ReloadParameters;
    returnType: Bidi.BrowsingContext.NavigateResult;
  };
  'browsingContext.print': {
    params: Bidi.BrowsingContext.PrintParameters;
    returnType: Bidi.BrowsingContext.PrintResult;
  };
  'browsingContext.captureScreenshot': {
    params: Bidi.BrowsingContext.CaptureScreenshotParameters;
    returnType: Bidi.BrowsingContext.CaptureScreenshotResult;
  };
  'browsingContext.handleUserPrompt': {
    params: Bidi.BrowsingContext.HandleUserPromptParameters;
    returnType: Bidi.EmptyResult;
  };
  'browsingContext.setViewport': {
    params: Bidi.BrowsingContext.SetViewportParameters;
    returnType: Bidi.EmptyResult;
  };
  'browsingContext.traverseHistory': {
    params: Bidi.BrowsingContext.TraverseHistoryParameters;
    returnType: Bidi.EmptyResult;
  };

  'emulation.setForcedColorsModeThemeOverride': {
    params: Bidi.Emulation.SetForcedColorsModeThemeOverrideParameters;
    returnType: Bidi.EmptyResult;
  };
  'emulation.setGeolocationOverride': {
    params: Bidi.Emulation.SetGeolocationOverrideParameters;
    returnType: Bidi.EmptyResult;
  };
  'emulation.setLocaleOverride': {
    params: Bidi.Emulation.SetLocaleOverrideParameters;
    returnType: Bidi.EmptyResult;
  };
  'emulation.setScreenOrientationOverride': {
    params: Bidi.Emulation.SetScreenOrientationOverrideParameters;
    returnType: Bidi.EmptyResult;
  };
  'emulation.setTimezoneOverride': {
    params: Bidi.Emulation.SetTimezoneOverrideParameters;
    returnType: Bidi.EmptyResult;
  };

  'input.performActions': {
    params: Bidi.Input.PerformActionsParameters;
    returnType: Bidi.EmptyResult;
  };
  'input.releaseActions': {
    params: Bidi.Input.ReleaseActionsParameters;
    returnType: Bidi.EmptyResult;
  };
  'input.setFiles': {
    params: Bidi.Input.SetFilesParameters;
    returnType: Bidi.EmptyResult;
  };

  'permissions.setPermission': {
    params: BidiPermissions.Permissions.SetPermissionParameters;
    returnType: Bidi.EmptyResult;
  };
  'emulation.setTimezoneOverride': {
    params: Bidi.Emulation.SetTimezoneOverrideParameters;
    returnType: Bidi.EmptyResult;
  };

  'script.evaluate': {
    params: Bidi.Script.EvaluateParameters;
    returnType: Bidi.Script.EvaluateResult;
  };
  'script.callFunction': {
    params: Bidi.Script.CallFunctionParameters;
    returnType: Bidi.Script.EvaluateResult;
  };
  'script.disown': {
    params: Bidi.Script.DisownParameters;
    returnType: Bidi.EmptyResult;
  };
  'script.addPreloadScript': {
    params: Bidi.Script.AddPreloadScriptParameters;
    returnType: Bidi.Script.AddPreloadScriptResult;
  };
  'script.removePreloadScript': {
    params: Bidi.Script.RemovePreloadScriptParameters;
    returnType: Bidi.EmptyResult;
  };

  'session.end': {
    params: Bidi.EmptyParams;
    returnType: Bidi.EmptyResult;
  };
  'session.new': {
    params: Bidi.Session.NewParameters;
    returnType: Bidi.Session.NewResult;
  };
  'session.status': {
    params: object;
    returnType: Bidi.Session.StatusResult;
  };
  'session.subscribe': {
    params: Bidi.Session.SubscriptionRequest;
    returnType: Bidi.EmptyResult;
  };
  'session.unsubscribe': {
    params: Bidi.Session.SubscriptionRequest;
    returnType: Bidi.EmptyResult;
  };

  'storage.deleteCookies': {
    params: Bidi.Storage.DeleteCookiesParameters;
    returnType: Bidi.Storage.DeleteCookiesResult;
  };
  'storage.getCookies': {
    params: Bidi.Storage.GetCookiesParameters;
    returnType: Bidi.Storage.GetCookiesResult;
  };
  'storage.setCookie': {
    params: Bidi.Storage.SetCookieParameters;
    returnType: Bidi.Storage.SetCookieParameters;
  };

  'network.addDataCollector': {
    params: Bidi.Network.AddDataCollectorParameters;
    returnType: Bidi.Network.AddDataCollectorResult;
  };
  'network.addIntercept': {
    params: Bidi.Network.AddInterceptParameters;
    returnType: Bidi.Network.AddInterceptResult;
  };
  'network.removeIntercept': {
    params: Bidi.Network.RemoveInterceptParameters;
    returnType: Bidi.EmptyResult;
  };
  'network.continueRequest': {
    params: Bidi.Network.ContinueRequestParameters;
    returnType: Bidi.EmptyResult;
  };
  'network.continueWithAuth': {
    params: Bidi.Network.ContinueWithAuthParameters;
    returnType: Bidi.EmptyResult;
  };
  'network.failRequest': {
    params: Bidi.Network.FailRequestParameters;
    returnType: Bidi.EmptyResult;
  };
  'network.provideResponse': {
    params: Bidi.Network.ProvideResponseParameters;
    returnType: Bidi.EmptyResult;
  };
  'network.disownData': {
    params: Bidi.Network.DisownDataParameters;
    returnType: Bidi.EmptyResult;
  };
  'network.getData': {
    params: Bidi.Network.GetDataParameters;
    returnType: Bidi.Network.GetDataResult;
  };
  'network.setCacheBehavior': {
    params: Bidi.Network.SetCacheBehaviorParameters;
    returnType: Bidi.EmptyResult;
  };
  'network.setExtraHeaders': {
    params: Bidi.Network.SetExtraHeadersParameters;
    returnType: Bidi.EmptyResult;
  };

  'webExtension.install': {
    params: Bidi.WebExtension.InstallParameters;
    returnType: Bidi.WebExtension.InstallResult;
  };
  'webExtension.uninstall': {
    params: Bidi.WebExtension.UninstallParameters;
    returnType: Bidi.EmptyResult;
  };
}
