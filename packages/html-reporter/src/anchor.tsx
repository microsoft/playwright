/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import { SearchParamsContext } from './links';

export type AnchorID = string | string[] | ((id: string) => boolean) | undefined;

export function useAnchor(id: AnchorID, onReveal: React.EffectCallback) {
  const searchParams = React.useContext(SearchParamsContext);
  const isAnchored = useIsAnchored(id);
  React.useEffect(() => {
    if (isAnchored)
      return onReveal();
  }, [isAnchored, onReveal, searchParams]);
}

export function useIsAnchored(id: AnchorID) {
  const searchParams = React.useContext(SearchParamsContext);
  const anchor = searchParams.get('anchor');
  if (anchor === null)
    return false;
  if (typeof id === 'undefined')
    return false;
  if (typeof id === 'string')
    return id === anchor;
  if (Array.isArray(id))
    return id.includes(anchor);
  return id(anchor);
}

export function Anchor({ id, children }: React.PropsWithChildren<{ id: AnchorID }>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const onAnchorReveal = React.useCallback(() => {
    ref.current?.scrollIntoView({ block: 'start', inline: 'start' });
  }, []);
  useAnchor(id, onAnchorReveal);

  return <div ref={ref}>{children}</div>;
}
