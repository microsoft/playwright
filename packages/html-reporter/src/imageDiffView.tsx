/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { TestAttachment } from './types';
import * as React from 'react';
import { AttachmentLink } from './links';
import type { TabbedPaneTab } from './tabbedPane';
import { TabbedPane } from './tabbedPane';
import './imageDiffView.css';
import './tabbedPane.css';

export type ImageDiff = {
  name: string,
  expected?: { attachment: TestAttachment, title: string },
  actual?: { attachment: TestAttachment },
  diff?: { attachment: TestAttachment },
};

export const ImageDiffView: React.FunctionComponent<{
 imageDiff: ImageDiff,
}> = ({ imageDiff: diff }) => {
  // Pre-select a tab called "diff", if any.
  const [selectedTab, setSelectedTab] = React.useState<string>('diff');
  const diffElement = React.useRef<HTMLDivElement>(null);
  const imageElement = React.useRef<HTMLImageElement>(null);
  const [sliderPosition, setSliderPosition] = React.useState<number>(0);
  const onImageLoaded = (side?: 'left' | 'right') => {
    if (diffElement.current)
      diffElement.current.style.minHeight = diffElement.current.offsetHeight + 'px';
    if (side && diffElement.current && imageElement.current) {
      const gap = Math.max(0, (diffElement.current.offsetWidth - imageElement.current.offsetWidth) / 2 - 20);
      if (side === 'left')
        setSliderPosition(gap);
      else if (side === 'right')
        setSliderPosition(diffElement.current.offsetWidth - gap);
    }
  };
  const tabs: TabbedPaneTab[] = [];
  if (diff.diff) {
    tabs.push({
      id: 'diff',
      title: 'Diff',
      render: () => <ImageWithSize src={diff.diff!.attachment.path!} onLoad={() => onImageLoaded()} />
    });
    tabs.push({
      id: 'actual',
      title: 'Actual',
      render: () => <ImageDiffSlider sliderPosition={sliderPosition} setSliderPosition={setSliderPosition}>
        <ImageWithSize src={diff.expected!.attachment.path!} onLoad={() => onImageLoaded('right')} imageRef={imageElement} style={{ boxShadow: 'none' }} />
        <ImageWithSize src={diff.actual!.attachment.path!} />
      </ImageDiffSlider>,
    });
    tabs.push({
      id: 'expected',
      title: diff.expected!.title,
      render: () => <ImageDiffSlider sliderPosition={sliderPosition} setSliderPosition={setSliderPosition}>
        <ImageWithSize src={diff.expected!.attachment.path!} onLoad={() => onImageLoaded('left')} imageRef={imageElement} />
        <ImageWithSize src={diff.actual!.attachment.path!} style={{ boxShadow: 'none' }} />
      </ImageDiffSlider>,
    });
  } else {
    tabs.push({
      id: 'actual',
      title: 'Actual',
      render: () => <ImageWithSize src={diff.actual!.attachment.path!} onLoad={() => onImageLoaded()} />
    });
    tabs.push({
      id: 'expected',
      title: diff.expected!.title,
      render: () => <ImageWithSize src={diff.expected!.attachment.path!} onLoad={() => onImageLoaded()} />
    });
  }
  return <div className='vbox image-diff-view' data-testid='test-result-image-mismatch' ref={diffElement}>
    <TabbedPane tabs={tabs} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
    {diff.diff && <AttachmentLink attachment={diff.diff.attachment}></AttachmentLink>}
    <AttachmentLink attachment={diff.actual!.attachment}></AttachmentLink>
    <AttachmentLink attachment={diff.expected!.attachment}></AttachmentLink>
  </div>;
};

export const ImageDiffSlider: React.FC<React.PropsWithChildren<{
  sliderPosition: number,
  setSliderPosition: (position: number) => void,
}>> = ({ children, sliderPosition, setSliderPosition }) => {
  const [resizing, setResizing] = React.useState<{ offset: number, size: number } | null>(null);
  const size = sliderPosition;

  const childrenArray = React.Children.toArray(children);
  document.body.style.userSelect = resizing ? 'none' : 'inherit';

  const gripStyle: React.CSSProperties = {
    ...absolute,
    zIndex: 100,
    cursor: 'ew-resize',
    left: resizing ? 0 : size - 4,
    right: resizing ? 0 : undefined,
    width: resizing ? 'initial' : 8,
  };

  return <>
    {childrenArray[0]}
    <div style={{ ...absolute }}>
      <div style={{
        ...absolute,
        display: 'flex',
        zIndex: 50,
        clip: `rect(0, ${size}px, auto, 0)`,
        backgroundColor: 'var(--color-canvas-default)',
      }}>
        {childrenArray[1]}
      </div>
      <div
        style={gripStyle}
        onMouseDown={event => setResizing({ offset: event.clientX, size })}
        onMouseUp={() => setResizing(null)}
        onMouseMove={event => {
          if (!event.buttons) {
            setResizing(null);
          } else if (resizing) {
            const offset = event.clientX;
            const delta = offset - resizing.offset;
            const newSize = resizing.size + delta;

            const splitView = (event.target as HTMLElement).parentElement!;
            const rect = splitView.getBoundingClientRect();
            const size = Math.min(Math.max(0, newSize), rect.width);
            setSliderPosition(size);
          }
        }}
      ></div>
      <div data-testid='test-result-image-mismatch-grip' style={{
        ...absolute,
        left: size - 1,
        width: 20,
        zIndex: 80,
        margin: '10px -10px',
        pointerEvents: 'none',
        display: 'flex',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 9,
          width: 2,
          backgroundColor: 'var(--color-diff-blob-expander-icon)',
        }}>
        </div>
        <svg style={{ fill: 'var(--color-diff-blob-expander-icon)' }} viewBox="0 0 27 20"><path d="M9.6 0L0 9.6l9.6 9.6z"></path><path d="M17 19.2l9.5-9.6L16.9 0z"></path></svg>
      </div>
    </div>
  </>;
};

const ImageWithSize: React.FunctionComponent<{
  src: string,
  onLoad?: () => void,
  imageRef?: React.RefObject<HTMLImageElement>,
  style?: React.CSSProperties,
}> = ({ src, onLoad, imageRef, style }) => {
  const newRef = React.useRef<HTMLImageElement>(null);
  const ref = imageRef ?? newRef;
  const [size, setSize] = React.useState<{ width: number, height: number } | null>(null);
  return <div className='image-wrapper'>
    <div>
      <span style={{ flex: '1 1 0', textAlign: 'end' }}>{ size ? size.width : ''}</span>
      <span style={{ flex: 'none', margin: '0 5px' }}>x</span>
      <span style={{ flex: '1 1 0', textAlign: 'start' }}>{ size ? size.height : ''}</span>
    </div>
    <img src={src} onLoad={() => {
      onLoad?.();
      if (ref.current)
        setSize({ width: ref.current.naturalWidth, height: ref.current.naturalHeight });
    }} ref={ref} style={style} />
  </div>;
};

const absolute: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
