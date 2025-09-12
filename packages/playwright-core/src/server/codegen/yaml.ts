// packages/playwright-core/src/server/codegen/yaml.ts
import * as YAML from 'js-yaml';
import type { Language, LanguageGenerator, LanguageGeneratorOptions } from './types';
import type * as actions from '@recorder/actions';

function frameRefFromString(sel: string) {
  const m = sel.match(/^frame\[name="(.+)"\]$/);
  if (m) return { name: m[1] as string };
  return { selector: sel }; // fallback
}

function framePathToObjects(path?: string[]) {
  if (!path?.length) return undefined;
  return path.map(frameRefFromString);
}

// ---- parse recorder's "internal:" strings into a structured element (best-effort) ----
function elementFromRecorderRaw(raw?: string): { element: any; debug?: { raw: string } } | undefined {
  if (!raw) return undefined;
  // testId (works when you run codegen with --test-id-attribute)
  {
    const m = raw.match(/internal:testid=.*?"([^"]+)"/);
    if (m) return { element: { testId: m[1] }, debug: { raw } };
  }
  // role+name
  {
    const m = raw.match(/internal:role=.*?name="([^"]+)"[^\]]*\]/);
    const role = raw.match(/internal:role=([a-zA-Z]+)/)?.[1];
    if (role) return { element: { role, name: m?.[1] }, debug: { raw } };
  }
  // text (best-effort)
  {
    const m = raw.match(/internal:text="([^"]+)"/);
    if (m) return { element: { text: { value: m[1], exact: false } }, debug: { raw } };
  }
  // fallback: css-like
  return { element: { css: raw }, debug: { raw } };
}

function isActionWithSelector(action: any): action is actions.ActionWithSelector {
  return action && (action as any)?.selector;
}

// Build the structured selector object we want in the schema
function buildStructuredSelector(a: actions.ActionInContext): any {
  const action = a.action;
  if (isActionWithSelector(action)) {
    const raw = action.selector;
    const parsed = elementFromRecorderRaw(raw);
    const framePath = framePathToObjects(a.frame.framePath);
    const selector: any = {
      element: parsed?.element ?? { css: raw ?? 'UNKNOWN' },
    };
    if (framePath) selector.framePath = framePath;
    if (parsed?.debug) selector.debug = parsed.debug;
    return selector;
  }
  return undefined;
}

// Simple default stripper
function stripDefaults<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (k === 'modifiers' && v === 0) continue;
    if (k === 'framePath' && Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const nested = stripDefaults(v as any);
      if (Object.keys(nested).length) out[k] = nested;
    } else out[k] = v;
  }
  return out;
}

function stripEmpty<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (v.length) out[k] = v.map(x => (typeof x === 'object' ? stripEmpty(x as any) : x));
      continue;
    }
    if (typeof v === 'object') {
      const nested = stripEmpty(v as any);
      if (Object.keys(nested).length) out[k] = nested;
      continue;
    }
    out[k] = v;
  }
  return out;
}

// Make any object YAML-safe: remove functions/symbols/undefined,
// handle cycles, and stringify common non-plain values.
function serializeForYaml(input: any, seen = new WeakSet()): any {
  const t = typeof input;
  if (input == null || t === 'string' || t === 'number' || t === 'boolean') return input;
  if (t === 'bigint') return input.toString();
  if (t === 'function' || t === 'symbol' || t === 'undefined') return undefined;

  if (input instanceof URL) return input.toString();
  if (input instanceof Date) return input.toISOString();
  if (input instanceof RegExp) return String(input);

  if (Array.isArray(input)) return input.map(v => serializeForYaml(v, seen));

  if (t === 'object') {
    if (seen.has(input)) return '[Circular]';
    seen.add(input);
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      const sv = serializeForYaml(v, seen);
      if (sv !== undefined) out[k] = sv;
    }
    return out;
  }
  // Fallback
  try { return JSON.parse(JSON.stringify(input)); } catch { return String(input); }
}

function formatAsYamlListItem(entry: unknown, dumpOpts: any): string {
  const dumped = YAML.dump(entry, dumpOpts).replace(/\r\n?/g, '\n');
  const lines = dumped.endsWith('\n') ? dumped.slice(0, -1).split('\n') : dumped.split('\n');
  return lines.map((line, i) => (i === 0 ? `  - ${line}` : `    ${line}`)).join('\n') + '\n';
}

// Mask values that look like passwords
function matchText(t: string | { value: string; regex?: string; exact?: boolean }): boolean {
  if (typeof t === 'string') return /password|pwd|secret/i.test(t);
  if (t.value && /password|pwd|secret/i.test(t.value)) return true;
  if (t.regex && /password|pwd|secret/i.test(t.regex)) return true;
  return false;
}

function maybeMaskValue(el: any, text: string | undefined): string | undefined {
  if (text == null) return text;

  // testId or label or placeholder containing "password"/"pwd"/"secret"
  if ('testId' in el && /password|pwd|secret/i.test(el.testId)) return '${env:ANET_PASSWORD}';
  if ('label' in el && matchText(el.label)) return '${env:ANET_PASSWORD}';
  if ('placeholder' in el && matchText(el.placeholder)) return '${env:ANET_PASSWORD}';
  if ('role' in el && /password|pwd|secret/i.test(el.name ?? '')) return '${env:ANET_PASSWORD}';
  if ('text' in el && matchText(el.text)) return '${env:ANET_PASSWORD}';
  if ('css' in el && /password|pwd|secret/i.test(el.css)) return '${env:ANET_PASSWORD}';
  if ('xpath' in el && /password|pwd|secret/i.test(el.xpath)) return '${env:ANET_PASSWORD}';

  return text;
}

