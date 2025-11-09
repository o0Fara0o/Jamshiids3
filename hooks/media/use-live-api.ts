/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,

 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import {
  LiveConnectConfig,
  Modality,
  LiveServerToolCall,
  FunctionResponseScheduling,
} from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext, encode } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { useAgentStore, useDescriptionAgentStore, useFanStore, useFilmDirectorAgentStore, useHostCreationAgentStore, useHostStore, useJudgeStore, useLaunchpadStore, useLogStore, useMediaStore, usePodcastStore, usePostProductionStore, useProducerStudioStore, useSettings, useTools, useVirtualSetStore, useAudioStore } from '@/lib/state';
import { pcmToWav } from '../../lib/wav-encoder';
import { saveOrUpdateSession } from '@/lib/db';
import { AudioRecorder } from '../../lib/audio-recorder';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;

  connect: () => Promise<void>;
  disconnect: () => void;
  saveSession: () => Promise<void>;
  connected: boolean;
  isConnecting: boolean;
  isSaving: boolean;
  isSetupComplete: boolean;

  volume: number;
  muted: boolean;
  setMuted: (muted: boolean) => void;
};

export function useLiveApi({
  apiKey,
}: {
  apiKey: string;
}): UseLiveApiResults {
  const { model, automaticFunctionResponse } = useSettings();
  const { tools } = useTools();
  const client = useMemo(() => new GenAILiveClient(apiKey, model), [apiKey, model]);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);

  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({});
  const [muted, setMuted] = useState(false);

  // Microphone input handling
  useEffect(() => {
    if (connected && !muted) {
      // Lazily create the recorder
      if (!audioRecorderRef.current) {
        audioRecorderRef.current = new AudioRecorder();
      }

      const onData = (arrayBuffer: ArrayBuffer) => {
        // 1. Encode for streaming to API
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64Audio = encode(uint8Array);
        client.sendRealtimeInput([{ mimeType: 'audio/pcm;rate=16000', data: base64Audio }]);
        
        // 2. Store raw data for session saving
        const int16View = new Int16Array(arrayBuffer);
        const float32Chunk = new Float32Array(int16View.length);
        for (let i = 0; i < int16View.length; i++) {
          float32Chunk[i] = int16View[i] / 32768.0;
        }
        useAudioStore.getState().addMicChunk(float32Chunk);
      };

      audioRecorderRef.current.on('data', onData);
      audioRecorderRef.current.start();

      return () => {
        // Cleanup when effect re-runs or component unmounts
        audioRecorderRef.current?.off('data', onData);
        audioRecorderRef.current?.stop();
        audioRecorderRef.current = null; // Destroy instance
      };
    } else if (audioRecorderRef.current) {
        // If not connected or muted, ensure recorder is stopped and destroyed
        audioRecorderRef.current.stop();
        audioRecorderRef.current = null;
    }
  }, [connected, client, muted]);


  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out', sampleRate: 24000 }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          })
          .catch(err => {
            console.error('Error adding worklet:', err);
          });
      });
    }
  }, []);

  useEffect(() => {
    const onOpen = () => {
      console.log(`[${new Date().toISOString()}] DEBUG: onOpen event received. Setting connected = true.`);
      setConnected(true);
      setIsConnecting(false);
    };

    const onClose = async () => {
      console.log(`[${new Date().toISOString()}] DEBUG: onClose event received. Setting connected = false.`);
      setIsConnecting(false);
      setConnected(false);
      setIsSetupComplete(false);
      setMuted(false);
      
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
    };

    const onSetupComplete = () => {
      setIsSetupComplete(true);
    };

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
    };

    const onAudio = (data: ArrayBuffer) => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
      }

      // Also decode and store it for saving
      const int16View = new Int16Array(data);
      const float32Chunk = new Float32Array(int16View.length);
      for (let i = 0; i < int16View.length; i++) {
        float32Chunk[i] = int16View[i] / 32768.0;
      }
      useAudioStore.getState().addAiChunk(float32Chunk);
    };

    const onToolCall = (toolCall: LiveServerToolCall) => {
      const { addTurn } = useLogStore.getState();

      addTurn({
        role: 'system',
        author: 'System',
        text: '',
        isFinal: true,
        toolUseRequest: toolCall,
      });

      if (!automaticFunctionResponse) return;

      const functionResponses: any[] = [];

      for (const fc of toolCall.functionCalls) {
        const toolConfig = tools.find(t => t.name === fc.name);

        // Prepare the response
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: {
            result: 'ok',
            scheduling:
              toolConfig?.scheduling || FunctionResponseScheduling.INTERRUPT,
          },
        });
      }

      const toolResponse = { functionResponses: functionResponses };
      client.sendToolResponse(toolResponse);

      addTurn({
        role: 'system',
        author: 'System',
        text: '',
        isFinal: true,
        toolUseResponse: toolResponse,
      });
    };

    // Bind event listeners
    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('setupcomplete', onSetupComplete);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);
    client.on('toolcall', onToolCall);

    return () => {
      // Clean up event listeners
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('setupcomplete', onSetupComplete);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
      client.off('toolcall', onToolCall);
    };
  }, [client, automaticFunctionResponse, tools]);

  const connect = useCallback(async () => {
    console.log(`[${new Date().toISOString()}] DEBUG: connect function called.`);
    if (!config) {
      throw new Error('config has not been set');
    }
    if (isConnecting || connected) return;

    setIsConnecting(true);
    setIsSetupComplete(false);
    client.disconnect();
    
    // Clear all buffers for the new session
    useAudioStore.getState().clearAll();

    if (audioStreamerRef.current) {
      await audioStreamerRef.current.resume();
    }
    useLogStore.getState().startSession(); // Set start time and clear old turns
    try {
      await client.connect(config);
    } catch (e) {
      setIsConnecting(false);
    }
  }, [client, config, isConnecting, connected]);

  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  const saveSession = useCallback(async () => {
    const { sessionStartTime, turns: mainTranscript, clearTurns } = useLogStore.getState();
    if (!sessionStartTime) {
      alert("There's no active session to save.");
      return;
    }

    setIsSaving(true);
    try {
      // Transcripts & Media
      const { turns: fanTranscript, clearTurns: clearFanTurns } = useFanStore.getState();
      const { turns: judgeTranscript, clearTurns: clearJudgeTurns } = useJudgeStore.getState();
      const { images, clearMedia } = useMediaStore.getState();
      const { podcastName, episodeTitle, channel, podcastFormat, sourceContext } = usePodcastStore.getState();
      const { aiAudioChunks, micAudioChunks, recoveredAiBlob, recoveredMicBlob, clearAll: clearAudio } = useAudioStore.getState();

      let audioBlob: Blob | undefined = recoveredAiBlob || undefined;
      let micAudioBlob: Blob | undefined = recoveredMicBlob || undefined;

      // If it's not a recovered session (no recovered blobs), process live chunks
      if (!audioBlob) {
        const totalLength = aiAudioChunks.reduce((acc, val) => acc + val.length, 0);
        if (totalLength > 0) {
          const concatenatedAudio = new Float32Array(totalLength);
          let offset = 0;
          for (const chunk of aiAudioChunks) {
            concatenatedAudio.set(chunk, offset);
            offset += chunk.length;
          }
          audioBlob = pcmToWav(concatenatedAudio, 24000);
        }
      }

      if (!micAudioBlob) {
        const micTotalLength = micAudioChunks.reduce((acc, val) => acc + val.length, 0);
        if (micTotalLength > 0) {
          const micConcatenatedAudio = new Float32Array(micTotalLength);
          let micOffset = 0;
          for (const chunk of micAudioChunks) {
            micConcatenatedAudio.set(chunk, micOffset);
            micOffset += chunk.length;
          }
          micAudioBlob = pcmToWav(micConcatenatedAudio, 16000);
        }
      }

      // --- Comprehensive Config Snapshot ---
      // This strips out the functions (actions) from each store's state
      // to prevent "could not be cloned" errors when saving to IndexedDB.
      const getCleanState = <T extends {}>(state: T): Omit<T, keyof { [K in keyof T as T[K] extends Function ? K : never]: T[K] }> => {
        const cleanState: any = {};
        for (const key in state) {
            if (typeof state[key] !== 'function') {
                cleanState[key] = state[key];
            }
        }
        return cleanState;
      };

      const sessionConfig = {
        producerStudio: getCleanState(useProducerStudioStore.getState()),
        hostCreationAgent: getCleanState(useHostCreationAgentStore.getState()),
        descriptionAgent: getCleanState(useDescriptionAgentStore.getState()),
        filmDirectorAgent: getCleanState(useFilmDirectorAgentStore.getState()),
        agentStore: getCleanState(useAgentStore.getState()),
        settings: getCleanState(useSettings.getState()),
        tools: getCleanState(useTools.getState()),
        hostStore: getCleanState(useHostStore.getState()),
        virtualSetStore: getCleanState(useVirtualSetStore.getState()),
        launchpad: getCleanState(useLaunchpadStore.getState()),
      };


      await saveOrUpdateSession({
        id: sessionStartTime,
        podcastName,
        episodeTitle,
        channel,
        podcastFormat,
        sourceContext,
        mainTranscript,
        fanTranscript,
        judgeTranscript,
        audioBlob,
        micAudioBlob,
        images,
        sessionConfig,
        status: 'complete',
      });
      
      // Clear runtime state after successful save
      clearTurns();
      clearFanTurns();
      clearJudgeTurns();
      clearMedia();
      clearAudio();
      alert(`Session "${episodeTitle}" saved successfully!`);

    } catch (error) {
      console.error("Failed to save session:", error);
      alert(`There was an error saving the session. ${error}`);
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    isConnecting,
    isSaving,
    isSetupComplete,
    disconnect,
    saveSession,
    volume,
    muted,
    setMuted,
  };
}