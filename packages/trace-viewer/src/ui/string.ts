import type { ActionTraceEvent } from '@trace/trace';
import { asLocator, type Language } from '@isomorphic/locatorGenerators';

export const commandContextString = (action: ActionTraceEvent, sdkLanguage: Language): string | undefined => {
  const params = action.params;

  if (action.apiName.startsWith('clock')) {
    if ('ticksNumber' in params) {
      // clock.fastForward/runFor
      return `${params.ticksNumber}ms`;
    } else if (params.ticksString) {
      // clock.fastForward/runFor
      return params.ticksString;
    } else if ('timeNumber' in params) {
      // clock.pauseAt/setFixedTime/setSystemTime
      try {
        return new Date(params.timeNumber).toLocaleString();
      } catch (e) {
        return undefined;
      }  
    }
  } else if (action.apiName.startsWith('keyboard')) {
    if (params.key) {
      // keyboard.press/down/up
      return params.key;
    } else if (params.text) {
      // keyboard.type/insertText
      return `"${params.text}"`;
    }
  } else if (action.apiName.startsWith('locator')) {
    return asLocator(sdkLanguage, params.selector);
  } else if (action.apiName.startsWith('mouse')) {
    if ('x' in params && 'y' in params) {
      // mouse.click/dblclick/move
      return `(${params.x}, ${params.y})`;
    } else if ('deltaX' in params && 'deltaY' in params) {
      // mouse.wheel
      return `(${params.deltaX}, ${params.deltaY})`;
    }
  } else if (action.apiName.startsWith('touchscreen')) {
    if ('x' in params && 'y' in params) {
      // touchscreen.tap
      return `(${params.x}, ${params.y})`;
    }
  }
  
  return undefined;
};