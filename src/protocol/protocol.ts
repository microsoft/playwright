// This is generated from /utils/protocol-types-generator/index.js
type binary = string;
export module Protocol {
  export module Types {
    export interface Size {
      width: number;
      height: number;
    }
    
    
  }
  
  export module BrowserContext {
    export type BrowserContextId = string;
    export interface Geolocation {
      longitude: number;
      latitude: number;
      accuracy?: number;
    }
    
    
    export type createParameters = {
      viewportSize?: Types.Size;
      geolocation?: Geolocation;
    }
    export type createReturnValue = {
      contextId: BrowserContextId;
    }
    export type destroyParameters = {
      contextId: BrowserContextId;
    }
    export type destroyReturnValue = {
    }
    export type setGeolocationParameters = {
      contextId: BrowserContextId;
      geolocation?: Geolocation;
    }
    export type setGeolocationReturnValue = {
    }
  }
  
  export module Frame {
    export type FrameId = string;
    export interface FrameTree {
      frameId: FrameId;
      url: string;
      childFrames?: FrameTree[];
    }
    export type Lifecycle = "domcontentloaded"|"load"|"networkidle0"|"networkidle2";
    
    export type pageCreatedPayload = {
      contextId: BrowserContext.BrowserContextId;
      frameTree: FrameTree;
    }
    export type pageDestroyedPayload = {
      mainFrameId: FrameId;
    }
    export type attachedPayload = {
      frameId: FrameId;
      parentFrameId: FrameId;
    }
    export type navigatedPayload = {
      frameId: FrameId;
      url: string;
    }
    export type detachedPayload = {
      frameId: FrameId;
    }
    
    export type createPageParameters = {
      contextId: BrowserContext.BrowserContextId;
      url?: string;
    }
    export type createPageReturnValue = {
      mainFrameId: FrameId;
    }
    export type destroyPageParameters = {
      mainFrameId: FrameId;
    }
    export type destroyPageReturnValue = {
    }
    export type navigateParameters = {
      frameId: FrameId;
      url: string;
      waitUntil: Lifecycle[];
      referrer?: string;
    }
    export type navigateReturnValue = {
      requestId?: Network.RequestId;
    }
  }
  
  export module JS {
    export type HandleId = string;
    export interface Handle {
      handleId: HandleId;
      asString: string;
      isDOMElement: boolean;
    }
    export interface Value {
      string?: string;
      number?: number;
      null?: boolean;
      undefined?: boolean;
      boolean?: boolean;
      values?: Value[];
      keys?: string[];
    }
    export interface CallArgument {
      value?: Value;
      handleId?: HandleId;
    }
    
    
    export type evaluateHandleParameters = {
      functionExpression: string;
      args: CallArgument[];
      frameId?: Frame.FrameId;
      handleId?: HandleId;
    }
    export type evaluateHandleReturnValue = {
      handle: Handle;
    }
    export type evaluateParameters = {
      functionExpression: string;
      args: CallArgument[];
      frameId?: Frame.FrameId;
      handleId?: HandleId;
    }
    export type evaluateReturnValue = {
      value: Value;
    }
    export type handleAsValueParameters = {
      handleId: HandleId;
    }
    export type handleAsValueReturnValue = {
      value: Value;
    }
    export type disposeHandleParameters = {
      handleId: HandleId;
    }
    export type disposeHandleReturnValue = {
    }
  }
  
  export module DOM {
    
    
    export type ownerFrameParameters = {
      handleId: JS.HandleId;
    }
    export type ownerFrameReturnValue = {
      frameId?: Frame.FrameId;
    }
    export type contentFrameParameters = {
      handleId: JS.HandleId;
    }
    export type contentFrameReturnValue = {
      frameId?: Frame.FrameId;
    }
    export type scrollIntoViewIfNeededParameters = {
      handleId: JS.HandleId;
    }
    export type scrollIntoViewIfNeededReturnValue = {
    }
  }
  
  export module Network {
    export type RequestId = string;
    export type ResourceType = "document";
    export interface Header {
      name: string;
      value: string;
    }
    export type Headers = Header[];
    
