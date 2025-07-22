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

import type { TestAttachment, TestCase, TestCaseSummary, TestResult, TestResultSummary } from './types';
import * as React from 'react';
import * as icons from './icons';
import { CopyToClipboard } from './copyToClipboard';
import './links.css';
import { linkifyText } from '@web/renderUtils';
import { clsx, useFlash } from '@web/uiUtils';
import { trace } from './icons';
import { Expandable } from './expandable';

export function navigate(href: string | URL) {
  window.history.pushState({}, '', href);
  const navEvent = new PopStateEvent('popstate');
  window.dispatchEvent(navEvent);
}

export const Route: React.FunctionComponent<{
  predicate: (params: URLSearchParams) => boolean,
  children: any
}> = ({ predicate, children }) => {
  const searchParams = React.useContext(SearchParamsContext);
  return predicate(searchParams) ? children : null;
};

type LinkProps = React.PropsWithChildren<{
  href?: string,
  click?: string,
  ctrlClick?: string,
  className?: string,
  title?: string,
}>;

export const Link: React.FunctionComponent<LinkProps> = ({ click, ctrlClick, children, ...rest }) => {
  return <a {...rest} style={{ textDecoration: 'none', color: 'var(--color-fg-default)', cursor: 'pointer' }} onClick={e => {
    if (click) {
      e.preventDefault();
      navigate(e.metaKey || e.ctrlKey ? ctrlClick || click : click);
    }
  }}>{children}</a>;
};

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

export const AttachmentLink: React.FunctionComponent<{
  attachment: TestAttachment,
  result: TestResult,
  href?: string,
  linkName?: string,
  openInNewTab?: boolean,
}> = ({ attachment, result, href, linkName, openInNewTab }) => {
  const [flash, triggerFlash] = useFlash();
  useAnchor('attachment-' + result.attachments.indexOf(attachment), triggerFlash);

  const summaryContent = (
    <span>
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
              onClick={e => e.stopPropagation() /* dont expand the details */}
            >
              {attachment.name}
            </a>
          )
          : <span>{linkifyText(attachment.name)}</span>
      )}
    </span>
  );

  if (!attachment.body) {
    return (
      <div
        style={{ lineHeight: '32px', whiteSpace: 'nowrap', paddingLeft: 4 }}
        className={clsx(flash && 'flash')}
      >
        <span style={{ visibility: 'hidden' }}>{icons.rightArrow()}</span>
        {summaryContent}
      </div>
    );
  }

  return (
    <Expandable
      style={{ lineHeight: '32px' }}
      className={clsx(flash && 'flash')}
      summary={summaryContent}
    >
      <div className='attachment-body'>
        <CopyToClipboard value={attachment.body!}/>
        {linkifyText(attachment.body!)}
      </div>
    </Expandable>
  );
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
        className='button trace-link'
        dim={dim}>
        {trace()}
        <span>View Trace</span>
      </LinkBadge>
      {trailingSeparator && <div className='trace-link-separator'>|</div>}
    </>
  );
};

export const SearchParamsContext = React.createContext<URLSearchParams>(new URLSearchParams(window.location.hash.slice(1)));

export const SearchParamsProvider: React.FunctionComponent<React.PropsWithChildren> = ({ children }) => {
  const [searchParams, setSearchParams] = React.useState<URLSearchParams>(new URLSearchParams(window.location.hash.slice(1)));

  React.useEffect(() => {
    const listener = () => setSearchParams(new URLSearchParams(window.location.hash.slice(1)));
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);

  return <SearchParamsContext.Provider value={searchParams}>{children}</SearchParamsContext.Provider>;
};

function downloadFileNameForAttachment(attachment: TestAttachment): string {
  if (attachment.name.includes('.') || !attachment.path)
    return attachment.name;
  const firstDotIndex = attachment.path.indexOf('.');
  if (firstDotIndex === -1)
    return attachment.name;
  return attachment.name + attachment.path.slice(firstDotIndex, attachment.path.length);
}

export function generateTraceUrl(traces: TestAttachment[]) {
  return `trace/index.html?${traces.map((a, i) => `trace=${new URL(a.path!, window.location.href)}`).join('&')}`;
}

const kMissingContentType = 'x-playwright/missing';

export type AnchorID = string | string[] | ((id: string) => boolean) | undefined;

export function useAnchor(id: AnchorID, onReveal: React.EffectCallback) {
  const searchParams = React.useContext(SearchParamsContext);
  const isAnchored = useIsAnchored(id);
  React.useEffect(() => {
    if (isAnchored)
      return onReveal();
  }, [isAnchored, onReveal, searchParams]);
}

export function useIsAnchored(id: AnchorID) {
  const searchParams = React.useContext(SearchParamsContext);
  const anchor = searchParams.get('anchor');
  if (anchor === null)
    return false;
  if (typeof id === 'undefined')
    return false;
  if (typeof id === 'string')
    return id === anchor;
  if (Array.isArray(id))
    return id.includes(anchor);
  return id(anchor);
}

export function Anchor({ id, children }: React.PropsWithChildren<{ id: AnchorID }>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const onAnchorReveal = React.useCallback(() => {
    ref.current?.scrollIntoView({ block: 'start', inline: 'start' });
  }, []);
  useAnchor(id, onAnchorReveal);

  return <div ref={ref}>{children}</div>;
}

export function testResultHref({ test, result, anchor }: { test?: TestCase | TestCaseSummary, result?: TestResult | TestResultSummary, anchor?: string }) {
  const params = new URLSearchParams();
  if (test)
    params.set('testId', test.testId);
  if (test && result)
    params.set('run', '' + test.results.indexOf(result as any));
  if (anchor)
    params.set('anchor', anchor);
  return `#?` + params;
}
