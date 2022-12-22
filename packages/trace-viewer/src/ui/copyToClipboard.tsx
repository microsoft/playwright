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
import './copyToClipboard.css';

const TIMEOUT = 3000;
const DEFAULT_ICON = 'codicon-clippy';
const COPIED_ICON = 'codicon-check';
const FAILED_ICON = 'codicon-close';

export const CopyToClipboard: React.FunctionComponent<{
  value: string,
}> = ({ value }) => {
  const [iconClassName, setIconClassName] = React.useState(DEFAULT_ICON);

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setIconClassName(COPIED_ICON);
      setTimeout(() => {
        setIconClassName(DEFAULT_ICON);
      }, TIMEOUT);
    }, () => {
      setIconClassName(FAILED_ICON);
    });

  }, [value]);

  return <span className={`codicon ${iconClassName}`} onClick={handleCopy}/>;
};
