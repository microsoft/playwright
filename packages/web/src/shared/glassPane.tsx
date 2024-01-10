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

import React from 'react';

export const GlassPane: React.FC<{
  cursor: string;
  onPaneMouseMove?: (e: MouseEvent) => void;
  onPaneMouseUp?: (e: MouseEvent) => void;
  onPaneDoubleClick?: (e: MouseEvent) => void;
}> = ({ cursor, onPaneMouseMove, onPaneMouseUp, onPaneDoubleClick }) => {
  React.useEffect(() => {
    const glassPaneDiv = document.createElement('div');
    glassPaneDiv.style.position = 'fixed';
    glassPaneDiv.style.top = '0';
    glassPaneDiv.style.right = '0';
    glassPaneDiv.style.bottom = '0';
    glassPaneDiv.style.left = '0';
    glassPaneDiv.style.zIndex = '9999';
    glassPaneDiv.style.cursor = cursor;

    document.body.appendChild(glassPaneDiv);

    if (onPaneMouseMove)
      glassPaneDiv.addEventListener('mousemove', onPaneMouseMove);
    if (onPaneMouseUp)
      glassPaneDiv.addEventListener('mouseup', onPaneMouseUp);
    if (onPaneDoubleClick)
      document.body.addEventListener('dblclick', onPaneDoubleClick);

    return () => {
      if (onPaneMouseMove)
        glassPaneDiv.removeEventListener('mousemove', onPaneMouseMove);
      if (onPaneMouseUp)
        glassPaneDiv.removeEventListener('mouseup', onPaneMouseUp);
      if (onPaneDoubleClick)
        document.body.removeEventListener('dblclick', onPaneDoubleClick);
      document.body.removeChild(glassPaneDiv);
    };
  }, [cursor, onPaneMouseMove, onPaneMouseUp, onPaneDoubleClick]);

  return <></>;
};
