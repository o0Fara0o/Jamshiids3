/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { SentenceState, TranscriptType, usePostProductionStore, useHostStore, useAudioDirectorStore } from '@/lib/state';
import { useEmotionDirector } from '@/contexts/EmotionDirectorContext';
import { useTTSAIContext } from '@/contexts/TTSAIContext';
import { pcmToWav } from '@/lib/wav-encoder';
import { base64ToArrayBuffer } from '@/lib/utils';
import cn from 'classnames';

interface StudioSentenceProps {
    turnIndex: number;
    sentence: SentenceState;
    type: TranscriptType;
    author: string;
}

const StudioSentence: React.FC<StudioSentenceProps> = ({ turnIndex, sentence, type, author }) => {
    const store = usePostProductionStore();
    const audioDirectorStore = useAudioDirectorStore();
    const { getHostByName } = useHostStore.getState();
    const { getDirective } = useEmotionDirector();
    const { synthesize } = useTTSAIContext();
    
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(sentence.text);

    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            if (audio.duration > 0) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        };
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);
        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audioRef.current, sentence.audioData]); // Depend on audioData to re-attach listeners if audio changes

    const isAnyDirectiveLoading = sentence.directives.some(d => d.status === 'loading');
    const isLoading = sentence.status === 'synthesizing' || isAnyDirectiveLoading;

    const handleGenerateDirective = async () => {
        const host = getHostByName(author);
        const directorPrompt = audioDirectorStore[`${type}DirectorPrompt` as 'hostsDirectorPrompt' | 'fanDirectorPrompt' | 'judgeDirectorPrompt'];
        const directiveId = store.addDirectiveToSentence(type, turnIndex, sentence.id, { text: '', status: 'loading' });
        const result = await getDirective({
            dialogue: sentence.text,
            speaker: author,
            personalityPrompt: host?.prompt,
            systemPrompt: directorPrompt
        });
        if (result) {
            store.updateSentenceDirectiveState(type, turnIndex, sentence.id, directiveId, { text: result.text, status: 'idle' });
            if (sentence.directives.length === 1) { // Auto-select first one
                store.setSelectedDirectiveForSentence(type, turnIndex, sentence.id, directiveId);
            }
        } else {
             store.updateSentenceDirectiveState(type, turnIndex, sentence.id, directiveId, { text: '(Error)', status: 'idle' });
        }
    };
    
    const handleSynthesize = async () => {
        const selectedDirective = sentence.directives.find(d => d.id === sentence.selectedDirectiveId);
        if (!selectedDirective) { alert("Please select a directive."); return; }
        
        store.setSentenceStatus(type, turnIndex, sentence.id, 'synthesizing');
        try {
            const voiceMap = audioDirectorStore[`${type}VoiceMap` as 'hostVoiceMap' | 'fanVoiceMap' | 'judgeVoiceMap'];
            const voice = voiceMap[author] || 'Zephyr';
            const textToSynthesize = `${selectedDirective.text} ${sentence.text}`;
            const audioB64 = await synthesize(textToSynthesize, voice, audioDirectorStore.ttsSystemPrompt);
            if (audioB64) {
                store.setSentenceAudio(type, turnIndex, sentence.id, audioB64);
                store.setSentenceStatus(type, turnIndex, sentence.id, 'ready');
            } else throw new Error("Synthesis returned no data.");
        } catch(e) {
            store.setSentenceStatus(type, turnIndex, sentence.id, 'error');
        }
    };
    
    const handlePlayPause = () => {
        const audio = audioRef.current;
        if (audio) {
            if (isPlaying) {
                audio.pause();
            } else {
                audio.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (audio) {
            const newTime = (Number(e.target.value) / 100) * audio.duration;
            audio.currentTime = newTime;
            setProgress(Number(e.target.value));
        }
    };

    const handleSaveText = () => {
        store.updateSentenceText(type, turnIndex, sentence.id, editText);
        setIsEditing(false);
    };

    const handleDownload = () => {
      if (sentence.audioData) {
        const pcmBuffer = base64ToArrayBuffer(sentence.audioData);
        const pcm16 = new Int16Array(pcmBuffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;
        const wavBlob = pcmToWav(float32, 24000);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${author}_${sentence.id}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    };

    return (
        <div className={cn("sentence-row", `status-${sentence.status}`)}>
            <div className="sentence-main">
                <div className="sentence-directives">
                    {sentence.directives.map(d => (
                        <button key={d.id} className={cn('directive-suggestion-btn', {selected: sentence.selectedDirectiveId === d.id})} onClick={() => store.setSelectedDirectiveForSentence(type, turnIndex, sentence.id, d.id)}>
                            {d.status === 'loading' ? '...' : d.text}
                        </button>
                    ))}
                     <button onClick={handleGenerateDirective} disabled={isLoading} className="add-suggestion-btn" title="Get new suggestion">
                        <span className="icon">auto_awesome</span>
                    </button>
                </div>
                {isEditing ? (
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} onBlur={handleSaveText} autoFocus />
                ) : (
                    <p onClick={() => setIsEditing(true)}>{sentence.text}</p>
                )}
            </div>
            <div className="sentence-player">
                {sentence.status === 'ready' && sentence.audioData && (
                    <div className="mini-player">
                        <audio ref={audioRef} src={`data:audio/wav;base64,${sentence.audioData}`} style={{display: 'none'}} />
                        <button onClick={handlePlayPause}>
                            <span className="icon">{isPlaying ? 'pause' : 'play_arrow'}</span>
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={progress}
                            onChange={handleSliderChange}
                            className="slider-track"
                        />
                    </div>
                )}
            </div>
            <div className="sentence-actions">
                 <button onClick={handleSynthesize} disabled={isLoading || !sentence.selectedDirectiveId} title="Synthesize/Regenerate Audio">
                    <span className={cn("icon", {'sync': sentence.status === 'synthesizing'})}>{sentence.status === 'synthesizing' ? 'sync' : 'graphic_eq'}</span>
                 </button>
                 <button onClick={handleDownload} disabled={sentence.status !== 'ready'} title="Download">
                    <span className="icon">download</span>
                 </button>
            </div>
        </div>
    );
};

export default StudioSentence;