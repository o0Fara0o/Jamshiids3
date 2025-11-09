/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';
import { createContext, FC, ReactNode, useContext } from 'react';
import { useAPIKey } from './APIKeyContext';
import { urlToInlineData } from '@/lib/utils';

interface GenerateVideoClipRequest {
    baseImageUrl: string;
    prompt: string;
}

interface VideoAgentContextType {
  generateVideoClip: (request: GenerateVideoClipRequest) => Promise<string | null>;
}

const VideoAgentContext = createContext<VideoAgentContextType | undefined>(undefined);

export const VideoAgentProvider: FC<{ children: ReactNode }> = ({ children }) => {
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

    const generateVideoClip = async (request: GenerateVideoClipRequest): Promise<string | null> => {
        const ai = getAI();
        try {
            const { baseImageUrl, prompt } = request;
            const image = await urlToInlineData(baseImageUrl);

            let operation = await ai.models.generateVideos({
              model: 'veo-2.0-generate-001',
              prompt,
              image: {
                imageBytes: image.data,
                mimeType: image.mimeType,
              },
              config: {
                numberOfVideos: 1
              }
            });
            
            while (!operation.done) {
              await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
              operation = await ai.operations.getVideosOperation({operation: operation});
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                const response = await fetch(`${downloadLink}&key=${apiKey}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch video: ${response.statusText}`);
                }
                const videoBlob = await response.blob();
                return URL.createObjectURL(videoBlob);
            }
            
            return null;

        } catch (error) {
            console.error('Video clip generation failed:', error);
            alert(`Video clip generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    };

    return (
        <VideoAgentContext.Provider value={{ generateVideoClip }}>
            {children}
        </VideoAgentContext.Provider>
    );
};

export const useVideoAgent = () => {
    const context = useContext(VideoAgentContext);
    if (!context) {
        throw new Error('useVideoAgent must be used within a VideoAgentProvider');
    }
    return context;
};
