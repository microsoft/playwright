// This is generated from /utils/protocol-types-generator/index.js
type binary = string;
export module Protocol {
  /**
   * Domain for tracking/modifying Web Animations, as well as CSS (declarative) animations and transitions.
   */
  export module Animation {
    /**
     * Unique Web Animation identifier.
     */
    export type AnimationId = string;
    export type AnimationState = "ready"|"delayed"|"active"|"canceled"|"done";
    export type PlaybackDirection = "normal"|"reverse"|"alternate"|"alternate-reverse";
    export type FillMode = "none"|"forwards"|"backwards"|"both"|"auto";
    export interface Animation {
      animationId: AnimationId;
      /**
       * Equal to `Animation.prototype.get id`.
       */
      name?: string;
      /**
       * Equal to the corresponding `animation-name` CSS property. Should not be provided if `transitionProperty` is also provided.
       */
      cssAnimationName?: string;
      /**
       * Equal to the corresponding `transition-property` CSS property. Should not be provided if `animationName` is also provided.
       */
      cssTransitionProperty?: string;
      effect?: Effect;
      /**
       * Backtrace that was captured when this `WebAnimation` was created.
       */
      backtrace?: Console.CallFrame[];
    }
    export interface Effect {
      startDelay?: number;
      endDelay?: number;
      /**
       * Number of iterations in the animation. <code>Infinity</code> is represented as <code>-1</code>.
       */
      iterationCount?: number;
      /**
       * Index of which iteration to start at.
       */
      iterationStart?: number;
      /**
       * Total time of each iteration, measured in milliseconds.
       */
      iterationDuration?: number;
      /**
       * CSS timing function of the overall animation.
       */
      timingFunction?: string;
      playbackDirection?: PlaybackDirection;
      fillMode?: FillMode;
      keyframes?: Keyframe[];
    }
    export interface Keyframe {
      /**
       * Decimal percentage [0,1] representing where this keyframe is in the entire duration of the animation.
       */
      offset: number;
      /**
       * CSS timing function for how the `style` is applied.
       */
      easing?: string;
      /**
       * CSS style declaration of the CSS properties that will be animated.
       */
      style?: string;
    }
    export interface TrackingUpdate {
      trackingAnimationId: AnimationId;
      animationState: AnimationState;
      nodeId?: DOM.NodeId;
      /**
       * Equal to the corresponding `animation-name` CSS property. Should not be provided if `transitionProperty` is also provided.
       */
      animationName?: string;
      /**
       * Equal to the corresponding `transition-property` CSS property. Should not be provided if `animationName` is also provided.
       */
      transitionProperty?: string;
    }
    
    /**
     * Dispatched whenever a `WebAnimation` is created.
     */
    export type animationCreatedPayload = {
      animation: Animation;
    }
    /**
     * Dispatched whenever `Animation.prototype.set id` is called.
     */
    export type nameChangedPayload = {
      animationId: AnimationId;
      /**
       * Equal to `Animation.prototype.get id`.
       */
      name?: string;
    }
    /**
     * Dispatched whenever the effect of any animation is changed in any way.
     */
    export type effectChangedPayload = {
      animationId: AnimationId;
      /**
       * This is omitted when the effect is removed without a replacement.
       */
      effect?: Effect;
    }
    /**
     * Dispatched whenever the target of any effect of any animation is changed in any way.
     */
    export type targetChangedPayload = {
      animationId: AnimationId;
    }
    /**
     * Dispatched whenever a `WebAnimation` is destroyed.
     */
    export type animationDestroyedPayload = {
      animationId: AnimationId;
    }
    /**
     * Dispatched after `startTracking` command.
     */
    export type trackingStartPayload = {
      timestamp: number;
    }
    /**
     * Fired for each phase of Web Animation.
     */
    export type trackingUpdatePayload = {
      timestamp: number;
      event: TrackingUpdate;
    }
    /**
     * Dispatched after `stopTracking` command.
     */
    export type trackingCompletePayload = {
      timestamp: number;
    }
    
    /**
     * Enables Canvas domain events.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables Canvas domain events.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Gets the `DOM.NodeId` for the target of the effect of the animation with the given `AnimationId`.
     */
    export type requestEffectTargetParameters = {
      animationId: AnimationId;
    }
    export type requestEffectTargetReturnValue = {
      effectTarget: DOM.Styleable;
    }
    /**
     * Resolves JavaScript `WebAnimation` object for given `AnimationId`.
     */
    export type resolveAnimationParameters = {
      animationId: AnimationId;
      /**
       * Symbolic group name that can be used to release multiple objects.
       */
      objectGroup?: string;
    }
    export type resolveAnimationReturnValue = {
      object: Runtime.RemoteObject;
    }
    /**
     * Start tracking animations. This will produce a `trackingStart` event.
     */
    export type startTrackingParameters = {
    }
    export type startTrackingReturnValue = {
    }
    /**
     * Stop tracking animations. This will produce a `trackingComplete` event.
     */
    export type stopTrackingParameters = {
    }
    export type stopTrackingReturnValue = {
    }
  }
  
  export module ApplicationCache {
    /**
     * Detailed application cache resource information.
     */
    export interface ApplicationCacheResource {
      /**
       * Resource url.
       */
      url: string;
      /**
       * Resource size.
       */
      size: number;
      /**
       * Resource type.
       */
      type: string;
    }
    /**
     * Detailed application cache information.
     */
    export interface ApplicationCache {
      /**
       * Manifest URL.
       */
      manifestURL: string;
      /**
       * Application cache size.
       */
      size: number;
      /**
       * Application cache creation time.
       */
      creationTime: number;
      /**
       * Application cache update time.
       */
      updateTime: number;
      /**
       * Application cache resources.
       */
      resources: ApplicationCacheResource[];
    }
    /**
     * Frame identifier - manifest URL pair.
     */
    export interface FrameWithManifest {
      /**
       * Frame identifier.
       */
      frameId: Network.FrameId;
      /**
       * Manifest URL.
       */
      manifestURL: string;
      /**
       * Application cache status.
       */
      status: number;
    }
    
    export type applicationCacheStatusUpdatedPayload = {
      /**
       * Identifier of the frame containing document whose application cache updated status.
       */
      frameId: Network.FrameId;
      /**
       * Manifest URL.
       */
      manifestURL: string;
      /**
       * Updated application cache status.
       */
      status: number;
    }
    export type networkStateUpdatedPayload = {
      isNowOnline: boolean;
    }
    
    /**
     * Returns array of frame identifiers with manifest urls for each frame containing a document associated with some application cache.
     */
    export type getFramesWithManifestsParameters = {
    }
    export type getFramesWithManifestsReturnValue = {
      /**
       * Array of frame identifiers with manifest urls for each frame containing a document associated with some application cache.
       */
      frameIds: FrameWithManifest[];
    }
    /**
     * Enables application cache domain notifications.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disable application cache domain notifications.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Returns manifest URL for document in the given frame.
     */
    export type getManifestForFrameParameters = {
      /**
       * Identifier of the frame containing document whose manifest is retrieved.
       */
      frameId: Network.FrameId;
    }
    export type getManifestForFrameReturnValue = {
      /**
       * Manifest URL for document in the given frame.
       */
      manifestURL: string;
    }
    /**
     * Returns relevant application cache data for the document in given frame.
     */
    export type getApplicationCacheForFrameParameters = {
      /**
       * Identifier of the frame containing document whose application cache is retrieved.
       */
      frameId: Network.FrameId;
    }
    export type getApplicationCacheForFrameReturnValue = {
      /**
       * Relevant application cache data for the document in given frame.
       */
      applicationCache: ApplicationCache;
    }
  }
  
  export module Audit {
    
    
    /**
     * Creates the `WebInspectorAudit` object that is passed to run. Must call teardown before calling setup more than once.
     */
    export type setupParameters = {
      /**
       * Specifies in which isolated context to run the test. Each content script lives in an isolated context and this parameter may be used to specify one of those contexts. If the parameter is omitted or 0 the evaluation will be performed in the context of the inspected page.
       */
      contextId?: Runtime.ExecutionContextId;
    }
    export type setupReturnValue = {
    }
    /**
     * Parses and evaluates the given test string and sends back the result. Returned values are saved to the "audit" object group. Call setup before and teardown after if the `WebInspectorAudit` object should be passed into the test.
     */
    export type runParameters = {
      /**
       * Test string to parse and evaluate.
       */
      test: string;
      /**
       * Specifies in which isolated context to run the test. Each content script lives in an isolated context and this parameter may be used to specify one of those contexts. If the parameter is omitted or 0 the evaluation will be performed in the context of the inspected page.
       */
      contextId?: Runtime.ExecutionContextId;
    }
    export type runReturnValue = {
      /**
       * Evaluation result.
       */
      result: Runtime.RemoteObject;
      /**
       * True if the result was thrown during the evaluation.
       */
      wasThrown?: boolean;
    }
    /**
     * Destroys the `WebInspectorAudit` object that is passed to run. Must call setup before calling teardown.
     */
    export type teardownParameters = {
    }
    export type teardownReturnValue = {
    }
  }
  
  /**
   * The Browser domain contains commands and events related to getting information about the browser 
   */
  export module Browser {
    /**
     * Unique extension identifier.
     */
    export type ExtensionId = string;
    /**
     * Information about an extension.
     */
    export interface Extension {
      /**
       * Extension identifier.
       */
      extensionId: ExtensionId;
      /**
       * The display name for the extension.
       */
      name: string;
    }
    
    export type extensionsEnabledPayload = {
      /**
       * Information about the enabled extensions.
       */
      extensions: Extension[];
    }
    export type extensionsDisabledPayload = {
      /**
       * Disabled extension identifiers.
       */
      extensionIds: ExtensionId[];
    }
    
    /**
     * Enables Browser domain events.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables Browser domain events.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
  }
  
  /**
   * CPUProfiler domain exposes cpu usage tracking.
   */
  export module CPUProfiler {
    /**
     * CPU usage for an individual thread.
     */
    export interface ThreadInfo {
      /**
       * Some thread identification information.
       */
      name: string;
      /**
       * CPU usage for this thread. This should not exceed 100% for an individual thread.
       */
      usage: number;
      /**
       * Type of thread. There should be a single main thread.
       */
      type?: "main"|"webkit";
      /**
       * A thread may be associated with a target, such as a Worker, in the process.
       */
      targetId?: string;
    }
    export interface Event {
      timestamp: number;
      /**
       * Percent of total cpu usage. If there are multiple cores the usage may be greater than 100%.
       */
      usage: number;
      /**
       * Per-thread CPU usage information. Does not include the main thread.
       */
      threads?: ThreadInfo[];
    }
    
    /**
     * Tracking started.
     */
    export type trackingStartPayload = {
      timestamp: number;
    }
    /**
     * Periodic tracking updates with event data.
     */
    export type trackingUpdatePayload = {
      event: Event;
    }
    /**
     * Tracking stopped.
     */
    export type trackingCompletePayload = {
      timestamp: number;
    }
    
    /**
     * Start tracking cpu usage.
     */
    export type startTrackingParameters = {
    }
    export type startTrackingReturnValue = {
    }
    /**
     * Stop tracking cpu usage. This will produce a `trackingComplete` event.
     */
    export type stopTrackingParameters = {
    }
    export type stopTrackingReturnValue = {
    }
  }
  
  /**
   * This domain exposes CSS read/write operations. All CSS objects, like stylesheets, rules, and styles, have an associated <code>id</code> used in subsequent operations on the related object. Each object type has a specific <code>id</code> structure, and those are not interchangeable between objects of different kinds. CSS objects can be loaded using the <code>get*ForNode()</code> calls (which accept a DOM node id). Alternatively, a client can discover all the existing stylesheets with the <code>getAllStyleSheets()</code> method and subsequently load the required stylesheet contents using the <code>getStyleSheet[Text]()</code> methods.
   */
  export module CSS {
    export type StyleSheetId = string;
    /**
     * This object identifies a CSS style in a unique way.
     */
    export interface CSSStyleId {
      /**
       * Enclosing stylesheet identifier.
       */
      styleSheetId: StyleSheetId;
      /**
       * The style ordinal within the stylesheet.
       */
      ordinal: number;
    }
    /**
     * Stylesheet type: "user" for user stylesheets, "user-agent" for user-agent stylesheets, "inspector" for stylesheets created by the inspector (i.e. those holding the "via inspector" rules), "regular" for regular stylesheets.
     */
    export type StyleSheetOrigin = "user"|"user-agent"|"author"|"inspector";
    /**
     * This object identifies a CSS rule in a unique way.
     */
    export interface CSSRuleId {
      /**
       * Enclosing stylesheet identifier.
       */
      styleSheetId: StyleSheetId;
      /**
       * The rule ordinal within the stylesheet.
       */
      ordinal: number;
    }
    /**
     * Pseudo-style identifier (see <code>enum PseudoId</code> in <code>RenderStyleConstants.h</code>).
     */
    export type PseudoId = "first-line"|"first-letter"|"highlight"|"marker"|"before"|"after"|"selection"|"backdrop"|"scrollbar"|"scrollbar-thumb"|"scrollbar-button"|"scrollbar-track"|"scrollbar-track-piece"|"scrollbar-corner"|"resizer";
    /**
     * CSS rule collection for a single pseudo style.
     */
    export interface PseudoIdMatches {
      pseudoId: PseudoId;
      /**
       * Matches of CSS rules applicable to the pseudo style.
       */
      matches: RuleMatch[];
    }
    /**
     * CSS rule collection for a single pseudo style.
     */
    export interface InheritedStyleEntry {
      /**
       * The ancestor node's inline style, if any, in the style inheritance chain.
       */
      inlineStyle?: CSSStyle;
      /**
       * Matches of CSS rules matching the ancestor node in the style inheritance chain.
       */
      matchedCSSRules: RuleMatch[];
    }
    /**
     * Match data for a CSS rule.
     */
    export interface RuleMatch {
      /**
       * CSS rule in the match.
       */
      rule: CSSRule;
      /**
       * Matching selector indices in the rule's selectorList selectors (0-based).
       */
      matchingSelectors: number[];
    }
    /**
     * CSS selector.
     */
    export interface CSSSelector {
      /**
       * Canonicalized selector text.
       */
      text: string;
      /**
       * Specificity (a, b, c) tuple. Included if the selector is sent in response to CSS.getMatchedStylesForNode which provides a context element.
       */
      specificity?: number[];
      /**
       * Whether or not the specificity can be dynamic. Included if the selector is sent in response to CSS.getMatchedStylesForNode which provides a context element.
       */
      dynamic?: boolean;
    }
    /**
     * Selector list data.
     */
    export interface SelectorList {
      /**
       * Selectors in the list.
       */
      selectors: CSSSelector[];
      /**
       * Rule selector text.
       */
      text: string;
      /**
       * Rule selector range in the underlying resource (if available).
       */
      range?: SourceRange;
    }
    /**
     * CSS style information for a DOM style attribute.
     */
    export interface CSSStyleAttribute {
      /**
       * DOM attribute name (e.g. "width").
       */
      name: string;
      /**
       * CSS style generated by the respective DOM attribute.
       */
      style: CSSStyle;
    }
    /**
     * CSS stylesheet meta-information.
     */
    export interface CSSStyleSheetHeader {
      /**
       * The stylesheet identifier.
       */
      styleSheetId: StyleSheetId;
      /**
       * Owner frame identifier.
       */
      frameId: Network.FrameId;
      /**
       * Stylesheet resource URL.
       */
      sourceURL: string;
      /**
       * Stylesheet origin.
       */
      origin: StyleSheetOrigin;
      /**
       * Stylesheet title.
       */
      title: string;
      /**
       * Denotes whether the stylesheet is disabled.
       */
      disabled: boolean;
      /**
       * Whether this stylesheet is a <style> tag created by the parser. This is not set for document.written <style> tags.
       */
      isInline: boolean;
      /**
       * Line offset of the stylesheet within the resource (zero based).
       */
      startLine: number;
      /**
       * Column offset of the stylesheet within the resource (zero based).
       */
      startColumn: number;
    }
    /**
     * CSS stylesheet contents.
     */
    export interface CSSStyleSheetBody {
      /**
       * The stylesheet identifier.
       */
      styleSheetId: StyleSheetId;
      /**
       * Stylesheet resource URL.
       */
      rules: CSSRule[];
      /**
       * Stylesheet resource contents (if available).
       */
      text?: string;
    }
    /**
     * CSS rule representation.
     */
    export interface CSSRule {
      /**
       * The CSS rule identifier (absent for user agent stylesheet and user-specified stylesheet rules).
       */
      ruleId?: CSSRuleId;
      /**
       * Rule selector data.
       */
      selectorList: SelectorList;
      /**
       * Parent stylesheet resource URL (for regular rules).
       */
      sourceURL?: string;
      /**
       * Line ordinal of the rule selector start character in the resource.
       */
      sourceLine: number;
      /**
       * Parent stylesheet's origin.
       */
      origin: StyleSheetOrigin;
      /**
       * Associated style declaration.
       */
      style: CSSStyle;
      /**
       * Grouping list array (for rules involving @media/@supports). The array enumerates CSS groupings starting with the innermost one, going outwards.
       */
      groupings?: Grouping[];
    }
    /**
     * Text range within a resource.
     */
    export interface SourceRange {
      /**
       * Start line of range.
       */
      startLine: number;
      /**
       * Start column of range (inclusive).
       */
      startColumn: number;
      /**
       * End line of range
       */
      endLine: number;
      /**
       * End column of range (exclusive).
       */
      endColumn: number;
    }
    export interface ShorthandEntry {
      /**
       * Shorthand name.
       */
      name: string;
      /**
       * Shorthand value.
       */
      value: string;
    }
    export interface CSSPropertyInfo {
      /**
       * Property name.
       */
      name: string;
      /**
       * Other names for this property.
       */
      aliases?: string[];
      /**
       * Longhand property names.
       */
      longhands?: string[];
      /**
       * Supported values for this property.
       */
      values?: string[];
      /**
       * Whether the property is able to be inherited.
       */
      inherited?: boolean;
    }
    export interface CSSComputedStyleProperty {
      /**
       * Computed style property name.
       */
      name: string;
      /**
       * Computed style property value.
       */
      value: string;
    }
    /**
     * CSS style representation.
     */
    export interface CSSStyle {
      /**
       * The CSS style identifier (absent for attribute styles).
       */
      styleId?: CSSStyleId;
      /**
       * CSS properties in the style.
       */
      cssProperties: CSSProperty[];
      /**
       * Computed values for all shorthands found in the style.
       */
      shorthandEntries: ShorthandEntry[];
      /**
       * Style declaration text (if available).
       */
      cssText?: string;
      /**
       * Style declaration range in the enclosing stylesheet (if available).
       */
      range?: SourceRange;
      /**
       * The effective "width" property value from this style.
       */
      width?: string;
      /**
       * The effective "height" property value from this style.
       */
      height?: string;
    }
    /**
     * The property status: "active" if the property is effective in the style, "inactive" if the property is overridden by a same-named property in this style later on, "disabled" if the property is disabled by the user, "style" (implied if absent) if the property is reported by the browser rather than by the CSS source parser.
     */
    export type CSSPropertyStatus = "active"|"inactive"|"disabled"|"style";
    /**
     * CSS style effective visual dimensions and source offsets.
     */
    export interface CSSProperty {
      /**
       * The property name.
       */
      name: string;
      /**
       * The property value.
       */
      value: string;
      /**
       * The property priority (implies "" if absent).
       */
      priority?: string;
      /**
       * Whether the property is implicit (implies <code>false</code> if absent).
       */
      implicit?: boolean;
      /**
       * The full property text as specified in the style.
       */
      text?: string;
      /**
       * Whether the property is understood by the browser (implies <code>true</code> if absent).
       */
      parsedOk?: boolean;
      /**
       * Whether the property is active or disabled.
       */
      status?: CSSPropertyStatus;
      /**
       * The entire property range in the enclosing style declaration (if available).
       */
      range?: SourceRange;
    }
    /**
     * CSS @media (as well as other users of media queries, like @import, <style>, <link>, etc.), @supports, and @layer descriptor.
     */
    export interface Grouping {
      /**
       * Source of the media query: "media-rule" if specified by a @media rule, "media-import-rule" if specified by an @import rule, "media-link-node" if specified by a "media" attribute in a linked style sheet's LINK tag, "media-style-node" if specified by a "media" attribute in an inline style sheet's STYLE tag, "supports-rule" if specified by an @supports rule, "layer-rule" if specified by an @layer rule, "container-rule" if specified by an @container rule.
       */
      type: "media-rule"|"media-import-rule"|"media-link-node"|"media-style-node"|"supports-rule"|"layer-rule"|"layer-import-rule"|"container-rule";
      /**
       * Query text if specified by a @media, @supports, or @container rule. Layer name (or not present for anonymous layers) for @layer rules.
       */
      text?: string;
      /**
       * URL of the document containing the CSS grouping.
       */
      sourceURL?: string;
    }
    /**
     * A representation of WebCore::Font. Conceptually this is backed by either a font file on disk or from the network.
     */
    export interface Font {
      /**
       * The display name defined by the font.
       */
      displayName: string;
      /**
       * The variation axes defined by the font.
       */
      variationAxes: FontVariationAxis[];
    }
    /**
     * A single variation axis associated with a Font.
     */
    export interface FontVariationAxis {
      /**
       * The name, generally human-readable, of the variation axis. Some axes may not provide a human-readable name distiguishable from the tag. This field is ommited when there is no name, or the name matches the tag exactly.
       */
      name?: string;
      /**
       * The four character tag for the variation axis.
       */
      tag: string;
      /**
       * The minimum value that will affect the axis.
       */
      minimumValue: number;
      /**
       * The maximum value that will affect the axis.
       */
      maximumValue: number;
      /**
       * The value that is used for the axis when it is not otherwise controlled.
       */
      defaultValue: number;
    }
    /**
     * The layout context type of a node.
     */
    export type LayoutContextType = "flex"|"grid";
    /**
     * The mode for how layout context type changes are handled (default: <code>Observed</code>). <code>Observed</code> limits handling to those nodes already known to the frontend by other means (generally, this means the node is a visible item in the Elements tab). <code>All</code> informs the frontend of all layout context type changes and all nodes with a known layout context are sent to the frontend.
     */
    export type LayoutContextTypeChangedMode = "observed"|"all";
    
    /**
     * Fires whenever a MediaQuery result changes (for example, after a browser window has been resized.) The current implementation considers only viewport-dependent media features.
     */
    export type mediaQueryResultChangedPayload = void;
    /**
     * Fired whenever a stylesheet is changed as a result of the client operation.
     */
    export type styleSheetChangedPayload = {
      styleSheetId: StyleSheetId;
    }
    /**
     * Fired whenever an active document stylesheet is added.
     */
    export type styleSheetAddedPayload = {
      /**
       * Added stylesheet metainfo.
       */
      header: CSSStyleSheetHeader;
    }
    /**
     * Fired whenever an active document stylesheet is removed.
     */
    export type styleSheetRemovedPayload = {
      /**
       * Identifier of the removed stylesheet.
       */
      styleSheetId: StyleSheetId;
    }
    /**
     * Called when a node's layout context type has changed.
     */
    export type nodeLayoutContextTypeChangedPayload = {
      /**
       * Identifier of the node whose layout context type changed.
       */
      nodeId: DOM.NodeId;
      /**
       * The new layout context type of the node. When not provided, the <code>LayoutContextType</code> of the node is not a context for which Web Inspector has specific functionality.
       */
      layoutContextType?: LayoutContextType;
    }
    
    /**
     * Enables the CSS agent for the given page. Clients should not assume that the CSS agent has been enabled until the result of this command is received.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables the CSS agent for the given page.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Returns requested styles for a DOM node identified by <code>nodeId</code>.
     */
    export type getMatchedStylesForNodeParameters = {
      nodeId: DOM.NodeId;
      /**
       * Whether to include pseudo styles (default: true).
       */
      includePseudo?: boolean;
      /**
       * Whether to include inherited styles (default: true).
       */
      includeInherited?: boolean;
    }
    export type getMatchedStylesForNodeReturnValue = {
      /**
       * CSS rules matching this node, from all applicable stylesheets.
       */
      matchedCSSRules?: RuleMatch[];
      /**
       * Pseudo style matches for this node.
       */
      pseudoElements?: PseudoIdMatches[];
      /**
       * A chain of inherited styles (from the immediate node parent up to the DOM tree root).
       */
      inherited?: InheritedStyleEntry[];
    }
    /**
     * Returns the styles defined inline (explicitly in the "style" attribute and implicitly, using DOM attributes) for a DOM node identified by <code>nodeId</code>.
     */
    export type getInlineStylesForNodeParameters = {
      nodeId: DOM.NodeId;
    }
    export type getInlineStylesForNodeReturnValue = {
      /**
       * Inline style for the specified DOM node.
       */
      inlineStyle?: CSSStyle;
      /**
       * Attribute-defined element style (e.g. resulting from "width=20 height=100%").
       */
      attributesStyle?: CSSStyle;
    }
    /**
     * Returns the computed style for a DOM node identified by <code>nodeId</code>.
     */
    export type getComputedStyleForNodeParameters = {
      nodeId: DOM.NodeId;
    }
    export type getComputedStyleForNodeReturnValue = {
      /**
       * Computed style for the specified DOM node.
       */
      computedStyle: CSSComputedStyleProperty[];
    }
    /**
     * Returns the primary font of the computed font cascade for a DOM node identified by <code>nodeId</code>.
     */
    export type getFontDataForNodeParameters = {
      nodeId: DOM.NodeId;
    }
    export type getFontDataForNodeReturnValue = {
      /**
       * Computed primary font for the specified DOM node.
       */
      primaryFont: Font;
    }
    /**
     * Returns metainfo entries for all known stylesheets.
     */
    export type getAllStyleSheetsParameters = {
    }
    export type getAllStyleSheetsReturnValue = {
      /**
       * Descriptor entries for all available stylesheets.
       */
      headers: CSSStyleSheetHeader[];
    }
    /**
     * Returns stylesheet data for the specified <code>styleSheetId</code>.
     */
    export type getStyleSheetParameters = {
      styleSheetId: StyleSheetId;
    }
    export type getStyleSheetReturnValue = {
      /**
       * Stylesheet contents for the specified <code>styleSheetId</code>.
       */
      styleSheet: CSSStyleSheetBody;
    }
    /**
     * Returns the current textual content and the URL for a stylesheet.
     */
    export type getStyleSheetTextParameters = {
      styleSheetId: StyleSheetId;
    }
    export type getStyleSheetTextReturnValue = {
      /**
       * The stylesheet text.
       */
      text: string;
    }
    /**
     * Sets the new stylesheet text, thereby invalidating all existing <code>CSSStyleId</code>'s and <code>CSSRuleId</code>'s contained by this stylesheet.
     */
    export type setStyleSheetTextParameters = {
      styleSheetId: StyleSheetId;
      text: string;
    }
    export type setStyleSheetTextReturnValue = {
    }
    /**
     * Sets the new <code>text</code> for the respective style.
     */
    export type setStyleTextParameters = {
      styleId: CSSStyleId;
      text: string;
    }
    export type setStyleTextReturnValue = {
      /**
       * The resulting style after the text modification.
       */
      style: CSSStyle;
    }
    /**
     * Modifies the rule selector.
     */
    export type setRuleSelectorParameters = {
      ruleId: CSSRuleId;
      selector: string;
    }
    export type setRuleSelectorReturnValue = {
      /**
       * The resulting rule after the selector modification.
       */
      rule: CSSRule;
    }
    /**
     * Creates a new special "inspector" stylesheet in the frame with given <code>frameId</code>.
     */
    export type createStyleSheetParameters = {
      /**
       * Identifier of the frame where the new "inspector" stylesheet should be created.
       */
      frameId: Network.FrameId;
    }
    export type createStyleSheetReturnValue = {
      /**
       * Identifier of the created "inspector" stylesheet.
       */
      styleSheetId: StyleSheetId;
    }
    /**
     * Creates a new empty rule with the given <code>selector</code> in a stylesheet with given <code>styleSheetId</code>.
     */
    export type addRuleParameters = {
      styleSheetId: StyleSheetId;
      selector: string;
    }
    export type addRuleReturnValue = {
      /**
       * The newly created rule.
       */
      rule: CSSRule;
    }
    /**
     * Returns all supported CSS property names.
     */
    export type getSupportedCSSPropertiesParameters = {
    }
    export type getSupportedCSSPropertiesReturnValue = {
      /**
       * Supported property metainfo.
       */
      cssProperties: CSSPropertyInfo[];
    }
    /**
     * Returns all supported system font family names.
     */
    export type getSupportedSystemFontFamilyNamesParameters = {
    }
    export type getSupportedSystemFontFamilyNamesReturnValue = {
      /**
       * Supported system font families.
       */
      fontFamilyNames: string[];
    }
    /**
     * Ensures that the given node will have specified pseudo-classes whenever its style is computed by the browser.
     */
    export type forcePseudoStateParameters = {
      /**
       * The element id for which to force the pseudo state.
       */
      nodeId: DOM.NodeId;
      /**
       * Element pseudo classes to force when computing the element's style.
       */
      forcedPseudoClasses: "active"|"focus"|"hover"|"visited"[];
    }
    export type forcePseudoStateReturnValue = {
    }
    /**
     * Change how layout context type changes are handled for nodes. When the new mode would observe nodes the frontend has not yet recieved, those nodes will be sent to the frontend immediately.
     */
    export type setLayoutContextTypeChangedModeParameters = {
      /**
       * The mode for how layout context type changes are handled.
       */
      mode: LayoutContextTypeChangedMode;
    }
    export type setLayoutContextTypeChangedModeReturnValue = {
    }
  }
  
  /**
   * Canvas domain allows tracking of canvases that have an associated graphics context. Tracks canvases in the DOM and CSS canvases created with -webkit-canvas.
   */
  export module Canvas {
    /**
     * Unique canvas identifier.
     */
    export type CanvasId = string;
    /**
     * Unique shader program identifier.
     */
    export type ProgramId = string;
    export type ColorSpace = "srgb"|"display-p3";
    /**
     * The type of rendering context backing the canvas element.
     */
    export type ContextType = "canvas-2d"|"bitmaprenderer"|"webgl"|"webgl2";
    export type ProgramType = "compute"|"render";
    export type ShaderType = "compute"|"fragment"|"vertex";
    /**
     * Drawing surface attributes.
     */
    export interface ContextAttributes {
      /**
       * WebGL, WebGL2, ImageBitmapRenderingContext
       */
      alpha?: boolean;
      /**
       * 2D
       */
      colorSpace?: ColorSpace;
      /**
       * 2D
       */
      desynchronized?: boolean;
      /**
       * WebGL, WebGL2
       */
      depth?: boolean;
      /**
       * WebGL, WebGL2
       */
      stencil?: boolean;
      /**
       * WebGL, WebGL2
       */
      antialias?: boolean;
      /**
       * WebGL, WebGL2
       */
      premultipliedAlpha?: boolean;
      /**
       * WebGL, WebGL2
       */
      preserveDrawingBuffer?: boolean;
      /**
       * WebGL, WebGL2
       */
      failIfMajorPerformanceCaveat?: boolean;
      /**
       * WebGL, WebGL2
       */
      powerPreference?: string;
    }
    /**
     * Information about a canvas for which a rendering context has been created.
     */
    export interface Canvas {
      /**
       * Canvas identifier.
       */
      canvasId: CanvasId;
      /**
       * The type of rendering context backing the canvas.
       */
      contextType: ContextType;
      /**
       * The corresponding DOM node id.
       */
      nodeId?: DOM.NodeId;
      /**
       * The CSS canvas identifier, for canvases created with <code>document.getCSSCanvasContext</code>.
       */
      cssCanvasName?: string;
      /**
       * Context attributes for rendering contexts.
       */
      contextAttributes?: ContextAttributes;
      /**
       * Memory usage of the canvas in bytes.
       */
      memoryCost?: number;
      /**
       * Backtrace that was captured when this canvas context was created.
       */
      backtrace?: Console.CallFrame[];
    }
    /**
     * Information about a WebGL/WebGL2 shader program.
     */
    export interface ShaderProgram {
      programId: ProgramId;
      programType: ProgramType;
      canvasId: CanvasId;
    }
    
