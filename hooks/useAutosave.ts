/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef } from 'react';
import { useLogStore, useFanStore, useJudgeStore, useMediaStore, usePodcastStore, useAudioStore } from '@/lib/state';
import { saveOrUpdateSession } from '@/lib/db';
import { pcmToWav } from '@/lib/wav-encoder';

const AUTOSAVE_INTERVAL = 15000; // 15 seconds

export function useAutosave() {
  const sessionStartTime = useLogStore(state => state.sessionStartTime);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const performAutosave = async () => {
      const { sessionStartTime, turns: mainTranscript } = useLogStore.getState();
      if (!sessionStartTime) return;

      const { turns: fanTranscript } = useFanStore.getState();
      const { turns: judgeTranscript } = useJudgeStore.getState();
      const { images } = useMediaStore.getState();
      const { podcastName, episodeTitle, channel, podcastFormat, sourceContext } = usePodcastStore.getState();
      const { aiAudioChunks, micAudioChunks } = useAudioStore.getState();

      try {
        // AI-generated Audio
        let audioBlob: Blob | undefined;
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

        // User Microphone Audio
        let micAudioBlob: Blob | undefined;
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
          images,
          audioBlob,
          micAudioBlob,
          status: 'incomplete',
        });
        console.log(`Autosaved session ${sessionStartTime} at ${new Date().toLocaleTimeString()}`);
      } catch (error) {
        console.error("Autosave failed:", error);
      }
    };

    if (sessionStartTime) {
      if (intervalRef.current === null) {
        // Start autosaving
        intervalRef.current = window.setInterval(performAutosave, AUTOSAVE_INTERVAL);
      }
    } else {
      // Stop autosaving
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      // Cleanup on unmount
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sessionStartTime]);
}