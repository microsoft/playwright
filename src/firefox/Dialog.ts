import {assert, debugError} from '../helper';

export class Dialog {
  private _client: any;
  private _dialogId: any;
  private _type: string;
  private _message: string;
  private _handled: boolean;
  private _defaultValue: string;

  constructor(client, payload) {
    this._client = client;
    this._dialogId = payload.dialogId;
    this._type = payload.type;
    this._message = payload.message;
    this._handled = false;
    this._defaultValue = payload.defaultValue || '';
  }

  type(): string {
    return this._type;
  }

  message(): string {
    return this._message;
  }

  defaultValue(): string {
    return this._defaultValue;
  }

  async accept(promptText: string | undefined) {
    assert(!this._handled, 'Cannot accept dialog which is already handled!');
    this._handled = true;
    await this._client.send('Page.handleDialog', {
      dialogId: this._dialogId,
      accept: true,
      promptText: promptText
    }).catch(debugError);
  }

  async dismiss() {
    assert(!this._handled, 'Cannot dismiss dialog which is already handled!');
    this._handled = true;
    await this._client.send('Page.handleDialog', {
      dialogId: this._dialogId,
      accept: false
    }).catch(debugError);
  }
}

