import {helper} from '../helper';
import {JSHandle, createHandle} from './JSHandle';
import { Frame } from './FrameManager';

export class ExecutionContext {
  _session: any;
  _frame: Frame;
  _executionContextId: string;
  constructor(session: any, frame: Frame | null, executionContextId: string) {
    this._session = session;
    this._frame = frame;
    this._executionContextId = executionContextId;
  }

  async evaluateHandle(pageFunction, ...args) {
    if (helper.isString(pageFunction)) {
      const payload = await this._session.send('Runtime.evaluate', {
        expression: pageFunction,
        executionContextId: this._executionContextId,
      }).catch(rewriteError);
      return createHandle(this, payload.result, payload.exceptionDetails);
    }
    if (typeof pageFunction !== 'function')
      throw new Error(`Expected to get |string| or |function| as the first argument, but got "${pageFunction}" instead.`);

    let functionText = pageFunction.toString();
    try {
      new Function('(' + functionText + ')');
    } catch (e1) {
      // This means we might have a function shorthand. Try another
      // time prefixing 'function '.
      if (functionText.startsWith('async '))
        functionText = 'async function ' + functionText.substring('async '.length);
      else
        functionText = 'function ' + functionText;
      try {
        new Function('(' + functionText  + ')');
      } catch (e2) {
        // We tried hard to serialize, but there's a weird beast here.
        throw new Error('Passed function is not well-serializable!');
      }
    }
    args = args.map(arg => {
      if (arg instanceof JSHandle) {
        if (arg._context !== this)
          throw new Error('JSHandles can be evaluated only in the context they were created!');
        if (arg._disposed)
          throw new Error('JSHandle is disposed!');
        return arg._protocolValue;
      }
      if (Object.is(arg, Infinity))
        return {unserializableValue: 'Infinity'};
      if (Object.is(arg, -Infinity))
        return {unserializableValue: '-Infinity'};
      if (Object.is(arg, -0))
        return {unserializableValue: '-0'};
      if (Object.is(arg, NaN))
        return {unserializableValue: 'NaN'};
      return {value: arg};
    });
    let callFunctionPromise;
    try {
      callFunctionPromise = this._session.send('Runtime.callFunction', {
        functionDeclaration: functionText,
        args,
        executionContextId: this._executionContextId
      });
    } catch (err) {
      if (err instanceof TypeError && err.message.startsWith('Converting circular structure to JSON'))
        err.message += ' Are you passing a nested JSHandle?';
      throw err;
    }
    const payload = await callFunctionPromise.catch(rewriteError);
    return createHandle(this, payload.result, payload.exceptionDetails);

    function rewriteError(error) {
      if (error.message.includes('Failed to find execution context with id'))
        throw new Error('Execution context was destroyed, most likely because of a navigation.');
      throw error;
    }
  }

  frame() {
    return this._frame;
  }

  async evaluate(pageFunction, ...args) {
    try {
      const handle = await this.evaluateHandle(pageFunction, ...args);
      const result = await handle.jsonValue();
      await handle.dispose();
      return result;
    } catch (e) {
      if (e.message.includes('cyclic object value') || e.message.includes('Object is not serializable'))
        return undefined;
      throw e;
    }
  }

}
