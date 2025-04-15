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


import { CodegenEnhancerOptions } from 'packages/playwright-core';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage } from '@langchain/core/messages';
import { HumanMessage } from '@langchain/core/messages';

import type * as actions from '@recorder/actions';

const DEBUG_LLM = process.env.PW_DEBUG_LLM === '1';

const processedActionCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string>>();


function debugLog(message: string) {
  if (DEBUG_LLM)
    process.stdout.write(`[LLM Debug] ${message}\n`);
}


export class CodegenEnhancer {

  actionEnhancer: BaseChatModel | undefined;
  actionPrompt: string | undefined;
  completeScriptEnhancer: BaseChatModel | undefined;
  scriptPrompt: string | undefined;

  constructor(codegenEnhancerOptions: CodegenEnhancerOptions) {
    this.actionEnhancer = codegenEnhancerOptions.actionEnhancer;
    this.actionPrompt = codegenEnhancerOptions.actionPrompt;
    this.completeScriptEnhancer = codegenEnhancerOptions.completeScriptEnhancer;
    this.scriptPrompt = codegenEnhancerOptions.scriptPrompt;

    if (!this.actionEnhancer && !this.completeScriptEnhancer && !this.actionPrompt && !this.scriptPrompt)
      throw new Error('At least one enhancer must be provided');

    if ((this.actionEnhancer && !this.actionPrompt) || (!this.actionEnhancer && this.actionPrompt))
      throw new Error('ActionEnhancer and actionPrompt must be provided together');

    if ((this.completeScriptEnhancer && !this.scriptPrompt) || (!this.completeScriptEnhancer && this.scriptPrompt))
      throw new Error('CompleteScriptEnhancer and scriptPrompt must be provided together');

  }

  async enhanceActionWithLLM(
    generatedCode: string,
    action: actions.Action,
    actionContext: actions.ActionInContext
  ): Promise<string> {
    try {
      const requestId = Math.random().toString(36).substring(2, 10);
      const actionKey = `${action.name}_${actionContext.startTime}`;

      if (processedActionCache.has(actionKey))  {
        debugLog(`[CodegenEnhancer] Using cached result for action: ${action.name})`);
        return processedActionCache.get(actionKey)!;
      }

      if (pendingRequests.has(actionKey)) {
        debugLog(`[CodegenEnhancer] Using cached result for action: ${action.name})`);
        return pendingRequests.get(actionKey)!;
      }

      debugLog(`[CodegenEnhancer][${requestId}] Starting LLM enhancement for action: ${action.name}`);

      const action_modified = action;
      if ('position' in action_modified)
        delete action_modified['position'];

      const performLLMRequest = async () => {
        // Initialize the chat model

        // Extract element information if available - using optional chaining to avoid type errors
        const targetInfo = (action_modified as any).targetInfo || {};
        const elementPaths = targetInfo.paths || {};

        // Prepare additional element context if available
        let elementContext = '';
        if (elementPaths.xpath || elementPaths.fullXPath || elementPaths.jsPath || elementPaths.outerHTML) {
          elementContext = `
  Element Information:
  - Element Tag: ${targetInfo.tagName || 'Unknown'}
  - Element Classes: ${targetInfo.elementClasses || 'None'}
  - Element Attributes: ${JSON.stringify(targetInfo.elementAttributes || {})}
  - XPath: ${elementPaths.xpath || 'N/A'}
  - Full XPath: ${elementPaths.fullXPath || 'N/A'}
  - JS Path: ${elementPaths.jsPath || 'N/A'}
  - OuterHTML: ${elementPaths.outerHTML || 'N/A'}
  `;

          // Remove data from action_modified that's already in elementContext
          if ((action_modified as any).targetInfo) {
            const targetInfoCopy = { ...(action_modified as any).targetInfo };
            delete targetInfoCopy.tagName;
            delete targetInfoCopy.elementClasses;
            delete targetInfoCopy.elementAttributes;
            if (targetInfoCopy.paths) {
              delete targetInfoCopy.paths.xpath;
              delete targetInfoCopy.paths.fullXPath;
              delete targetInfoCopy.paths.jsPath;
              delete targetInfoCopy.paths.outerHTML;

              // If paths object is now empty, remove it
              if (Object.keys(targetInfoCopy.paths).length === 0)
                delete targetInfoCopy.paths;
            }

            // If targetInfo is now empty, remove it entirely
            if (Object.keys(targetInfoCopy).length === 0)
              delete (action_modified as any).targetInfo;
            else
              (action_modified as any).targetInfo = targetInfoCopy;
          }
        }

        // Convert action to string before modifying it for element context
        const actionData = JSON.stringify(action_modified, null, 2);

        process.stdout.write(`Enhancing code with LLM for action: ${action.name}\n`);

        // Prepare the context for the LLM
        const systemPrompt = `You are a seasoned Playwright test automation expert. Your task is to transform individual action instructions into robust, production-ready JavaScript code. Each action will be provided sequentially, and your output for each should be modular, clean, and mergeable into a complete test suite. Follow these guidelines precisely:
**IMPORTANT**
  - Output only the improved Playwright code without any extra text. 
  ${this.actionPrompt}`;

        const userPrompt = `Here's one Playwright action in JSON format:
  \`\`\`json
  ${actionData}
  \`\`\`
  ${elementContext}
  Here's the generated code for this action:
  \`\`\`javascript
  ${generatedCode}
  \`\`\`
  `;

        debugLog(`[CodegenEnhancer][${requestId}] Sending request to LLM`);
        const response = await this.actionEnhancer!.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt)
        ]);
        debugLog(`[CodegenEnhancer][${requestId}] Received LLM response`);

