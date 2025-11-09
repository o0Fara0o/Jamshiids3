/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// This context is deprecated. Its functionality has been merged into
// ThumbnailAgentContext.tsx as `generateBrollImage`. This file can be safely deleted.

import {
  GoogleGenAI,
  Modality,
} from '@google/genai';
import { createContext, FC, ReactNode, useContext } from 'react';
import { useAPIKey } from './APIKeyContext';
import { 
    useLogStore, 
    useHostStore, 
    useLaunchpadStore, 
    useVirtualSetStore,
    useVisualDirectorStore,
} from '@/lib/state';
import { urlToInlineData } from '@/lib/utils';

interface AgentImageResponse {
  imageUrl: string;
}

interface LiveBRollAgentContextType {
  generateBrollImage: () => Promise<AgentImageResponse | null>;
}

const LiveBRollAgentContext = createContext<LiveBRollAgentContextType | undefined>(undefined);

export const LiveBRollAgentProvider: FC<{ children: ReactNode }> = ({ children }) => {
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

    const generateBrollImage = async (): Promise<AgentImageResponse | null> => {
        const ai = getAI();
        try {
            // 1. Gather all inputs from state stores
            const { turns } = useLogStore.getState();
            const { getHostByName, host1Selection, host2Selection } = useHostStore.getState();
            const { generatedSceneUrl } = useLaunchpadStore.getState();
            const { sets, selectedSetId } = useVirtualSetStore.getState();
            const { liveBrollSystemPrompt } = useVisualDirectorStore.getState();

            const host1 = getHostByName(host1Selection);
            const host2 = getHostByName(host2Selection);
            
            const virtualSet = sets.find(s => s.id === selectedSetId);
            const recentTurns = turns.slice(-5);
            const transcriptSnippet = recentTurns
                .map(turn => `${turn.author}: ${turn.text}`)
                .join('\n');

            // 2. Validate inputs
            if (!host1 || !host2) {
                console.warn('B-Roll Agent: Missing one or both hosts.');
                return null;
            }
            if (!generatedSceneUrl && !virtualSet) {
                console.warn('B-Roll Agent: Missing generated scene and virtual set.');
                return null;
            }
            if (!transcriptSnippet.trim()) {
                console.warn('B-Roll Agent: No transcript to work with.');
                return null;
            }

            // 3. Prepare parts for Gemini API
            const parts: any[] = [];

            // Add images (hosts and set)
            const host1Data = await urlToInlineData(host1.primaryImageUrl);
            parts.push({ inlineData: host1Data });
            const host2Data = await urlToInlineData(host2.primaryImageUrl);
            parts.push({ inlineData: host2Data });
            
            const setImageUrl = generatedSceneUrl || virtualSet!.imageUrl;
            const setData = await urlToInlineData(setImageUrl);
            parts.push({ inlineData: setData });

            // Add text prompt
            const processedPrompt = liveBrollSystemPrompt
                .replace(/\$\{transcriptSnippet\}/g, transcriptSnippet);
            parts.push({ text: processedPrompt });
            
            // 4. Call Gemini API
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts },
                config: {
                    responseModalities: [Modality.IMAGE],
                }
            });

            // 5. Process response
            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
                return { imageUrl };
            }

            console.warn('B-Roll Agent: Model did not return an image.');
            return null;

        } catch (error) {
            console.error('Live B-Roll generation failed:', error);
            // Don't alert the user for an autonomous agent, just log it.
            return null;
        }
    };

    return (
        <LiveBRollAgentContext.Provider value={{ generateBrollImage }}>
            {children}
        </LiveBRollAgentContext.Provider>
    );
};

export const useLiveBRollAgent = () => {
    const context = useContext(LiveBRollAgentContext);
    if (!context) {
        throw new Error('useLiveBRollAgent must be used within a LiveBRollAgentProvider');
    }
    return context;
};