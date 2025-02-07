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

import './colors.css';
import './common.css';

export const search = () => {
  return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon subnav-search-icon'>
    <path fillRule='evenodd' d='M11.5 7a4.499 4.499 0 11-8.998 0A4.499 4.499 0 0111.5 7zm-.82 4.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04z'></path>
  </svg>;
};

export const downArrow = () => {
  return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' className='octicon color-fg-muted'>
    <path fillRule='evenodd' d='M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z'></path>
  </svg>;
};

export const rightArrow = () => {
  return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-fg-muted'>
    <path fillRule='evenodd' d='M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z'></path>
  </svg>;
};

export const warning = () => {
  return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-text-warning'>
    <path fillRule='evenodd' d='M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z'></path>
  </svg>;
};

export const attachment = () => {
  return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-fg-muted'>
    <path fillRule='evenodd' d='M3.5 1.75a.25.25 0 01.25-.25h3a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h2.086a.25.25 0 01.177.073l2.914 2.914a.25.25 0 01.073.177v8.586a.25.25 0 01-.25.25h-.5a.75.75 0 000 1.5h.5A1.75 1.75 0 0014 13.25V4.664c0-.464-.184-.909-.513-1.237L10.573.513A1.75 1.75 0 009.336 0H3.75A1.75 1.75 0 002 1.75v11.5c0 .649.353 1.214.874 1.515a.75.75 0 10.752-1.298.25.25 0 01-.126-.217V1.75zM8.75 3a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h-.5zM6 5.25a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5A.75.75 0 016 5.25zm2 1.5A.75.75 0 018.75 6h.5a.75.75 0 010 1.5h-.5A.75.75 0 018 6.75zm-1.25.75a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h-.5zM8 9.75A.75.75 0 018.75 9h.5a.75.75 0 010 1.5h-.5A.75.75 0 018 9.75zm-.75.75a1.75 1.75 0 00-1.75 1.75v3c0 .414.336.75.75.75h2.5a.75.75 0 00.75-.75v-3a1.75 1.75 0 00-1.75-1.75h-.5zM7 12.25a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v2.25H7v-2.25z'></path>
  </svg>;
};

export const cross = () => {
  return <svg className='octicon color-text-danger' viewBox='0 0 16 16' version='1.1' width='16' height='16' aria-hidden='true'>
    <path fillRule='evenodd' d='M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z'></path>
  </svg>;
};

export const check = () => {
  return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-icon-success'>
    <path fillRule='evenodd' d='M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z'></path>
  </svg>;
};

export const clock = () => {
  return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-text-danger'>
    <path fillRule='evenodd' d='M5.75.75A.75.75 0 016.5 0h3a.75.75 0 010 1.5h-.75v1l-.001.041a6.718 6.718 0 013.464 1.435l.007-.006.75-.75a.75.75 0 111.06 1.06l-.75.75-.006.007a6.75 6.75 0 11-10.548 0L2.72 5.03l-.75-.75a.75.75 0 011.06-1.06l.75.75.007.006A6.718 6.718 0 017.25 2.541a.756.756 0 010-.041v-1H6.5a.75.75 0 01-.75-.75zM8 14.5A5.25 5.25 0 108 4a5.25 5.25 0 000 10.5zm.389-6.7l1.33-1.33a.75.75 0 111.061 1.06L9.45 8.861A1.502 1.502 0 018 10.75a1.5 1.5 0 11.389-2.95z'></path>
  </svg>;
};

export const blank = () => {
  return <svg className='octicon' viewBox='0 0 16 16' version='1.1' width='16' height='16' aria-hidden='true'></svg>;
};

export const image = () => {
  return <svg className='octicon' viewBox='0 0 48 48' version='1.1' width='20' height='20' aria-hidden='true'>
    <path xmlns='http://www.w3.org/2000/svg' d='M11.85 32H36.2l-7.35-9.95-6.55 8.7-4.6-6.45ZM7 40q-1.2 0-2.1-.9Q4 38.2 4 37V11q0-1.2.9-2.1Q5.8 8 7 8h34q1.2 0 2.1.9.9.9.9 2.1v26q0 1.2-.9 2.1-.9.9-2.1.9Zm0-29v26-26Zm34 26V11H7v26Z'/>
  </svg>;
};

