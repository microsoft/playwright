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

export interface TabInfo {
  id: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

export const Button: React.FC<{ variant: 'primary' | 'default' | 'reject'; onClick: () => void; children: React.ReactNode }> = ({
  variant,
  onClick,
  children
}) => {
  return (
    <button className={`button ${variant}`} onClick={onClick}>
      {children}
    </button>
  );
};


export interface TabItemProps {
  tab: TabInfo;
  onClick?: () => void;
  button?: React.ReactNode;
}

export const TabItem: React.FC<TabItemProps> = ({
  tab,
  onClick,
  button
}) => {
  return (
    <div className='tab-item' onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <img
        src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23f6f8fa"/></svg>'}
        alt=''
        className='tab-favicon'
      />
      <div className='tab-content'>
        <div className='tab-title'>
          {tab.title || 'Untitled'}
        </div>
        <div className='tab-url'>{tab.url}</div>
      </div>
      {button}
    </div>
  );
};

export interface TabRadioItemProps {
  tab: TabInfo;
  name: string;
  checked: boolean;
  onSelect: () => void;
}

export const TabRadioItem: React.FC<TabRadioItemProps> = ({
  tab,
  name,
  checked,
  onSelect,
}) => {
  return (
    <label className={`tab-item tab-item-radio${checked ? ' selected' : ''}`}>
      <input
        type='radio'
        name={name}
        className='tab-radio'
        checked={checked}
        onChange={onSelect}
      />
      <img
        src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23f6f8fa"/></svg>'}
        alt=''
        className='tab-favicon'
      />
      <div className='tab-content'>
        <div className='tab-title'>
          {tab.title || 'Untitled'}
        </div>
        <div className='tab-url'>{tab.url}</div>
      </div>
    </label>
  );
};

export interface NewTabRadioItemProps {
  name: string;
  checked: boolean;
  onSelect: () => void;
}

export const NewTabRadioItem: React.FC<NewTabRadioItemProps> = ({
  name,
  checked,
  onSelect,
}) => {
  return (
    <label className={`tab-item tab-item-radio tab-item-new${checked ? ' selected' : ''}`}>
      <input
        type='radio'
        name={name}
        className='tab-radio'
        checked={checked}
        onChange={onSelect}
      />
      <div className='tab-favicon tab-favicon-plus' aria-hidden='true'>+</div>
      <div className='tab-content'>
        <div className='tab-title'>New tab</div>
        <div className='tab-url'>Open a fresh tab for the client</div>
      </div>
    </label>
  );
};
