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
import * as icons from './icons';
import './copyToClipboard.css';

type CopyToClipboardProps = {
  value: string;
};

/**
 * A copy to clipboard button.
 */
export const CopyToClipboard: React.FunctionComponent<CopyToClipboardProps> = ({ value }) => {
  type IconType = 'copy' | 'check' | 'cross';
  const [icon, setIcon] = React.useState<IconType>('copy');

  React.useEffect(() => {
    setIcon('copy');
  }, [value]);

  React.useEffect(() => {
    if (icon === 'check') {
      const timeout = setTimeout(() => {
        setIcon('copy');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [icon]);

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setIcon('check');
    }, () => {
      setIcon('cross');
    });
  }, [value]);
  const iconElement = icon === 'check' ? icons.check() : icon === 'cross' ? icons.cross() : icons.copy();
  return <button className='copy-icon' title='Copy to clipboard' aria-label='Copy to clipboard' onClick={handleCopy}>{iconElement}</button>;
};
