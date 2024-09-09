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

import type * as channels from '@protocol/channels';
import type { Source } from '@recorder/recorderTypes';
import { EventEmitter } from 'events';
import * as recorderSource from '../../generated/recorderSource';
import { eventsHelper, isUnderTest, monotonicTime, quoteCSSAttributeValue, type RegisteredListener } from '../../utils';
import { raceAgainstDeadline } from '../../utils/timeoutRunner';
import { BrowserContext } from '../browserContext';
import type { ActionInContext, FrameDescription, LanguageGeneratorOptions, Language, LanguageGenerator } from '../codegen/types';
import { languageSet } from '../codegen/languages';
import type { Dialog } from '../dialog';
import { Frame } from '../frames';
import { Page } from '../page';
import type * as actions from './recorderActions';
import { performAction } from './recorderRunner';
import { ThrottledFile } from './throttledFile';
import { RecorderCollection } from './recorderCollection';
import { generateCode } from '../codegen/language';

type BindingSource = { frame: Frame, page: Page };

export interface ContextRecorderDelegate {
  rewriteActionInContext?(pageAliases: Map<Page, string>, actionInContext: ActionInContext): Promise<void>;
}

export class ContextRecorder extends EventEmitter {
  static Events = {
    Change: 'change'
  };

  private _collection: RecorderCollection;
  private _pageAliases = new Map<Page, string>();
  private _lastPopupOrdinal = 0;
  private _lastDialogOrdinal = -1;
  private _lastDownloadOrdinal = -1;
  private _timers = new Set<NodeJS.Timeout>();
  private _context: BrowserContext;
  private _params: channels.BrowserContextRecorderSupplementEnableParams;
  private _delegate: ContextRecorderDelegate;
  private _recorderSources: Source[];
  private _throttledOutputFile: ThrottledFile | null = null;
  private _orderedLanguages: LanguageGenerator[] = [];
  private _listeners: RegisteredListener[] = [];

  constructor(context: BrowserContext, params: channels.BrowserContextRecorderSupplementEnableParams, delegate: ContextRecorderDelegate) {
    super();
    this._context = context;
    this._params = params;
    this._delegate = delegate;
    this._recorderSources = [];
    const language = params.language || context.attribution.playwright.options.sdkLanguage;
    this.setOutput(language, params.outputFile);

    // Make a copy of options to modify them later.
    const languageGeneratorOptions: LanguageGeneratorOptions = {
      browserName: context._browser.options.name,
      launchOptions: { headless: false, ...params.launchOptions },
      contextOptions: { ...params.contextOptions },
      deviceName: params.device,
      saveStorage: params.saveStorage,
    };

    const collection = new RecorderCollection(params.mode === 'recording');
    collection.on('change', () => {
      this._recorderSources = [];
      for (const languageGenerator of this._orderedLanguages) {
        const { header, footer, actionTexts, text } = generateCode(collection.actions(), languageGenerator, languageGeneratorOptions);
        const source: Source = {
          isRecorded: true,
          label: languageGenerator.name,
          group: languageGenerator.groupName,
          id: languageGenerator.id,
          text,
          header,
          footer,
          actions: actionTexts,
          language: languageGenerator.highlighter,
          highlight: []
        };
        source.revealLine = text.split('\n').length - 1;
        this._recorderSources.push(source);
        if (languageGenerator === this._orderedLanguages[0])
          this._throttledOutputFile?.setContent(source.text);
      }
      this.emit(ContextRecorder.Events.Change, {
        sources: this._recorderSources,
        primaryFileName: this._orderedLanguages[0].id
      });
    });
    context.on(BrowserContext.Events.BeforeClose, () => {
      this._throttledOutputFile?.flush();
    });
    this._listeners.push(eventsHelper.addEventListener(process, 'exit', () => {
      this._throttledOutputFile?.flush();
    }));
    this._collection = collection;
  }

  setOutput(codegenId: string, outputFile?: string) {
    const languages = languageSet();
    const primaryLanguage = [...languages].find(l => l.id === codegenId);
    if (!primaryLanguage)
      throw new Error(`\n===============================\nUnsupported language: '${codegenId}'\n===============================\n`);
    languages.delete(primaryLanguage);
    this._orderedLanguages = [primaryLanguage, ...languages];
    this._throttledOutputFile = outputFile ? new ThrottledFile(outputFile) : null;
    this._collection?.restart();
  }

  languageName(id?: string): Language {
    for (const lang of this._orderedLanguages) {
      if (!id || lang.id === id)
        return lang.highlighter;
    }
    return 'javascript';
  }

  async install() {
    this._context.on(BrowserContext.Events.Page, (page: Page) => this._onPage(page));
    for (const page of this._context.pages())
      this._onPage(page);
    this._context.on(BrowserContext.Events.Dialog, (dialog: Dialog) => this._onDialog(dialog.page()));

    // Input actions that potentially lead to navigation are intercepted on the page and are
    // performed by the Playwright.
    await this._context.exposeBinding('__pw_recorderPerformAction', false,
        (source: BindingSource, action: actions.PerformOnRecordAction) => this._performAction(source.frame, action));

    // Other non-essential actions are simply being recorded.
    await this._context.exposeBinding('__pw_recorderRecordAction', false,
        (source: BindingSource, action: actions.Action) => this._recordAction(source.frame, action));

    await this._context.extendInjectedScript(recorderSource.source);
  }

  setEnabled(enabled: boolean) {
    this._collection.setEnabled(enabled);
  }

  dispose() {
    for (const timer of this._timers)
      clearTimeout(timer);
    this._timers.clear();
    eventsHelper.removeEventListeners(this._listeners);
  }

