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

export function navigate(href: string | URL) {
  window.history.pushState({}, '', href);
  const navEvent = new PopStateEvent('popstate');
  window.dispatchEvent(navEvent);
}

export const Route: React.FunctionComponent<{
  predicate: (params: URLSearchParams) => boolean,
  children: any
}> = ({ predicate, children }) => {
  const searchParams = React.useContext(SearchParamsContext);
  return predicate(searchParams) ? children : null;
};

export type LinkProps = React.PropsWithChildren<{
  href?: string,
  click?: string,
  ctrlClick?: string,
  className?: string,
  title?: string,
}>;

export const Link: React.FunctionComponent<LinkProps> = ({ click, ctrlClick, children, ...rest }) => {
  return <a {...rest} style={{ textDecoration: 'none', color: 'var(--color-fg-default)', cursor: 'pointer' }} onClick={e => {
    if (click) {
      e.preventDefault();
      navigate(e.metaKey || e.ctrlKey ? ctrlClick || click : click);
    }
  }}>{children}</a>;
};

export const SearchParamsContext = React.createContext<URLSearchParams>(new URLSearchParams(window.location.hash.slice(1)));

export const SearchParamsProvider: React.FunctionComponent<React.PropsWithChildren> = ({ children }) => {
  const [searchParams, setSearchParams] = React.useState<URLSearchParams>(new URLSearchParams(window.location.hash.slice(1)));

  React.useEffect(() => {
    const listener = () => setSearchParams(new URLSearchParams(window.location.hash.slice(1)));
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);

  return <SearchParamsContext.Provider value={searchParams}>{children}</SearchParamsContext.Provider>;
};