    export type canvasAddedPayload = {
      /**
       * Canvas object.
       */
      canvas: Canvas;
    }
    export type canvasRemovedPayload = {
      /**
       * Removed canvas identifier.
       */
      canvasId: CanvasId;
    }
    export type canvasMemoryChangedPayload = {
      /**
       * Identifier of canvas that changed.
       */
      canvasId: CanvasId;
      /**
       * New memory cost value for the canvas in bytes.
       */
      memoryCost: number;
    }
    export type extensionEnabledPayload = {
      canvasId: CanvasId;
      /**
       * Name of the extension that was enabled.
       */
      extension: string;
    }
    export type clientNodesChangedPayload = {
      /**
       * Identifier of canvas that changed.
       */
      canvasId: CanvasId;
    }
    export type recordingStartedPayload = {
      canvasId: CanvasId;
      initiator: Recording.Initiator;
    }
    export type recordingProgressPayload = {
      canvasId: CanvasId;
      frames: Recording.Frame[];
      /**
       * Total memory size in bytes of all data recorded since the recording began.
       */
      bufferUsed: number;
    }
    export type recordingFinishedPayload = {
      canvasId: CanvasId;
      recording?: Recording.Recording;
    }
    export type programCreatedPayload = {
      shaderProgram: ShaderProgram;
    }
    export type programDeletedPayload = {
      programId: ProgramId;
    }
    
    /**
     * Enables Canvas domain events.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables Canvas domain events.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Gets the NodeId for the canvas node with the given CanvasId.
     */
    export type requestNodeParameters = {
      /**
       * Canvas identifier.
       */
      canvasId: CanvasId;
    }
    export type requestNodeReturnValue = {
      /**
       * Node identifier for given canvas.
       */
      nodeId: DOM.NodeId;
    }
    /**
     * Gets the data for the canvas node with the given CanvasId.
     */
    export type requestContentParameters = {
      /**
       * Canvas identifier.
       */
      canvasId: CanvasId;
    }
    export type requestContentReturnValue = {
      /**
       * Base64-encoded data of the canvas' contents.
       */
      content: string;
    }
    /**
     * Gets all <code>-webkit-canvas</code> nodes or active <code>HTMLCanvasElement</code> for a <code>WebGPUDevice</code>.
     */
    export type requestClientNodesParameters = {
      canvasId: CanvasId;
    }
    export type requestClientNodesReturnValue = {
      clientNodeIds: DOM.NodeId[];
    }
    /**
     * Resolves JavaScript canvas/device context object for given canvasId.
     */
    export type resolveContextParameters = {
      /**
       * Canvas identifier.
       */
      canvasId: CanvasId;
      /**
       * Symbolic group name that can be used to release multiple objects.
       */
      objectGroup?: string;
    }
    export type resolveContextReturnValue = {
      /**
       * JavaScript object wrapper for given canvas context.
       */
      object: Runtime.RemoteObject;
    }
    /**
     * Tells the backend to record `count` frames whenever a new context is created.
     */
    export type setRecordingAutoCaptureFrameCountParameters = {
      /**
       * Number of frames to record (0 means don't record anything).
       */
      count: number;
    }
    export type setRecordingAutoCaptureFrameCountReturnValue = {
    }
    /**
     * Record the next frame, or up to the given number of bytes of data, for the given canvas.
     */
    export type startRecordingParameters = {
      canvasId: CanvasId;
      /**
       * Number of frames to record (unlimited when not specified).
       */
      frameCount?: number;
      /**
       * Memory limit of recorded data (100MB when not specified).
       */
      memoryLimit?: number;
    }
    export type startRecordingReturnValue = {
    }
    /**
     * Stop recording the given canvas.
     */
    export type stopRecordingParameters = {
      canvasId: CanvasId;
    }
    export type stopRecordingReturnValue = {
    }
    /**
     * Requests the source of the shader of the given type from the program with the given id.
     */
    export type requestShaderSourceParameters = {
      programId: ProgramId;
      shaderType: ShaderType;
    }
    export type requestShaderSourceReturnValue = {
      source: string;
    }
    /**
     * Compiles and links the shader with identifier and type with the given source code.
     */
    export type updateShaderParameters = {
      programId: ProgramId;
      shaderType: ShaderType;
      source: string;
    }
    export type updateShaderReturnValue = {
    }
    /**
     * Enable/disable the visibility of the given shader program.
     */
    export type setShaderProgramDisabledParameters = {
      programId: ProgramId;
      disabled: boolean;
    }
    export type setShaderProgramDisabledReturnValue = {
    }
    /**
     * Enable/disable highlighting of the given shader program.
     */
    export type setShaderProgramHighlightedParameters = {
      programId: ProgramId;
      highlighted: boolean;
    }
    export type setShaderProgramHighlightedReturnValue = {
    }
  }
  
  /**
   * Console domain defines methods and events for interaction with the JavaScript console. Console collects messages created by means of the <a href='http://getfirebug.com/wiki/index.php/Console_API'>JavaScript Console API</a>. One needs to enable this domain using <code>enable</code> command in order to start receiving the console messages. Browser collects messages issued while console domain is not enabled as well and reports them using <code>messageAdded</code> notification upon enabling.
   */
  export module Console {
    /**
     * Channels for different types of log messages.
     */
    export type ChannelSource = "xml"|"javascript"|"network"|"console-api"|"storage"|"appcache"|"rendering"|"css"|"security"|"content-blocker"|"media"|"mediasource"|"webrtc"|"itp-debug"|"private-click-measurement"|"payment-request"|"other";
    /**
     * Level of logging.
     */
    export type ChannelLevel = "off"|"basic"|"verbose";
    /**
     * Logging channel.
     */
    export interface Channel {
      source: ChannelSource;
      level: ChannelLevel;
    }
    /**
     * Console message.
     */
    export interface ConsoleMessage {
      source: ChannelSource;
      /**
       * Message severity.
       */
      level: "log"|"info"|"warning"|"error"|"debug";
      /**
       * Message text.
       */
      text: string;
      /**
       * Console message type.
       */
      type?: "log"|"dir"|"dirxml"|"table"|"trace"|"clear"|"startGroup"|"startGroupCollapsed"|"endGroup"|"assert"|"timing"|"profile"|"profileEnd"|"image";
      /**
       * URL of the message origin.
       */
      url?: string;
      /**
       * Line number in the resource that generated this message.
       */
      line?: number;
      /**
       * Column number on the line in the resource that generated this message.
       */
      column?: number;
      /**
       * Repeat count for repeated messages.
       */
      repeatCount?: number;
      /**
       * Message parameters in case of the formatted message.
       */
      parameters?: Runtime.RemoteObject[];
      /**
       * JavaScript stack trace for assertions and error messages.
       */
      stackTrace?: CallFrame[];
      /**
       * Identifier of the network request associated with this message.
       */
      networkRequestId?: Network.RequestId;
    }
    /**
     * Stack entry for console errors and assertions.
     */
    export interface CallFrame {
      /**
       * JavaScript function name.
       */
      functionName: string;
      /**
       * JavaScript script name or url.
       */
      url: string;
      /**
       * Script identifier.
       */
      scriptId: Debugger.ScriptId;
      /**
       * JavaScript script line number.
       */
      lineNumber: number;
      /**
       * JavaScript script column number.
       */
      columnNumber: number;
    }
    /**
     * Call frames for async function calls, console assertions, and error messages.
     */
    export interface StackTrace {
      callFrames: CallFrame[];
      /**
       * Whether the first item in <code>callFrames</code> is the native function that scheduled the asynchronous operation (e.g. setTimeout).
       */
      topCallFrameIsBoundary?: boolean;
      /**
       * Whether one or more frames have been truncated from the bottom of the stack.
       */
      truncated?: boolean;
      /**
       * Parent StackTrace.
       */
      parentStackTrace?: StackTrace;
    }
    
    /**
     * Issued when new console message is added.
     */
    export type messageAddedPayload = {
      /**
       * Console message that has been added.
       */
      message: ConsoleMessage;
    }
    /**
     * Issued when subsequent message(s) are equal to the previous one(s).
     */
    export type messageRepeatCountUpdatedPayload = {
      /**
       * New repeat count value.
       */
      count: number;
    }
    /**
     * Issued when console is cleared. This happens either upon <code>clearMessages</code> command or after page navigation.
     */
    export type messagesClearedPayload = void;
    /**
     * Issued from console.takeHeapSnapshot.
     */
    export type heapSnapshotPayload = {
      timestamp: number;
      /**
       * Snapshot at the end of tracking.
       */
      snapshotData: Heap.HeapSnapshotData;
      /**
       * Optional title provided to console.takeHeapSnapshot.
       */
      title?: string;
    }
    
    /**
     * Enables console domain, sends the messages collected so far to the client by means of the <code>messageAdded</code> notification.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables console domain, prevents further console messages from being reported to the client.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Clears console messages collected in the browser.
     */
    export type clearMessagesParameters = {
    }
    export type clearMessagesReturnValue = {
    }
    /**
     * List of the different message sources that are non-default logging channels.
     */
    export type getLoggingChannelsParameters = {
    }
    export type getLoggingChannelsReturnValue = {
      /**
       * Logging channels.
       */
      channels: Channel[];
    }
    /**
     * Modify the level of a channel.
     */
    export type setLoggingChannelLevelParameters = {
      /**
       * Logging channel to modify.
       */
      source: ChannelSource;
      /**
       * New level.
       */
      level: ChannelLevel;
    }
    export type setLoggingChannelLevelReturnValue = {
    }
  }
  
  /**
   * This domain exposes DOM read/write operations. Each DOM Node is represented with its mirror object that has an <code>id</code>. This <code>id</code> can be used to get additional information on the Node, resolve it into the JavaScript object wrapper, etc. It is important that client receives DOM events only for the nodes that are known to the client. Backend keeps track of the nodes that were sent to the client and never sends the same node twice. It is client's responsibility to collect information about the nodes that were sent to the client.<p>Note that <code>iframe</code> owner elements will return corresponding document elements as their child nodes.</p>
   */
  export module DOM {
    /**
     * Unique DOM node identifier.
     */
    export type NodeId = number;
    /**
     * Unique event listener identifier.
     */
    export type EventListenerId = number;
    /**
     * Pseudo element type.
     */
    export type PseudoType = "before"|"after";
    /**
     * Shadow root type.
     */
    export type ShadowRootType = "user-agent"|"open"|"closed";
    /**
     * Custom element state.
     */
    export type CustomElementState = "builtin"|"custom"|"waiting"|"failed";
    /**
     * Token values of @aria-relevant attribute.
     */
    export type LiveRegionRelevant = "additions"|"removals"|"text";
    /**
     * DOM interaction is implemented in terms of mirror objects that represent the actual DOM nodes. DOMNode is a base node mirror type.
     */
    export interface Node {
      /**
       * Node identifier that is passed into the rest of the DOM messages as the <code>nodeId</code>. Backend will only push node with given <code>id</code> once. It is aware of all requested nodes and will only fire DOM events for nodes known to the client.
       */
      nodeId: NodeId;
      /**
       * <code>Node</code>'s nodeType.
       */
      nodeType: number;
      /**
       * <code>Node</code>'s nodeName.
       */
      nodeName: string;
      /**
       * <code>Node</code>'s localName.
       */
      localName: string;
      /**
       * <code>Node</code>'s nodeValue.
       */
      nodeValue: string;
      /**
       * Identifier of the containing frame.
       */
      frameId?: Network.FrameId;
      /**
       * Child count for <code>Container</code> nodes.
       */
      childNodeCount?: number;
      /**
       * Child nodes of this node when requested with children.
       */
      children?: Node[];
      /**
       * Attributes of the <code>Element</code> node in the form of flat array <code>[name1, value1, name2, value2]</code>.
       */
      attributes?: string[];
      /**
       * Document URL that <code>Document</code> or <code>FrameOwner</code> node points to.
       */
      documentURL?: string;
      /**
       * Base URL that <code>Document</code> or <code>FrameOwner</code> node uses for URL completion.
       */
      baseURL?: string;
      /**
       * <code>DocumentType</code>'s publicId.
       */
      publicId?: string;
      /**
       * <code>DocumentType</code>'s systemId.
       */
      systemId?: string;
      /**
       * <code>Document</code>'s XML version in case of XML documents.
       */
      xmlVersion?: string;
      /**
       * <code>Attr</code>'s name.
       */
      name?: string;
      /**
       * <code>Attr</code>'s value.
       */
      value?: string;
      /**
       * Pseudo element type for this node.
       */
      pseudoType?: PseudoType;
      /**
       * Shadow root type.
       */
      shadowRootType?: ShadowRootType;
      /**
       * Custom element state.
       */
      customElementState?: CustomElementState;
      /**
       * Content document for frame owner elements.
       */
      contentDocument?: Node;
      /**
       * Shadow root list for given element host.
       */
      shadowRoots?: Node[];
      /**
       * Content document fragment for template elements
       */
      templateContent?: Node;
      /**
       * Pseudo elements associated with this node.
       */
      pseudoElements?: Node[];
      /**
       * Computed SHA-256 Content Security Policy hash source for given element.
       */
      contentSecurityPolicyHash?: string;
      /**
       * The layout context type of the node. When not provided, the <code>LayoutContextType</code> of the node is not a context for which Web Inspector has specific functionality.
       */
      layoutContextType?: CSS.LayoutContextType;
    }
    /**
     * Relationship between data that is associated with a node and the node itself.
     */
    export interface DataBinding {
      /**
       * The binding key that is specified.
       */
      binding: string;
      /**
       * A more descriptive name for the type of binding that represents this paritcular data relationship
       */
      type?: string;
      /**
       * The value that is resolved to with this data binding relationship.
       */
      value: string;
    }
    export interface Rect {
      /**
       * X coordinate
       */
      x: number;
      /**
       * Y coordinate
       */
      y: number;
      /**
       * Rectangle width
       */
      width: number;
      /**
       * Rectangle height
       */
      height: number;
    }
    /**
     * A structure holding event listener properties.
     */
    export interface EventListener {
      eventListenerId: EventListenerId;
      /**
       * <code>EventListener</code>'s type.
       */
      type: string;
      /**
       * <code>EventListener</code>'s useCapture.
       */
      useCapture: boolean;
      /**
       * <code>EventListener</code>'s isAttribute.
       */
      isAttribute: boolean;
      /**
       * The target <code>DOMNode</code> id if the event listener is for a node.
       */
      nodeId?: NodeId;
      /**
       * True if the event listener was added to the window.
       */
      onWindow?: boolean;
      /**
       * Handler code location.
       */
      location?: Debugger.Location;
      /**
       * Event handler function name.
       */
      handlerName?: string;
      /**
       * <code>EventListener</code>'s passive.
       */
      passive?: boolean;
      /**
       * <code>EventListener</code>'s once.
       */
      once?: boolean;
      disabled?: boolean;
      hasBreakpoint?: boolean;
    }
    /**
     * A structure holding accessibility properties.
     */
    export interface AccessibilityProperties {
      /**
       * <code>DOMNode</code> id of the accessibility object referenced by aria-activedescendant.
       */
      activeDescendantNodeId?: NodeId;
      /**
       * Value of @aria-busy on current or ancestor node.
       */
      busy?: boolean;
      /**
       * Checked state of certain form controls.
       */
      checked?: "true"|"false"|"mixed";
      /**
       * Array of <code>DOMNode</code> ids of the accessibility tree children if available.
       */
      childNodeIds?: NodeId[];
      /**
       * Array of <code>DOMNode</code> ids of any nodes referenced via @aria-controls.
       */
      controlledNodeIds?: NodeId[];
      /**
       * Current item within a container or set of related elements.
       */
      current?: "true"|"false"|"page"|"step"|"location"|"date"|"time";
      /**
       * Disabled state of form controls.
       */
      disabled?: boolean;
      /**
       * Heading level of a heading element.
       */
      headingLevel?: number;
      /**
       * The hierarchical level of an element.
       */
      hierarchyLevel?: number;
      /**
       * Whether an element is a popup button.
       */
      isPopUpButton?: boolean;
      /**
       * Indicates whether there is an existing AX object for the DOM node. If this is false, all the other properties will be default values.
       */
      exists: boolean;
      /**
       * Expanded state.
       */
      expanded?: boolean;
      /**
       * Array of <code>DOMNode</code> ids of any nodes referenced via @aria-flowto.
       */
      flowedNodeIds?: NodeId[];
      /**
       * Focused state. Only defined on focusable elements.
       */
      focused?: boolean;
      /**
       * Indicates whether the accessibility of the associated AX object node is ignored, whether heuristically or explicitly.
       */
      ignored?: boolean;
      /**
       * State indicating whether the accessibility of the associated AX object node is ignored by default for node type.
       */
      ignoredByDefault?: boolean;
      /**
       * Invalid status of form controls.
       */
      invalid?: "true"|"false"|"grammar"|"spelling";
      /**
       * Hidden state. True if node or an ancestor is hidden via CSS or explicit @aria-hidden, to clarify why the element is ignored.
       */
      hidden?: boolean;
      /**
       * Computed label value for the node, sometimes calculated by referencing other nodes.
       */
      label: string;
      /**
       * Value of @aria-atomic.
       */
      liveRegionAtomic?: boolean;
      /**
       * Token value(s) of element's @aria-relevant attribute. Array of string values matching $ref LiveRegionRelevant. FIXME: Enum values blocked by http://webkit.org/b/133711
       */
      liveRegionRelevant?: string[];
      /**
       * Value of element's @aria-live attribute.
       */
      liveRegionStatus?: "assertive"|"polite"|"off";
      /**
       * <code>DOMNode</code> id of node or closest ancestor node that has a mousedown, mouseup, or click event handler.
       */
      mouseEventNodeId?: NodeId;
      /**
       * Target <code>DOMNode</code> id.
       */
      nodeId: NodeId;
      /**
       * Array of <code>DOMNode</code> ids of any nodes referenced via @aria-owns.
       */
      ownedNodeIds?: NodeId[];
      /**
       * <code>DOMNode</code> id of the accessibility tree parent object if available.
       */
      parentNodeId?: NodeId;
      /**
       * Pressed state for toggle buttons.
       */
      pressed?: boolean;
      /**
       * Readonly state of text controls.
       */
      readonly?: boolean;
      /**
       * Required state of form controls.
       */
      required?: boolean;
      /**
       * Computed value for first recognized role token, default role per element, or overridden role.
       */
      role: string;
      /**
       * Selected state of certain form controls.
       */
      selected?: boolean;
      /**
       * Array of <code>DOMNode</code> ids of any children marked as selected.
       */
      selectedChildNodeIds?: NodeId[];
    }
    /**
     * A structure holding an RGBA color.
     */
    export interface RGBAColor {
      /**
       * The red component, in the [0-255] range.
       */
      r: number;
      /**
       * The green component, in the [0-255] range.
       */
      g: number;
      /**
       * The blue component, in the [0-255] range.
       */
      b: number;
      /**
       * The alpha component, in the [0-1] range (default: 1).
       */
      a?: number;
    }
    /**
     * An array of quad vertices, x immediately followed by y for each point, points clock-wise.
     */
    export type Quad = number[];
    /**
     * Configuration data for the highlighting of page elements.
     */
    export interface HighlightConfig {
      /**
       * Whether the node info tooltip should be shown (default: false).
       */
      showInfo?: boolean;
      /**
       * The content box highlight fill color (default: transparent).
       */
      contentColor?: RGBAColor;
      /**
       * The padding highlight fill color (default: transparent).
       */
      paddingColor?: RGBAColor;
      /**
       * The border highlight fill color (default: transparent).
       */
      borderColor?: RGBAColor;
      /**
       * The margin highlight fill color (default: transparent).
       */
      marginColor?: RGBAColor;
    }
    /**
     * An object referencing a node and a pseudo-element, primarily used to identify an animation effect target.
     */
    export interface Styleable {
      nodeId: NodeId;
      pseudoId?: CSS.PseudoId;
    }
    /**
     * Data to construct File object.
     */
    export interface FilePayload {
      /**
       * File name.
       */
      name: string;
      /**
       * File type.
       */
      type: string;
      /**
       * Base64-encoded file data.
       */
      data: string;
    }
    
    /**
     * Fired when <code>Document</code> has been totally updated. Node ids are no longer valid.
     */
    export type documentUpdatedPayload = void;
    /**
     * Inspect a particular node.
     */
    export type inspectPayload = {
      /**
       * Equivalent of Inspector.inspect but with a nodeId instead of a RemoteObject. Useful for augmented contexts.
       */
      nodeId: NodeId;
    }
    /**
     * Fired when backend wants to provide client with the missing DOM structure. This happens upon most of the calls requesting node ids.
     */
    export type setChildNodesPayload = {
      /**
       * Parent node id to populate with children.
       */
      parentId: NodeId;
      /**
       * Child nodes array.
       */
      nodes: Node[];
    }
    /**
     * Fired when <code>Element</code>'s attribute is modified.
     */
    export type attributeModifiedPayload = {
      /**
       * Id of the node that has changed.
       */
      nodeId: NodeId;
      /**
       * Attribute name.
       */
      name: string;
      /**
       * Attribute value.
       */
      value: string;
    }
    /**
     * Fired when <code>Element</code>'s attribute is removed.
     */
    export type attributeRemovedPayload = {
      /**
       * Id of the node that has changed.
       */
      nodeId: NodeId;
      /**
       * Attribute name.
       */
      name: string;
    }
    /**
     * Fired when <code>Element</code>'s inline style is modified via a CSS property modification.
     */
    export type inlineStyleInvalidatedPayload = {
      /**
       * Ids of the nodes for which the inline styles have been invalidated.
       */
      nodeIds: NodeId[];
    }
    /**
     * Mirrors <code>DOMCharacterDataModified</code> event.
     */
    export type characterDataModifiedPayload = {
      /**
       * Id of the node that has changed.
       */
      nodeId: NodeId;
      /**
       * New text value.
       */
      characterData: string;
    }
    /**
     * Fired when <code>Container</code>'s child node count has changed.
     */
    export type childNodeCountUpdatedPayload = {
      /**
       * Id of the node that has changed.
       */
      nodeId: NodeId;
      /**
       * New node count.
       */
      childNodeCount: number;
    }
    /**
     * Mirrors <code>DOMNodeInserted</code> event.
     */
    export type childNodeInsertedPayload = {
      /**
       * Id of the node that has changed.
       */
      parentNodeId: NodeId;
      /**
       * Id of the previous sibling.
       */
      previousNodeId: NodeId;
      /**
       * Inserted node data.
       */
      node: Node;
    }
    /**
     * Mirrors <code>DOMNodeRemoved</code> event.
     */
    export type childNodeRemovedPayload = {
      /**
       * Parent id.
       */
      parentNodeId: NodeId;
      /**
       * Id of the node that has been removed.
       */
      nodeId: NodeId;
    }
    /**
     * Fired when a detached DOM node is about to be destroyed. Currently, this event will only be fired when a DOM node that is detached is about to be destructed.
     */
    export type willDestroyDOMNodePayload = {
      /**
       * Id of the node that will be destroyed.
       */
      nodeId: NodeId;
    }
    /**
     * Called when shadow root is pushed into the element.
     */
    export type shadowRootPushedPayload = {
      /**
       * Host element id.
       */
      hostId: NodeId;
      /**
       * Shadow root.
       */
      root: Node;
    }
    /**
     * Called when shadow root is popped from the element.
     */
    export type shadowRootPoppedPayload = {
      /**
       * Host element id.
       */
      hostId: NodeId;
      /**
       * Shadow root id.
       */
      rootId: NodeId;
    }
    /**
     * Called when the custom element state is changed.
     */
    export type customElementStateChangedPayload = {
      /**
       * Element id.
       */
      nodeId: NodeId;
      /**
       * Custom element state.
       */
      customElementState: CustomElementState;
    }
    /**
     * Called when a pseudo element is added to an element.
     */
    export type pseudoElementAddedPayload = {
      /**
       * Pseudo element's parent element id.
       */
      parentId: NodeId;
      /**
       * The added pseudo element.
       */
      pseudoElement: Node;
    }
    /**
     * Called when a pseudo element is removed from an element.
     */
    export type pseudoElementRemovedPayload = {
      /**
       * Pseudo element's parent element id.
       */
      parentId: NodeId;
      /**
       * The removed pseudo element id.
       */
      pseudoElementId: NodeId;
    }
    /**
     * Called when an event listener is added to a node.
     */
    export type didAddEventListenerPayload = {
      nodeId: NodeId;
    }
    /**
     * Called after a request has been made to remove an event listener from a node.
     */
    export type willRemoveEventListenerPayload = {
      nodeId: NodeId;
    }
    /**
     * Called when an event is fired on a node.
     */
    export type didFireEventPayload = {
      nodeId: NodeId;
      eventName: string;
      /**
       * Time when the event was fired
       */
      timestamp: Network.Timestamp;
      /**
       * Holds ancillary information about the event or its target.
       */
      data?: { [key: string]: string };
    }
    /**
     * Called when an element enters/exits a power efficient playback state.
     */
    export type powerEfficientPlaybackStateChangedPayload = {
      nodeId: NodeId;
      timestamp: Network.Timestamp;
      isPowerEfficient: boolean;
    }
    
