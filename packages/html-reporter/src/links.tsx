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

import type { TestAttachment } from '@playwright/test/src/reporters/html';
import * as React from 'react';
import * as icons from './icons';
import { TreeItem } from './treeItem';
import './links.css';

export function navigate(href: string) {
  window.history.pushState({}, '', href);
  const navEvent = new PopStateEvent('popstate');
  window.dispatchEvent(navEvent);
}

export const Route: React.FunctionComponent<{
  params: string,
  children: any
}> = ({ params, children }) => {
  const initialParams = [...new URLSearchParams(window.location.hash.slice(1)).keys()].join('&');
  const [currentParams, setCurrentParam] = React.useState(initialParams);
  React.useEffect(() => {
    const listener = () => {
      const newParams = [...new URLSearchParams(window.location.hash.slice(1)).keys()].join('&');
      setCurrentParam(newParams);
    };
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);
  return currentParams === params ? children : null;
};

export const Link: React.FunctionComponent<{
  href: string,
  className?: string,
  title?: string,
  children: any,
}> = ({ href, className, children, title }) => {
  return <a style={{ textDecoration: 'none', color: 'initial' }} className={`${className || ''}`} href={href} title={title}>{children}</a>;
};

export const ProjectLink: React.FunctionComponent<{
  projectNames: string[],
  projectName: string,
}> = ({ projectNames, projectName }) => {
  const encoded = encodeURIComponent(projectName);
  const value = projectName === encoded ? projectName : `"${encoded.replace(/%22/g, '%5C%22')}"`;
  return <Link href={`#?q=p:${value}`}>
    <span className={'label label-color-' + (projectNames.indexOf(projectName) % 6)}>
      {projectName}
    </span>
  </Link>;
};

export const AttachmentLink: React.FunctionComponent<{
  attachment: TestAttachment,
  href?: string,
}> = ({ attachment, href }) => {
  return <TreeItem title={<span>
    {attachment.contentType === kMissingContentType ? icons.warning() : icons.attachment()}
    {attachment.path && <a href={href || attachment.path} target='_blank'>{attachment.name}</a>}
    {attachment.body && <span>{attachment.name}</span>}
  </span>} loadChildren={attachment.body ? () => {
    return [<div className='attachment-body'>{attachment.body}</div>];
  } : undefined} depth={0}></TreeItem>;
};

const kMissingContentType = 'x-playwright/missing';
