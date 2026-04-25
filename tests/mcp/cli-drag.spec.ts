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
 * WITHOUT WARRANTIES OR ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './cli-fixtures';

test('drag between elements', async ({ cli, server }) => {
  server.setContent('/', `
<!DOCTYPE html>
<html>
<body>
  <div id="source" draggable="true" aria-label="drag source" style="width:60px;height:40px;border:1px solid"></div>
  <div id="target" aria-label="drop target" style="width:120px;height:80px;border:1px solid;margin-top:20px"></div>
  <script>
    document.getElementById('source').addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', 'ok'));
    document.getElementById('target').addEventListener('dragover', e => e.preventDefault());
  </script>
</body>
</html>`, 'text/html');

  const { snapshot } = await cli('open', server.PREFIX);
  expect(snapshot).toBeTruthy();
  expect(snapshot).toContain('drag source');
  expect(snapshot).toContain('drop target');

  const refForAccessibleName = (name: string) => {
    const line = snapshot!.split('\n').find(l => l.includes(`"${name}"`) && l.includes('[ref='));
    return line?.match(/\[ref=(e\d+)\]/)?.[1];
  };
  const startRef = refForAccessibleName('drag source');
  const endRef = refForAccessibleName('drop target');
  expect(startRef, 'snapshot should list the source element with a ref').toBeTruthy();
  expect(endRef, 'snapshot should list the target element with a ref').toBeTruthy();

  const { output, error, exitCode } = await cli('drag', startRef!, endRef!);
  expect(exitCode).toBe(0);
  expect(error).not.toMatch(/invalid_type|Zod validation error/i);
  expect(output).toContain('dragTo');
});

test('drop files and data onto an element', async ({ cli, server }, testInfo) => {
  server.setContent('/', `
<!DOCTYPE html>
<html>
<body>
  <div id="zone" aria-label="dropzone" style="width:200px;height:100px;border:1px solid"></div>
  <script>
    window.__dropInfo = null;
    const zone = document.getElementById('zone');
    zone.addEventListener('dragenter', e => e.preventDefault());
    zone.addEventListener('dragover', e => e.preventDefault());
    zone.addEventListener('drop', async e => {
      e.preventDefault();
      const data = {};
      for (const t of e.dataTransfer.types) {
        if (t !== 'Files')
          data[t] = e.dataTransfer.getData(t);
      }
      window.__dropInfo = { fileCount: e.dataTransfer.files.length, data };
    });
  </script>
</body>
</html>`, 'text/html');

  const { snapshot } = await cli('open', server.PREFIX);
  const refLine = snapshot!.split('\n').find(l => l.includes('"dropzone"') && l.includes('[ref='));
  const ref = refLine?.match(/\[ref=(e\d+)\]/)?.[1];
  expect(ref, 'snapshot should list the dropzone element with a ref').toBeTruthy();

  const fs = await import('fs/promises');
  const filePath = testInfo.outputPath('drop.txt');
  await fs.writeFile(filePath, 'hi');

  {
    const { output, error, exitCode } = await cli('drop', ref!, `--path=${filePath}`);
    expect(error).not.toMatch(/invalid_type|Zod validation error/i);
    expect(exitCode).toBe(0);
    expect(output).toContain('drop');
  }

  {
    const { output, error, exitCode } = await cli('drop', ref!, '--data=text/plain=hello world');
    expect(error).not.toMatch(/invalid_type|Zod validation error/i);
    expect(exitCode).toBe(0);
    expect(output).toContain('drop');
  }
});
