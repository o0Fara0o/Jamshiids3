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
import { 
    useLogStore, 
    useHostStore, 
    useLaunchpadStore, 
    useVirtualSetStore,
    useVisualDirectorStore,
} from '@/lib/state';

interface AgentImageResponse {
  imageUrl: string;
  revisedPrompt?: string;
}

interface GenerateImageRequest {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16';
}

interface EditImageRequest {
  baseImage: {
    data: string; // base64
    mimeType: string;
  };
  prompt: string;
  editImage?: {
    data: string; // base64
    mimeType: string;
  };
}

export interface GenerateThumbnailVariationsRequest {
    liveSceneUrl: string; // The composed image of hosts in the studio
    templateStylePrompt: string;
    episodeTitle: string;
    hostNames: string[];
    keyMoment?: string;
    compositionBrief: string;
}

interface ThumbnailAgentContextType {
  generateImage: (request: GenerateImageRequest) => Promise<AgentImageResponse | null>;
  editImage: (request: EditImageRequest) => Promise<AgentImageResponse | null>;
  generateThumbnailVariations: (request: GenerateThumbnailVariationsRequest) => Promise<string[]>;
  generateBrollImage: () => Promise<AgentImageResponse | null>;
}

const ThumbnailAgentContext = createContext<ThumbnailAgentContextType | undefined>(undefined);

export const ThumbnailAgentProvider: FC<{ children: ReactNode }> = ({ children }) => {
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

    const generateImage = async (request: GenerateImageRequest): Promise<AgentImageResponse | null> => {
        const ai = getAI();
        try {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: request.prompt,
                config: {
                  numberOfImages: 1,
                  outputMimeType: 'image/png',
                  aspectRatio: request.aspectRatio || '1:1',
                },
            });

            const genImage = response.generatedImages[0];
            const imageUrl = `data:image/png;base64,${genImage.image.imageBytes}`;
            // FIX: The 'revisedPrompt' property does not exist on the 'GeneratedImage' type.
            return { imageUrl };
        } catch (error) {
            console.error('Image generation failed:', error);
            alert(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    };

    const editImage = async (request: EditImageRequest): Promise<AgentImageResponse | null> => {
        const ai = getAI();
        try {
            const parts = [
                { inlineData: { data: request.baseImage.data, mimeType: request.baseImage.mimeType } },
                { text: request.prompt }
            ];

            if (request.editImage) {
                parts.push({ inlineData: { data: request.editImage.data, mimeType: request.editImage.mimeType } });
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                }
            });

            const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (part?.inlineData) {
                const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                return { imageUrl };
            }
            return null;
        } catch (error) {
            console.error('Image editing failed:', error);
            alert(`Image editing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    };

    const generateThumbnailVariations = async (request: GenerateThumbnailVariationsRequest): Promise<string[]> => {
        const { liveSceneUrl, templateStylePrompt, episodeTitle, hostNames, keyMoment, compositionBrief } = request;
        const ai = getAI();

        const masterPrompt = `
          **Objective:** Create a visually stunning YouTube thumbnail for a podcast episode.
          **Episode Title:** "${episodeTitle}"
          **Hosts:** ${hostNames.join(' and ')}
          
          **Style & Mood Guide:** ${templateStylePrompt}
          
          **Specific Instructions for This Episode:** ${compositionBrief}
          
          ${keyMoment ? `**Key Moment/Quote to Incorporate Visually (no text):** "${keyMoment}"` : ''}
    
          **Assets:** Use the provided image of the hosts in their studio scene as a strong visual reference for their appearance, clothing, and the environment. The final output should feel cohesive with this asset.
          
          **Final Output Rules:**
          - Aspect ratio: 16:9.
          - ABSOLUTELY NO TEXT. The image should be purely visual.
          - The final image should be photorealistic, high-quality, and eye-catching.
        `;
    
        const variationPrompts = [
            `Variation 1 (Dramatic Lighting): ${masterPrompt} Focus on high-contrast, cinematic lighting to create a moody and intriguing atmosphere. One host should be in shadow.`,
            `Variation 2 (Dynamic Action): ${masterPrompt} Depict the hosts in a moment of animated conversation. Use dynamic angles and expressive body language.`,
            `Variation 3 (Clean & Bold): ${masterPrompt} Use a brighter, cleaner aesthetic with bold colors that pop. Focus on clear, engaging, close-up expressions.`,
        ];

        const generatedImages: string[] = [];

        try {
            const liveSceneData = await urlToInlineData(liveSceneUrl);

            for (const prompt of variationPrompts) {
                 const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: {
                        parts: [
                            { inlineData: liveSceneData },
                            { text: prompt }
                        ]
                    },
                    config: {
                        responseModalities: [Modality.IMAGE],
                    }
                });

                const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (part?.inlineData) {
                    const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                    generatedImages.push(imageUrl);
                }
            }
        } catch (error) {
            console.error('Thumbnail variation generation failed:', error);
            alert(`Thumbnail generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return generatedImages;
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
        <ThumbnailAgentContext.Provider value={{ generateImage, editImage, generateThumbnailVariations, generateBrollImage }}>
            {children}
        </ThumbnailAgentContext.Provider>
    );
};

export const useThumbnailAgent = () => {
    const context = useContext(ThumbnailAgentContext);
    if (!context) {
        throw new Error('useThumbnailAgent must be used within a ThumbnailAgentProvider');
    }
    return context;
};