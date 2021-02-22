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

import { Story, Meta } from '@storybook/react/types-6-0';
import React from 'react';
import { Toolbar, ToolbarProps } from './toolbar';
import { ToolbarButton } from './toolbarButton';

export default {
  title: 'Components/Toolbar',
  component: Toolbar,
} as Meta;

const Template: Story<ToolbarProps> = () => <Toolbar>
  <ToolbarButton icon='record' title='Record' onClick={() => {}}>Record</ToolbarButton>
  <ToolbarButton icon='question' title='Inspect' onClick={() => {}}>Explore</ToolbarButton>
  <ToolbarButton icon='files' title='Copy' onClick={() => {}}></ToolbarButton>
</Toolbar>;

export const Primary = Template.bind({});

const AllTemplate: Story = () => <Toolbar>
  {[
    'add', 'plus', 'gist-new', 'repo-create', 'lightbulb', 'light-bulb', 'repo', 'repo-delete', 'gist-fork', 'repo-forked',
    'git-pull-request', 'git-pull-request-abandoned', 'record-keys', 'keyboard', 'tag', 'tag-add', 'tag-remove', 'person',
    'person-add', 'person-follow', 'person-outline', 'person-filled', 'git-branch', 'git-branch-create',
    'git-branch-delete', 'source-control', 'mirror', 'mirror-public', 'star', 'star-add', 'star-delete', 'star-empty',
    'comment', 'comment-add', 'alert', 'warning', 'search', 'search-save', 'log-out', 'sign-out', 'log-in', 'sign-in',
    'eye', 'eye-unwatch', 'eye-watch', 'circle-filled', 'primitive-dot', 'close-dirty', 'debug-breakpoint',
    'debug-breakpoint-disabled', 'debug-hint', 'primitive-square', 'edit', 'pencil', 'info', 'issue-opened',
    'gist-private', 'git-fork-private', 'lock', 'mirror-private', 'close', 'remove-close', 'x', 'repo-sync',
    'sync', 'clone', 'desktop-download', 'beaker', 'microscope', 'vm', 'device-desktop', 'file', 'file-text', 'more',
    'ellipsis', 'kebab-horizontal', 'mail-reply', 'reply', 'organization', 'organization-filled', 'organization-outline',
    'new-file', 'file-add', 'new-folder', 'file-directory-create', 'trash', 'trashcan', 'history', 'clock', 'folder',
    'file-directory', 'symbol-folder', 'logo-github', 'mark-github', 'github', 'terminal', 'console', 'repl', 'zap',
    'symbol-event', 'error', 'stop', 'variable', 'symbol-variable', 'array', 'symbol-array', 'symbol-module',
    'symbol-package', 'symbol-namespace', 'symbol-object', 'symbol-method', 'symbol-function', 'symbol-constructor',
    'symbol-boolean', 'symbol-null', 'symbol-numeric', 'symbol-number', 'symbol-structure', 'symbol-struct', 'symbol-parameter',
    'symbol-type-parameter', 'symbol-key', 'symbol-text', 'symbol-reference', 'go-to-file', 'symbol-enum', 'symbol-value', 'symbol-ruler',
    'symbol-unit', 'activate-breakpoints', 'archive', 'arrow-both', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-small-down', 'arrow-small-left',
    'arrow-small-right', 'arrow-small-up', 'arrow-up', 'bell', 'bold', 'book', 'bookmark', 'debug-breakpoint-conditional-unverified',
    'debug-breakpoint-conditional', 'debug-breakpoint-conditional-disabled', 'debug-breakpoint-data-unverified', 'debug-breakpoint-data',
    'debug-breakpoint-data-disabled', 'debug-breakpoint-log-unverified', 'debug-breakpoint-log', 'debug-breakpoint-log-disabled', 'briefcase',
    'broadcast', 'browser', 'bug', 'calendar', 'case-sensitive', 'check', 'checklist', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up',
    'chrome-close', 'chrome-maximize', 'chrome-minimize', 'chrome-restore', 'circle-outline', 'debug-breakpoint-unverified', 'circle-slash',
    'circuit-board', 'clear-all', 'clippy', 'close-all', 'cloud-download', 'cloud-upload', 'code', 'collapse-all', 'color-mode', 'comment-discussion',
    'compare-changes', 'credit-card', 'dash', 'dashboard', 'database', 'debug-continue', 'debug-disconnect', 'debug-pause', 'debug-restart',
    'debug-start', 'debug-step-into', 'debug-step-out', 'debug-step-over', 'debug-stop', 'debug', 'device-camera-video', 'device-camera',
    'device-mobile', 'diff-added', 'diff-ignored', 'diff-modified', 'diff-removed', 'diff-renamed', 'diff', 'discard', 'editor-layout',
    'empty-window', 'exclude', 'extensions', 'eye-closed', 'file-binary', 'file-code', 'file-media', 'file-pdf', 'file-submodule',
    'file-symlink-directory', 'file-symlink-file', 'file-zip', 'files', 'filter', 'flame', 'fold-down', 'fold-up', 'fold', 'folder-active',
    'folder-opened', 'gear', 'gift', 'gist-secret', 'gist', 'git-commit', 'git-compare', 'git-merge', 'github-action', 'github-alt', 'globe',
    'grabber', 'graph', 'gripper', 'heart', 'home', 'horizontal-rule', 'hubot', 'inbox', 'issue-closed', 'issue-reopened', 'issues', 'italic',
    'jersey', 'json', 'kebab-vertical', 'key', 'law', 'lightbulb-autofix', 'link-external', 'link', 'list-ordered', 'list-unordered', 'live-share',
    'loading', 'location', 'mail-read', 'mail', 'markdown', 'megaphone', 'mention', 'milestone', 'mortar-board', 'move', 'multiple-windows', 'mute',
    'no-newline', 'note', 'octoface', 'open-preview', 'package', 'paintcan', 'pin', 'play', 'run', 'plug', 'preserve-case', 'preview', 'project',
    'pulse', 'question', 'quote', 'radio-tower', 'reactions', 'references', 'refresh', 'regex', 'remote-explorer', 'remote', 'remove', 'replace-all',
    'replace', 'repo-clone', 'repo-force-push', 'repo-pull', 'repo-push', 'report', 'request-changes', 'rocket', 'root-folder-opened', 'root-folder',
    'rss', 'ruby', 'save-all', 'save-as', 'save', 'screen-full', 'screen-normal', 'search-stop', 'server', 'settings-gear', 'settings', 'shield',
    'smiley', 'sort-precedence', 'split-horizontal', 'split-vertical', 'squirrel', 'star-full', 'star-half', 'symbol-class', 'symbol-color',
    'symbol-constant', 'symbol-enum-member', 'symbol-field', 'symbol-file', 'symbol-interface', 'symbol-keyword', 'symbol-misc', 'symbol-operator',
    'symbol-property', 'wrench', 'wrench-subaction', 'symbol-snippet', 'tasklist', 'telescope', 'text-size', 'three-bars', 'thumbsdown', 'thumbsup',
    'tools', 'triangle-down', 'triangle-left', 'triangle-right', 'triangle-up', 'twitter', 'unfold', 'unlock', 'unmute', 'unverified', 'verified',
    'versions', 'vm-active', 'vm-outline', 'vm-running', 'watch', 'whitespace', 'whole-word', 'window', 'word-wrap', 'zoom-in', 'zoom-out',
    'list-filter', 'list-flat', 'list-selection', 'selection', 'list-tree', 'debug-breakpoint-function-unverified', 'debug-breakpoint-function',
    'debug-breakpoint-function-disabled', 'debug-stackframe-active', 'debug-stackframe-dot', 'debug-stackframe', 'debug-stackframe-focused',
    'debug-breakpoint-unsupported', 'symbol-string', 'debug-reverse-continue', 'debug-step-back', 'debug-restart-frame', 'call-incoming',
    'call-outgoing', 'menu', 'expand-all', 'feedback', 'group-by-ref-type', 'ungroup-by-ref-type', 'account', 'bell-dot', 'debug-console', 'library',
    'output', 'run-all', 'sync-ignored', 'pinned', 'github-inverted', 'debug-alt', 'server-process', 'server-environment', 'pass', 'stop-circle',
    'play-circle', 'record', 'debug-alt-small', 'vm-connect', 'cloud', 'merge', 'export', 'graph-left', 'magnet',
  ].map(icon => <ToolbarButton icon={icon} title={icon} onClick={() => {}}></ToolbarButton>)}
</Toolbar>;

export const AllButtons = AllTemplate.bind({});
