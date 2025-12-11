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
import './attemptsSelector.css';

export interface Attempt {
  id: string;
  success: boolean;
  label?: string;
}

// Mock data for demonstration
const mockAttempts: Attempt[] = [
  { id: '0', success: false },
  { id: '1', success: false },
  { id: '2', success: false },
  { id: '3', success: false },
  { id: '4', success: false },
];

export const AttemptsSelector: React.FunctionComponent<{
  attempts?: Attempt[];
  selectedAttempt?: number;
  onAttemptChange?: (index: number) => void;
}> = ({ attempts = mockAttempts, selectedAttempt = 0, onAttemptChange }) => {
  return (
    <div className='attempts-selector'>
      <span className='attempts-selector__label'>Attempts</span>
      <div className='attempts-selector__buttons'>
        {attempts.map((attempt, index) => (
          <button
            key={attempt.id}
            type='button'
            className={`attempts-selector__button ${
              index === selectedAttempt ? 'attempts-selector__button--selected' : ''
            } ${attempt.success ? 'attempts-selector__button--success' : 'attempts-selector__button--fail'}`}
            onClick={() => onAttemptChange?.(index)}
          >
            Attempt {index} {attempt.success ? 'Success' : 'Fail'}
          </button>
        ))}
      </div>
    </div>
  );
};
