import { EventEmitter } from './platform';
import { helper } from './helper';

export class ExtendedEventEmitter extends EventEmitter {
  private _timeoutGetter: (event: string) => number;
  private _abortGetter: (event: string) => Promise<Error>;
  constructor(options: {timeoutGetter: (event: string) => number, abortGetter?: (event: string) => Promise<Error>}) {
    super();
    const {
      timeoutGetter,
      abortGetter = () => new Promise<Error>(() => void 0)
    } = options;
    this._timeoutGetter = timeoutGetter;
    this._abortGetter = abortGetter;
  }

  async waitForEvent(event: string, optionsOrPredicate: Function|{ predicate?: Function, timeout?: number } = {}): Promise<any> {
    const {
      predicate = () => true,
      timeout = this._timeoutGetter(event)
    } = typeof optionsOrPredicate === 'function' ? {predicate: optionsOrPredicate} : optionsOrPredicate;
    return helper.waitForEvent(this, event, predicate, timeout, this._abortGetter(event));
  }
}
