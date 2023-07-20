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

import type { ActionTraceEvent, Attachment } from '@trace/trace';
import { msToString } from '@web/uiUtils';
import * as React from 'react';
import './actionList.css';
import * as modelUtil from './modelUtil';
import { asLocator } from '@isomorphic/locatorGenerators';
import type { Language } from '@isomorphic/locatorGenerators';
import type { TreeState } from '@web/components/treeView';
import { TreeView } from '@web/components/treeView';
import { ToolbarButton } from '@web/components/toolbarButton';
import type { ActionTraceEventInContext, ActionTreeItem, ScreenshotUpdateHandler } from './modelUtil';
import { AppContext } from './uiModeView';

export interface ActionListProps {
  actions: ActionTraceEventInContext[],
  selectedAction: ActionTraceEventInContext | undefined,
  sdkLanguage: Language | undefined;
  onScreenshotUpdated?: ScreenshotUpdateHandler;
  onSelected: (action: ActionTraceEventInContext) => void,
  onHighlighted: (action: ActionTraceEventInContext | undefined) => void,
  revealConsole: () => void,
  isLive?: boolean,
}

const ActionTreeView = TreeView<ActionTreeItem>;

export const ActionList: React.FC<ActionListProps> = ({
  actions,
  selectedAction,
  sdkLanguage,
  onScreenshotUpdated,
  onSelected,
  onHighlighted,
  revealConsole,
  isLive,
}) => {
  const [treeState, setTreeState] = React.useState<TreeState>({ expandedItems: new Map() });
  const [attachmentsState, setAttachmentsState] = React.useState<AttachmentsState>({});
  const { rootItem, itemMap } = React.useMemo(() => modelUtil.buildActionTree(actions), [actions]);
  const { isUIMode } = React.useContext(AppContext);
  const [updateScreenshot, isUpdating] = useScreenshotUpdater(onScreenshotUpdated, attachmentsState, setAttachmentsState);

  const { selectedItem } = React.useMemo(() => {
    const selectedItem = selectedAction ? itemMap.get(selectedAction.callId) : undefined;
    return { selectedItem };
  }, [itemMap, selectedAction]);

  return <ActionTreeView
    dataTestId='action-list'
    rootItem={rootItem}
    treeState={treeState}
    setTreeState={setTreeState}
    selectedItem={selectedItem}
    onSelected={item => onSelected(item.action!)}
    onHighlighted={item => onHighlighted(item?.action)}
    isError={item => !!item.action?.error?.message}
    isWarning={item => shouldDisplayToggleButton(item) && getStatusFromState(attachmentsState, item) === AttachmentStatus.ACTUAL}
    render={item => {
      const buttons = isUIMode ? renderButtons(item, isUpdating, attachmentsState, updateScreenshot) : [];

      return renderAction(item.action!, sdkLanguage, revealConsole, isLive || false, buttons);
    }}
  />;
};

type AttachmentsState = Record<string, Record<string, AttachmentStatus>>;

const TO_HAVE_SCREENSHOT_API_NAME = 'expect.toHaveScreenshot';

const getStatusFromState = (attachmentsState: AttachmentsState, treeItem: ActionTreeItem): AttachmentStatus => {
  const toHaveScreenshotAction = findParentByApiName(treeItem, TO_HAVE_SCREENSHOT_API_NAME);

  const attachment = getAttachment(toHaveScreenshotAction);
  const resultHash = getActionHash(toHaveScreenshotAction);

  return attachmentsState[attachment?.targetPath ?? '']?.[resultHash] ?? AttachmentStatus.EXPECTED;
};

const setStatusFromState = (attachmentsState: AttachmentsState, setAttachmentsState: React.Dispatch<AttachmentsState>, treeItem: ActionTreeItem, newStatus: AttachmentStatus): void => {
  const toHaveScreenshotAction = findParentByApiName(treeItem, TO_HAVE_SCREENSHOT_API_NAME);

  const attachment = getAttachment(toHaveScreenshotAction);
  const resultHash = getActionHash(toHaveScreenshotAction);

  if (!attachment?.targetPath || !resultHash)
    return;

  setAttachmentsState({
    ...attachmentsState,
    [attachment.targetPath]: {
      [resultHash]: newStatus,
    },
  });
};

const shouldDisplayAcceptButton = (item: ActionTreeItem) => {
  return item.parent?.action?.apiName === TO_HAVE_SCREENSHOT_API_NAME &&
    item.parent.action.error &&
    item.action?.attachments?.[0].name.match(/expected|actual/) &&
    item.action.attachments?.[0].targetPath &&
    item.action.attachments?.[0].sha1 &&
    item.action?.context.traceUrl;
};

const shouldDisplayToggleButton = (item: ActionTreeItem): boolean => {
  return Boolean(item.action?.apiName === TO_HAVE_SCREENSHOT_API_NAME &&
    item.action.error &&
    item.action.attachments?.filter(attach =>
      attach.name.match(/expected|actual/) &&
      attach.targetPath
    ).length === 2);
};

const findParentByApiName = (treeItem: ActionTreeItem, apiName: string, searchLimit = 1): ActionTreeItem | null => {
  let attemptNumber = 0;
  let currentTreeItem: ActionTreeItem | undefined = treeItem;

  do {
    if (currentTreeItem.action?.apiName === apiName)
      return currentTreeItem;
    currentTreeItem = currentTreeItem.parent;
    attemptNumber++;
  } while (currentTreeItem && attemptNumber <= searchLimit);

  return null;
};

