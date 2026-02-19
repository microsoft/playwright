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

import type { ActionTraceEvent } from '@trace/trace';
import { clsx, msToString } from '@web/uiUtils';
import * as React from 'react';
import './actionList.css';
import { stats, buildActionTree } from '@isomorphic/trace/traceModel';
import { asLocatorDescription, type Language } from '@isomorphic/locatorGenerators';
import type { TreeState } from '@web/components/treeView';
import { TreeView } from '@web/components/treeView';
import type { ActionTraceEventInContext, ActionTreeItem } from '@isomorphic/trace/traceModel';
import type { Boundaries } from './geometry';
import { ToolbarButton } from '@web/components/toolbarButton';
import { testStatusIcon } from './testUtils';
import { methodMetainfo } from '@isomorphic/protocolMetainfo';
import { formatProtocolParam } from '@isomorphic/protocolFormatter';

function getTitleFormat(action: ActionTraceEvent): string {
  const metaTitle = methodMetainfo.get(`${action.class}.${action.method}`)?.title;
  const raw = action.title ?? metaTitle ?? action.method ?? '';
  return String(raw).replace(/\n/g, ' ');
}

function expandPlaceholders(format: string, params: Record<string, any>): string {
  return format.replace(/\{([^}]+)\}/g, (fullMatch, paramKey) => {
    const value = formatProtocolParam(params, paramKey);
    return value === undefined ? fullMatch : String(value);
  });
}

export function getActionSearchText(action: ActionTraceEvent): string {
  try {
    const titleFormat = getTitleFormat(action);
    return expandPlaceholders(titleFormat, action.params ?? {});
  } catch {
    return String(action.title ?? action.method ?? '');
  }
}

function computeVisibleCallIds(
  actionFilterText: string | undefined,
  itemMap: Map<string, ActionTreeItem>,
): Set<string> | null {
  const query = actionFilterText?.trim().toLowerCase();
  if (!query)
    return null;

  const matchingCallIds = new Set<string>();
  for (const item of itemMap.values()) {
    const callId = item.action.callId;
    if (!callId)
      continue;

    const searchText = getActionSearchText(item.action).toLowerCase();
    if (searchText.includes(query))
      matchingCallIds.add(callId);
  }

  const visibleCallIds = new Set<string>();

  const addAncestors = (item: ActionTreeItem | undefined) => {
    if (!item)
      return;

    const callId = item.action.callId;
    if (callId && visibleCallIds.has(callId))
      return;

    if (callId)
      visibleCallIds.add(callId);

    if (item.parent)
      addAncestors(item.parent);
  };

  for (const callId of matchingCallIds)
    addAncestors(itemMap.get(callId));

  for (const callId of matchingCallIds)
    visibleCallIds.add(callId);

  return visibleCallIds;
}

function expandTreeForCallIds(
  callIdsToExpand: Set<string>,
  itemMap: Map<string, ActionTreeItem>,
  previousState: TreeState,
): TreeState {
  const expandedItems = new Map(previousState.expandedItems);

  for (const callId of callIdsToExpand) {
    const item = itemMap.get(callId);
    if (!item)
      continue;

    for (let parent: ActionTreeItem | undefined = item.parent; parent && parent.action.callId; parent = parent.parent)
      expandedItems.set(parent.action.callId, true);
  }

  return { ...previousState, expandedItems };
}

export interface ActionListProps {
  actions: ActionTraceEventInContext[],
  selectedAction: ActionTraceEventInContext | undefined,
  selectedTime: Boundaries | undefined,
  setSelectedTime: (time: Boundaries | undefined) => void,
  treeState: TreeState,
  setTreeState: React.Dispatch<React.SetStateAction<TreeState>>,
  sdkLanguage: Language | undefined;
  onSelected?: (action: ActionTraceEventInContext) => void,
  onHighlighted?: (action: ActionTraceEventInContext | undefined) => void,
  revealConsole?: () => void,
  revealActionAttachment?(callId: string): void,
  isLive?: boolean,
  actionFilterText?: string,
}

const ActionTreeView = TreeView<ActionTreeItem>;

