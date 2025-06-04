/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {t} = ChromeUtils.importESModule('chrome://juggler/content/protocol/PrimitiveTypes.js');

// Protocol-specific types.
const browserTypes = {};

browserTypes.TargetInfo = {
  type: t.Enum(['page']),
  targetId: t.String,
  browserContextId: t.Optional(t.String),
  // PageId of parent tab, if any.
  openerId: t.Optional(t.String),
};

browserTypes.UserPreference = {
  name: t.String,
  value: t.Any,
};

browserTypes.CookieOptions = {
  name: t.String,
  value: t.String,
  url: t.Optional(t.String),
  domain: t.Optional(t.String),
  path: t.Optional(t.String),
  secure: t.Optional(t.Boolean),
  httpOnly: t.Optional(t.Boolean),
  sameSite: t.Optional(t.Enum(['Strict', 'Lax', 'None'])),
  expires: t.Optional(t.Number),
};

browserTypes.Cookie = {
  name: t.String,
  domain: t.String,
  path: t.String,
  value: t.String,
  expires: t.Number,
  size: t.Number,
  httpOnly: t.Boolean,
  secure: t.Boolean,
  session: t.Boolean,
  sameSite: t.Enum(['Strict', 'Lax', 'None']),
};

browserTypes.Geolocation = {
  latitude: t.Number,
  longitude: t.Number,
  accuracy: t.Optional(t.Number),
};

browserTypes.DownloadOptions = {
  behavior: t.Optional(t.Enum(['saveToDisk', 'cancel'])),
  downloadsDir: t.Optional(t.String),
};

const pageTypes = {};
pageTypes.DOMPoint = {
  x: t.Number,
  y: t.Number,
};

pageTypes.Rect = {
  x: t.Number,
  y: t.Number,
  width: t.Number,
  height: t.Number,
};

pageTypes.Size = {
  width: t.Number,
  height: t.Number,
};

pageTypes.Viewport = {
  viewportSize: pageTypes.Size,
  deviceScaleFactor: t.Optional(t.Number),
};

pageTypes.DOMQuad = {
  p1: pageTypes.DOMPoint,
  p2: pageTypes.DOMPoint,
  p3: pageTypes.DOMPoint,
  p4: pageTypes.DOMPoint,
};

pageTypes.TouchPoint = {
  x: t.Number,
  y: t.Number,
  radiusX: t.Optional(t.Number),
  radiusY: t.Optional(t.Number),
  rotationAngle: t.Optional(t.Number),
  force: t.Optional(t.Number),
};

pageTypes.Clip = {
  x: t.Number,
  y: t.Number,
  width: t.Number,
  height: t.Number,
};

pageTypes.InitScript = {
  script: t.String,
  worldName: t.Optional(t.String),
};

const runtimeTypes = {};
runtimeTypes.RemoteObject = {
  type: t.Optional(t.Enum(['object', 'function', 'undefined', 'string', 'number', 'boolean', 'symbol', 'bigint'])),
  subtype: t.Optional(t.Enum(['array', 'null', 'node', 'regexp', 'date', 'map', 'set', 'weakmap', 'weakset', 'error', 'proxy', 'promise', 'typedarray'])),
  objectId: t.Optional(t.String),
  unserializableValue: t.Optional(t.Enum(['Infinity', '-Infinity', '-0', 'NaN'])),
  value: t.Any
};

runtimeTypes.ObjectProperty = {
  name: t.String,
  value: runtimeTypes.RemoteObject,
};

runtimeTypes.ScriptLocation = {
  columnNumber: t.Number,
  lineNumber: t.Number,
  url: t.String,
};

runtimeTypes.ExceptionDetails = {
  text: t.Optional(t.String),
  stack: t.Optional(t.String),
  value: t.Optional(t.Any),
};

runtimeTypes.CallFunctionArgument = {
  objectId: t.Optional(t.String),
  unserializableValue: t.Optional(t.Enum(['Infinity', '-Infinity', '-0', 'NaN'])),
  value: t.Any,
};

runtimeTypes.AuxData = {
  frameId: t.Optional(t.String),
  name: t.Optional(t.String),
};

