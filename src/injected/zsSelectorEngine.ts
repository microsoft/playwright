/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SelectorEngine, SelectorType, SelectorRoot } from './selectorEngine';

type Token = {
  combinator: '' | '>' | '~' | '^',
  index?: number,
  text?: string,
  css?: string,
};

function tokenize(selector: string): Token[] | number {
  const tokens: Token[] = [];
  let pos = 0;

  const skipWhitespace = () => {
    while (pos < selector.length && selector[pos] === ' ')
      pos++;
  };

  while (pos < selector.length) {
    skipWhitespace();
    if (pos === selector.length)
      break;
    if (!tokens.length && '^>~'.includes(selector[pos]))
      return pos;

    const token: Token = { combinator: '' };

    if (selector[pos] === '^') {
      token.combinator = '^';
      tokens.push(token);
      pos++;
      continue;
    }

    if (selector[pos] === '>') {
      token.combinator = '>';
      pos++;
      skipWhitespace();
      if (pos === selector.length)
        return pos;
    } else if (selector[pos] === '~') {
      token.combinator = '~';
      pos++;
      skipWhitespace();
      if (pos === selector.length)
        return pos;
    }

    let text = '';
    let end = pos;
    let stringQuote: string | undefined;
    const isText = '`"\''.includes(selector[pos]);
    while (end < selector.length) {
      if (stringQuote) {
        if (selector[end] === '\\' && end + 1 < selector.length) {
          if (!isText)
            text += selector[end];
          text += selector[end + 1];
          end += 2;
        } else if (selector[end] === stringQuote) {
          text += selector[end++];
          stringQuote = undefined;
          if (isText)
            break;
        } else {
          text += selector[end++];
        }
      } else if (' >~^#'.includes(selector[end])) {
        break;
      } else if ('`"\''.includes(selector[end])) {
        stringQuote = selector[end];
        text += selector[end++];
      } else {
        text += selector[end++];
      }
    }
    if (stringQuote)
      return end;
    if (isText)
      token.text = JSON.stringify(text.substring(1, text.length - 1));
    else
      token.css = text;

    pos = end;

    if (pos < selector.length && selector[pos] === '#') {
      pos++;
      let end = pos;
      while (end < selector.length && selector[end] >= '0' && selector[end] <= '9')
        end++;
      if (end === pos)
        return pos;
      const num = Number(selector.substring(pos, end));
      if (isNaN(num))
        return pos;
      token.index = num;
      pos = end;
    }

    tokens.push(token);
  }

  return tokens;
}

function pathFromRoot(root: SelectorRoot, targetElement: Element): (Element | SelectorRoot)[] {
  let target: Element | SelectorRoot = targetElement;
  const path: (Element | SelectorRoot)[] = [target];
  while (target !== root) {
    if (!target.parentNode || target.parentNode.nodeType !== 1 /* Node.ELEMENT_NODE */ && target.parentNode.nodeType !== 11 /* Node.DOCUMENT_FRAGMENT_NODE */)
      throw new Error('Target does not belong to the root subtree');
    target = target.parentNode as (Element | SelectorRoot);
    path.push(target);
  }
  path.reverse();
  return path;
}


// This is a map from a list element (parent) to a number of contained lists (immediate children).
//
// Example:
// <div>
//   <span class=a><img/><img/></span>
//   <span class=a/>
//   <span class=a/>
//   <br>
//   <div class=b/>
//   <div class=b/>
//   <div class=b/>
// </div>
//
// Here we might have the following:
//   div -> [[span, span, span], [div, div, div]]
//   span -> [[img, img]]
type ListsMap = Map<Element | SelectorRoot, Element[][]>;

