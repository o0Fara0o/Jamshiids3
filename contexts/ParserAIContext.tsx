/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';
import { createContext, FC, ReactNode, useContext } from 'react';
import { useAPIKey } from './APIKeyContext';

interface ParserAIContextType {
  parseText: (text: string, systemPrompt: string) => Promise<string[] | null>;
}

const ParserAIContext = createContext<ParserAIContextType | undefined>(undefined);

export const ParserAIProvider: FC<{ children: ReactNode }> = ({ children }) => {
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

    const parseText = async (text: string, systemPrompt: string): Promise<string[] | null> => {
        const ai = getAI();
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: text,
                config: {
                    systemInstruction: systemPrompt,
                    responseMimeType: 'application/json'
                }
            });
            
            let jsonStr = response.text.trim();
            // Handle potential markdown
            const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            
            const sentences = JSON.parse(jsonStr) as string[];
            return sentences.filter(s => s.trim() !== ''); // Filter out empty strings
        } catch (error) {
            console.error('Parser AI failed:', error);
            alert('Failed to parse text into sentences. Please check the console for errors.');
            return null;
        }
    };


  return (
    <ParserAIContext.Provider value={{ parseText }}>
      {children}
    </ParserAIContext.Provider>
  );
};

export const useParserAI = () => {
    const context = useContext(ParserAIContext);
    if (!context) {
        throw new Error('useParserAI must be used within a ParserAIProvider');
    }
    return context;
};