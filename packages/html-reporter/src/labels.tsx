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
import { clsx } from '@web/uiUtils';
import { hashStringToInt } from './utils';
import { navigate, ProjectLink, SearchParamsContext } from './links';
import { filterWithQuery } from './filter';
import './labels.css';

export const Label: React.FC<{
  label: string,
  trimAtSymbolPrefix?: boolean,
  href?: string,
  onClick?: (e: React.MouseEvent, label: string) => void,
  colorIndex?: number,
}> = ({ label, href, onClick, colorIndex, trimAtSymbolPrefix }) => {
  const baseLabel = <span className={clsx('label', 'label-color-' + (colorIndex !== undefined ? colorIndex : hashStringToInt(label)))} onClick={onClick ? e => onClick(e, label) : undefined}>
    {trimAtSymbolPrefix && label.startsWith('@') ? label.slice(1) : label}
  </span>;

  return href
    ? <a className='label-anchor' href={href}>{baseLabel}</a>
    : baseLabel;
};

export const ProjectAndTagLabelsView: React.FC<{
  projectNames: string[],
  activeProjectName: string,
  otherLabels: string[],
  useLinks?: boolean,
  style?: React.CSSProperties,
}> = ({ projectNames, activeProjectName, otherLabels, useLinks, style }) => {
  return (projectNames.length > 0 || otherLabels.length > 0) && <span className='label-row' style={style ?? {}}>
    <ProjectLink projectNames={projectNames} projectName={activeProjectName} />
    {!!useLinks ? <LabelsLinkView labels={otherLabels} /> : <LabelsClickView labels={otherLabels} />}
  </span>;
};

const LabelsClickView: React.FC<{
  labels: string[],
}> = ({ labels }) => {
  const searchParams = React.useContext(SearchParamsContext);

  const onClickHandle = React.useCallback((e: React.MouseEvent, label: string) => {
    e.preventDefault();
    const q = searchParams.get('q')?.toString() || '';
    navigate(filterWithQuery(q, label, e.metaKey || e.ctrlKey));
  }, [searchParams]);

  return <>
    {labels.map(label => <Label key={label} label={label} trimAtSymbolPrefix={true} onClick={onClickHandle} />)}
  </>;
};

const LabelsLinkView: React.FC<{
  labels: string[],
}> = ({ labels }) => <>
  {labels.map((label, index) => <Label key={index} label={label} trimAtSymbolPrefix={true} href={`#?q=${label}`} />)}
</>;
