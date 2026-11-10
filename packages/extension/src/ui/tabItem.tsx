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
import * as icons from './icons';

export const Button: React.FC<{ variant: 'primary' | 'default'; onClick: () => void; children: React.ReactNode }> = ({
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

export const PageHeader: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <header className='page-header'>
      <img className='page-logo' src='icons/icon-48.png' alt='' />
      <h1 className='page-title'>Playwright Extension</h1>
      {children}
    </header>
  );
};

export interface ListItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  // The item has a check box when this is set.
  checked?: boolean;
  onClick?: () => void;
}

export const ListItem: React.FC<ListItemProps> = ({ icon, title, subtitle, checked, onClick }) => {
  const content = <>
    {icon}
    <div className='tab-content'>
      <div className='tab-title' title={title}>{title}</div>
      {subtitle && <div className='tab-url' title={subtitle}>{subtitle}</div>}
    </div>
  </>;
  if (checked === undefined)
    return <div className={'tab-item' + (onClick ? ' clickable' : '')} onClick={onClick}>{content}</div>;
  return (
    <label className={'tab-item clickable' + (checked ? ' selected' : '')}>
      <input type='checkbox' className='tab-checkbox' checked={checked} onChange={onClick} />
      {content}
    </label>
  );
};

export const TabItem: React.FC<{ tab: chrome.tabs.Tab, checked?: boolean, onClick?: () => void }> = ({ tab, checked, onClick }) => {
  const [iconFailed, setIconFailed] = React.useState(false);
  const icon = tab.favIconUrl && !iconFailed
    ? <img className='tab-favicon' src={tab.favIconUrl} alt='' onError={() => setIconFailed(true)} />
    : icons.page();
  return <ListItem icon={icon} title={tab.title || 'Untitled'} subtitle={tab.url} checked={checked} onClick={onClick} />;
};
