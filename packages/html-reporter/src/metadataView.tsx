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
import type { CIInfo, GitCommitInfo, MetadataWithCommitInfo } from '@testIsomorphic/types';
import { CopyToClipboardContainer } from './copyToClipboard';
import { linkifyText } from '@web/renderUtils';
import { SearchParamsContext } from './links';

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

export const MetadataView: React.FC<{ metadata: Metadata }> = params => {
  return <ErrorBoundary><InnerMetadataView metadata={params.metadata}/></ErrorBoundary>;
};

const InnerMetadataView: React.FC<{ metadata: Metadata }> = params => {
  const searchParams = React.useContext(SearchParamsContext);
  const commitInfo = params.metadata as MetadataWithCommitInfo;
  const otherEntries = searchParams.has('show-metadata-other') ? Object.entries(params.metadata).filter(([key]) => !ignoreKeys.has(key)) : [];
  const hasMetadata = commitInfo.ci || commitInfo.gitCommit || otherEntries.length > 0;
  if (!hasMetadata)
    return;
  return <div className='metadata-view'>
    {commitInfo.ci && !commitInfo.gitCommit && <CiInfoView info={commitInfo.ci}/>}
    {commitInfo.gitCommit && <GitCommitInfoView ci={commitInfo.ci} commit={commitInfo.gitCommit}/>}
    {otherEntries.length > 0 && (commitInfo.gitCommit || commitInfo.ci) && <div className='metadata-separator' />}
    <div className='metadata-section metadata-properties' role='list'>
      {otherEntries.map(([propertyName, value]) => {
        const valueString = typeof value !== 'object' || value === null || value === undefined ? String(value) : JSON.stringify(value);
        const trimmedValue = valueString.length > 1000 ? valueString.slice(0, 1000) + '\u2026' : valueString;
        return (
          <div key={propertyName} className='copyable-property' role='listitem'>
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

const CiInfoView: React.FC<{ info: CIInfo }> = ({ info }) => {
  const title = info.prTitle || `Commit ${info.commitHash}`;
  const link = info.prHref || info.commitHref;
  return <div className='metadata-section' role='list'>
    <div role='listitem'>
      <a href={link} target='_blank' rel='noopener noreferrer' title={title}>{title}</a>
    </div>
  </div>;
};

const GitCommitInfoView: React.FC<{ ci?: CIInfo, commit: GitCommitInfo }> = ({ ci, commit }) => {
  const title = ci?.prTitle || commit.subject;
  const link = ci?.prHref || ci?.commitHref;
  const email = ` <${commit.author.email}>`;
  const author = `${commit.author.name}${email}`;
  const shortTimestamp = Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(commit.committer.time);
  const longTimestamp = Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(commit.committer.time);

  return <div className='metadata-section' role='list'>
    <div role='listitem'>
      {link && <a href={link} target='_blank' rel='noopener noreferrer' title={title}>{title}</a>}
      {!link && <span title={title}>{title}</span>}
    </div>
    <div role='listitem' className='hbox'>
      <span className='mr-1'>{author}</span>
      <span title={longTimestamp}> on {shortTimestamp}</span>
    </div>
  </div>;
};

const ignoreKeys = new Set(['ci', 'gitCommit', 'gitDiff', 'actualWorkers']);

export const isMetadataEmpty = (metadata: MetadataWithCommitInfo): boolean => {
  const otherEntries = Object.entries(metadata).filter(([key]) => !ignoreKeys.has(key));
  return !metadata.ci && !metadata.gitCommit && !otherEntries.length;
};
