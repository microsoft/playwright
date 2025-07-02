/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import { Link, LinkProps } from './links';
import { clsx, useFlash } from '@web/uiUtils';
import type { TestAttachment, TestCaseSummary, TestResult } from './types';
import { TreeItem } from './treeItem';
import * as icons from './icons';
import { useAnchor } from './anchor';
import { linkifyText } from '@web/renderUtils';
import { CopyToClipboard } from './copyToClipboard';
import { generateTraceUrl } from './url';
import './colors.css';
import './linkVariants.css';

export const LinkBadge: React.FunctionComponent<LinkProps & { dim?: boolean }> = ({ className, ...props }) => <Link {...props} className={clsx('link-badge', props.dim && 'link-badge-dim', className)} />;

export const ProjectLink: React.FunctionComponent<{
  projectNames: string[],
  projectName: string,
}> = ({ projectNames, projectName }) => {
  const encoded = encodeURIComponent(projectName);
  const value = projectName === encoded ? projectName : `"${encoded.replace(/%22/g, '%5C%22')}"`;
  return <Link href={`#?q=p:${value}`}>
    <span className={clsx('label', `label-color-${projectNames.indexOf(projectName) % 6}`)} style={{ margin: '6px 0 0 6px' }}>
      {projectName}
    </span>
  </Link>;
};

const kMissingContentType = 'x-playwright/missing';

export const AttachmentLink: React.FunctionComponent<{
  attachment: TestAttachment,
  result: TestResult,
  href?: string,
  linkName?: string,
  openInNewTab?: boolean,
}> = ({ attachment, result, href, linkName, openInNewTab }) => {
  const [flash, triggerFlash] = useFlash();
  useAnchor('attachment-' + result.attachments.indexOf(attachment), triggerFlash);
  return <TreeItem title={<span>
    {attachment.contentType === kMissingContentType ? icons.warning() : icons.attachment()}
    {attachment.path && (
      openInNewTab
        ? <a href={href || attachment.path} target='_blank' rel='noreferrer'>{linkName || attachment.name}</a>
        : <a href={href || attachment.path} download={downloadFileNameForAttachment(attachment)}>{linkName || attachment.name}</a>
    )}
    {!attachment.path && (
      openInNewTab
        ? (
          <a
            href={URL.createObjectURL(new Blob([attachment.body!], { type: attachment.contentType }))}
            target='_blank' rel='noreferrer'
            onClick={e => e.stopPropagation() /* dont expand the tree item */}
          >
            {attachment.name}
          </a>
        )
        : <span>{linkifyText(attachment.name)}</span>
    )}
  </span>} loadChildren={attachment.body ? () => {
    return [<div key={1} className='attachment-body'><CopyToClipboard value={attachment.body!}/>{linkifyText(attachment.body!)}</div>];
  } : undefined} depth={0} style={{ lineHeight: '32px' }} flash={flash}></TreeItem>;
};

export const TraceLink: React.FC<{ test: TestCaseSummary, trailingSeparator?: boolean, dim?: boolean }> = ({ test, trailingSeparator, dim }) => {
  const firstTraces = test.results.map(result => result.attachments.filter(attachment => attachment.name === 'trace')).filter(traces => traces.length > 0)[0];
  if (!firstTraces)
    return undefined;

  return (
    <>
      <LinkBadge
        href={generateTraceUrl(firstTraces)}
        title='View Trace'
        className='button link-trace'
        dim={dim}>
        {icons.trace()}
        <span>View Trace</span>
      </LinkBadge>
      {trailingSeparator && <div className='link-trace-separator'>|</div>}
    </>
  );
};

function downloadFileNameForAttachment(attachment: TestAttachment): string {
  if (attachment.name.includes('.') || !attachment.path)
    return attachment.name;
  const firstDotIndex = attachment.path.indexOf('.');
  if (firstDotIndex === -1)
    return attachment.name;
  return attachment.name + attachment.path.slice(firstDotIndex, attachment.path.length);
}
