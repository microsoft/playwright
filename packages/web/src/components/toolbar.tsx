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

import { clsx } from '@web/uiUtils';
import './toolbar.css';
import * as React from 'react';

type ToolbarProps = {
  noShadow?: boolean;
  noMinHeight?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
};

export const Toolbar: React.FC<React.PropsWithChildren<ToolbarProps>> = ({
  noShadow,
  children,
  noMinHeight,
  className,
  onClick,
}) => {
  return <div className={clsx('toolbar', noShadow && 'no-shadow', noMinHeight && 'no-min-height', className)} onClick={onClick}>{children}</div>;
};