    /**
     * Returns the root DOM node to the caller.
     */
    export type getDocumentParameters = {
    }
    export type getDocumentReturnValue = {
      /**
       * Resulting node.
       */
      root: Node;
    }
    /**
     * Requests that children of the node with given id are returned to the caller in form of <code>setChildNodes</code> events where not only immediate children are retrieved, but all children down to the specified depth.
     */
    export type requestChildNodesParameters = {
      /**
       * Id of the node to get children for.
       */
      nodeId: NodeId;
      /**
       * The maximum depth at which children should be retrieved, defaults to 1. Use -1 for the entire subtree or provide an integer larger than 0.
       */
      depth?: number;
    }
    export type requestChildNodesReturnValue = {
    }
    /**
     * Executes <code>querySelector</code> on a given node.
     */
    export type querySelectorParameters = {
      /**
       * Id of the node to query upon.
       */
      nodeId: NodeId;
      /**
       * Selector string.
       */
      selector: string;
    }
    export type querySelectorReturnValue = {
      /**
       * Query selector result.
       */
      nodeId: NodeId;
    }
    /**
     * Executes <code>querySelectorAll</code> on a given node.
     */
    export type querySelectorAllParameters = {
      /**
       * Id of the node to query upon.
       */
      nodeId: NodeId;
      /**
       * Selector string.
       */
      selector: string;
    }
    export type querySelectorAllReturnValue = {
      /**
       * Query selector result.
       */
      nodeIds: NodeId[];
    }
    /**
     * Sets node name for a node with given id.
     */
    export type setNodeNameParameters = {
      /**
       * Id of the node to set name for.
       */
      nodeId: NodeId;
      /**
       * New node's name.
       */
      name: string;
    }
    export type setNodeNameReturnValue = {
      /**
       * New node's id.
       */
      nodeId: NodeId;
    }
    /**
     * Sets node value for a node with given id.
     */
    export type setNodeValueParameters = {
      /**
       * Id of the node to set value for.
       */
      nodeId: NodeId;
      /**
       * New node's value.
       */
      value: string;
    }
    export type setNodeValueReturnValue = {
    }
    /**
     * Removes node with given id.
     */
    export type removeNodeParameters = {
      /**
       * Id of the node to remove.
       */
      nodeId: NodeId;
    }
    export type removeNodeReturnValue = {
    }
    /**
     * Sets attribute for an element with given id.
     */
    export type setAttributeValueParameters = {
      /**
       * Id of the element to set attribute for.
       */
      nodeId: NodeId;
      /**
       * Attribute name.
       */
      name: string;
      /**
       * Attribute value.
       */
      value: string;
    }
    export type setAttributeValueReturnValue = {
    }
    /**
     * Sets attributes on element with given id. This method is useful when user edits some existing attribute value and types in several attribute name/value pairs.
     */
    export type setAttributesAsTextParameters = {
      /**
       * Id of the element to set attributes for.
       */
      nodeId: NodeId;
      /**
       * Text with a number of attributes. Will parse this text using HTML parser.
       */
      text: string;
      /**
       * Attribute name to replace with new attributes derived from text in case text parsed successfully.
       */
      name?: string;
    }
    export type setAttributesAsTextReturnValue = {
    }
    /**
     * Removes attribute with given name from an element with given id.
     */
    export type removeAttributeParameters = {
      /**
       * Id of the element to remove attribute from.
       */
      nodeId: NodeId;
      /**
       * Name of the attribute to remove.
       */
      name: string;
    }
    export type removeAttributeReturnValue = {
    }
    /**
     * Gets the list of builtin DOM event names.
     */
    export type getSupportedEventNamesParameters = {
    }
    export type getSupportedEventNamesReturnValue = {
      eventNames: string[];
    }
    /**
     * Returns all data binding relationships between data that is associated with the node and the node itself.
     */
    export type getDataBindingsForNodeParameters = {
      /**
       * Id of the node to get data bindings for.
       */
      nodeId: NodeId;
    }
    export type getDataBindingsForNodeReturnValue = {
      /**
       * Array of binding relationships between data and node
       */
      dataBindings: DataBinding[];
    }
    /**
     * Returns all data that has been associated with the node and is available for data binding.
     */
    export type getAssociatedDataForNodeParameters = {
      /**
       * Id of the node to get associated data for.
       */
      nodeId: NodeId;
    }
    export type getAssociatedDataForNodeReturnValue = {
      /**
       * Associated data bound to this node. Sent as a JSON string.
       */
      associatedData?: string;
    }
    /**
     * Returns event listeners relevant to the node.
     */
    export type getEventListenersForNodeParameters = {
      /**
       * Id of the node to get listeners for.
       */
      nodeId: NodeId;
    }
    export type getEventListenersForNodeReturnValue = {
      /**
       * Array of relevant listeners.
       */
      listeners: EventListener[];
    }
    /**
     * Enable/disable the given event listener. A disabled event listener will not fire.
     */
    export type setEventListenerDisabledParameters = {
      eventListenerId: EventListenerId;
      disabled: boolean;
    }
    export type setEventListenerDisabledReturnValue = {
    }
    /**
     * Set a breakpoint on the given event listener.
     */
    export type setBreakpointForEventListenerParameters = {
      eventListenerId: EventListenerId;
      /**
       * Options to apply to this breakpoint to modify its behavior.
       */
      options?: Debugger.BreakpointOptions;
    }
    export type setBreakpointForEventListenerReturnValue = {
    }
    /**
     * Remove any breakpoints on the given event listener.
     */
    export type removeBreakpointForEventListenerParameters = {
      eventListenerId: EventListenerId;
    }
    export type removeBreakpointForEventListenerReturnValue = {
    }
    /**
     * Returns a dictionary of accessibility properties for the node.
     */
    export type getAccessibilityPropertiesForNodeParameters = {
      /**
       * Id of the node for which to get accessibility properties.
       */
      nodeId: NodeId;
    }
    export type getAccessibilityPropertiesForNodeReturnValue = {
      /**
       * Dictionary of relevant accessibility properties.
       */
      properties: AccessibilityProperties;
    }
    /**
     * Returns node's HTML markup.
     */
    export type getOuterHTMLParameters = {
      /**
       * Id of the node to get markup for.
       */
      nodeId: NodeId;
    }
    export type getOuterHTMLReturnValue = {
      /**
       * Outer HTML markup.
       */
      outerHTML: string;
    }
    /**
     * Sets node HTML markup, returns new node id.
     */
    export type setOuterHTMLParameters = {
      /**
       * Id of the node to set markup for.
       */
      nodeId: NodeId;
      /**
       * Outer HTML markup to set.
       */
      outerHTML: string;
    }
    export type setOuterHTMLReturnValue = {
    }
    export type insertAdjacentHTMLParameters = {
      nodeId: NodeId;
      position: string;
      html: string;
    }
    export type insertAdjacentHTMLReturnValue = {
    }
    /**
     * Searches for a given string in the DOM tree. Use <code>getSearchResults</code> to access search results or <code>cancelSearch</code> to end this search session.
     */
    export type performSearchParameters = {
      /**
       * Plain text or query selector or XPath search query.
       */
      query: string;
      /**
       * Ids of nodes to use as starting points for the search.
       */
      nodeIds?: NodeId[];
      /**
       * If true, search is case sensitive.
       */
      caseSensitive?: boolean;
    }
    export type performSearchReturnValue = {
      /**
       * Unique search session identifier.
       */
      searchId: string;
      /**
       * Number of search results.
       */
      resultCount: number;
    }
    /**
     * Returns search results from given <code>fromIndex</code> to given <code>toIndex</code> from the sarch with the given identifier.
     */
    export type getSearchResultsParameters = {
      /**
       * Unique search session identifier.
       */
      searchId: string;
      /**
       * Start index of the search result to be returned.
       */
      fromIndex: number;
      /**
       * End index of the search result to be returned.
       */
      toIndex: number;
    }
    export type getSearchResultsReturnValue = {
      /**
       * Ids of the search result nodes.
       */
      nodeIds: NodeId[];
    }
    /**
     * Discards search results from the session with the given id. <code>getSearchResults</code> should no longer be called for that search.
     */
    export type discardSearchResultsParameters = {
      /**
       * Unique search session identifier.
       */
      searchId: string;
    }
    export type discardSearchResultsReturnValue = {
    }
    /**
     * Requests that the node is sent to the caller given the JavaScript node object reference. All nodes that form the path from the node to the root are also sent to the client as a series of <code>setChildNodes</code> notifications.
     */
    export type requestNodeParameters = {
      /**
       * JavaScript object id to convert into node.
       */
      objectId: Runtime.RemoteObjectId;
    }
    export type requestNodeReturnValue = {
      /**
       * Node id for given object.
       */
      nodeId: NodeId;
    }
    /**
     * Enters the 'inspect' mode. In this mode, elements that user is hovering over are highlighted. Backend then generates 'inspect' command upon element selection.
     */
    export type setInspectModeEnabledParameters = {
      /**
       * True to enable inspection mode, false to disable it.
       */
      enabled: boolean;
      /**
       * A descriptor for the highlight appearance of hovered-over nodes. May be omitted if <code>enabled == false</code>.
       */
      highlightConfig?: HighlightConfig;
      /**
       * Whether the rulers should be shown during element selection. This overrides Page.setShowRulers.
       */
      showRulers?: boolean;
    }
    export type setInspectModeEnabledReturnValue = {
    }
    /**
     * Highlights given rectangle. Coordinates are absolute with respect to the main frame viewport.
     */
    export type highlightRectParameters = {
      /**
       * X coordinate
       */
      x: number;
      /**
       * Y coordinate
       */
      y: number;
      /**
       * Rectangle width
       */
      width: number;
      /**
       * Rectangle height
       */
      height: number;
      /**
       * The highlight fill color (default: transparent).
       */
      color?: RGBAColor;
      /**
       * The highlight outline color (default: transparent).
       */
      outlineColor?: RGBAColor;
      /**
       * Indicates whether the provided parameters are in page coordinates or in viewport coordinates (the default).
       */
      usePageCoordinates?: boolean;
    }
    export type highlightRectReturnValue = {
    }
    /**
     * Highlights given quad. Coordinates are absolute with respect to the main frame viewport.
     */
    export type highlightQuadParameters = {
      /**
       * Quad to highlight
       */
      quad: Quad;
      /**
       * The highlight fill color (default: transparent).
       */
      color?: RGBAColor;
      /**
       * The highlight outline color (default: transparent).
       */
      outlineColor?: RGBAColor;
      /**
       * Indicates whether the provided parameters are in page coordinates or in viewport coordinates (the default).
       */
      usePageCoordinates?: boolean;
    }
    export type highlightQuadReturnValue = {
    }
    /**
     * Highlights all DOM nodes that match a given selector. A string containing a CSS selector must be specified.
     */
    export type highlightSelectorParameters = {
      /**
       * A descriptor for the highlight appearance.
       */
      highlightConfig: HighlightConfig;
      /**
       * A CSS selector for finding matching nodes to highlight.
       */
      selectorString: string;
      /**
       * Identifier of the frame which will be searched using the selector.  If not provided, the main frame will be used.
       */
      frameId?: string;
    }
    export type highlightSelectorReturnValue = {
    }
    /**
     * Highlights DOM node with given id or with the given JavaScript object wrapper. Either nodeId or objectId must be specified.
     */
    export type highlightNodeParameters = {
      /**
       * A descriptor for the highlight appearance.
       */
      highlightConfig: HighlightConfig;
      /**
       * Identifier of the node to highlight.
       */
      nodeId?: NodeId;
      /**
       * JavaScript object id of the node to be highlighted.
       */
      objectId?: Runtime.RemoteObjectId;
    }
    export type highlightNodeReturnValue = {
    }
    /**
     * Highlights each DOM node in the given list.
     */
    export type highlightNodeListParameters = {
      nodeIds: NodeId[];
      highlightConfig: HighlightConfig;
    }
    export type highlightNodeListReturnValue = {
    }
    /**
     * Hides DOM node highlight.
     */
    export type hideHighlightParameters = {
    }
    export type hideHighlightReturnValue = {
    }
    /**
     * Highlights owner element of the frame with given id.
     */
    export type highlightFrameParameters = {
      /**
       * Identifier of the frame to highlight.
       */
      frameId: Network.FrameId;
      /**
       * The content box highlight fill color (default: transparent).
       */
      contentColor?: RGBAColor;
      /**
       * The content box highlight outline color (default: transparent).
       */
      contentOutlineColor?: RGBAColor;
    }
    export type highlightFrameReturnValue = {
    }
    /**
     * Shows a grid overlay for a node that begins a 'grid' layout context. The command has no effect if <code>nodeId</code> is invalid or the associated node does not begin a 'grid' layout context. A node can only have one grid overlay at a time; subsequent calls with the same <code>nodeId</code> will override earlier calls.
     */
    export type showGridOverlayParameters = {
      /**
       * The node for which a grid overlay should be shown.
       */
      nodeId: NodeId;
      /**
       * The primary color to use for the grid overlay.
       */
      gridColor: RGBAColor;
      /**
       * Show labels for grid line names. If not specified, the default value is false.
       */
      showLineNames?: boolean;
      /**
       * Show labels for grid line numbers. If not specified, the default value is false.
       */
      showLineNumbers?: boolean;
      /**
       * Show grid lines that extend beyond the bounds of the grid. If not specified, the default value is false.
       */
      showExtendedGridLines?: boolean;
      /**
       * Show grid track size information. If not specified, the default value is false.
       */
      showTrackSizes?: boolean;
      /**
       * Show labels for grid area names. If not specified, the default value is false.
       */
      showAreaNames?: boolean;
    }
    export type showGridOverlayReturnValue = {
    }
    /**
     * Hides a grid overlay for a node that begins a 'grid' layout context. The command has no effect if <code>nodeId</code> is specified and invalid, or if there is not currently an overlay set for the <code>nodeId</code>.
     */
    export type hideGridOverlayParameters = {
      /**
       * The node for which a grid overlay should be hidden. If a <code>nodeId</code> is not specified, all grid overlays will be hidden.
       */
      nodeId?: NodeId;
    }
    export type hideGridOverlayReturnValue = {
    }
    /**
     * Shows a flex overlay for a node that begins a 'flex' layout context. The command has no effect if <code>nodeId</code> is invalid or the associated node does not begin a 'flex' layout context. A node can only have one flex overlay at a time; subsequent calls with the same <code>nodeId</code> will override earlier calls.
     */
    export type showFlexOverlayParameters = {
      /**
       * The node for which a flex overlay should be shown.
       */
      nodeId: NodeId;
      /**
       * The primary color to use for the flex overlay.
       */
      flexColor: RGBAColor;
      /**
       * Show labels for flex order. If not specified, the default value is false.
       */
      showOrderNumbers?: boolean;
    }
    export type showFlexOverlayReturnValue = {
    }
    /**
     * Hides a flex overlay for a node that begins a 'flex' layout context. The command has no effect if <code>nodeId</code> is specified and invalid, or if there is not currently an overlay set for the <code>nodeId</code>.
     */
    export type hideFlexOverlayParameters = {
      /**
       * The node for which a flex overlay should be hidden. If a <code>nodeId</code> is not specified, all flex overlays will be hidden.
       */
      nodeId?: NodeId;
    }
    export type hideFlexOverlayReturnValue = {
    }
    /**
     * Requests that the node is sent to the caller given its path.
     */
    export type pushNodeByPathToFrontendParameters = {
      /**
       * Path to node in the proprietary format.
       */
      path: string;
    }
    export type pushNodeByPathToFrontendReturnValue = {
      /**
       * Id of the node for given path.
       */
      nodeId: NodeId;
    }
    /**
     * Resolves JavaScript node object for given node id.
     */
    export type resolveNodeParameters = {
      /**
       * Id of the node to resolve.
       */
      nodeId?: NodeId;
      /**
       * Source element handle.
       */
      objectId?: Runtime.RemoteObjectId;
      /**
       * Specifies in which execution context to adopt to.
       */
      executionContextId?: Runtime.ExecutionContextId;
      /**
       * Symbolic group name that can be used to release multiple objects.
       */
      objectGroup?: string;
    }
    export type resolveNodeReturnValue = {
      /**
       * JavaScript object wrapper for given node.
       */
      object: Runtime.RemoteObject;
    }
    /**
     * Returns attributes for the specified node.
     */
    export type getAttributesParameters = {
      /**
       * Id of the node to retrieve attributes for.
       */
      nodeId: NodeId;
    }
    export type getAttributesReturnValue = {
      /**
       * An interleaved array of node attribute names and values.
       */
      attributes: string[];
    }
    /**
     * Moves node into the new container, places it before the given anchor.
     */
    export type moveToParameters = {
      /**
       * Id of the node to drop.
       */
      nodeId: NodeId;
      /**
       * Id of the element to drop into.
       */
      targetNodeId: NodeId;
      /**
       * Drop node before given one.
       */
      insertBeforeNodeId?: NodeId;
    }
    export type moveToReturnValue = {
      /**
       * New id of the moved node.
       */
      nodeId: NodeId;
    }
    /**
     * Undoes the last performed action.
     */
    export type undoParameters = {
    }
    export type undoReturnValue = {
    }
    /**
     * Re-does the last undone action.
     */
    export type redoParameters = {
    }
    export type redoReturnValue = {
    }
    /**
     * Marks last undoable state.
     */
    export type markUndoableStateParameters = {
    }
    export type markUndoableStateReturnValue = {
    }
    /**
     * Focuses the given element.
     */
    export type focusParameters = {
      /**
       * Id of the node to focus.
       */
      nodeId: NodeId;
    }
    export type focusReturnValue = {
    }
    /**
     * Enables console to refer to the node with given id via $0 (see Command Line API for more details).
     */
    export type setInspectedNodeParameters = {
      /**
       * DOM node id to be accessible by means of $0 command line API.
       */
      nodeId: NodeId;
    }
    export type setInspectedNodeReturnValue = {
    }
    /**
     * Controls whether any DOM commands work for nodes inside a UserAgent shadow tree.
     */
    export type setAllowEditingUserAgentShadowTreesParameters = {
      allow: boolean;
    }
    export type setAllowEditingUserAgentShadowTreesReturnValue = {
    }
    /**
     * Returns node description.
     */
    export type describeNodeParameters = {
      /**
       * JavaScript object id of the node wrapper.
       */
      objectId: Runtime.RemoteObjectId;
    }
    export type describeNodeReturnValue = {
      /**
       * Frame ID for frame owner elements.
       */
      contentFrameId?: Network.FrameId;
      /**
       * ID of the owning frame element.
       */
      ownerFrameId?: Network.FrameId;
    }
    /**
     * Scrolls the given rect into view if not already in the viewport.
     */
    export type scrollIntoViewIfNeededParameters = {
      /**
       * JavaScript object id of the node wrapper.
       */
      objectId: Runtime.RemoteObjectId;
      /**
       * Rect relative to the node's border box, in CSS pixels.
       */
      rect?: Rect;
    }
    export type scrollIntoViewIfNeededReturnValue = {
    }
    /**
     * Returns quads that describe node position on the page. This method
might return multiple quads for inline nodes.
     */
    export type getContentQuadsParameters = {
      /**
       * JavaScript object id of the node wrapper.
       */
      objectId: Runtime.RemoteObjectId;
    }
    export type getContentQuadsReturnValue = {
      /**
       * Quads that describe node layout relative to viewport.
       */
      quads: Quad[];
    }
    /**
     * Sets input files for given <input type=file>
     */
    export type setInputFilesParameters = {
      /**
       * Input element handle.
       */
      objectId: Runtime.RemoteObjectId;
      /**
       * Files to set
       */
      files?: FilePayload[];
      /**
       * File paths to set
       */
      paths?: string[];
    }
    export type setInputFilesReturnValue = {
    }
  }
  
  /**
   * DOM debugging allows setting breakpoints on particular DOM operations and events. JavaScript execution will stop on these operations as if there was a regular breakpoint set.
   */
  export module DOMDebugger {
    /**
     * DOM breakpoint type.
     */
    export type DOMBreakpointType = "subtree-modified"|"attribute-modified"|"node-removed";
    /**
     * Event breakpoint type.
     */
    export type EventBreakpointType = "animation-frame"|"interval"|"listener"|"timeout";
    
    
    /**
     * Sets breakpoint on particular operation with DOM.
     */
    export type setDOMBreakpointParameters = {
      /**
       * Identifier of the node to set breakpoint on.
       */
      nodeId: DOM.NodeId;
      /**
       * Type of the operation to stop upon.
       */
      type: DOMBreakpointType;
      /**
       * Options to apply to this breakpoint to modify its behavior.
       */
      options?: Debugger.BreakpointOptions;
    }
    export type setDOMBreakpointReturnValue = {
    }
    /**
     * Removes DOM breakpoint that was set using <code>setDOMBreakpoint</code>.
     */
    export type removeDOMBreakpointParameters = {
      /**
       * Identifier of the node to remove breakpoint from.
       */
      nodeId: DOM.NodeId;
      /**
       * Type of the breakpoint to remove.
       */
      type: DOMBreakpointType;
    }
    export type removeDOMBreakpointReturnValue = {
    }
    /**
     * Sets breakpoint on particular event of given type.
     */
    export type setEventBreakpointParameters = {
      breakpointType: EventBreakpointType;
      /**
       * The name of the specific event to stop on.
       */
      eventName?: string;
      /**
       * Options to apply to this breakpoint to modify its behavior.
       */
      options?: Debugger.BreakpointOptions;
    }
    export type setEventBreakpointReturnValue = {
    }
    /**
     * Removes breakpoint on particular event of given type.
     */
    export type removeEventBreakpointParameters = {
      breakpointType: EventBreakpointType;
      /**
       * The name of the specific event to stop on.
       */
      eventName?: string;
    }
    export type removeEventBreakpointReturnValue = {
    }
    /**
     * Sets breakpoint on network activity for the given URL.
     */
    export type setURLBreakpointParameters = {
      /**
       * Resource URL substring or regular expression. All requests having this substring in the URL will get stopped upon. An empty string will pause on all requests.
       */
      url: string;
      /**
       * Whether the URL string is a regular expression.
       */
      isRegex?: boolean;
      /**
       * Options to apply to this breakpoint to modify its behavior.
       */
      options?: Debugger.BreakpointOptions;
    }
    export type setURLBreakpointReturnValue = {
    }
    /**
     * Removes breakpoint from network activity for the given URL.
     */
    export type removeURLBreakpointParameters = {
      /**
       * Resource URL substring. An empty string will stop pausing on all requests.
       */
      url: string;
      /**
       * Whether the URL string is a regular expression.
       */
      isRegex?: boolean;
    }
    export type removeURLBreakpointReturnValue = {
    }
  }
  
  /**
   * Query and modify DOM storage.
   */
  export module DOMStorage {
    /**
     * DOM Storage identifier.
     */
    export interface StorageId {
      /**
       * Security origin for the storage.
       */
      securityOrigin: string;
      /**
       * Whether the storage is local storage (not session storage).
       */
      isLocalStorage: boolean;
    }
    /**
     * DOM Storage item.
     */
    export type Item = string[];
    
    export type domStorageItemsClearedPayload = {
      storageId: StorageId;
    }
    export type domStorageItemRemovedPayload = {
      storageId: StorageId;
      key: string;
    }
    export type domStorageItemAddedPayload = {
      storageId: StorageId;
      key: string;
      newValue: string;
    }
    export type domStorageItemUpdatedPayload = {
      storageId: StorageId;
      key: string;
      oldValue: string;
      newValue: string;
    }
    
    /**
     * Enables storage tracking, storage events will now be delivered to the client.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables storage tracking, prevents storage events from being sent to the client.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    export type getDOMStorageItemsParameters = {
      storageId: StorageId;
    }
    export type getDOMStorageItemsReturnValue = {
      entries: Item[];
    }
    export type setDOMStorageItemParameters = {
      storageId: StorageId;
      key: string;
      value: string;
    }
    export type setDOMStorageItemReturnValue = {
    }
    export type removeDOMStorageItemParameters = {
      storageId: StorageId;
      key: string;
    }
    export type removeDOMStorageItemReturnValue = {
    }
    export type clearDOMStorageItemsParameters = {
      storageId: StorageId;
    }
    export type clearDOMStorageItemsReturnValue = {
    }
  }
  
  export module Database {
    /**
     * Unique identifier of Database object.
     */
    export type DatabaseId = string;
    /**
     * Database object.
     */
    export interface Database {
      /**
       * Database ID.
       */
      id: DatabaseId;
      /**
       * Database domain.
       */
      domain: string;
      /**
       * Database name.
       */
      name: string;
      /**
       * Database version.
       */
      version: string;
    }
    /**
     * Database error.
     */
    export interface Error {
      /**
       * Error message.
       */
      message: string;
      /**
       * Error code.
       */
      code: number;
    }
    
    export type addDatabasePayload = {
      database: Database;
    }
    
    /**
     * Enables database tracking, database events will now be delivered to the client.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables database tracking, prevents database events from being sent to the client.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    export type getDatabaseTableNamesParameters = {
      databaseId: DatabaseId;
    }
    export type getDatabaseTableNamesReturnValue = {
      tableNames: string[];
    }
    export type executeSQLParameters = {
      databaseId: DatabaseId;
      query: string;
    }
    export type executeSQLReturnValue = {
      columnNames?: string[];
      values?: any[];
      sqlError?: Error;
    }
  }
  
  /**
   * Debugger domain exposes JavaScript debugging capabilities. It allows setting and removing breakpoints, stepping through execution, exploring stack traces, etc.
   */
  export module Debugger {
    /**
     * Breakpoint identifier.
     */
    export type BreakpointId = string;
    /**
     * Breakpoint action identifier.
     */
    export type BreakpointActionIdentifier = number;
    /**
     * Unique script identifier.
     */
    export type ScriptId = string;
    /**
     * Call frame identifier.
     */
    export type CallFrameId = string;
    /**
     * Location in the source code.
     */
    export interface Location {
      /**
       * Script identifier as reported in the <code>Debugger.scriptParsed</code>.
       */
      scriptId: ScriptId;
      /**
       * Line number in the script (0-based).
       */
      lineNumber: number;
      /**
       * Column number in the script (0-based).
       */
      columnNumber?: number;
    }
    /**
     * Action to perform when a breakpoint is triggered.
     */
    export interface BreakpointAction {
      /**
       * Different kinds of breakpoint actions.
       */
      type: "log"|"evaluate"|"sound"|"probe";
      /**
       * Data associated with this breakpoint type (e.g. for type "eval" this is the JavaScript string to evaluate).
       */
      data?: string;
      /**
       * A frontend-assigned identifier for this breakpoint action.
       */
      id?: BreakpointActionIdentifier;
      /**
       * Indicates whether this action should be executed with a user gesture or not. Defaults to <code>false<code>.
       */
      emulateUserGesture?: boolean;
    }
    /**
     * Extra options that modify breakpoint behavior.
     */
    export interface BreakpointOptions {
      /**
       * Expression to use as a breakpoint condition. When specified, debugger will only stop on the breakpoint if this expression evaluates to true.
       */
      condition?: string;
      /**
       * Actions to perform automatically when the breakpoint is triggered.
       */
      actions?: BreakpointAction[];
      /**
       * Automatically continue after hitting this breakpoint and running actions.
       */
      autoContinue?: boolean;
      /**
       * Number of times to ignore this breakpoint, before stopping on the breakpoint and running actions.
       */
      ignoreCount?: number;
    }
    /**
     * Information about the function.
     */
    export interface FunctionDetails {
      /**
       * Location of the function.
       */
      location: Location;
      /**
       * Name of the function. Not present for anonymous functions.
       */
      name?: string;
      /**
       * Display name of the function(specified in 'displayName' property on the function object).
       */
      displayName?: string;
      /**
       * Scope chain for this closure.
       */
      scopeChain?: Scope[];
    }
    /**
     * JavaScript call frame. Array of call frames form the call stack.
     */
    export interface CallFrame {
      /**
       * Call frame identifier. This identifier is only valid while the virtual machine is paused.
       */
      callFrameId: CallFrameId;
      /**
       * Name of the JavaScript function called on this call frame.
       */
      functionName: string;
      /**
       * Location in the source code.
       */
      location: Location;
      /**
       * Scope chain for this call frame.
       */
      scopeChain: Scope[];
      /**
       * <code>this</code> object for this call frame.
       */
      this: Runtime.RemoteObject;
      /**
       * Is the current frame tail deleted from a tail call.
       */
      isTailDeleted: boolean;
    }
    /**
     * Scope description.
     */
    export interface Scope {
      /**
       * Object representing the scope. For <code>global</code> and <code>with</code> scopes it represents the actual object; for the rest of the scopes, it is artificial transient object enumerating scope variables as its properties.
       */
      object: Runtime.RemoteObject;
      /**
       * Scope type.
       */
      type: "global"|"with"|"closure"|"catch"|"functionName"|"globalLexicalEnvironment"|"nestedLexical";
      /**
       * Name associated with the scope.
       */
      name?: string;
      /**
       * Location if available of the scope definition.
       */
      location?: Location;
      /**
       * Whether the scope has any variables.
       */
      empty?: boolean;
    }
    /**
     * A sample collected by evaluating a probe breakpoint action.
     */
    export interface ProbeSample {
      /**
       * Identifier of the probe breakpoint action that created the sample.
       */
      probeId: BreakpointActionIdentifier;
      /**
       * Unique identifier for this sample.
       */
      sampleId: number;
      /**
       * A batch identifier which is the same for all samples taken at the same breakpoint hit.
       */
      batchId: number;
      /**
       * Timestamp of when the sample was taken.
       */
      timestamp: number;
      /**
       * Contents of the sample.
       */
      payload: Runtime.RemoteObject;
    }
    /**
     * The pause reason auxiliary data when paused because of an assertion.
     */
    export interface AssertPauseReason {
      /**
       * The console.assert message string if provided.
       */
      message?: string;
    }
    /**
     * The pause reason auxiliary data when paused because of hitting a breakpoint.
     */
    export interface BreakpointPauseReason {
      /**
       * The identifier of the breakpoint causing the pause.
       */
      breakpointId: string;
    }
    /**
     * The pause reason auxiliary data when paused because of a Content Security Policy directive.
     */
    export interface CSPViolationPauseReason {
      /**
       * The CSP directive that blocked script execution.
       */
      directive: string;
    }
    
    /**
     * Called when global has been cleared and debugger client should reset its state. Happens upon navigation or reload.
     */
    export type globalObjectClearedPayload = void;
    /**
     * Fired when virtual machine parses script. This event is also fired for all known and uncollected scripts upon enabling debugger.
     */
    export type scriptParsedPayload = {
      /**
       * Identifier of the script parsed.
       */
      scriptId: ScriptId;
      /**
       * URL of the script parsed (if any).
       */
      url: string;
      /**
       * Line offset of the script within the resource with given URL (for script tags).
       */
      startLine: number;
      /**
       * Column offset of the script within the resource with given URL.
       */
      startColumn: number;
      /**
       * Last line of the script.
       */
      endLine: number;
      /**
       * Length of the last line of the script.
       */
      endColumn: number;
      /**
       * Determines whether this script is a user extension script.
       */
      isContentScript?: boolean;
      /**
       * sourceURL name of the script (if any).
       */
      sourceURL?: string;
      /**
       * URL of source map associated with script (if any).
       */
      sourceMapURL?: string;
      /**
       * True if this script was parsed as a module.
       */
      module?: boolean;
    }
    /**
     * Fired when virtual machine fails to parse the script.
     */
    export type scriptFailedToParsePayload = {
      /**
       * URL of the script that failed to parse.
       */
      url: string;
      /**
       * Source text of the script that failed to parse.
       */
      scriptSource: string;
      /**
       * Line offset of the script within the resource.
       */
      startLine: number;
      /**
       * Line with error.
       */
      errorLine: number;
      /**
       * Parse error message.
       */
      errorMessage: string;
    }
    /**
     * Fired when breakpoint is resolved to an actual script and location.
     */
    export type breakpointResolvedPayload = {
      /**
       * Breakpoint unique identifier.
       */
      breakpointId: BreakpointId;
      /**
       * Actual breakpoint location.
       */
      location: Location;
    }
    /**
     * Fired when the virtual machine stopped on breakpoint or exception or any other stop criteria.
     */
    export type pausedPayload = {
      /**
       * Call stack the virtual machine stopped on.
       */
      callFrames: CallFrame[];
      /**
       * Pause reason.
       */
      reason: "XHR"|"Fetch"|"DOM"|"AnimationFrame"|"Interval"|"Listener"|"Timeout"|"exception"|"assert"|"CSPViolation"|"DebuggerStatement"|"Breakpoint"|"PauseOnNextStatement"|"Microtask"|"BlackboxedScript"|"other";
      /**
       * Object containing break-specific auxiliary properties.
       */
      data?: { [key: string]: string };
      /**
       * Linked list of asynchronous StackTraces.
       */
      asyncStackTrace?: Console.StackTrace;
    }
    /**
     * Fired when the virtual machine resumed execution.
     */
    export type resumedPayload = void;
    /**
     * Fires when a new probe sample is collected.
     */
    export type didSampleProbePayload = {
      /**
       * A collected probe sample.
       */
      sample: ProbeSample;
    }
    /**
     * Fired when a "sound" breakpoint action is triggered on a breakpoint.
     */
    export type playBreakpointActionSoundPayload = {
      /**
       * Breakpoint action identifier.
       */
      breakpointActionId: BreakpointActionIdentifier;
    }
    
    /**
     * Enables debugger for the given page. Clients should not assume that the debugging has been enabled until the result for this command is received.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables debugger for given page.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Set the async stack trace depth for the page. A value of zero disables recording of async stack traces.
     */
    export type setAsyncStackTraceDepthParameters = {
      /**
       * Async stack trace depth.
       */
      depth: number;
    }
    export type setAsyncStackTraceDepthReturnValue = {
    }
    /**
     * Activates / deactivates all breakpoints on the page.
     */
    export type setBreakpointsActiveParameters = {
      /**
       * New value for breakpoints active state.
       */
      active: boolean;
    }
    export type setBreakpointsActiveReturnValue = {
    }
    /**
     * Sets JavaScript breakpoint at given location specified either by URL or URL regex. Once this command is issued, all existing parsed scripts will have breakpoints resolved and returned in <code>locations</code> property. Further matching script parsing will result in subsequent <code>breakpointResolved</code> events issued. This logical breakpoint will survive page reloads.
     */
    export type setBreakpointByUrlParameters = {
      /**
       * Line number to set breakpoint at.
       */
      lineNumber: number;
      /**
       * URL of the resources to set breakpoint on.
       */
      url?: string;
      /**
       * Regex pattern for the URLs of the resources to set breakpoints on. Either <code>url</code> or <code>urlRegex</code> must be specified.
       */
      urlRegex?: string;
      /**
       * Offset in the line to set breakpoint at.
       */
      columnNumber?: number;
      /**
       * Options to apply to this breakpoint to modify its behavior.
       */
      options?: BreakpointOptions;
    }
    export type setBreakpointByUrlReturnValue = {
      /**
       * Id of the created breakpoint for further reference.
       */
      breakpointId: BreakpointId;
      /**
       * List of the locations this breakpoint resolved into upon addition.
       */
      locations: Location[];
    }
    /**
     * Sets JavaScript breakpoint at a given location.
     */
    export type setBreakpointParameters = {
      /**
       * Location to set breakpoint in.
       */
      location: Location;
      /**
       * Options to apply to this breakpoint to modify its behavior.
       */
      options?: BreakpointOptions;
    }
    export type setBreakpointReturnValue = {
      /**
       * Id of the created breakpoint for further reference.
       */
      breakpointId: BreakpointId;
      /**
       * Location this breakpoint resolved into.
       */
      actualLocation: Location;
    }
    /**
     * Removes JavaScript breakpoint.
     */
    export type removeBreakpointParameters = {
      breakpointId: BreakpointId;
    }
    export type removeBreakpointReturnValue = {
    }
    /**
     * Continues execution until the current evaluation completes. This will trigger either a Debugger.paused or Debugger.resumed event.
     */
    export type continueUntilNextRunLoopParameters = {
    }
    export type continueUntilNextRunLoopReturnValue = {
    }
    /**
     * Continues execution until specific location is reached. This will trigger either a Debugger.paused or Debugger.resumed event.
     */
    export type continueToLocationParameters = {
      /**
       * Location to continue to.
       */
      location: Location;
    }
    export type continueToLocationReturnValue = {
    }
    /**
     * Steps over the expression. This will trigger either a Debugger.paused or Debugger.resumed event.
     */
    export type stepNextParameters = {
    }
    export type stepNextReturnValue = {
    }
    /**
     * Steps over the statement. This will trigger either a Debugger.paused or Debugger.resumed event.
     */
    export type stepOverParameters = {
    }
    export type stepOverReturnValue = {
    }
    /**
     * Steps into the function call. This will trigger either a Debugger.paused or Debugger.resumed event.
     */
    export type stepIntoParameters = {
    }
    export type stepIntoReturnValue = {
    }
    /**
     * Steps out of the function call. This will trigger either a Debugger.paused or Debugger.resumed event.
     */
    export type stepOutParameters = {
    }
    export type stepOutReturnValue = {
    }
    /**
     * Stops on the next JavaScript statement.
     */
    export type pauseParameters = {
    }
    export type pauseReturnValue = {
    }
    /**
     * Resumes JavaScript execution. This will trigger a Debugger.resumed event.
     */
    export type resumeParameters = {
    }
    export type resumeReturnValue = {
    }
    /**
     * Searches for given string in script content.
     */
    export type searchInContentParameters = {
      /**
       * Id of the script to search in.
       */
      scriptId: ScriptId;
      /**
       * String to search for.
       */
      query: string;
      /**
       * If true, search is case sensitive.
       */
      caseSensitive?: boolean;
      /**
       * If true, treats string parameter as regex.
       */
      isRegex?: boolean;
    }
    export type searchInContentReturnValue = {
      /**
       * List of search matches.
       */
      result: GenericTypes.SearchMatch[];
    }
    /**
     * Returns source for the script with given id.
     */
    export type getScriptSourceParameters = {
      /**
       * Id of the script to get source for.
       */
      scriptId: ScriptId;
    }
    export type getScriptSourceReturnValue = {
      /**
       * Script source.
       */
      scriptSource: string;
    }
    /**
     * Returns detailed information on given function.
     */
    export type getFunctionDetailsParameters = {
      /**
       * Id of the function to get location for.
       */
      functionId: Runtime.RemoteObjectId;
    }
    export type getFunctionDetailsReturnValue = {
      /**
       * Information about the function.
       */
      details: FunctionDetails;
    }
    /**
     * Control whether the debugger pauses execution before `debugger` statements.
     */
    export type setPauseOnDebuggerStatementsParameters = {
      enabled: boolean;
      /**
       * Options to apply to this breakpoint to modify its behavior.
       */
      options?: BreakpointOptions;
    }
    export type setPauseOnDebuggerStatementsReturnValue = {
    }
    /**
     * Defines pause on exceptions state. Can be set to stop on all exceptions, uncaught exceptions or no exceptions. Initial pause on exceptions state is <code>none</code>.
     */
    export type setPauseOnExceptionsParameters = {
      /**
       * Pause on exceptions mode.
       */
      state: "none"|"uncaught"|"all";
      /**
       * Options to apply to this breakpoint to modify its behavior.
       */
      options?: BreakpointOptions;
    }
    export type setPauseOnExceptionsReturnValue = {
    }
    /**
     * Set pause on assertions state. Assertions are console.assert assertions.
     */
    export type setPauseOnAssertionsParameters = {
      enabled: boolean;
      /**
       * Options to apply to this breakpoint to modify its behavior.
       */
      options?: BreakpointOptions;
    }
    export type setPauseOnAssertionsReturnValue = {
    }
    /**
     * Pause when running the next JavaScript microtask.
     */
    export type setPauseOnMicrotasksParameters = {
      enabled: boolean;
      /**
       * Options to apply to this breakpoint to modify its behavior.
       */
      options?: BreakpointOptions;
    }
    export type setPauseOnMicrotasksReturnValue = {
    }
    /**
     * Change whether to pause in the debugger for internal scripts. The default value is false.
     */
    export type setPauseForInternalScriptsParameters = {
      shouldPause: boolean;
    }
    export type setPauseForInternalScriptsReturnValue = {
    }
    /**
     * Evaluates expression on a given call frame.
     */
    export type evaluateOnCallFrameParameters = {
      /**
       * Call frame identifier to evaluate on.
       */
      callFrameId: CallFrameId;
      /**
       * Expression to evaluate.
       */
      expression: string;
      /**
       * String object group name to put result into (allows rapid releasing resulting object handles using <code>releaseObjectGroup</code>).
       */
      objectGroup?: string;
      /**
       * Specifies whether command line API should be available to the evaluated expression, defaults to false.
       */
      includeCommandLineAPI?: boolean;
      /**
       * Specifies whether evaluation should stop on exceptions and mute console. Overrides setPauseOnException state.
       */
      doNotPauseOnExceptionsAndMuteConsole?: boolean;
      /**
       * Whether the result is expected to be a JSON object that should be sent by value.
       */
      returnByValue?: boolean;
      /**
       * Whether preview should be generated for the result.
       */
      generatePreview?: boolean;
      /**
       * Whether the resulting value should be considered for saving in the $n history.
       */
      saveResult?: boolean;
      /**
       * Whether the expression should be considered to be in a user gesture or not.
       */
      emulateUserGesture?: boolean;
    }
    export type evaluateOnCallFrameReturnValue = {
      /**
       * Object wrapper for the evaluation result.
       */
      result: Runtime.RemoteObject;
      /**
       * True if the result was thrown during the evaluation.
       */
      wasThrown?: boolean;
      /**
       * If the result was saved, this is the $n index that can be used to access the value.
       */
      savedResultIndex?: number;
    }
    /**
     * Sets whether the given URL should be in the list of blackboxed scripts, which are ignored when pausing/stepping/debugging.
     */
    export type setShouldBlackboxURLParameters = {
      url: string;
      shouldBlackbox: boolean;
      /**
       * If true, <code>url</code> is case sensitive.
       */
      caseSensitive?: boolean;
      /**
       * If true, treat <code>url</code> as regular expression.
       */
      isRegex?: boolean;
    }
    export type setShouldBlackboxURLReturnValue = {
    }
    /**
     * Sets whether evaluation of breakpoint conditions, ignore counts, and actions happen at the location of the breakpoint or are deferred due to blackboxing.
     */
    export type setBlackboxBreakpointEvaluationsParameters = {
      blackboxBreakpointEvaluations: boolean;
    }
    export type setBlackboxBreakpointEvaluationsReturnValue = {
    }
  }
  
