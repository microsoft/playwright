import * as React from 'react';
import { LLMChat, LLM, OpenAI, Anthropic } from '@isomorphic/llm';

const llmContext = React.createContext<LLMChat | undefined>(undefined);

export function LLMProvider({ openai, anthropic, children }: React.PropsWithChildren<{ openai?: string, anthropic?: string }>) {
    const chat = React.useMemo(() => {
        let llm: LLM | undefined;
        if (openai)
            llm = new OpenAI(openai);
        if (anthropic)
            llm = new Anthropic(anthropic);
        if (llm)
            return new LLMChat(llm);
    }, [openai, anthropic]);
  return <llmContext.Provider value={chat}>{children}</llmContext.Provider>;
};

export function useLLMChat() {
    return React.useContext(llmContext);
};
