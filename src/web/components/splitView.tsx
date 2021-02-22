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
  sidebarHidden?: boolean
}

const kMinSidebarSize = 50;

export const SplitView: React.FC<SplitViewProps> = ({
  sidebarSize,
  sidebarHidden,
  children
}) => {
  let [size, setSize] = React.useState<number>(Math.max(kMinSidebarSize, sidebarSize));
  const [resizing, setResizing] = React.useState<{ offsetY: number, size: number } | null>(null);

  const childrenArray = React.Children.toArray(children);
  document.body.style.userSelect = resizing ? 'none' : 'inherit';
  return <div className='split-view'>
    <div className='split-view-main'>{childrenArray[0]}</div>
    { !sidebarHidden && <div style={{flexBasis: size}} className='split-view-sidebar'>{childrenArray[1]}</div> }
    { !sidebarHidden && <div
      style={{bottom: resizing ? 0 : size - 4, top: resizing ? 0 : undefined, height: resizing ? 'initial' : 8 }}
      className='split-view-resizer'
      onMouseDown={event => setResizing({ offsetY: event.clientY, size })}
      onMouseUp={() => setResizing(null)}
      onMouseMove={event => {
        if (!event.buttons)
          setResizing(null);
        else if (resizing)
          setSize(Math.max(kMinSidebarSize, resizing.size - event.clientY + resizing.offsetY));
      }}
    ></div> }
  </div>;
};
