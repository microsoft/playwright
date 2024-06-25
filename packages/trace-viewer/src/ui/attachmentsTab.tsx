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


type Attachment = AfterActionTraceEventAttachment & { traceUrl: string };

type TextAttachmentProps = {
  attachment: Attachment;
  label?: string;
};

const TextAttachment: React.FunctionComponent<TextAttachmentProps> = ({ attachment, label }) => {
  const [text, setText] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    fetch(attachmentURL(attachment)).then(response => response.text()).then(text => {
      if (isMounted)
        setText(text);
    });
    return () => {
      isMounted = false;
    };
  }, [attachment]);
  return <div aria-label={label}>
    {
      text ?
        <CodeMirrorWrapper text={text} readOnly wrapLines={false}></CodeMirrorWrapper> :
        <div><i>Loading...</i></div>
    }
  </div>;
};

const ExpandableAttachment: React.FunctionComponent<{ attachment: Attachment }> = ({ attachment }) => {
  const [expanded, setExpanded] = React.useState(false);
  return <Expandable title={
    <a href={attachmentURL(attachment) + '&download'}>{attachment.name}</a>
  } expanded={expanded} setExpanded={exp => setExpanded(exp)}>
    {isTextualMimeType(attachment.contentType) ?
      <TextAttachment attachment={attachment} label={attachment.name} /> :
      <div><i>no preview available</i></div>
    }
  </Expandable>;
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
      }
      if (attachment.contentType.startsWith('image/')) {
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
        {expected && actual && <ImageDiffView diff={{
          name: 'Image diff',
          expected: { attachment: { ...expected, path: attachmentURL(expected) }, title: 'Expected' },
          actual: { attachment: { ...actual, path: attachmentURL(actual) } },
          diff: diff ? { attachment: { ...diff, path: attachmentURL(diff) } } : undefined,
        }} />}
      </>;
    })}
    {screenshots.size ? <div className='attachments-section'>Screenshots</div> : undefined}
    {[...screenshots.values()].map((a, i) => {
      const url = attachmentURL(a);
      return <div className='attachment-item' key={`screenshot-${i}`}>
        <div><img draggable='false' src={url} /></div>
        <div><a target='_blank' href={url}>{a.name}</a></div>
      </div>;
    })}
    {attachments.size ? <div className='attachments-section'>Attachments</div> : undefined}
    {[...attachments.values()].map((a, i) => {
      return <>
        { i > 0 && <hr /> }
        <div className='attachment-item' key={`attachment-${i}`}>
          <ExpandableAttachment attachment={a} />
        </div>
      </>;
    })}
  </div>;
};

function attachmentURL(attachment: Attachment) {
  if (attachment.sha1)
    return 'sha1/' + attachment.sha1 + '?trace=' + encodeURIComponent(attachment.traceUrl);
  return 'file?path=' + encodeURIComponent(attachment.path!);
}
