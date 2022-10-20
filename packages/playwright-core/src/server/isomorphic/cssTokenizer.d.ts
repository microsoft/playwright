/*
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

export class CSSTokenInterface {
  toSource(): string;
  value: string;
}

export function tokenize(selector: string): CSSTokenInterface[];

export class IdentToken extends CSSTokenInterface {}
export class FunctionToken extends CSSTokenInterface {}
export class AtKeywordToken extends CSSTokenInterface {}
export class HashToken extends CSSTokenInterface {}
export class StringToken extends CSSTokenInterface {}
export class BadStringToken extends CSSTokenInterface {}
export class URLToken extends CSSTokenInterface {}
export class BadURLToken extends CSSTokenInterface {}
export class DelimToken extends CSSTokenInterface {}
export class NumberToken extends CSSTokenInterface {}
export class PercentageToken extends CSSTokenInterface {}
export class DimensionToken extends CSSTokenInterface {}
export class IncludeMatchToken extends CSSTokenInterface {}
export class DashMatchToken extends CSSTokenInterface {}
export class PrefixMatchToken extends CSSTokenInterface {}
export class SuffixMatchToken extends CSSTokenInterface {}
export class SubstringMatchToken extends CSSTokenInterface {}
export class ColumnToken extends CSSTokenInterface {}
export class WhitespaceToken extends CSSTokenInterface {}
export class CDOToken extends CSSTokenInterface {}
export class CDCToken extends CSSTokenInterface {}
export class ColonToken extends CSSTokenInterface {}
export class SemicolonToken extends CSSTokenInterface {}
export class CommaToken extends CSSTokenInterface {}
export class OpenParenToken extends CSSTokenInterface {}
export class CloseParenToken extends CSSTokenInterface {}
export class OpenSquareToken extends CSSTokenInterface {}
export class CloseSquareToken extends CSSTokenInterface {}
export class OpenCurlyToken extends CSSTokenInterface {}
export class CloseCurlyToken extends CSSTokenInterface {}
export class EOFToken extends CSSTokenInterface {}
