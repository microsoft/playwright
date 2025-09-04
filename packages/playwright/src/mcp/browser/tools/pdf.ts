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

import { z } from '../../sdk/bundle';
import { defineTabTool } from './tool';
import * as javascript from '../codegen';

const pdfSchema = z.object({
  filename: z.string().optional().describe('File name to save the pdf to. Defaults to `page-{timestamp}.pdf` if not specified.'),
});

const pdf = defineTabTool({
  capability: 'pdf',

  schema: {
    name: 'browser_pdf_save',
    title: 'Save as PDF',
    description: 'Save page as PDF',
    inputSchema: pdfSchema,
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const fileName = await tab.context.outputFile(params.filename ?? `page-${new Date().toISOString()}.pdf`);
    response.addCode(`await page.pdf(${javascript.formatObject({ path: fileName })});`);
    response.addResult(`Saved page as ${fileName}`);
    await tab.page.pdf({ path: fileName });
  },
});

export default [
  pdf,
];