  /**
   * Actions and events related to alert boxes.
   */
  export module Dialog {
    
    /**
     * Fired when a JavaScript initiated dialog (alert, confirm, prompt, or onbeforeunload) is about to open.
     */
    export type javascriptDialogOpeningPayload = {
      /**
       * Dialog type.
       */
      type: string;
      /**
       * Message that will be displayed by the dialog.
       */
      message: string;
      /**
       * Default dialog prompt.
       */
      defaultPrompt?: string;
    }
    
    /**
     * Enables dialog domain notifications.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables dialog domain notifications.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Accepts or dismisses a JavaScript initiated dialog (alert, confirm, prompt, or onbeforeunload).
     */
    export type handleJavaScriptDialogParameters = {
      /**
       * Whether to accept or dismiss the dialog.
       */
      accept: boolean;
      /**
       * The text to enter into the dialog prompt before accepting. Used only if this is a prompt dialog.
       */
      promptText?: string;
    }
    export type handleJavaScriptDialogReturnValue = {
    }
  }
  
  export module Emulation {
    
    
    /**
     * Overrides device metrics with provided values.
     */
    export type setDeviceMetricsOverrideParameters = {
      width: number;
      height: number;
      fixedLayout: boolean;
      deviceScaleFactor?: number;
    }
    export type setDeviceMetricsOverrideReturnValue = {
    }
    /**
     * Allows to disable script execution for the page.
     */
    export type setJavaScriptEnabledParameters = {
      enabled: boolean;
    }
    export type setJavaScriptEnabledReturnValue = {
    }
    /**
     * Credentials to use during HTTP authentication.
     */
    export type setAuthCredentialsParameters = {
      username?: string;
      password?: string;
    }
    export type setAuthCredentialsReturnValue = {
    }
    /**
     * Makes page focused for test.
     */
    export type setActiveAndFocusedParameters = {
      active?: boolean;
    }
    export type setActiveAndFocusedReturnValue = {
    }
    /**
     * Overrides the permissions.
     */
    export type grantPermissionsParameters = {
      origin: string;
      permissions: string[];
    }
    export type grantPermissionsReturnValue = {
    }
    /**
     * Clears permission overrides.
     */
    export type resetPermissionsParameters = {
    }
    export type resetPermissionsReturnValue = {
    }
  }
  
  /**
   * Exposes generic types to be used by any domain.
   */
  export module GenericTypes {
    /**
     * Search match in a resource.
     */
    export interface SearchMatch {
      /**
       * Line number in resource content.
       */
      lineNumber: number;
      /**
       * Line with match content.
       */
      lineContent: string;
    }
    
    
  }
  
  /**
   * Heap domain exposes JavaScript heap attributes and capabilities.
   */
  export module Heap {
    /**
     * Information about a garbage collection.
     */
    export interface GarbageCollection {
      /**
       * The type of garbage collection.
       */
      type: "full"|"partial";
      startTime: number;
      endTime: number;
    }
    /**
     * JavaScriptCore HeapSnapshot JSON data.
     */
    export type HeapSnapshotData = string;
    
    /**
     * Information about the garbage collection.
     */
    export type garbageCollectedPayload = {
      collection: GarbageCollection;
    }
    /**
     * Tracking started.
     */
    export type trackingStartPayload = {
      timestamp: number;
      /**
       * Snapshot at the start of tracking.
       */
      snapshotData: HeapSnapshotData;
    }
    /**
     * Tracking stopped.
     */
    export type trackingCompletePayload = {
      timestamp: number;
      /**
       * Snapshot at the end of tracking.
       */
      snapshotData: HeapSnapshotData;
    }
    
    /**
     * Enables Heap domain events.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables Heap domain events.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Trigger a full garbage collection.
     */
    export type gcParameters = {
    }
    export type gcReturnValue = {
    }
    /**
     * Take a heap snapshot.
     */
    export type snapshotParameters = {
    }
    export type snapshotReturnValue = {
      timestamp: number;
      snapshotData: HeapSnapshotData;
    }
    /**
     * Start tracking heap changes. This will produce a `trackingStart` event.
     */
    export type startTrackingParameters = {
    }
    export type startTrackingReturnValue = {
    }
    /**
     * Stop tracking heap changes. This will produce a `trackingComplete` event.
     */
    export type stopTrackingParameters = {
    }
    export type stopTrackingReturnValue = {
    }
    /**
     * Returns a preview (string, Debugger.FunctionDetails, or Runtime.ObjectPreview) for a Heap.HeapObjectId.
     */
    export type getPreviewParameters = {
      /**
       * Identifier of the heap object within the snapshot.
       */
      heapObjectId: number;
    }
    export type getPreviewReturnValue = {
      /**
       * String value.
       */
      string?: string;
      /**
       * Function details.
       */
      functionDetails?: Debugger.FunctionDetails;
      /**
       * Object preview.
       */
      preview?: Runtime.ObjectPreview;
    }
    /**
     * Returns the strongly referenced Runtime.RemoteObject for a Heap.HeapObjectId.
     */
    export type getRemoteObjectParameters = {
      /**
       * Identifier of the heap object within the snapshot.
       */
      heapObjectId: number;
      /**
       * Symbolic group name that can be used to release multiple objects.
       */
      objectGroup?: string;
    }
    export type getRemoteObjectReturnValue = {
      /**
       * Resulting object.
       */
      result: Runtime.RemoteObject;
    }
  }
  
  export module IndexedDB {
    /**
     * Database with an array of object stores.
     */
    export interface DatabaseWithObjectStores {
      /**
       * Database name.
       */
      name: string;
      /**
       * Database version.
       */
      version: number;
      /**
       * Object stores in this database.
       */
      objectStores: ObjectStore[];
    }
    /**
     * Object store.
     */
    export interface ObjectStore {
      /**
       * Object store name.
       */
      name: string;
      /**
       * Object store key path.
       */
      keyPath: KeyPath;
      /**
       * If true, object store has auto increment flag set.
       */
      autoIncrement: boolean;
      /**
       * Indexes in this object store.
       */
      indexes: ObjectStoreIndex[];
    }
    /**
     * Object store index.
     */
    export interface ObjectStoreIndex {
      /**
       * Index name.
       */
      name: string;
      /**
       * Index key path.
       */
      keyPath: KeyPath;
      /**
       * If true, index is unique.
       */
      unique: boolean;
      /**
       * If true, index allows multiple entries for a key.
       */
      multiEntry: boolean;
    }
    /**
     * Key.
     */
    export interface Key {
      /**
       * Key type.
       */
      type: "number"|"string"|"date"|"array";
      /**
       * Number value.
       */
      number?: number;
      /**
       * String value.
       */
      string?: string;
      /**
       * Date value.
       */
      date?: number;
      /**
       * Array value.
       */
      array?: Key[];
    }
    /**
     * Key range.
     */
    export interface KeyRange {
      /**
       * Lower bound.
       */
      lower?: Key;
      /**
       * Upper bound.
       */
      upper?: Key;
      /**
       * If true lower bound is open.
       */
      lowerOpen: boolean;
      /**
       * If true upper bound is open.
       */
      upperOpen: boolean;
    }
    /**
     * Data entry.
     */
    export interface DataEntry {
      /**
       * Key.
       */
      key: Runtime.RemoteObject;
      /**
       * Primary key.
       */
      primaryKey: Runtime.RemoteObject;
      /**
       * Value.
       */
      value: Runtime.RemoteObject;
    }
    /**
     * Key path.
     */
    export interface KeyPath {
      /**
       * Key path type.
       */
      type: "null"|"string"|"array";
      /**
       * String value.
       */
      string?: string;
      /**
       * Array value.
       */
      array?: string[];
    }
    
    
    /**
     * Enables events from backend.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables events from backend.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Requests database names for given security origin.
     */
    export type requestDatabaseNamesParameters = {
      /**
       * Security origin.
       */
      securityOrigin: string;
    }
    export type requestDatabaseNamesReturnValue = {
      /**
       * Database names for origin.
       */
      databaseNames: string[];
    }
    /**
     * Requests database with given name in given frame.
     */
    export type requestDatabaseParameters = {
      /**
       * Security origin.
       */
      securityOrigin: string;
      /**
       * Database name.
       */
      databaseName: string;
    }
    export type requestDatabaseReturnValue = {
      /**
       * Database with an array of object stores.
       */
      databaseWithObjectStores: DatabaseWithObjectStores;
    }
    /**
     * Requests data from object store or index.
     */
    export type requestDataParameters = {
      /**
       * Security origin.
       */
      securityOrigin: string;
      /**
       * Database name.
       */
      databaseName: string;
      /**
       * Object store name.
       */
      objectStoreName: string;
      /**
       * Index name, empty string for object store data requests.
       */
      indexName: string;
      /**
       * Number of records to skip.
       */
      skipCount: number;
      /**
       * Number of records to fetch.
       */
      pageSize: number;
      /**
       * Key range.
       */
      keyRange?: KeyRange;
    }
    export type requestDataReturnValue = {
      /**
       * Array of object store data entries.
       */
      objectStoreDataEntries: DataEntry[];
      /**
       * If true, there are more entries to fetch in the given range.
       */
      hasMore: boolean;
    }
    /**
     * Clears all entries from an object store.
     */
    export type clearObjectStoreParameters = {
      /**
       * Security origin.
       */
      securityOrigin: string;
      /**
       * Database name.
       */
      databaseName: string;
      /**
       * Object store name.
       */
      objectStoreName: string;
    }
    export type clearObjectStoreReturnValue = {
    }
  }
  
  export module Input {
    /**
     * UTC time in seconds, counted from January 1, 1970.
     */
    export type TimeSinceEpoch = number;
    
    
    /**
     * Dispatches a key event to the page.
     */
    export type dispatchKeyEventParameters = {
      /**
       * Type of the key event.
       */
      type: "keyDown"|"keyUp";
      /**
       * Bit field representing pressed modifier keys. (default: 0).
       */
      modifiers?: number;
      /**
       * Text as generated by processing a virtual key code with a keyboard layout. Not needed for
for `keyUp` and `rawKeyDown` events (default: "")
       */
      text?: string;
      /**
       * Text that would have been generated by the keyboard if no modifiers were pressed (except for
shift). Useful for shortcut (accelerator) key handling (default: "").
       */
      unmodifiedText?: string;
      /**
       * Unique DOM defined string value for each physical key (e.g., 'KeyA') (default: "").
       */
      code?: string;
      /**
       * Unique DOM defined string value describing the meaning of the key in the context of active
modifiers, keyboard layout, etc (e.g., 'AltGr') (default: "").
       */
      key?: string;
      /**
       * Windows virtual key code (default: 0).
       */
      windowsVirtualKeyCode?: number;
      /**
       * Native virtual key code (default: 0).
       */
      nativeVirtualKeyCode?: number;
      /**
       * Whether the event was generated from auto repeat (default: false).
       */
      autoRepeat?: boolean;
      /**
       * Whether the event was generated from the keypad (default: false).
       */
      isKeypad?: boolean;
      /**
       * Whether the event was a system key event (default: false).
       */
      isSystemKey?: boolean;
      /**
       * Mac editing commands associated with this key
       */
      macCommands?: string[];
    }
    export type dispatchKeyEventReturnValue = {
    }
    /**
     * Dispatches a mouse event to the page.
     */
    export type dispatchMouseEventParameters = {
      /**
       * Type of the mouse event.
       */
      type: "move"|"down"|"up"|"wheel";
      /**
       * X coordinate of the event relative to the main frame's viewport in CSS pixels.
       */
      x: number;
      /**
       * Y coordinate of the event relative to the main frame's viewport in CSS pixels. 0 refers to
the top of the viewport and Y increases as it proceeds towards the bottom of the viewport.
       */
      y: number;
      /**
       * Bit field representing pressed modifier keys. Alt=1, Ctrl=2, Meta/Command=4, Shift=8
(default: 0).
       */
      modifiers?: number;
      /**
       * Mouse button (default: "none").
       */
      button?: "none"|"left"|"middle"|"right"|"back"|"forward";
      /**
       * A number indicating which buttons are pressed on the mouse when a mouse event is triggered.
Left=1, Right=2, Middle=4, Back=8, Forward=16, None=0.
       */
      buttons?: number;
      /**
       * Number of times the mouse button was clicked (default: 0).
       */
      clickCount?: number;
      /**
       * X delta in CSS pixels for mouse wheel event (default: 0).
       */
      deltaX?: number;
      /**
       * Y delta in CSS pixels for mouse wheel event (default: 0).
       */
      deltaY?: number;
    }
    export type dispatchMouseEventReturnValue = {
    }
    /**
     * Dispatches a wheel event to the page.
     */
    export type dispatchWheelEventParameters = {
      /**
       * X coordinate of the event relative to the main frame's viewport in CSS pixels.
       */
      x: number;
      /**
       * Y coordinate of the event relative to the main frame's viewport in CSS pixels. 0 refers to
the top of the viewport and Y increases as it proceeds towards the bottom of the viewport.
       */
      y: number;
      /**
       * Bit field representing pressed modifier keys. Alt=1, Ctrl=2, Meta/Command=4, Shift=8
(default: 0).
       */
      modifiers?: number;
      /**
       * X delta in CSS pixels for mouse wheel event (default: 0).
       */
      deltaX?: number;
      /**
       * Y delta in CSS pixels for mouse wheel event (default: 0).
       */
      deltaY?: number;
    }
    export type dispatchWheelEventReturnValue = {
    }
    /**
     * Dispatches a tap event to the page.
     */
    export type dispatchTapEventParameters = {
      /**
       * X coordinate of the event relative to the main frame's viewport in CSS pixels.
       */
      x: number;
      /**
       * Y coordinate of the event relative to the main frame's viewport in CSS pixels. 0 refers to
the top of the viewport and Y increases as it proceeds towards the bottom of the viewport.
       */
      y: number;
      /**
       * Bit field representing pressed modifier keys. Alt=1, Ctrl=2, Meta/Command=4, Shift=8
(default: 0).
       */
      modifiers?: number;
    }
    export type dispatchTapEventReturnValue = {
    }
  }
  
  export module Inspector {
    
    export type evaluateForTestInFrontendPayload = {
      script: string;
    }
    export type inspectPayload = {
      object: Runtime.RemoteObject;
      hints: { [key: string]: string };
    }
    
    /**
     * Enables inspector domain notifications.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables inspector domain notifications.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Sent by the frontend after all initialization messages have been sent.
     */
    export type initializedParameters = {
    }
    export type initializedReturnValue = {
    }
  }
  
  export module LayerTree {
    /**
     * Unique RenderLayer identifier.
     */
    export type LayerId = string;
    /**
     * Unique PseudoElement identifier.
     */
    export type PseudoElementId = string;
    /**
     * A rectangle.
     */
    export interface IntRect {
      /**
       * The x position.
       */
      x: number;
      /**
       * The y position.
       */
      y: number;
      /**
       * The width metric.
       */
      width: number;
      /**
       * The height metric.
       */
      height: number;
    }
    /**
     * Information about a compositing layer.
     */
    export interface Layer {
      /**
       * The unique id for this layer.
       */
      layerId: LayerId;
      /**
       * The id for the node associated with this layer.
       */
      nodeId: DOM.NodeId;
      /**
       * Bounds of the layer in absolute page coordinates.
       */
      bounds: IntRect;
      /**
       * Indicates how many time this layer has painted.
       */
      paintCount: number;
      /**
       * Estimated memory used by this layer.
       */
      memory: number;
      /**
       * The bounds of the composited layer.
       */
      compositedBounds: IntRect;
      /**
       * Indicates whether this layer is associated with an element hosted in a shadow tree.
       */
      isInShadowTree?: boolean;
      /**
       * Indicates whether this layer was used to provide a reflection for the element.
       */
      isReflection?: boolean;
      /**
       * Indicates whether the layer is attached to a pseudo element that is CSS generated content.
       */
      isGeneratedContent?: boolean;
      /**
       * Indicates whether the layer was created for a CSS anonymous block or box.
       */
      isAnonymous?: boolean;
      /**
       * The id for the pseudo element associated with this layer.
       */
      pseudoElementId?: PseudoElementId;
      /**
       * The name of the CSS pseudo-element that prompted the layer to be generated.
       */
      pseudoElement?: string;
    }
    /**
     * An object containing the reasons why the layer was composited as properties.
     */
    export interface CompositingReasons {
      /**
       * Composition due to association with an element with a CSS 3D transform.
       */
      transform3D?: boolean;
      /**
       * Composition due to association with a <video> element.
       */
      video?: boolean;
      /**
       * Composition due to the element being a <canvas> element.
       */
      canvas?: boolean;
      /**
       * Composition due to association with a plugin.
       */
      plugin?: boolean;
      /**
       * Composition due to association with an <iframe> element.
       */
      iFrame?: boolean;
      /**
       * Composition due to association with a <model> element.
       */
      model?: boolean;
      /**
       * Composition due to association with an element with a "backface-visibility: hidden" style.
       */
      backfaceVisibilityHidden?: boolean;
      /**
       * Composition due to association with an element clipping compositing descendants.
       */
      clipsCompositingDescendants?: boolean;
      /**
       * Composition due to association with an animated element.
       */
      animation?: boolean;
      /**
       * Composition due to association with an element with CSS filters applied.
       */
      filters?: boolean;
      /**
       * Composition due to association with an element with a "position: fixed" style.
       */
      positionFixed?: boolean;
      /**
       * Composition due to association with an element with a "position: sticky" style.
       */
      positionSticky?: boolean;
      /**
       * Composition due to association with an element with a "overflow-scrolling: touch" style.
       */
      overflowScrollingTouch?: boolean;
      /**
       * Composition due to association with an element establishing a stacking context.
       */
      stacking?: boolean;
      /**
       * Composition due to association with an element overlapping other composited elements.
       */
      overlap?: boolean;
      /**
       * Composition due to association with an element with descendants that have a negative z-index.
       */
      negativeZIndexChildren?: boolean;
      /**
       * Composition due to association with an element with composited descendants.
       */
      transformWithCompositedDescendants?: boolean;
      /**
       * Composition due to association with an element with opacity applied and composited descendants.
       */
      opacityWithCompositedDescendants?: boolean;
      /**
       * Composition due to association with a masked element and composited descendants.
       */
      maskWithCompositedDescendants?: boolean;
      /**
       * Composition due to association with an element with a reflection and composited descendants.
       */
      reflectionWithCompositedDescendants?: boolean;
      /**
       * Composition due to association with an element with CSS filters applied and composited descendants.
       */
      filterWithCompositedDescendants?: boolean;
      /**
       * Composition due to association with an element with CSS blending applied and composited descendants.
       */
      blendingWithCompositedDescendants?: boolean;
      /**
       * Composition due to association with an element isolating compositing descendants having CSS blending applied.
       */
      isolatesCompositedBlendingDescendants?: boolean;
      /**
       * Composition due to association with an element with perspective applied.
       */
      perspective?: boolean;
      /**
       * Composition due to association with an element with a "transform-style: preserve-3d" style.
       */
      preserve3D?: boolean;
      /**
       * Composition due to association with an element with a "will-change" style.
       */
      willChange?: boolean;
      /**
       * Composition due to association with the root element.
       */
      root?: boolean;
      /**
       * Composition due to association with an element with a "blend-mode" style.
       */
      blending?: boolean;
    }
    
    export type layerTreeDidChangePayload = void;
    
    /**
     * Enables compositing tree inspection.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables compositing tree inspection.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Returns the layer tree structure of the current page.
     */
    export type layersForNodeParameters = {
      /**
       * Root of the subtree for which we want to gather layers.
       */
      nodeId: DOM.NodeId;
    }
    export type layersForNodeReturnValue = {
      /**
       * Child layers.
       */
      layers: Layer[];
    }
    /**
     * Provides the reasons why the given layer was composited.
     */
    export type reasonsForCompositingLayerParameters = {
      /**
       * The id of the layer for which we want to get the reasons it was composited.
       */
      layerId: LayerId;
    }
    export type reasonsForCompositingLayerReturnValue = {
      /**
       * An object containing the reasons why the layer was composited as properties.
       */
      compositingReasons: CompositingReasons;
    }
  }
  
  /**
   * Memory domain exposes page memory tracking.
   */
  export module Memory {
    export interface Event {
      timestamp: number;
      /**
       * Breakdown of memory in categories.
       */
      categories: CategoryData[];
    }
    export interface CategoryData {
      /**
       * Category type.
       */
      type: "javascript"|"jit"|"images"|"layers"|"page"|"other";
      /**
       * Category size in bytes.
       */
      size: number;
    }
    
    /**
     * Memory pressure was encountered.
     */
    export type memoryPressurePayload = {
      timestamp: number;
      /**
       * The severity of the memory pressure event.
       */
      severity: "critical"|"non-critical";
    }
    /**
     * Tracking started.
     */
    export type trackingStartPayload = {
      timestamp: number;
    }
    /**
     * Periodic tracking updates with event data.
     */
    export type trackingUpdatePayload = {
      event: Event;
    }
    /**
     * Tracking stopped.
     */
    export type trackingCompletePayload = {
      timestamp: number;
    }
    
    /**
     * Enables Memory domain events.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables Memory domain events.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Start tracking memory. This will produce a `trackingStart` event.
     */
    export type startTrackingParameters = {
    }
    export type startTrackingReturnValue = {
    }
    /**
     * Stop tracking memory. This will produce a `trackingComplete` event.
     */
    export type stopTrackingParameters = {
    }
    export type stopTrackingReturnValue = {
    }
  }
  
  /**
   * Network domain allows tracking network activities of the page. It exposes information about http, file, data and other requests and responses, their headers, bodies, timing, etc.
   */
  export module Network {
    /**
     * Unique loader identifier.
     */
    export type LoaderId = string;
    /**
     * Unique frame identifier.
     */
    export type FrameId = string;
    /**
     * Unique request identifier.
     */
    export type RequestId = string;
    /**
     * Elapsed seconds since frontend connected.
     */
    export type Timestamp = number;
    /**
     * Number of seconds since epoch.
     */
    export type Walltime = number;
    /**
     * Request / response headers as keys / values of JSON object.
     */
    export type Headers = { [key: string]: string };
    /**
     * Timing information for the request.
     */
    export interface ResourceTiming {
      /**
       * Request is initiated
       */
      startTime: Timestamp;
      /**
       * Started redirect resolution.
       */
      redirectStart: Timestamp;
      /**
       * Finished redirect resolution.
       */
      redirectEnd: Timestamp;
      /**
       * Resource fetching started.
       */
      fetchStart: Timestamp;
      /**
       * Started DNS address resolve in milliseconds relative to fetchStart.
       */
      domainLookupStart: number;
      /**
       * Finished DNS address resolve in milliseconds relative to fetchStart.
       */
      domainLookupEnd: number;
      /**
       * Started connecting to the remote host in milliseconds relative to fetchStart.
       */
      connectStart: number;
      /**
       * Connected to the remote host in milliseconds relative to fetchStart.
       */
      connectEnd: number;
      /**
       * Started SSL handshake in milliseconds relative to fetchStart.
       */
      secureConnectionStart: number;
      /**
       * Started sending request in milliseconds relative to fetchStart.
       */
      requestStart: number;
      /**
       * Started receiving response headers in milliseconds relative to fetchStart.
       */
      responseStart: number;
      /**
       * Finished receiving response headers in milliseconds relative to fetchStart.
       */
      responseEnd: number;
    }
    /**
     * HTTP request data.
     */
    export interface Request {
      /**
       * Request URL.
       */
      url: string;
      /**
       * HTTP request method.
       */
      method: string;
      /**
       * HTTP request headers.
       */
      headers: Headers;
      /**
       * HTTP POST request data.
       */
      postData?: string;
    }
    /**
     * HTTP response data.
     */
    export interface Response {
      /**
       * Response URL. This URL can be different from CachedResource.url in case of redirect.
       */
      url: string;
      /**
       * HTTP response status code.
       */
      status: number;
      /**
       * HTTP response status text.
       */
      statusText: string;
      /**
       * HTTP response headers.
       */
      headers: Headers;
      /**
       * Resource mimeType as determined by the browser.
       */
      mimeType: string;
      /**
       * Specifies where the response came from.
       */
      source: "unknown"|"network"|"memory-cache"|"disk-cache"|"service-worker"|"inspector-override";
      /**
       * Refined HTTP request headers that were actually transmitted over the network.
       */
      requestHeaders?: Headers;
      /**
       * Timing information for the given request.
       */
      timing?: ResourceTiming;
      /**
       * The security information for the given request.
       */
      security?: Security.Security;
    }
    /**
     * Network load metrics.
     */
    export interface Metrics {
      /**
       * Network protocol. ALPN Protocol ID Identification Sequence, as per RFC 7301 (for example, http/2, http/1.1, spdy/3.1)
       */
      protocol?: string;
      /**
       * Network priority.
       */
      priority?: "low"|"medium"|"high";
      /**
       * Connection identifier.
       */
      connectionIdentifier?: string;
      /**
       * Remote IP address.
       */
      remoteAddress?: string;
      /**
       * Refined HTTP request headers that were actually transmitted over the network.
       */
      requestHeaders?: Headers;
      /**
       * Total HTTP request header bytes sent over the network.
       */
      requestHeaderBytesSent?: number;
      /**
       * Total HTTP request body bytes sent over the network.
       */
      requestBodyBytesSent?: number;
      /**
       * Total HTTP response header bytes received over the network.
       */
      responseHeaderBytesReceived?: number;
      /**
       * Total HTTP response body bytes received over the network.
       */
      responseBodyBytesReceived?: number;
      /**
       * Total decoded response body size in bytes.
       */
      responseBodyDecodedSize?: number;
      /**
       * Connection information for the completed request.
       */
      securityConnection?: Security.Connection;
      /**
       * Whether or not the connection was proxied through a server. If <code>true</code>, the <code>remoteAddress</code> will be for the proxy server, not the server that provided the resource to the proxy server.
       */
      isProxyConnection?: boolean;
    }
    /**
     * WebSocket request data.
     */
    export interface WebSocketRequest {
      /**
       * HTTP response headers.
       */
      headers: Headers;
    }
    /**
     * WebSocket response data.
     */
    export interface WebSocketResponse {
      /**
       * HTTP response status code.
       */
      status: number;
      /**
       * HTTP response status text.
       */
      statusText: string;
      /**
       * HTTP response headers.
       */
      headers: Headers;
    }
    /**
     * WebSocket frame data.
     */
    export interface WebSocketFrame {
      /**
       * WebSocket frame opcode.
       */
      opcode: number;
      /**
       * WebSocket frame mask.
       */
      mask: boolean;
      /**
       * WebSocket frame payload data, binary frames (opcode = 2) are base64-encoded.
       */
      payloadData: string;
      /**
       * WebSocket frame payload length in bytes.
       */
      payloadLength: number;
    }
    /**
     * Information about the cached resource.
     */
    export interface CachedResource {
      /**
       * Resource URL. This is the url of the original network request.
       */
      url: string;
      /**
       * Type of this resource.
       */
      type: Page.ResourceType;
      /**
       * Cached response data.
       */
      response?: Response;
      /**
       * Cached response body size.
       */
      bodySize: number;
      /**
       * URL of source map associated with this resource (if any).
       */
      sourceMapURL?: string;
    }
    /**
     * Information about the request initiator.
     */
    export interface Initiator {
      /**
       * Type of this initiator.
       */
      type: "parser"|"script"|"other";
      /**
       * Initiator JavaScript stack trace, set for Script only.
       */
      stackTrace?: Console.CallFrame[];
      /**
       * Initiator URL, set for Parser type only.
       */
      url?: string;
      /**
       * Initiator line number, set for Parser type only.
       */
      lineNumber?: number;
      /**
       * Set if the load was triggered by a DOM node, in addition to the other initiator information.
       */
      nodeId?: DOM.NodeId;
    }
    /**
     * Different stages of a network request.
     */
    export type NetworkStage = "request"|"response";
    /**
     * Different stages of a network request.
     */
    export type ResourceErrorType = "General"|"AccessControl"|"Cancellation"|"Timeout";
    