    export type requestStartedPayload = {
      requestId: RequestId;
      frameId: Frame.FrameId;
      url: string;
      method: string;
      resourceType: ResourceType;
      headers: Headers;
      isIntercepted: boolean;
      isNavigation: boolean;
      redirectedFrom?: RequestId;
      postData?: string;
    }
    export type responseReceivedPayload = {
      requestId: RequestId;
    }
    export type requestFailedPayload = {
      requestId: RequestId;
      errorText: string;
    }
    export type requestFinishedPayload = {
      requestId: RequestId;
    }
    
    export type abortRequestParameters = {
      requestId: RequestId;
      errorCode: string;
    }
    export type abortRequestReturnValue = {
    }
    export type fulfillRequestParameters = {
      requestId: RequestId;
      status: number;
      headers: Headers;
      contentType: string;
      base64body: string;
    }
    export type fulfillRequestReturnValue = {
    }
    export type continueRequestParameters = {
      requestId: RequestId;
      headers?: Headers;
    }
    export type continueRequestReturnValue = {
    }
  }
  
  export interface Events {
    "Frame.pageCreated": Frame.pageCreatedPayload;
    "Frame.pageDestroyed": Frame.pageDestroyedPayload;
    "Frame.attached": Frame.attachedPayload;
    "Frame.navigated": Frame.navigatedPayload;
    "Frame.detached": Frame.detachedPayload;
    "Network.requestStarted": Network.requestStartedPayload;
    "Network.responseReceived": Network.responseReceivedPayload;
    "Network.requestFailed": Network.requestFailedPayload;
    "Network.requestFinished": Network.requestFinishedPayload;
  }
  export interface CommandParameters {
    "BrowserContext.create": BrowserContext.createParameters;
    "BrowserContext.destroy": BrowserContext.destroyParameters;
    "BrowserContext.setGeolocation": BrowserContext.setGeolocationParameters;
    "Frame.createPage": Frame.createPageParameters;
    "Frame.destroyPage": Frame.destroyPageParameters;
    "Frame.navigate": Frame.navigateParameters;
    "JS.evaluateHandle": JS.evaluateHandleParameters;
    "JS.evaluate": JS.evaluateParameters;
    "JS.handleAsValue": JS.handleAsValueParameters;
    "JS.disposeHandle": JS.disposeHandleParameters;
    "DOM.ownerFrame": DOM.ownerFrameParameters;
    "DOM.contentFrame": DOM.contentFrameParameters;
    "DOM.scrollIntoViewIfNeeded": DOM.scrollIntoViewIfNeededParameters;
    "Network.abortRequest": Network.abortRequestParameters;
    "Network.fulfillRequest": Network.fulfillRequestParameters;
    "Network.continueRequest": Network.continueRequestParameters;
  }
  export interface CommandReturnValues {
    "BrowserContext.create": BrowserContext.createReturnValue;
    "BrowserContext.destroy": BrowserContext.destroyReturnValue;
    "BrowserContext.setGeolocation": BrowserContext.setGeolocationReturnValue;
    "Frame.createPage": Frame.createPageReturnValue;
    "Frame.destroyPage": Frame.destroyPageReturnValue;
    "Frame.navigate": Frame.navigateReturnValue;
    "JS.evaluateHandle": JS.evaluateHandleReturnValue;
    "JS.evaluate": JS.evaluateReturnValue;
    "JS.handleAsValue": JS.handleAsValueReturnValue;
    "JS.disposeHandle": JS.disposeHandleReturnValue;
    "DOM.ownerFrame": DOM.ownerFrameReturnValue;
    "DOM.contentFrame": DOM.contentFrameReturnValue;
    "DOM.scrollIntoViewIfNeeded": DOM.scrollIntoViewIfNeededReturnValue;
    "Network.abortRequest": Network.abortRequestReturnValue;
    "Network.fulfillRequest": Network.fulfillRequestReturnValue;
    "Network.continueRequest": Network.continueRequestReturnValue;
  }
}
