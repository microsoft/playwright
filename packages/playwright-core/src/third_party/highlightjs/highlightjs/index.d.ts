/* eslint-disable no-unused-vars */
/* eslint-disable no-use-before-define */
// For TS consumers who use Node and don't have dom in their tsconfig lib, import the necessary types here.
/// <reference lib="dom" />

/* Public API */

// eslint-disable-next-line
declare const hljs: HLJSApi;

type HLJSApi = PublicApi & ModesAPI;

interface VuePlugin {
  install: (vue: any) => void;
}

interface PublicApi {
  highlight: (
    languageName: string,
    code: string,
    ignoreIllegals?: boolean,
    continuation?: Mode,
  ) => HighlightResult;
  highlightAuto: (code: string, languageSubset?: string[]) => AutoHighlightResult;
  fixMarkup: (html: string) => string;
  highlightBlock: (element: HTMLElement) => void;
  configure: (options: Partial<HLJSOptions>) => void;
  initHighlighting: () => void;
  initHighlightingOnLoad: () => void;
  registerLanguage: (languageName: string, language: LanguageFn) => void;
  listLanguages: () => string[];
  registerAliases: (
    aliasList: string | string[],
    { languageName }: { languageName: string },
  ) => void;
  getLanguage: (languageName: string) => Language | undefined;
  requireLanguage: (languageName: string) => Language | never;
  autoDetection: (languageName: string) => boolean;
  inherit: <T>(original: T, ...args: Record<string, any>[]) => T;
  addPlugin: (plugin: HLJSPlugin) => void;
  debugMode: () => void;
  safeMode: () => void;
  versionString: string;
  vuePlugin: () => VuePlugin;
}

interface ModesAPI {
  SHEBANG: (mode?: Partial<Mode> & { binary?: string | RegExp }) => Mode;
  BACKSLASH_ESCAPE: Mode;
  QUOTE_STRING_MODE: Mode;
  APOS_STRING_MODE: Mode;
  PHRASAL_WORDS_MODE: Mode;
  COMMENT: (begin: string | RegExp, end: string | RegExp, modeOpts?: Mode | {}) => Mode;
  C_LINE_COMMENT_MODE: Mode;
  C_BLOCK_COMMENT_MODE: Mode;
  HASH_COMMENT_MODE: Mode;
  NUMBER_MODE: Mode;
  C_NUMBER_MODE: Mode;
  BINARY_NUMBER_MODE: Mode;
  CSS_NUMBER_MODE: Mode;
  REGEXP_MODE: Mode;
  TITLE_MODE: Mode;
  UNDERSCORE_TITLE_MODE: Mode;
  METHOD_GUARD: Mode;
  END_SAME_AS_BEGIN: (mode: Mode) => Mode;
  // built in regex
  IDENT_RE: string;
  UNDERSCORE_IDENT_RE: string;
  NUMBER_RE: string;
  C_NUMBER_RE: string;
  BINARY_NUMBER_RE: string;
  RE_STARTERS_RE: string;
}

type LanguageFn = (hljs?: HLJSApi) => Language;
type CompilerExt = (mode: Mode, parent: Mode | Language | null) => void;

interface HighlightResult {
  relevance: number;
  value: string;
  language?: string;
  emitter: Emitter;
  illegal: boolean;
  top?: Language | CompiledMode;
  illegalBy?: illegalData;
  sofar?: string;
  errorRaised?: Error;
  // * for auto-highlight
  second_best?: Omit<HighlightResult, 'second_best'>;
  code?: string;
}
interface AutoHighlightResult extends HighlightResult {}

interface illegalData {
  msg: string;
  context: string;
  mode: CompiledMode;
}

type BeforeHighlightContext = {
  code: string;
  language: string;
  result?: HighlightResult;
};
type PluginEvent = keyof HLJSPlugin;
type HLJSPlugin = {
  'after:highlight'?: (result: HighlightResult) => void;
  'before:highlight'?: (context: BeforeHighlightContext) => void;
  'after:highlightBlock'?: (data: { result: HighlightResult }) => void;
  'before:highlightBlock'?: (data: { block: Element; language: string }) => void;
};

