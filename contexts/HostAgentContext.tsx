/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';
import { createContext, FC, ReactNode, useContext } from 'react';
import { useAPIKey } from './APIKeyContext';
import { useHostCreationAgentStore } from '@/lib/state';


export interface HostProfile {
  name: string;
  bio: string;
  personalityPrompt: string;
}

interface CreateHostRequest {
    name: string;
    backgroundInfo: string;
    systemPrompt: string;
}

interface HostAgentContextType {
  createHostProfile: (request: CreateHostRequest) => Promise<HostProfile | null>;
}


const HostAgentContext = createContext<HostAgentContextType | undefined>(undefined);

export const HostAgentProvider: FC<{ children: ReactNode }> = ({ children }) => {
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

    const createHostProfile = async (request: CreateHostRequest): Promise<HostProfile | null> => {
        const ai = getAI();
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Create a profile for "${request.name}" based on this text: ${request.backgroundInfo}`,
                config: {
                    systemInstruction: request.systemPrompt,
                    responseMimeType: 'application/json',
                }
            });
            let jsonStr = response.text.trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            const profile = JSON.parse(jsonStr) as HostProfile;
            return profile;
        } catch (error) {
            console.error('Host profile creation failed:', error);
            alert('The host agent failed to generate a profile. Please check the console for errors.');
            return null;
        }
    };


  return (
    <HostAgentContext.Provider value={{ createHostProfile }}>
      {children}
    </HostAgentContext.Provider>
  );
};

export const useHostAgentContext = () => {
    const context = useContext(HostAgentContext);
    if (!context) {
        throw new Error('useHostAgentContext must be used within a HostAgentProvider');
    }
    return context;
};