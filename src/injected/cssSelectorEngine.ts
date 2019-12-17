// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { SelectorEngine, SelectorRoot } from './selectorEngine';

export const CSSEngine: SelectorEngine = {
  name: 'css',

  create(root: SelectorRoot, targetElement: Element): string | undefined {
    const tokens: string[] = [];

    function uniqueCSSSelector(prefix?: string): string | undefined {
      const path = tokens.slice();
      if (prefix)
        path.unshift(prefix);
      const selector = path.join(' > ');
      const nodes = Array.from(root.querySelectorAll(selector));
      return nodes[0] === targetElement ? selector : undefined;
    }

    for (let element: Element | null = targetElement; element && element !== root; element = element.parentElement) {
      const nodeName = element.nodeName.toLowerCase();

      // Element ID is the strongest signal, use it.
      let bestTokenForLevel: string = '';
      if (element.id) {
        const token = /^[a-zA-Z][a-zA-Z0-9\-\_]+$/.test(element.id) ? '#' + element.id : `[id="${element.id}"]`;
        const selector = uniqueCSSSelector(token);
        if (selector)
          return selector;
        bestTokenForLevel = token;
      }

      const parent = element.parentElement;

      // Combine class names until unique.
      const classes = Array.from(element.classList);
      for (let i = 0; i < classes.length; ++i) {
        const token = '.' + classes.slice(0, i + 1).join('.');
        const selector = uniqueCSSSelector(token);
        if (selector)
          return selector;
        // Even if not unique, does this subset of classes uniquely identify node as a child?
        if (!bestTokenForLevel && parent) {
          const sameClassSiblings = parent.querySelectorAll(token);
          if (sameClassSiblings.length === 1)
            bestTokenForLevel = token;
        }
      }

      // Ordinal is the weakest signal.
      if (parent) {
        const siblings = Array.from(parent.children);
        const sameTagSiblings = siblings.filter(sibling => (sibling as Element).nodeName.toLowerCase() === nodeName);
        const token = sameTagSiblings.length === 1 ? nodeName : `${nodeName}:nth-child(${1 + siblings.indexOf(element)})`;
        const selector = uniqueCSSSelector(token);
        if (selector)
          return selector;
        if (!bestTokenForLevel)
          bestTokenForLevel = token;
      } else if (!bestTokenForLevel) {
        bestTokenForLevel = nodeName;
      }
      tokens.unshift(bestTokenForLevel);
    }
    return uniqueCSSSelector();
  },

  query(root: SelectorRoot, selector: string): Element | undefined {
    return root.querySelector(selector) || undefined;
  },

  queryAll(root: SelectorRoot, selector: string): Element[] {
    return Array.from(root.querySelectorAll(selector));
  }
};
