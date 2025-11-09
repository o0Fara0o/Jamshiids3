/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from '@google/genai';
import { createContext, FC, ReactNode, useContext, useRef } from 'react';
import { useAPIKey } from './APIKeyContext';
import { AVAILABLE_TTS_MODELS } from '@/lib/constants';

interface MultiSpeakerConfig {
    speaker: string;
    voiceConfig: {
        prebuiltVoiceConfig: { voiceName: string };
    };
}

interface TTSAIContextType {
  synthesize: (text: string, voiceName: string, systemPrompt?: string) => Promise<string | null>;
  synthesizeMultiSpeaker: (text: string, speakers: MultiSpeakerConfig[], systemPrompt?: string) => Promise<string | null>;
}

const TTSAIContext = createContext<TTSAIContextType | undefined>(undefined);

// FIX: Refactor to use a module-level variable for the AI client.
// This avoids potential issues with useRef type inference that may be causing
// the "Expected 1 arguments, but got 0" error, and aligns with the pattern
// used in other working contexts in the application.
let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

export const TTSAIProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const API_KEY = useAPIKey();

  const initialize = () => {
    if (!ai || API_KEY !== currentApiKey) {
      ai = new GoogleGenAI({ apiKey: API_KEY });
      currentApiKey = API_KEY;
    }
  };

  const synthesize = async (text: string, voiceName: string, systemPrompt?: string): Promise<string | null> => {
    initialize();
    if (!ai) return null;

    try {
      const response = await ai.models.generateContent({
        model: AVAILABLE_TTS_MODELS.includes("gemini-2.5-pro-preview-tts") ? "gemini-2.5-pro-preview-tts" : AVAILABLE_TTS_MODELS[0],
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          ...(systemPrompt && { systemInstruction: systemPrompt }),
        },
      });

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return data || null;
    } catch (error) {
      console.error('TTS synthesis failed:', error);
      return null;
    }
  };

  const synthesizeMultiSpeaker = async (text: string, speakers: MultiSpeakerConfig[], systemPrompt?: string): Promise<string | null> => {
    initialize();
    if (!ai) return null;

    try {
      const response = await ai.models.generateContent({
        model: AVAILABLE_TTS_MODELS.includes("gemini-2.5-pro-preview-tts") ? "gemini-2.5-pro-preview-tts" : AVAILABLE_TTS_MODELS[0],
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: speakers,
            }
          },
          ...(systemPrompt && { systemInstruction: systemPrompt }),
        },
      });

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return data || null;
    } catch (error) {
      console.error('Multi-speaker TTS synthesis failed:', error);
      return null;
    }
  };

  return (
    <TTSAIContext.Provider value={{ synthesize, synthesizeMultiSpeaker }}>
      {children}
    </TTSAIContext.Provider>
  );
};

export const useTTSAIContext = () => {
  const context = useContext(TTSAIContext);
  if (!context) {
    throw new Error('useTTSAIContext must be used within a TTSAIProvider');
  }
  return context;
};