function detectLists(root: SelectorRoot, shouldConsider: (e: Element | SelectorRoot) => boolean, getBox: (e: Element) => ClientRect): ListsMap {
  const lists: ListsMap = new Map();

  const add = (map: Map<string, Element[]>, element: Element, key: string): void => {
    let list = map.get(key);
    if (!list) {
      list = [];
      map.set(key, list);
    }
    list.push(element);
  };

  const mark = (parent: Element | SelectorRoot, map: Map<string, Element[]>, used: Set<Element>): void => {
    for (let list of map.values()) {
      list = list.filter(item => !used.has(item));
      if (list.length < 2)
        continue;
      let collection = lists.get(parent);
      if (!collection) {
        collection = [];
        lists.set(parent, collection);
      }
      collection.push(list);
      list.forEach(item => used.add(item));
    }
  };

  // hashes list: s, vh, v, h
  const kHashes = 4;
  const visit = (element: Element | SelectorRoot, produceHashes: boolean): { size: number, hashes?: string[] } => {
    const consider = shouldConsider(element);
    let size = 1;

    let maps: Map<string, Element[]>[] | undefined;
    if (consider)
      maps = new Array(kHashes).fill(0).map(_ => new Map());

    let structure: string[] | undefined;
    if (produceHashes)
      structure = [element.nodeName];

    for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
      const childResult = visit(child, consider);
      size += childResult.size;
      if (consider) {
        for (let i = 0; i < childResult.hashes!.length; i++) {
          if (childResult.hashes![i])
            add(maps![i], child, childResult.hashes![i]);
        }
      }
      if (structure)
        structure.push(child.nodeName);
    }

    if (consider) {
      const used = new Set<Element>();
      maps!.forEach(map => mark(element, map, used));
    }

    let hashes: string[] | undefined;
    if (produceHashes) {
      const box = getBox(element as Element);
      hashes = [];
      hashes.push((structure!.length >= 4) || (size >= 10) ? structure!.join('') : '');
      hashes.push(`${element.nodeName},${(size / 3) | 0},${box.height | 0},${box.width | 0}`);
      if (size <= 5)
        hashes.push(`${element.nodeName},${(size / 3) | 0},${box.width | 0},${box.left | 0}`);
      else
        hashes.push(`${element.nodeName},${(size / 3) | 0},${box.width | 0},${box.left | 0},${2 * Math.log(box.height) | 0}`);
      if (size <= 5)
        hashes.push(`${element.nodeName},${(size / 3) | 0},${box.height | 0},${box.top | 0}`);
      else
        hashes.push(`${element.nodeName},${(size / 3) | 0},${box.height | 0},${box.top | 0},${2 * Math.log(box.width) | 0}`);
    }
    return { size, hashes };
  };
  visit(root, false);

  return lists;
}

type Step = {
  token: Token;
  // Element we point at.
  element: Element | SelectorRoot;
  // Distance between element and (lca between target and element).
  depth: number;
  // One step score.
  score: number;
  // Total path score.
  totalScore: number;
  previous?: Step;
  // Repeat number for ^ steps.s
  repeat?: number;
};

type Options = {
  genericTagScore: number,
  textScore?: number,
  imgAltScore?: number,
  ariaLabelScore?: number,
  detectLists?: boolean,
  avoidShortText?: boolean,
  usePlaceholders?: boolean,

  debug?: boolean
};

const defaultOptions: Options = {
  genericTagScore: 10,
  textScore: 1,
  imgAltScore: 2,
  ariaLabelScore: 2,
  detectLists: true,
  avoidShortText: false,
  usePlaceholders: true,

  debug: false,
};

type CueType = 'text' | 'tag' | 'imgAlt' | 'ariaLabel';

type Cue = {
  type: CueType,
  score: number,
  elements: Element[],
};

type CueMap = Map<string, Cue>;

type ElementMetrics = {
  box: ClientRect,
  style: CSSStyleDeclaration,
  fontMetric: number,
};

type Lca = {
  lcaDepth: number;
  lca: Element | SelectorRoot;
  anchor: Element | SelectorRoot | undefined;
  depth: number;  // Distance to lca.
};

type PathCue = {
  type: CueType,
  score: number,
  elements: Element[][],
  anchorCount: Map<Element | SelectorRoot, number>,
};

type PreprocessResult = {
  pathCues: Map<string, PathCue>,
  lcaMap: Map<Element | SelectorRoot, Lca>,
};

type ListIndex = Map<Element | SelectorRoot, number>;

function parentOrRoot(element: Element | SelectorRoot): Element | SelectorRoot | null {
  return element.parentNode as Element | SelectorRoot;
}

class Engine {
  private _cues = new Map<Element | SelectorRoot, CueMap>();
  private _metrics = new Map<Element, ElementMetrics>();
  readonly options: Options;

  constructor(options: Options = defaultOptions) {
    this.options = options;
  }

