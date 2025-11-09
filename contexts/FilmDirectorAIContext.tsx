/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';
import { createContext, FC, ReactNode, useContext } from 'react';
import { useAPIKey } from './APIKeyContext';
import { useFilmDirectorAgentStore, ScenePlan } from '@/lib/state';

interface GenerateScriptRequest {
    transcript: string;
    hostNames: string[];
    virtualSetDescription: string;
}

interface FilmDirectorAIContextType {
  generateShootingScript: (request: GenerateScriptRequest) => AsyncGenerator<ScenePlan, void, unknown>;
}


const FilmDirectorAIContext = createContext<FilmDirectorAIContextType | undefined>(undefined);

export const FilmDirectorAIProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const apiKey = useAPIKey();
    const { scriptGenerationPrompt, scriptGenerationModel } = useFilmDirectorAgentStore();
    let ai: GoogleGenAI | null = null;
    let currentApiKey: string | null = null;

    const getAI = () => {
        if (!ai || currentApiKey !== apiKey) {
            ai = new GoogleGenAI({ apiKey });
            currentApiKey = apiKey;
        }
        return ai;
    };

    const generateShootingScript = async function* (request: GenerateScriptRequest): AsyncGenerator<ScenePlan, void, unknown> {
        const ai = getAI();
        try {
            const userPrompt = `
                **Transcript:**\n${request.transcript}\n
                **Hosts:** ${request.hostNames.join(', ')}\n
                **Virtual Set:** ${request.virtualSetDescription}\n
            `;

            const responseStream = await ai.models.generateContentStream({
                model: scriptGenerationModel,
                contents: { parts: [{ text: userPrompt }] },
                config: {
                    systemInstruction: scriptGenerationPrompt,
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                transcriptChunk: { type: Type.STRING },
                                shotType: { type: Type.STRING },
                                cameraAngle: { type: Type.STRING },
                                cameraMovement: { type: Type.STRING },
                                actionPrompt: { type: Type.STRING },
                                bRollPrompt: { type: Type.STRING },
                                transitionEffect: { type: Type.STRING },
                            },
                            required: [
                                'transcriptChunk',
                                'shotType',
                                'cameraAngle',
                                'cameraMovement',
                                'actionPrompt',
                                'bRollPrompt',
                                'transitionEffect',
                            ],
                        },
                    },
                }
            });

            let buffer = '';
            let objectDepth = 0;
            let objectStartIndex = -1;

            for await (const chunk of responseStream) {
                // Defensively add commas between adjacent objects in a single chunk
                const textChunk = chunk.text.replace(/\}\{/g, '},{');
                buffer += textChunk;

                // This is a robust parser for a stream of an array of objects.
                // It works by tracking brace depth to find complete objects.
                let i = 0;
                while (i < buffer.length) {
                    const char = buffer[i];
                    if (char === '{') {
                        if (objectDepth === 0) {
                            objectStartIndex = i;
                        }
                        objectDepth++;
                    } else if (char === '}') {
                        if (objectDepth > 0) {
                            objectDepth--;
                            if (objectDepth === 0 && objectStartIndex !== -1) {
                                const objectStr = buffer.substring(objectStartIndex, i + 1);
                                try {
                                    const scene = JSON.parse(objectStr);
                                    yield scene as ScenePlan;
                                    
                                    // Reset for next object
                                    buffer = buffer.substring(i + 1);
                                    i = -1; 
                                    objectStartIndex = -1;
                                } catch (e) {
                                    // This might happen if a '}' appears inside a string value.
                                    // For this specific schema, it's unlikely, but we log it.
                                    // The objectDepth counter should prevent premature parsing.
                                    console.warn('Skipping potential partial JSON object:', e);
                                }
                            }
                        }
                    }
                    i++;
                }
            }
            
        } catch (error) {
            console.error('Shooting script generation failed:', error);
            alert('The Film Director AI failed to generate a script. Please check the console for errors.');
        }
    };


  return (
    <FilmDirectorAIContext.Provider value={{ generateShootingScript }}>
      {children}
    </FilmDirectorAIContext.Provider>
  );
};

export const useFilmDirectorAI = () => {
    const context = useContext(FilmDirectorAIContext);
    if (!context) {
        throw new Error('useFilmDirectorAI must be used within a FilmDirectorAIProvider');
    }
    return context;
};