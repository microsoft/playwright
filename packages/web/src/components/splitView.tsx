/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the 'License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { clsx, useMeasure, useSetting } from '../uiUtils';
import './splitView.css';
import * as React from 'react';

export type SplitViewProps = {
  sidebarSize: number;
  sidebarHidden?: boolean;
  sidebarIsFirst?: boolean;
  orientation?: 'vertical' | 'horizontal';
  minSidebarSize?: number;
  settingName?: string;

  sidebar: React.ReactNode;
  main: React.ReactNode;
};

const kMinSize = 50;

export const SplitView: React.FC<SplitViewProps> = ({
  sidebarSize,
  sidebarHidden = false,
  sidebarIsFirst = false,
  orientation = 'vertical',
  minSidebarSize = kMinSize,
  settingName,
  sidebar,
  main,
}) => {
  const defaultSize = Math.max(minSidebarSize, sidebarSize) * window.devicePixelRatio;
  const [hSize, setHSize] = useSetting<number>(settingName ? settingName + '.' + orientation + ':size' : undefined, defaultSize);
  const [vSize, setVSize] = useSetting<number>(settingName ? settingName + '.' + orientation + ':size' : undefined, defaultSize);

  const [resizing, setResizing] = React.useState<{ offset: number, size: number } | null>(null);
  const [measure, ref] = useMeasure<HTMLDivElement>();

  let size: number;
  if (orientation === 'vertical') {
    size = vSize / window.devicePixelRatio;
    if (measure && measure.height < size)
      size = measure.height - 10;
  } else {
    size = hSize / window.devicePixelRatio;
    if (measure && measure.width < size)
      size = measure.width - 10;
  }

  document.body.style.userSelect = resizing ? 'none' : 'inherit';
  let resizerStyle: any = {};
  if (orientation === 'vertical') {
    if (sidebarIsFirst)
      resizerStyle = { top: resizing ? 0 : size - 4, bottom: resizing ? 0 : undefined, height: resizing ? 'initial' : 8 };
    else
      resizerStyle = { bottom: resizing ? 0 : size - 4, top: resizing ? 0 : undefined, height: resizing ? 'initial' : 8 };
  } else {
    if (sidebarIsFirst)
      resizerStyle = { left: resizing ? 0 : size - 4, right: resizing ? 0 : undefined, width: resizing ? 'initial' : 8 };
    else
      resizerStyle = { right: resizing ? 0 : size - 4, left: resizing ? 0 : undefined, width: resizing ? 'initial' : 8 };
  }

  return <div className={clsx('split-view', orientation, sidebarIsFirst && 'sidebar-first')} ref={ref}>
    <div className='split-view-main'>{main}</div>
    {!sidebarHidden && <div style={{ flexBasis: size }} className='split-view-sidebar'>{sidebar}</div>}
    {!sidebarHidden && <div
      style={resizerStyle}
      className='split-view-resizer'
      onMouseDown={event => setResizing({ offset: orientation === 'vertical' ? event.clientY : event.clientX, size })}
      onMouseUp={() => setResizing(null)}
      onMouseMove={event => {
        if (!event.buttons) {
          setResizing(null);
        } else if (resizing) {
          const offset = orientation === 'vertical' ? event.clientY : event.clientX;
          const delta = offset - resizing.offset;
          const newSize = sidebarIsFirst ? resizing.size + delta : resizing.size - delta;

          const splitView = (event.target as HTMLElement).parentElement!;
          const rect = splitView.getBoundingClientRect();
          const size = Math.min(Math.max(minSidebarSize, newSize), (orientation === 'vertical' ? rect.height : rect.width) - minSidebarSize);
          if (orientation === 'vertical')
            setVSize(size * window.devicePixelRatio);
          else
            setHSize(size * window.devicePixelRatio);
        }
      }}
    ></div>}
  </div>;
};
