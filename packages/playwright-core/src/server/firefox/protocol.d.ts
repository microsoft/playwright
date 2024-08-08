// This is generated from /utils/protocol-types-generator/index.js
export module Protocol {

  export module Browser {
    export type TargetInfo = {
      type: ("page");
      targetId: string;
      browserContextId?: string;
      openerId?: string;
    };
    export type UserPreference = {
      name: string;
      value: any;
    };
    export type CookieOptions = {
      name: string;
      value: string;
      url?: string;
      domain?: string;
      path?: string;
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: ("Strict"|"Lax"|"None");
      expires?: number;
    };
    export type Cookie = {
      name: string;
      domain: string;
      path: string;
      value: string;
      expires: number;
      size: number;
      httpOnly: boolean;
      secure: boolean;
      session: boolean;
      sameSite: ("Strict"|"Lax"|"None");
    };
    export type Geolocation = {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };
    export type DownloadOptions = {
      behavior?: ("saveToDisk"|"cancel");
      downloadsDir?: string;
    };
    export type attachedToTargetPayload = {
      sessionId: string;
      targetInfo: {
        type: ("page");
        targetId: string;
        browserContextId?: string;
        openerId?: string;
      };
    }
    export type detachedFromTargetPayload = {
      sessionId: string;
      targetId: string;
    }
    export type downloadCreatedPayload = {
      uuid: string;
      browserContextId?: string;
      pageTargetId: string;
      frameId: string;
      url: string;
      suggestedFileName: string;
    }
    export type downloadFinishedPayload = {
      uuid: string;
      canceled?: boolean;
      error?: string;
    }
    export type videoRecordingFinishedPayload = {
      screencastId: string;
    }
    export type enableParameters = {
      attachToDefaultContext: boolean;
      userPrefs?: {
        name: string;
        value: any;
      }[];
    };
    export type enableReturnValue = void;
    export type createBrowserContextParameters = {
      removeOnDetach?: boolean;
    };
    export type createBrowserContextReturnValue = {
      browserContextId: string;
    };
    export type removeBrowserContextParameters = {
      browserContextId: string;
    };
    export type removeBrowserContextReturnValue = void;
    export type newPageParameters = {
      browserContextId?: string;
    };
    export type newPageReturnValue = {
      targetId: string;
    };
    export type closeParameters = void;
    export type closeReturnValue = void;
    export type getInfoParameters = void;
    export type getInfoReturnValue = {
      userAgent: string;
      version: string;
    };
    export type setExtraHTTPHeadersParameters = {
      browserContextId?: string;
      headers: {
        name: string;
        value: string;
      }[];
    };
    export type setExtraHTTPHeadersReturnValue = void;
    export type clearCacheParameters = void;
    export type clearCacheReturnValue = void;
    export type setBrowserProxyParameters = {
      type: ("http"|"https"|"socks"|"socks4");
      bypass: string[];
      host: string;
      port: number;
      username?: string;
      password?: string;
    };
    export type setBrowserProxyReturnValue = void;
    export type setContextProxyParameters = {
      browserContextId?: string;
      type: ("http"|"https"|"socks"|"socks4");
      bypass: string[];
      host: string;
      port: number;
      username?: string;
      password?: string;
    };
    export type setContextProxyReturnValue = void;
    export type setHTTPCredentialsParameters = {
      browserContextId?: string;
      credentials: {
        username: string;
        password: string;
        origin?: string;
      }|null;
    };
    export type setHTTPCredentialsReturnValue = void;
    export type setRequestInterceptionParameters = {
      browserContextId?: string;
      enabled: boolean;
    };
    export type setRequestInterceptionReturnValue = void;
    export type setCacheDisabledParameters = {
      browserContextId?: string;
      cacheDisabled: boolean;
    };
    export type setCacheDisabledReturnValue = void;
    export type setGeolocationOverrideParameters = {
      browserContextId?: string;
      geolocation: {
        latitude: number;
        longitude: number;
        accuracy?: number;
      }|null;
    };
    export type setGeolocationOverrideReturnValue = void;
    export type setUserAgentOverrideParameters = {
      browserContextId?: string;
      userAgent: string|null;
    };
    export type setUserAgentOverrideReturnValue = void;
    export type setPlatformOverrideParameters = {
      browserContextId?: string;
      platform: string|null;
    };
    export type setPlatformOverrideReturnValue = void;
    export type setBypassCSPParameters = {
      browserContextId?: string;
      bypassCSP: boolean|null;
    };
    export type setBypassCSPReturnValue = void;
    export type setIgnoreHTTPSErrorsParameters = {
      browserContextId?: string;
      ignoreHTTPSErrors: boolean|null;
    };
    export type setIgnoreHTTPSErrorsReturnValue = void;
    export type setJavaScriptDisabledParameters = {
      browserContextId?: string;
      javaScriptDisabled: boolean;
    };
    export type setJavaScriptDisabledReturnValue = void;
    export type setLocaleOverrideParameters = {
      browserContextId?: string;
      locale: string|null;
    };
    export type setLocaleOverrideReturnValue = void;
    export type setTimezoneOverrideParameters = {
      browserContextId?: string;
      timezoneId: string|null;
    };
    export type setTimezoneOverrideReturnValue = void;
    export type setDownloadOptionsParameters = {
      browserContextId?: string;
      downloadOptions: {
        behavior?: ("saveToDisk"|"cancel");
        downloadsDir?: string;
      }|null;
    };
    export type setDownloadOptionsReturnValue = void;
    export type setTouchOverrideParameters = {
      browserContextId?: string;
      hasTouch: boolean|null;
    };
    export type setTouchOverrideReturnValue = void;
    export type setDefaultViewportParameters = {
      browserContextId?: string;
      viewport: {
        viewportSize: {
          width: number;
          height: number;
        };
        deviceScaleFactor?: number;
      }|null;
    };
    export type setDefaultViewportReturnValue = void;
    export type setInitScriptsParameters = {
      browserContextId?: string;
      scripts: {
        script: string;
        worldName?: string;
      }[];
    };
    export type setInitScriptsReturnValue = void;
    export type addBindingParameters = {
      browserContextId?: string;
      worldName?: string;
      name: string;
      script: string;
    };
    export type addBindingReturnValue = void;
    export type grantPermissionsParameters = {
      origin: string;
      browserContextId?: string;
      permissions: string[];
    };
    export type grantPermissionsReturnValue = void;
    export type resetPermissionsParameters = {
      browserContextId?: string;
    };
    export type resetPermissionsReturnValue = void;
    export type setCookiesParameters = {
      browserContextId?: string;
      cookies: {
        name: string;
        value: string;
        url?: string;
        domain?: string;
        path?: string;
        secure?: boolean;
        httpOnly?: boolean;
        sameSite?: ("Strict"|"Lax"|"None");
        expires?: number;
      }[];
    };
    export type setCookiesReturnValue = void;
    export type clearCookiesParameters = {
      browserContextId?: string;
    };
    export type clearCookiesReturnValue = void;
    export type getCookiesParameters = {
      browserContextId?: string;
    };
    export type getCookiesReturnValue = {
      cookies: {
        name: string;
        domain: string;
        path: string;
        value: string;
        expires: number;
        size: number;
        httpOnly: boolean;
        secure: boolean;
        session: boolean;
        sameSite: ("Strict"|"Lax"|"None");
      }[];
    };
    export type setOnlineOverrideParameters = {
      browserContextId?: string;
      override: ("online"|"offline")|null;
    };
    export type setOnlineOverrideReturnValue = void;
    export type setColorSchemeParameters = {
      browserContextId?: string;
      colorScheme: ("dark"|"light"|"no-preference")|null;
    };
    export type setColorSchemeReturnValue = void;
    export type setReducedMotionParameters = {
      browserContextId?: string;
      reducedMotion: ("reduce"|"no-preference")|null;
    };
    export type setReducedMotionReturnValue = void;
    export type setForcedColorsParameters = {
      browserContextId?: string;
      forcedColors: ("active"|"none")|null;
    };
    export type setForcedColorsReturnValue = void;
    export type setVideoRecordingOptionsParameters = {
      browserContextId?: string;
      options?: {
        dir: string;
        width: number;
        height: number;
      };
    };
    export type setVideoRecordingOptionsReturnValue = void;
    export type cancelDownloadParameters = {
      uuid?: string;
    };
    export type cancelDownloadReturnValue = void;
  }
  export module Page {
    export type DOMPoint = {
      x: number;
      y: number;
    };
    export type Rect = {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    export type Size = {
      width: number;
      height: number;
    };
    export type Viewport = {
      viewportSize: {
        width: number;
        height: number;
      };
      deviceScaleFactor?: number;
    };
    export type DOMQuad = {
      p1: {
        x: number;
        y: number;
      };
      p2: {
        x: number;
        y: number;
      };
      p3: {
        x: number;
        y: number;
      };
      p4: {
        x: number;
        y: number;
      };
    };
    export type TouchPoint = {
      x: number;
      y: number;
      radiusX?: number;
      radiusY?: number;
      rotationAngle?: number;
      force?: number;
    };
    export type Clip = {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    export type InitScript = {
      script: string;
      worldName?: string;
    };
    export type readyPayload = {
    }
    export type crashedPayload = {
    }
    export type eventFiredPayload = {
      frameId: string;
      name: ("load"|"DOMContentLoaded");
    }
    export type uncaughtErrorPayload = {
      frameId: string;
      message: string;
      stack: string;
    }
    export type frameAttachedPayload = {
      frameId: string;
      parentFrameId?: string;
    }
    export type frameDetachedPayload = {
      frameId: string;
    }
    export type navigationStartedPayload = {
      frameId: string;
      navigationId: string;
    }
    export type navigationCommittedPayload = {
      frameId: string;
      navigationId?: string;
      url: string;
      name: string;
    }
    export type navigationAbortedPayload = {
      frameId: string;
      navigationId: string;
      errorText: string;
    }
    export type sameDocumentNavigationPayload = {
      frameId: string;
      url: string;
    }
    export type dialogOpenedPayload = {
      dialogId: string;
      type: ("prompt"|"alert"|"confirm"|"beforeunload");
      message: string;
      defaultValue?: string;
    }
    export type dialogClosedPayload = {
      dialogId: string;
    }
    export type bindingCalledPayload = {
      executionContextId: string;
      name: string;
      payload: any;
    }
    export type linkClickedPayload = {
      phase: ("before"|"after");
    }
    export type willOpenNewWindowAsynchronouslyPayload = {
    }
    export type fileChooserOpenedPayload = {
      executionContextId: string;
      element: {
        type?: ("object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint");
        subtype?: ("array"|"null"|"node"|"regexp"|"date"|"map"|"set"|"weakmap"|"weakset"|"error"|"proxy"|"promise"|"typedarray");
        objectId?: string;
        unserializableValue?: ("Infinity"|"-Infinity"|"-0"|"NaN");
        value: any;
      };
    }
    export type workerCreatedPayload = {
      workerId: string;
      frameId: string;
      url: string;
    }
    export type workerDestroyedPayload = {
      workerId: string;
    }
    export type dispatchMessageFromWorkerPayload = {
      workerId: string;
      message: string;
    }
    export type videoRecordingStartedPayload = {
      screencastId: string;
      file: string;
    }
    export type webSocketCreatedPayload = {
      frameId: string;
      wsid: string;
      requestURL: string;
    }
    export type webSocketOpenedPayload = {
      frameId: string;
      requestId: string;
      wsid: string;
      effectiveURL: string;
    }
    export type webSocketClosedPayload = {
      frameId: string;
      wsid: string;
      error: string;
    }
    export type webSocketFrameSentPayload = {
      frameId: string;
      wsid: string;
      opcode: number;
      data: string;
    }
    export type webSocketFrameReceivedPayload = {
      frameId: string;
      wsid: string;
      opcode: number;
      data: string;
    }
    export type screencastFramePayload = {
      data: string;
      deviceWidth: number;
      deviceHeight: number;
    }
    export type closeParameters = {
      runBeforeUnload?: boolean;
    };
    export type closeReturnValue = void;
    export type setFileInputFilesParameters = {
      frameId: string;
      objectId: string;
      files: string[];
    };
    export type setFileInputFilesReturnValue = void;
    export type addBindingParameters = {
      worldName?: string;
      name: string;
      script: string;
    };
    export type addBindingReturnValue = void;
    export type setViewportSizeParameters = {
      viewportSize: {
        width: number;
        height: number;
      }|null;
    };
    export type setViewportSizeReturnValue = void;
    export type bringToFrontParameters = {
    };
    export type bringToFrontReturnValue = void;
    export type setEmulatedMediaParameters = {
      type?: ("screen"|"print"|"");
      colorScheme?: ("dark"|"light"|"no-preference");
      reducedMotion?: ("reduce"|"no-preference");
      forcedColors?: ("active"|"none");
    };
    export type setEmulatedMediaReturnValue = void;
    export type setCacheDisabledParameters = {
      cacheDisabled: boolean;
    };
    export type setCacheDisabledReturnValue = void;
    export type describeNodeParameters = {
      frameId: string;
      objectId: string;
    };
    export type describeNodeReturnValue = {
      contentFrameId?: string;
      ownerFrameId?: string;
    };
    export type scrollIntoViewIfNeededParameters = {
      frameId: string;
      objectId: string;
      rect?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
    export type scrollIntoViewIfNeededReturnValue = void;
    export type setInitScriptsParameters = {
      scripts: {
        script: string;
        worldName?: string;
      }[];
    };
    export type setInitScriptsReturnValue = void;
    export type navigateParameters = {
      frameId: string;
      url: string;
      referer?: string;
    };
    export type navigateReturnValue = {
      navigationId: string|null;
    };
    export type goBackParameters = {
      frameId: string;
    };
    export type goBackReturnValue = {
      success: boolean;
    };
    export type goForwardParameters = {
      frameId: string;
    };
    export type goForwardReturnValue = {
      success: boolean;
    };
    export type reloadParameters = {
    };
    export type reloadReturnValue = void;
    export type adoptNodeParameters = {
      frameId: string;
      objectId?: string;
      executionContextId: string;
    };
    export type adoptNodeReturnValue = {
      remoteObject: {
        type?: ("object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint");
        subtype?: ("array"|"null"|"node"|"regexp"|"date"|"map"|"set"|"weakmap"|"weakset"|"error"|"proxy"|"promise"|"typedarray");
        objectId?: string;
        unserializableValue?: ("Infinity"|"-Infinity"|"-0"|"NaN");
        value: any;
      }|null;
    };
    export type screenshotParameters = {
      mimeType: ("image/png"|"image/jpeg");
      clip: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      quality?: number;
      omitDeviceScaleFactor?: boolean;
    };
    export type screenshotReturnValue = {
      data: string;
    };
    export type getContentQuadsParameters = {
      frameId: string;
      objectId: string;
    };
    export type getContentQuadsReturnValue = {
      quads: {
        p1: {
          x: number;
          y: number;
        };
        p2: {
          x: number;
          y: number;
        };
        p3: {
          x: number;
          y: number;
        };
        p4: {
          x: number;
          y: number;
        };
      }[];
    };
    export type dispatchKeyEventParameters = {
      type: string;
      key: string;
      keyCode: number;
      location: number;
      code: string;
      repeat: boolean;
      text?: string;
    };
    export type dispatchKeyEventReturnValue = void;
    export type dispatchTouchEventParameters = {
      type: ("touchStart"|"touchEnd"|"touchMove"|"touchCancel");
      touchPoints: {
        x: number;
        y: number;
        radiusX?: number;
        radiusY?: number;
        rotationAngle?: number;
        force?: number;
      }[];
      modifiers: number;
    };
    export type dispatchTouchEventReturnValue = {
      defaultPrevented: boolean;
    };
    export type dispatchTapEventParameters = {
      x: number;
      y: number;
      modifiers: number;
    };
    export type dispatchTapEventReturnValue = void;
    export type dispatchMouseEventParameters = {
      type: ("mousedown"|"mousemove"|"mouseup");
      button: number;
      x: number;
      y: number;
      modifiers: number;
      clickCount?: number;
      buttons: number;
    };
    export type dispatchMouseEventReturnValue = void;
    export type dispatchWheelEventParameters = {
      x: number;
      y: number;
      deltaX: number;
      deltaY: number;
      deltaZ: number;
      modifiers: number;
    };
    export type dispatchWheelEventReturnValue = void;
    export type insertTextParameters = {
      text: string;
    };
    export type insertTextReturnValue = void;
    export type crashParameters = {
    };
    export type crashReturnValue = void;
    export type handleDialogParameters = {
      dialogId: string;
      accept: boolean;
      promptText?: string;
    };
    export type handleDialogReturnValue = void;
    export type setInterceptFileChooserDialogParameters = {
      enabled: boolean;
    };
    export type setInterceptFileChooserDialogReturnValue = void;
    export type sendMessageToWorkerParameters = {
      frameId: string;
      workerId: string;
      message: string;
    };
    export type sendMessageToWorkerReturnValue = void;
    export type startScreencastParameters = {
      width: number;
      height: number;
      quality: number;
    };
    export type startScreencastReturnValue = {
      screencastId: string;
    };
    export type screencastFrameAckParameters = {
      screencastId: string;
    };
    export type screencastFrameAckReturnValue = void;
    export type stopScreencastParameters = void;
    export type stopScreencastReturnValue = void;
  }
  export module Runtime {
    export type RemoteObject = {
      type?: ("object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint");
      subtype?: ("array"|"null"|"node"|"regexp"|"date"|"map"|"set"|"weakmap"|"weakset"|"error"|"proxy"|"promise"|"typedarray");
      objectId?: string;
      unserializableValue?: ("Infinity"|"-Infinity"|"-0"|"NaN");
      value: any;
    };
    export type ObjectProperty = {
      name: string;
      value: {
        type?: ("object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint");
        subtype?: ("array"|"null"|"node"|"regexp"|"date"|"map"|"set"|"weakmap"|"weakset"|"error"|"proxy"|"promise"|"typedarray");
        objectId?: string;
        unserializableValue?: ("Infinity"|"-Infinity"|"-0"|"NaN");
        value: any;
      };
    };
    export type ScriptLocation = {
      columnNumber: number;
      lineNumber: number;
      url: string;
    };
    export type ExceptionDetails = {
      text?: string;
      stack?: string;
      value?: any;
    };
    export type CallFunctionArgument = {
      objectId?: string;
      unserializableValue?: ("Infinity"|"-Infinity"|"-0"|"NaN");
      value: any;
    };
    export type AuxData = {
      frameId?: string;
      name?: string;
    };
    export type executionContextCreatedPayload = {
      executionContextId: string;
      auxData: {
        frameId?: string;
        name?: string;
      };
    }
    export type executionContextDestroyedPayload = {
      executionContextId: string;
    }
    export type executionContextsClearedPayload = {
    }
    export type consolePayload = {
      executionContextId: string;
      args: {
        type?: ("object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint");
        subtype?: ("array"|"null"|"node"|"regexp"|"date"|"map"|"set"|"weakmap"|"weakset"|"error"|"proxy"|"promise"|"typedarray");
        objectId?: string;
        unserializableValue?: ("Infinity"|"-Infinity"|"-0"|"NaN");
        value: any;
      }[];
      type: string;
      location: {
        columnNumber: number;
        lineNumber: number;
        url: string;
      };
    }
    export type evaluateParameters = {
      executionContextId: string;
      expression: string;
      returnByValue?: boolean;
    };
    export type evaluateReturnValue = {
      result?: {
        type?: ("object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint");
        subtype?: ("array"|"null"|"node"|"regexp"|"date"|"map"|"set"|"weakmap"|"weakset"|"error"|"proxy"|"promise"|"typedarray");
        objectId?: string;
        unserializableValue?: ("Infinity"|"-Infinity"|"-0"|"NaN");
        value: any;
      };
      exceptionDetails?: {
        text?: string;
        stack?: string;
        value?: any;
      };
    };
    export type callFunctionParameters = {
      executionContextId: string;
      functionDeclaration: string;
      returnByValue?: boolean;
      args: {
        objectId?: string;
        unserializableValue?: ("Infinity"|"-Infinity"|"-0"|"NaN");
        value: any;
      }[];
    };
    export type callFunctionReturnValue = {
      result?: {
        type?: ("object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint");
        subtype?: ("array"|"null"|"node"|"regexp"|"date"|"map"|"set"|"weakmap"|"weakset"|"error"|"proxy"|"promise"|"typedarray");
        objectId?: string;
        unserializableValue?: ("Infinity"|"-Infinity"|"-0"|"NaN");
        value: any;
      };
      exceptionDetails?: {
        text?: string;
        stack?: string;
        value?: any;
      };
    };
    export type disposeObjectParameters = {
      executionContextId: string;
      objectId: string;
    };
    export type disposeObjectReturnValue = void;
    export type getObjectPropertiesParameters = {
      executionContextId: string;
      objectId: string;
    };
    export type getObjectPropertiesReturnValue = {
      properties: {
        name: string;
        value: {
          type?: ("object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint");
          subtype?: ("array"|"null"|"node"|"regexp"|"date"|"map"|"set"|"weakmap"|"weakset"|"error"|"proxy"|"promise"|"typedarray");
          objectId?: string;
          unserializableValue?: ("Infinity"|"-Infinity"|"-0"|"NaN");
          value: any;
        };
      }[];
    };
  }
  export module Network {
    export type HTTPHeader = {
      name: string;
      value: string;
    };
    export type HTTPCredentials = {
      username: string;
      password: string;
      origin?: string;
    };
    export type SecurityDetails = {
      protocol: string;
      subjectName: string;
      issuer: string;
      validFrom: number;
      validTo: number;
    };
    export type ResourceTiming = {
      startTime: number;
      domainLookupStart: number;
      domainLookupEnd: number;
      connectStart: number;
      secureConnectionStart: number;
      connectEnd: number;
      requestStart: number;
      responseStart: number;
    };
    export type requestWillBeSentPayload = {
      frameId?: string;
      requestId: string;
      redirectedFrom?: string;
      postData?: string;
      headers: {
        name: string;
        value: string;
      }[];
      isIntercepted: boolean;
      url: string;
      method: string;
      navigationId?: string;
      cause: string;
      internalCause: string;
    }
    export type responseReceivedPayload = {
      securityDetails: {
        protocol: string;
        subjectName: string;
        issuer: string;
        validFrom: number;
        validTo: number;
      }|null;
      requestId: string;
      fromCache: boolean;
      remoteIPAddress?: string;
      remotePort?: number;
      status: number;
      statusText: string;
      headers: {
        name: string;
        value: string;
      }[];
      timing: {
        startTime: number;
        domainLookupStart: number;
        domainLookupEnd: number;
        connectStart: number;
        secureConnectionStart: number;
        connectEnd: number;
        requestStart: number;
        responseStart: number;
      };
      fromServiceWorker: boolean;
    }
    export type requestFinishedPayload = {
      requestId: string;
      responseEndTime: number;
      transferSize: number;
      encodedBodySize: number;
      protocolVersion?: string;
    }
    export type requestFailedPayload = {
      requestId: string;
      errorCode: string;
    }
    export type setRequestInterceptionParameters = {
      enabled: boolean;
    };
    export type setRequestInterceptionReturnValue = void;
    export type setExtraHTTPHeadersParameters = {
      headers: {
        name: string;
        value: string;
      }[];
    };
    export type setExtraHTTPHeadersReturnValue = void;
    export type abortInterceptedRequestParameters = {
      requestId: string;
      errorCode: string;
    };
    export type abortInterceptedRequestReturnValue = void;
    export type resumeInterceptedRequestParameters = {
      requestId: string;
      url?: string;
      method?: string;
      headers?: {
        name: string;
        value: string;
      }[];
      postData?: string;
    };
    export type resumeInterceptedRequestReturnValue = void;
    export type fulfillInterceptedRequestParameters = {
      requestId: string;
      status: number;
      statusText: string;
      headers: {
        name: string;
        value: string;
      }[];
      base64body?: string;
    };
    export type fulfillInterceptedRequestReturnValue = void;
    export type getResponseBodyParameters = {
      requestId: string;
    };
    export type getResponseBodyReturnValue = {
      base64body: string;
      evicted?: boolean;
    };
  }
  export module Accessibility {
    export type AXTree = {
      role: string;
      name: string;
      children?: AXTree[];
      selected?: boolean;
      focused?: boolean;
      pressed?: boolean;
      focusable?: boolean;
      haspopup?: string;
      required?: boolean;
      invalid?: boolean;
      modal?: boolean;
      editable?: boolean;
      busy?: boolean;
      multiline?: boolean;
      readonly?: boolean;
      checked?: ("mixed"|true);
      expanded?: boolean;
      disabled?: boolean;
      multiselectable?: boolean;
      value?: string;
      description?: string;
      roledescription?: string;
      valuetext?: string;
      orientation?: string;
      autocomplete?: string;
      keyshortcuts?: string;
      level?: number;
      tag?: string;
      foundObject?: boolean;
    };
    export type getFullAXTreeParameters = {
      objectId?: string;
    };
    export type getFullAXTreeReturnValue = {
      tree: {
        role: string;
        name: string;
        children?: AXTree[];
        selected?: boolean;
        focused?: boolean;
        pressed?: boolean;
        focusable?: boolean;
        haspopup?: string;
        required?: boolean;
        invalid?: boolean;
        modal?: boolean;
        editable?: boolean;
        busy?: boolean;
        multiline?: boolean;
        readonly?: boolean;
        checked?: ("mixed"|true);
        expanded?: boolean;
        disabled?: boolean;
        multiselectable?: boolean;
        value?: string;
        description?: string;
        roledescription?: string;
        valuetext?: string;
        orientation?: string;
        autocomplete?: string;
        keyshortcuts?: string;
        level?: number;
        tag?: string;
        foundObject?: boolean;
      };
    };
  }
  export interface Events {
    "Browser.attachedToTarget": Browser.attachedToTargetPayload;
    "Browser.detachedFromTarget": Browser.detachedFromTargetPayload;
    "Browser.downloadCreated": Browser.downloadCreatedPayload;
    "Browser.downloadFinished": Browser.downloadFinishedPayload;
    "Browser.videoRecordingFinished": Browser.videoRecordingFinishedPayload;
    "Page.ready": Page.readyPayload;
    "Page.crashed": Page.crashedPayload;
    "Page.eventFired": Page.eventFiredPayload;
    "Page.uncaughtError": Page.uncaughtErrorPayload;
    "Page.frameAttached": Page.frameAttachedPayload;
    "Page.frameDetached": Page.frameDetachedPayload;
    "Page.navigationStarted": Page.navigationStartedPayload;
    "Page.navigationCommitted": Page.navigationCommittedPayload;
    "Page.navigationAborted": Page.navigationAbortedPayload;
    "Page.sameDocumentNavigation": Page.sameDocumentNavigationPayload;
    "Page.dialogOpened": Page.dialogOpenedPayload;
    "Page.dialogClosed": Page.dialogClosedPayload;
    "Page.bindingCalled": Page.bindingCalledPayload;
    "Page.linkClicked": Page.linkClickedPayload;
    "Page.willOpenNewWindowAsynchronously": Page.willOpenNewWindowAsynchronouslyPayload;
    "Page.fileChooserOpened": Page.fileChooserOpenedPayload;
    "Page.workerCreated": Page.workerCreatedPayload;
    "Page.workerDestroyed": Page.workerDestroyedPayload;
    "Page.dispatchMessageFromWorker": Page.dispatchMessageFromWorkerPayload;
    "Page.videoRecordingStarted": Page.videoRecordingStartedPayload;
    "Page.webSocketCreated": Page.webSocketCreatedPayload;
    "Page.webSocketOpened": Page.webSocketOpenedPayload;
    "Page.webSocketClosed": Page.webSocketClosedPayload;
    "Page.webSocketFrameSent": Page.webSocketFrameSentPayload;
    "Page.webSocketFrameReceived": Page.webSocketFrameReceivedPayload;
    "Page.screencastFrame": Page.screencastFramePayload;
    "Runtime.executionContextCreated": Runtime.executionContextCreatedPayload;
    "Runtime.executionContextDestroyed": Runtime.executionContextDestroyedPayload;
    "Runtime.executionContextsCleared": Runtime.executionContextsClearedPayload;
    "Runtime.console": Runtime.consolePayload;
    "Network.requestWillBeSent": Network.requestWillBeSentPayload;
    "Network.responseReceived": Network.responseReceivedPayload;
    "Network.requestFinished": Network.requestFinishedPayload;
    "Network.requestFailed": Network.requestFailedPayload;
  }
  export interface CommandParameters {
    "Browser.enable": Browser.enableParameters;
    "Browser.createBrowserContext": Browser.createBrowserContextParameters;
    "Browser.removeBrowserContext": Browser.removeBrowserContextParameters;
    "Browser.newPage": Browser.newPageParameters;
    "Browser.close": Browser.closeParameters;
    "Browser.getInfo": Browser.getInfoParameters;
    "Browser.setExtraHTTPHeaders": Browser.setExtraHTTPHeadersParameters;
    "Browser.clearCache": Browser.clearCacheParameters;
    "Browser.setBrowserProxy": Browser.setBrowserProxyParameters;
    "Browser.setContextProxy": Browser.setContextProxyParameters;
    "Browser.setHTTPCredentials": Browser.setHTTPCredentialsParameters;
    "Browser.setRequestInterception": Browser.setRequestInterceptionParameters;
    "Browser.setCacheDisabled": Browser.setCacheDisabledParameters;
    "Browser.setGeolocationOverride": Browser.setGeolocationOverrideParameters;
    "Browser.setUserAgentOverride": Browser.setUserAgentOverrideParameters;
    "Browser.setPlatformOverride": Browser.setPlatformOverrideParameters;
    "Browser.setBypassCSP": Browser.setBypassCSPParameters;
    "Browser.setIgnoreHTTPSErrors": Browser.setIgnoreHTTPSErrorsParameters;
    "Browser.setJavaScriptDisabled": Browser.setJavaScriptDisabledParameters;
    "Browser.setLocaleOverride": Browser.setLocaleOverrideParameters;
    "Browser.setTimezoneOverride": Browser.setTimezoneOverrideParameters;
    "Browser.setDownloadOptions": Browser.setDownloadOptionsParameters;
    "Browser.setTouchOverride": Browser.setTouchOverrideParameters;
    "Browser.setDefaultViewport": Browser.setDefaultViewportParameters;
    "Browser.setInitScripts": Browser.setInitScriptsParameters;
    "Browser.addBinding": Browser.addBindingParameters;
    "Browser.grantPermissions": Browser.grantPermissionsParameters;
    "Browser.resetPermissions": Browser.resetPermissionsParameters;
    "Browser.setCookies": Browser.setCookiesParameters;
    "Browser.clearCookies": Browser.clearCookiesParameters;
    "Browser.getCookies": Browser.getCookiesParameters;
    "Browser.setOnlineOverride": Browser.setOnlineOverrideParameters;
    "Browser.setColorScheme": Browser.setColorSchemeParameters;
    "Browser.setReducedMotion": Browser.setReducedMotionParameters;
    "Browser.setForcedColors": Browser.setForcedColorsParameters;
    "Browser.setVideoRecordingOptions": Browser.setVideoRecordingOptionsParameters;
    "Browser.cancelDownload": Browser.cancelDownloadParameters;
    "Page.close": Page.closeParameters;
    "Page.setFileInputFiles": Page.setFileInputFilesParameters;
    "Page.addBinding": Page.addBindingParameters;
    "Page.setViewportSize": Page.setViewportSizeParameters;
    "Page.bringToFront": Page.bringToFrontParameters;
    "Page.setEmulatedMedia": Page.setEmulatedMediaParameters;
    "Page.setCacheDisabled": Page.setCacheDisabledParameters;
    "Page.describeNode": Page.describeNodeParameters;
    "Page.scrollIntoViewIfNeeded": Page.scrollIntoViewIfNeededParameters;
    "Page.setInitScripts": Page.setInitScriptsParameters;
    "Page.navigate": Page.navigateParameters;
    "Page.goBack": Page.goBackParameters;
    "Page.goForward": Page.goForwardParameters;
    "Page.reload": Page.reloadParameters;
    "Page.adoptNode": Page.adoptNodeParameters;
    "Page.screenshot": Page.screenshotParameters;
    "Page.getContentQuads": Page.getContentQuadsParameters;
    "Page.dispatchKeyEvent": Page.dispatchKeyEventParameters;
    "Page.dispatchTouchEvent": Page.dispatchTouchEventParameters;
    "Page.dispatchTapEvent": Page.dispatchTapEventParameters;
    "Page.dispatchMouseEvent": Page.dispatchMouseEventParameters;
    "Page.dispatchWheelEvent": Page.dispatchWheelEventParameters;
    "Page.insertText": Page.insertTextParameters;
    "Page.crash": Page.crashParameters;
    "Page.handleDialog": Page.handleDialogParameters;
    "Page.setInterceptFileChooserDialog": Page.setInterceptFileChooserDialogParameters;
    "Page.sendMessageToWorker": Page.sendMessageToWorkerParameters;
    "Page.startScreencast": Page.startScreencastParameters;
    "Page.screencastFrameAck": Page.screencastFrameAckParameters;
    "Page.stopScreencast": Page.stopScreencastParameters;
    "Runtime.evaluate": Runtime.evaluateParameters;
    "Runtime.callFunction": Runtime.callFunctionParameters;
    "Runtime.disposeObject": Runtime.disposeObjectParameters;
    "Runtime.getObjectProperties": Runtime.getObjectPropertiesParameters;
    "Network.setRequestInterception": Network.setRequestInterceptionParameters;
    "Network.setExtraHTTPHeaders": Network.setExtraHTTPHeadersParameters;
    "Network.abortInterceptedRequest": Network.abortInterceptedRequestParameters;
    "Network.resumeInterceptedRequest": Network.resumeInterceptedRequestParameters;
    "Network.fulfillInterceptedRequest": Network.fulfillInterceptedRequestParameters;
    "Network.getResponseBody": Network.getResponseBodyParameters;
    "Accessibility.getFullAXTree": Accessibility.getFullAXTreeParameters;
  }
  export interface CommandReturnValues {
    "Browser.enable": Browser.enableReturnValue;
    "Browser.createBrowserContext": Browser.createBrowserContextReturnValue;
    "Browser.removeBrowserContext": Browser.removeBrowserContextReturnValue;
    "Browser.newPage": Browser.newPageReturnValue;
    "Browser.close": Browser.closeReturnValue;
    "Browser.getInfo": Browser.getInfoReturnValue;
    "Browser.setExtraHTTPHeaders": Browser.setExtraHTTPHeadersReturnValue;
    "Browser.clearCache": Browser.clearCacheReturnValue;
    "Browser.setBrowserProxy": Browser.setBrowserProxyReturnValue;
    "Browser.setContextProxy": Browser.setContextProxyReturnValue;
    "Browser.setHTTPCredentials": Browser.setHTTPCredentialsReturnValue;
    "Browser.setRequestInterception": Browser.setRequestInterceptionReturnValue;
    "Browser.setCacheDisabled": Browser.setCacheDisabledReturnValue;
    "Browser.setGeolocationOverride": Browser.setGeolocationOverrideReturnValue;
    "Browser.setUserAgentOverride": Browser.setUserAgentOverrideReturnValue;
    "Browser.setPlatformOverride": Browser.setPlatformOverrideReturnValue;
    "Browser.setBypassCSP": Browser.setBypassCSPReturnValue;
    "Browser.setIgnoreHTTPSErrors": Browser.setIgnoreHTTPSErrorsReturnValue;
    "Browser.setJavaScriptDisabled": Browser.setJavaScriptDisabledReturnValue;
    "Browser.setLocaleOverride": Browser.setLocaleOverrideReturnValue;
    "Browser.setTimezoneOverride": Browser.setTimezoneOverrideReturnValue;
    "Browser.setDownloadOptions": Browser.setDownloadOptionsReturnValue;
    "Browser.setTouchOverride": Browser.setTouchOverrideReturnValue;
    "Browser.setDefaultViewport": Browser.setDefaultViewportReturnValue;
    "Browser.setInitScripts": Browser.setInitScriptsReturnValue;
    "Browser.addBinding": Browser.addBindingReturnValue;
    "Browser.grantPermissions": Browser.grantPermissionsReturnValue;
    "Browser.resetPermissions": Browser.resetPermissionsReturnValue;
    "Browser.setCookies": Browser.setCookiesReturnValue;
    "Browser.clearCookies": Browser.clearCookiesReturnValue;
    "Browser.getCookies": Browser.getCookiesReturnValue;
    "Browser.setOnlineOverride": Browser.setOnlineOverrideReturnValue;
    "Browser.setColorScheme": Browser.setColorSchemeReturnValue;
    "Browser.setReducedMotion": Browser.setReducedMotionReturnValue;
    "Browser.setForcedColors": Browser.setForcedColorsReturnValue;
    "Browser.setVideoRecordingOptions": Browser.setVideoRecordingOptionsReturnValue;
    "Browser.cancelDownload": Browser.cancelDownloadReturnValue;
    "Page.close": Page.closeReturnValue;
    "Page.setFileInputFiles": Page.setFileInputFilesReturnValue;
    "Page.addBinding": Page.addBindingReturnValue;
    "Page.setViewportSize": Page.setViewportSizeReturnValue;
    "Page.bringToFront": Page.bringToFrontReturnValue;
    "Page.setEmulatedMedia": Page.setEmulatedMediaReturnValue;
    "Page.setCacheDisabled": Page.setCacheDisabledReturnValue;
    "Page.describeNode": Page.describeNodeReturnValue;
    "Page.scrollIntoViewIfNeeded": Page.scrollIntoViewIfNeededReturnValue;
    "Page.setInitScripts": Page.setInitScriptsReturnValue;
    "Page.navigate": Page.navigateReturnValue;
    "Page.goBack": Page.goBackReturnValue;
    "Page.goForward": Page.goForwardReturnValue;
    "Page.reload": Page.reloadReturnValue;
    "Page.adoptNode": Page.adoptNodeReturnValue;
    "Page.screenshot": Page.screenshotReturnValue;
    "Page.getContentQuads": Page.getContentQuadsReturnValue;
    "Page.dispatchKeyEvent": Page.dispatchKeyEventReturnValue;
    "Page.dispatchTouchEvent": Page.dispatchTouchEventReturnValue;
    "Page.dispatchTapEvent": Page.dispatchTapEventReturnValue;
    "Page.dispatchMouseEvent": Page.dispatchMouseEventReturnValue;
    "Page.dispatchWheelEvent": Page.dispatchWheelEventReturnValue;
    "Page.insertText": Page.insertTextReturnValue;
    "Page.crash": Page.crashReturnValue;
    "Page.handleDialog": Page.handleDialogReturnValue;
    "Page.setInterceptFileChooserDialog": Page.setInterceptFileChooserDialogReturnValue;
    "Page.sendMessageToWorker": Page.sendMessageToWorkerReturnValue;
    "Page.startScreencast": Page.startScreencastReturnValue;
    "Page.screencastFrameAck": Page.screencastFrameAckReturnValue;
    "Page.stopScreencast": Page.stopScreencastReturnValue;
    "Runtime.evaluate": Runtime.evaluateReturnValue;
    "Runtime.callFunction": Runtime.callFunctionReturnValue;
    "Runtime.disposeObject": Runtime.disposeObjectReturnValue;
    "Runtime.getObjectProperties": Runtime.getObjectPropertiesReturnValue;
    "Network.setRequestInterception": Network.setRequestInterceptionReturnValue;
    "Network.setExtraHTTPHeaders": Network.setExtraHTTPHeadersReturnValue;
    "Network.abortInterceptedRequest": Network.abortInterceptedRequestReturnValue;
    "Network.resumeInterceptedRequest": Network.resumeInterceptedRequestReturnValue;
    "Network.fulfillInterceptedRequest": Network.fulfillInterceptedRequestReturnValue;
    "Network.getResponseBody": Network.getResponseBodyReturnValue;
    "Accessibility.getFullAXTree": Accessibility.getFullAXTreeReturnValue;
  }
}