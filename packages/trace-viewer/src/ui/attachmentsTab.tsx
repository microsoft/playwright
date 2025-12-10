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
import { PlaceholderPanel } from './placeholderPanel';
import { CodeMirrorWrapper, lineHeight } from '@web/components/codeMirrorWrapper';
import { isTextualMimeType } from '@isomorphic/mimeType';
import { Expandable } from '@web/components/expandable';
import { linkifyText } from '@web/renderUtils';
import { clsx, useFlash } from '@web/uiUtils';
import { useTraceModel } from './traceModelContext';

import type { Attachment, TraceModel } from '@isomorphic/trace/traceModel';

type ExpandableAttachmentProps = {
  attachment: Attachment;
  reveal: any;
};

const ExpandableAttachment: React.FunctionComponent<ExpandableAttachmentProps> = ({ attachment, reveal }) => {
  const model = useTraceModel();
  const [expanded, setExpanded] = React.useState(false);
  const [attachmentText, setAttachmentText] = React.useState<string | null>(null);
  const [placeholder, setPlaceholder] = React.useState<string | null>(null);
  const [flash, triggerFlash] = useFlash();
  const ref = React.useRef<HTMLSpanElement>(null);

  const isTextAttachment = isTextualMimeType(attachment.contentType);
  const hasContent = !!attachment.sha1 || !!attachment.path;

  React.useEffect(() => {
    if (reveal) {
      ref.current?.scrollIntoView({ behavior: 'smooth' });
      return triggerFlash();
    }
  }, [reveal, triggerFlash]);

  React.useEffect(() => {
    if (expanded && attachmentText === null && placeholder === null) {
      setPlaceholder('Loading ...');
      fetch(attachmentURL(model, attachment)).then(response => response.text()).then(text => {
        setAttachmentText(text);
        setPlaceholder(null);
      }).catch(e => {
        setPlaceholder('Failed to load: ' + e.message);
      });
    }
  }, [model, expanded, attachmentText, placeholder, attachment]);

  const snippetHeight = React.useMemo(() => {
    const lineCount = attachmentText ? attachmentText.split('\n').length : 0;
    return Math.min(Math.max(5, lineCount), 20) * lineHeight;
  }, [attachmentText]);

  const title = <span style={{ marginLeft: 5 }} ref={ref} aria-label={attachment.name}>
    <span>{linkifyText(attachment.name)}</span>
    {hasContent && <a style={{ marginLeft: 5 }} href={downloadURL(model, attachment)}>download</a>}
  </span>;

  if (!isTextAttachment || !hasContent)
    return <div style={{ marginLeft: 20 }}>{title}</div>;

  return <div className={clsx(flash && 'yellow-flash')}>
    <Expandable title={title} expanded={expanded} setExpanded={setExpanded} expandOnTitleClick={true}>
      {placeholder && <i>{placeholder}</i>}
    </Expandable>
    {expanded && attachmentText !== null && <div className='vbox' style={{ height: snippetHeight }}>
      <CodeMirrorWrapper
        text={attachmentText}
        readOnly
        mimeType={attachment.contentType}
        linkify={true}
        lineNumbers={true}
        wrapLines={false}>
      </CodeMirrorWrapper>
    </div>}
  </div>;
};

export const AttachmentsTab: React.FunctionComponent<{
  revealedAttachmentCallId?: { callId: string },
}> = ({ revealedAttachmentCallId }) => {
  const model = useTraceModel();
  const { diffMap, screenshots, attachments } = React.useMemo(() => {
    const attachments = new Set(model?.visibleAttachments ?? []);
    const screenshots = new Set<Attachment>();
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
          expected: { attachment: { ...expected, path: downloadURL(model, expected) }, title: 'Expected' },
          actual: { attachment: { ...actual, path: downloadURL(model, actual) } },
          diff: diff ? { attachment: { ...diff, path: downloadURL(model, diff) } } : undefined,
        }} />}
      </>;
    })}
    {screenshots.size ? <div className='attachments-section'>Screenshots</div> : undefined}
    {[...screenshots.values()].map((a, i) => {
      const url = attachmentURL(model, a);
      return <div className='attachment-item' key={`screenshot-${i}`}>
        <div><img draggable='false' src={url} /></div>
        <div><a target='_blank' href={url} rel='noreferrer'>{a.name}</a></div>
      </div>;
    })}
    {attachments.size ? <div className='attachments-section'>Attachments</div> : undefined}
    {[...attachments.values()].map((a, i) => {
      return <div className='attachment-item' key={attachmentKey(a, i)}>
        <ExpandableAttachment
          attachment={a}
          reveal={!!revealedAttachmentCallId && a.callId === revealedAttachmentCallId.callId ? revealedAttachmentCallId : undefined}
        />
      </div>;
    })}
  </div>;
};

export function attachmentURL(model: TraceModel | undefined, attachment: Attachment) {
  if (model && attachment.sha1)
    return model.createRelativeUrl(`sha1/${attachment.sha1}`) ;
  return `file?path=${encodeURIComponent(attachment.path!)}`;
}

function downloadURL(model: TraceModel | undefined, attachment: Attachment) {
  let suffix = attachment.contentType ? `&dn=${encodeURIComponent(attachment.name)}` : '';
  if (attachment.contentType)
    suffix += `&dct=${encodeURIComponent(attachment.contentType)}`;
  return attachmentURL(model, attachment) + suffix;
}

function attachmentKey(attachment: Attachment, index: number) {
  return index + '-' + (attachment.sha1 ? `sha1-` + attachment.sha1 : `path-` + attachment.path);
}
