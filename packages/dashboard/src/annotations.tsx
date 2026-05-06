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
import './modal.css';
import './annotations.css';
import { clientToViewport, getImageLayout } from './imageLayout';

import type { ImageLayout } from './imageLayout';

export type Annotation = { id: string; x: number; y: number; width: number; height: number; text: string; color: string };

export { buildAnnotatedImage, saveAnnotationAsDownload } from './annotationImage';

// Palette is 6 rgb triples — matches the `--annotations-blue` pattern so they
// compose nicely via `rgb(var(--annotation-color))` / `rgb(var(...) / 0.12)`.
const ANNOTATION_COLORS = [
  { name: 'blue',   rgb: '54 116 209' },
  { name: 'red',    rgb: '229 62 62' },
  { name: 'green',  rgb: '56 161 105' },
  { name: 'orange', rgb: '221 107 32' },
  { name: 'purple', rgb: '128 90 213' },
  { name: 'pink',   rgb: '213 63 140' },
];
const DEFAULT_ANNOTATION_COLOR = ANNOTATION_COLORS[0].rgb;

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

export type AnnotationsHandle = {
  clearSelection(): void;
};

type AnnotationsProps = {
  active: boolean;
  displayRef: React.RefObject<HTMLImageElement | null>;
  screenRef: React.RefObject<HTMLDivElement | null>;
  viewportWidth: number;
  viewportHeight: number;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  focusAnnotationId?: string | null;
};

const ColorPicker: React.FC<{ color: string; onChange: (color: string) => void }> = ({ color, onChange }) => (
  <div className='annotations-color-picker' role='radiogroup' aria-label='Annotation color'>
    {ANNOTATION_COLORS.map(({ name, rgb }) => (
      <button
        key={name}
        type='button'
        role='radio'
        aria-checked={color === rgb}
        title={`Use ${name}`}
        className={'annotations-color-swatch' + (color === rgb ? ' selected' : '')}
        style={{ '--annotation-color': rgb } as React.CSSProperties}
        onClick={() => onChange(rgb)}
      />
    ))}
  </div>
);

