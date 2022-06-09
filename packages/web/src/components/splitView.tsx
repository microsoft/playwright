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

import './splitView.css';
import * as React from 'react';

export interface SplitViewProps {
  sidebarSize: number,
  sidebarHidden?: boolean,
  sidebarIsFirst?: boolean,
  orientation?: 'vertical' | 'horizontal',
  children: JSX.Element | JSX.Element[] | string,
}

const kMinSize = 50;

export const SplitView: React.FC<SplitViewProps> = ({
  sidebarSize,
  sidebarHidden = false,
  sidebarIsFirst = false,
  orientation = 'vertical',
  children
}) => {
  const [size, setSize] = React.useState<number>(Math.max(kMinSize, sidebarSize));
  const [resizing, setResizing] = React.useState<{ offset: number, size: number } | null>(null);

  const childrenArray = React.Children.toArray(children);
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

  return <div className={'split-view ' + orientation + (sidebarIsFirst ? ' sidebar-first' : '') }>
    <div className='split-view-main'>{childrenArray[0]}</div>
    { !sidebarHidden && <div style={{ flexBasis: size }} className='split-view-sidebar'>{childrenArray[1]}</div> }
    { !sidebarHidden && <div
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
          const size = Math.min(Math.max(kMinSize, newSize), (orientation === 'vertical' ? rect.height : rect.width) - kMinSize);
          setSize(size);
        }
      }}
    ></div> }
  </div>;
};
