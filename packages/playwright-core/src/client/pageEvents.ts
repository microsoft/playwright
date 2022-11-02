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
import type * as api from '../../types/types';
import { EventList } from './eventList';
import { Events } from './events';
import type { Page } from './page';

export class PageEvents implements api.PageEvents {
  readonly close: EventList<api.Page>;
  readonly console: EventList<api.ConsoleMessage>;
  readonly crash: EventList<api.Page>;
  readonly dialog: EventList<api.Dialog>;
  readonly domcontentloaded: EventList<api.Page>;
  readonly download: EventList<api.Download>;
  readonly filechooser: EventList<api.FileChooser>;
  readonly frameattached: EventList<api.Frame>;
  readonly framedetached: EventList<api.Frame>;
  readonly framenavigated: EventList<api.Frame>;
  readonly load: EventList<api.Page>;
  readonly pageerror: EventList<Error>;
  readonly popup: EventList<api.Page>;
  readonly request: EventList<api.Request>;
  readonly requestfailed: EventList<api.Request>;
  readonly requestfinished: EventList<api.Request>;
  readonly response: EventList<api.Response>;
  readonly websocket: EventList<api.WebSocket>;
  readonly worker: EventList<api.Worker>;

  constructor(page: Page) {
    this.close = new EventList<api.Page>(page, Events.Page.Close, 'page.events.close');
    this.console = new EventList<api.ConsoleMessage>(page, Events.Page.Console, 'page.events.console');
    this.crash = new EventList<api.Page>(page, Events.Page.Crash, 'page.events.crash');
    this.dialog = new EventList<api.Dialog>(page, Events.Page.Dialog, 'page.events.dialog');
    this.domcontentloaded = new EventList<api.Page>(page, Events.Page.DOMContentLoaded, 'page.events.domcontentloaded');
    this.download = new EventList<api.Download>(page, Events.Page.Download, 'page.events.download');
    this.filechooser = new EventList<api.FileChooser>(page, Events.Page.FileChooser, 'page.events.filechooser');
    this.frameattached = new EventList<api.Frame>(page, Events.Page.FrameAttached, 'page.events.frameattached');
    this.framedetached = new EventList<api.Frame>(page, Events.Page.FrameDetached, 'page.events.framedetached');
    this.framenavigated = new EventList<api.Frame>(page, Events.Page.FrameNavigated, 'page.events.framenavigated');
    this.load = new EventList<api.Page>(page, Events.Page.Load, 'page.events.load');
    this.pageerror = new EventList<Error>(page, Events.Page.PageError, 'page.events.pageerror');
    this.popup = new EventList<api.Page>(page, Events.Page.Popup, 'page.events.popup');
    this.request = new EventList<api.Request>(page, Events.Page.Request, 'page.events.request');
    this.requestfailed = new EventList<api.Request>(page, Events.Page.RequestFailed, 'page.events.requestfailed');
    this.requestfinished = new EventList<api.Request>(page, Events.Page.RequestFinished, 'page.events.requestfinished');
    this.response = new EventList<api.Response>(page, Events.Page.Response, 'page.events.response');
    this.websocket = new EventList<api.WebSocket>(page, Events.Page.WebSocket, 'page.events.websocket');
    this.worker = new EventList<api.Worker>(page, Events.Page.Worker, 'page.events.worker');
  }
}