  query(root: SelectorRoot, selector: string, all: boolean): Element[] {
    const tokens = tokenize(selector);
    if (typeof tokens === 'number')
      throw new Error('Cannot parse selector at position ' + tokens);
    if (!tokens.length)
      throw new Error('Empty selector');

    if (!this._cues.has(root)) {
      const cueMap: CueMap = new Map();
      const pathCues = this._preprocess(root, [root], Infinity).pathCues;
      for (const [text, cue] of pathCues) {
        cueMap.set(text, {
          type: cue.type,
          score: cue.score,
          elements: cue.elements[0]
        });
      }
      this._cues.set(root, cueMap);
    }

    // Map from the element to the boundary used. We never go outside the boundary when doing '~'.
    let currentStep = new Map<Element | SelectorRoot, Element | SelectorRoot>();
    currentStep.set(root, root);
    for (const token of tokens) {
      const nextStep = new Map<Element | SelectorRoot, Element | SelectorRoot>();
      for (let [element, boundary] of currentStep) {
        let next: (Element | SelectorRoot)[] = [];
        if (token.combinator === '^') {
          if (element === boundary) {
            next = [];
          } else {
            const parent = parentOrRoot(element);
            next = parent ? [parent] : [];
          }
        } else if (token.combinator === '>') {
          boundary = element;
          next = this._matchChildren(element, token, all);
        } else if (token.combinator === '') {
          boundary = element;
          next = this._matchSubtree(element, token, all);
        } else if (token.combinator === '~') {
          while (true) {
            next = this._matchSubtree(element, token, all);
            if (next.length) {
              // Further '~' / '^' will not go outside of this boundary, which is
              // a container with both the cue and the target elements inside.
              boundary = element;
              break;
            }
            if (element === boundary)
              break;
            element = parentOrRoot(element)!;
          }
        }
        for (const nextElement of next) {
          if (!nextStep.has(nextElement))
            nextStep.set(nextElement, boundary);
        }
      }
      currentStep = nextStep;
    }
    return Array.from(currentStep.keys()).filter(e => e.nodeType === 1 /* Node.ELEMENT_NODE */) as Element[];
  }

  create(root: SelectorRoot, target: Element, type: SelectorType): string {
    const path = pathFromRoot(root, target);

    const maxCueCount = type === 'notext' ? 50 : 10;
    const { pathCues, lcaMap } = this._preprocess(root, path, maxCueCount);

    const lists: ListIndex | undefined = this.options.detectLists ?
      this._buildLists(root, path) : undefined;

    const queue: Map<Element | SelectorRoot | undefined, Step>[] = path.map(_ => new Map());
    const startStep: Step = {
      token: { combinator: '' },
      element: root,
      depth: 0,
      score: 0,
      totalScore: 0
    };

    for (let stepDepth = -1; stepDepth < path.length; stepDepth++) {
      const stepsMap = stepDepth === -1 ? new Map([[undefined, startStep]]) : queue[stepDepth];
      const ancestorDepth = stepDepth === -1 ? 0 : stepDepth;
      for (const [text, cue] of pathCues) {
        const elements = cue.elements[ancestorDepth];
        for (let index = 0; index < elements.length; index++) {
          const element = elements[index];
          const lca = lcaMap.get(element)!;
          const lcaDepth = lca.lcaDepth;

          // Always go deeper in the tree.
          if (lcaDepth <= stepDepth)
            continue;

          // 'notext' - do not use elements from the target's subtree.
          if (type === 'notext' && lcaDepth === path.length - 1 && lca.depth > 0)
            continue;

          // 'notext' - do not use target's own text.
          if (type === 'notext' && lcaDepth === path.length - 1 && !lca.depth && cue.type !== 'tag')
            continue;

          const targetAnchor = path[lcaDepth + 1];
          if (lists && lca.anchor && targetAnchor && lca.anchor !== targetAnchor) {
            const oldList = lists.get(lca.anchor);
            // Do not use cues from sibling list items (lca.anchor and targetAnchor).
            if (oldList && oldList === lists.get(targetAnchor))
              continue;
          }

          if (cue.type !== 'tag' && !this._isVisible(element))
            continue;

          const distanceToTarget = path.length - stepDepth;
          // Short text can be used more effectively in a smaller scope.
          let shortTextScore = 0;
          if (this.options.avoidShortText && cue.type === 'text')
            shortTextScore = Math.max(0, distanceToTarget - 2 * (text.length - 2));

          const score = (cue.score + shortTextScore) * (
            // Unique cues are heavily favored.
            1 * (index + elements.length * 1000) +

            // Larger text is preferred.
            5 * (cue.type === 'text' ? this._elementMetrics(element).fontMetric : 1) +

            // The closer to the target, the better.
            1 * lca.depth
          );
          for (const [anchor, step] of stepsMap) {
            // This ensures uniqueness when resolving the selector.
            if (anchor && (cue.anchorCount.get(anchor) || 0) > index)
              continue;

            let newStep: Step = {
              token: {
                combinator: stepDepth === -1 ? '' : '~',
                text: cue.type === 'text' ? text : undefined,
                css: cue.type === 'text' ? undefined : text,
                index: index || undefined,
              },
              previous: step,
              depth: lca.depth,
              element,
              score,
              totalScore: step.totalScore + score
            };
            let nextStep = queue[lcaDepth].get(lca.anchor);
            if (!nextStep || nextStep.totalScore > newStep.totalScore)
              queue[lcaDepth].set(lca.anchor, newStep);

            // Try going to the ancestor.
            if (newStep.depth) {
              newStep = {
                token: { combinator: '^' },
                previous: newStep,
                depth: 0,
                element: lca.lca,
                score: 2000 * newStep.depth,
                totalScore: newStep.totalScore + 2000 * newStep.depth,
                repeat: newStep.depth
              };
              nextStep = queue[lcaDepth].get(undefined);
              if (!nextStep || nextStep.totalScore > newStep.totalScore)
                queue[lcaDepth].set(undefined, newStep);
            }
          }
        }
      }
    }

    let best: Step | undefined;
    for (const [, step] of queue[path.length - 1]) {
      if (!best || step.totalScore < best.totalScore)
        best = step;
    }

    if (!best)
      return '';

    const tokens: Token[] = new Array(best.depth).fill({ combinator: '^' });
    while (best && best !== startStep) {
      for (let repeat = best.repeat || 1; repeat; repeat--)
        tokens.push(best.token);
      best = best.previous;
    }
    tokens.reverse();
    return this._serialize(tokens);
  }

