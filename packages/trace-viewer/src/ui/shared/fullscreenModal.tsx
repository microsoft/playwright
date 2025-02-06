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
import './fullscreenModel.css';

export interface FullscreenModalProps {
  onClose?: () => void;
}

export const FullscreenModal: React.FC<
  React.PropsWithChildren<FullscreenModalProps>
> = ({ onClose, children }) => {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog ref={ref} className='fullscreen-modal'>
      <div className='fullscreen-modal-content'>{children}</div>
    </dialog>
  );
};
