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

import type { ActionTraceEvent, AfterActionTraceEventAttachment } from '@trace/trace';
import { clsx, msToString } from '@web/uiUtils';
import * as React from 'react';
import './actionList.css';
import * as modelUtil from './modelUtil';
import { asLocator, type Language } from '@isomorphic/locatorGenerators';
import type { TreeState } from '@web/components/treeView';
import { TreeView } from '@web/components/treeView';
import type { ActionTraceEventInContext, ActionTreeItem } from './modelUtil';
import type { Boundaries } from './geometry';
import { ToolbarButton } from '@web/components/toolbarButton';

export interface ActionListProps {
  actions: ActionTraceEventInContext[],
  selectedAction: ActionTraceEventInContext | undefined,
  selectedTime: Boundaries | undefined,
  setSelectedTime: (time: Boundaries | undefined) => void,
  sdkLanguage: Language | undefined;
  onSelected?: (action: ActionTraceEventInContext) => void,
  onHighlighted?: (action: ActionTraceEventInContext | undefined) => void,
  revealConsole?: () => void,
  revealAttachment(attachment: AfterActionTraceEventAttachment): void,
  isLive?: boolean,
}

const ActionTreeView = TreeView<ActionTreeItem>;

export const ActionList: React.FC<ActionListProps> = ({
  actions,
  selectedAction,
  selectedTime,
  setSelectedTime,
  sdkLanguage,
  onSelected,
  onHighlighted,
  revealConsole,
  revealAttachment,
  isLive,
}) => {
  const [treeState, setTreeState] = React.useState<TreeState>({ expandedItems: new Map() });
  const { rootItem, itemMap } = React.useMemo(() => modelUtil.buildActionTree(actions), [actions]);

  const { selectedItem } = React.useMemo(() => {
    const selectedItem = selectedAction ? itemMap.get(selectedAction.callId) : undefined;
    return { selectedItem };
  }, [itemMap, selectedAction]);

  const isError = React.useCallback((item: ActionTreeItem) => {
    return !!item.action?.error?.message;
  }, []);

  const onAccepted = React.useCallback((item: ActionTreeItem) => {
    return setSelectedTime({ minimum: item.action!.startTime, maximum: item.action!.endTime });
  }, [setSelectedTime]);

  const render = React.useCallback((item: ActionTreeItem) => {
    return renderAction(item.action!, { sdkLanguage, revealConsole, revealAttachment, isLive, showDuration: true, showBadges: true });
  }, [isLive, revealConsole, revealAttachment, sdkLanguage]);

  const isVisible = React.useCallback((item: ActionTreeItem) => {
    return !selectedTime || !item.action || (item.action!.startTime <= selectedTime.maximum && item.action!.endTime >= selectedTime.minimum);
  }, [selectedTime]);

  const onSelectedAction = React.useCallback((item: ActionTreeItem) => {
    onSelected?.(item.action!);
  }, [onSelected]);

  const onHighlightedAction = React.useCallback((item: ActionTreeItem | undefined) => {
    onHighlighted?.(item?.action);
  }, [onHighlighted]);

  return <div className='vbox'>
    {selectedTime && <div className='action-list-show-all' onClick={() => setSelectedTime(undefined)}><span className='codicon codicon-triangle-left'></span>Show all</div>}
    <ActionTreeView
      name='actions'
      rootItem={rootItem}
      treeState={treeState}
      setTreeState={setTreeState}
      selectedItem={selectedItem}
      onSelected={onSelectedAction}
      onHighlighted={onHighlightedAction}
      onAccepted={onAccepted}
      isError={isError}
      isVisible={isVisible}
      render={render}
    />
  </div>;
};

