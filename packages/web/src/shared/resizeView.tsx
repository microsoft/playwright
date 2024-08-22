/**
 * Copyright (c) Microsoft Corporation.
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

import React from 'react';
import { GlassPane } from './glassPane';
import { useMeasure } from '../uiUtils';

const fillStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export const ResizeView: React.FC<{
  orientation: 'horizontal' | 'vertical',
  offsets: number[],
  setOffsets: (offsets: number[]) => void,
  resizerColor: string,
  resizerWidth: number,
  minColumnWidth?: number,
}> = ({ orientation, offsets, setOffsets, resizerColor, resizerWidth, minColumnWidth }) => {
  const minGap = minColumnWidth || 0;
  const [resizing, setResizing] = React.useState<{ clientX: number, clientY: number, offset: number, index: number } | null>(null);
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const dividerStyle: React.CSSProperties = {
    position: 'absolute',
    right: orientation === 'horizontal' ? undefined : 0,
    bottom: orientation === 'horizontal' ? 0 : undefined,
    width: orientation === 'horizontal' ? 7 : undefined,
    height: orientation === 'horizontal' ? undefined : 7,
    borderTopWidth: orientation === 'horizontal' ? undefined : (7 - resizerWidth) / 2,
    borderRightWidth: orientation === 'horizontal' ? (7 - resizerWidth) / 2 : undefined,
    borderBottomWidth: orientation === 'horizontal' ? undefined : (7 - resizerWidth) / 2,
    borderLeftWidth: orientation === 'horizontal' ? (7 - resizerWidth) / 2 : undefined,
    borderColor: 'transparent',
    borderStyle: 'solid',
    cursor: orientation === 'horizontal' ? 'ew-resize' : 'ns-resize',
  };
  return <div
    style={{
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: -(7 - resizerWidth) / 2,
      zIndex: 100, // Above the content, but below the film strip hover.
      pointerEvents: 'none',
    }}
    ref={ref}>
    {!!resizing && <GlassPane
      cursor={orientation === 'horizontal' ? 'ew-resize' : 'ns-resize'}
      onPaneMouseUp={() => setResizing(null)}
      onPaneMouseMove={event => {
        if (!event.buttons) {
          setResizing(null);
        } else if (resizing) {
          const delta = orientation === 'horizontal' ? event.clientX - resizing.clientX : event.clientY - resizing.clientY;
          const newOffset = resizing.offset + delta;
          const previous = resizing.index > 0 ? offsets[resizing.index - 1] : 0;
          const next = orientation === 'horizontal' ? measure.width : measure.height;
          const constrainedDelta = Math.min(Math.max(previous + minGap, newOffset), next - minGap) - offsets[resizing.index];
          for (let i = resizing.index; i < offsets.length; ++i)
            offsets[i] = offsets[i] + constrainedDelta;
          setOffsets([...offsets]);
        }
      }}
    />}
    {offsets.map((offset, index) => {
      return <div
        key={index}
        style={{
          ...dividerStyle,
          top: orientation === 'horizontal' ? 0 : offset,
          left: orientation === 'horizontal' ? offset : 0,
          pointerEvents: 'initial',
        }}
        onMouseDown={event => setResizing({ clientX: event.clientX, clientY: event.clientY, offset, index })}>
        <div style={{
          ...fillStyle,
          background: resizerColor,
        }}></div>
      </div>;
    })}
  </div>;
};
