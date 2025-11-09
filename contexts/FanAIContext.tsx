/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Chat,
  GenerateContentResponse,
  FunctionDeclaration,
  Type,
} from '@google/genai';
import { createContext, FC, ReactNode, useContext, useRef, useState } from 'react';
import { useFanStore, useSettings, useLogStore, FAN_PERSONAS, useProducerStudioStore } from '@/lib/state';
import { useAPIKey } from './APIKeyContext';

type FanStatus = 'idle' | 'thinking' | 'error';
interface FanAIContextType {
  sendMessage: (message: string) => Promise<void>;
  status: FanStatus;
}

const FanAIContext = createContext<FanAIContextType | undefined>(undefined);

// FIX: Refactor to use module-level variables for the AI client and chat session
// This avoids potential issues with useRef type inference that may be causing
// the "Expected 1 arguments, but got 0" error, and aligns with the pattern
// used in other working contexts in the application.
let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;
let currentModel: string | null = null;
let currentPrompt: string | null = null;
let currentApiKey: string | null = null;

export const FanAIProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { fanModel } = useSettings();
  const { fanSystemPrompt } = useProducerStudioStore();
  const API_KEY = useAPIKey();
  const [status, setStatus] = useState<FanStatus>('idle');

  // Initialize lazily
  const initialize = () => {
    if (!ai || !chat || fanModel !== currentModel || fanSystemPrompt !== currentPrompt || API_KEY !== currentApiKey) {
      ai = new GoogleGenAI({ apiKey: API_KEY });
      chat = ai.chats.create({
        model: fanModel,
        config: {
          systemInstruction: fanSystemPrompt,
        },
      });
      currentModel = fanModel;
      currentPrompt = fanSystemPrompt;
      currentApiKey = API_KEY;
    }
  };

  const sendMessage = async (message: string) => {
    initialize();
    setStatus('thinking');
    const { addTurn: addFanTurn } = useFanStore.getState();

    const isFromMainChat =
      message.startsWith('Jamshid:') || message.startsWith('Faravaa:');

    if (!isFromMainChat) {
      addFanTurn({
        role: 'user',
        author: 'user',
        text: message,
        isFinal: true,
      });
      // Add placeholder for streaming response
      addFanTurn({
        role: 'agent',
        author: 'Fan AI',
        text: '',
        isFinal: false,
      });
    }

    if (!chat) return;

    try {
      const responseStream = await chat.sendMessageStream({
        message,
      });

      let fullResponseText = '';
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullResponseText += chunk.text;
          // Only stream visually for user-initiated messages
          if (!isFromMainChat) {
            const { updateLastTurn } = useFanStore.getState();
            updateLastTurn({ text: fullResponseText });
          }
        }
      }

      // Now process the final text for all cases
      const { removeLastTurn, addTurn } = useFanStore.getState();

      // If we added a placeholder, remove it before adding final turns
      if (!isFromMainChat) {
        removeLastTurn();
      }

      const commentRegex = /^(.+?):\s*(.*)$/gm;
      let match;
      while ((match = commentRegex.exec(fullResponseText)) !== null) {
        const author = match[1].trim();
        const text = match[2].trim();

        if (FAN_PERSONAS.includes(author) && text) {
            addTurn({ role: 'agent', author, text, isFinal: true });
        }
      }
      setStatus('idle');
    } catch (error) {
      console.error('Fan AI sendMessage failed:', error);
      const { turns, removeLastTurn, addTurn } = useFanStore.getState();
      const lastTurn = turns[turns.length - 1];
      // Clean up placeholder on error
      if (
        !isFromMainChat &&
        lastTurn &&
        lastTurn.author === 'Fan AI' &&
        !lastTurn.isFinal
      ) {
        removeLastTurn();
      }
      if (!isFromMainChat) {
        addTurn({
          role: 'agent',
          author: 'System',
          text: 'Sorry, I had trouble responding.',
          isFinal: true,
        });
      }
      setStatus('error');
    }
  };

  return (
    <FanAIContext.Provider value={{ sendMessage, status }}>
      {children}
    </FanAIContext.Provider>
  );
};

export const useFanAIContext = () => {
  const context = useContext(FanAIContext);
  if (!context) {
    throw new Error('useFanAIContext must be used within a FanAIProvider');
  }
  return context;
};