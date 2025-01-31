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
import { testStatusIcon } from './testUtils';

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

  const isSkipped = action.class === 'Test' && action.method === 'step' && action.annotations?.some(a => a.type === 'skip');
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
      {parameterString &&
          (parameterString.type === 'locator' ? (
            <>
              <span className='action-parameter action-locator-parameter'>
                {parameterString.value}
              </span>
              {parameterString.childDisplayString && (
                <span className='action-parameter action-generic-parameter'>
                  {parameterString.childDisplayString.value}
                </span>
              )}
            </>
          ) : (
            <span className='action-parameter action-generic-parameter'>
              {parameterString.value}
            </span>
          ))}
      {action.method === 'goto' && action.params.url && <div className='action-url' title={action.params.url}>{action.params.url}</div>}
      {action.class === 'APIRequestContext' && action.params.url && <div className='action-url' title={action.params.url}>{excludeOrigin(action.params.url)}</div>}
    </div>
    {(showDuration || showBadges || showAttachments || isSkipped) && <div className='spacer'></div>}
    {showAttachments && <ToolbarButton icon='attach' title='Open Attachment' onClick={() => revealAttachment(action.attachments![0])} />}
    {showDuration && !isSkipped && <div className='action-duration'>{time || <span className='codicon codicon-loading'></span>}</div>}
    {isSkipped && <span className={clsx('action-skipped', 'codicon', testStatusIcon('skipped'))} title='skipped'></span>}
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

type ActionParameterDisplayString =
  | {
      type: 'generic';
      value: string;
    }
  | {
      type: 'locator';
      value: string;
      childDisplayString?: ActionParameterDisplayString;
    };

const clockDisplayString = (
  action: ActionTraceEvent,
): ActionParameterDisplayString | undefined => {
  switch (action.method) {
    case 'clockPauseAt':
    case 'clockSetFixedTime':
    case 'clockSetSystemTime': {
      if (
        action.params.timeString === undefined &&
        action.params.timeNumber === undefined
      )
        return undefined;
      return {
        type: 'generic',
        value: new Date(
            action.params.timeString ?? action.params.timeNumber,
        ).toLocaleString(undefined, { timeZone: 'UTC' }),
      };
    }
    case 'clockFastForward':
    case 'clockRunFor': {
      if (
        action.params.ticksNumber === undefined &&
        action.params.ticksString === undefined
      )
        return undefined;
      return {
        type: 'generic',
        value: action.params.ticksString ?? `${action.params.ticksNumber}ms`,
      };
    }
  }

  return undefined;
};

const keyboardDisplayString = (
  action: ActionTraceEvent,
): ActionParameterDisplayString | undefined => {
  switch (action.method) {
    case 'press':
    case 'keyboardPress':
    case 'keyboardDown':
    case 'keyboardUp': {
      if (action.params.key === undefined)
        return undefined;
      return { type: 'generic', value: action.params.key };
    }
    case 'type':
    case 'fill':
    case 'keyboardType':
    case 'keyboardInsertText': {
      const string = action.params.text ?? action.params.value;
      if (string === undefined)
        return undefined;
      return { type: 'generic', value: `"${string}"` };
    }
  }
};

const mouseDisplayString = (
  action: ActionTraceEvent,
): ActionParameterDisplayString | undefined => {
  switch (action.method) {
    case 'click':
    case 'dblclick':
    case 'mouseClick':
    case 'mouseMove': {
      if (action.params.x === undefined || action.params.y === undefined)
        return undefined;
      return {
        type: 'generic',
        value: `(${action.params.x}, ${action.params.y})`,
      };
    }
    case 'mouseWheel': {
      if (
        action.params.deltaX === undefined ||
        action.params.deltaY === undefined
      )
        return undefined;
      return {
        type: 'generic',
        value: `(${action.params.deltaX}, ${action.params.deltaY})`,
      };
    }
  }
};

const touchscreenDisplayString = (
  action: ActionTraceEvent,
): ActionParameterDisplayString | undefined => {
  switch (action.method) {
    case 'tap': {
      if (action.params.x === undefined || action.params.y === undefined)
        return undefined;
      return {
        type: 'generic',
        value: `(${action.params.x}, ${action.params.y})`,
      };
    }
  }
};

const actionParameterDisplayString = (
  action: ActionTraceEvent,
  sdkLanguage: Language,
  ignoreLocator: boolean = false,
): ActionParameterDisplayString | undefined => {
  const params = action.params;

  // Locators have many possible classes, so follow existing logic and use `selector` presence
  if (!ignoreLocator && params.selector !== undefined) {
    return {
      type: 'locator',
      value: asLocator(sdkLanguage, params.selector),
      childDisplayString: actionParameterDisplayString(
          action,
          sdkLanguage,
          true,
      ),
    };
  }

  switch (action.class.toLowerCase()) {
    case 'browsercontext':
      return clockDisplayString(action);
    case 'page':
    case 'frame':
    case 'elementhandle':
      return (
        keyboardDisplayString(action) ??
        mouseDisplayString(action) ??
        touchscreenDisplayString(action)
      );
  }

  return undefined;
};
