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
import { ToolbarButton } from '@web/components/toolbarButton';
import './copyToClipboard.css';

export const CopyToClipboard: React.FunctionComponent<{
  value: string | (() => Promise<string>),
  description?: string,
}> = ({ value, description }) => {
  const [icon, setIcon] = React.useState('copy');

  const handleCopy = React.useCallback(() => {
    const valuePromise = typeof value === 'function' ? value() : Promise.resolve(value);
    valuePromise.then(value => {
      navigator.clipboard.writeText(value).then(() => {
        setIcon('check');
        setTimeout(() => {
          setIcon('copy');
        }, 3000);
      }, () => {
        setIcon('close');
      });
    }, () => {
      setIcon('close');
    });

  }, [value]);
  return <ToolbarButton title={description ? description : 'Copy'} icon={icon} onClick={handleCopy}/>;
};

export const CopyToClipboardTextButton: React.FunctionComponent<{
  value: string | (() => Promise<string>),
  description: string,
  copiedDescription?: React.ReactNode,
  style?: React.CSSProperties,
}> = ({ value, description, copiedDescription = description, style }) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    const valueToCopy = typeof value === 'function' ? await value() : value;
    await navigator.clipboard.writeText(valueToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }, [value]);

  return <ToolbarButton style={style} title={description} onClick={handleCopy} className='copy-to-clipboard-text-button'>{copied ? copiedDescription : description}</ToolbarButton>;
};
