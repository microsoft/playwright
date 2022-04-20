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
import type { Metadata } from './index';
import { AutoChip } from './chip';
import './reportView.css';
import './theme.css';

export const MetadataView: React.FC<Metadata> = metadata => {
  return (
    <AutoChip header={
      <span>
        {metadata['revision.id'] && <span style={{ float: 'right', fontFamily: 'var(--monospace-font)' }}>
          {metadata['revision.id'].slice(0, 7)}
        </span>}
        {metadata['revision.subject'] && metadata['revision.subject'] || 'no subject>'}
        {!metadata['revision.subject'] && 'Commit metainfo'}
      </span>} initialExpanded={false}>
      {metadata['revision.subject'] &&
        <MetadatViewItem
          testId='revision.subject'
          content={<span>{metadata['revision.subject']}</span>}
        />
      }
      {metadata['revision.id'] &&
        <MetadatViewItem
          testId='revision.id'
          content={<span style={{ fontFamily: 'var(--monospace-font)' }}>{metadata['revision.id']}</span>}
          href={metadata['revision.link']}
          icon='commit'
        />
      }
      {(metadata['revision.author'] || metadata['revision.email']) &&
        <MetadatViewItem
          content={`${metadata['revision.author']} ${metadata['revision.email']}`}
          icon='person'
        />
      }
      {metadata['revision.timestamp'] &&
        <MetadatViewItem
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
        <MetadatViewItem
          content='CI/CD Logs'
          href={metadata['ci.link']}
          icon='externalLink'
        />
      }
      {metadata['generatedAt'] &&
        <MetadatViewItem
          content={<span style={{ color: 'var(--color-fg-subtle)' }}>
            Report generated on {Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(metadata['generatedAt'])}
          </span>}></MetadatViewItem>
      }
    </AutoChip>
  );
};

const MetadatViewItem: React.FC<{ content: JSX.Element | string; icon?: keyof typeof icons, href?: string, testId?: string }> = ({ content, icon, href, testId }) => {
  return (
    <div className='my-1 hbox' data-test-id={testId} >
      <div className='mr-2'>
        {icons[icon || 'blank']()}
      </div>
      <div style={{ flex: 1 }}>
        {href ? <a href={href} target='_blank' rel='noopener noreferrer'>{content}</a> : content}
      </div>
    </div>
  );
};