export const Annotations = React.forwardRef<AnnotationsHandle, AnnotationsProps>(({ active, displayRef, screenRef, viewportWidth, viewportHeight, annotations, onAnnotationsChange, focusAnnotationId }, ref) => {
  const [draft, setDraft] = React.useState<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [selection, setSelection] = React.useState<Selection>(null);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const [activeColor, setActiveColor] = React.useState<string>(DEFAULT_ANNOTATION_COLOR);
  // Snapshot of the annotation taken when an *existing* annotation enters edit
  // mode. Its presence signals "editing" (Cancel/Done) vs "adding" (Discard/Add);
  // Cancel reverts to this snapshot.
  const [editSnapshot, setEditSnapshot] = React.useState<Annotation | null>(null);
  const [, setTick] = React.useState(0);
  const forceRender = React.useCallback(() => setTick(t => t + 1), []);
  const layerRef = React.useRef<HTMLDivElement>(null);
  // Refs kept in sync each render so effects can read current values without
  // listing them as dependencies (avoids spurious effect re-runs).
  const annotationsRef = React.useRef(annotations);
  const focusAnnotationIdRef = React.useRef(focusAnnotationId);
  React.useLayoutEffect(() => {
    annotationsRef.current = annotations;
    focusAnnotationIdRef.current = focusAnnotationId;
  });

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
    if (active) {
      const fid = focusAnnotationIdRef.current;
      if (fid) {
        const annotation = annotationsRef.current.find(a => a.id === fid);
        if (annotation) {
          setEditSnapshot({ ...annotation });
          setSelection({ id: fid, editing: true });
          return;
        }
      }
      layerRef.current?.focus();
    } else {
      setSelection(null);
    }
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
      onAnnotationsChange(annotationsRef.current.map(a => a.id === drag.id ? { ...a, ...applyDrag(drag.orig, drag.kind, dvx, dvy) } : a));
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, displayRef, viewportWidth, viewportHeight, onAnnotationsChange]);

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
    onAnnotationsChange([...annotations, { id, ...rect, text: '', color: activeColor }]);
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
    onAnnotationsChange(annotations.map(a => a.id === selectedId ? { ...a, x: a.x + dx, y: a.y + dy } : a));
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
      onAnnotationsChange(annotations.filter(a => a.id !== selectedId));
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

  // Snapshot is only meaningful while an annotation is actively being edited.
  React.useEffect(() => {
    if (!editingId)
      setEditSnapshot(null);
  }, [editingId]);

  React.useImperativeHandle(ref, () => ({
    clearSelection: () => {
      setDraft(null);
      setSelection(null);
    },
  }), []);

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
      className='annotations-layer'
      tabIndex={0}
      onMouseDown={onLayerMouseDown}
      onMouseMove={onLayerMouseMove}
      onMouseUp={onLayerMouseUp}
      onKeyDown={onLayerKeyDown}
      onContextMenu={e => e.preventDefault()}
    >
      {annotations.map(a => {
        const style = mapRect(a);
        if (!style)
          return null;
        const isSelected = a.id === selectedId;
        const isEditing = a.id === editingId;
        return (
          <div
            key={a.id}
            className={'annotations-rect' + (isSelected ? ' selected' : '') + (isEditing ? ' editing' : '') + (a.text ? '' : ' empty')}
            style={{ ...style, '--annotation-color': a.color } as React.CSSProperties}
            onDoubleClick={e => {
              e.preventDefault();
              e.stopPropagation();
              if (editingId !== a.id)
                setEditSnapshot({ ...a });
              setSelection({ id: a.id, editing: true });
            }}
          >
            {a.text && (
              <div
                className='annotations-label'
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (editingId !== a.id)
                    setEditSnapshot({ ...a });
                  setSelection({ id: a.id, editing: true });
                }}
              >
                {a.text}
              </div>
            )}
            {isSelected && !isEditing && HANDLES.map(h => (
              <div
                key={h}
                className={'annotations-handle annotations-handle-' + h}
                onMouseDown={e => startResize(h, a, e)}
              />
            ))}
          </div>
        );
      })}

      {draft && (() => {
        const style = mapRect(normalizeRect(draft));
        return style ? <div className='annotations-rect draft' style={{ ...style, '--annotation-color': activeColor } as React.CSSProperties} /> : null;
      })()}

      {editingAnnotation && (() => {
        const style = mapRect(editingAnnotation);
        if (!style)
          return null;
        const popoverStyle = {
          'left': style.left as number,
          'top': (style.top as number) + (style.height as number) + 6,
          '--annotation-color': editingAnnotation.color,
        } as React.CSSProperties;
        return (
          <div
            className='annotations-popover'
            style={popoverStyle}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <textarea
              className='annotations-textarea'
              autoFocus
              onFocus={e => { const len = e.target.value.length; e.target.setSelectionRange(len, len); }}
              value={editingAnnotation.text}
              placeholder='Task or comment…'
              onChange={e => {
                const text = e.target.value;
                onAnnotationsChange(annotations.map(a => a.id === editingAnnotation.id ? { ...a, text } : a));
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
            <div className='annotations-popover-footer'>
              <ColorPicker
                color={editingAnnotation.color}
                onChange={color => {
                  onAnnotationsChange(annotations.map(a => a.id === editingAnnotation.id ? { ...a, color } : a));
                  setActiveColor(color);
                }}
              />
              <div className='annotations-popover-actions'>
                {editSnapshot ? (
                  <>
                    <button
                      className='annotations-action-btn'
                      onClick={() => {
                        const snap = editSnapshot;
                        onAnnotationsChange(annotations.map(a => a.id === snap.id ? snap : a));
                        setSelection(null);
                        layerRef.current?.focus();
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className='annotations-action-btn'
                      onClick={closeEditor}
                    >
                      Done
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className='annotations-action-btn danger'
                      onClick={() => {
                        onAnnotationsChange(annotations.filter(a => a.id !== editingAnnotation.id));
                        setSelection(null);
                        layerRef.current?.focus();
                      }}
                    >
                      Discard
                    </button>
                    <button
                      className='annotations-action-btn'
                      onClick={closeEditor}
                    >
                      Add
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
});
Annotations.displayName = 'Annotations';
