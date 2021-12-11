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

import type { HTMLReport, TestAttachment } from '@playwright/test/src/reporters/html';
import * as React from 'react';
import { TreeItem } from './treeItem';
import './links.css';

export const Link: React.FunctionComponent<{
  href: string,
  className?: string,
  title?: string,
  children: any,
}> = ({ href, className, children, title }) => {
  return <a style={{ textDecoration: 'none', color: 'initial' }} className={`${className || ''}`} href={href} title={title}>{children}</a>;
};

export const ProjectLink: React.FunctionComponent<{
  report: HTMLReport,
  projectName: string,
}> = ({ report, projectName }) => {
  const encoded = encodeURIComponent(projectName);
  const value = projectName === encoded ? projectName : `"${encoded.replace(/%22/g, '%5C%22')}"`;
  return <Link href={`#?q=p:${value}`}>
    <span className={'label label-color-' + (report.projectNames.indexOf(projectName) % 6)}>
      {projectName}
    </span>
  </Link>;
};

export const AttachmentLink: React.FunctionComponent<{
  attachment: TestAttachment,
  href?: string,
}> = ({ attachment, href }) => {
  return <TreeItem title={<span>
    {attachment.contentType === kMissingContentType ?
      <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-text-warning'>
        <path fillRule='evenodd' d='M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z'></path>
      </svg> :
      <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-fg-muted'>
        <path fillRule='evenodd' d='M3.5 1.75a.25.25 0 01.25-.25h3a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h2.086a.25.25 0 01.177.073l2.914 2.914a.25.25 0 01.073.177v8.586a.25.25 0 01-.25.25h-.5a.75.75 0 000 1.5h.5A1.75 1.75 0 0014 13.25V4.664c0-.464-.184-.909-.513-1.237L10.573.513A1.75 1.75 0 009.336 0H3.75A1.75 1.75 0 002 1.75v11.5c0 .649.353 1.214.874 1.515a.75.75 0 10.752-1.298.25.25 0 01-.126-.217V1.75zM8.75 3a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h-.5zM6 5.25a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5A.75.75 0 016 5.25zm2 1.5A.75.75 0 018.75 6h.5a.75.75 0 010 1.5h-.5A.75.75 0 018 6.75zm-1.25.75a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h-.5zM8 9.75A.75.75 0 018.75 9h.5a.75.75 0 010 1.5h-.5A.75.75 0 018 9.75zm-.75.75a1.75 1.75 0 00-1.75 1.75v3c0 .414.336.75.75.75h2.5a.75.75 0 00.75-.75v-3a1.75 1.75 0 00-1.75-1.75h-.5zM7 12.25a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v2.25H7v-2.25z'></path>
      </svg>
    }
    {attachment.path && <a href={href || attachment.path} target='_blank'>{attachment.name}</a>}
    {attachment.body && <span>{attachment.name}</span>}
  </span>} loadChildren={attachment.body ? () => {
    return [<div className='attachment-link'>{attachment.body}</div>];
  } : undefined} depth={0}></TreeItem>;
};

const kMissingContentType = 'x-playwright/missing';
