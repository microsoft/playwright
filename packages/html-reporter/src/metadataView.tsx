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

import * as React from 'react';
import './colors.css';
import './common.css';
import './theme.css';
import './metadataView.css';
import type { Metadata } from '@playwright/test';
import type { GitCommitInfo } from '@testIsomorphic/types';
import { CopyToClipboardContainer } from './copyToClipboard';
import { linkifyText } from '@web/renderUtils';

type MetadataEntries = [string, unknown][];

export const MetadataContext = React.createContext<MetadataEntries>([]);

export function MetadataProvider({ metadata, children }: React.PropsWithChildren<{ metadata: Metadata }>) {
  const entries = React.useMemo(() => {
    // TODO: do not plumb actualWorkers through metadata.
    return Object.entries(metadata).filter(([key]) => key !== 'actualWorkers');
  }, [metadata]);

  return <MetadataContext.Provider value={entries}>{children}</MetadataContext.Provider>;
}

export function useMetadata() {
  return React.useContext(MetadataContext);
}

export function useGitCommitInfo() {
  const metadataEntries = useMetadata();
  return metadataEntries.find(([key]) => key === 'git.commit.info')?.[1] as GitCommitInfo | undefined;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, { error: Error | null, errorInfo: React.ErrorInfo | null }> {
  override state: { error: Error | null, errorInfo: React.ErrorInfo | null } = {
    error: null,
    errorInfo: null,
  };

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  override render() {
    if (this.state.error || this.state.errorInfo) {
      return (
        <div className='metadata-view p-3'>
          <p>An error was encountered when trying to render metadata.</p>
          <p>
            <pre style={{ overflow: 'scroll' }}>{this.state.error?.message}<br/>{this.state.error?.stack}<br/>{this.state.errorInfo?.componentStack}</pre>
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export const MetadataView = () => {
  return <ErrorBoundary><InnerMetadataView/></ErrorBoundary>;
};

const InnerMetadataView = () => {
  const metadataEntries = useMetadata();
  const gitCommitInfo = useGitCommitInfo();
  const entries = metadataEntries.filter(([key]) => key !== 'git.commit.info');
  if (!gitCommitInfo && !entries.length)
    return null;
  return <div className='metadata-view'>
    {gitCommitInfo && <>
      <GitCommitInfoView info={gitCommitInfo}/>
      {entries.length > 0 && <div className='metadata-separator' />}
    </>}
    <div className='metadata-section metadata-properties'>
      {entries.map(([propertyName, value]) => {
        const valueString = typeof value !== 'object' || value === null || value === undefined ? String(value) : JSON.stringify(value);
        const trimmedValue = valueString.length > 1000 ? valueString.slice(0, 1000) + '\u2026' : valueString;
        return (
          <div key={propertyName} className='copyable-property'>
            <CopyToClipboardContainer value={valueString}>
              <span style={{ fontWeight: 'bold' }} title={propertyName}>{propertyName}</span>
              : <span title={trimmedValue}>{linkifyText(trimmedValue)}</span>
            </CopyToClipboardContainer>
          </div>
        );
      })}
    </div>
  </div>;
};

const GitCommitInfoView: React.FC<{ info: GitCommitInfo }> = ({ info }) => {
  const email = info['revision.email'] ? ` <${info['revision.email']}>` : '';
  const author = `${info['revision.author'] || ''}${email}`;

  let subject = info['revision.subject'] || '';
  let link = info['revision.link'];
  let shortSubject = info['revision.id']?.slice(0, 7) || 'unknown';

  if (info['pull.link'] && info['pull.title']) {
    subject = info['pull.title'];
    link = info['pull.link'];
    shortSubject = link ? 'Pull Request' : '';
  }

  const shortTimestamp = Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(info['revision.timestamp']);
  const longTimestamp = Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(info['revision.timestamp']);
  return <div className='hbox git-commit-info metadata-section'>
    <div className='vbox metadata-properties'>
      <div>
        {link ? (
          <a href={link} target='_blank' rel='noopener noreferrer' title={subject}>
            {subject}
          </a>
        ) : <span title={subject}>
          {subject}
        </span>}
      </div>
      <div className='hbox'>
        <span className='mr-1'>{author}</span>
        <span title={longTimestamp}> on {shortTimestamp}</span>
        {info['ci.link'] && (
          <>
            <span className='mx-2'>·</span>
            <a href={info['ci.link']} target='_blank' rel='noopener noreferrer' title='CI/CD logs'>Logs</a>
          </>
        )}
      </div>
    </div>
    {link ? (
      <a href={link} target='_blank' rel='noopener noreferrer' title='View commit details'>
        {shortSubject}
      </a>
    ) : !!shortSubject && <span>{shortSubject}</span>}
  </div>;
};
