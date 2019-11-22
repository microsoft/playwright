// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type SelectorType = 'default' | 'notext';
export type SelectorRoot = Element | ShadowRoot | Document;

export interface SelectorEngine {
  name: string;
  create(root: SelectorRoot, target: Element, type?: SelectorType): string | undefined;
  query(root: SelectorRoot, selector: string): Element | undefined;
  queryAll(root: SelectorRoot, selector: string): Element[];
}
