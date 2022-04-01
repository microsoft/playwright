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

import type { TestAttachment } from '@playwright-test/reporters/html';
import * as React from 'react';
import { AttachmentLink } from './links';
import { TabbedPane } from './tabbedPane';
import './testResultView.css';

export type ImageDiff = {
  name: string,
  left?: { attachment: TestAttachment, title: string },
  right?: { attachment: TestAttachment, title: string },
  diff?: { attachment: TestAttachment, title: string },
};

export const ImageDiffView: React.FunctionComponent<{
 imageDiff: ImageDiff,
}> = ({ imageDiff: diff }) => {
  // Pre-select a tab called "actual", if any.
  const [selectedTab, setSelectedTab] = React.useState<string>('left');
  const diffElement = React.useRef<HTMLImageElement>(null);
  const setMinHeight = () => {
    if (diffElement.current)
      diffElement.current.style.minHeight = diffElement.current.offsetHeight + 'px';
  };
  const tabs = [
    {
      id: 'left',
      title: diff.left!.title,
      render: () => <img src={diff.left!.attachment.path!} onLoad={setMinHeight}/>
    },
    {
      id: 'right',
      title: diff.right!.title,
      render: () => <img src={diff.right!.attachment.path!} onLoad={setMinHeight}/>
    },
  ];
  if (diff.diff) {
    tabs.push({
      id: 'diff',
      title: diff.diff.title,
      render: () => <img src={diff.diff!.attachment.path} onLoad={setMinHeight}/>
    });
  }
  return <div className='vbox' data-testid='test-result-image-mismatch' ref={diffElement}>
    <TabbedPane tabs={tabs} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
    <AttachmentLink attachment={diff.left!.attachment}></AttachmentLink>
    <AttachmentLink attachment={diff.right!.attachment}></AttachmentLink>
    {diff.diff && <AttachmentLink attachment={diff.diff.attachment}></AttachmentLink>}
  </div>;
};