const axTypes = {};
axTypes.AXTree = {
  role: t.String,
  name: t.String,
  children: t.Optional(t.Array(t.Recursive(axTypes, 'AXTree'))),

  selected: t.Optional(t.Boolean),
  focused: t.Optional(t.Boolean),
  pressed: t.Optional(t.Boolean),
  focusable: t.Optional(t.Boolean),
  haspopup: t.Optional(t.String),
  required: t.Optional(t.Boolean),
  invalid: t.Optional(t.Boolean),
  modal: t.Optional(t.Boolean),
  editable: t.Optional(t.Boolean),
  busy: t.Optional(t.Boolean),
  multiline: t.Optional(t.Boolean),
  readonly: t.Optional(t.Boolean),
  checked: t.Optional(t.Enum(['mixed', true])),
  expanded: t.Optional(t.Boolean),
  disabled: t.Optional(t.Boolean),
  multiselectable: t.Optional(t.Boolean),

  value: t.Optional(t.String),
  description: t.Optional(t.String),

  roledescription: t.Optional(t.String),
  valuetext: t.Optional(t.String),
  orientation: t.Optional(t.String),
  autocomplete: t.Optional(t.String),
  keyshortcuts: t.Optional(t.String),

  level: t.Optional(t.Number),

  tag: t.Optional(t.String),

  foundObject: t.Optional(t.Boolean),
}

const networkTypes = {};

networkTypes.HTTPHeader = {
  name: t.String,
  value: t.String,
};

networkTypes.HTTPCredentials = {
  username: t.String,
  password: t.String,
  origin: t.Optional(t.String),
};

networkTypes.SecurityDetails = {
  protocol: t.String,
  subjectName: t.String,
  issuer: t.String,
  validFrom: t.Number,
  validTo: t.Number,
};

networkTypes.ResourceTiming = {
  startTime: t.Number,
  domainLookupStart: t.Number,
  domainLookupEnd: t.Number,
  connectStart: t.Number,
  secureConnectionStart: t.Number,
  connectEnd: t.Number,
  requestStart: t.Number,
  responseStart: t.Number,
};