export const ActionList: React.FC<ActionListProps> = ({
  actions,
  selectedAction,
  selectedTime,
  setSelectedTime,
  treeState,
  setTreeState,
  sdkLanguage,
  onSelected,
  onHighlighted,
  revealConsole,
  revealActionAttachment,
  isLive,
  actionFilterText,
}) => {
  const { rootItem, itemMap } = React.useMemo(() => buildActionTree(actions), [actions]);

  const { selectedItem } = React.useMemo(() => {
    const selectedItem = selectedAction ? itemMap.get(selectedAction.callId) : undefined;
    return { selectedItem };
  }, [itemMap, selectedAction]);

  const visibleCallIds = React.useMemo(() => {
    return computeVisibleCallIds(actionFilterText, itemMap);
  }, [itemMap, actionFilterText]);

  const prevVisibleCallIdsRef = React.useRef<Set<string> | null>(null);
  React.useEffect(() => {
    if (visibleCallIds) {
      prevVisibleCallIdsRef.current = visibleCallIds;
      return;
    }

    const previousVisibleCallIds = prevVisibleCallIdsRef.current;
    if (!previousVisibleCallIds)
      return;

    prevVisibleCallIdsRef.current = null;
    setTreeState(previousState =>
      expandTreeForCallIds(previousVisibleCallIds, itemMap, previousState),
    );
  }, [visibleCallIds, itemMap, setTreeState]);

  const isError = React.useCallback((item: ActionTreeItem) => {
    return !!item.action.error?.message;
  }, []);

  const onAccepted = React.useCallback((item: ActionTreeItem) => {
    return setSelectedTime({ minimum: item.action.startTime, maximum: item.action.endTime });
  }, [setSelectedTime]);

  const render = React.useCallback((item: ActionTreeItem) => {
    const showAttachments = !!revealActionAttachment && !!item.action.attachments?.length;
    return renderAction(item.action, { sdkLanguage, revealConsole, revealActionAttachment: () => revealActionAttachment?.(item.action.callId), isLive, showDuration: true, showBadges: true, showAttachments });
  }, [isLive, revealConsole, revealActionAttachment, sdkLanguage]);

  const isVisible = React.useCallback((item: ActionTreeItem) => {
    const timeVisible = !selectedTime || !item.action || (item.action.startTime <= selectedTime.maximum && item.action.endTime >= selectedTime.minimum);
    if (!timeVisible)
      return false;
    if (!visibleCallIds || !item.action.callId)
      return true;
    return visibleCallIds.has(item.action.callId);
  }, [selectedTime, visibleCallIds]);

  const onSelectedAction = React.useCallback((item: ActionTreeItem) => {
    onSelected?.(item.action);
  }, [onSelected]);

  const onHighlightedAction = React.useCallback((item: ActionTreeItem | undefined) => {
    onHighlighted?.(item?.action);
  }, [onHighlighted]);

  return <div className='vbox action-list-container'>
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
      autoExpandDepth={actionFilterText?.trim() ? 5 : 0}
    />
  </div>;
};

export const renderAction = (
  action: ActionTraceEvent,
  options: {
    sdkLanguage?: Language,
    revealConsole?: () => void,
    revealActionAttachment?(): void,
    isLive?: boolean,
    showDuration?: boolean,
    showBadges?: boolean,
    showAttachments?: boolean,
  }) => {
  const { sdkLanguage, revealConsole, revealActionAttachment, isLive, showDuration, showBadges, showAttachments } = options;
  const { errors, warnings } = stats(action);

  const locator = action.params.selector ? asLocatorDescription(sdkLanguage || 'javascript', action.params.selector) : undefined;

  const isSkipped = action.class === 'Test' && action.method === 'test.step' && action.annotations?.some(a => a.type === 'skip');
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
      {showAttachments && <ToolbarButton icon='attach' title='Open Attachment' onClick={() => revealActionAttachment?.()} />}
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
  let titleFormat = action.title ?? methodMetainfo.get(action.class + '.' + action.method)?.title ?? action.method;
  titleFormat = titleFormat.replace(/\n/g, ' ');

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
    if (param === undefined) {
      elements.push(fullMatch);
      title.push(fullMatch);
    } else if (match.index === 0) {
      elements.push(param);
      title.push(param);
    } else {
      elements.push(<span key={elements.length} className='action-title-param'>{param}</span>);
      title.push(param);
    }
    currentIndex = match.index + fullMatch.length;
  }

  if (currentIndex < titleFormat.length) {
    const chunk = titleFormat.slice(currentIndex);
    elements.push(chunk);
    title.push(chunk);
  }

  return { elements, title: title.join('') };
}