// URLs we consider noise for the first step
const TRIVIAL_URL_PREFIXES = [
  'about:blank',
  'chrome-error://',
  'devtools://',
  'edge://',
  'data:',
  'blob:',
  'chrome-extension://',
];

function isTrivialUrl(url?: string): boolean {
  if (!url) return true;
  return TRIVIAL_URL_PREFIXES.some(p => url.startsWith(p));
}


export class YamlLanguageGenerator implements LanguageGenerator {
  id = 'yaml';
  groupName = 'Genfest';
  name = 'YAML';
  highlighter = 'javascript' as Language;

  private _dumpOpts = { noRefs: true, lineWidth: 120, forceQuotes: true };
  private _headerEmitted = false;
  private _seedUrl: string | undefined;
  private _meta: { version: string; name: string; baseURL?: string } = {
    version: '0.1',
    name: 'Recorded Scenario',
  };

  private _emitHeaderOnce(): string[] {
    if (this._headerEmitted) return [];
    this._headerEmitted = true;

    // Dump only the meta (no steps), then add "steps:"; from now on we'll append list items.
    const metaDump = YAML.dump(stripEmpty(this._meta), this._dumpOpts).replace(/\r\n?/g, '\n');
    const metaNoTrail = metaDump.endsWith('\n') ? metaDump.slice(0, -1) : metaDump;

    return [
      metaNoTrail,
      'steps:',
      '', // blank line for readability
    ];
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    // Derive defaults early so header can include them.
    this._seedUrl = options?.contextOptions?.baseURL || undefined;

    this._meta = {
      version: '0.1',
      name: (this._seedUrl ? new URL(this._seedUrl).hostname : 'Recorded Scenario'),
      baseURL: options?.contextOptions?.baseURL || this._seedUrl,
    };

    this._headerEmitted = false;

    // // STREAM: print header now so the code window isn’t empty while recording.
    // return this._emitHeaderOnce().join('\n');
    return '# Generated by Genfest'
  }

  generateAction(a: actions.ActionInContext): string {
    const out: string[] = [];

    const action = a.action;
    const selector = buildStructuredSelector(a);

    // Handle actions
    switch (action.name) {

      // --- navigate ----------------------------------------------
      case 'openPage':
      case 'navigate': {
        const url = action.url;
        // Skip trivial URLs
        if (isTrivialUrl(url)) return out.join('\n');

        if (!this._meta.baseURL) this._meta.baseURL = url;
        if (!this._headerEmitted) out.push(...this._emitHeaderOnce());
        const step = {
          action: 'navigate',
          url: action.url,
        }
        out.push(formatAsYamlListItem(step, this._dumpOpts));
        break;
      }

      // --- click -------------------------------------------------
      case 'click': {
        const actionName = (action.clickCount === 2) ? 'dblclick' : 'click';
        const step = stripDefaults({
          action: actionName,
          selector,
          button: action.button,
          modifiers: action.modifiers,
        });
        out.push(formatAsYamlListItem(step, this._dumpOpts));
        break;
      }

      // --- fill --------------------------------------------------
      case 'fill': {
        const step = stripDefaults({
          action: 'fill',
          selector,
          text: maybeMaskValue(selector.element, action.text),
        });
        out.push(formatAsYamlListItem(step, this._dumpOpts));
        break;
      }

      // --- press -------------------------------------------------
      case 'press': {
        const step = stripDefaults({
          action: 'keyPress',
          selector,
          key: action.key,
          modifiers: action.modifiers,
        });
        out.push(formatAsYamlListItem(step, this._dumpOpts));
        break;
      }

      // --- check -------------------------------------------------
      case 'check': {
        const step = {
          action: 'check',
          selector,
        }
        out.push(formatAsYamlListItem(step, this._dumpOpts));
        break;
      }

      // --- uncheck -----------------------------------------------
      case 'uncheck': {
        const step = {
          action: 'uncheck',
          selector,
        }
        out.push(formatAsYamlListItem(step, this._dumpOpts));
        break;
      }

      // --- assertText --------------------------------------------
      case 'assertText': {
        const step = {
          action: 'assert.text',
          selector,
          text: action.text,
        }
        out.push(formatAsYamlListItem(step, this._dumpOpts));
        break;
      }

      // --- assertValue -------------------------------------------
      case 'assertValue': {
        const step = {
          action: 'assert.value',
          selector,
          value: action.value,
        }
        out.push(formatAsYamlListItem(step, this._dumpOpts));
        break;
      }

      // --- assertVisible -----------------------------------------
      case 'assertVisible': {
        const step = {
          action: 'assert.visible',
          selector,
        }
        out.push(formatAsYamlListItem(step, this._dumpOpts));
        break;
      }

      // --- closePage ---------------------------------------------
      // --- select ------------------------------------------------
      // --- setInputFiles -----------------------------------------
      // --- assertSnapshot ----------------------------------------
      default: {
        // Dump everything we have for unimplemented actions,
        const raw = serializeForYaml(a);
        out.push(formatAsYamlListItem(raw, this._dumpOpts));
        break;
      }
    }

    return out.join('\n');
  }

  // Nothing to flush at the end; the document was streamed.
  generateFooter(saveStorage: string | undefined): string {
    return '';
  }
}
