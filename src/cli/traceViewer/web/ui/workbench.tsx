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

import { ActionEntry, TraceModel } from '../../traceModel';
import { ActionList } from './actionList';
import { PropertiesTabbedPane } from './propertiesTabbedPane';
import { Timeline } from './timeline';
import './workbench.css';
import * as React from 'react';
import { ContextSelector } from './contextSelector';
import { GlobalStyles } from '../styles';

export const Workbench: React.FunctionComponent<{
  traceModel: TraceModel,
}> = ({ traceModel }) => {
  const [context, setContext] = React.useState(traceModel.contexts[0]);
  const [selectedAction, setSelectedAction] = React.useState<ActionEntry | undefined>();
  const [highlightedAction, setHighlightedAction] = React.useState<ActionEntry | undefined>();

  const actions = React.useMemo(() => {
    const actions: ActionEntry[] = [];
    for (const page of context.pages)
      actions.push(...page.actions);
    return actions;
  }, [context]);

  const snapshotSize = context.created.viewportSize || { width: 1280, height: 720 };

  return <div className='vbox workbench'>
    <GlobalStyles />
    <div className='hbox header'>
      <div className='logo'>🎭</div>
      <div className='product'>Playwright</div>
      <div className='spacer'></div>
      <ContextSelector
        contexts={traceModel.contexts}
        context={context}
        onChange={context => {
          setContext(context);
          setSelectedAction(undefined);
        }}
      />
    </div>
    <div style={{ background: 'white', paddingLeft: '20px', flex: 'none' }}>
      <Timeline
        context={context}
        boundaries={{ minimum: context.startTime, maximum: context.endTime }}
        selectedAction={selectedAction}
        highlightedAction={highlightedAction}
        onSelected={action => setSelectedAction(action)}
        onHighlighted={action => setHighlightedAction(action)}
      />
    </div>
    <div className='hbox'>
      <div style={{ display: 'flex', flex: 'none', overflow: 'auto' }}>
        <ActionList
          actions={actions}
          selectedAction={selectedAction}
          highlightedAction={highlightedAction}
          onSelected={action => setSelectedAction(action)}
          onHighlighted={action => setHighlightedAction(action)}
        />
      </div>
      <PropertiesTabbedPane actionEntry={selectedAction} snapshotSize={snapshotSize} />
    </div>
  </div>;
};
