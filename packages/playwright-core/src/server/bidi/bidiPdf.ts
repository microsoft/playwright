/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert } from '../../utils';

import type { BidiSession } from './bidiConnection';
import type * as channels from '@protocol/channels';

const PagePaperFormats: { [key: string]: { width: number, height: number }} = {
  letter: { width: 8.5, height: 11 },
  legal: { width: 8.5, height: 14 },
  tabloid: { width: 11, height: 17 },
  ledger: { width: 17, height: 11 },
  a0: { width: 33.1, height: 46.8 },
  a1: { width: 23.4, height: 33.1 },
  a2: { width: 16.54, height: 23.4 },
  a3: { width: 11.7, height: 16.54 },
  a4: { width: 8.27, height: 11.7 },
  a5: { width: 5.83, height: 8.27 },
  a6: { width: 4.13, height: 5.83 },
};

const unitToPixels: { [key: string]: number } = {
  'px': 1,
  'in': 96,
  'cm': 37.8,
  'mm': 3.78
};

function convertPrintParameterToInches(text: string | undefined): number | undefined {
  if (text === undefined)
    return undefined;
  let unit = text.substring(text.length - 2).toLowerCase();
  let valueText = '';
  if (unitToPixels.hasOwnProperty(unit)) {
    valueText = text.substring(0, text.length - 2);
  } else {
    // In case of unknown unit try to parse the whole parameter as number of pixels.
    // This is consistent with phantom's paperSize behavior.
    unit = 'px';
    valueText = text;
  }
  const value = Number(valueText);
  assert(!isNaN(value), 'Failed to parse parameter value: ' + text);
  const pixels = value * unitToPixels[unit];
  return pixels / 96;
}

export class BidiPDF {
  private _session: BidiSession;

  constructor(session: BidiSession) {
    this._session = session;
  }

  async generate(options: channels.PagePdfParams): Promise<Buffer> {
    const {
      scale = 1,
      printBackground = false,
      landscape = false,
      pageRanges = '',
      margin = {},
    } = options;

    let paperWidth = 8.5;
    let paperHeight = 11;
    if (options.format) {
      const format = PagePaperFormats[options.format.toLowerCase()];
      assert(format, 'Unknown paper format: ' + options.format);
      paperWidth = format.width;
      paperHeight = format.height;
    } else {
      paperWidth = convertPrintParameterToInches(options.width) || paperWidth;
      paperHeight = convertPrintParameterToInches(options.height) || paperHeight;
    }

    const { data } = await this._session.send('browsingContext.print', {
      context: this._session.sessionId,
      background: printBackground,
      margin: {
        bottom: convertPrintParameterToInches(margin.bottom) || 0,
        left: convertPrintParameterToInches(margin.left) || 0,
        right: convertPrintParameterToInches(margin.right) || 0,
        top: convertPrintParameterToInches(margin.top) || 0
      },
      orientation: landscape ? 'landscape' : 'portrait',
      page: {
        width: paperWidth,
        height: paperHeight
      },
      pageRanges: pageRanges ? pageRanges.split(',').map(r => r.trim()) : undefined,
      scale,
    });
    return Buffer.from(data, 'base64');
  }
}
