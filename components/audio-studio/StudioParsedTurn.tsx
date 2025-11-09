/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { ParsedTurn, TranscriptType, usePostProductionStore, useHostStore, useAudioDirectorStore } from '@/lib/state';
import { useParserAI } from '@/contexts/ParserAIContext';
import { useEmotionDirector } from '@/contexts/EmotionDirectorContext';
import StudioSentence from './StudioSentence';
import cn from 'classnames';

interface StudioParsedTurnProps {
    parsedTurn: ParsedTurn;
    index: number;
    type: TranscriptType;
}

const StudioParsedTurn: React.FC<StudioParsedTurnProps> = ({ parsedTurn, index, type }) => {
    const store = usePostProductionStore();
    const audioDirectorStore = useAudioDirectorStore();
    const { getHostByName } = useHostStore.getState();
    const { parseText } = useParserAI();
    const { getDirective } = useEmotionDirector();
    const [isParsing, setIsParsing] = useState(false);

    const handleParse = async () => {
        setIsParsing(true);
        const parserPrompt = audioDirectorStore[`${type}ParserPrompt` as 'hostsParserPrompt' | 'fanParserPrompt' | 'judgeParserPrompt'];
        const sentences = await parseText(parsedTurn.originalTurn.text, parserPrompt);
        if (sentences) {
            store.parseTurnToSentences(type, index, sentences);
        }
        setIsParsing(false);
    };

    const handleGenerateTurnDirective = async () => {
        const host = getHostByName(parsedTurn.originalTurn.author);
        const result = await getDirective({
            dialogue: parsedTurn.originalTurn.text,
            speaker: parsedTurn.originalTurn.author,
            personalityPrompt: host?.prompt,
            systemPrompt: audioDirectorStore.directorSystemPrompt,
        });
        // Logic to add this turn-level directive to the state
    };

    const hostVoiceMap = audioDirectorStore.hostVoiceMap;
    const authorClass = type === 'hosts' && hostVoiceMap[Object.keys(hostVoiceMap)[0]] === hostVoiceMap[parsedTurn.originalTurn.author]
        ? 'author-host-1-color'
        : 'author-host-2-color';

    return (
        <div className="parsed-turn-container">
            <div className="turn-header">
                <strong className={cn('turn-author', authorClass)}>{parsedTurn.originalTurn.author}</strong>
                <div className="turn-controls">
                     {!parsedTurn.isParsedToSentences && (
                         <button onClick={handleParse} disabled={isParsing} title="Parse into Sentences">
                            <span className={cn("icon", {'sync': isParsing})}>{isParsing ? 'sync' : 'segment'}</span>
                        </button>
                     )}
                     {/* Add turn-level synth/play buttons here */}
                </div>
            </div>

            {parsedTurn.isParsedToSentences ? (
                <div className="sentences-container">
                    {parsedTurn.sentences.map((sentence) => (
                        <StudioSentence
                            key={sentence.id}
                            turnIndex={index}
                            sentence={sentence}
                            type={type}
                            author={parsedTurn.originalTurn.author}
                        />
                    ))}
                </div>
            ) : (
                <div className="unparsed-turn-content">
                    <p>{parsedTurn.originalTurn.text}</p>
                </div>
            )}
        </div>
    );
};

export default StudioParsedTurn;