  private _textMetric(text: string): number {
    // Text which looks like a float number or counter is most likely volatile.
    if (/^\$?[\d,]+(\.\d+|(\.\d+)?[kKmMbBgG])?$/.test(text))
      return 12;
    const num = Number(text);
    // Large numbers are likely volatile.
    if (!isNaN(num) && (num >= 32 || num < 0))
      return 6;
    return 1;
  }

  private _elementMetrics(element: Element): ElementMetrics {
    let metrics = this._metrics.get(element);
    if (!metrics) {
      const style = element.ownerDocument ?
          element.ownerDocument.defaultView!.getComputedStyle(element) :
        ({} as CSSStyleDeclaration);
      const box = element.getBoundingClientRect();
      const fontSize = (parseInt(style.fontSize || '', 10) || 12) / 12;        // default 12 px
      const fontWeight = (parseInt(style.fontWeight || '', 10) || 400) / 400;  // default normal weight
      let fontMetric = fontSize * (1 + (fontWeight - 1) / 5);
      fontMetric = 1 / Math.exp(fontMetric - 1);
      metrics = { box, style, fontMetric };
      this._metrics.set(element, metrics);
    }
    return metrics;
  }

  private _isVisible(element: Element): boolean {
    const metrics = this._elementMetrics(element);
    return metrics.box.width > 1 && metrics.box.height > 1;
  }

