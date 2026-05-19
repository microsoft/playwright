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
import { DownloadIcon } from './icons';
import { Annotations } from './annotations';
import { buildAnnotatedImage, saveAnnotationAsDownload } from './annotationImage';
import { ToolbarButton } from '@web/components/toolbarButton';

import type { Annotation, AnnotationsHandle } from './annotations';
import type { DashboardModel, AnnotateFrame } from './dashboardModel';

export type AnnotateSidebarProps = {
  model: DashboardModel;
  session: NonNullable<DashboardModel['state']['annotateSession']>;
  onSubmit: () => Promise<void> | void;
};

export const AnnotateSidebar: React.FC<AnnotateSidebarProps> = ({ model, session, onSubmit }) => {
  const [submitting, setSubmitting] = React.useState(false);
  const [hoveredAnnotationId, setHoveredAnnotationId] = React.useState<string | null>(null);

  return (
    <aside className='annotate-sidebar' aria-label='Annotation screenshots'>
      <div className='annotate-sidebar-header dashboard-shell-sidebar-header'>
        <h2 className='dashboard-shell-sidebar-title'>UI Review</h2>
      </div>
      <div className='annotate-sidebar-list'>
        {session.frames.map(frame => {
          const selected = frame.id === session.selectedFrameId;
          const comments = frame.annotations;
          return (
            <div
              key={frame.id}
              className={'annotate-sidebar-thumb' + (selected ? ' selected' : '')}
            >
              <button
                className='annotate-sidebar-thumb-button'
                onClick={() => model.selectAnnotateFrame(frame.id)}
                title={`${frame.sessionTitle || 'session'} · ${frame.title || 'tab'}\n${frame.url}`}
                aria-pressed={selected}
              >
                <span
                  className='annotate-sidebar-thumb-img-wrap'
                  style={{ aspectRatio: `${frame.viewportWidth} / ${frame.viewportHeight}` }}
                >
                  <img
                    className='annotate-sidebar-thumb-img'
                    alt=''
                    src={'data:image/png;base64,' + frame.data}
                  />
                  {frame.annotations.map(a => (
                    <span
                      key={a.id}
                      className={'annotate-sidebar-thumb-rect' + (a.id === hoveredAnnotationId ? ' hovered' : '')}
                      style={{
                        left: `${(a.x / frame.viewportWidth) * 100}%`,
                        top: `${(a.y / frame.viewportHeight) * 100}%`,
                        width: `${(a.width / frame.viewportWidth) * 100}%`,
                        height: `${(a.height / frame.viewportHeight) * 100}%`,
                        ['--annotation-color' as any]: a.color,
                      }}
                    />
                  ))}
                </span>
              </button>
              {comments.length > 0 && (
                <ul className='annotate-sidebar-comments'>
                  {comments.map(a => (
                    <li key={a.id}>
                      <button
                        className={'annotate-sidebar-comment' + (a.text ? '' : ' empty')}
                        style={{ '--annotation-color': a.color } as React.CSSProperties}
                        onClick={() => model.selectAnnotateFrame(frame.id, a.id)}
                        onMouseEnter={() => setHoveredAnnotationId(a.id)}
                        onMouseLeave={() => setHoveredAnnotationId(null)}
                        title='Edit comment'
                      >
                        {a.text || 'Empty comment'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <ToolbarButton
                className='annotate-sidebar-thumb-remove'
                icon='close'
                title='Remove screenshot'
                onClick={e => {
                  e.stopPropagation();
                  model.removeAnnotateFrame(frame.id);
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        className='annotate-sidebar-feedback-wrap'
        data-value={session.feedback}
      >
        <textarea
          className='annotate-sidebar-feedback'
          placeholder='Feedback…'
          value={session.feedback}
          onChange={e => model.updateFeedback(e.target.value)}
        />
      </div>
      <button
        className='annotate-sidebar-submit'
        disabled={submitting}
        onClick={async () => {
          setSubmitting(true);
          try {
            await onSubmit();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
    </aside>
  );
};

export type AnnotateOverlayProps = {
  model: DashboardModel;
  frame: AnnotateFrame;
  focusAnnotationId?: string | null;
};

export const AnnotateOverlay: React.FC<AnnotateOverlayProps> = ({ model, frame, focusAnnotationId }) => {
  const annotationsRef = React.useRef<AnnotationsHandle>(null);
  const displayRef = React.useRef<HTMLImageElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const onAnnotationsChange = React.useCallback((next: Annotation[]) => {
    model.updateFrameAnnotations(frame.id, next);
  }, [model, frame.id]);

  const onSave = React.useCallback(async () => {
    const img = displayRef.current;
    if (!img)
      return;
    const blob = await buildAnnotatedImage(img, frame.viewportWidth, frame.viewportHeight, frame.annotations);
    if (!blob)
      return;
    const safe = (frame.title || frame.url || 'screenshot').replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'screenshot';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await saveAnnotationAsDownload(blob, `annotations-${stamp}-${safe}.png`);
  }, [frame]);

  const onClear = React.useCallback(() => {
    model.updateFrameAnnotations(frame.id, []);
    annotationsRef.current?.clearSelection();
  }, [model, frame.id]);

  return (
    <div className='annotate-overlay' role='dialog' aria-label={`Annotate screenshot from ${frame.title || frame.url || 'page'}`}>
      <div className='annotate-overlay-window'>
        <div className='annotate-overlay-chrome'>
          <span className='annotate-overlay-titlebar'>
            <span className='annotate-overlay-title-text'>{frame.title || 'untitled'}</span>
            <span className='annotate-overlay-title-sep'>·</span>
            <span className='annotate-overlay-title-url'>{frame.url}</span>
          </span>
          <ToolbarButton
            title='Save screenshot'
            onClick={onSave}
          >
            <DownloadIcon />
          </ToolbarButton>
          <ToolbarButton
            title='Clear annotations'
            icon='circle-slash'
            disabled={frame.annotations.length === 0}
            onClick={onClear}
          />
          <ToolbarButton
            title='Done annotating'
            icon='check'
            onClick={() => model.deselectFrame()}
          />
        </div>
        <div ref={containerRef} className='annotate-overlay-canvas'>
          <img
            ref={displayRef}
            className='annotate-modal-image'
            alt='annotation'
            src={'data:image/png;base64,' + frame.data}
          />
          <Annotations
            ref={annotationsRef}
            active={true}
            displayRef={displayRef}
            screenRef={containerRef}
            viewportWidth={frame.viewportWidth}
            viewportHeight={frame.viewportHeight}
            annotations={frame.annotations}
            onAnnotationsChange={onAnnotationsChange}
            focusAnnotationId={focusAnnotationId}
          />
        </div>
      </div>
    </div>
  );
};
