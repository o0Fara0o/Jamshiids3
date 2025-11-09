/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useCallback, useEffect } from 'react';
import { usePostProductionStore, TranscriptType, useAudioDirectorStore } from '@/lib/state';
import { useTTSAIContext } from '@/contexts/TTSAIContext';
import { base64ToArrayBuffer } from '@/lib/utils';
import { pcmToWav } from '@/lib/wav-encoder';
import { AVAILABLE_TTS_VOICES } from '@/lib/constants';
import StudioParsedTurn from './StudioParsedTurn';
import cn from 'classnames';
import { useParserAI } from '@/contexts/ParserAIContext';

interface TranscriptEditorProps {
    type: TranscriptType;
}

const TranscriptEditor: React.FC<TranscriptEditorProps> = ({ type }) => {
    const store = usePostProductionStore();
    const audioDirectorStore = useAudioDirectorStore();
    const { synthesize, synthesizeMultiSpeaker } = useTTSAIContext();
    const { parseText } = useParserAI();

    const [masterAudioUrl, setMasterAudioUrl] = useState<string | null>(null);
    const [isBatchParsing, setIsBatchParsing] = useState(false);

    const transcript = store[`${type}Transcript`];
    const overallStatus = store.overallStatus[type];

    const {
      batchSize, setBatchSize,
      setOverallStatus
    } = store;

    useEffect(() => {
        // Revoke the object URL on cleanup
        return () => {
            if (masterAudioUrl) {
                URL.revokeObjectURL(masterAudioUrl);
            }
        };
    }, [masterAudioUrl]);
    
    const handleBatchSynthesize = useCallback(async () => {
        setOverallStatus(type, 'synthesizing');
        if (masterAudioUrl) {
            URL.revokeObjectURL(masterAudioUrl);
            setMasterAudioUrl(null);
        }

        const voiceMap = audioDirectorStore[`${type}VoiceMap` as 'hostVoiceMap' | 'fanVoiceMap' | 'judgeVoiceMap'];
        const turnsToSynthesize = transcript
            .map((turn, index) => ({ turn, index }))
            .filter(({ turn }) => voiceMap[turn.originalTurn.author] && turn.originalTurn.text.trim());

        if (type === 'hosts') {
            // Special multi-speaker logic for hosts
            const script = turnsToSynthesize.map(({ turn }) => {
                const directiveText = turn.turnDirective?.text || '';
                return `${turn.originalTurn.author}: ${directiveText} ${turn.originalTurn.text}`;
            }).join('\n');

            const speakers = Object.entries(voiceMap).map(([speaker, voiceName]) => ({
                speaker,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName as string } }
            }));
            
            if (speakers.length !== 2) {
                const hostNames = speakers.map(s => s.speaker).join(', ');
                alert(`Multi-speaker synthesis requires exactly 2 hosts for the session, but ${speakers.length} were detected: ${hostNames}. Please ensure the session only contains dialogue from two hosts.`);
                console.error(`Multi-speaker synthesis requires exactly 2 hosts, but found ${speakers.length}. Aborting.`);
                setOverallStatus(type, 'error');
                return;
            }

            try {
                const audioB64 = await synthesizeMultiSpeaker(script, speakers, audioDirectorStore.ttsSystemPrompt);
                if (audioB64) {
                    const pcmBuffer = base64ToArrayBuffer(audioB64);
                    const pcm16 = new Int16Array(pcmBuffer);
                    const float32 = new Float32Array(pcm16.length);
                    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;
                    const wavBlob = pcmToWav(float32, 24000);
                    const url = URL.createObjectURL(wavBlob);
                    setMasterAudioUrl(url);
                } else {
                    throw new Error('Multi-speaker synthesis returned no data.');
                }
            } catch (error) {
                console.error('Multi-speaker synthesis failed:', error);
                setOverallStatus(type, 'error');
                return;
            }
        } else {
            // Single-speaker logic for fan/judge
            for (let i = 0; i < turnsToSynthesize.length; i += batchSize) {
                const batch = turnsToSynthesize.slice(i, i + batchSize);
                const promises = batch.map(async ({ turn, index }) => {
                    store.setSentenceStatus(type, index, '0', 'synthesizing'); // Assuming one sentence for now
                    try {
                        const voice = voiceMap[turn.originalTurn.author] || AVAILABLE_TTS_VOICES[0];
                        const textToSynthesize = `${turn.turnDirective?.text || ''} ${turn.originalTurn.text}`;
                        const audioB64 = await synthesize(textToSynthesize, voice, audioDirectorStore.ttsSystemPrompt);
                        if (audioB64) {
                            store.setSentenceAudio(type, index, '0', audioB64);
                            store.setSentenceStatus(type, index, '0', 'ready');
                        } else throw new Error('Synthesis returned no data.');
                    } catch (error) {
                        console.error(`Synthesis failed for ${type} turn ${index}:`, error);
                        store.setSentenceStatus(type, index, '0', 'error');
                    }
                });
                await Promise.all(promises);
            }
        }

        setOverallStatus(type, 'complete');
    }, [type, transcript, batchSize, setOverallStatus, masterAudioUrl, synthesize, synthesizeMultiSpeaker, store, audioDirectorStore]);

    const handleExport = () => {
        alert('Exporting WAV...');
    };
    
    const handleBatchParse = async () => {
        setIsBatchParsing(true);
        const parserPrompt = audioDirectorStore[`${type}ParserPrompt` as 'hostsParserPrompt' | 'fanParserPrompt' | 'judgeParserPrompt'];
        for (const [index, turn] of transcript.entries()) {
            if (!turn.isParsedToSentences && turn.originalTurn.text.trim()) {
                const sentences = await parseText(turn.originalTurn.text, parserPrompt);
                if (sentences) {
                    store.parseTurnToSentences(type, index, sentences);
                }
            }
        }
        setIsBatchParsing(false);
    };

    const title = type === 'hosts' ? (store.loadedSession?.episodeTitle || "Hosts Chat") : type === 'fan' ? 'Fan Chat' : 'Judge AI';

    return (
        <div className="transcript-editor-container">
            <div className="studio-header">
              <h3>{title}</h3>
               <div className="studio-controls">
                  <div className="batch-control">
                      <label htmlFor={`${type}-batch-size`}>Batch Size: {batchSize}</label>
                      <input type="range" id={`${type}-batch-size`} min="1" max="20" value={batchSize} onChange={e => setBatchSize(parseInt(e.target.value, 10))} />
                  </div>
                  {type === 'hosts' && (
                     <button className="secondary-btn" onClick={() => store.setSession(null)}>
                        <span className="icon">swap_horiz</span> Change Session
                    </button>
                  )}
                  <button className="secondary-btn" onClick={handleBatchParse} disabled={isBatchParsing}>
                        <span className={cn("icon", {'sync': isBatchParsing})}>{isBatchParsing ? 'sync' : 'segment'}</span>
                        Parse All to Sentences
                  </button>
                  <button className="secondary-btn" onClick={handleExport} disabled={overallStatus === 'synthesizing'}>
                        <span className="icon">download</span> Export WAV
                  </button>
                  <button className="primary-btn" onClick={handleBatchSynthesize} disabled={overallStatus === 'synthesizing'}>
                       <span className={cn("icon", {'sync': overallStatus === 'synthesizing'})}>
                          {overallStatus === 'synthesizing' ? 'sync' : 'playlist_play'}
                      </span>
                      {overallStatus === 'synthesizing' ? 'Synthesizing...' : 'Synthesize All'}
                  </button>
               </div>
            </div>
            <main className="studio-transcript-editor">
                {masterAudioUrl && type === 'hosts' && (
                     <div className="master-audio-player-container">
                        <h4>Full Conversation Preview</h4>
                        <audio controls src={masterAudioUrl}></audio>
                    </div>
                )}
                {transcript.map((parsedTurn, index) => {
                    const voiceMap = audioDirectorStore[`${type}VoiceMap` as 'hostVoiceMap' | 'fanVoiceMap' | 'judgeVoiceMap'];
                    if (voiceMap[parsedTurn.originalTurn.author] && parsedTurn.originalTurn.text.trim()) {
                        return (
                          <StudioParsedTurn
                            parsedTurn={parsedTurn}
                            index={index}
                            type={type}
                            key={`${store.loadedSession?.id}-${type}-${index}`}
                          />
                        );
                    }
                    return null;
                })}
                {transcript.length === 0 && (
                    <div className="audio-studio-placeholder" style={{height: '100%'}}>
                        <p>{`No turns yet for ${type} transcript.`}</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default TranscriptEditor;