  private _preprocess(root: SelectorRoot, path: (Element | SelectorRoot)[], maxCueCount: number): PreprocessResult {
    const pathCues = new Map<string, PathCue>();
    const lcaMap = new Map<Element | SelectorRoot, Lca>();
    const textScore = this.options.textScore || 1;

    const appendCue = (text: string, type: CueType, score: number, element: Element, lca: Lca, textValue: string) => {
      let pathCue = pathCues.get(text);
      if (!pathCue) {
        pathCue = { type, score: (textValue ? this._textMetric(textValue) : 1) * score, elements: [], anchorCount: new Map() };
        for (let i = 0; i < path.length; i++)
          pathCue.elements.push([]);
        pathCues.set(text, pathCue);
      }
      for (let index = lca.lcaDepth; index >= 0; index--) {
        const elements = pathCue.elements[index];
        if (elements.length < maxCueCount)
          elements.push(element);
      }
      if (lca.anchor)
        pathCue.anchorCount.set(lca.anchor, 1 + (pathCue.anchorCount.get(lca.anchor) || 0));
    };

    const appendElementCues = (element: Element, lca: Lca, detached: boolean) => {
      const nodeName = element.nodeName;
      if (!detached && this.options.usePlaceholders && nodeName === 'INPUT') {
        const placeholder = element.getAttribute('placeholder');
        if (placeholder)
          appendCue(JSON.stringify(placeholder), 'text', textScore, element, lca, placeholder);
      }
      if (!detached && nodeName === 'INPUT' && element.getAttribute('type') === 'button') {
        const value = element.getAttribute('value');
        if (value)
          appendCue(JSON.stringify(value), 'text', textScore, element, lca, value);
      }

      if (!nodeName.startsWith('<pseudo') && !nodeName.startsWith('::'))
        appendCue(nodeName, 'tag', this.options.genericTagScore, element, lca, '');
      if (this.options.imgAltScore && nodeName === 'IMG') {
        const alt = element.getAttribute('alt');
        if (alt)
          appendCue(`img[alt=${JSON.stringify(alt)}]`, 'imgAlt', this.options.imgAltScore, element, lca, alt);
      }
      if (this.options.ariaLabelScore) {
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel)
          appendCue(JSON.stringify(`[aria-label=${JSON.stringify(ariaLabel)}]`), 'ariaLabel', this.options.ariaLabelScore, element, lca, ariaLabel);
      }
    };

    const visit = (element: Element | SelectorRoot, lca: Lca, depth: number) => {
      // Check for elements STYLE, NOSCRIPT, SCRIPT, OPTION and other elements
      // that have |display:none| behavior.
      const detached = !(element as HTMLElement).offsetParent;
      if (element.nodeType === 1 /* Node.ELEMENT_NODE */)
        appendElementCues(element as Element, lca, detached);
      lcaMap.set(element, lca);

      for (let childNode = element.firstChild; childNode; childNode = childNode.nextSibling) {
        if (element.nodeType === 1 /* Node.ELEMENT_NODE */ && !detached && childNode.nodeType === 3 /* Node.TEXT_NODE */ && childNode.nodeValue) {
          const textValue = childNode.nodeValue.trim();
          if (textValue)
            appendCue(JSON.stringify(textValue), 'text', textScore, element as Element, lca, textValue);
        }
        if (childNode.nodeType !== 1 /* Node.ELEMENT_NODE */)
          continue;

        const childElement = childNode as Element;
        if (childElement.nodeName.startsWith('<pseudo:'))
          continue;

        if (path[depth + 1] === childElement) {
          const childLca = { depth: 0, lca: childElement, lcaDepth: depth + 1, anchor: (undefined as Element | SelectorRoot | undefined) };
          visit(childElement, childLca, depth + 1);
        } else {
          const childLca = { depth: lca.depth + 1, lca: lca.lca, lcaDepth: lca.lcaDepth, anchor: lca.anchor || element };
          visit(childElement, childLca, depth + 1);
        }
      }
    };
    visit(root, { depth: 0, lca: root, lcaDepth: 0, anchor: undefined }, 0);