  private async _onPage(page: Page) {
    // First page is called page, others are called popup1, popup2, etc.
    const frame = page.mainFrame();
    page.on('close', () => {
      this._collection.addAction({
        frame: this._describeMainFrame(page),
        committed: true,
        action: {
          name: 'closePage',
          signals: [],
        }
      });
      this._pageAliases.delete(page);
    });
    frame.on(Frame.Events.InternalNavigation, event => {
      if (event.isPublic)
        this._onFrameNavigated(frame, page);
    });
    page.on(Page.Events.Download, () => this._onDownload(page));
    const suffix = this._pageAliases.size ? String(++this._lastPopupOrdinal) : '';
    const pageAlias = 'page' + suffix;
    this._pageAliases.set(page, pageAlias);

    if (page.opener()) {
      this._onPopup(page.opener()!, page);
    } else {
      this._collection.addAction({
        frame: this._describeMainFrame(page),
        committed: true,
        action: {
          name: 'openPage',
          url: page.mainFrame().url(),
          signals: [],
        }
      });
    }
  }

  clearScript(): void {
    this._collection.restart();
    if (this._params.mode === 'recording') {
      for (const page of this._context.pages())
        this._onFrameNavigated(page.mainFrame(), page);
    }
  }

  private _describeMainFrame(page: Page): FrameDescription {
    return {
      pageAlias: this._pageAliases.get(page)!,
      framePath: [],
    };
  }

  private async _describeFrame(frame: Frame): Promise<FrameDescription> {
    return {
      pageAlias: this._pageAliases.get(frame._page)!,
      framePath: await generateFrameSelector(frame),
    };
  }

  testIdAttributeName(): string {
    return this._params.testIdAttributeName || this._context.selectors().testIdAttributeName() || 'data-testid';
  }

  private async _performAction(frame: Frame, action: actions.PerformOnRecordAction) {
    // Commit last action so that no further signals are added to it.
    this._collection.commitLastAction();

    const frameDescription = await this._describeFrame(frame);
    const actionInContext: ActionInContext = {
      frame: frameDescription,
      action,
      description: undefined,
    };

    await this._delegate.rewriteActionInContext?.(this._pageAliases, actionInContext);

    this._collection.willPerformAction(actionInContext);
    const success = await performAction(this._pageAliases, actionInContext);
    if (success) {
      this._collection.didPerformAction(actionInContext);
      this._setCommittedAfterTimeout(actionInContext);
    } else {
      this._collection.performedActionFailed(actionInContext);
    }
  }

  private async _recordAction(frame: Frame, action: actions.Action) {
    // Commit last action so that no further signals are added to it.
    this._collection.commitLastAction();

    const frameDescription = await this._describeFrame(frame);
    const actionInContext: ActionInContext = {
      frame: frameDescription,
      action,
      description: undefined,
    };

    await this._delegate.rewriteActionInContext?.(this._pageAliases, actionInContext);

    this._setCommittedAfterTimeout(actionInContext);
    this._collection.addAction(actionInContext);
  }

  private _setCommittedAfterTimeout(actionInContext: ActionInContext) {
    const timer = setTimeout(() => {
      // Commit the action after 5 seconds so that no further signals are added to it.
      actionInContext.committed = true;
      this._timers.delete(timer);
    }, isUnderTest() ? 500 : 5000);
    this._timers.add(timer);
  }

  private _onFrameNavigated(frame: Frame, page: Page) {
    const pageAlias = this._pageAliases.get(page);
    this._collection.signal(pageAlias!, frame, { name: 'navigation', url: frame.url() });
  }

  private _onPopup(page: Page, popup: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    const popupAlias = this._pageAliases.get(popup)!;
    this._collection.signal(pageAlias, page.mainFrame(), { name: 'popup', popupAlias });
  }

  private _onDownload(page: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    ++this._lastDownloadOrdinal;
    this._collection.signal(pageAlias, page.mainFrame(), { name: 'download', downloadAlias: this._lastDownloadOrdinal ? String(this._lastDownloadOrdinal) : '' });
  }

  private _onDialog(page: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    ++this._lastDialogOrdinal;
    this._collection.signal(pageAlias, page.mainFrame(), { name: 'dialog', dialogAlias: this._lastDialogOrdinal ? String(this._lastDialogOrdinal) : '' });
  }
}

export async function generateFrameSelector(frame: Frame): Promise<string[]> {
  const selectorPromises: Promise<string>[] = [];
  while (frame) {
    const parent = frame.parentFrame();
    if (!parent)
      break;
    selectorPromises.push(generateFrameSelectorInParent(parent, frame));
    frame = parent;
  }
  const result = await Promise.all(selectorPromises);
  return result.reverse();
}

async function generateFrameSelectorInParent(parent: Frame, frame: Frame): Promise<string> {
  const result = await raceAgainstDeadline(async () => {
    try {
      const frameElement = await frame.frameElement();
      if (!frameElement || !parent)
        return;
      const utility = await parent._utilityContext();
      const injected = await utility.injectedScript();
      const selector = await injected.evaluate((injected, element) => {
        return injected.generateSelectorSimple(element as Element);
      }, frameElement);
      return selector;
    } catch (e) {
      return e.toString();
    }
  }, monotonicTime() + 2000);
  if (!result.timedOut && result.result)
    return result.result;

  if (frame.name())
    return `iframe[name=${quoteCSSAttributeValue(frame.name())}]`;
  return `iframe[src=${quoteCSSAttributeValue(frame.url())}]`;
}