        let enhancedCode = response.content.toString();

        if (enhancedCode.includes('```')) {
          const codeBlockRegex = /```(?:javascript|js)?\n([\s\S]*?)```/;
          const match = enhancedCode.match(codeBlockRegex);
          if (match && match[1])
            enhancedCode = match[1].trim();
        }

        processedActionCache.set(actionKey, enhancedCode);
        pendingRequests.delete(actionKey);
        debugLog(`[CodegenEnhancer] Cached result for action: ${action.name}`);

        return enhancedCode;
      };

      const requestPromise = performLLMRequest();
      pendingRequests.set(actionKey, requestPromise);

      return requestPromise;
    } catch (error) {

      // Make sure to clean up the pending request on error
      const actionKey = `${action.name}_${actionContext.startTime}`;
      pendingRequests.delete(actionKey);

      // Fall back to original code if there's an error
      return generatedCode;
    }
  }

  async enhanceCompleteScript(
    completeScript: string,
  ): Promise<string> {
    try {

      if (!this.completeScriptEnhancer || !this.scriptPrompt)
        return completeScript;

      debugLog(`Complete script length: ${completeScript.length} characters`);

      // Improved system prompt with stronger preservation instructions
      const systemPrompt = `You are an expert Playwright test automation engineer improving a generated test script. 
  
  CRITICAL REQUIREMENTS (HIGHEST PRIORITY):
  1. NEVER remove ANY existing functionality from the script.
  2. NEVER remove or modify fallback locators - they are essential for test reliability.
  3. NEVER combine or merge different fallback locator mechanisms.
  4. ALWAYS preserve ALL retry logic, waits, assertions, and error handling.
  5. DO NOT change the structure or flow of the test.
  ${this.scriptPrompt}`;

      const userPrompt = `Here is a complete Playwright test script that was auto-generated. Please improve it while STRICTLY PRESERVING ALL EXISTING FUNCTIONALITY:
  
  \`\`\`javascript
  ${completeScript}
  \`\`\`
  
  Return ONLY the complete enhanced test script with ALL functionality preserved.`;

      debugLog('Sending complete script to LLM...');

      // Get response from the LLM
      const response = await this.completeScriptEnhancer!.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ]);

      let enhancedScript = response.content.toString();
      debugLog('Got response from LLM for complete script');

      // Extract code from markdown code blocks if present
      if (enhancedScript.includes('```')) {
        const codeBlockRegex = /```(?:javascript|js)?\n([\s\S]*?)```/;
        const match = enhancedScript.match(codeBlockRegex);
        if (match && match[1])
          enhancedScript = match[1].trim();
      }

      return enhancedScript;
    } catch (error) {
      debugLog(`Full error details: ${error && (error as Error).stack}`);
      // Fall back to original script if there's an error
      return completeScript;
    }
  }

}
