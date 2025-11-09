/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';
import { createContext, FC, ReactNode, useContext, useRef } from 'react';
import { useAPIKey } from './APIKeyContext';

export interface EmotionDirective {
  text: string;
}

interface GetDirectiveRequest {
    dialogue: string;
    speaker: string;
    systemPrompt: string;
    personalityPrompt?: string;
}

interface EmotionDirectorContextType {
  getDirective: (request: GetDirectiveRequest) => Promise<EmotionDirective | null>;
}


const EmotionDirectorContext = createContext<EmotionDirectorContextType | undefined>(undefined);

export const EmotionDirectorProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const apiKey = useAPIKey();
    let ai: GoogleGenAI | null = null;
    let currentApiKey: string | null = null;

    const getAI = () => {
        if (!ai || currentApiKey !== apiKey) {
            ai = new GoogleGenAI({ apiKey });
            currentApiKey = apiKey;
        }
        return ai;
    };

    const getDirective = async (request: GetDirectiveRequest): Promise<EmotionDirective | null> => {
        const ai = getAI();
        try {
            const userPrompt = `The character is "${request.speaker}".
Their personality is: "${request.personalityPrompt || 'Not specified.'}"
They say the following line: "${request.dialogue}"
Generate a speech control prompt for this line.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: userPrompt,
                config: {
                    systemInstruction: request.systemPrompt,
                }
            });
            const directiveText = response.text.trim().replace(/["']/g, ''); // Clean up quotes
            return { text: `(${directiveText})` }; // Wrap in parens
        } catch (error) {
            console.error('Emotion Director directive generation failed:', error);
            return null;
        }
    };


  return (
    <EmotionDirectorContext.Provider value={{ getDirective }}>
      {children}
    </EmotionDirectorContext.Provider>
  );
};

export const useEmotionDirector = () => {
    const context = useContext(EmotionDirectorContext);
    if (!context) {
        throw new Error('useEmotionDirector must be used within a EmotionDirectorProvider');
    }
    return context;
};