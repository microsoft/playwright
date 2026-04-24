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
import './modal.css';
import './recording.css';
import { DownloadIcon } from './icons';
import { ToolbarButton } from '@web/components/toolbarButton';

type RecordingProps = {
  blob: Blob;
  blobUrl: string;
  onSave: (blob: Blob) => Promise<void>;
  onClose: () => void;
};

export const Recording: React.FC<RecordingProps> = ({ blob, blobUrl, onSave, onClose }) => {
  const handleSave = React.useCallback(async () => {
    await onSave(blob);
  }, [onSave, blob]);

  return (
    <div className='modal-overlay' role='dialog' aria-modal='true' aria-label='Recording preview'>
      <div className='modal'>
        <div className='modal-toolbar'>
          <div className='modal-title'>Recording</div>
          <ToolbarButton
            title='Save recording'
            onClick={handleSave}
          >
            <DownloadIcon />
          </ToolbarButton>
          <ToolbarButton
            title='Discard'
            icon='close'
            onClick={onClose}
          />
        </div>
        <div className='modal-body recording-body'>
          <video
            className='recording-video'
            src={blobUrl}
            controls
            autoPlay
          />
        </div>
      </div>
    </div>
  );
};
