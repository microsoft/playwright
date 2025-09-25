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

import * as React from 'react';
import { ToolbarButton } from './toolbarButton';
import { Dialog } from '../shared/dialog';

export interface DialogToolbarButtonProps {
  title?: string;
  icon?: string;
  dialogDataTestId?: string;
}

export const DialogToolbarButton: React.FC<React.PropsWithChildren<DialogToolbarButtonProps>> = ({ title, icon, dialogDataTestId, children }) => {
  const hostingRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <ToolbarButton
        ref={hostingRef}
        icon={icon}
        title={title}
        onClick={() => setOpen(current => !current)}
      />
      <Dialog
        style={{
          backgroundColor: 'var(--vscode-sideBar-background)',
          padding: '4px 8px'
        }}
        open={open}
        width={200}
        // TODO: Temporary spacing until design of toolbar buttons is revisited
        verticalOffset={8}
        requestClose={() => setOpen(false)}
        anchor={hostingRef}
        dataTestId={dialogDataTestId}
      >
        {children}
      </Dialog>
    </>
  );
};