interface EmitterConstructor {
  new (opts: any): Emitter;
}

interface HLJSOptions {
  noHighlightRe: RegExp;
  languageDetectRe: RegExp;
  classPrefix: string;
  tabReplace?: string;
  useBR: boolean;
  languages?: string[];
  __emitter: EmitterConstructor;
}

interface CallbackResponse {
  data: Record<string, any>;
  ignoreMatch: () => void;
}

/************
 PRIVATE API
 ************/

/* for jsdoc annotations in the JS source files */

type AnnotatedError = Error & { mode?: Mode | Language; languageName?: string; badRule?: Mode };

type ModeCallback = (match: RegExpMatchArray, response: CallbackResponse) => void;
type HighlightedHTMLElement = HTMLElement & {
  result?: object;
  second_best?: object;
  parentNode: HTMLElement;
};
type EnhancedMatch = RegExpMatchArray & { rule: CompiledMode; type: MatchType };
type MatchType = 'begin' | 'end' | 'illegal';

interface Emitter {
  addKeyword(text: string, kind: string): void;
  addText(text: string): void;
  toHTML(): string;
  finalize(): void;
  closeAllNodes(): void;
  openNode(kind: string): void;
  closeNode(): void;
  addSublanguage(emitter: Emitter, subLanguageName: string): void;
}

/* modes */

interface ModeCallbacks {
  'on:end'?: Function;
  'on:begin'?: ModeCallback;
}

interface Mode extends ModeCallbacks, ModeDetails {}

interface LanguageDetail {
  name?: string;
  rawDefinition?: () => Language;
  aliases?: string[];
  disableAutodetect?: boolean;
  contains: Mode[];
  case_insensitive?: boolean;
  keywords?: Record<string, any> | string;
  compiled?: boolean;
  exports?: any;
  classNameAliases?: Record<string, string>;
  compilerExtensions?: CompilerExt[];
  supersetOf?: string;
}

type Language = LanguageDetail & Partial<Mode>;

interface CompiledLanguage extends LanguageDetail, CompiledMode {
  compiled: true;
  contains: CompiledMode[];
  keywords: Record<string, any>;
}

type KeywordData = [string, number];
type KeywordDict = Record<string, KeywordData>;

type CompiledMode = Omit<Mode, 'contains'> & {
  contains: CompiledMode[];
  keywords: KeywordDict;
  data: Record<string, any>;
  terminatorEnd: string;
  keywordPatternRe: RegExp;
  beginRe: RegExp;
  endRe: RegExp;
  illegalRe: RegExp;
  matcher: any;
  compiled: true;
  starts?: CompiledMode;
  parent?: CompiledMode;
};

interface ModeDetails {
  begin?: RegExp | string;
  match?: RegExp | string;
  end?: RegExp | string;
  className?: string;
  contains?: ('self' | Mode)[];
  endsParent?: boolean;
  endsWithParent?: boolean;
  endSameAsBegin?: boolean;
  skip?: boolean;
  excludeBegin?: boolean;
  excludeEnd?: boolean;
  returnBegin?: boolean;
  returnEnd?: boolean;
  __beforeBegin?: Function;
  parent?: Mode;
  starts?: Mode;
  lexemes?: string | RegExp;
  keywords?: Record<string, any> | string;
  beginKeywords?: string;
  relevance?: number;
  illegal?: string | RegExp | Array<string | RegExp>;
  variants?: Mode[];
  cachedVariants?: Mode[];
  // parsed
  subLanguage?: string | string[];
  compiled?: boolean;
  label?: string;
}

// deprecated API since v10
// declare module 'highlight.js/lib/highlight.js';

declare module 'highlight.js' {
  export = hljs;
}

declare module 'highlight.js/lib/languages/*' {
  export default function (hljs?: HLJSApi): LanguageDetail;
}

export = hljs;
