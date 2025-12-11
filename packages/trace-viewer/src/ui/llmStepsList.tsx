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
import './llmStepsList.css';

export interface LLMStep {
  id: string;
  description: string;
  status: 'success' | 'failure' | 'pending';
  playwrightActions?: PlaywrightAction[];
}

export interface PlaywrightAction {
  id: string;
  title: string;
  duration: string;
  selector?: string;
}

// Mock data for demonstration
const mockSteps: LLMStep[] = [
  {
    id: '1',
    description: "click('581') # click on the search bar",
    status: 'success',
    playwrightActions: [
      { id: 'pw1', title: 'Click', duration: '28ms', selector: "locator('.search-input')" },
    ],
  },
  {
    id: '2',
    description: "fill('581', 'Users')",
    status: 'pending',
    playwrightActions: [
      { id: 'pw2', title: 'Fill', duration: '15ms', selector: "locator('.search-input')" },
      { id: 'pw3', title: 'Wait for function', duration: '1ms' },
    ],
  },
  {
    id: '3',
    description: "press('581', 'Enter')",
    status: 'pending',
    playwrightActions: [
      { id: 'pw4', title: 'Press', duration: '5ms', selector: "key: Enter" },
    ],
  },
  {
    id: '4',
    description: "click('547') # click on the 'All' button",
    status: 'pending',
    playwrightActions: [
      { id: 'pw5', title: 'Click', duration: '32ms', selector: "getByRole('button', { name: 'All' })" },
    ],
  },
  {
    id: '5',
    description: "fill('2832', 'Users')",
    status: 'pending',
    playwrightActions: [],
  },
  {
    id: '6',
    description: "click('3225') # click on Users link under Organization",
    status: 'failure',
    playwrightActions: [
      { id: 'pw6', title: 'Click', duration: '64ms', selector: "getByRole('link', { name: 'Users' })" },
      { id: 'pw7', title: 'Expect "toHaveCount"', duration: '104ms', selector: "getByTestId('user-item')" },
    ],
  },
  {
    id: '7',
    description: "click('a141') # click on the New button",
    status: 'pending',
    playwrightActions: [],
  },
  {
    id: '8',
    description: "fill('a177', '962010302056046828')",
    status: 'pending',
    playwrightActions: [],
  },
  {
    id: '9',
    description: '[{"action_name":"fill","args":{"bid":"a197","value":"Murray-...',
    status: 'pending',
    playwrightActions: [],
  },
];

export const LLMStepsList: React.FunctionComponent<{
  steps?: LLMStep[];
  selectedStepId?: string | null;
  expandedStepId?: string | null;
  onStepSelect?: (stepId: string) => void;
  onStepExpand?: (stepId: string) => void;
}> = ({
  steps = mockSteps,
  selectedStepId = '6',
  expandedStepId = '6',
  onStepSelect,
  onStepExpand
}) => {
  return (
    <div className='llm-steps-list'>
      {steps.map((step, index) => {
        const isSelected = step.id === selectedStepId;
        const isExpanded = step.id === expandedStepId;
        const hasSubsteps = step.playwrightActions && step.playwrightActions.length > 0;

        return (
          <div key={step.id} className='llm-step'>
            <button
              type='button'
              className={`llm-step__header ${isSelected ? 'llm-step__header--selected' : ''} ${
                step.status === 'failure' ? 'llm-step__header--failure' : ''
              } ${step.status === 'success' ? 'llm-step__header--success' : ''}`}
              onClick={() => {
                onStepSelect?.(step.id);
                if (hasSubsteps) {
                  onStepExpand?.(step.id);
                }
              }}
            >
              <div className='llm-step__title'>
                <span className='llm-step__number'>Step {index + 1}</span>
                {step.status === 'success' && <span className='llm-step__icon llm-step__icon--success'>✓</span>}
                {step.status === 'failure' && <span className='llm-step__icon llm-step__icon--failure'>✗</span>}
              </div>
              <div className='llm-step__description'>{step.description}</div>
            </button>

            {isExpanded && hasSubsteps && (
              <div className='llm-step__substeps'>
                {step.playwrightActions!.map((action) => (
                  <div key={action.id} className='llm-substep'>
                    <span className='llm-substep__title'>{action.title}</span>
                    <span className='llm-substep__duration'>{action.duration}</span>
                    {action.selector && (
                      <span className='llm-substep__selector'>{action.selector}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