    /**
     * Fired when page is about to send HTTP request.
     */
    export type requestWillBeSentPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      /**
       * Frame identifier.
       */
      frameId: FrameId;
      /**
       * Loader identifier.
       */
      loaderId: LoaderId;
      /**
       * URL of the document this request is loaded for.
       */
      documentURL: string;
      /**
       * Request data.
       */
      request: Request;
      timestamp: Timestamp;
      walltime: Walltime;
      /**
       * Request initiator.
       */
      initiator: Initiator;
      /**
       * Redirect response data.
       */
      redirectResponse?: Response;
      /**
       * Resource type.
       */
      type?: Page.ResourceType;
      /**
       * Identifier for the context of where the load originated. In general this is the target identifier. For Workers this will be the workerId.
       */
      targetId?: string;
    }
    /**
     * Fired when HTTP response is available.
     */
    export type responseReceivedPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      /**
       * Frame identifier.
       */
      frameId: FrameId;
      /**
       * Loader identifier.
       */
      loaderId: LoaderId;
      /**
       * Timestamp.
       */
      timestamp: Timestamp;
      /**
       * Resource type.
       */
      type: Page.ResourceType;
      /**
       * Response data.
       */
      response: Response;
    }
    /**
     * Fired when data chunk was received over the network.
     */
    export type dataReceivedPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      /**
       * Timestamp.
       */
      timestamp: Timestamp;
      /**
       * Data chunk length.
       */
      dataLength: number;
      /**
       * Actual bytes received (might be less than dataLength for compressed encodings).
       */
      encodedDataLength: number;
    }
    /**
     * Fired when HTTP request has finished loading.
     */
    export type loadingFinishedPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      /**
       * Timestamp.
       */
      timestamp: Timestamp;
      /**
       * URL of source map associated with this resource (if any).
       */
      sourceMapURL?: string;
      /**
       * Network metrics.
       */
      metrics?: Metrics;
    }
    /**
     * Fired when HTTP request has failed to load.
     */
    export type loadingFailedPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      /**
       * Timestamp.
       */
      timestamp: Timestamp;
      /**
       * User friendly error message.
       */
      errorText: string;
      /**
       * True if loading was canceled.
       */
      canceled?: boolean;
    }
    /**
     * Fired when HTTP request has been served from memory cache.
     */
    export type requestServedFromMemoryCachePayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      /**
       * Frame identifier.
       */
      frameId: FrameId;
      /**
       * Loader identifier.
       */
      loaderId: LoaderId;
      /**
       * URL of the document this request is loaded for.
       */
      documentURL: string;
      /**
       * Timestamp.
       */
      timestamp: Timestamp;
      /**
       * Request initiator.
       */
      initiator: Initiator;
      /**
       * Cached resource data.
       */
      resource: CachedResource;
    }
    /**
     * Fired when HTTP request has been intercepted. The frontend must respond with <code>Network.interceptContinue</code>, <code>Network.interceptWithRequest</code>` or <code>Network.interceptWithResponse</code>` to resolve this request.
     */
    export type requestInterceptedPayload = {
      /**
       * Identifier for this intercepted network. Corresponds with an earlier <code>Network.requestWillBeSent</code>.
       */
      requestId: RequestId;
      /**
       * Original request content that would proceed if this is continued.
       */
      request: Request;
    }
    /**
     * Fired when HTTP response has been intercepted. The frontend must response with <code>Network.interceptContinue</code> or <code>Network.interceptWithResponse</code>` to continue this response.
     */
    export type responseInterceptedPayload = {
      /**
       * Identifier for this intercepted network. Corresponds with an earlier <code>Network.requestWillBeSent</code>.
       */
      requestId: RequestId;
      /**
       * Original response content that would proceed if this is continued.
       */
      response: Response;
    }
    /**
     * Fired when WebSocket is about to initiate handshake.
     */
    export type webSocketWillSendHandshakeRequestPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      timestamp: Timestamp;
      walltime: Walltime;
      /**
       * WebSocket request data.
       */
      request: WebSocketRequest;
    }
    /**
     * Fired when WebSocket handshake response becomes available.
     */
    export type webSocketHandshakeResponseReceivedPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      timestamp: Timestamp;
      /**
       * WebSocket response data.
       */
      response: WebSocketResponse;
    }
    /**
     * Fired upon WebSocket creation.
     */
    export type webSocketCreatedPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      /**
       * WebSocket request URL.
       */
      url: string;
    }
    /**
     * Fired when WebSocket is closed.
     */
    export type webSocketClosedPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      /**
       * Timestamp.
       */
      timestamp: Timestamp;
    }
    /**
     * Fired when WebSocket frame is received.
     */
    export type webSocketFrameReceivedPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      /**
       * Timestamp.
       */
      timestamp: Timestamp;
      /**
       * WebSocket response data.
       */
      response: WebSocketFrame;
    }
    /**
     * Fired when WebSocket frame error occurs.
     */
    export type webSocketFrameErrorPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      /**
       * Timestamp.
       */
      timestamp: Timestamp;
      /**
       * WebSocket frame error message.
       */
      errorMessage: string;
    }
    /**
     * Fired when WebSocket frame is sent.
     */
    export type webSocketFrameSentPayload = {
      /**
       * Request identifier.
       */
      requestId: RequestId;
      /**
       * Timestamp.
       */
      timestamp: Timestamp;
      /**
       * WebSocket response data.
       */
      response: WebSocketFrame;
    }
    
    /**
     * Enables network tracking, network events will now be delivered to the client.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables network tracking, prevents network events from being sent to the client.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Specifies whether to always send extra HTTP headers with the requests from this page.
     */
    export type setExtraHTTPHeadersParameters = {
      /**
       * Map with extra HTTP headers.
       */
      headers: Headers;
    }
    export type setExtraHTTPHeadersReturnValue = {
    }
    /**
     * Returns content served for the given request.
     */
    export type getResponseBodyParameters = {
      /**
       * Identifier of the network request to get content for.
       */
      requestId: RequestId;
    }
    export type getResponseBodyReturnValue = {
      /**
       * Response body.
       */
      body: string;
      /**
       * True, if content was sent as base64.
       */
      base64Encoded: boolean;
    }
    /**
     * Toggles whether the resource cache may be used when loading resources in the inspected page. If <code>true</code>, the resource cache will not be used when loading resources.
     */
    export type setResourceCachingDisabledParameters = {
      /**
       * Whether to prevent usage of the resource cache.
       */
      disabled: boolean;
    }
    export type setResourceCachingDisabledReturnValue = {
    }
    /**
     * Loads a resource in the context of a frame on the inspected page without cross origin checks.
     */
    export type loadResourceParameters = {
      /**
       * Frame to load the resource from.
       */
      frameId: FrameId;
      /**
       * URL of the resource to load.
       */
      url: string;
    }
    export type loadResourceReturnValue = {
      /**
       * Resource content.
       */
      content: string;
      /**
       * Resource mimeType.
       */
      mimeType: string;
      /**
       * HTTP response status code.
       */
      status: number;
    }
    /**
     * Fetches a serialized secure certificate for the given requestId to be displayed via InspectorFrontendHost.showCertificate.
     */
    export type getSerializedCertificateParameters = {
      requestId: RequestId;
    }
    export type getSerializedCertificateReturnValue = {
      /**
       * Represents a base64 encoded WebCore::CertificateInfo object.
       */
      serializedCertificate: string;
    }
    /**
     * Resolves JavaScript WebSocket object for given request id.
     */
    export type resolveWebSocketParameters = {
      /**
       * Identifier of the WebSocket resource to resolve.
       */
      requestId: RequestId;
      /**
       * Symbolic group name that can be used to release multiple objects.
       */
      objectGroup?: string;
    }
    export type resolveWebSocketReturnValue = {
      /**
       * JavaScript object wrapper for given node.
       */
      object: Runtime.RemoteObject;
    }
    /**
     * Enable interception of network requests.
     */
    export type setInterceptionEnabledParameters = {
      enabled: boolean;
    }
    export type setInterceptionEnabledReturnValue = {
    }
    /**
     * Add an interception.
     */
    export type addInterceptionParameters = {
      /**
       * URL pattern to intercept, intercept everything if not specified or empty
       */
      url: string;
      /**
       * Stage to intercept.
       */
      stage: NetworkStage;
      /**
       * If false, ignores letter casing of `url` parameter.
       */
      caseSensitive?: boolean;
      /**
       * If true, treats `url` parameter as a regular expression.
       */
      isRegex?: boolean;
    }
    export type addInterceptionReturnValue = {
    }
    /**
     * Remove an interception.
     */
    export type removeInterceptionParameters = {
      url: string;
      /**
       * Stage to intercept.
       */
      stage: NetworkStage;
      /**
       * If false, ignores letter casing of `url` parameter.
       */
      caseSensitive?: boolean;
      /**
       * If true, treats `url` parameter as a regular expression.
       */
      isRegex?: boolean;
    }
    export type removeInterceptionReturnValue = {
    }
    /**
     * Continue request or response without modifications.
     */
    export type interceptContinueParameters = {
      /**
       * Identifier for the intercepted Network request or response to continue.
       */
      requestId: RequestId;
      /**
       * Stage to continue.
       */
      stage: NetworkStage;
    }
    export type interceptContinueReturnValue = {
    }
    /**
     * Replace intercepted request with the provided one.
     */
    export type interceptWithRequestParameters = {
      /**
       * Identifier for the intercepted Network request or response to continue.
       */
      requestId: RequestId;
      /**
       * HTTP request url.
       */
      url?: string;
      /**
       * HTTP request method.
       */
      method?: string;
      /**
       * HTTP response headers. Pass through original values if unmodified.
       */
      headers?: Headers;
      /**
       * HTTP POST request data, base64-encoded.
       */
      postData?: string;
    }
    export type interceptWithRequestReturnValue = {
    }
    /**
     * Provide response content for an intercepted response.
     */
    export type interceptWithResponseParameters = {
      /**
       * Identifier for the intercepted Network response to modify.
       */
      requestId: RequestId;
      content: string;
      /**
       * True, if content was sent as base64.
       */
      base64Encoded: boolean;
      /**
       * MIME Type for the data.
       */
      mimeType?: string;
      /**
       * HTTP response status code. Pass through original values if unmodified.
       */
      status?: number;
      /**
       * HTTP response status text. Pass through original values if unmodified.
       */
      statusText?: string;
      /**
       * HTTP response headers. Pass through original values if unmodified.
       */
      headers?: Headers;
    }
    export type interceptWithResponseReturnValue = {
    }
    /**
     * Provide response for an intercepted request. Request completely bypasses the network in this case and is immediately fulfilled with the provided data.
     */
    export type interceptRequestWithResponseParameters = {
      /**
       * Identifier for the intercepted Network response to modify.
       */
      requestId: RequestId;
      content: string;
      /**
       * True, if content was sent as base64.
       */
      base64Encoded: boolean;
      /**
       * MIME Type for the data.
       */
      mimeType: string;
      /**
       * HTTP response status code.
       */
      status: number;
      /**
       * HTTP response status text.
       */
      statusText: string;
      /**
       * HTTP response headers.
       */
      headers: Headers;
    }
    export type interceptRequestWithResponseReturnValue = {
    }
    /**
     * Fail request with given error type.
     */
    export type interceptRequestWithErrorParameters = {
      /**
       * Identifier for the intercepted Network request to fail.
       */
      requestId: RequestId;
      /**
       * Deliver error reason for the request failure.
       */
      errorType: ResourceErrorType;
    }
    export type interceptRequestWithErrorReturnValue = {
    }
    /**
     * Emulate offline state overriding the actual state.
     */
    export type setEmulateOfflineStateParameters = {
      /**
       * True to emulate offline.
       */
      offline: boolean;
    }
    export type setEmulateOfflineStateReturnValue = {
    }
  }
  
  /**
   * Actions and events related to the inspected page belong to the page domain.
   */
  export module Page {
    /**
     * List of settings able to be overridden by WebInspector.
     */
    export type Setting = "PrivateClickMeasurementDebugModeEnabled"|"AuthorAndUserStylesEnabled"|"ICECandidateFilteringEnabled"|"ITPDebugModeEnabled"|"ImagesEnabled"|"MediaCaptureRequiresSecureConnection"|"MockCaptureDevicesEnabled"|"NeedsSiteSpecificQuirks"|"ScriptEnabled"|"ShowDebugBorders"|"ShowRepaintCounter"|"WebRTCEncryptionEnabled"|"WebSecurityEnabled"|"DeviceOrientationEventEnabled"|"SpeechRecognitionEnabled"|"PointerLockEnabled"|"NotificationsEnabled"|"FullScreenEnabled"|"InputTypeMonthEnabled"|"InputTypeWeekEnabled";
    /**
     * Resource type as it was perceived by the rendering engine.
     */
    export type ResourceType = "Document"|"StyleSheet"|"Image"|"Font"|"Script"|"XHR"|"Fetch"|"Ping"|"Beacon"|"WebSocket"|"EventSource"|"Other";
    /**
     * Coordinate system used by supplied coordinates.
     */
    export type CoordinateSystem = "Viewport"|"Page";
    /**
     * Same-Site policy of a cookie.
     */
    export type CookieSameSitePolicy = "None"|"Lax"|"Strict";
    /**
     * Page appearance name.
     */
    export type Appearance = "Light"|"Dark";
    /**
     * Page reduced-motion media query override.
     */
    export type ReducedMotion = "Reduce"|"NoPreference";
    /**
     * Information about the Frame on the page.
     */
    export interface Frame {
      /**
       * Frame unique identifier.
       */
      id: string;
      /**
       * Parent frame identifier.
       */
      parentId?: string;
      /**
       * Identifier of the loader associated with this frame.
       */
      loaderId: Network.LoaderId;
      /**
       * Frame's name as specified in the tag.
       */
      name?: string;
      /**
       * Frame document's URL.
       */
      url: string;
      /**
       * Frame document's security origin.
       */
      securityOrigin: string;
      /**
       * Frame document's mimeType as determined by the browser.
       */
      mimeType: string;
    }
    export interface FrameResource {
      /**
       * Resource URL.
       */
      url: string;
      /**
       * Type of this resource.
       */
      type: ResourceType;
      /**
       * Resource mimeType as determined by the browser.
       */
      mimeType: string;
      /**
       * True if the resource failed to load.
       */
      failed?: boolean;
      /**
       * True if the resource was canceled during loading.
       */
      canceled?: boolean;
      /**
       * URL of source map associated with this resource (if any).
       */
      sourceMapURL?: string;
      /**
       * Identifier for the context of where the load originated. In general this is the target identifier. For Workers this will be the workerId.
       */
      targetId?: string;
    }
    /**
     * Information about the Frame hierarchy along with their cached resources.
     */
    export interface FrameResourceTree {
      /**
       * Frame information for this tree item.
       */
      frame: Frame;
      /**
       * Child frames.
       */
      childFrames?: FrameResourceTree[];
      /**
       * Information about frame resources.
       */
      resources: FrameResource[];
    }
    /**
     * Search result for resource.
     */
    export interface SearchResult {
      /**
       * Resource URL.
       */
      url: string;
      /**
       * Resource frame id.
       */
      frameId: Network.FrameId;
      /**
       * Number of matches in the resource content.
       */
      matchesCount: number;
      /**
       * Network request id.
       */
      requestId?: Network.RequestId;
    }
    /**
     * Cookie object
     */
    export interface Cookie {
      /**
       * Cookie name.
       */
      name: string;
      /**
       * Cookie value.
       */
      value: string;
      /**
       * Cookie domain.
       */
      domain: string;
      /**
       * Cookie path.
       */
      path: string;
      /**
       * Cookie expires.
       */
      expires: number;
      /**
       * True in case of session cookie.
       */
      session: boolean;
      /**
       * True if cookie is http-only.
       */
      httpOnly: boolean;
      /**
       * True if cookie is secure.
       */
      secure: boolean;
      /**
       * Cookie Same-Site policy.
       */
      sameSite: CookieSameSitePolicy;
    }
    /**
     * Accessibility Node
     */
    export interface AXNode {
      /**
       * The role.
       */
      role: string;
      /**
       * A human readable name for the node.
       */
      name?: string;
      /**
       * The current value of the node.
       */
      value?: any;
      /**
       * An additional human readable description of the node.
       */
      description?: string;
      /**
       * Keyboard shortcuts associated with this node.
       */
      keyshortcuts?: string;
      /**
       * A human readable alternative to the role.
       */
      roledescription?: string;
      /**
       * A description of the current value.
       */
      valuetext?: string;
      /**
       * Whether the node is disabled.
       */
      disabled?: boolean;
      /**
       * Whether the node is expanded or collapsed.
       */
      expanded?: boolean;
      /**
       * Whether the node is focused.
       */
      focused?: boolean;
      /**
       * Whether the node is modal.
       */
      modal?: boolean;
      /**
       * Whether the node text input supports multiline.
       */
      multiline?: boolean;
      /**
       * Whether more than one child can be selected.
       */
      multiselectable?: boolean;
      /**
       * Whether the node is read only.
       */
      readonly?: boolean;
      /**
       * Whether the node is required.
       */
      required?: boolean;
      /**
       * Whether the node is selected in its parent node.
       */
      selected?: boolean;
      /**
       * Whether the checkbox is checked, or "mixed".
       */
      checked?: "true"|"false"|"mixed";
      /**
       * Whether the toggle button is checked, or "mixed".
       */
      pressed?: "true"|"false"|"mixed";
      /**
       * The level of a heading.
       */
      level?: number;
      /**
       * The minimum value in a node.
       */
      valuemin?: number;
      /**
       * The maximum value in a node.
       */
      valuemax?: number;
      /**
       * What kind of autocomplete is supported by a control.
       */
      autocomplete?: string;
      /**
       * What kind of popup is currently being shown for a node.
       */
      haspopup?: string;
      /**
       * Whether and in what way this node's value is invalid.
       */
      invalid?: "true"|"false"|"grammar"|"spelling";
      /**
       * Whether the node is oriented horizontally or vertically.
       */
      orientation?: string;
      /**
       * Whether the node is focusable.
       */
      focusable?: boolean;
      /**
       * Child AXNodes of this node, if any.
       */
      children?: AXNode[];
      /**
       * True if this AXNode corresponds with the ObjectId passed into acessibilitySnapshot.
       */
      found?: boolean;
    }
    export interface Insets {
      top: number;
      right: number;
      bottom: number;
      left: number;
    }
    
    export type domContentEventFiredPayload = {
      timestamp: number;
      /**
       * Id of the frame that has fired DOMContentLoaded event.
       */
      frameId: Network.FrameId;
    }
    export type loadEventFiredPayload = {
      timestamp: number;
      /**
       * Id of the frame that has fired load event.
       */
      frameId: Network.FrameId;
    }
    /**
     * Fired once navigation of the frame has completed. Frame is now associated with the new loader.
     */
    export type frameNavigatedPayload = {
      /**
       * Frame object.
       */
      frame: Frame;
    }
    /**
     * Fired when frame has been attached to its parent.
     */
    export type frameAttachedPayload = {
      /**
       * Id of the frame that has been detached.
       */
      frameId: Network.FrameId;
      /**
       * Parent frame id if non-root.
       */
      parentFrameId?: Network.FrameId;
    }
    /**
     * Fired when frame has been detached from its parent.
     */
    export type frameDetachedPayload = {
      /**
       * Id of the frame that has been detached.
       */
      frameId: Network.FrameId;
    }
    /**
     * Fired when frame has started loading.
     */
    export type frameStartedLoadingPayload = {
      /**
       * Id of the frame that has started loading.
       */
      frameId: Network.FrameId;
    }
    /**
     * Fired when frame has stopped loading.
     */
    export type frameStoppedLoadingPayload = {
      /**
       * Id of the frame that has stopped loading.
       */
      frameId: Network.FrameId;
    }
    /**
     * Fired when frame schedules a potential navigation.
     */
    export type frameScheduledNavigationPayload = {
      /**
       * Id of the frame that has scheduled a navigation.
       */
      frameId: Network.FrameId;
      /**
       * Delay (in seconds) until the navigation is scheduled to begin. The navigation is not guaranteed to start.
       */
      delay: number;
    }
    /**
     * Fired when frame no longer has a scheduled navigation.
     */
    export type frameClearedScheduledNavigationPayload = {
      /**
       * Id of the frame that has cleared its scheduled navigation.
       */
      frameId: Network.FrameId;
    }
    /**
     * Fired when same-document navigation happens, e.g. due to history API usage or anchor navigation.
     */
    export type navigatedWithinDocumentPayload = {
      /**
       * Id of the frame.
       */
      frameId: Network.FrameId;
      /**
       * Frame's new url.
       */
      url: string;
    }
    /**
     * Fired when page's default appearance changes, even if there is a forced appearance.
     */
    export type defaultAppearanceDidChangePayload = {
      /**
       * Name of the appearance that is active (not considering any forced appearance.)
       */
      appearance: Appearance;
    }
    /**
     * Fired when page is about to check policy for newly triggered navigation.
     */
    export type willCheckNavigationPolicyPayload = {
      /**
       * Id of the frame.
       */
      frameId: Network.FrameId;
    }
    /**
     * Fired when page has received navigation policy decision.
     */
    export type didCheckNavigationPolicyPayload = {
      /**
       * Id of the frame.
       */
      frameId: Network.FrameId;
      /**
       * True if the navigation will not continue in this frame.
       */
      cancel?: boolean;
    }
    /**
     * Fired when the page shows file chooser for it's <input type=file>.
     */
    export type fileChooserOpenedPayload = {
      /**
       * Frame where file chooser is opened.
       */
      frameId: Network.FrameId;
      /**
       * Input element.
       */
      element: Runtime.RemoteObject;
    }
    
    /**
     * Enables page domain notifications.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables page domain notifications.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Reloads the main frame of the inspected page.
     */
    export type reloadParameters = {
      /**
       * If true, the page is reloaded from its origin without using cached resources.
       */
      ignoreCache?: boolean;
      /**
       * If true, all cached subresources will be revalidated when the main resource loads. Otherwise, only expired cached subresources will be revalidated (the default behavior for most WebKit clients).
       */
      revalidateAllResources?: boolean;
    }
    export type reloadReturnValue = {
    }
    /**
     * Goes back in the history.
     */
    export type goBackParameters = {
    }
    export type goBackReturnValue = {
    }
    /**
     * Goes forward in the history.
     */
    export type goForwardParameters = {
    }
    export type goForwardReturnValue = {
    }
    /**
     * Navigates current page to the given URL.
     */
    export type navigateParameters = {
      /**
       * URL to navigate the page to.
       */
      url: string;
    }
    export type navigateReturnValue = {
    }
    /**
     * Override's the user agent of the inspected page
     */
    export type overrideUserAgentParameters = {
      /**
       * Value to override the user agent with. If this value is not provided, the override is removed. Overrides are removed when Web Inspector closes/disconnects.
       */
      value?: string;
    }
    export type overrideUserAgentReturnValue = {
    }
    /**
     * Override's the navigator.platform of the inspected page
     */
    export type overridePlatformParameters = {
      /**
       * Value to override the platform with. If this value is not provided, the override is removed. Overrides are removed when Web Inspector closes/disconnects.
       */
      value?: string;
    }
    export type overridePlatformReturnValue = {
    }
    /**
     * Allows the frontend to override the inspected page's settings.
     */
    export type overrideSettingParameters = {
      setting: Setting;
      /**
       * Value to override the setting with. If this value is not provided, the override is removed. Overrides are removed when Web Inspector closes/disconnects.
       */
      value?: boolean;
    }
    export type overrideSettingReturnValue = {
    }
    /**
     * Returns all browser cookies. Depending on the backend support, will return detailed cookie information in the <code>cookies</code> field.
     */
    export type getCookiesParameters = {
    }
    export type getCookiesReturnValue = {
      /**
       * Array of cookie objects.
       */
      cookies: Cookie[];
    }
    /**
     * Sets a new browser cookie with the given name, domain, and path.
     */
    export type setCookieParameters = {
      cookie: Cookie;
    }
    export type setCookieReturnValue = {
    }
    /**
     * Deletes browser cookie with given name, domain, and path.
     */
    export type deleteCookieParameters = {
      /**
       * Name of the cookie to remove.
       */
      cookieName: string;
      /**
       * URL to match cookie domain and path.
       */
      url: string;
    }
    export type deleteCookieReturnValue = {
    }
    /**
     * Returns present frame / resource tree structure.
     */
    export type getResourceTreeParameters = {
    }
    export type getResourceTreeReturnValue = {
      /**
       * Present frame / resource tree structure.
       */
      frameTree: FrameResourceTree;
    }
    /**
     * Returns content of the given resource.
     */
    export type getResourceContentParameters = {
      /**
       * Frame id to get resource for.
       */
      frameId: Network.FrameId;
      /**
       * URL of the resource to get content for.
       */
      url: string;
    }
    export type getResourceContentReturnValue = {
      /**
       * Resource content.
       */
      content: string;
      /**
       * True, if content was served as base64.
       */
      base64Encoded: boolean;
    }
    export type setBootstrapScriptParameters = {
      /**
       * If `source` is provided (and not empty), it will be injected into all future global objects as soon as they're created. Omitting `source` will stop this from happening.
       */
      source?: string;
      /**
       * Isolated world name to evaluate the script in. If not specified main world will be used.
       */
      worldName?: string;
    }
    export type setBootstrapScriptReturnValue = {
    }
    /**
     * Searches for given string in resource content.
     */
    export type searchInResourceParameters = {
      /**
       * Frame id for resource to search in.
       */
      frameId: Network.FrameId;
      /**
       * URL of the resource to search in.
       */
      url: string;
      /**
       * String to search for.
       */
      query: string;
      /**
       * If true, search is case sensitive.
       */
      caseSensitive?: boolean;
      /**
       * If true, treats string parameter as regex.
       */
      isRegex?: boolean;
      /**
       * Request id for resource to search in.
       */
      requestId?: Network.RequestId;
    }
    export type searchInResourceReturnValue = {
      /**
       * List of search matches.
       */
      result: GenericTypes.SearchMatch[];
    }
    /**
     * Searches for given string in frame / resource tree structure.
     */
    export type searchInResourcesParameters = {
      /**
       * String to search for.
       */
      text: string;
      /**
       * If true, search is case sensitive.
       */
      caseSensitive?: boolean;
      /**
       * If true, treats string parameter as regex.
       */
      isRegex?: boolean;
    }
    export type searchInResourcesReturnValue = {
      /**
       * List of search results.
       */
      result: SearchResult[];
    }
    /**
     * Requests that backend draw rulers in the inspector overlay
     */
    export type setShowRulersParameters = {
      /**
       * True for showing rulers
       */
      result: boolean;
    }
    export type setShowRulersReturnValue = {
    }
    /**
     * Requests that backend shows paint rectangles
     */
    export type setShowPaintRectsParameters = {
      /**
       * True for showing paint rectangles
       */
      result: boolean;
    }
    export type setShowPaintRectsReturnValue = {
    }
    /**
     * Emulates the given media for CSS media queries.
     */
    export type setEmulatedMediaParameters = {
      /**
       * Media type to emulate. Empty string disables the override.
       */
      media: string;
    }
    export type setEmulatedMediaReturnValue = {
    }
    /**
     * Forces the given appearance for the page.
     */
    export type setForcedAppearanceParameters = {
      appearance?: Appearance;
    }
    export type setForcedAppearanceReturnValue = {
    }
    /**
     * Forces the reduced-motion media query for the page.
     */
    export type setForcedReducedMotionParameters = {
      reducedMotion?: ReducedMotion;
    }
    export type setForcedReducedMotionReturnValue = {
    }
    /**
     * Enables time zone emulation.
     */
    export type setTimeZoneParameters = {
      timeZone?: string;
    }
    export type setTimeZoneReturnValue = {
    }
    /**
     * Enables touch events on platforms that lack them.
     */
    export type setTouchEmulationEnabledParameters = {
      /**
       * Whether touch should be enabled.
       */
      enabled: boolean;
    }
    export type setTouchEmulationEnabledReturnValue = {
    }
    /**
     * Capture a snapshot of the specified node that does not include unrelated layers.
     */
    export type snapshotNodeParameters = {
      /**
       * Id of the node to snapshot.
       */
      nodeId: DOM.NodeId;
    }
    export type snapshotNodeReturnValue = {
      /**
       * Base64-encoded image data (PNG).
       */
      dataURL: string;
    }
    /**
     * Capture a snapshot of the page within the specified rectangle and coordinate system.
     */
    export type snapshotRectParameters = {
      /**
       * X coordinate
       */
      x: number;
      /**
       * Y coordinate
       */
      y: number;
      /**
       * Rectangle width
       */
      width: number;
      /**
       * Rectangle height
       */
      height: number;
      /**
       * Indicates the coordinate system of the supplied rectangle.
       */
      coordinateSystem: CoordinateSystem;
      /**
       * By default, screenshot is inflated by device scale factor to avoid blurry image. This flag disables it.
       */
      omitDeviceScaleFactor?: boolean;
    }
    export type snapshotRectReturnValue = {
      /**
       * Base64-encoded image data (PNG).
       */
      dataURL: string;
    }
    /**
     * Grab an archive of the page.
     */
    export type archiveParameters = {
    }
    export type archiveReturnValue = {
      /**
       * Base64-encoded web archive.
       */
      data: string;
    }
    /**
     * Overrides screen size exposed to DOM and used in media queries for testing with provided values.
     */
    export type setScreenSizeOverrideParameters = {
      /**
       * Screen width
       */
      width?: number;
      /**
       * Screen height
       */
      height?: number;
    }
    export type setScreenSizeOverrideReturnValue = {
    }
    /**
     * Insert text into the current selection of the page.
     */
    export type insertTextParameters = {
      /**
       * Text to insert.
       */
      text: string;
    }
    export type insertTextReturnValue = {
    }
    export type setCompositionReturnValue = {
    }
    /**
     * Set the current IME composition.
     */
    export type setCompositionParameters = {
      text: string;
      selectionStart: number;
      selectionLength: number;
      replacementStart?: number;
      replacementLength?: number;
    }
    /**
     * Serializes and returns all of the accessibility nodes of the page.
     */
    export type accessibilitySnapshotParameters = {
      /**
       * Object Id of a node to find in the accessibility tree.
       */
      objectId?: string;
    }
    export type accessibilitySnapshotReturnValue = {
      /**
       * The root AXNode.
       */
      axNode: AXNode;
    }
    /**
     * Intercepts file chooser dialog
     */
    export type setInterceptFileChooserDialogParameters = {
      /**
       * True to enable.
       */
      enabled: boolean;
    }
    export type setInterceptFileChooserDialogReturnValue = {
    }
    /**
     * Sets or clears an override of the default background color of the frame. This override is used if the content does not specify one.
     */
    export type setDefaultBackgroundColorOverrideParameters = {
      /**
       * RGBA of the default background color. If not specified, any existing override will be cleared.
       */
      color?: DOM.RGBAColor;
    }
    export type setDefaultBackgroundColorOverrideReturnValue = {
    }
    /**
     * Creates an user world for every loaded frame.
     */
    export type createUserWorldParameters = {
      /**
       * Isolated world name, will be used as an execution context name.
       */
      name: string;
    }
    export type createUserWorldReturnValue = {
    }
    /**
     * Enable page Content Security Policy by-passing.
     */
    export type setBypassCSPParameters = {
      /**
       * Whether to bypass page CSP.
       */
      enabled: boolean;
    }
    export type setBypassCSPReturnValue = {
    }
    /**
     * Crashes the page process
     */
    export type crashParameters = {
    }
    export type crashReturnValue = {
    }
    /**
     * Overrides window.orientation with provided value.
     */
    export type setOrientationOverrideParameters = {
      angle?: number;
    }
    export type setOrientationOverrideReturnValue = {
    }
    export type setVisibleContentRectsParameters = {
      unobscuredContentRect?: DOM.Rect;
      contentInsets?: Insets;
      obscuredInsets?: Insets;
      unobscuredInsets?: Insets;
    }
    export type setVisibleContentRectsReturnValue = {
    }
    /**
     * Ensures that the scroll regions are up to date.
     */
    export type updateScrollingStateParameters = {
    }
    export type updateScrollingStateReturnValue = {
    }
  }
  
  export module Playwright {
    /**
     * Id of Browser context.
     */
    export type ContextID = string;
    /**
     * Id of WebPageProxy.
     */
    export type PageProxyID = string;
    /**
     * Same-Site policy of a cookie.
     */
    export type CookieSameSitePolicy = "None"|"Lax"|"Strict";
    /**
     * Cookie object
     */
    export interface Cookie {
      /**
       * Cookie name.
       */
      name: string;
      /**
       * Cookie value.
       */
      value: string;
      /**
       * Cookie domain.
       */
      domain: string;
      /**
       * Cookie path.
       */
      path: string;
      /**
       * Cookie expires.
       */
      expires: number;
      /**
       * True if cookie is http-only.
       */
      httpOnly: boolean;
      /**
       * True if cookie is secure.
       */
      secure: boolean;
      /**
       * True if cookie is session cookie.
       */
      session: boolean;
      /**
       * Cookie Same-Site policy.
       */
      sameSite: CookieSameSitePolicy;
    }
    /**
     * Cookie object
     */
    export interface SetCookieParam {
      /**
       * Cookie name.
       */
      name: string;
      /**
       * Cookie value.
       */
      value: string;
      /**
       * Cookie domain.
       */
      domain: string;
      /**
       * Cookie path.
       */
      path: string;
      /**
       * Cookie expires.
       */
      expires?: number;
      /**
       * True if cookie is http-only.
       */
      httpOnly?: boolean;
      /**
       * True if cookie is secure.
       */
      secure?: boolean;
      /**
       * True if cookie is session cookie.
       */
      session?: boolean;
      /**
       * Cookie Same-Site policy.
       */
      sameSite?: CookieSameSitePolicy;
    }
    /**
     * Name-value pair
     */
    export interface NameValue {
      name: string;
      value: string;
    }
    /**
     * Origin object
     */
    export interface OriginStorage {
      /**
       * Origin.
       */
      origin: string;
      /**
       * Storage entries.
       */
      items: NameValue[];
    }
    /**
     * Geolocation
     */
    export interface Geolocation {
      /**
       * Mock latitude
       */
      timestamp: number;
      /**
       * Mock latitude
       */
      latitude: number;
      /**
       * Mock longitude
       */
      longitude: number;
      /**
       * Mock accuracy
       */
      accuracy: number;
    }
    
    export type pageProxyCreatedPayload = {
      /**
       * Unique identifier of the context.
       */
      browserContextId: ContextID;
      pageProxyId: PageProxyID;
      /**
       * Unique identifier of the opening page. Only set for pages created by window.open().
       */
      openerId?: PageProxyID;
    }
    export type pageProxyDestroyedPayload = {
      pageProxyId: PageProxyID;
    }
    /**
     * Fired when provisional load fails.
     */
    export type provisionalLoadFailedPayload = {
      /**
       * Unique identifier of the page proxy.
       */
      pageProxyId: PageProxyID;
      /**
       * Identifier of the loader associated with the navigation.
       */
      loaderId: Network.LoaderId;
      /**
       * Localized error string.
       */
      error: string;
    }
    /**
     * Fired when page opens a new window.
     */
    export type windowOpenPayload = {
      /**
       * Unique identifier of the page proxy.
       */
      pageProxyId: PageProxyID;
      url: string;
      windowFeatures: string[];
    }
    export type downloadCreatedPayload = {
      /**
       * Unique identifier of the page proxy.
       */
      pageProxyId: PageProxyID;
      /**
       * Unique identifier of the originating frame.
       */
      frameId: Network.FrameId;
      uuid: string;
      url: string;
    }
    export type downloadFilenameSuggestedPayload = {
      uuid: string;
      suggestedFilename: string;
    }
    export type downloadFinishedPayload = {
      uuid: string;
      error: string;
    }
    export type screencastFinishedPayload = {
      /**
       * Unique identifier of the screencast.
       */
      screencastId: Screencast.ScreencastId;
    }
    
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Close browser.
     */
    export type closeParameters = {
    }
    export type closeReturnValue = {
    }
    /**
     * Creates new ephemeral browser context.
     */
    export type createContextParameters = {
      /**
       * Proxy server, similar to the one passed to --proxy-server
       */
      proxyServer?: string;
      /**
       * Proxy bypass list, similar to the one passed to --proxy-bypass-list
       */
      proxyBypassList?: string;
    }
    export type createContextReturnValue = {
      /**
       * Unique identifier of the context.
       */
      browserContextId: ContextID;
    }
    /**
     * Deletes browser context previously created with createContect. The command will automatically close all pages that use the context.
     */
    export type deleteContextParameters = {
      /**
       * Identifier of the context to delete.
       */
      browserContextId: ContextID;
    }
    export type deleteContextReturnValue = {
    }
    export type createPageParameters = {
      /**
       * JSON Inspector Protocol message (command) to be dispatched on the backend.
       */
      browserContextId?: ContextID;
    }
    export type createPageReturnValue = {
      /**
       * Unique identifier of the page proxy.
       */
      pageProxyId: PageProxyID;
    }
    /**
     * Navigates current page to the given URL.
     */
    export type navigateParameters = {
      /**
       * URL to navigate the page to.
       */
      url: string;
      /**
       * Unique identifier of the page proxy.
       */
      pageProxyId: PageProxyID;
      /**
       * Id of the frame to navigate.
       */
      frameId?: Network.FrameId;
      /**
       * Referrer URL.
       */
      referrer?: string;
    }
    export type navigateReturnValue = {
      /**
       * Identifier of the loader associated with the navigation.
       */
      loaderId?: Network.LoaderId;
    }
    /**
     * Grants read access for the specified files to the web process of the page.
     */
    export type grantFileReadAccessParameters = {
      /**
       * Unique identifier of the page proxy.
       */
      pageProxyId: PageProxyID;
      /**
       * Id of the frame to navigate.
       */
      paths: string[];
    }
    export type grantFileReadAccessReturnValue = {
    }
    /**
     * Change whether all certificate errors should be ignored.
     */
    export type setIgnoreCertificateErrorsParameters = {
      /**
       * Browser context id.
       */
      browserContextId?: ContextID;
      ignore: boolean;
    }
    export type setIgnoreCertificateErrorsReturnValue = {
    }
    /**
     * Returns all cookies in the given browser context.
     */
    export type getAllCookiesParameters = {
      /**
       * Browser context id.
       */
      browserContextId?: ContextID;
    }
    export type getAllCookiesReturnValue = {
      /**
       * Cookies.
       */
      cookies: Cookie[];
    }
    /**
     * Sets cookies in the given browser context.
     */
    export type setCookiesParameters = {
      /**
       * Browser context id.
       */
      browserContextId?: ContextID;
      /**
       * Cookies.
       */
      cookies: SetCookieParam[];
    }
    export type setCookiesReturnValue = {
    }
    /**
     * Deletes cookies in the given browser context.
     */
    export type deleteAllCookiesParameters = {
      /**
       * Browser context id.
       */
      browserContextId?: ContextID;
    }
    export type deleteAllCookiesReturnValue = {
    }
    /**
     * Overrides the geolocation position or error.
     */
    export type setGeolocationOverrideParameters = {
      /**
       * Browser context id.
       */
      browserContextId?: ContextID;
      /**
       * Geolocation to set, if missing emulates position unavailable.
       */
      geolocation?: Geolocation;
    }
    export type setGeolocationOverrideReturnValue = {
    }
    /**
     * Allows to set locale language for context.
     */
    export type setLanguagesParameters = {
      languages: string[];
      /**
       * Browser context id.
       */
      browserContextId?: ContextID;
    }
    export type setLanguagesReturnValue = {
    }
    /**
     * Allows to override download behavior.
     */
    export type setDownloadBehaviorParameters = {
      behavior?: "allow"|"deny";
      downloadPath?: string;
      /**
       * Browser context id.
       */
      browserContextId?: ContextID;
    }
    export type setDownloadBehaviorReturnValue = {
    }
    /**
     * Cancels a current running download.
     */
    export type cancelDownloadParameters = {
      uuid: string;
    }
    export type cancelDownloadReturnValue = {
    }
  }
  
  /**
   * General types used for recordings of actions performed in the inspected page.
   */
  export module Recording {
    /**
     * The type of the recording.
     */
    export type Type = "canvas-2d"|"canvas-bitmaprenderer"|"canvas-webgl"|"canvas-webgl2";
    export type Initiator = "frontend"|"console"|"auto-capture";
    /**
     * Information about the initial state of the recorded object.
     */
    export interface InitialState {
      /**
       * Key-value map for each attribute of the state.
       */
      attributes?: { [key: string]: string };
      /**
       * Array of saved states of the context.
       */
      states?: { [key: string]: string }[];
      /**
       * Array of values that were used to construct the recorded object.
       */
      parameters?: any[];
      /**
       * Current content at the start of the recording.
       */
      content?: string;
    }
    /**
     * Container object for a single frame of the recording.
     */
    export interface Frame {
      /**
       * Information about an action made to the recorded object. Follows the structure [name, parameters, swizzleTypes, trace, snapshot], where name is a string, parameters is an array, swizzleTypes is an array, trace is an array, and snapshot is a data URL image of the current contents after this action.
       */
      actions: any[];
      /**
       * Total execution time of all actions recorded in this frame in milliseconds. 
       */
      duration?: number;
      /**
       * Flag indicating if the recording was stopped before this frame ended.
       */
      incomplete?: boolean;
    }
    export interface Recording {
      /**
       * Used for future/backwards compatibility.
       */
      version: number;
      type: Type;
      /**
       * JSON data of inital state of object before recording.
       */
      initialState: InitialState;
      /**
       * Array of objects that can be referenced by index. Used to avoid duplicating objects.
       */
      data: any[];
      name?: string;
    }
    
    
  }
  
  /**
   * Runtime domain exposes JavaScript runtime by means of remote evaluation and mirror objects. Evaluation results are returned as mirror object that expose object type, string representation and unique identifier that can be used for further object reference. Original objects are maintained in memory unless they are either explicitly released or are released along with the other objects in their object group.
   */
  export module Runtime {
    /**
     * Unique object identifier.
     */
    export type RemoteObjectId = string;
    /**
     * Mirror object referencing original JavaScript object.
     */
    export interface RemoteObject {
      /**
       * Object type.
       */
      type: "object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint";
      /**
       * Object subtype hint. Specified for <code>object</code> <code>function</code> (for class) type values only.
       */
      subtype?: "array"|"null"|"node"|"regexp"|"date"|"error"|"map"|"set"|"weakmap"|"weakset"|"iterator"|"class"|"proxy";
      /**
       * Object class (constructor) name. Specified for <code>object</code> type values only.
       */
      className?: string;
      /**
       * Remote object value (in case of primitive values or JSON values if it was requested).
       */
      value?: any;
      /**
       * String representation of the object.
       */
      description?: string;
      /**
       * Unique object identifier (for non-primitive values).
       */
      objectId?: RemoteObjectId;
      /**
       * Size of the array/collection. Specified for array/map/set/weakmap/weakset object type values only.
       */
      size?: number;
      /**
       * Remote object for the class prototype. Specified for class object type values only.
       */
      classPrototype?: RemoteObject;
      /**
       * Preview containing abbreviated property values. Specified for <code>object</code> type values only.
       */
      preview?: ObjectPreview;
    }
    /**
     * Object containing abbreviated remote object value.
     */
    export interface ObjectPreview {
      /**
       * Object type.
       */
      type: "object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint";
      /**
       * Object subtype hint. Specified for <code>object</code> type values only.
       */
      subtype?: "array"|"null"|"node"|"regexp"|"date"|"error"|"map"|"set"|"weakmap"|"weakset"|"iterator"|"class"|"proxy";
      /**
       * String representation of the object.
       */
      description?: string;
      /**
       * Determines whether preview is lossless (contains all information of the original object).
       */
      lossless: boolean;
      /**
       * True iff some of the properties of the original did not fit.
       */
      overflow?: boolean;
      /**
       * List of the properties.
       */
      properties?: PropertyPreview[];
      /**
       * List of the entries. Specified for <code>map</code> and <code>set</code> subtype values only.
       */
      entries?: EntryPreview[];
      /**
       * Size of the array/collection. Specified for array/map/set/weakmap/weakset object type values only.
       */
      size?: number;
    }
    export interface PropertyPreview {
      /**
       * Property name.
       */
      name: string;
      /**
       * Object type.
       */
      type: "object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint"|"accessor";
      /**
       * Object subtype hint. Specified for <code>object</code> type values only.
       */
      subtype?: "array"|"null"|"node"|"regexp"|"date"|"error"|"map"|"set"|"weakmap"|"weakset"|"iterator"|"class"|"proxy";
      /**
       * User-friendly property value string.
       */
      value?: string;
      /**
       * Nested value preview.
       */
      valuePreview?: ObjectPreview;
      /**
       * True if this is an internal property.
       */
      internal?: boolean;
    }
    export interface EntryPreview {
      /**
       * Entry key. Specified for map-like collection entries.
       */
      key?: ObjectPreview;
      /**
       * Entry value.
       */
      value: ObjectPreview;
    }
    export interface CollectionEntry {
      /**
       * Entry key of a map-like collection, otherwise not provided.
       */
      key?: Runtime.RemoteObject;
      /**
       * Entry value.
       */
      value: Runtime.RemoteObject;
    }
    /**
     * Object property descriptor.
     */
    export interface PropertyDescriptor {
      /**
       * Property name or symbol description.
       */
      name: string;
      /**
       * The value associated with the property.
       */
      value?: RemoteObject;
      /**
       * True if the value associated with the property may be changed (data descriptors only).
       */
      writable?: boolean;
      /**
       * A function which serves as a getter for the property, or <code>undefined</code> if there is no getter (accessor descriptors only).
       */
      get?: RemoteObject;
      /**
       * A function which serves as a setter for the property, or <code>undefined</code> if there is no setter (accessor descriptors only).
       */
      set?: RemoteObject;
      /**
       * True if the result was thrown during the evaluation.
       */
      wasThrown?: boolean;
      /**
       * True if the type of this property descriptor may be changed and if the property may be deleted from the corresponding object.
       */
      configurable?: boolean;
      /**
       * True if this property shows up during enumeration of the properties on the corresponding object.
       */
      enumerable?: boolean;
      /**
       * True if the property is owned for the object.
       */
      isOwn?: boolean;
      /**
       * Property symbol object, if the property is a symbol.
       */
      symbol?: Runtime.RemoteObject;
      /**
       * True if the property value came from a native getter.
       */
      nativeGetter?: boolean;
    }
    /**
     * Object internal property descriptor. This property isn't normally visible in JavaScript code.
     */
    export interface InternalPropertyDescriptor {
      /**
       * Conventional property name.
       */
      name: string;
      /**
       * The value associated with the property.
       */
      value?: RemoteObject;
    }
    /**
     * Represents function call argument. Either remote object id <code>objectId</code> or primitive <code>value</code> or neither of (for undefined) them should be specified.
     */
    export interface CallArgument {
      /**
       * Primitive value.
       */
      value?: any;
      /**
       * Remote object handle.
       */
      objectId?: RemoteObjectId;
    }
    /**
     * Id of an execution context.
     */
    export type ExecutionContextId = number;
    /**
     * Type of the execution context.
     */
    export type ExecutionContextType = "normal"|"user"|"internal";
    /**
     * Description of an isolated world.
     */
    export interface ExecutionContextDescription {
      /**
       * Unique id of the execution context. It can be used to specify in which execution context script evaluation should be performed.
       */
      id: ExecutionContextId;
      type: ExecutionContextType;
      /**
       * Human readable name describing given context.
       */
      name: string;
      /**
       * Id of the owning frame.
       */
      frameId: Network.FrameId;
    }
    /**
     * Syntax error type: "none" for no error, "irrecoverable" for unrecoverable errors, "unterminated-literal" for when there is an unterminated literal, "recoverable" for when the expression is unfinished but valid so far.
     */
    export type SyntaxErrorType = "none"|"irrecoverable"|"unterminated-literal"|"recoverable";
    /**
     * Range of an error in source code.
     */
    export interface ErrorRange {
      /**
       * Start offset of range (inclusive).
       */
      startOffset: number;
      /**
       * End offset of range (exclusive).
       */
      endOffset: number;
    }
    export interface StructureDescription {
      /**
       * Array of strings, where the strings represent object properties.
       */
      fields?: string[];
      /**
       * Array of strings, where the strings represent optional object properties.
       */
      optionalFields?: string[];
      /**
       * Name of the constructor.
       */
      constructorName?: string;
      /**
       * Pointer to the StructureRepresentation of the protoype if one exists.
       */
      prototypeStructure?: StructureDescription;
      /**
       * If true, it indicates that the fields in this StructureDescription may be inaccurate. I.e, there might have been fields that have been deleted before it was profiled or it has fields we haven't profiled.
       */
      isImprecise?: boolean;
    }
    export interface TypeSet {
      /**
       * Indicates if this type description has been type Function.
       */
      isFunction: boolean;
      /**
       * Indicates if this type description has been type Undefined.
       */
      isUndefined: boolean;
      /**
       * Indicates if this type description has been type Null.
       */
      isNull: boolean;
      /**
       * Indicates if this type description has been type Boolean.
       */
      isBoolean: boolean;
      /**
       * Indicates if this type description has been type Integer.
       */
      isInteger: boolean;
      /**
       * Indicates if this type description has been type Number.
       */
      isNumber: boolean;
      /**
       * Indicates if this type description has been type String.
       */
      isString: boolean;
      /**
       * Indicates if this type description has been type Object.
       */
      isObject: boolean;
      /**
       * Indicates if this type description has been type Symbol.
       */
      isSymbol: boolean;
      /**
       * Indicates if this type description has been type BigInt.
       */
      isBigInt: boolean;
    }
    /**
     * Container for type information that has been gathered.
     */
    export interface TypeDescription {
      /**
       * If true, we were able to correlate the offset successfuly with a program location. If false, the offset may be bogus or the offset may be from a CodeBlock that hasn't executed.
       */
      isValid: boolean;
      /**
       * Least common ancestor of all Constructors if the TypeDescription has seen any structures. This string is the display name of the shared constructor function.
       */
      leastCommonAncestor?: string;
      /**
       * Set of booleans for determining the aggregate type of this type description.
       */
      typeSet?: TypeSet;
      /**
       * Array of descriptions for all structures seen for this variable.
       */
      structures?: StructureDescription[];
      /**
       * If true, this indicates that no more structures are being profiled because some maximum threshold has been reached and profiling has stopped because of memory pressure.
       */
      isTruncated?: boolean;
    }
    /**
     * Describes the location of an expression we want type information for.
     */
    export interface TypeLocation {
      /**
       * What kind of type information do we want (normal, function return values, 'this' statement).
       */
      typeInformationDescriptor: number;
      /**
       * sourceID uniquely identifying a script
       */
      sourceID: string;
      /**
       * character offset for assignment range
       */
      divot: number;
    }
    /**
     * From Wikipedia: a basic block is a portion of the code within a program with only one entry point and only one exit point. This type gives the location of a basic block and if that basic block has executed.
     */
    export interface BasicBlock {
      /**
       * Start offset of the basic block.
       */
      startOffset: number;
      /**
       * End offset of the basic block.
       */
      endOffset: number;
      /**
       * Indicates if the basic block has executed before.
       */
      hasExecuted: boolean;
      /**
       * Indicates how many times the basic block has executed.
       */
      executionCount: number;
    }
    
    /**
     * Issued when new execution context is created.
     */
    export type executionContextCreatedPayload = {
      /**
       * A newly created execution context.
       */
      context: ExecutionContextDescription;
    }
    
    /**
     * Parses JavaScript source code for errors.
     */
    export type parseParameters = {
      /**
       * Source code to parse.
       */
      source: string;
    }
    export type parseReturnValue = {
      /**
       * Parse result.
       */
      result: SyntaxErrorType;
      /**
       * Parse error message.
       */
      message?: string;
      /**
       * Range in the source where the error occurred.
       */
      range?: ErrorRange;
    }
    /**
     * Evaluates expression on global object.
     */
    export type evaluateParameters = {
      /**
       * Expression to evaluate.
       */
      expression: string;
      /**
       * Symbolic group name that can be used to release multiple objects.
       */
      objectGroup?: string;
      /**
       * Determines whether Command Line API should be available during the evaluation.
       */
      includeCommandLineAPI?: boolean;
      /**
       * Specifies whether evaluation should stop on exceptions and mute console. Overrides setPauseOnException state.
       */
      doNotPauseOnExceptionsAndMuteConsole?: boolean;
      /**
       * Specifies in which isolated context to perform evaluation. Each content script lives in an isolated context and this parameter may be used to specify one of those contexts. If the parameter is omitted or 0 the evaluation will be performed in the context of the inspected page.
       */
      contextId?: Runtime.ExecutionContextId;
      /**
       * Whether the result is expected to be a JSON object that should be sent by value.
       */
      returnByValue?: boolean;
      /**
       * Whether preview should be generated for the result.
       */
      generatePreview?: boolean;
      /**
       * Whether the resulting value should be considered for saving in the $n history.
       */
      saveResult?: boolean;
      /**
       * Whether the expression should be considered to be in a user gesture or not.
       */
      emulateUserGesture?: boolean;
    }
    export type evaluateReturnValue = {
      /**
       * Evaluation result.
       */
      result: RemoteObject;
      /**
       * True if the result was thrown during the evaluation.
       */
      wasThrown?: boolean;
      /**
       * If the result was saved, this is the $n index that can be used to access the value.
       */
      savedResultIndex?: number;
    }
    /**
     * Calls the async callback when the promise with the given ID gets settled.
     */
    export type awaitPromiseParameters = {
      /**
       * Identifier of the promise.
       */
      promiseObjectId: RemoteObjectId;
      /**
       * Whether the result is expected to be a JSON object that should be sent by value.
       */
      returnByValue?: boolean;
      /**
       * Whether preview should be generated for the result.
       */
      generatePreview?: boolean;
      /**
       * Whether the resulting value should be considered for saving in the $n history.
       */
      saveResult?: boolean;
    }
    export type awaitPromiseReturnValue = {
      /**
       * Evaluation result.
       */
      result: RemoteObject;
      /**
       * True if the result was thrown during the evaluation.
       */
      wasThrown?: boolean;
      /**
       * If the result was saved, this is the $n index that can be used to access the value.
       */
      savedResultIndex?: number;
    }
    /**
     * Calls function with given declaration on the given object. Object group of the result is inherited from the target object.
     */
    export type callFunctionOnParameters = {
      /**
       * Identifier of the object to call function on.
       */
      objectId: RemoteObjectId;
      /**
       * Declaration of the function to call.
       */
      functionDeclaration: string;
      /**
       * Call arguments. All call arguments must belong to the same JavaScript world as the target object.
       */
      arguments?: CallArgument[];
      /**
       * Specifies whether function call should stop on exceptions and mute console. Overrides setPauseOnException state.
       */
      doNotPauseOnExceptionsAndMuteConsole?: boolean;
      /**
       * Whether the result is expected to be a JSON object which should be sent by value.
       */
      returnByValue?: boolean;
      /**
       * Whether preview should be generated for the result.
       */
      generatePreview?: boolean;
      /**
       * Whether the expression should be considered to be in a user gesture or not.
       */
      emulateUserGesture?: boolean;
      /**
       * Whether to automatically await returned promise.
       */
      awaitPromise?: boolean;
    }
    export type callFunctionOnReturnValue = {
      /**
       * Call result.
       */
      result: RemoteObject;
      /**
       * True if the result was thrown during the evaluation.
       */
      wasThrown?: boolean;
    }
    /**
     * Returns a preview for the given object.
     */
    export type getPreviewParameters = {
      /**
       * Identifier of the object to return a preview for.
       */
      objectId: RemoteObjectId;
    }
    export type getPreviewReturnValue = {
      preview: ObjectPreview;
    }
    /**
     * Returns properties of a given object. Object group of the result is inherited from the target object.
     */
    export type getPropertiesParameters = {
      /**
       * Identifier of the object to return properties for.
       */
      objectId: RemoteObjectId;
      /**
       * If true, returns properties belonging only to the object itself, not to its prototype chain.
       */
      ownProperties?: boolean;
      /**
       * If provided skip to this value before collecting values. Otherwise, start at the beginning. Has no effect when the `objectId` is for a `iterator`/`WeakMap`/`WeakSet` object.
       */
      fetchStart?: number;
      /**
       * If provided only return `fetchCount` values. Otherwise, return values all the way to the end.
       */
      fetchCount?: number;
      /**
       * Whether preview should be generated for property values.
       */
      generatePreview?: boolean;
    }
    export type getPropertiesReturnValue = {
      /**
       * Object properties.
       */
      properties: PropertyDescriptor[];
      /**
       * Internal object properties. Only included if `fetchStart` is 0.
       */
      internalProperties?: InternalPropertyDescriptor[];
    }
    /**
     * Returns displayable properties of a given object. Object group of the result is inherited from the target object. Displayable properties are own properties, internal properties, and native getters in the prototype chain (assumed to be bindings and treated like own properties for the frontend).
     */
    export type getDisplayablePropertiesParameters = {
      /**
       * Identifier of the object to return properties for.
       */
      objectId: RemoteObjectId;
      /**
       * If provided skip to this value before collecting values. Otherwise, start at the beginning. Has no effect when the `objectId` is for a `iterator`/`WeakMap`/`WeakSet` object.
       */
      fetchStart?: number;
      /**
       * If provided only return `fetchCount` values. Otherwise, return values all the way to the end.
       */
      fetchCount?: number;
      /**
       * Whether preview should be generated for property values.
       */
      generatePreview?: boolean;
    }
    export type getDisplayablePropertiesReturnValue = {
      /**
       * Object properties.
       */
      properties: PropertyDescriptor[];
      /**
       * Internal object properties. Only included if `fetchStart` is 0.
       */
      internalProperties?: InternalPropertyDescriptor[];
    }
    /**
     * Returns entries of given Map / Set collection.
     */
    export type getCollectionEntriesParameters = {
      /**
       * Id of the collection to get entries for.
       */
      objectId: Runtime.RemoteObjectId;
      /**
       * Symbolic group name that can be used to release multiple. If not provided, it will be the same objectGroup as the RemoteObject determined from <code>objectId</code>. This is useful for WeakMap to release the collection entries.
       */
      objectGroup?: string;
      /**
       * If provided skip to this value before collecting values. Otherwise, start at the beginning. Has no effect when the `objectId<` is for a `iterator<`/`WeakMap<`/`WeakSet<` object.
       */
      fetchStart?: number;
      /**
       * If provided only return `fetchCount` values. Otherwise, return values all the way to the end.
       */
      fetchCount?: number;
    }
    export type getCollectionEntriesReturnValue = {
      /**
       * Array of collection entries.
       */
      entries: CollectionEntry[];
    }
    /**
     * Assign a saved result index to this value.
     */
    export type saveResultParameters = {
      /**
       * Id or value of the object to save.
       */
      value: CallArgument;
      /**
       * Unique id of the execution context. To specify in which execution context script evaluation should be performed. If not provided, determine from the CallArgument's objectId.
       */
      contextId?: ExecutionContextId;
    }
    export type saveResultReturnValue = {
      /**
       * If the value was saved, this is the $n index that can be used to access the value.
       */
      savedResultIndex?: number;
    }
    /**
     * Creates an additional reference to all saved values in the Console using the the given string as a prefix instead of $.
     */
    export type setSavedResultAliasParameters = {
      /**
       * Passing an empty/null string will clear the alias.
       */
      alias?: string;
    }
    export type setSavedResultAliasReturnValue = {
    }
    /**
     * Releases remote object with given id.
     */
    export type releaseObjectParameters = {
      /**
       * Identifier of the object to release.
       */
      objectId: RemoteObjectId;
    }
    export type releaseObjectReturnValue = {
    }
    /**
     * Releases all remote objects that belong to a given group.
     */
    export type releaseObjectGroupParameters = {
      /**
       * Symbolic object group name.
       */
      objectGroup: string;
    }
    export type releaseObjectGroupReturnValue = {
    }
    /**
     * Enables reporting of execution contexts creation by means of <code>executionContextCreated</code> event. When the reporting gets enabled the event will be sent immediately for each existing execution context.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables reporting of execution contexts creation.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Returns detailed information on the given function.
     */
    export type getRuntimeTypesForVariablesAtOffsetsParameters = {
      /**
       * An array of type locations we're requesting information for. Results are expected in the same order they're sent in.
       */
      locations: TypeLocation[];
    }
    export type getRuntimeTypesForVariablesAtOffsetsReturnValue = {
      types: TypeDescription[];
    }
    /**
     * Enables type profiling on the VM.
     */
    export type enableTypeProfilerParameters = {
    }
    export type enableTypeProfilerReturnValue = {
    }
    /**
     * Disables type profiling on the VM.
     */
    export type disableTypeProfilerParameters = {
    }
    export type disableTypeProfilerReturnValue = {
    }
    /**
     * Enables control flow profiling on the VM.
     */
    export type enableControlFlowProfilerParameters = {
    }
    export type enableControlFlowProfilerReturnValue = {
    }
    /**
     * Disables control flow profiling on the VM.
     */
    export type disableControlFlowProfilerParameters = {
    }
    export type disableControlFlowProfilerReturnValue = {
    }
    /**
     * Returns a list of basic blocks for the given sourceID with information about their text ranges and whether or not they have executed.
     */
    export type getBasicBlocksParameters = {
      /**
       * Indicates which sourceID information is requested for.
       */
      sourceID: string;
    }
    export type getBasicBlocksReturnValue = {
      basicBlocks: BasicBlock[];
    }
  }
  
  export module Screencast {
    /**
     * Unique identifier of the screencast.
     */
    export type ScreencastId = string;
    
    export type screencastFramePayload = {
      /**
       * Base64 data
       */
      data: string;
      deviceWidth: number;
      deviceHeight: number;
    }
    
    /**
     * Starts recoring video to speified file.
     */
    export type startVideoParameters = {
      /**
       * Output file location.
       */
      file: string;
      width: number;
      height: number;
      toolbarHeight: number;
    }
    export type startVideoReturnValue = {
      /**
       * Unique identifier of the screencast.
       */
      screencastId: ScreencastId;
    }
    /**
     * Stops recoding video. Returns after the file has been closed.
     */
    export type stopVideoParameters = {
    }
    export type stopVideoReturnValue = {
    }
    /**
     * Starts screencast.
     */
    export type startScreencastParameters = {
      width: number;
      height: number;
      toolbarHeight: number;
      quality: number;
    }
    export type startScreencastReturnValue = {
      /**
       * Screencast session generation.
       */
      generation: number;
    }
    /**
     * Stops screencast.
     */
    export type stopScreencastParameters = {
    }
    export type stopScreencastReturnValue = {
    }
    export type screencastFrameAckParameters = {
      /**
       * Screencast session generation
       */
      generation: number;
    }
    export type screencastFrameAckReturnValue = {
    }
  }
  
  /**
   * Profiler domain exposes JavaScript evaluation timing and profiling.
   */
  export module ScriptProfiler {
    export type EventType = "API"|"Microtask"|"Other";
    export interface Event {
      startTime: number;
      endTime: number;
      type: EventType;
    }
    export interface ExpressionLocation {
      /**
       * 1-based.
       */
      line: number;
      /**
       * 1-based.
       */
      column: number;
    }
    export interface StackFrame {
      /**
       * Unique script identifier.
       */
      sourceID: Debugger.ScriptId;
      /**
       * A displayable name for the stack frame. i.e function name, (program), etc.
       */
      name: string;
      /**
       * -1 if unavailable. 1-based if available.
       */
      line: number;
      /**
       * -1 if unavailable. 1-based if available.
       */
      column: number;
      url: string;
      expressionLocation?: ExpressionLocation;
    }
    export interface StackTrace {
      timestamp: number;
      /**
       * First array item is the bottom of the call stack and last array item is the top of the call stack.
       */
      stackFrames: StackFrame[];
    }
    export interface Samples {
      stackTraces: StackTrace[];
    }
    
    /**
     * Tracking started.
     */
    export type trackingStartPayload = {
      timestamp: number;
    }
    /**
     * Periodic tracking updates with event data.
     */
    export type trackingUpdatePayload = {
      event: Event;
    }
    /**
     * Tracking stopped. Includes any buffered data during tracking, such as profiling information.
     */
    export type trackingCompletePayload = {
      timestamp: number;
      /**
       * Stack traces.
       */
      samples?: Samples;
    }
    
    /**
     * Start tracking script evaluations.
     */
    export type startTrackingParameters = {
      /**
       * Start the sampling profiler, defaults to false.
       */
      includeSamples?: boolean;
    }
    export type startTrackingReturnValue = {
    }
    /**
     * Stop tracking script evaluations. This will produce a `trackingComplete` event.
     */
    export type stopTrackingParameters = {
    }
    export type stopTrackingReturnValue = {
    }
  }
  
  /**
   * Security domain allows the frontend to query for information relating to the security of the page (e.g. HTTPS info, TLS info, user activity, etc.).
   */
  export module Security {
    /**
     * Information about a SSL connection to display in the frontend.
     */
    export interface Connection {
      protocol?: string;
      cipher?: string;
    }
    /**
     * Information about a SSL certificate to display in the frontend.
     */
    export interface Certificate {
      subject?: string;
      validFrom?: Network.Walltime;
      validUntil?: Network.Walltime;
      /**
       * DNS names listed on the certificate.
       */
      dnsNames?: string[];
      /**
       * IP addresses listed on the certificate.
       */
      ipAddresses?: string[];
    }
    /**
     * Security information for a given Network.Response.
     */
    export interface Security {
      connection?: Connection;
      certificate?: Certificate;
    }
    
    
  }
  
  /**
   * Actions and events related to the inspected service worker.
   */
  export module ServiceWorker {
    /**
     * ServiceWorker metadata and initial state.
     */
    export interface Configuration {
      targetId: string;
      securityOrigin: string;
      /**
       * ServiceWorker main script URL.
       */
      url: string;
      /**
       * ServiceWorker main script content.
       */
      content: string;
    }
    
    
    /**
     * Returns the initialization information for this target.
     */
    export type getInitializationInfoParameters = {
    }
    export type getInitializationInfoReturnValue = {
      info: Configuration;
    }
  }
  
  export module Target {
    /**
     * Description of a target.
     */
    export interface TargetInfo {
      /**
       * Unique identifier for the target.
       */
      targetId: string;
      type: "page"|"service-worker"|"worker";
      /**
       * True value indicates that this is a provisional page target i.e. Such target may be created when current page starts cross-origin navigation. Eventually each provisional target is either committed and swaps with the current target or gets destroyed, e.g. in case of load request failure.
       */
      isProvisional?: boolean;
      /**
       * Whether the target is paused on start and has to be explicitely resumed by inspector.
       */
      isPaused?: boolean;
    }
    
    export type targetCreatedPayload = {
      targetInfo: TargetInfo;
    }
    export type targetDestroyedPayload = {
      targetId: string;
      crashed: boolean;
    }
    /**
     * This event is fired when provisional load is committed. Provisional target swaps with the current target.
     */
    export type didCommitProvisionalTargetPayload = {
      /**
       * ID of the old target that is swapped with the committed one.
       */
      oldTargetId: string;
      /**
       * ID of the committed target.
       */
      newTargetId: string;
    }
    export type dispatchMessageFromTargetPayload = {
      targetId: string;
      /**
       * JSON Inspector Protocol message (response or event) to be dispatched on the frontend.
       */
      message: string;
    }
    
    /**
     * If set to true, new targets will be paused on start waiting for resume command. Other commands can be dispatched on the target before it is resumed.
     */
    export type setPauseOnStartParameters = {
      /**
       * If set to true, new targets will be paused on start waiting for resume command.
       */
      pauseOnStart: boolean;
    }
    export type setPauseOnStartReturnValue = {
    }
    /**
     * Will resume target if it was paused on start.
     */
    export type resumeParameters = {
      targetId: string;
    }
    export type resumeReturnValue = {
    }
    /**
     * Send an Inspector Protocol message to be dispatched to a Target's agents.
     */
    export type sendMessageToTargetParameters = {
      targetId: string;
      /**
       * JSON Inspector Protocol message (command) to be dispatched on the backend.
       */
      message: string;
    }
    export type sendMessageToTargetReturnValue = {
    }
    /**
     * Reveals the target on screen.
     */
    export type activateParameters = {
      targetId: string;
    }
    export type activateReturnValue = {
    }
    /**
     * Closes the target.
     */
    export type closeParameters = {
      targetId: string;
      runBeforeUnload?: boolean;
    }
    export type closeReturnValue = {
    }
  }
  
  /**
   * Timeline provides its clients with instrumentation records that are generated during the page runtime. Timeline instrumentation can be started and stopped using corresponding commands. While timeline is started, it is generating timeline event records.
   */
  export module Timeline {
    /**
     * Timeline record type.
     */
    export type EventType = "EventDispatch"|"ScheduleStyleRecalculation"|"RecalculateStyles"|"InvalidateLayout"|"Layout"|"Paint"|"Composite"|"RenderingFrame"|"TimerInstall"|"TimerRemove"|"TimerFire"|"EvaluateScript"|"TimeStamp"|"Time"|"TimeEnd"|"FunctionCall"|"ProbeSample"|"ConsoleProfile"|"RequestAnimationFrame"|"CancelAnimationFrame"|"FireAnimationFrame"|"ObserverCallback";
    /**
     * Instrument types.
     */
    export type Instrument = "ScriptProfiler"|"Timeline"|"CPU"|"Memory"|"Heap"|"Animation";
    /**
     * Timeline record contains information about the recorded activity.
     */
    export interface TimelineEvent {
      /**
       * Event type.
       */
      type: EventType;
      /**
       * Event data.
       */
      data: { [key: string]: string };
      /**
       * Nested records.
       */
      children?: TimelineEvent[];
    }
    
    /**
     * Fired for every instrumentation event while timeline is started.
     */
    export type eventRecordedPayload = {
      /**
       * Timeline event record data.
       */
      record: TimelineEvent;
    }
    /**
     * Fired when recording has started.
     */
    export type recordingStartedPayload = {
      /**
       * Start time of this new recording.
       */
      startTime: number;
    }
    /**
     * Fired when recording has stopped.
     */
    export type recordingStoppedPayload = {
      /**
       * End time of this recording.
       */
      endTime: number;
    }
    /**
     * Fired when auto capture started.
     */
    export type autoCaptureStartedPayload = void;
    
    /**
     * Enables Timeline domain events.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disables Timeline domain events.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Starts capturing instrumentation events.
     */
    export type startParameters = {
      /**
       * Samples JavaScript stack traces up to <code>maxCallStackDepth</code>, defaults to 5.
       */
      maxCallStackDepth?: number;
    }
    export type startReturnValue = {
    }
    /**
     * Stops capturing instrumentation events.
     */
    export type stopParameters = {
    }
    export type stopReturnValue = {
    }
    /**
     * Toggle auto capture state. If <code>true</code> the backend will disable breakpoints and start capturing on navigation. The backend will fire the <code>autoCaptureStarted</code> event when an auto capture starts. The frontend should stop the auto capture when appropriate and re-enable breakpoints.
     */
    export type setAutoCaptureEnabledParameters = {
      /**
       * New auto capture state.
       */
      enabled: boolean;
    }
    export type setAutoCaptureEnabledReturnValue = {
    }
    /**
     * Instruments to enable when capture starts on the backend (e.g. auto capture or programmatic capture).
     */
    export type setInstrumentsParameters = {
      /**
       * Instruments to enable.
       */
      instruments: Instrument[];
    }
    export type setInstrumentsReturnValue = {
    }
  }
  
  export module Worker {
    
    export type workerCreatedPayload = {
      workerId: string;
      url: string;
      name: string;
      /**
       * Id of the frame this worker belongs to.
       */
      frameId: Network.FrameId;
    }
    export type workerTerminatedPayload = {
      workerId: string;
    }
    export type dispatchMessageFromWorkerPayload = {
      workerId: string;
      /**
       * JSON Inspector Protocol message (response or event) to be dispatched on the frontend.
       */
      message: string;
    }
    
    /**
     * Enable Worker domain events.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Disable Worker domain events.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Sent after the frontend has sent all initialization messages and can resume this worker. This command is required to allow execution in the worker.
     */
    export type initializedParameters = {
      workerId: string;
    }
    export type initializedReturnValue = {
    }
    /**
     * Send an Inspector Protocol message to be dispatched to a Worker's agents.
     */
    export type sendMessageToWorkerParameters = {
      workerId: string;
      /**
       * JSON Inspector Protocol message (command) to be dispatched on the backend.
       */
      message: string;
    }
    export type sendMessageToWorkerReturnValue = {
    }
  }
  
  export interface Events {
    "Animation.animationCreated": Animation.animationCreatedPayload;
    "Animation.nameChanged": Animation.nameChangedPayload;
    "Animation.effectChanged": Animation.effectChangedPayload;
    "Animation.targetChanged": Animation.targetChangedPayload;
    "Animation.animationDestroyed": Animation.animationDestroyedPayload;
    "Animation.trackingStart": Animation.trackingStartPayload;
    "Animation.trackingUpdate": Animation.trackingUpdatePayload;
    "Animation.trackingComplete": Animation.trackingCompletePayload;
    "ApplicationCache.applicationCacheStatusUpdated": ApplicationCache.applicationCacheStatusUpdatedPayload;
    "ApplicationCache.networkStateUpdated": ApplicationCache.networkStateUpdatedPayload;
    "Browser.extensionsEnabled": Browser.extensionsEnabledPayload;
    "Browser.extensionsDisabled": Browser.extensionsDisabledPayload;
    "CPUProfiler.trackingStart": CPUProfiler.trackingStartPayload;
    "CPUProfiler.trackingUpdate": CPUProfiler.trackingUpdatePayload;
    "CPUProfiler.trackingComplete": CPUProfiler.trackingCompletePayload;
    "CSS.mediaQueryResultChanged": CSS.mediaQueryResultChangedPayload;
    "CSS.styleSheetChanged": CSS.styleSheetChangedPayload;
    "CSS.styleSheetAdded": CSS.styleSheetAddedPayload;
    "CSS.styleSheetRemoved": CSS.styleSheetRemovedPayload;
    "CSS.nodeLayoutContextTypeChanged": CSS.nodeLayoutContextTypeChangedPayload;
    "Canvas.canvasAdded": Canvas.canvasAddedPayload;
    "Canvas.canvasRemoved": Canvas.canvasRemovedPayload;
    "Canvas.canvasMemoryChanged": Canvas.canvasMemoryChangedPayload;
    "Canvas.extensionEnabled": Canvas.extensionEnabledPayload;
    "Canvas.clientNodesChanged": Canvas.clientNodesChangedPayload;
    "Canvas.recordingStarted": Canvas.recordingStartedPayload;
    "Canvas.recordingProgress": Canvas.recordingProgressPayload;
    "Canvas.recordingFinished": Canvas.recordingFinishedPayload;
    "Canvas.programCreated": Canvas.programCreatedPayload;
    "Canvas.programDeleted": Canvas.programDeletedPayload;
    "Console.messageAdded": Console.messageAddedPayload;
    "Console.messageRepeatCountUpdated": Console.messageRepeatCountUpdatedPayload;
    "Console.messagesCleared": Console.messagesClearedPayload;
    "Console.heapSnapshot": Console.heapSnapshotPayload;
    "DOM.documentUpdated": DOM.documentUpdatedPayload;
    "DOM.inspect": DOM.inspectPayload;
    "DOM.setChildNodes": DOM.setChildNodesPayload;
    "DOM.attributeModified": DOM.attributeModifiedPayload;
    "DOM.attributeRemoved": DOM.attributeRemovedPayload;
    "DOM.inlineStyleInvalidated": DOM.inlineStyleInvalidatedPayload;
    "DOM.characterDataModified": DOM.characterDataModifiedPayload;
    "DOM.childNodeCountUpdated": DOM.childNodeCountUpdatedPayload;
    "DOM.childNodeInserted": DOM.childNodeInsertedPayload;
    "DOM.childNodeRemoved": DOM.childNodeRemovedPayload;
    "DOM.willDestroyDOMNode": DOM.willDestroyDOMNodePayload;
    "DOM.shadowRootPushed": DOM.shadowRootPushedPayload;
    "DOM.shadowRootPopped": DOM.shadowRootPoppedPayload;
    "DOM.customElementStateChanged": DOM.customElementStateChangedPayload;
    "DOM.pseudoElementAdded": DOM.pseudoElementAddedPayload;
    "DOM.pseudoElementRemoved": DOM.pseudoElementRemovedPayload;
    "DOM.didAddEventListener": DOM.didAddEventListenerPayload;
    "DOM.willRemoveEventListener": DOM.willRemoveEventListenerPayload;
    "DOM.didFireEvent": DOM.didFireEventPayload;
    "DOM.powerEfficientPlaybackStateChanged": DOM.powerEfficientPlaybackStateChangedPayload;
    "DOMStorage.domStorageItemsCleared": DOMStorage.domStorageItemsClearedPayload;
    "DOMStorage.domStorageItemRemoved": DOMStorage.domStorageItemRemovedPayload;
    "DOMStorage.domStorageItemAdded": DOMStorage.domStorageItemAddedPayload;
    "DOMStorage.domStorageItemUpdated": DOMStorage.domStorageItemUpdatedPayload;
    "Database.addDatabase": Database.addDatabasePayload;
    "Debugger.globalObjectCleared": Debugger.globalObjectClearedPayload;
    "Debugger.scriptParsed": Debugger.scriptParsedPayload;
    "Debugger.scriptFailedToParse": Debugger.scriptFailedToParsePayload;
    "Debugger.breakpointResolved": Debugger.breakpointResolvedPayload;
    "Debugger.paused": Debugger.pausedPayload;
    "Debugger.resumed": Debugger.resumedPayload;
    "Debugger.didSampleProbe": Debugger.didSampleProbePayload;
    "Debugger.playBreakpointActionSound": Debugger.playBreakpointActionSoundPayload;
    "Dialog.javascriptDialogOpening": Dialog.javascriptDialogOpeningPayload;
    "Heap.garbageCollected": Heap.garbageCollectedPayload;
    "Heap.trackingStart": Heap.trackingStartPayload;
    "Heap.trackingComplete": Heap.trackingCompletePayload;
    "Inspector.evaluateForTestInFrontend": Inspector.evaluateForTestInFrontendPayload;
    "Inspector.inspect": Inspector.inspectPayload;
    "LayerTree.layerTreeDidChange": LayerTree.layerTreeDidChangePayload;
    "Memory.memoryPressure": Memory.memoryPressurePayload;
    "Memory.trackingStart": Memory.trackingStartPayload;
    "Memory.trackingUpdate": Memory.trackingUpdatePayload;
    "Memory.trackingComplete": Memory.trackingCompletePayload;
    "Network.requestWillBeSent": Network.requestWillBeSentPayload;
    "Network.responseReceived": Network.responseReceivedPayload;
    "Network.dataReceived": Network.dataReceivedPayload;
    "Network.loadingFinished": Network.loadingFinishedPayload;
    "Network.loadingFailed": Network.loadingFailedPayload;
    "Network.requestServedFromMemoryCache": Network.requestServedFromMemoryCachePayload;
    "Network.requestIntercepted": Network.requestInterceptedPayload;
    "Network.responseIntercepted": Network.responseInterceptedPayload;
    "Network.webSocketWillSendHandshakeRequest": Network.webSocketWillSendHandshakeRequestPayload;
    "Network.webSocketHandshakeResponseReceived": Network.webSocketHandshakeResponseReceivedPayload;
    "Network.webSocketCreated": Network.webSocketCreatedPayload;
    "Network.webSocketClosed": Network.webSocketClosedPayload;
    "Network.webSocketFrameReceived": Network.webSocketFrameReceivedPayload;
    "Network.webSocketFrameError": Network.webSocketFrameErrorPayload;
    "Network.webSocketFrameSent": Network.webSocketFrameSentPayload;
    "Page.domContentEventFired": Page.domContentEventFiredPayload;
    "Page.loadEventFired": Page.loadEventFiredPayload;
    "Page.frameNavigated": Page.frameNavigatedPayload;
    "Page.frameAttached": Page.frameAttachedPayload;
    "Page.frameDetached": Page.frameDetachedPayload;
    "Page.frameStartedLoading": Page.frameStartedLoadingPayload;
    "Page.frameStoppedLoading": Page.frameStoppedLoadingPayload;
    "Page.frameScheduledNavigation": Page.frameScheduledNavigationPayload;
    "Page.frameClearedScheduledNavigation": Page.frameClearedScheduledNavigationPayload;
    "Page.navigatedWithinDocument": Page.navigatedWithinDocumentPayload;
    "Page.defaultAppearanceDidChange": Page.defaultAppearanceDidChangePayload;
    "Page.willCheckNavigationPolicy": Page.willCheckNavigationPolicyPayload;
    "Page.didCheckNavigationPolicy": Page.didCheckNavigationPolicyPayload;
    "Page.fileChooserOpened": Page.fileChooserOpenedPayload;
    "Playwright.pageProxyCreated": Playwright.pageProxyCreatedPayload;
    "Playwright.pageProxyDestroyed": Playwright.pageProxyDestroyedPayload;
    "Playwright.provisionalLoadFailed": Playwright.provisionalLoadFailedPayload;
    "Playwright.windowOpen": Playwright.windowOpenPayload;
    "Playwright.downloadCreated": Playwright.downloadCreatedPayload;
    "Playwright.downloadFilenameSuggested": Playwright.downloadFilenameSuggestedPayload;
    "Playwright.downloadFinished": Playwright.downloadFinishedPayload;
    "Playwright.screencastFinished": Playwright.screencastFinishedPayload;
    "Runtime.executionContextCreated": Runtime.executionContextCreatedPayload;
    "Screencast.screencastFrame": Screencast.screencastFramePayload;
    "ScriptProfiler.trackingStart": ScriptProfiler.trackingStartPayload;
    "ScriptProfiler.trackingUpdate": ScriptProfiler.trackingUpdatePayload;
    "ScriptProfiler.trackingComplete": ScriptProfiler.trackingCompletePayload;
    "Target.targetCreated": Target.targetCreatedPayload;
    "Target.targetDestroyed": Target.targetDestroyedPayload;
    "Target.didCommitProvisionalTarget": Target.didCommitProvisionalTargetPayload;
    "Target.dispatchMessageFromTarget": Target.dispatchMessageFromTargetPayload;
    "Timeline.eventRecorded": Timeline.eventRecordedPayload;
    "Timeline.recordingStarted": Timeline.recordingStartedPayload;
    "Timeline.recordingStopped": Timeline.recordingStoppedPayload;
    "Timeline.autoCaptureStarted": Timeline.autoCaptureStartedPayload;
    "Worker.workerCreated": Worker.workerCreatedPayload;
    "Worker.workerTerminated": Worker.workerTerminatedPayload;
    "Worker.dispatchMessageFromWorker": Worker.dispatchMessageFromWorkerPayload;
  }
  export interface CommandParameters {
    "Animation.enable": Animation.enableParameters;
    "Animation.disable": Animation.disableParameters;
    "Animation.requestEffectTarget": Animation.requestEffectTargetParameters;
    "Animation.resolveAnimation": Animation.resolveAnimationParameters;
    "Animation.startTracking": Animation.startTrackingParameters;
    "Animation.stopTracking": Animation.stopTrackingParameters;
    "ApplicationCache.getFramesWithManifests": ApplicationCache.getFramesWithManifestsParameters;
    "ApplicationCache.enable": ApplicationCache.enableParameters;
    "ApplicationCache.disable": ApplicationCache.disableParameters;
    "ApplicationCache.getManifestForFrame": ApplicationCache.getManifestForFrameParameters;
    "ApplicationCache.getApplicationCacheForFrame": ApplicationCache.getApplicationCacheForFrameParameters;
    "Audit.setup": Audit.setupParameters;
    "Audit.run": Audit.runParameters;
    "Audit.teardown": Audit.teardownParameters;
    "Browser.enable": Browser.enableParameters;
    "Browser.disable": Browser.disableParameters;
    "CPUProfiler.startTracking": CPUProfiler.startTrackingParameters;
    "CPUProfiler.stopTracking": CPUProfiler.stopTrackingParameters;
    "CSS.enable": CSS.enableParameters;
    "CSS.disable": CSS.disableParameters;
    "CSS.getMatchedStylesForNode": CSS.getMatchedStylesForNodeParameters;
    "CSS.getInlineStylesForNode": CSS.getInlineStylesForNodeParameters;
    "CSS.getComputedStyleForNode": CSS.getComputedStyleForNodeParameters;
    "CSS.getFontDataForNode": CSS.getFontDataForNodeParameters;
    "CSS.getAllStyleSheets": CSS.getAllStyleSheetsParameters;
    "CSS.getStyleSheet": CSS.getStyleSheetParameters;
    "CSS.getStyleSheetText": CSS.getStyleSheetTextParameters;
    "CSS.setStyleSheetText": CSS.setStyleSheetTextParameters;
    "CSS.setStyleText": CSS.setStyleTextParameters;
    "CSS.setRuleSelector": CSS.setRuleSelectorParameters;
    "CSS.createStyleSheet": CSS.createStyleSheetParameters;
    "CSS.addRule": CSS.addRuleParameters;
    "CSS.getSupportedCSSProperties": CSS.getSupportedCSSPropertiesParameters;
    "CSS.getSupportedSystemFontFamilyNames": CSS.getSupportedSystemFontFamilyNamesParameters;
    "CSS.forcePseudoState": CSS.forcePseudoStateParameters;
    "CSS.setLayoutContextTypeChangedMode": CSS.setLayoutContextTypeChangedModeParameters;
    "Canvas.enable": Canvas.enableParameters;
    "Canvas.disable": Canvas.disableParameters;
    "Canvas.requestNode": Canvas.requestNodeParameters;
    "Canvas.requestContent": Canvas.requestContentParameters;
    "Canvas.requestClientNodes": Canvas.requestClientNodesParameters;
    "Canvas.resolveContext": Canvas.resolveContextParameters;
    "Canvas.setRecordingAutoCaptureFrameCount": Canvas.setRecordingAutoCaptureFrameCountParameters;
    "Canvas.startRecording": Canvas.startRecordingParameters;
    "Canvas.stopRecording": Canvas.stopRecordingParameters;
    "Canvas.requestShaderSource": Canvas.requestShaderSourceParameters;
    "Canvas.updateShader": Canvas.updateShaderParameters;
    "Canvas.setShaderProgramDisabled": Canvas.setShaderProgramDisabledParameters;
    "Canvas.setShaderProgramHighlighted": Canvas.setShaderProgramHighlightedParameters;
    "Console.enable": Console.enableParameters;
    "Console.disable": Console.disableParameters;
    "Console.clearMessages": Console.clearMessagesParameters;
    "Console.getLoggingChannels": Console.getLoggingChannelsParameters;
    "Console.setLoggingChannelLevel": Console.setLoggingChannelLevelParameters;
    "DOM.getDocument": DOM.getDocumentParameters;
    "DOM.requestChildNodes": DOM.requestChildNodesParameters;
    "DOM.querySelector": DOM.querySelectorParameters;
    "DOM.querySelectorAll": DOM.querySelectorAllParameters;
    "DOM.setNodeName": DOM.setNodeNameParameters;
    "DOM.setNodeValue": DOM.setNodeValueParameters;
    "DOM.removeNode": DOM.removeNodeParameters;
    "DOM.setAttributeValue": DOM.setAttributeValueParameters;
    "DOM.setAttributesAsText": DOM.setAttributesAsTextParameters;
    "DOM.removeAttribute": DOM.removeAttributeParameters;
    "DOM.getSupportedEventNames": DOM.getSupportedEventNamesParameters;
    "DOM.getDataBindingsForNode": DOM.getDataBindingsForNodeParameters;
    "DOM.getAssociatedDataForNode": DOM.getAssociatedDataForNodeParameters;
    "DOM.getEventListenersForNode": DOM.getEventListenersForNodeParameters;
    "DOM.setEventListenerDisabled": DOM.setEventListenerDisabledParameters;
    "DOM.setBreakpointForEventListener": DOM.setBreakpointForEventListenerParameters;
    "DOM.removeBreakpointForEventListener": DOM.removeBreakpointForEventListenerParameters;
    "DOM.getAccessibilityPropertiesForNode": DOM.getAccessibilityPropertiesForNodeParameters;
    "DOM.getOuterHTML": DOM.getOuterHTMLParameters;
    "DOM.setOuterHTML": DOM.setOuterHTMLParameters;
    "DOM.insertAdjacentHTML": DOM.insertAdjacentHTMLParameters;
    "DOM.performSearch": DOM.performSearchParameters;
    "DOM.getSearchResults": DOM.getSearchResultsParameters;
    "DOM.discardSearchResults": DOM.discardSearchResultsParameters;
    "DOM.requestNode": DOM.requestNodeParameters;
    "DOM.setInspectModeEnabled": DOM.setInspectModeEnabledParameters;
    "DOM.highlightRect": DOM.highlightRectParameters;
    "DOM.highlightQuad": DOM.highlightQuadParameters;
    "DOM.highlightSelector": DOM.highlightSelectorParameters;
    "DOM.highlightNode": DOM.highlightNodeParameters;
    "DOM.highlightNodeList": DOM.highlightNodeListParameters;
    "DOM.hideHighlight": DOM.hideHighlightParameters;
    "DOM.highlightFrame": DOM.highlightFrameParameters;
    "DOM.showGridOverlay": DOM.showGridOverlayParameters;
    "DOM.hideGridOverlay": DOM.hideGridOverlayParameters;
    "DOM.showFlexOverlay": DOM.showFlexOverlayParameters;
    "DOM.hideFlexOverlay": DOM.hideFlexOverlayParameters;
    "DOM.pushNodeByPathToFrontend": DOM.pushNodeByPathToFrontendParameters;
    "DOM.resolveNode": DOM.resolveNodeParameters;
    "DOM.getAttributes": DOM.getAttributesParameters;
    "DOM.moveTo": DOM.moveToParameters;
    "DOM.undo": DOM.undoParameters;
    "DOM.redo": DOM.redoParameters;
    "DOM.markUndoableState": DOM.markUndoableStateParameters;
    "DOM.focus": DOM.focusParameters;
    "DOM.setInspectedNode": DOM.setInspectedNodeParameters;
    "DOM.setAllowEditingUserAgentShadowTrees": DOM.setAllowEditingUserAgentShadowTreesParameters;
    "DOM.describeNode": DOM.describeNodeParameters;
    "DOM.scrollIntoViewIfNeeded": DOM.scrollIntoViewIfNeededParameters;
    "DOM.getContentQuads": DOM.getContentQuadsParameters;
    "DOM.setInputFiles": DOM.setInputFilesParameters;
    "DOMDebugger.setDOMBreakpoint": DOMDebugger.setDOMBreakpointParameters;
    "DOMDebugger.removeDOMBreakpoint": DOMDebugger.removeDOMBreakpointParameters;
    "DOMDebugger.setEventBreakpoint": DOMDebugger.setEventBreakpointParameters;
    "DOMDebugger.removeEventBreakpoint": DOMDebugger.removeEventBreakpointParameters;
    "DOMDebugger.setURLBreakpoint": DOMDebugger.setURLBreakpointParameters;
    "DOMDebugger.removeURLBreakpoint": DOMDebugger.removeURLBreakpointParameters;
    "DOMStorage.enable": DOMStorage.enableParameters;
    "DOMStorage.disable": DOMStorage.disableParameters;
    "DOMStorage.getDOMStorageItems": DOMStorage.getDOMStorageItemsParameters;
    "DOMStorage.setDOMStorageItem": DOMStorage.setDOMStorageItemParameters;
    "DOMStorage.removeDOMStorageItem": DOMStorage.removeDOMStorageItemParameters;
    "DOMStorage.clearDOMStorageItems": DOMStorage.clearDOMStorageItemsParameters;
    "Database.enable": Database.enableParameters;
    "Database.disable": Database.disableParameters;
    "Database.getDatabaseTableNames": Database.getDatabaseTableNamesParameters;
    "Database.executeSQL": Database.executeSQLParameters;
    "Debugger.enable": Debugger.enableParameters;
    "Debugger.disable": Debugger.disableParameters;
    "Debugger.setAsyncStackTraceDepth": Debugger.setAsyncStackTraceDepthParameters;
    "Debugger.setBreakpointsActive": Debugger.setBreakpointsActiveParameters;
    "Debugger.setBreakpointByUrl": Debugger.setBreakpointByUrlParameters;
    "Debugger.setBreakpoint": Debugger.setBreakpointParameters;
    "Debugger.removeBreakpoint": Debugger.removeBreakpointParameters;
    "Debugger.continueUntilNextRunLoop": Debugger.continueUntilNextRunLoopParameters;
    "Debugger.continueToLocation": Debugger.continueToLocationParameters;
    "Debugger.stepNext": Debugger.stepNextParameters;
    "Debugger.stepOver": Debugger.stepOverParameters;
    "Debugger.stepInto": Debugger.stepIntoParameters;
    "Debugger.stepOut": Debugger.stepOutParameters;
    "Debugger.pause": Debugger.pauseParameters;
    "Debugger.resume": Debugger.resumeParameters;
    "Debugger.searchInContent": Debugger.searchInContentParameters;
    "Debugger.getScriptSource": Debugger.getScriptSourceParameters;
    "Debugger.getFunctionDetails": Debugger.getFunctionDetailsParameters;
    "Debugger.setPauseOnDebuggerStatements": Debugger.setPauseOnDebuggerStatementsParameters;
    "Debugger.setPauseOnExceptions": Debugger.setPauseOnExceptionsParameters;
    "Debugger.setPauseOnAssertions": Debugger.setPauseOnAssertionsParameters;
    "Debugger.setPauseOnMicrotasks": Debugger.setPauseOnMicrotasksParameters;
    "Debugger.setPauseForInternalScripts": Debugger.setPauseForInternalScriptsParameters;
    "Debugger.evaluateOnCallFrame": Debugger.evaluateOnCallFrameParameters;
    "Debugger.setShouldBlackboxURL": Debugger.setShouldBlackboxURLParameters;
    "Debugger.setBlackboxBreakpointEvaluations": Debugger.setBlackboxBreakpointEvaluationsParameters;
    "Dialog.enable": Dialog.enableParameters;
    "Dialog.disable": Dialog.disableParameters;
    "Dialog.handleJavaScriptDialog": Dialog.handleJavaScriptDialogParameters;
    "Emulation.setDeviceMetricsOverride": Emulation.setDeviceMetricsOverrideParameters;
    "Emulation.setJavaScriptEnabled": Emulation.setJavaScriptEnabledParameters;
    "Emulation.setAuthCredentials": Emulation.setAuthCredentialsParameters;
    "Emulation.setActiveAndFocused": Emulation.setActiveAndFocusedParameters;
    "Emulation.grantPermissions": Emulation.grantPermissionsParameters;
    "Emulation.resetPermissions": Emulation.resetPermissionsParameters;
    "Heap.enable": Heap.enableParameters;
    "Heap.disable": Heap.disableParameters;
    "Heap.gc": Heap.gcParameters;
    "Heap.snapshot": Heap.snapshotParameters;
    "Heap.startTracking": Heap.startTrackingParameters;
    "Heap.stopTracking": Heap.stopTrackingParameters;
    "Heap.getPreview": Heap.getPreviewParameters;
    "Heap.getRemoteObject": Heap.getRemoteObjectParameters;
    "IndexedDB.enable": IndexedDB.enableParameters;
    "IndexedDB.disable": IndexedDB.disableParameters;
    "IndexedDB.requestDatabaseNames": IndexedDB.requestDatabaseNamesParameters;
    "IndexedDB.requestDatabase": IndexedDB.requestDatabaseParameters;
    "IndexedDB.requestData": IndexedDB.requestDataParameters;
    "IndexedDB.clearObjectStore": IndexedDB.clearObjectStoreParameters;
    "Input.dispatchKeyEvent": Input.dispatchKeyEventParameters;
    "Input.dispatchMouseEvent": Input.dispatchMouseEventParameters;
    "Input.dispatchWheelEvent": Input.dispatchWheelEventParameters;
    "Input.dispatchTapEvent": Input.dispatchTapEventParameters;
    "Inspector.enable": Inspector.enableParameters;
    "Inspector.disable": Inspector.disableParameters;
    "Inspector.initialized": Inspector.initializedParameters;
    "LayerTree.enable": LayerTree.enableParameters;
    "LayerTree.disable": LayerTree.disableParameters;
    "LayerTree.layersForNode": LayerTree.layersForNodeParameters;
    "LayerTree.reasonsForCompositingLayer": LayerTree.reasonsForCompositingLayerParameters;
    "Memory.enable": Memory.enableParameters;
    "Memory.disable": Memory.disableParameters;
    "Memory.startTracking": Memory.startTrackingParameters;
    "Memory.stopTracking": Memory.stopTrackingParameters;
    "Network.enable": Network.enableParameters;
    "Network.disable": Network.disableParameters;
    "Network.setExtraHTTPHeaders": Network.setExtraHTTPHeadersParameters;
    "Network.getResponseBody": Network.getResponseBodyParameters;
    "Network.setResourceCachingDisabled": Network.setResourceCachingDisabledParameters;
    "Network.loadResource": Network.loadResourceParameters;
    "Network.getSerializedCertificate": Network.getSerializedCertificateParameters;
    "Network.resolveWebSocket": Network.resolveWebSocketParameters;
    "Network.setInterceptionEnabled": Network.setInterceptionEnabledParameters;
    "Network.addInterception": Network.addInterceptionParameters;
    "Network.removeInterception": Network.removeInterceptionParameters;
    "Network.interceptContinue": Network.interceptContinueParameters;
    "Network.interceptWithRequest": Network.interceptWithRequestParameters;
    "Network.interceptWithResponse": Network.interceptWithResponseParameters;
    "Network.interceptRequestWithResponse": Network.interceptRequestWithResponseParameters;
    "Network.interceptRequestWithError": Network.interceptRequestWithErrorParameters;
    "Network.setEmulateOfflineState": Network.setEmulateOfflineStateParameters;
    "Page.enable": Page.enableParameters;
    "Page.disable": Page.disableParameters;
    "Page.reload": Page.reloadParameters;
    "Page.goBack": Page.goBackParameters;
    "Page.goForward": Page.goForwardParameters;
    "Page.navigate": Page.navigateParameters;
    "Page.overrideUserAgent": Page.overrideUserAgentParameters;
    "Page.overridePlatform": Page.overridePlatformParameters;
    "Page.overrideSetting": Page.overrideSettingParameters;
    "Page.getCookies": Page.getCookiesParameters;
    "Page.setCookie": Page.setCookieParameters;
    "Page.deleteCookie": Page.deleteCookieParameters;
    "Page.getResourceTree": Page.getResourceTreeParameters;
    "Page.getResourceContent": Page.getResourceContentParameters;
    "Page.setBootstrapScript": Page.setBootstrapScriptParameters;
    "Page.searchInResource": Page.searchInResourceParameters;
    "Page.searchInResources": Page.searchInResourcesParameters;
    "Page.setShowRulers": Page.setShowRulersParameters;
    "Page.setShowPaintRects": Page.setShowPaintRectsParameters;
    "Page.setEmulatedMedia": Page.setEmulatedMediaParameters;
    "Page.setForcedAppearance": Page.setForcedAppearanceParameters;
    "Page.setForcedReducedMotion": Page.setForcedReducedMotionParameters;
    "Page.setTimeZone": Page.setTimeZoneParameters;
    "Page.setTouchEmulationEnabled": Page.setTouchEmulationEnabledParameters;
    "Page.snapshotNode": Page.snapshotNodeParameters;
    "Page.snapshotRect": Page.snapshotRectParameters;
    "Page.archive": Page.archiveParameters;
    "Page.setScreenSizeOverride": Page.setScreenSizeOverrideParameters;
    "Page.insertText": Page.insertTextParameters;
    "Page.setComposition": Page.setCompositionParameters;
    "Page.accessibilitySnapshot": Page.accessibilitySnapshotParameters;
    "Page.setInterceptFileChooserDialog": Page.setInterceptFileChooserDialogParameters;
    "Page.setDefaultBackgroundColorOverride": Page.setDefaultBackgroundColorOverrideParameters;
    "Page.createUserWorld": Page.createUserWorldParameters;
    "Page.setBypassCSP": Page.setBypassCSPParameters;
    "Page.crash": Page.crashParameters;
    "Page.setOrientationOverride": Page.setOrientationOverrideParameters;
    "Page.setVisibleContentRects": Page.setVisibleContentRectsParameters;
    "Page.updateScrollingState": Page.updateScrollingStateParameters;
    "Playwright.enable": Playwright.enableParameters;
    "Playwright.disable": Playwright.disableParameters;
    "Playwright.close": Playwright.closeParameters;
    "Playwright.createContext": Playwright.createContextParameters;
    "Playwright.deleteContext": Playwright.deleteContextParameters;
    "Playwright.createPage": Playwright.createPageParameters;
    "Playwright.navigate": Playwright.navigateParameters;
    "Playwright.grantFileReadAccess": Playwright.grantFileReadAccessParameters;
    "Playwright.setIgnoreCertificateErrors": Playwright.setIgnoreCertificateErrorsParameters;
    "Playwright.getAllCookies": Playwright.getAllCookiesParameters;
    "Playwright.setCookies": Playwright.setCookiesParameters;
    "Playwright.deleteAllCookies": Playwright.deleteAllCookiesParameters;
    "Playwright.setGeolocationOverride": Playwright.setGeolocationOverrideParameters;
    "Playwright.setLanguages": Playwright.setLanguagesParameters;
    "Playwright.setDownloadBehavior": Playwright.setDownloadBehaviorParameters;
    "Playwright.cancelDownload": Playwright.cancelDownloadParameters;
    "Runtime.parse": Runtime.parseParameters;
    "Runtime.evaluate": Runtime.evaluateParameters;
    "Runtime.awaitPromise": Runtime.awaitPromiseParameters;
    "Runtime.callFunctionOn": Runtime.callFunctionOnParameters;
    "Runtime.getPreview": Runtime.getPreviewParameters;
    "Runtime.getProperties": Runtime.getPropertiesParameters;
    "Runtime.getDisplayableProperties": Runtime.getDisplayablePropertiesParameters;
    "Runtime.getCollectionEntries": Runtime.getCollectionEntriesParameters;
    "Runtime.saveResult": Runtime.saveResultParameters;
    "Runtime.setSavedResultAlias": Runtime.setSavedResultAliasParameters;
    "Runtime.releaseObject": Runtime.releaseObjectParameters;
    "Runtime.releaseObjectGroup": Runtime.releaseObjectGroupParameters;
    "Runtime.enable": Runtime.enableParameters;
    "Runtime.disable": Runtime.disableParameters;
    "Runtime.getRuntimeTypesForVariablesAtOffsets": Runtime.getRuntimeTypesForVariablesAtOffsetsParameters;
    "Runtime.enableTypeProfiler": Runtime.enableTypeProfilerParameters;
    "Runtime.disableTypeProfiler": Runtime.disableTypeProfilerParameters;
    "Runtime.enableControlFlowProfiler": Runtime.enableControlFlowProfilerParameters;
    "Runtime.disableControlFlowProfiler": Runtime.disableControlFlowProfilerParameters;
    "Runtime.getBasicBlocks": Runtime.getBasicBlocksParameters;
    "Screencast.startVideo": Screencast.startVideoParameters;
    "Screencast.stopVideo": Screencast.stopVideoParameters;
    "Screencast.startScreencast": Screencast.startScreencastParameters;
    "Screencast.stopScreencast": Screencast.stopScreencastParameters;
    "Screencast.screencastFrameAck": Screencast.screencastFrameAckParameters;
    "ScriptProfiler.startTracking": ScriptProfiler.startTrackingParameters;
    "ScriptProfiler.stopTracking": ScriptProfiler.stopTrackingParameters;
    "ServiceWorker.getInitializationInfo": ServiceWorker.getInitializationInfoParameters;
    "Target.setPauseOnStart": Target.setPauseOnStartParameters;
    "Target.resume": Target.resumeParameters;
    "Target.sendMessageToTarget": Target.sendMessageToTargetParameters;
    "Target.activate": Target.activateParameters;
    "Target.close": Target.closeParameters;
    "Timeline.enable": Timeline.enableParameters;
    "Timeline.disable": Timeline.disableParameters;
    "Timeline.start": Timeline.startParameters;
    "Timeline.stop": Timeline.stopParameters;
    "Timeline.setAutoCaptureEnabled": Timeline.setAutoCaptureEnabledParameters;
    "Timeline.setInstruments": Timeline.setInstrumentsParameters;
    "Worker.enable": Worker.enableParameters;
    "Worker.disable": Worker.disableParameters;
    "Worker.initialized": Worker.initializedParameters;
    "Worker.sendMessageToWorker": Worker.sendMessageToWorkerParameters;
  }
  export interface CommandReturnValues {
    "Animation.enable": Animation.enableReturnValue;
    "Animation.disable": Animation.disableReturnValue;
    "Animation.requestEffectTarget": Animation.requestEffectTargetReturnValue;
    "Animation.resolveAnimation": Animation.resolveAnimationReturnValue;
    "Animation.startTracking": Animation.startTrackingReturnValue;
    "Animation.stopTracking": Animation.stopTrackingReturnValue;
    "ApplicationCache.getFramesWithManifests": ApplicationCache.getFramesWithManifestsReturnValue;
    "ApplicationCache.enable": ApplicationCache.enableReturnValue;
    "ApplicationCache.disable": ApplicationCache.disableReturnValue;
    "ApplicationCache.getManifestForFrame": ApplicationCache.getManifestForFrameReturnValue;
    "ApplicationCache.getApplicationCacheForFrame": ApplicationCache.getApplicationCacheForFrameReturnValue;
    "Audit.setup": Audit.setupReturnValue;
    "Audit.run": Audit.runReturnValue;
    "Audit.teardown": Audit.teardownReturnValue;
    "Browser.enable": Browser.enableReturnValue;
    "Browser.disable": Browser.disableReturnValue;
    "CPUProfiler.startTracking": CPUProfiler.startTrackingReturnValue;
    "CPUProfiler.stopTracking": CPUProfiler.stopTrackingReturnValue;
    "CSS.enable": CSS.enableReturnValue;
    "CSS.disable": CSS.disableReturnValue;
    "CSS.getMatchedStylesForNode": CSS.getMatchedStylesForNodeReturnValue;
    "CSS.getInlineStylesForNode": CSS.getInlineStylesForNodeReturnValue;
    "CSS.getComputedStyleForNode": CSS.getComputedStyleForNodeReturnValue;
    "CSS.getFontDataForNode": CSS.getFontDataForNodeReturnValue;
    "CSS.getAllStyleSheets": CSS.getAllStyleSheetsReturnValue;
    "CSS.getStyleSheet": CSS.getStyleSheetReturnValue;
    "CSS.getStyleSheetText": CSS.getStyleSheetTextReturnValue;
    "CSS.setStyleSheetText": CSS.setStyleSheetTextReturnValue;
    "CSS.setStyleText": CSS.setStyleTextReturnValue;
    "CSS.setRuleSelector": CSS.setRuleSelectorReturnValue;
    "CSS.createStyleSheet": CSS.createStyleSheetReturnValue;
    "CSS.addRule": CSS.addRuleReturnValue;
    "CSS.getSupportedCSSProperties": CSS.getSupportedCSSPropertiesReturnValue;
    "CSS.getSupportedSystemFontFamilyNames": CSS.getSupportedSystemFontFamilyNamesReturnValue;
    "CSS.forcePseudoState": CSS.forcePseudoStateReturnValue;
    "CSS.setLayoutContextTypeChangedMode": CSS.setLayoutContextTypeChangedModeReturnValue;
    "Canvas.enable": Canvas.enableReturnValue;
    "Canvas.disable": Canvas.disableReturnValue;
    "Canvas.requestNode": Canvas.requestNodeReturnValue;
    "Canvas.requestContent": Canvas.requestContentReturnValue;
    "Canvas.requestClientNodes": Canvas.requestClientNodesReturnValue;
    "Canvas.resolveContext": Canvas.resolveContextReturnValue;
    "Canvas.setRecordingAutoCaptureFrameCount": Canvas.setRecordingAutoCaptureFrameCountReturnValue;
    "Canvas.startRecording": Canvas.startRecordingReturnValue;
    "Canvas.stopRecording": Canvas.stopRecordingReturnValue;
    "Canvas.requestShaderSource": Canvas.requestShaderSourceReturnValue;
    "Canvas.updateShader": Canvas.updateShaderReturnValue;
    "Canvas.setShaderProgramDisabled": Canvas.setShaderProgramDisabledReturnValue;
    "Canvas.setShaderProgramHighlighted": Canvas.setShaderProgramHighlightedReturnValue;
    "Console.enable": Console.enableReturnValue;
    "Console.disable": Console.disableReturnValue;
    "Console.clearMessages": Console.clearMessagesReturnValue;
    "Console.getLoggingChannels": Console.getLoggingChannelsReturnValue;
    "Console.setLoggingChannelLevel": Console.setLoggingChannelLevelReturnValue;
    "DOM.getDocument": DOM.getDocumentReturnValue;
    "DOM.requestChildNodes": DOM.requestChildNodesReturnValue;
    "DOM.querySelector": DOM.querySelectorReturnValue;
    "DOM.querySelectorAll": DOM.querySelectorAllReturnValue;
    "DOM.setNodeName": DOM.setNodeNameReturnValue;
    "DOM.setNodeValue": DOM.setNodeValueReturnValue;
    "DOM.removeNode": DOM.removeNodeReturnValue;
    "DOM.setAttributeValue": DOM.setAttributeValueReturnValue;
    "DOM.setAttributesAsText": DOM.setAttributesAsTextReturnValue;
    "DOM.removeAttribute": DOM.removeAttributeReturnValue;
    "DOM.getSupportedEventNames": DOM.getSupportedEventNamesReturnValue;
    "DOM.getDataBindingsForNode": DOM.getDataBindingsForNodeReturnValue;
    "DOM.getAssociatedDataForNode": DOM.getAssociatedDataForNodeReturnValue;
    "DOM.getEventListenersForNode": DOM.getEventListenersForNodeReturnValue;
    "DOM.setEventListenerDisabled": DOM.setEventListenerDisabledReturnValue;
    "DOM.setBreakpointForEventListener": DOM.setBreakpointForEventListenerReturnValue;
    "DOM.removeBreakpointForEventListener": DOM.removeBreakpointForEventListenerReturnValue;
    "DOM.getAccessibilityPropertiesForNode": DOM.getAccessibilityPropertiesForNodeReturnValue;
    "DOM.getOuterHTML": DOM.getOuterHTMLReturnValue;
    "DOM.setOuterHTML": DOM.setOuterHTMLReturnValue;
    "DOM.insertAdjacentHTML": DOM.insertAdjacentHTMLReturnValue;
    "DOM.performSearch": DOM.performSearchReturnValue;
    "DOM.getSearchResults": DOM.getSearchResultsReturnValue;
    "DOM.discardSearchResults": DOM.discardSearchResultsReturnValue;
    "DOM.requestNode": DOM.requestNodeReturnValue;
    "DOM.setInspectModeEnabled": DOM.setInspectModeEnabledReturnValue;
    "DOM.highlightRect": DOM.highlightRectReturnValue;
    "DOM.highlightQuad": DOM.highlightQuadReturnValue;
    "DOM.highlightSelector": DOM.highlightSelectorReturnValue;
    "DOM.highlightNode": DOM.highlightNodeReturnValue;
    "DOM.highlightNodeList": DOM.highlightNodeListReturnValue;
    "DOM.hideHighlight": DOM.hideHighlightReturnValue;
    "DOM.highlightFrame": DOM.highlightFrameReturnValue;
    "DOM.showGridOverlay": DOM.showGridOverlayReturnValue;
    "DOM.hideGridOverlay": DOM.hideGridOverlayReturnValue;
    "DOM.showFlexOverlay": DOM.showFlexOverlayReturnValue;
    "DOM.hideFlexOverlay": DOM.hideFlexOverlayReturnValue;
    "DOM.pushNodeByPathToFrontend": DOM.pushNodeByPathToFrontendReturnValue;
    "DOM.resolveNode": DOM.resolveNodeReturnValue;
    "DOM.getAttributes": DOM.getAttributesReturnValue;
    "DOM.moveTo": DOM.moveToReturnValue;
    "DOM.undo": DOM.undoReturnValue;
    "DOM.redo": DOM.redoReturnValue;
    "DOM.markUndoableState": DOM.markUndoableStateReturnValue;
    "DOM.focus": DOM.focusReturnValue;
    "DOM.setInspectedNode": DOM.setInspectedNodeReturnValue;
    "DOM.setAllowEditingUserAgentShadowTrees": DOM.setAllowEditingUserAgentShadowTreesReturnValue;
    "DOM.describeNode": DOM.describeNodeReturnValue;
    "DOM.scrollIntoViewIfNeeded": DOM.scrollIntoViewIfNeededReturnValue;
    "DOM.getContentQuads": DOM.getContentQuadsReturnValue;
    "DOM.setInputFiles": DOM.setInputFilesReturnValue;
    "DOMDebugger.setDOMBreakpoint": DOMDebugger.setDOMBreakpointReturnValue;
    "DOMDebugger.removeDOMBreakpoint": DOMDebugger.removeDOMBreakpointReturnValue;
    "DOMDebugger.setEventBreakpoint": DOMDebugger.setEventBreakpointReturnValue;
    "DOMDebugger.removeEventBreakpoint": DOMDebugger.removeEventBreakpointReturnValue;
    "DOMDebugger.setURLBreakpoint": DOMDebugger.setURLBreakpointReturnValue;
    "DOMDebugger.removeURLBreakpoint": DOMDebugger.removeURLBreakpointReturnValue;
    "DOMStorage.enable": DOMStorage.enableReturnValue;
    "DOMStorage.disable": DOMStorage.disableReturnValue;
    "DOMStorage.getDOMStorageItems": DOMStorage.getDOMStorageItemsReturnValue;
    "DOMStorage.setDOMStorageItem": DOMStorage.setDOMStorageItemReturnValue;
    "DOMStorage.removeDOMStorageItem": DOMStorage.removeDOMStorageItemReturnValue;
    "DOMStorage.clearDOMStorageItems": DOMStorage.clearDOMStorageItemsReturnValue;
    "Database.enable": Database.enableReturnValue;
    "Database.disable": Database.disableReturnValue;
    "Database.getDatabaseTableNames": Database.getDatabaseTableNamesReturnValue;
    "Database.executeSQL": Database.executeSQLReturnValue;
    "Debugger.enable": Debugger.enableReturnValue;
    "Debugger.disable": Debugger.disableReturnValue;
    "Debugger.setAsyncStackTraceDepth": Debugger.setAsyncStackTraceDepthReturnValue;
    "Debugger.setBreakpointsActive": Debugger.setBreakpointsActiveReturnValue;
    "Debugger.setBreakpointByUrl": Debugger.setBreakpointByUrlReturnValue;
    "Debugger.setBreakpoint": Debugger.setBreakpointReturnValue;
    "Debugger.removeBreakpoint": Debugger.removeBreakpointReturnValue;
    "Debugger.continueUntilNextRunLoop": Debugger.continueUntilNextRunLoopReturnValue;
    "Debugger.continueToLocation": Debugger.continueToLocationReturnValue;
    "Debugger.stepNext": Debugger.stepNextReturnValue;
    "Debugger.stepOver": Debugger.stepOverReturnValue;
    "Debugger.stepInto": Debugger.stepIntoReturnValue;
    "Debugger.stepOut": Debugger.stepOutReturnValue;
    "Debugger.pause": Debugger.pauseReturnValue;
    "Debugger.resume": Debugger.resumeReturnValue;
    "Debugger.searchInContent": Debugger.searchInContentReturnValue;
    "Debugger.getScriptSource": Debugger.getScriptSourceReturnValue;
    "Debugger.getFunctionDetails": Debugger.getFunctionDetailsReturnValue;
    "Debugger.setPauseOnDebuggerStatements": Debugger.setPauseOnDebuggerStatementsReturnValue;
    "Debugger.setPauseOnExceptions": Debugger.setPauseOnExceptionsReturnValue;
    "Debugger.setPauseOnAssertions": Debugger.setPauseOnAssertionsReturnValue;
    "Debugger.setPauseOnMicrotasks": Debugger.setPauseOnMicrotasksReturnValue;
    "Debugger.setPauseForInternalScripts": Debugger.setPauseForInternalScriptsReturnValue;
    "Debugger.evaluateOnCallFrame": Debugger.evaluateOnCallFrameReturnValue;
    "Debugger.setShouldBlackboxURL": Debugger.setShouldBlackboxURLReturnValue;
    "Debugger.setBlackboxBreakpointEvaluations": Debugger.setBlackboxBreakpointEvaluationsReturnValue;
    "Dialog.enable": Dialog.enableReturnValue;
    "Dialog.disable": Dialog.disableReturnValue;
    "Dialog.handleJavaScriptDialog": Dialog.handleJavaScriptDialogReturnValue;
    "Emulation.setDeviceMetricsOverride": Emulation.setDeviceMetricsOverrideReturnValue;
    "Emulation.setJavaScriptEnabled": Emulation.setJavaScriptEnabledReturnValue;
    "Emulation.setAuthCredentials": Emulation.setAuthCredentialsReturnValue;
    "Emulation.setActiveAndFocused": Emulation.setActiveAndFocusedReturnValue;
    "Emulation.grantPermissions": Emulation.grantPermissionsReturnValue;
    "Emulation.resetPermissions": Emulation.resetPermissionsReturnValue;
    "Heap.enable": Heap.enableReturnValue;
    "Heap.disable": Heap.disableReturnValue;
    "Heap.gc": Heap.gcReturnValue;
    "Heap.snapshot": Heap.snapshotReturnValue;
    "Heap.startTracking": Heap.startTrackingReturnValue;
    "Heap.stopTracking": Heap.stopTrackingReturnValue;
    "Heap.getPreview": Heap.getPreviewReturnValue;
    "Heap.getRemoteObject": Heap.getRemoteObjectReturnValue;
    "IndexedDB.enable": IndexedDB.enableReturnValue;
    "IndexedDB.disable": IndexedDB.disableReturnValue;
    "IndexedDB.requestDatabaseNames": IndexedDB.requestDatabaseNamesReturnValue;
    "IndexedDB.requestDatabase": IndexedDB.requestDatabaseReturnValue;
    "IndexedDB.requestData": IndexedDB.requestDataReturnValue;
    "IndexedDB.clearObjectStore": IndexedDB.clearObjectStoreReturnValue;
    "Input.dispatchKeyEvent": Input.dispatchKeyEventReturnValue;
    "Input.dispatchMouseEvent": Input.dispatchMouseEventReturnValue;
    "Input.dispatchWheelEvent": Input.dispatchWheelEventReturnValue;
    "Input.dispatchTapEvent": Input.dispatchTapEventReturnValue;
    "Inspector.enable": Inspector.enableReturnValue;
    "Inspector.disable": Inspector.disableReturnValue;
    "Inspector.initialized": Inspector.initializedReturnValue;
    "LayerTree.enable": LayerTree.enableReturnValue;
    "LayerTree.disable": LayerTree.disableReturnValue;
    "LayerTree.layersForNode": LayerTree.layersForNodeReturnValue;
    "LayerTree.reasonsForCompositingLayer": LayerTree.reasonsForCompositingLayerReturnValue;
    "Memory.enable": Memory.enableReturnValue;
    "Memory.disable": Memory.disableReturnValue;
    "Memory.startTracking": Memory.startTrackingReturnValue;
    "Memory.stopTracking": Memory.stopTrackingReturnValue;
    "Network.enable": Network.enableReturnValue;
    "Network.disable": Network.disableReturnValue;
    "Network.setExtraHTTPHeaders": Network.setExtraHTTPHeadersReturnValue;
    "Network.getResponseBody": Network.getResponseBodyReturnValue;
    "Network.setResourceCachingDisabled": Network.setResourceCachingDisabledReturnValue;
    "Network.loadResource": Network.loadResourceReturnValue;
    "Network.getSerializedCertificate": Network.getSerializedCertificateReturnValue;
    "Network.resolveWebSocket": Network.resolveWebSocketReturnValue;
    "Network.setInterceptionEnabled": Network.setInterceptionEnabledReturnValue;
    "Network.addInterception": Network.addInterceptionReturnValue;
    "Network.removeInterception": Network.removeInterceptionReturnValue;
    "Network.interceptContinue": Network.interceptContinueReturnValue;
    "Network.interceptWithRequest": Network.interceptWithRequestReturnValue;
    "Network.interceptWithResponse": Network.interceptWithResponseReturnValue;
    "Network.interceptRequestWithResponse": Network.interceptRequestWithResponseReturnValue;
    "Network.interceptRequestWithError": Network.interceptRequestWithErrorReturnValue;
    "Network.setEmulateOfflineState": Network.setEmulateOfflineStateReturnValue;
    "Page.enable": Page.enableReturnValue;
    "Page.disable": Page.disableReturnValue;
    "Page.reload": Page.reloadReturnValue;
    "Page.goBack": Page.goBackReturnValue;
    "Page.goForward": Page.goForwardReturnValue;
    "Page.navigate": Page.navigateReturnValue;
    "Page.overrideUserAgent": Page.overrideUserAgentReturnValue;
    "Page.overridePlatform": Page.overridePlatformReturnValue;
    "Page.overrideSetting": Page.overrideSettingReturnValue;
    "Page.getCookies": Page.getCookiesReturnValue;
    "Page.setCookie": Page.setCookieReturnValue;
    "Page.deleteCookie": Page.deleteCookieReturnValue;
    "Page.getResourceTree": Page.getResourceTreeReturnValue;
    "Page.getResourceContent": Page.getResourceContentReturnValue;
    "Page.setBootstrapScript": Page.setBootstrapScriptReturnValue;
    "Page.searchInResource": Page.searchInResourceReturnValue;
    "Page.searchInResources": Page.searchInResourcesReturnValue;
    "Page.setShowRulers": Page.setShowRulersReturnValue;
    "Page.setShowPaintRects": Page.setShowPaintRectsReturnValue;
    "Page.setEmulatedMedia": Page.setEmulatedMediaReturnValue;
    "Page.setForcedAppearance": Page.setForcedAppearanceReturnValue;
    "Page.setForcedReducedMotion": Page.setForcedReducedMotionReturnValue;
    "Page.setTimeZone": Page.setTimeZoneReturnValue;
    "Page.setTouchEmulationEnabled": Page.setTouchEmulationEnabledReturnValue;
    "Page.snapshotNode": Page.snapshotNodeReturnValue;
    "Page.snapshotRect": Page.snapshotRectReturnValue;
    "Page.archive": Page.archiveReturnValue;
    "Page.setScreenSizeOverride": Page.setScreenSizeOverrideReturnValue;
    "Page.insertText": Page.insertTextReturnValue;
    "Page.setComposition": Page.setCompositionReturnValue;
    "Page.accessibilitySnapshot": Page.accessibilitySnapshotReturnValue;
    "Page.setInterceptFileChooserDialog": Page.setInterceptFileChooserDialogReturnValue;
    "Page.setDefaultBackgroundColorOverride": Page.setDefaultBackgroundColorOverrideReturnValue;
    "Page.createUserWorld": Page.createUserWorldReturnValue;
    "Page.setBypassCSP": Page.setBypassCSPReturnValue;
    "Page.crash": Page.crashReturnValue;
    "Page.setOrientationOverride": Page.setOrientationOverrideReturnValue;
    "Page.setVisibleContentRects": Page.setVisibleContentRectsReturnValue;
    "Page.updateScrollingState": Page.updateScrollingStateReturnValue;
    "Playwright.enable": Playwright.enableReturnValue;
    "Playwright.disable": Playwright.disableReturnValue;
    "Playwright.close": Playwright.closeReturnValue;
    "Playwright.createContext": Playwright.createContextReturnValue;
    "Playwright.deleteContext": Playwright.deleteContextReturnValue;
    "Playwright.createPage": Playwright.createPageReturnValue;
    "Playwright.navigate": Playwright.navigateReturnValue;
    "Playwright.grantFileReadAccess": Playwright.grantFileReadAccessReturnValue;
    "Playwright.setIgnoreCertificateErrors": Playwright.setIgnoreCertificateErrorsReturnValue;
    "Playwright.getAllCookies": Playwright.getAllCookiesReturnValue;
    "Playwright.setCookies": Playwright.setCookiesReturnValue;
    "Playwright.deleteAllCookies": Playwright.deleteAllCookiesReturnValue;
    "Playwright.setGeolocationOverride": Playwright.setGeolocationOverrideReturnValue;
    "Playwright.setLanguages": Playwright.setLanguagesReturnValue;
    "Playwright.setDownloadBehavior": Playwright.setDownloadBehaviorReturnValue;
    "Playwright.cancelDownload": Playwright.cancelDownloadReturnValue;
    "Runtime.parse": Runtime.parseReturnValue;
    "Runtime.evaluate": Runtime.evaluateReturnValue;
    "Runtime.awaitPromise": Runtime.awaitPromiseReturnValue;
    "Runtime.callFunctionOn": Runtime.callFunctionOnReturnValue;
    "Runtime.getPreview": Runtime.getPreviewReturnValue;
    "Runtime.getProperties": Runtime.getPropertiesReturnValue;
    "Runtime.getDisplayableProperties": Runtime.getDisplayablePropertiesReturnValue;
    "Runtime.getCollectionEntries": Runtime.getCollectionEntriesReturnValue;
    "Runtime.saveResult": Runtime.saveResultReturnValue;
    "Runtime.setSavedResultAlias": Runtime.setSavedResultAliasReturnValue;
    "Runtime.releaseObject": Runtime.releaseObjectReturnValue;
    "Runtime.releaseObjectGroup": Runtime.releaseObjectGroupReturnValue;
    "Runtime.enable": Runtime.enableReturnValue;
    "Runtime.disable": Runtime.disableReturnValue;
    "Runtime.getRuntimeTypesForVariablesAtOffsets": Runtime.getRuntimeTypesForVariablesAtOffsetsReturnValue;
    "Runtime.enableTypeProfiler": Runtime.enableTypeProfilerReturnValue;
    "Runtime.disableTypeProfiler": Runtime.disableTypeProfilerReturnValue;
    "Runtime.enableControlFlowProfiler": Runtime.enableControlFlowProfilerReturnValue;
    "Runtime.disableControlFlowProfiler": Runtime.disableControlFlowProfilerReturnValue;
    "Runtime.getBasicBlocks": Runtime.getBasicBlocksReturnValue;
    "Screencast.startVideo": Screencast.startVideoReturnValue;
    "Screencast.stopVideo": Screencast.stopVideoReturnValue;
    "Screencast.startScreencast": Screencast.startScreencastReturnValue;
    "Screencast.stopScreencast": Screencast.stopScreencastReturnValue;
    "Screencast.screencastFrameAck": Screencast.screencastFrameAckReturnValue;
    "ScriptProfiler.startTracking": ScriptProfiler.startTrackingReturnValue;
    "ScriptProfiler.stopTracking": ScriptProfiler.stopTrackingReturnValue;
    "ServiceWorker.getInitializationInfo": ServiceWorker.getInitializationInfoReturnValue;
    "Target.setPauseOnStart": Target.setPauseOnStartReturnValue;
    "Target.resume": Target.resumeReturnValue;
    "Target.sendMessageToTarget": Target.sendMessageToTargetReturnValue;
    "Target.activate": Target.activateReturnValue;
    "Target.close": Target.closeReturnValue;
    "Timeline.enable": Timeline.enableReturnValue;
    "Timeline.disable": Timeline.disableReturnValue;
    "Timeline.start": Timeline.startReturnValue;
    "Timeline.stop": Timeline.stopReturnValue;
    "Timeline.setAutoCaptureEnabled": Timeline.setAutoCaptureEnabledReturnValue;
    "Timeline.setInstruments": Timeline.setInstrumentsReturnValue;
    "Worker.enable": Worker.enableReturnValue;
    "Worker.disable": Worker.disableReturnValue;
    "Worker.initialized": Worker.initializedReturnValue;
    "Worker.sendMessageToWorker": Worker.sendMessageToWorkerReturnValue;
  }
}
