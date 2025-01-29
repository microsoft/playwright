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

export function filterMetadata(metadata: Metadata): MetadataEntries {
  // TODO: do not plumb actualWorkers through metadata.
  return Object.entries(metadata).filter(([key]) => key !== 'actualWorkers');
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

export const MetadataView: React.FC<{ metadataEntries: MetadataEntries }> = ({ metadataEntries }) => {
  return <ErrorBoundary><InnerMetadataView metadataEntries={metadataEntries}/></ErrorBoundary>;
};

const InnerMetadataView: React.FC<{ metadataEntries: MetadataEntries }> = ({ metadataEntries }) => {
  const gitCommitInfo = metadataEntries.find(([key]) => key === 'git.commit.info')?.[1] as GitCommitInfo | undefined;
  const entries = metadataEntries.filter(([key]) => key !== 'git.commit.info');
  if (!gitCommitInfo && !entries.length)
    return null;
  return <div className='metadata-view'>
    {gitCommitInfo && <>
      <GitCommitInfoView info={gitCommitInfo}/>
      {entries.length > 0 && <div className='metadata-separator' />}
    </>}
    {entries.map(([key, value]) => {
      const valueString = typeof value !== 'object' || value === null || value === undefined ? String(value) : JSON.stringify(value);
      const trimmedValue = valueString.length > 1000 ? valueString.slice(0, 1000) + '\u2026' : valueString;
      return <div className='m-1 ml-5' key={key}>
        <span style={{ fontWeight: 'bold' }} title={key}>{key}</span>
        {valueString && <CopyToClipboardContainer value={valueString}>: <span title={trimmedValue}>{linkifyText(trimmedValue)}</span></CopyToClipboardContainer>}
      </div>;
    })}
  </div>;
};

const GitCommitInfoView: React.FC<{ info: GitCommitInfo }> = ({ info }) => {
  const email = info['revision.email'] ? ` <${info['revision.email']}>` : '';
  const author = `${info['revision.author'] || ''}${email}`;
  const shortTimestamp = Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(info['revision.timestamp']);
  const longTimestamp = Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(info['revision.timestamp']);
  return <div className='hbox pl-4 pr-2 git-commit-info' style={{ alignItems: 'center' }}>
    <div className='vbox'>
      <a className='m-2' href={info['revision.link']} target='_blank' rel='noopener noreferrer'>
        <span title={info['revision.subject'] || ''}>{info['revision.subject'] || ''}</span>
      </a>
      <div className='hbox m-2 mt-1'>
        <div className='mr-1'>{author}</div>
        <div title={longTimestamp}> on {shortTimestamp}</div>
        {info['ci.link'] && <><span className='mx-2'>·</span><a href={info['ci.link']} target='_blank' rel='noopener noreferrer' title='CI/CD logs'>logs</a></>}
      </div>
    </div>
    {!!info['revision.link'] && <a href={info['revision.link']} target='_blank' rel='noopener noreferrer'>
      <span title='View commit details'>{info['revision.id']?.slice(0, 7) || 'unknown'}</span>
    </a>}
    {!info['revision.link'] && !!info['revision.id'] && <span>{info['revision.id'].slice(0, 7)}</span>}
  </div>;
};
