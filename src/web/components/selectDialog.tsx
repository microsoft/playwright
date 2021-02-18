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

import './selectDialog.css';
import * as React from 'react';
import { Toolbar } from './toolbar';

export interface SelectDialogProps {
  entries: string[]
}

export const SelectDialog: React.FC<SelectDialogProps> = ({
  entries
}) => {
  return <div className='select-dialog'>
    <Toolbar>
      <input placeholder='Find context'></input>
    </Toolbar>
    <div>
      { entries.map(s => <div>{s}</div>) }
    </div>
  </div>;
};
