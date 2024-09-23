/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import './attachmentsTab.css';
import { ImageDiffView } from '@web/shared/imageDiffView';
import type { MultiTraceModel } from './modelUtil';
import { PlaceholderPanel } from './placeholderPanel';
import type { AfterActionTraceEventAttachment } from '@trace/trace';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import { isTextualMimeType } from '@isomorphic/mimeType';
import { Expandable } from '@web/components/expandable';
import { linkifyText } from '@web/renderUtils';

type Attachment = AfterActionTraceEventAttachment & { traceUrl: string };

type ExpandableAttachmentProps = {
  attachment: Attachment;
};

const ExpandableAttachment: React.FunctionComponent<ExpandableAttachmentProps> = ({ attachment }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [attachmentText, setAttachmentText] = React.useState<string | null>(null);
  const [placeholder, setPlaceholder] = React.useState<string | null>(null);

  const isTextAttachment = isTextualMimeType(attachment.contentType);
  const hasContent = !!attachment.sha1 || !!attachment.path;

  React.useEffect(() => {
    if (expanded && attachmentText === null && placeholder === null) {
      setPlaceholder('Loading ...');
      fetch(attachmentURL(attachment)).then(response => response.text()).then(text => {
        setAttachmentText(text);
        setPlaceholder(null);
      }).catch(e => {
        setPlaceholder('Failed to load: ' + e.message);
      });
    }
  }, [expanded, attachmentText, placeholder, attachment]);

  const title = <span style={{ marginLeft: 5 }}>
    {linkifyText(attachment.name)} {hasContent && <a style={{ marginLeft: 5 }} href={downloadURL(attachment)}>download</a>}
  </span>;

  if (!isTextAttachment || !hasContent)
    return <div style={{ marginLeft: 20 }}>{title}</div>;

  return <>
    <Expandable title={title} expanded={expanded} setExpanded={setExpanded} expandOnTitleClick={true}>
      {placeholder && <i>{placeholder}</i>}
    </Expandable>
    {expanded && attachmentText !== null && <CodeMirrorWrapper
      text={attachmentText}
      readOnly
      mimeType={attachment.contentType}
      linkify={true}
      lineNumbers={true}
      wrapLines={false}>
    </CodeMirrorWrapper>}
  </>;
};

export const AttachmentsTab: React.FunctionComponent<{
  model: MultiTraceModel | undefined,
}> = ({ model }) => {
  const { diffMap, screenshots, attachments } = React.useMemo(() => {
    const attachments = new Set<Attachment>();
    const screenshots = new Set<Attachment>();

    for (const action of model?.actions || []) {
      const traceUrl = action.context.traceUrl;
      for (const attachment of action.attachments || [])
        attachments.add({ ...attachment, traceUrl });
    }
    const diffMap = new Map<string, { expected: Attachment | undefined, actual: Attachment | undefined, diff: Attachment | undefined }>();

    for (const attachment of attachments) {
      if (!attachment.path && !attachment.sha1)
        continue;
      const match = attachment.name.match(/^(.*)-(expected|actual|diff)\.png$/);
      if (match) {
        const name = match[1];
        const type = match[2] as 'expected' | 'actual' | 'diff';
        const entry = diffMap.get(name) || { expected: undefined, actual: undefined, diff: undefined };
        entry[type] = attachment;
        diffMap.set(name, entry);
        attachments.delete(attachment);
      } else if (attachment.contentType.startsWith('image/')) {
        screenshots.add(attachment);
        attachments.delete(attachment);
      }
    }
    return { diffMap, attachments, screenshots };
  }, [model]);

  if (!diffMap.size && !screenshots.size && !attachments.size)
    return <PlaceholderPanel text='No attachments' />;

  return <div className='attachments-tab'>
    {[...diffMap.values()].map(({ expected, actual, diff }) => {
      return <>
        {expected && actual && <div className='attachments-section'>Image diff</div>}
        {expected && actual && <ImageDiffView noTargetBlank={true} diff={{
          name: 'Image diff',
          expected: { attachment: { ...expected, path: downloadURL(expected) }, title: 'Expected' },
          actual: { attachment: { ...actual, path: downloadURL(actual) } },
          diff: diff ? { attachment: { ...diff, path: downloadURL(diff) } } : undefined,
        }} />}
      </>;
    })}
    {screenshots.size ? <div className='attachments-section'>Screenshots</div> : undefined}
    {[...screenshots.values()].map((a, i) => {
      const url = attachmentURL(a);
      return <div className='attachment-item' key={`screenshot-${i}`}>
        <div><img draggable='false' src={url} /></div>
        <div><a target='_blank' href={url} rel='noreferrer'>{a.name}</a></div>
      </div>;
    })}
    {attachments.size ? <div className='attachments-section'>Attachments</div> : undefined}
    {[...attachments.values()].map((a, i) => {
      return <div className='attachment-item' key={attachmentKey(a, i)}>
        <ExpandableAttachment attachment={a} />
      </div>;
    })}
  </div>;
};

function attachmentURL(attachment: Attachment, queryParams: Record<string, string> = {}) {
  const params = new URLSearchParams(queryParams);
  if (attachment.sha1) {
    params.set('trace', attachment.traceUrl);
    return 'sha1/' + attachment.sha1 + '?' + params.toString();
  }
  params.set('path', attachment.path!);
  return 'file?' + params.toString();
}

function downloadURL(attachment: Attachment) {
  const params = { dn: attachment.name } as Record<string, string>;
  if (attachment.contentType)
    params.dct = attachment.contentType;
  return attachmentURL(attachment, params);
}

function attachmentKey(attachment: Attachment, index: number) {
  return index + '-' + (attachment.sha1 ? `sha1-` + attachment.sha1 : `path-` + attachment.path);
}