const Browser = {
  targets: ['browser'],

  types: browserTypes,

  events: {
    'attachedToTarget': {
      sessionId: t.String,
      targetInfo: browserTypes.TargetInfo,
    },
    'detachedFromTarget': {
      sessionId: t.String,
      targetId: t.String,
    },
    'downloadCreated': {
      uuid: t.String,
      browserContextId: t.Optional(t.String),
      pageTargetId: t.String,
      frameId: t.String,
      url: t.String,
      suggestedFileName: t.String,
    },
    'downloadFinished': {
      uuid: t.String,
      canceled: t.Optional(t.Boolean),
      error: t.Optional(t.String),
    },
    'videoRecordingFinished': {
      screencastId: t.String,
    },
  },

  methods: {
    'enable': {
      params: {
        attachToDefaultContext: t.Boolean,
        userPrefs: t.Optional(t.Array(browserTypes.UserPreference)),
      },
    },
    'createBrowserContext': {
      params: {
        removeOnDetach: t.Optional(t.Boolean),
      },
      returns: {
        browserContextId: t.String,
      },
    },
    'removeBrowserContext': {
      params: {
        browserContextId: t.String,
      },
    },
    'newPage': {
      params: {
        browserContextId: t.Optional(t.String),
      },
      returns: {
        targetId: t.String,
      }
    },
    'close': {},
    'getInfo': {
      returns: {
        userAgent: t.String,
        version: t.String,
      },
    },
    'setExtraHTTPHeaders': {
      params: {
        browserContextId: t.Optional(t.String),
        headers: t.Array(networkTypes.HTTPHeader),
      },
    },
    'clearCache': {},
    'setBrowserProxy': {
      params: {
        type: t.Enum(['http', 'https', 'socks', 'socks4']),
        bypass: t.Array(t.String),
        host: t.String,
        port: t.Number,
        username: t.Optional(t.String),
        password: t.Optional(t.String),
      },
    },
    'setContextProxy': {
      params: {
        browserContextId: t.Optional(t.String),
        type: t.Enum(['http', 'https', 'socks', 'socks4']),
        bypass: t.Array(t.String),
        host: t.String,
        port: t.Number,
        username: t.Optional(t.String),
        password: t.Optional(t.String),
      },
    },
    'setHTTPCredentials': {
      params: {
        browserContextId: t.Optional(t.String),
        credentials: t.Nullable(networkTypes.HTTPCredentials),
      },
    },
    'setRequestInterception': {
      params: {
        browserContextId: t.Optional(t.String),
        enabled: t.Boolean,
      },
    },
    'setCacheDisabled': {
      params: {
        browserContextId: t.Optional(t.String),
        cacheDisabled: t.Boolean,
      },
    },
    'setGeolocationOverride': {
      params: {
        browserContextId: t.Optional(t.String),
        geolocation: t.Nullable(browserTypes.Geolocation),
      }
    },
    'setUserAgentOverride': {
      params: {
        browserContextId: t.Optional(t.String),
        userAgent: t.Nullable(t.String),
      }
    },
    'setPlatformOverride': {
      params: {
        browserContextId: t.Optional(t.String),
        platform: t.Nullable(t.String),
      }
    },
    'setBypassCSP': {
      params: {
        browserContextId: t.Optional(t.String),
        bypassCSP: t.Nullable(t.Boolean),
      }
    },
    'setIgnoreHTTPSErrors': {
      params: {
        browserContextId: t.Optional(t.String),
        ignoreHTTPSErrors: t.Nullable(t.Boolean),
      }
    },
    'setJavaScriptDisabled': {
      params: {
        browserContextId: t.Optional(t.String),
        javaScriptDisabled: t.Boolean,
      }
    },
    'setLocaleOverride': {
      params: {
        browserContextId: t.Optional(t.String),
        locale: t.Nullable(t.String),
      }
    },
    'setTimezoneOverride': {
      params: {
        browserContextId: t.Optional(t.String),
        timezoneId: t.Nullable(t.String),
      }
    },
    'setDownloadOptions': {
      params: {
        browserContextId: t.Optional(t.String),
        downloadOptions: t.Nullable(browserTypes.DownloadOptions),
      }
    },
    'setTouchOverride': {
      params: {
        browserContextId: t.Optional(t.String),
        hasTouch: t.Nullable(t.Boolean),
      }
    },
    'setDefaultViewport': {
      params: {
        browserContextId: t.Optional(t.String),
        viewport: t.Nullable(pageTypes.Viewport),
      }
    },
    'setInitScripts': {
      params: {
        browserContextId: t.Optional(t.String),
        scripts: t.Array(pageTypes.InitScript),
      }
    },
    'addBinding': {
      params: {
        browserContextId: t.Optional(t.String),
        worldName: t.Optional(t.String),
        name: t.String,
        script: t.String,
      },
    },
    'grantPermissions': {
      params: {
        origin: t.String,
        browserContextId: t.Optional(t.String),
        permissions: t.Array(t.String),
      },
    },
    'resetPermissions': {
      params: {
        browserContextId: t.Optional(t.String),
      }
    },
    'setCookies': {
      params: {
        browserContextId: t.Optional(t.String),
        cookies: t.Array(browserTypes.CookieOptions),
      }
    },
    'clearCookies': {
      params: {
        browserContextId: t.Optional(t.String),
      }
    },
    'getCookies': {
      params: {
        browserContextId: t.Optional(t.String)
      },
      returns: {
        cookies: t.Array(browserTypes.Cookie),
      },
    },
    'setOnlineOverride': {
      params: {
        browserContextId: t.Optional(t.String),
        override: t.Nullable(t.Enum(['online', 'offline'])),
      }
    },
    'setColorScheme': {
      params: {
        browserContextId: t.Optional(t.String),
        colorScheme: t.Nullable(t.Enum(['dark', 'light', 'no-preference'])),
      },
    },
    'setReducedMotion': {
      params: {
        browserContextId: t.Optional(t.String),
        reducedMotion: t.Nullable(t.Enum(['reduce', 'no-preference'])),
      },
    },
    'setForcedColors': {
      params: {
        browserContextId: t.Optional(t.String),
        forcedColors: t.Nullable(t.Enum(['active', 'none'])),
      },
    },
    'setContrast': {
      params: {
        browserContextId: t.Optional(t.String),
        contrast: t.Nullable(t.Enum(['less', 'more', 'custom', 'no-preference'])),
      },
    },
    'setVideoRecordingOptions': {
      params: {
        browserContextId: t.Optional(t.String),
        options: t.Optional({
          dir: t.String,
          width: t.Number,
          height: t.Number,
        }),
      },
    },
    'cancelDownload': {
      params: {
        uuid: t.Optional(t.String),
      }
    }
  },
};

