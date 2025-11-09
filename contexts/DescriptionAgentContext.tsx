/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';
import { createContext, FC, ReactNode, useContext } from 'react';
import { useAPIKey } from './APIKeyContext';
import { useDescriptionAgentStore } from '@/lib/state';

export interface EpisodeMetadata {
  title: string;
  description: string;
  subject: string;
}

interface DescriptionAgentContextType {
  generateDescription: (context: string) => Promise<EpisodeMetadata | null>;
}

const DescriptionAgentContext = createContext<DescriptionAgentContextType | undefined>(undefined);

export const DescriptionAgentProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const apiKey = useAPIKey();
    const { systemPrompt } = useDescriptionAgentStore();
    let ai: GoogleGenAI | null = null;
    let currentApiKey: string | null = null;

    const getAI = () => {
        if (!ai || currentApiKey !== apiKey) {
            ai = new GoogleGenAI({ apiKey });
            currentApiKey = apiKey;
        }
        return ai;
    };

    const generateDescription = async (context: string): Promise<EpisodeMetadata | null> => {
        const ai = getAI();
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Generate the metadata for a podcast episode based on this topic/context: ${context}`,
                config: {
                    systemInstruction: systemPrompt,
                    responseMimeType: 'application/json',
                }
            });
            let jsonStr = response.text.trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            const metadata = JSON.parse(jsonStr) as EpisodeMetadata;
            return metadata;
        } catch (error) {
            console.error('Episode metadata generation failed:', error);
            alert('The description agent failed to generate metadata. Please check the console for errors.');
            return null;
        }
    };

  return (
    <DescriptionAgentContext.Provider value={{ generateDescription }}>
      {children}
    </DescriptionAgentContext.Provider>
  );
};

export const useDescriptionAgent = () => {
    const context = useContext(DescriptionAgentContext);
    if (!context) {
        throw new Error('useDescriptionAgent must be used within a DescriptionAgentProvider');
    }
    return context;
};