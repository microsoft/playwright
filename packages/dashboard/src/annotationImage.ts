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

export type RectAnnotation = { x: number; y: number; width: number; height: number; text: string; color: string };

export async function buildAnnotatedImage(
  img: HTMLImageElement,
  viewportWidth: number,
  viewportHeight: number,
  annotations: RectAnnotation[],
): Promise<Blob | null> {
  if (!img.naturalWidth || !img.naturalHeight || !viewportWidth || !viewportHeight)
    return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx)
    return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const sx = canvas.width / viewportWidth;
  const sy = canvas.height / viewportHeight;
  const fontSize = Math.max(11, Math.round(14 * sy));
  ctx.font = `500 ${fontSize}px -apple-system, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  for (const a of annotations) {
    const [r, g, b] = a.color.split(' ').map(Number);
    const solid = `rgb(${r}, ${g}, ${b})`;
    const wash = `rgba(${r}, ${g}, ${b}, 0.12)`;
    const x = a.x * sx;
    const y = a.y * sy;
    const w = a.width * sx;
    const h = a.height * sy;
    ctx.fillStyle = wash;
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = Math.max(2, Math.round(2 * sy));
    ctx.strokeStyle = solid;
    ctx.strokeRect(x, y, w, h);
    if (a.text) {
      const padX = Math.max(4, Math.round(6 * sy));
      const padY = Math.max(2, Math.round(3 * sy));
      const metrics = ctx.measureText(a.text);
      const labelW = metrics.width + padX * 2;
      const labelH = fontSize + padY * 2;
      const labelX = x - ctx.lineWidth / 2;
      const labelY = y - labelH;
      ctx.fillStyle = solid;
      ctx.fillRect(labelX, labelY, labelW, labelH);
      ctx.fillStyle = '#fff';
      ctx.fillText(a.text, labelX + padX, labelY + labelH / 2);
    }
  }
  return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
}

export async function saveAnnotationAsDownload(blob: Blob, suggestedName?: string): Promise<boolean> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = suggestedName ?? `annotations-${stamp}.png`;
  const ext = (name.match(/\.[^./\\]+$/)?.[0] ?? '.bin').toLowerCase();
  const mime = blob.type || ({
    '.png': 'image/png',
    '.zip': 'application/zip',
  } as Record<string, string>)[ext] || 'application/octet-stream';
  const description = ({
    '.png': 'PNG image',
    '.zip': 'Zip archive',
  } as Record<string, string>)[ext] || 'File';
  const picker = (window as any).showSaveFilePicker as undefined | ((opts: any) => Promise<any>);
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: name,
        startIn: 'downloads',
        types: [{ description, accept: { [mime]: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (e: any) {
      if (e?.name === 'AbortError')
        return false;
      throw e;
    }
    return true;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
