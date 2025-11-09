/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Modality,
} from '@google/genai';
import { createContext, FC, ReactNode, useContext } from 'react';
import { useAPIKey } from './APIKeyContext';
import { urlToInlineData } from '@/lib/utils';

interface AgentImageResponse {
  imageUrl: string;
  revisedPrompt?: string;
}

interface ComposeSceneRequest {
  baseStudioUrl: string; // data: url
  host1ImageUrl: string; // data: url
  host2ImageUrl: string; // data: url
  prompt: string;
}

interface VirtualSetAgentContextType {
  generateVirtualSet: (prompt: string) => Promise<AgentImageResponse | null>;
  composeScene: (request: ComposeSceneRequest) => Promise<AgentImageResponse | null>;
}

const VirtualSetAgentContext = createContext<VirtualSetAgentContextType | undefined>(undefined);

export const VirtualSetAgentProvider: FC<{ children: ReactNode }> = ({ children }) => {
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

    const generateVirtualSet = async (prompt: string): Promise<AgentImageResponse | null> => {
        const ai = getAI();
        try {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: `A photorealistic, empty podcast studio background. ${prompt}. There should be no people in the image.`,
                config: {
                  numberOfImages: 1,
                  outputMimeType: 'image/png',
                  aspectRatio: '16:9',
                },
            });

            const genImage = response.generatedImages[0];
            const imageUrl = `data:image/png;base64,${genImage.image.imageBytes}`;
            // FIX: The 'revisedPrompt' property does not exist on the 'GeneratedImage' type.
            return { imageUrl };
        } catch (error) {
            console.error('Virtual set generation failed:', error);
            alert(`Virtual set generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    };

    const composeScene = async (request: ComposeSceneRequest): Promise<AgentImageResponse | null> => {
        const ai = getAI();
        try {
            const { baseStudioUrl, host1ImageUrl, host2ImageUrl, prompt } = request;
            
            // The `Part` type from the SDK is more complex, so defining a simpler one here for clarity.
            const parts: ({ inlineData: { data: string; mimeType: string; }; } | { text: string; })[] = [];

            // Base studio is required
            const studioData = await urlToInlineData(baseStudioUrl);
            parts.push({ inlineData: studioData });

            // Host 1 is optional
            if (host1ImageUrl) {
                const host1Data = await urlToInlineData(host1ImageUrl);
                parts.push({ inlineData: host1Data });
            }

            // Host 2 is optional
            if (host2ImageUrl) {
                const host2Data = await urlToInlineData(host2ImageUrl);
                parts.push({ inlineData: host2Data });
            }
            
            // Prompt is required
            parts.push({ text: prompt });

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                }
            });

            const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (part?.inlineData) {
                const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                return { imageUrl };
            }
            // Check for text response if image is missing, for debugging
            const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
            if (textPart?.text) {
                console.warn('Scene composition returned text instead of image:', textPart.text);
                alert(`Scene composition failed. The model responded: "${textPart.text}"`);
            }
            
            return null;
        } catch (error) {
            console.error('Scene composition failed:', error);
            alert(`Scene composition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    };

    return (
        <VirtualSetAgentContext.Provider value={{ generateVirtualSet, composeScene }}>
            {children}
        </VirtualSetAgentContext.Provider>
    );
};

export const useVirtualSetAgent = () => {
    const context = useContext(VirtualSetAgentContext);
    if (!context) {
        throw new Error('useVirtualSetAgent must be used within a VirtualSetAgentProvider');
    }
    return context;
};
