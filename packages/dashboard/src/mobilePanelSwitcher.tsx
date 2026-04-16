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
import './mobilePanelSwitcher.css';

export type PanelId = 'sessions' | 'viewport' | 'tools';

export const MobilePanelSwitcher: React.FC<{
  sessions: React.ReactNode;
  viewport: React.ReactNode;
  tools: React.ReactNode;
  activePanel: PanelId;
  setActivePanel: (panel: PanelId) => void;
}> = ({ sessions, viewport, tools, activePanel, setActivePanel }) => {
  return (
    <div className='mobile-panel-switcher'>
      <div className='mobile-panels'>
        <div className='mobile-panel' style={{ display: activePanel === 'sessions' ? 'flex' : 'none' }}>{sessions}</div>
        <div className='mobile-panel' style={{ display: activePanel === 'viewport' ? 'flex' : 'none' }}>{viewport}</div>
        <div className='mobile-panel' style={{ display: activePanel === 'tools' ? 'flex' : 'none' }}>{tools}</div>
      </div>
      <nav className='mobile-tab-bar' aria-label='Panel switcher'>
        <button
          className={'mobile-tab-bar-item' + (activePanel === 'sessions' ? ' active' : '')}
          onClick={() => setActivePanel('sessions')}
          aria-current={activePanel === 'sessions' ? 'page' : undefined}
        >
          Sessions
        </button>
        <button
          className={'mobile-tab-bar-item' + (activePanel === 'viewport' ? ' active' : '')}
          onClick={() => setActivePanel('viewport')}
          aria-current={activePanel === 'viewport' ? 'page' : undefined}
        >
          Viewport
        </button>
        <button
          className={'mobile-tab-bar-item' + (activePanel === 'tools' ? ' active' : '')}
          onClick={() => setActivePanel('tools')}
          aria-current={activePanel === 'tools' ? 'page' : undefined}
        >
          Tools
        </button>
      </nav>
    </div>
  );
};