const getAttachment = (item: ActionTreeItem | null, status: AttachmentStatus | null = null): Attachment | undefined => {
  return item?.action?.attachments?.find(attach => status ? attach.name.includes(status) : attach);
};

const getActionHash = (item: ActionTreeItem | null): string => {
  return (item?.action?.startTime! + item?.action?.endTime!)?.toString();
};

const getStatusFromAttachment = (attachment: Attachment): AttachmentStatus => {
  return attachment.name.match(/expected|actual|diff|previous/)?.[0] as AttachmentStatus ?? AttachmentStatus.UNKNOWN;
};

enum AttachmentStatus {
  EXPECTED='expected',
  ACTUAL = 'actual',
  DIFF = 'diff',
  PREVIOUS = 'previous',
  UNKNOWN = 'unknown'
}

const getScreenshotUrl = (sha1: string, traceUrl: string): string => {
  return 'sha1/' + sha1 + '?trace=' + encodeURIComponent(traceUrl);
};

type UpdateScreenshotFn = (targetPath: string, newScreenshotUrl: string, newStatus: AttachmentStatus, item: ActionTreeItem) => Promise<void>;

const useScreenshotUpdater = (onScreenshotUpdated: ScreenshotUpdateHandler | undefined, attachmentsState: AttachmentsState, setAttachmentsState: React.Dispatch<AttachmentsState>) => {
  const [isUpdating, setIsUpdating] = React.useState(false);

  const updateScreenshot: UpdateScreenshotFn = async (targetPath, newScreenshotUrl, newStatus, item) => {
    setIsUpdating(true);

    const response = await fetch(newScreenshotUrl);
    const contentArrayBuffer = await response.arrayBuffer();
    const contentBase64 = btoa(String.fromCharCode(...new Uint8Array(contentArrayBuffer)));

    setStatusFromState(attachmentsState, setAttachmentsState, item, newStatus);

    await onScreenshotUpdated?.(targetPath, contentBase64, newStatus);

    setIsUpdating(false);
  };

  return [updateScreenshot, isUpdating] as const;
};

const renderButtons = (item: ActionTreeItem, isUpdating: boolean, attachmentsState: AttachmentsState, updateScreenshot: UpdateScreenshotFn) => {
  const buttons: JSX.Element[] = [];

  if (shouldDisplayAcceptButton(item)) {
    const attachment = getAttachment(item, null)!;
    const newStatus = getStatusFromAttachment(attachment);

    const screenshotUrl = getScreenshotUrl(attachment.sha1!, item.action?.context.traceUrl!);
    const isDisabled = isUpdating || getStatusFromState(attachmentsState, item) === newStatus;

    buttons.push(
        <ToolbarButton
          icon='save'
          title='Save'
          onClick={() => updateScreenshot(attachment.targetPath!, screenshotUrl, newStatus, item)}
          disabled={isDisabled}
        />
    );
  }

  if (shouldDisplayToggleButton(item)) {
    const currentStatus = getStatusFromState(attachmentsState, item);

    if (currentStatus === 'expected') {
      const attachment = getAttachment(item, AttachmentStatus.ACTUAL)!;
      const screenshotUrl = getScreenshotUrl(attachment.sha1!, item.action?.context.traceUrl!);

      buttons.push(
          <ToolbarButton
            icon='check'
            title='Accept'
            onClick={() => updateScreenshot(attachment.targetPath!, screenshotUrl, AttachmentStatus.ACTUAL, item)}
            disabled={isUpdating}
          />
      );
    } else if (currentStatus === 'actual') {
      const attachment = getAttachment(item, AttachmentStatus.EXPECTED)!;
      const screenshotUrl = getScreenshotUrl(attachment.sha1!, item.action?.context.traceUrl!);

      buttons.push(
          <ToolbarButton
            icon='discard'
            title='Undo accepting'
            onClick={() => updateScreenshot(attachment.targetPath!, screenshotUrl, AttachmentStatus.EXPECTED, item)}
            disabled={isUpdating}
          />
      );
    }
  }

  return buttons;
};

const renderAction = (
  action: ActionTraceEvent,
  sdkLanguage: Language | undefined,
  revealConsole: () => void,
  isLive: boolean,
  buttons: JSX.Element[]
) => {
  const { errors, warnings } = modelUtil.stats(action);
  const locator = action.params.selector ? asLocator(sdkLanguage || 'javascript', action.params.selector, false /* isFrameLocator */, true /* playSafe */) : undefined;

  let time: string = '';
  if (action.endTime)
    time = msToString(action.endTime - action.startTime);
  else if (action.error)
    time = 'Timed out';
  else if (!isLive)
    time = '-';
  return <>
    <div className='action-title'>
      <span>{action.apiName}</span>
      {locator && <div className='action-selector' title={locator}>{locator}</div>}
      {action.method === 'goto' && action.params.url && <div className='action-url' title={action.params.url}>{action.params.url}</div>}
    </div>
    {buttons}
    <div className='action-duration' style={{ flex: 'none' }}>{time || <span className='codicon codicon-loading'></span>}</div>
    <div className='action-icons' onClick={() => revealConsole()}>
      {!!errors && <div className='action-icon'><span className='codicon codicon-error'></span><span className="action-icon-value">{errors}</span></div>}
      {!!warnings && <div className='action-icon'><span className='codicon codicon-warning'></span><span className="action-icon-value">{warnings}</span></div>}
    </div>
  </>;
};
