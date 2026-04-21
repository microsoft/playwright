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

import React from 'react';
import './annotations.css';

export type Annotation = { id: string; x: number; y: number; width: number; height: number; text: string };

type Rect = { x: number; y: number; width: number; height: number };
type DragKind = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Exclude<DragKind, 'move'>[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type DragState = {
  kind: DragKind;
  id: string;
  orig: Rect;
  startVx: number;
  startVy: number;
};

type Selection = { id: string; editing: boolean } | null;

const MIN_ANNOTATION_SIZE = 4;

function newAnnotationId() {
  return 'ann-' + Math.random().toString(36).slice(2, 10);
}

function normalizeRect(a: { startX: number; startY: number; x: number; y: number }): Rect {
  return {
    x: Math.min(a.startX, a.x),
    y: Math.min(a.startY, a.y),
    width: Math.abs(a.x - a.startX),
    height: Math.abs(a.y - a.startY),
  };
}

function applyDrag(orig: Rect, kind: DragKind, dvx: number, dvy: number): Rect {
  let left = orig.x;
  let top = orig.y;
  let right = orig.x + orig.width;
  let bottom = orig.y + orig.height;
  switch (kind) {
    case 'move':
      left += dvx; top += dvy; right += dvx; bottom += dvy; break;
    case 'nw': left += dvx; top += dvy; break;
    case 'n': top += dvy; break;
    case 'ne': right += dvx; top += dvy; break;
    case 'e': right += dvx; break;
    case 'se': right += dvx; bottom += dvy; break;
    case 's': bottom += dvy; break;
    case 'sw': left += dvx; bottom += dvy; break;
    case 'w': left += dvx; break;
  }
  return {
    x: Math.min(left, right),
    y: Math.min(top, bottom),
    width: Math.abs(right - left),
    height: Math.abs(bottom - top),
  };
}

export type ImageLayout = {
  rect: DOMRect;
  renderW: number;
  renderH: number;
  offsetX: number;
  offsetY: number;
};

export function getImageLayout(display: HTMLImageElement | null): ImageLayout | null {
  if (!display || !display.naturalWidth || !display.naturalHeight)
    return null;
  const rect = display.getBoundingClientRect();
  const imgAspect = display.naturalWidth / display.naturalHeight;
  const elemAspect = rect.width / rect.height;
  if (imgAspect > elemAspect) {
    const renderH = rect.width / imgAspect;
    return { rect, renderW: rect.width, renderH, offsetX: 0, offsetY: (rect.height - renderH) / 2 };
  }
  const renderW = rect.height * imgAspect;
  return { rect, renderW, renderH: rect.height, offsetX: (rect.width - renderW) / 2, offsetY: 0 };
}

export function clientToViewport(layout: ImageLayout, vw: number, vh: number, clientX: number, clientY: number): { x: number; y: number } {
  const fracX = (clientX - layout.rect.left - layout.offsetX) / layout.renderW;
  const fracY = (clientY - layout.rect.top - layout.offsetY) / layout.renderH;
  return { x: Math.round(fracX * vw), y: Math.round(fracY * vh) };
}

function viewportRectToScreenStyle(layout: ImageLayout, screenRect: DOMRect, vw: number, vh: number, r: Rect): React.CSSProperties {
  const baseLeft = layout.rect.left - screenRect.left + layout.offsetX;
  const baseTop = layout.rect.top - screenRect.top + layout.offsetY;
  return {
    left: baseLeft + (r.x / vw) * layout.renderW,
    top: baseTop + (r.y / vh) * layout.renderH,
    width: (r.width / vw) * layout.renderW,
    height: (r.height / vh) * layout.renderH,
  };
}

export const Annotations: React.FC<{
  active: boolean;
  displayRef: React.RefObject<HTMLImageElement | null>;
  screenRef: React.RefObject<HTMLDivElement | null>;
  viewportWidth: number;
  viewportHeight: number;
  onSubmit?: (blob: Blob, annotations: Annotation[]) => Promise<void> | void;
}> = ({ active, displayRef, screenRef, viewportWidth, viewportHeight, onSubmit }) => {
  const [annotations, setAnnotations] = React.useState<Annotation[]>([]);
  const [draft, setDraft] = React.useState<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [selection, setSelection] = React.useState<Selection>(null);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const [, setTick] = React.useState(0);
  const forceRender = React.useCallback(() => setTick(t => t + 1), []);
  const layerRef = React.useRef<HTMLDivElement>(null);

  const selectedId = selection?.id ?? null;
  const editingId = selection?.editing ? selection.id : null;

  React.useEffect(() => {
    if (!active)
      return;
    const onResize = () => forceRender();
    const img = displayRef.current;
    const onLoad = () => forceRender();
    window.addEventListener('resize', onResize);
    img?.addEventListener('load', onLoad);
    return () => {
      window.removeEventListener('resize', onResize);
      img?.removeEventListener('load', onLoad);
    };
  }, [active, displayRef, forceRender]);

  React.useEffect(() => {
    if (active)
      layerRef.current?.focus();
    else
      setSelection(null);
  }, [active]);

  React.useEffect(() => {
    if (!drag)
      return;
    const onMove = (e: MouseEvent) => {
      const layout = getImageLayout(displayRef.current);
      if (!layout || !viewportWidth || !viewportHeight)
        return;
      const vp = clientToViewport(layout, viewportWidth, viewportHeight, e.clientX, e.clientY);
      const dvx = vp.x - drag.startVx;
      const dvy = vp.y - drag.startVy;
      if (dvx === 0 && dvy === 0)
        return;
      setAnnotations(prev => prev.map(a => a.id === drag.id ? { ...a, ...applyDrag(drag.orig, drag.kind, dvx, dvy) } : a));
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, displayRef, viewportWidth, viewportHeight]);

  function imgCoords(e: React.MouseEvent): { x: number; y: number } | null {
    if (!viewportWidth || !viewportHeight)
      return null;
    const layout = getImageLayout(displayRef.current);
    if (!layout)
      return null;
    return clientToViewport(layout, viewportWidth, viewportHeight, e.clientX, e.clientY);
  }

  function hitTestAnnotation(x: number, y: number): Annotation | undefined {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i];
      if (x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height)
        return a;
    }
    return undefined;
  }

  function onLayerMouseDown(e: React.MouseEvent) {
    if (e.button !== 0)
      return;
    layerRef.current?.focus();
    const vp = imgCoords(e);
    if (!vp)
      return;
    const hit = hitTestAnnotation(vp.x, vp.y);
    e.preventDefault();
    if (hit) {
      setSelection({ id: hit.id, editing: false });
      setDrag({ kind: 'move', id: hit.id, orig: { x: hit.x, y: hit.y, width: hit.width, height: hit.height }, startVx: vp.x, startVy: vp.y });
      return;
    }
    setDraft({ startX: vp.x, startY: vp.y, x: vp.x, y: vp.y });
    setSelection(null);
  }

  function onLayerMouseMove(e: React.MouseEvent) {
    if (drag || !draft)
      return;
    const vp = imgCoords(e);
    if (!vp)
      return;
    if (draft.x === vp.x && draft.y === vp.y)
      return;
    setDraft({ ...draft, x: vp.x, y: vp.y });
  }

  function onLayerMouseUp(e: React.MouseEvent) {
    if (!draft)
      return;
    e.preventDefault();
    const rect = normalizeRect(draft);
    setDraft(null);
    if (rect.width < MIN_ANNOTATION_SIZE || rect.height < MIN_ANNOTATION_SIZE)
      return;
    const id = newAnnotationId();
    setAnnotations(prev => [...prev, { id, ...rect, text: '' }]);
    setSelection({ id, editing: true });
  }

  function startResize(kind: Exclude<DragKind, 'move'>, a: Annotation, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    layerRef.current?.focus();
    const vp = imgCoords(e);
    if (!vp)
      return;
    setSelection({ id: a.id, editing: false });
    setDrag({ kind, id: a.id, orig: { x: a.x, y: a.y, width: a.width, height: a.height }, startVx: vp.x, startVy: vp.y });
  }

  function nudgeSelected(dx: number, dy: number) {
    if (!selectedId)
      return;
    setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, x: a.x + dx, y: a.y + dy } : a));
  }

  function closeEditor() {
    setSelection(sel => sel?.editing ? { ...sel, editing: false } : sel);
    layerRef.current?.focus();
  }

  function onLayerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (draft)
        setDraft(null);
      else if (editingId)
        closeEditor();
      else if (selectedId)
        setSelection(null);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingId) {
      e.preventDefault();
      setAnnotations(prev => prev.filter(a => a.id !== selectedId));
      setSelection(null);
      return;
    }
    if (selectedId && !editingId) {
      const step = e.shiftKey ? 1 : 5;
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudgeSelected(-step, 0); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudgeSelected(step, 0); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); nudgeSelected(0, -step); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); nudgeSelected(0, step); return; }
    }
  }

  async function submitAnnotations() {
    const img = displayRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight || !viewportWidth || !viewportHeight)
      return;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx)
      return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const sx = canvas.width / viewportWidth;
    const sy = canvas.height / viewportHeight;
    const blue = 'rgb(54, 116, 209)';
    const fontSize = Math.max(11, Math.round(14 * sy));
    ctx.font = `500 ${fontSize}px -apple-system, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    for (const a of annotations) {
      const x = a.x * sx;
      const y = a.y * sy;
      const w = a.width * sx;
      const h = a.height * sy;
      ctx.fillStyle = 'rgba(54, 116, 209, 0.12)';
      ctx.fillRect(x, y, w, h);
      ctx.lineWidth = Math.max(2, Math.round(2 * sy));
      ctx.strokeStyle = blue;
      ctx.strokeRect(x, y, w, h);
      if (a.text) {
        const padX = Math.max(4, Math.round(6 * sy));
        const padY = Math.max(2, Math.round(3 * sy));
        const metrics = ctx.measureText(a.text);
        const labelW = metrics.width + padX * 2;
        const labelH = fontSize + padY * 2;
        const labelX = x - ctx.lineWidth / 2;
        const labelY = y - labelH;
        ctx.fillStyle = blue;
        ctx.fillRect(labelX, labelY, labelW, labelH);
        ctx.fillStyle = '#fff';
        ctx.fillText(a.text, labelX + padX, labelY + labelH / 2);
      }
    }
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob)
      return;
    if (onSubmit) {
      await onSubmit(blob, annotations);
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suggestedName = `annotations-${stamp}.png`;
    const picker = (window as any).showSaveFilePicker as undefined | ((opts: any) => Promise<any>);
    if (picker) {
      try {
        const handle = await picker({
          suggestedName,
          startIn: 'downloads',
          types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (e: any) {
        if (e?.name !== 'AbortError')
          throw e;
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (!active)
    return null;

  const layout = getImageLayout(displayRef.current);
  const screenRect = screenRef.current?.getBoundingClientRect() ?? null;
  const mapRect = (r: Rect): React.CSSProperties | null =>
    (layout && screenRect && viewportWidth && viewportHeight)
      ? viewportRectToScreenStyle(layout, screenRect, viewportWidth, viewportHeight, r)
      : null;

  const editingAnnotation = editingId ? annotations.find(a => a.id === editingId) : undefined;

  return (
    <div
      ref={layerRef}
      className='annotation-layer'
      tabIndex={0}
      onMouseDown={onLayerMouseDown}
      onMouseMove={onLayerMouseMove}
      onMouseUp={onLayerMouseUp}
      onKeyDown={onLayerKeyDown}
      onContextMenu={e => e.preventDefault()}
    >
      <div className='annotation-toolbar' onMouseDown={e => e.stopPropagation()}>
        <button
          className='annotate-action-btn'
          onClick={() => { setAnnotations([]); setDraft(null); setSelection(null); }}
          disabled={annotations.length === 0}
          title='Remove all annotations'
        >
          Clear
        </button>
        <button
          className='annotate-action-btn primary'
          onClick={submitAnnotations}
          disabled={annotations.length === 0}
          title='Submit annotation'
        >
          Submit
        </button>
      </div>

      {annotations.map(a => {
        const style = mapRect(a);
        if (!style)
          return null;
        const isSelected = a.id === selectedId;
        const isEditing = a.id === editingId;
        return (
          <div
            key={a.id}
            className={'annotation-rect' + (isSelected ? ' selected' : '') + (isEditing ? ' editing' : '') + (a.text ? '' : ' empty')}
            style={style}
            onDoubleClick={e => {
              e.preventDefault();
              e.stopPropagation();
              setSelection({ id: a.id, editing: true });
            }}
          >
            {a.text && (
              <div
                className='annotation-label'
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelection({ id: a.id, editing: true });
                }}
              >
                {a.text}
              </div>
            )}
            {isSelected && !isEditing && HANDLES.map(h => (
              <div
                key={h}
                className={'annotation-handle annotation-handle-' + h}
                onMouseDown={e => startResize(h, a, e)}
              />
            ))}
          </div>
        );
      })}

      {draft && (() => {
        const style = mapRect(normalizeRect(draft));
        return style ? <div className='annotation-rect draft' style={style} /> : null;
      })()}

      {editingAnnotation && (() => {
        const style = mapRect(editingAnnotation);
        if (!style)
          return null;
        const popoverStyle: React.CSSProperties = {
          left: style.left as number,
          top: (style.top as number) + (style.height as number) + 6,
        };
        return (
          <div
            className='annotation-popover'
            style={popoverStyle}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <textarea
              className='annotation-textarea'
              autoFocus
              value={editingAnnotation.text}
              placeholder='Task or comment…'
              onChange={e => {
                const text = e.target.value;
                setAnnotations(prev => prev.map(a => a.id === editingAnnotation.id ? { ...a, text } : a));
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  closeEditor();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closeEditor();
                }
                e.stopPropagation();
              }}
              onKeyUp={e => e.stopPropagation()}
            />
            <div className='annotation-popover-actions'>
              <button
                className='annotate-action-btn danger'
                onClick={() => {
                  setAnnotations(prev => prev.filter(a => a.id !== editingAnnotation.id));
                  setSelection(null);
                  layerRef.current?.focus();
                }}
              >
                Delete
              </button>
              <button
                className='annotate-action-btn'
                onClick={closeEditor}
              >
                Done
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