export const renderAction = (
  action: ActionTraceEvent,
  options: {
    sdkLanguage?: Language,
    revealConsole?: () => void,
    revealAttachment?(attachment: AfterActionTraceEventAttachment): void,
    isLive?: boolean,
    showDuration?: boolean,
    showBadges?: boolean,
  }) => {
  const { sdkLanguage, revealConsole, revealAttachment, isLive, showDuration, showBadges } = options;
  const { errors, warnings } = modelUtil.stats(action);
  const showAttachments = !!action.attachments?.length && !!revealAttachment;

  const parameterString = actionParameterDisplayString(action, sdkLanguage || 'javascript');

  let time: string = '';
  if (action.endTime)
    time = msToString(action.endTime - action.startTime);
  else if (action.error)
    time = 'Timed out';
  else if (!isLive)
    time = '-';
  return <>
    <div className='action-title' title={action.apiName}>
      <span>{action.apiName}</span>
      {parameterString && <div
        className={clsx(
            'action-parameter',
            parameterString.type === 'locator'
              ? 'action-locator-parameter'
              : 'action-generic-parameter',
        )}
      >
        {parameterString.value}
      </div>}
      {action.method === 'goto' && action.params.url && <div className='action-url' title={action.params.url}>{action.params.url}</div>}
      {action.class === 'APIRequestContext' && action.params.url && <div className='action-url' title={action.params.url}>{excludeOrigin(action.params.url)}</div>}
    </div>
    {(showDuration || showBadges || showAttachments) && <div className='spacer'></div>}
    {showAttachments && <ToolbarButton icon='attach' title='Open Attachment' onClick={() => revealAttachment(action.attachments![0])} />}
    {showDuration && <div className='action-duration'>{time || <span className='codicon codicon-loading'></span>}</div>}
    {showBadges && <div className='action-icons' onClick={() => revealConsole?.()}>
      {!!errors && <div className='action-icon'><span className='codicon codicon-error'></span><span className='action-icon-value'>{errors}</span></div>}
      {!!warnings && <div className='action-icon'><span className='codicon codicon-warning'></span><span className='action-icon-value'>{warnings}</span></div>}
    </div>}
  </>;
};

function excludeOrigin(url: string): string {
  try {
    const urlObject = new URL(url);
    return urlObject.pathname + urlObject.search;
  } catch (error) {
    return url;
  }
}

interface ActionParameterDisplayString {
  type: 'generic' | 'locator';
  value: string;
}

const actionParameterDisplayString = (
  action: ActionTraceEvent,
  sdkLanguage: Language,
): ActionParameterDisplayString | undefined => {
  const params = action.params;

  let value: string | undefined = undefined;

  if (params.selector !== undefined) {
    return { type: 'locator', value: asLocator(sdkLanguage, params.selector) };
  } else if (params.ticksNumber !== undefined) {
    // clock.fastForward/runFor number
    value = `${params.ticksNumber}ms`;
  } else if (params.ticksString !== undefined) {
    // clock.fastForward/runFor string
    value = params.ticksString;
  } else if (
    params.timeString !== undefined ||
    params.timeNumber !== undefined
  ) {
    // clock.pauseAt/setFixedTime/setSystemTime
    try {
      value = new Date(params.timeString ?? params.timeNumber).toLocaleString(
          undefined,
          {
            timeZone: 'UTC',
          },
      );
    } catch (e) {
      return undefined;
    }
  } else if (params.key !== undefined) {
    // keyboard.press/down/up
    value = params.key;
  } else if (params.text !== undefined) {
    // keyboard.type/insertText
    value = `"${params.text}"`;
  } else if (params.x !== undefined && params.y !== undefined) {
    // mouse.click/dblclick/move
    value = `(${params.x}, ${params.y})`;
  } else if (params.deltaX !== undefined && params.deltaY !== undefined) {
    // mouse.wheel
    value = `(${params.deltaX}, ${params.deltaY})`;
  } else if (params.x && params.y) {
    // touchscreen.tap
    value = `(${params.x}, ${params.y})`;
  }

  if (value === undefined)
    return undefined;

  return {
    type: 'generic',
    value,
  };
};