export const video = () => {
  return <svg className='octicon' viewBox='0 0 48 48' version='1.1' width='20' height='20' aria-hidden='true'>
    <path xmlns='http://www.w3.org/2000/svg' d='m19.6 32.35 13-8.45-13-8.45ZM7 40q-1.2 0-2.1-.9Q4 38.2 4 37V11q0-1.2.9-2.1Q5.8 8 7 8h34q1.2 0 2.1.9.9.9.9 2.1v26q0 1.2-.9 2.1-.9.9-2.1.9Zm0-3h34V11H7v26Zm0 0V11v26Z'/>
  </svg>;
};

export const trace = () => {
  return <svg className='octicon' viewBox='0 0 48 48' version='1.1' width='20' height='20' aria-hidden='true'>
    <path xmlns='http://www.w3.org/2000/svg' d='M7 37h9.35V11H7v26Zm12.35 0h9.3V11h-9.3v26Zm12.3 0H41V11h-9.35v26ZM7 40q-1.2 0-2.1-.9Q4 38.2 4 37V11q0-1.2.9-2.1Q5.8 8 7 8h34q1.2 0 2.1.9.9.9.9 2.1v26q0 1.2-.9 2.1-.9.9-2.1.9Z'/>
  </svg>;
};

export const empty = () => {
  return <svg className='octicon' viewBox='0 0 16 16' version='1.1' width='16' height='16' aria-hidden='true'></svg>;
};

export const copy = () => {
  return <svg className='octicon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true'>
    <path d='M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z'></path>
    <path d='M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z'></path>
  </svg>;
};

export const copilot = () => {
  return <svg className='octicon' viewBox='0 0 48 48' version='1.1' width='20' height='20' aria-hidden='true'>
    <path d='M47.801 34.003c-1.72 2.988-11.706 10.037-23.82 10.037S1.881 36.991.161 34.003a1.309 1.309 0 0 1-.161-.57v-5.615c.012-.17.047-.338.11-.498.744-1.867 2.692-4.58 5.206-5.308.333-.855.826-2.106 1.287-3.029a20.112 20.112 0 0 1-.104-2.171c0-2.659.563-4.992 2.262-6.729.793-.811 1.777-1.433 2.945-1.901C14.502 5.911 18.483 4 23.938 4c5.455 0 9.523 1.911 12.319 4.182 1.167.468 2.151 1.09 2.944 1.901 1.699 1.737 2.263 4.07 2.263 6.729 0 .736-.027 1.465-.105 2.171.461.923.954 2.174 1.288 3.029 2.513.728 4.461 3.441 5.205 5.308.081.205.115.424.115.645v5.318c0 .252-.04.502-.166.72ZM24.325 22.031h-.688a8.52 8.52 0 0 1-.709 1.016c-1.537 1.892-3.833 2.98-7.008 2.98-3.447 0-5.972-.717-7.557-2.514a4.408 4.408 0 0 1-.171-.21l-.195.21v13.155c2.867 1.558 9.02 4.353 15.984 4.353s13.117-2.795 15.984-4.353V23.513l-.195-.21s-.066.091-.171.21c-1.584 1.797-4.11 2.514-7.557 2.514-3.175 0-5.47-1.088-7.008-2.98a8.637 8.637 0 0 1-.709-1.016h-.033.033Zm-1.969-5.864a14.31 14.31 0 0 0 .127-1.785v-.042c-.003-1.537-.339-2.538-.876-3.152-.681-.78-2.09-1.378-5.06-1.057-3.008.326-4.69 1.073-5.643 2.048-.923.944-1.408 2.356-1.408 4.633 0 2.42.348 3.849 1.115 4.719.729.827 2.165 1.499 5.309 1.499 2.417 0 3.799-.786 4.683-1.873.948-1.168 1.482-2.878 1.753-4.99Zm3.25 0c.271 2.112.805 3.822 1.754 4.99.883 1.087 2.265 1.873 4.682 1.873 3.145 0 4.58-.672 5.309-1.499.767-.87 1.116-2.299 1.116-4.719 0-2.277-.485-3.689-1.408-4.633-.954-.975-2.635-1.722-5.644-2.048-2.969-.321-4.378.277-5.06 1.057-.537.614-.873 1.615-.876 3.152v.042c.002.53.042 1.123.127 1.785Z'/><path d='M28.998 28.516c1.104 0 1.999.895 1.999 1.999v3.998a2 2 0 1 1-3.998 0v-3.998c0-1.104.895-1.999 1.999-1.999Zm-9.996 0c1.104 0 1.999.895 1.999 1.999v3.998a2 2 0 1 1-3.998 0v-3.998c0-1.104.895-1.999 1.999-1.999Z'/>
  </svg>;
};