const Heap = {
  targets: ['page'],
  types: {},
  events: {},
  methods: {
    'collectGarbage': {
      params: {},
    },
  },
};

const Network = {
  targets: ['page'],
  types: networkTypes,
  events: {
    'requestWillBeSent': {
      // frameId may be absent for redirected requests.
      frameId: t.Optional(t.String),
      requestId: t.String,
      // RequestID of redirected request.
      redirectedFrom: t.Optional(t.String),
      postData: t.Optional(t.String),
      headers: t.Array(networkTypes.HTTPHeader),
      isIntercepted: t.Boolean,
      url: t.String,
      method: t.String,
      navigationId: t.Optional(t.String),
      cause: t.String,
      internalCause: t.String,
    },
    'responseReceived': {
      securityDetails: t.Nullable(networkTypes.SecurityDetails),
      requestId: t.String,
      fromCache: t.Boolean,
      remoteIPAddress: t.Optional(t.String),
      remotePort: t.Optional(t.Number),
      status: t.Number,
      statusText: t.String,
      headers: t.Array(networkTypes.HTTPHeader),
      timing: networkTypes.ResourceTiming,
      fromServiceWorker: t.Boolean,
    },
    'requestFinished': {
      requestId: t.String,
      responseEndTime: t.Number,
      transferSize: t.Number,
      encodedBodySize: t.Number,
      protocolVersion: t.Optional(t.String),
    },
    'requestFailed': {
      requestId: t.String,
      errorCode: t.String,
    },
  },
  methods: {
    'setRequestInterception': {
      params: {
        enabled: t.Boolean,
      },
    },
    'setExtraHTTPHeaders': {
      params: {
        headers: t.Array(networkTypes.HTTPHeader),
      },
    },
    'abortInterceptedRequest': {
      params: {
        requestId: t.String,
        errorCode: t.String,
      },
    },
    'resumeInterceptedRequest': {
      params: {
        requestId: t.String,
        url: t.Optional(t.String),
        method: t.Optional(t.String),
        headers: t.Optional(t.Array(networkTypes.HTTPHeader)),
        postData: t.Optional(t.String),
      },
    },
    'fulfillInterceptedRequest': {
      params: {
        requestId: t.String,
        status: t.Number,
        statusText: t.String,
        headers: t.Array(networkTypes.HTTPHeader),
        base64body: t.Optional(t.String),  // base64-encoded
      },
    },
    'getResponseBody': {
      params: {
        requestId: t.String,
      },
      returns: {
        base64body: t.String,
        evicted: t.Optional(t.Boolean),
      },
    },
  },
};

const Runtime = {
  targets: ['page'],
  types: runtimeTypes,
  events: {
    'executionContextCreated': {
      executionContextId: t.String,
      auxData: runtimeTypes.AuxData,
    },
    'executionContextDestroyed': {
      executionContextId: t.String,
    },
    'executionContextsCleared': {
    },
    'console': {
      executionContextId: t.String,
      args: t.Array(runtimeTypes.RemoteObject),
      type: t.String,
      location: runtimeTypes.ScriptLocation,
    },
  },
  methods: {
    'evaluate': {
      params: {
        // Pass frameId here.
        executionContextId: t.String,
        expression: t.String,
        returnByValue: t.Optional(t.Boolean),
      },

      returns: {
        result: t.Optional(runtimeTypes.RemoteObject),
        exceptionDetails: t.Optional(runtimeTypes.ExceptionDetails),
      }
    },
    'callFunction': {
      params: {
        // Pass frameId here.
        executionContextId: t.String,
        functionDeclaration: t.String,
        returnByValue: t.Optional(t.Boolean),
        args: t.Array(runtimeTypes.CallFunctionArgument),
      },

      returns: {
        result: t.Optional(runtimeTypes.RemoteObject),
        exceptionDetails: t.Optional(runtimeTypes.ExceptionDetails),
      }
    },
    'disposeObject': {
      params: {
        executionContextId: t.String,
        objectId: t.String,
      },
    },

    'getObjectProperties': {
      params: {
        executionContextId: t.String,
        objectId: t.String,
      },

      returns: {
        properties: t.Array(runtimeTypes.ObjectProperty),
      }
    },
  },
};

