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
import { asLocatorDescription, type Language } from '@isomorphic/locatorGenerators';
import type { TreeState } from '@web/components/treeView';
import { TreeView } from '@web/components/treeView';
import type { ActionTraceEventInContext, ActionTreeItem } from './modelUtil';
import type { Boundaries } from './geometry';
import { ToolbarButton } from '@web/components/toolbarButton';
import { testStatusIcon } from './testUtils';
import { methodMetainfo } from '@isomorphic/protocolMetainfo';
import { formatProtocolParam } from '@isomorphic/protocolFormatter';

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

  const locator = action.params.selector ? asLocatorDescription(sdkLanguage || 'javascript', action.params.selector) : undefined;

  const isSkipped = action.class === 'Test' && action.method === 'step' && action.annotations?.some(a => a.type === 'skip');
  let time: string = '';
  if (action.endTime)
    time = msToString(action.endTime - action.startTime);
  else if (action.error)
    time = 'Timed out';
  else if (!isLive)
    time = '-';
  const { elements, title } = renderTitleForCall(action);
  return <div className='action-title vbox'>
    <div className='hbox'>
      <span className='action-title-method' title={title}>{elements}</span>
      {(showDuration || showBadges || showAttachments || isSkipped) && <div className='spacer'></div>}
      {showAttachments && <ToolbarButton icon='attach' title='Open Attachment' onClick={() => revealAttachment(action.attachments![0])} />}
      {showDuration && !isSkipped && <div className='action-duration'>{time || <span className='codicon codicon-loading'></span>}</div>}
      {isSkipped && <span className={clsx('action-skipped', 'codicon', testStatusIcon('skipped'))} title='skipped'></span>}
      {showBadges && <div className='action-icons' onClick={() => revealConsole?.()}>
        {!!errors && <div className='action-icon'><span className='codicon codicon-error'></span><span className='action-icon-value'>{errors}</span></div>}
        {!!warnings && <div className='action-icon'><span className='codicon codicon-warning'></span><span className='action-icon-value'>{warnings}</span></div>}
      </div>}
    </div>
    {locator && <div className='action-title-selector' title={locator}>{locator}</div>}
  </div>;
};

export function renderTitleForCall(action: ActionTraceEvent): { elements: React.ReactNode[], title: string } {
  const titleFormat = action.title ?? methodMetainfo.get(action.class + '.' + action.method)?.title ?? action.method;

  const elements: React.ReactNode[] = [];
  const title: string[] = [];
  let currentIndex = 0;
  const regex = /\{([^}]+)\}/g;
  let match;

  while ((match = regex.exec(titleFormat)) !== null) {
    const [fullMatch, quotedText] = match;
    const chunk = titleFormat.slice(currentIndex, match.index);

    elements.push(chunk);
    title.push(chunk);

    const param = formatProtocolParam(action.params, quotedText);
    if (match.index === 0)
      elements.push(param);
    else
      elements.push(<span className='action-title-param'>{param}</span>);
    title.push(param);
    currentIndex = match.index + fullMatch.length;
  }

  if (currentIndex < titleFormat.length) {
    const chunk = titleFormat.slice(currentIndex);
    elements.push(chunk);
    title.push(chunk);
  }

  return { elements, title: title.join('') };
}