    return { pathCues: pathCues, lcaMap };
  }

  private _filterCues(cues: CueMap, root: Element | SelectorRoot): CueMap {
    const result = new Map();
    for (const [text, cue] of cues) {
      const filtered = cue.elements.filter(element => root.contains(element));
      if (!filtered.length)
        continue;
      const newCue: Cue = { type: cue.type, score: cue.score, elements: filtered };
      result.set(text, newCue);
    }
    return result;
  }

  private _buildLists(root: Element | SelectorRoot, path: (Element | SelectorRoot)[]): ListIndex {
    const pathSet = new Set(path);
    const map = detectLists(root, e => pathSet.has(e), e => this._elementMetrics(e).box);
    const result: ListIndex = new Map();
    let listNumber = 1;
    for (const collection of map.values()) {
      for (const list of collection) {
        for (const child of list)
          result.set(child, listNumber);
        ++listNumber;
      }
    }
    return result;
  }

  private _matchChildren(parent: Element | SelectorRoot, token: Token, all: boolean): Element[] {
    const result: Element[] = [];
    if (token.index !== undefined)
      all = false;
    let index = token.index || 0;

    if (token.css !== undefined) {
      for (let child = parent.firstElementChild; child; child = child.nextElementSibling) {
        if (child.matches(token.css) && (all || !index--)) {
          result.push(child);
          if (!all)
            return result;
        }
      }
      return result;
    }

    if (token.text !== undefined) {
      const cue = this._getCues(parent).get(token.text);
      if (!cue || cue.type !== 'text')
        return [];
      for (const element of cue.elements) {
        if (parentOrRoot(element) === parent && (all || !index--)) {
          result.push(element);
          if (!all)
            return result;
        }
      }
      return result;
    }

    throw new Error('Unsupported token');
  }

  private _matchSubtree(root: Element | SelectorRoot, token: Token, all: boolean): Element[] {
    const result: Element[] = [];
    if (token.index !== undefined)
      all = false;
    let index = token.index || 0;

    if (token.css !== undefined) {
      if (root.nodeType === 1 /* Node.ELEMENT_NODE */) {
        const rootElement = root as Element;
        if (rootElement.matches(token.css) && (all || !index--)) {
          result.push(rootElement);
          if (!all)
            return result;
        }
      }
      const queried = root.querySelectorAll(token.css);
      if (all)
        result.push(...Array.from(queried));
      else if (queried.length > index)
        result.push(queried.item(index));
      return result;
    }

    if (token.text !== undefined) {
      const texts = this._getCues(root);
      const cue = texts.get(token.text);
      if (!cue || cue.type !== 'text')
        return result;
      if (all)
        return cue.elements;
      if (index < cue.elements.length)
        result.push(cue.elements[index]);
      return result;
    }

    throw new Error('Unsupported token');
  }

  private _getCues(element: Element | SelectorRoot): CueMap {
    if (!this._cues.has(element)) {
      let parent = element;
      while (!this._cues.has(parent))
        parent = parentOrRoot(parent)!;
      this._cues.set(element, this._filterCues(this._cues.get(parent)!, element));
    }
    return this._cues.get(element)!;
  }

  private _serialize(tokens: Token[]): string {
    const result = tokens.map(token => (token.combinator === '' ? ' ' : token.combinator) +
          (token.text !== undefined ? token.text : '') +
          (token.css !== undefined ? token.css : '') +
          (token.index !== undefined ? '#' + token.index : '')).join('');
    if (result[0] !== ' ')
      throw new Error('First token is wrong');
    return result.substring(1);
  }
}

const ZSSelectorEngine: SelectorEngine = {
  name: 'zs',

  create(root: SelectorRoot, element: Element, type?: SelectorType): string {
    return new Engine().create(root, element, type || 'default');
  },

  query(root: SelectorRoot, selector: string): Element | undefined {
    return new Engine().query(root, selector, false /* all */)[0];
  },

  queryAll(root: SelectorRoot, selector: string): Element[] {
    return new Engine().query(root, selector, true /* all */);
  }
};

(ZSSelectorEngine as any).test = () => {
  const elements = Array.from(document.querySelectorAll('*')).slice(1500, 2000);
  console.time('test');  // eslint-disable-line no-console
  const failures = elements.filter((e, index) => {
    const name = e.tagName.toUpperCase();
    if (name === 'SCRIPT' || name === 'STYLE' || name === 'NOSCRIPT' || name === 'META' || name === 'LINK' || name === 'OPTION')
      return false;
    if (index % 100 === 0)
      console.log(`${index} / ${elements.length}`);  // eslint-disable-line no-console
    if (e.nodeName.toLowerCase().startsWith('<pseudo:'))
      e = e.parentElement!;
    while (e && e.namespaceURI && e.namespaceURI.endsWith('svg') && e.nodeName.toLowerCase() !== 'svg')
      e = e.parentElement!;
    try {
      document.documentElement.style.outline = '1px solid red';
      const selector = new Engine().create(document.documentElement, e, 'default');
      document.documentElement.style.outline = '1px solid green';
      const e2 = new Engine().query(document.documentElement, selector, false)[0];
      return e !== e2;
    } catch (e) {
      return false;
    }
  });
  console.timeEnd('test');  // eslint-disable-line no-console
  console.log(failures);  // eslint-disable-line no-console
};

export default ZSSelectorEngine;
