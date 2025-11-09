/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Type,
} from '@google/genai';
import { createContext, FC, ReactNode, useContext, useRef, useState } from 'react';
import { useAPIKey } from './APIKeyContext';
import { PodcastFormat, useAgentStore } from '@/lib/state';

export interface PodcastSuggestion {
  title: string;
  url: string;
}

interface ContentScoutAgentContextType {
  fetchIdeas: (format: PodcastFormat) => Promise<void>;
  clearSuggestionsAndSteps: () => void;
  suggestions: Partial<Record<PodcastFormat, PodcastSuggestion[]>>;
  isThinking: boolean;
  error: string | null;
  thinkingSteps: string[];
}

const ContentScoutAgentContext = createContext<ContentScoutAgentContextType | undefined>(undefined);

// FIX: Refactor to use a module-level variable for the AI client.
// This avoids potential issues with useRef type inference that may be causing
// the "Expected 1 arguments, but got 0" error, and aligns with the pattern
// used in other working contexts in the application.
let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

export const ContentScoutAgentProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const API_KEY = useAPIKey();
  const [suggestions, setSuggestions] = useState<Partial<Record<PodcastFormat, PodcastSuggestion[]>>>({});
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const thinkingCounter = useRef(0);

  const initialize = () => {
    if (!ai || API_KEY !== currentApiKey) {
      ai = new GoogleGenAI({ apiKey: API_KEY });
      currentApiKey = API_KEY;
    }
  };

  const addThinkingStep = (step: string) => {
      setThinkingSteps(prev => [...prev, step]);
  }

  const clearSuggestionsAndSteps = () => {
    setSuggestions({});
    setThinkingSteps([]);
    setError(null);
  };

  const fetchIdeas = async (format: PodcastFormat) => {
    initialize();
    if (!ai) return;

    const { agents } = useAgentStore.getState();
    const agentConfig = agents[format];

    if (!agentConfig) {
        if (format !== 'Freestyle') {
            console.warn(`No agent config found for format: ${format}`);
        }
        return;
    }

    thinkingCounter.current++;
    setIsThinking(true);
    setError(null);
    const agentType = format;
    
    addThinkingStep(`> [${agentType}] Deployed...`);
    
    const sourceUrls = agentConfig.sourceUrls;
    const tools = [];
    let userPrompt = `Find 5 topics for a podcast about ${agentType}`; // Generic base prompt

    if (agentConfig.tools.urlContext && sourceUrls.length > 0) {
        tools.push({ urlContext: {} });
        userPrompt += ` You must analyze the content directly from these URLs: ${sourceUrls.join(' ')}`;
        addThinkingStep(`> [${agentType}] Analyzing provided URLs...`);
    } else if (agentConfig.tools.googleSearch) {
        tools.push({ googleSearch: {} });
        addThinkingStep(`> [${agentType}] Searching the web...`);
    }

    try {
        const config: any = {
          systemInstruction: agentConfig.systemPrompt,
        };

        if (tools.length > 0) {
            config.tools = tools;
        } else {
            // Only set JSON response type if NO tools are used.
            config.responseMimeType = 'application/json';
            config.responseSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        url: { type: Type.STRING },
                    }
                }
            };
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: config,
        });
        
        addThinkingStep(`> [${agentType}] Analyzing results...`);
        
        let jsonStr = response.text.trim();
        // If tools were used, the response is plain text and might be wrapped in markdown.
        if (tools.length > 0) {
          const jsonMatch = jsonStr.match(/(\[[\s\S]*\])/);
          if (jsonMatch) {
              jsonStr = jsonMatch[0];
          }
        }
        
        const results = JSON.parse(jsonStr) as PodcastSuggestion[];
        addThinkingStep(`> [${agentType}] Success! Found ${results.length} suggestions.`);
        setSuggestions(prev => ({...prev, [format]: results}));

    } catch (err) {
      console.error("Content Scout fetch failed:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Agent ${agentType} failed: ${errorMessage}`);
      addThinkingStep(`> [${agentType}] Task Failed.`);
    } finally {
        thinkingCounter.current--;
        if (thinkingCounter.current === 0) {
            setIsThinking(false);
        }
    }
  };

  return (
    <ContentScoutAgentContext.Provider value={{ fetchIdeas, suggestions, isThinking, error, thinkingSteps, clearSuggestionsAndSteps }}>
      {children}
    </ContentScoutAgentContext.Provider>
  );
};

export const useContentScoutAgentContext = () => {
  const context = useContext(ContentScoutAgentContext);
  if (!context) {
    throw new Error('useContentScoutAgentContext must be used within a ContentScoutAgentProvider');
  }
  return context;
};
