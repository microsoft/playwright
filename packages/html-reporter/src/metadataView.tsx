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
import * as icons from './icons';
import { AutoChip } from './chip';
import './reportView.css';
import './theme.css';

export type Metainfo = {
  'revision.id'?: string;
  'revision.author'?: string;
  'revision.email'?: string;
  'revision.subject'?: string;
  'revision.timestamp'?: number | Date;
  'revision.link'?: string;
  'ci.link'?: string;
  'timestamp'?: number
};

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
        <AutoChip header={'Commit Metainfo Error'} dataTestId='metadata-error'>
          <p>An error was encountered when trying to render Commit Metainfo. Please file a GitHub issue to report this error.</p>
          <p>
            <pre style={{ overflow: 'scroll' }}>{this.state.error?.message}<br/>{this.state.error?.stack}<br/>{this.state.errorInfo?.componentStack}</pre>
          </p>
        </AutoChip>
      );
    }

    return this.props.children;
  }
}

export const MetadataView: React.FC<Metainfo> = metadata => <ErrorBoundary><InnerMetadataView {...metadata} /></ErrorBoundary>;

const InnerMetadataView: React.FC<Metainfo> = metadata => {
  if (!Object.keys(metadata).find(k => k.startsWith('revision.') || k.startsWith('ci.')))
    return null;

  return (
    <AutoChip header={
      <span>
        {metadata['revision.id'] && <span style={{ float: 'right' }}>
          {metadata['revision.id'].slice(0, 7)}
        </span>}
        {metadata['revision.subject'] || 'Commit Metainfo'}
      </span>} initialExpanded={false} dataTestId='metadata-chip'>
      {metadata['revision.subject'] &&
        <MetadataViewItem
          testId='revision.subject'
          content={<span>{metadata['revision.subject']}</span>}
        />
      }
      {metadata['revision.id'] &&
        <MetadataViewItem
          testId='revision.id'
          content={<span>{metadata['revision.id']}</span>}
          href={metadata['revision.link']}
          icon='commit'
        />
      }
      {(metadata['revision.author'] || metadata['revision.email']) &&
        <MetadataViewItem
          content={`${metadata['revision.author']} ${metadata['revision.email']}`}
          icon='person'
        />
      }
      {metadata['revision.timestamp'] &&
        <MetadataViewItem
          testId='revision.timestamp'
          content={
            <>
              {Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(metadata['revision.timestamp'])}
              {' '}
              {Intl.DateTimeFormat(undefined, { timeStyle: 'long' }).format(metadata['revision.timestamp'])}
            </>
          }
          icon='calendar'
        />
      }
      {metadata['ci.link'] &&
        <MetadataViewItem
          content='CI/CD Logs'
          href={metadata['ci.link']}
          icon='externalLink'
        />
      }
      {metadata['timestamp'] &&
        <MetadataViewItem
          content={<span style={{ color: 'var(--color-fg-subtle)' }}>
            Report generated on {Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(metadata['timestamp'])}
          </span>}></MetadataViewItem>
      }
    </AutoChip>
  );
};

const MetadataViewItem: React.FC<{ content: JSX.Element | string; icon?: keyof typeof icons, href?: string, testId?: string }> = ({ content, icon, href, testId }) => {
  return (
    <div className='my-1 hbox' data-testid={testId} >
      <div className='mr-2'>
        {icons[icon || 'blank']()}
      </div>
      <div style={{ flex: 1 }}>
        {href ? <a href={href} target='_blank' rel='noopener noreferrer'>{content}</a> : content}
      </div>
    </div>
  );
};
