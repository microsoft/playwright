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

import './source.css';
import * as React from 'react';
import highlightjs from '../../third_party/highlightjs/highlightjs';
import '../../third_party/highlightjs/highlightjs/tomorrow.css';

export interface SourceProps {
  text: string,
  targetLine: number
}

export const Source: React.FC<SourceProps> = ({
  text = '',
}) => {
  const result = [];
  let continuation: any;
  for (const line of text.split('\n')) {
    const highlighted = highlightjs.highlight('javascript', line, true, continuation);
    continuation = highlighted.top;
    result.push(highlighted.value);
  }

  return <div className='pw-source'>{
      result.map((markup, index) => {
        return <div key={index} className='pw-source-line'>
          <div className='pw-source-line-number'>{index + 1}</div>
          <div className='pw-source-code' dangerouslySetInnerHTML={{ __html: markup }}></div>
        </div>;
      })
    }</div>
};