const Page = {
  targets: ['page'],

  types: pageTypes,
  events: {
    'ready': {
    },
    'crashed': {
    },
    'eventFired': {
      frameId: t.String,
      name: t.Enum(['load', 'DOMContentLoaded']),
    },
    'uncaughtError': {
      frameId: t.String,
      message: t.String,
      stack: t.String,
    },
    'frameAttached': {
      frameId: t.String,
      parentFrameId: t.Optional(t.String),
    },
    'frameDetached': {
      frameId: t.String,
    },
    'navigationStarted': {
      frameId: t.String,
      navigationId: t.String,
    },
    'navigationCommitted': {
      frameId: t.String,
      // |navigationId| can only be null in response to enable.
      navigationId: t.Optional(t.String),
      url: t.String,
      // frame.id or frame.name
      name: t.String,
    },
    'navigationAborted': {
      frameId: t.String,
      navigationId: t.String,
      errorText: t.String,
    },
    'sameDocumentNavigation': {
      frameId: t.String,
      url: t.String,
    },
    'dialogOpened': {
      dialogId: t.String,
      type: t.Enum(['prompt', 'alert', 'confirm', 'beforeunload']),
      message: t.String,
      defaultValue: t.Optional(t.String),
    },
    'dialogClosed': {
      dialogId: t.String,
    },
    'bindingCalled': {
      executionContextId: t.String,
      name: t.String,
      payload: t.Any,
    },
    'linkClicked': {
      phase: t.Enum(['before', 'after']),
    },
    'willOpenNewWindowAsynchronously': {},
    'fileChooserOpened': {
      executionContextId: t.String,
      element: runtimeTypes.RemoteObject
    },
    'workerCreated': {
      workerId: t.String,
      frameId: t.String,
      url: t.String,
    },
    'workerDestroyed': {
      workerId: t.String,
    },
    'dispatchMessageFromWorker': {
      workerId: t.String,
      message: t.String,
    },
    'videoRecordingStarted': {
      screencastId: t.String,
      file: t.String,
    },
    'webSocketCreated': {
      frameId: t.String,
      wsid: t.String,
      requestURL: t.String,
    },
    'webSocketOpened': {
      frameId: t.String,
      requestId: t.String,
      wsid: t.String,
      effectiveURL: t.String,
    },
    'webSocketClosed': {
      frameId: t.String,
      wsid: t.String,
      error: t.String,
    },
    'webSocketFrameSent': {
      frameId: t.String,
      wsid: t.String,
      opcode: t.Number,
      data: t.String,
    },
    'webSocketFrameReceived': {
      frameId: t.String,
      wsid: t.String,
      opcode: t.Number,
      data: t.String,
    },
    'screencastFrame': {
      data: t.String,
      deviceWidth: t.Number,
      deviceHeight: t.Number,
    },
  },

  methods: {
    'close': {
      params: {
        runBeforeUnload: t.Optional(t.Boolean),
      },
    },
    'setFileInputFiles': {
      params: {
        frameId: t.String,
        objectId: t.String,
        files: t.Array(t.String),
      },
    },
    'addBinding': {
      params: {
        worldName: t.Optional(t.String),
        name: t.String,
        script: t.String,
      },
    },
    'setViewportSize': {
      params: {
        viewportSize: t.Nullable(pageTypes.Size),
      },
    },
    'setZoom': {
      params: {
        zoom: t.Number,
      },
    },
    'bringToFront': {
      params: {
      },
    },
    'setEmulatedMedia': {
      params: {
        type: t.Optional(t.Enum(['screen', 'print', ''])),
        colorScheme: t.Optional(t.Enum(['dark', 'light', 'no-preference'])),
        reducedMotion: t.Optional(t.Enum(['reduce', 'no-preference'])),
        forcedColors: t.Optional(t.Enum(['active', 'none'])),
        contrast: t.Optional(t.Enum(['less', 'more', 'custom', 'no-preference'])),
      },
    },
    'setCacheDisabled': {
      params: {
        cacheDisabled: t.Boolean,
      },
    },
    'describeNode': {
      params: {
        frameId: t.String,
        objectId: t.String,
      },
      returns: {
        contentFrameId: t.Optional(t.String),
        ownerFrameId: t.Optional(t.String),
      },
    },
    'scrollIntoViewIfNeeded': {
      params: {
        frameId: t.String,
        objectId: t.String,
        rect: t.Optional(pageTypes.Rect),
      },
    },
    'setInitScripts': {
      params: {
        scripts: t.Array(pageTypes.InitScript)
      }
    },
    'navigate': {
      params: {
        frameId: t.String,
        url: t.String,
        referer: t.Optional(t.String),
      },
      returns: {
        navigationId: t.Nullable(t.String),
      }
    },
    'goBack': {
      params: {
        frameId: t.String,
      },
      returns: {
        success: t.Boolean,
      },
    },
    'goForward': {
      params: {
        frameId: t.String,
      },
      returns: {
        success: t.Boolean,
      },
    },
    'reload': {
      params: { },
    },
    'adoptNode': {
      params: {
        frameId: t.String,
        // Missing objectId adopts frame owner.
        objectId: t.Optional(t.String),
        executionContextId: t.String,
      },
      returns: {
        remoteObject: t.Nullable(runtimeTypes.RemoteObject),
      },
    },
    'screenshot': {
      params: {
        mimeType: t.Enum(['image/png', 'image/jpeg']),
        clip: pageTypes.Clip,
        quality: t.Optional(t.Number),
        omitDeviceScaleFactor: t.Optional(t.Boolean),
      },
      returns: {
        data: t.String,
      }
    },
    'getContentQuads': {
      params: {
        frameId: t.String,
        objectId: t.String,
      },
      returns: {
        quads: t.Array(pageTypes.DOMQuad),
      },
    },
    'dispatchKeyEvent': {
      params: {
        type: t.String,
        key: t.String,
        keyCode: t.Number,
        location: t.Number,
        code: t.String,
        repeat: t.Boolean,
        text: t.Optional(t.String),
      }
    },
    'dispatchTouchEvent': {
      params: {
        type: t.Enum(['touchStart', 'touchEnd', 'touchMove', 'touchCancel']),
        touchPoints: t.Array(pageTypes.TouchPoint),
        modifiers: t.Number,
      },
      returns: {
        defaultPrevented: t.Boolean,
      }
    },
    'dispatchTapEvent': {
      params: {
        x: t.Number,
        y: t.Number,
        modifiers: t.Number,
      }
    },
    'dispatchMouseEvent': {
      params: {
        type: t.Enum(['mousedown', 'mousemove', 'mouseup']),
        button: t.Number,
        x: t.Number,
        y: t.Number,
        modifiers: t.Number,
        clickCount: t.Optional(t.Number),
        buttons: t.Number,
      }
    },
    'dispatchWheelEvent': {
      params: {
        x: t.Number,
        y: t.Number,
        deltaX: t.Number,
        deltaY: t.Number,
        deltaZ: t.Number,
        modifiers: t.Number,
      }
    },
    'insertText': {
      params: {
        text: t.String,
      }
    },
    'crash': {
      params: {}
    },
    'handleDialog': {
      params: {
        dialogId: t.String,
        accept: t.Boolean,
        promptText: t.Optional(t.String),
      },
    },
    'setInterceptFileChooserDialog': {
      params: {
        enabled: t.Boolean,
      },
    },
    'sendMessageToWorker': {
      params: {
        frameId: t.String,
        workerId: t.String,
        message: t.String,
      },
    },
    'startScreencast': {
      params: {
        width: t.Number,
        height: t.Number,
        quality: t.Number,
      },
      returns: {
        screencastId: t.String,
      },
    },
    'screencastFrameAck': {
      params: {
        screencastId: t.String,
      },
    },
    'stopScreencast': {
    },
  },
};


const Accessibility = {
  targets: ['page'],
  types: axTypes,
  events: {},
  methods: {
    'getFullAXTree': {
      params: {
        objectId: t.Optional(t.String),
      },
      returns: {
        tree: axTypes.AXTree
      },
    }
  }
}

export const protocol = {
  domains: {Browser, Heap, Page, Runtime, Network, Accessibility},
};
