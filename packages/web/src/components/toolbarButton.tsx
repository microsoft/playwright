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

import './toolbarButton.css';
import '../third_party/vscode/codicon.css';
import * as React from 'react';
import { clsx } from '../uiUtils';

export interface ToolbarButtonProps {
  title?: string,
  icon?: string,
  disabled?: boolean,
  toggled?: boolean,
  onClick?: (e: React.MouseEvent) => void,
  style?: React.CSSProperties,
  testId?: string,
  className?: string,
  ariaLabel?: string,
}

export const ToolbarButton = React.forwardRef<HTMLButtonElement, React.PropsWithChildren<ToolbarButtonProps>>(function ToolbarButton({
  children,
  title = '',
  icon,
  disabled = false,
  toggled = false,
  onClick = () => {},
  style,
  testId,
  className,
  ariaLabel,
}, ref) {
  return <button
    ref={ref}
    className={clsx(className, 'toolbar-button', icon, toggled && 'toggled')}
    onMouseDown={preventDefault}
    onClick={onClick}
    onDoubleClick={preventDefault}
    title={title}
    disabled={!!disabled}
    style={style}
    data-testid={testId}
    aria-label={ariaLabel || title}
  >
    {icon && <span className={`codicon codicon-${icon}`} style={children ? { marginRight: 5 } : {}}></span>}
    {children}
  </button>;
});

export const ToolbarSeparator: React.FC<{ style?: React.CSSProperties }> = ({
  style,
}) => {
  return <div className='toolbar-separator' style={style}></div>;
};

const preventDefault = (e: any) => {
  e.stopPropagation();
  e.preventDefault();
};
