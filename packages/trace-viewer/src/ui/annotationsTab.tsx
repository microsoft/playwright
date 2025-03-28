/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import './annotationsTab.css';
import { PlaceholderPanel } from './placeholderPanel';
import { linkifyText } from '@web/renderUtils';
import type { TestAnnotation } from '@playwright/test';

export const AnnotationsTab: React.FunctionComponent<{
  annotations: TestAnnotation[],
}> = ({ annotations }) => {

  if (!annotations.length)
    return <PlaceholderPanel text='No annotations' />;

  return <div className='annotations-tab'>
    {annotations.map((annotation, i) => {
      return <div className='annotation-item' key={`annotation-${i}`}>
        <span style={{ fontWeight: 'bold' }}>{annotation.type}</span>
        {annotation.description && <span>: {linkifyText(annotation.description)}</span>}
      </div>;
    })}
  </div>;
};
