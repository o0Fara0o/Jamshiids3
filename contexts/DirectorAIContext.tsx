/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  FunctionDeclaration,
  Type,
} from '@google/genai';
import { createContext, FC, ReactNode, useContext, useRef } from 'react';
import { useDirectorStore, useProducerStudioStore } from '@/lib/state';
import { useAPIKey } from './APIKeyContext';

// Tool for suggesting a mood/direction prompt
const suggestMoodPromptTool: FunctionDeclaration = {
  name: 'suggest_mood_prompt',
  description: 'Provides a single, concise, actionable prompt to make the conversation more interesting.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: 'The suggested prompt for the hosts.',
      },
    },
    required: ['prompt'],
  },
};

// Tool for suggesting how to end the show
const suggestEndShowPromptTool: FunctionDeclaration = {
  name: 'suggest_end_show_prompt',
  description: 'Provides a single, concise, actionable prompt for how the hosts should end the show.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: 'The suggested prompt for ending the podcast.',
      },
    },
    required: ['prompt'],
  },
};


interface DirectorAIContextType {
  getSuggestions: (transcript: string) => Promise<void>;
  getEndShowSuggestions: (transcript: string) => Promise<void>;
}

const DirectorAIContext = createContext<DirectorAIContextType | undefined>(undefined);

// FIX: Refactor to use module-level variables for the AI client.
// This avoids potential issues with useRef type inference that may be causing
// the "Expected 1 arguments, but got 0" error, and aligns with the pattern
// used in other working contexts in the application.
let ai: GoogleGenAI | null = null;
let currentModel: string | null = null;
let currentApiKey: string | null = null;

export const DirectorAIProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { directorModel } = useDirectorStore();
  const { directorSystemPrompt, endShowDirectorSystemPrompt } = useProducerStudioStore();
  const API_KEY = useAPIKey();

  // Initialize lazily
  const initialize = () => {
    if (!ai || directorModel !== currentModel || API_KEY !== currentApiKey) {
      ai = new GoogleGenAI({ apiKey: API_KEY });
      currentModel = directorModel;
      currentApiKey = API_KEY;
    }
  };

  const getSuggestions = async (transcript: string) => {
    initialize();
    if (!ai) return;

    try {
      const response = await ai.models.generateContent({
        model: directorModel,
        contents: `Here is the recent transcript:\n\n${transcript}`,
        config: {
          systemInstruction: directorSystemPrompt,
          tools: [{ functionDeclarations: [suggestMoodPromptTool] }],
        }
      });
      
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const prompt = functionCalls[0].args.prompt as string;
        if (prompt) {
          useDirectorStore.getState().addDynamicPrompt(prompt);
        }
      } else {
        console.warn("Director AI (mood) did not return a function call.");
      }
    } catch (error) {
      console.error('Director AI getSuggestions failed:', error);
    }
  };
  
  const getEndShowSuggestions = async (transcript: string) => {
    initialize();
    if (!ai) return;

    try {
      const response = await ai.models.generateContent({
        model: directorModel,
        contents: `Here is the recent transcript:\n\n${transcript}`,
        config: {
          systemInstruction: endShowDirectorSystemPrompt,
          tools: [{ functionDeclarations: [suggestEndShowPromptTool] }],
        }
      });

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const prompt = functionCalls[0].args.prompt as string;
        if (prompt) {
          useDirectorStore.getState().addDynamicEndPrompt(prompt);
        }
      } else {
        console.warn("Director AI (end show) did not return a function call.");
      }
    } catch (error) {
      console.error('Director AI getEndShowSuggestions failed:', error);
    }
  };

  return (
    <DirectorAIContext.Provider value={{ getSuggestions, getEndShowSuggestions }}>
      {children}
    </DirectorAIContext.Provider>
  );
};

export const useDirectorAIContext = () => {
  const context = useContext(DirectorAIContext);
  if (!context) {
    throw new Error('useDirectorAIContext must be used within a DirectorAIProvider');
  }
  return context;
};
