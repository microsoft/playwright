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
import { Dialog } from './shared/dialog';
import { ToolbarButton } from '@web/components/toolbarButton';
import { DefaultSettingsView } from './defaultSettingsView';
import './settingsToolbar.css';

export const SettingsToolbarButton: React.FC<{}> = () => {
  const hostingRef = React.useRef<HTMLButtonElement>(null);

  const [open, setOpen] = React.useState(false);

  return (
    <>
      <ToolbarButton
        ref={hostingRef}
        icon='settings-gear'
        title='Settings'
        onClick={() => setOpen(current => !current)}
      />
      <Dialog
        className='settings-toolbar-dialog'
        open={open}
        width={200}
        requestClose={() => setOpen(false)}
        hostingElement={hostingRef}
      >
        <DefaultSettingsView />
      </Dialog>
    </>
  );
};
