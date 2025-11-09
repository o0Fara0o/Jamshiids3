

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef } from 'react';
import WelcomeScreen from '../welcome-screen/WelcomeScreen';
// FIX: Removed SystemInstruction as it's not an exported member.
import { LiveConnectConfig, Modality, LiveServerContent } from '@google/genai';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import {
  useSettings,
  useLogStore,
  useTools,
  ConversationTurn,
  useFanStore,
  usePodcastStore,
  useHostStore,
  useProducerStudioStore,
  GroundingChunk,
  UrlContextMetadata,
} from '@/lib/state';
import { useFanAIContext } from '@/contexts/FanAIContext';
import { useJudgeAIContext } from '@/contexts/JudgeAIContext';
import { formatTimestamp } from '@/lib/utils';
import Collapsible from '../../Collapsible';
import FlippableImageCard from '../../FlippableImageCard';
import { useDirectorAIContext } from '@/contexts/DirectorAIContext';

// Define extended config to avoid using `any`
interface ExtendedLiveConnectConfig extends LiveConnectConfig {
  speechConfig?: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: string;
      };
    };
  };
  thinkingConfig?: {
    thinkingBudget: number;
  };
  affectiveDialog?: object;
  proactiveAudio?: object;
  inputAudioTranscription?: object;
  outputAudioTranscription?: object;
  responseModalities?: Modality[];
  // FIX: Add 'tools' property to align with its usage in the component.
  tools?: any[];
  // FIX: Defined the type for systemInstruction inline.
  systemInstruction?: { parts: Array<{ text: string }> };
}


const renderContent = (turn: ConversationTurn) => {
  const text = turn.text;
  // Split by ```json...``` code blocks
  const parts = text.split(/(`{3}json\n[\s\S]*?\n`{3})/g);

  const renderedParts = parts.map((part, index) => {
    if (part.startsWith('```json')) {
      const jsonContent = part.replace(/^`{3}json\n|`{3}$/g, '');
      return (
        <pre key={index}>
          <code>{jsonContent}</code>
        </pre>
      );
    }

    // Split by **bold** text
    const boldParts = part.split(/(\*\*.*?\*\*)/g);
    return boldParts.map((boldPart, boldIndex) => {
      if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
        return <strong key={boldIndex}>{boldPart.slice(2, -2)}</strong>;
      }
      return boldPart;
    });
  });

  return (
    <>
      {turn.image && <img src={turn.image} alt="User upload" />}
      {renderedParts}
    </>
  );
};

const formatFunctionCallArgs = (args: Record<string, unknown>) => {
  if (!args || Object.keys(args).length === 0) {
    return '';
  }
  return Object.entries(args)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');
};

export default function StreamingConsole() {
  const { client, setConfig } = useLiveAPIContext();
  const {
    voice,
    thinkingMode,
    groundingWithGoogleSearch,
    groundingWithUrlContext,
    affectiveDialog,
    proactiveAudio,
  } = useSettings();
  const { podcastFormat, sourceContext } = usePodcastStore();
  const { getHostByName } = useHostStore();
  const { host1Selection, host2Selection } = useSettings();
  const { mainChatSystemPrompt } = useProducerStudioStore();


  const host1 = getHostByName(host1Selection);
  const host2 = getHostByName(host2Selection);

  const { tools: functionTools, areToolsEnabled } = useTools();
  const mainTurns = useLogStore(state => state.turns);
  const fanTurns = useFanStore(state => state.turns);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { sendMessage: sendToFanAI } = useFanAIContext();
  const { sendTurnContext: sendToJudgeAI } = useJudgeAIContext();
  const { getSuggestions: getDirectorSuggestions } = useDirectorAIContext();

  // Orchestration state
  const lastProcessedTurnRef = useRef<ConversationTurn | null>(null);
  const lastFanCallRef = useRef<number>(0);
  const lastJudgeCallRef = useRef<number>(0);
  const lastDirectorCallRef = useRef<number>(0);

  // Set the configuration for the Live API
  useEffect(() => {
    if (!host1 || !host2) return; // Don't configure if hosts aren't resolved yet

    // FIX: Simplified the type of `tools` to `any[]` to resolve complex type inference issues.
    const tools: any[] = [];

    if (groundingWithGoogleSearch) {
      // Per API rules, `googleSearch` must be the only tool.
      tools.push({ googleSearch: {} });
    } else {
      if (groundingWithUrlContext) {
        tools.push({ urlContext: {} });
      }

      if (areToolsEnabled) {
        const functionDeclarations = functionTools
          .filter(tool => tool.isEnabled)
          .map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            behavior: tool.behavior,
          }));

        if (functionDeclarations.length > 0) {
          tools.push({ functionDeclarations });
        }
      }
    }
    
    let formatSpecificInstructions = '';
    if (podcastFormat && podcastFormat !== 'Freestyle' && sourceContext) {
        formatSpecificInstructions = `\n# موضوع امروز:
کل مکالمه شما واکنشی به موضوع(های) زیر است که از این زمینه استخراج شده: ${sourceContext}.
موضوع بحث "${podcastFormat}" است.
آن را تحلیل کنید، در مورد نکات آن بحث کنید و نظر شخصی خود را به اشتراک بگذارید. از این موضوع خارج نشوید.`;
    } else { // Freestyle or no context
        formatSpecificInstructions = `\n# فرمت و جریان پادکست:
- پادکست زمانی شروع می‌شود که شما '[START]' را دریافت کنید. ${host1.name} باید برنامه را با یک مقدمه شاد و پرانرژی شروع کند، به شنوندگان خوشامد بگوید و سپس بلافاصله یک موضوع عجیب و غریب برای بحث روز پیشنهاد دهد. در ابتدای پادکست، یکی از شما باید به قابلیت جدید خود برای جستجوی اطلاعات زنده در وب اشاره کند.`;
    }
    
    // Dynamically replace placeholders in the system prompt from the store
    const processedSystemPrompt = mainChatSystemPrompt
      .replace(/\$\{host1.name\}/g, host1.name)
      .replace(/\$\{host2.name\}/g, host2.name)
      .replace(/\$\{host1.prompt\}/g, host1.prompt)
      .replace(/\$\{host2.prompt\}/g, host2.prompt)
      .replace(/\$\{host1.prompt.split\('\\n'\)\[0\]\}/g, host1.prompt.split('\n')[0])
      .replace(/\$\{host2.prompt.split\('\\n'\)\[0\]\}/g, host2.prompt.split('\n')[0])
      .replace(/\$\{formatSpecificInstructions\}/g, formatSpecificInstructions);


    const config: ExtendedLiveConnectConfig = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: {
        parts: [
          {
            text: processedSystemPrompt,
          },
        ],
      },
      tools: tools.length > 0 ? tools : undefined,
    };

    if (!thinkingMode) {
      config.thinkingConfig = { thinkingBudget: 0 };
    }

    if (affectiveDialog) {
      config.affectiveDialog = {};
    }
    if (proactiveAudio) {
      config.proactiveAudio = {};
    }

    setConfig(config);
  }, [
    setConfig,
    host1,
    host2,
    functionTools,
    voice,
    thinkingMode,
    groundingWithGoogleSearch,
    groundingWithUrlContext,
    areToolsEnabled,
    affectiveDialog,
    proactiveAudio,
    podcastFormat,
    sourceContext,
    mainChatSystemPrompt,
  ]);

  useEffect(() => {
    const { addTurn, updateLastTurn } = useLogStore.getState();

    const handleInputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      if (last && last.author === 'user' && !last.isFinal && !last.image) {
        updateLastTurn({
          text: last.text + text,
          isFinal,
        });
      } else {
        addTurn({ role: 'user', author: 'user', text, isFinal });
      }
    };

    const handleOutputTranscription = (text: string, isFinal: boolean) => {
      // Get latest host objects directly from store to avoid stale closures
      const h1 = useHostStore.getState().getHostByName(useSettings.getState().host1Selection);
      const h2 = useHostStore.getState().getHostByName(useSettings.getState().host2Selection);

      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];

      if (last && last.role === 'agent' && !last.isFinal) {
        updateLastTurn({
          text: last.text + text,
          isFinal,
        });
      } else {
        let author = 'agent';
        let processedText = text;
        
        if (h1 && h2) {
          const host1Prefix = `${h1.name}:`;
          const host2Prefix = `${h2.name}:`;

          if (text.trim().startsWith(host1Prefix)) {
            author = h1.name;
            processedText = text.replace(new RegExp(`^${host1Prefix}\\s*`), '');
          } else if (text.trim().startsWith(host2Prefix)) {
            author = h2.name;
            processedText = text.replace(new RegExp(`^${host2Prefix}\\s*`), '');
          }
        }
        addTurn({ role: 'agent', author, text: processedText, isFinal });
      }
    };

    const handleContent = (serverContent: LiveServerContent) => {
      // Get latest host objects directly from store to avoid stale closures
      const h1 = useHostStore.getState().getHostByName(useSettings.getState().host1Selection);
      const h2 = useHostStore.getState().getHostByName(useSettings.getState().host2Selection);
      
      const text =
        serverContent.modelTurn?.parts
          ?.map((p: any) => p.text)
          .filter(Boolean)
          .join(' ') ?? '';
      const groundingMetadata = serverContent.groundingMetadata;
      const groundingChunks = groundingMetadata?.groundingChunks;
      const webSearchQueries = groundingMetadata?.webSearchQueries;
      const urlContextMetadata = (serverContent as any).urlContextMetadata as UrlContextMetadata | undefined;

      if (
        !text &&
        !groundingChunks &&
        !urlContextMetadata &&
        (!webSearchQueries || webSearchQueries.length === 0)
      ) {
        return;
      }

      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];

      if (last?.role === 'agent' && !last.isFinal) {
        const updatedTurn: Partial<ConversationTurn> = {
          text: last.text + text,
        };
        if (groundingChunks) {
          updatedTurn.groundingChunks = [
            ...(last.groundingChunks || []),
            ...(groundingChunks as GroundingChunk[]),
          ];
        }
        if (webSearchQueries) {
          updatedTurn.webSearchQueries = [
            ...new Set([
              ...(last.webSearchQueries || []),
              ...webSearchQueries,
            ]),
          ];
        }
        if (urlContextMetadata) {
          updatedTurn.urlContextMetadata = urlContextMetadata;
        }
        updateLastTurn(updatedTurn);
      } else {
        let author = 'agent';
        let processedText = text;
        
        if (h1 && h2) {
          const host1Prefix = `${h1.name}:`;
          const host2Prefix = `${h2.name}:`;

          if (text.trim().startsWith(host1Prefix)) {
            author = h1.name;
            processedText = text.replace(new RegExp(`^${host1Prefix}\\s*`), '');
          } else if (text.trim().startsWith(host2Prefix)) {
            author = h2.name;
            processedText = text.replace(new RegExp(`^${host2Prefix}\\s*`), '');
          }
        }
        
        addTurn({
          role: 'agent',
          author,
          text: processedText,
          isFinal: false,
          groundingChunks: groundingChunks as GroundingChunk[],
          webSearchQueries,
          urlContextMetadata,
        });
      }
    };

    const handleTurnComplete = () => {
      const { turns, updateLastTurn, isEnding, removeLastTurn } = useLogStore.getState();
      const last = turns[turns.length - 1];

      if (last && !last.isFinal) {
        updateLastTurn({ isFinal: true });
      }

      const finalTurn = useLogStore.getState().turns[useLogStore.getState().turns.length - 1];
      if (
        finalTurn &&
        finalTurn.role === 'agent' &&
        finalTurn.isFinal &&
        !finalTurn.text?.trim() &&
        !finalTurn.image &&
        (!finalTurn.groundingChunks || finalTurn.groundingChunks.length === 0)
      ) {
        removeLastTurn();
      } else if (
        finalTurn &&
        finalTurn.role === 'agent' &&
        client.status === 'connected' &&
        !isEnding
      ) {
        client.send([{ text: '[CONTINUE]' }]);
      }
    };

    client.on('inputTranscription', handleInputTranscription);
    client.on('outputTranscription', handleOutputTranscription);
    client.on('content', handleContent);
    client.on('turncomplete', handleTurnComplete);

    return () => {
      client.off('inputTranscription', handleInputTranscription);
      client.off('outputTranscription', handleOutputTranscription);
      client.off('content', handleContent);
      client.off('turncomplete', handleTurnComplete);
    };
  }, [client]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mainTurns]);

  // Orchestration: Stream finalized host turns to Fan and Judge AIs
  useEffect(() => {
    if (!host1 || !host2) return;
    const lastMainTurn = mainTurns[mainTurns.length - 1];

    // Check if the last turn is a new, final turn from a host
    if (
      lastMainTurn &&
      lastMainTurn.isFinal &&
      (lastMainTurn.author === host1.name ||
        lastMainTurn.author === host2.name) &&
      lastMainTurn !== lastProcessedTurnRef.current
    ) {
      // Mark this turn as processed to avoid re-triggering
      lastProcessedTurnRef.current = lastMainTurn;
      const now = Date.now();

      // 1. Send the single host turn to the Fan AI with a 5-second cooldown
      if (now - lastFanCallRef.current > 5000) {
        lastFanCallRef.current = now;
        const hostMessageForFan = `${lastMainTurn.author}: ${lastMainTurn.text}`;
        sendToFanAI(hostMessageForFan);
      }

      // 2. Send context to the Judge AI with a 10-second cooldown
      if (now - lastJudgeCallRef.current > 10000) {
        lastJudgeCallRef.current = now;
        const formatContextForJudge = () => {
          // Get the latest fan chat transcript
          const recentFanTurns = fanTurns.slice(-10); // Get a recent snapshot
          const fanTranscript = recentFanTurns
            .map(turn => `${turn.author}: ${turn.text}`)
            .join('\n');

          const hostTurnContext = `The latest from the hosts is:\n${lastMainTurn.author}: ${lastMainTurn.text}`;

          // Only include fan chat if it exists
          if (fanTranscript.trim().length > 0) {
            return `${hostTurnContext}\n\nHere is the current fan chat:\n--- FAN CHAT ---\n${fanTranscript}`;
          }
          return hostTurnContext;
        };
        const fullContext = formatContextForJudge();
        sendToJudgeAI(fullContext);
      }

      // 3. Send context to the Director AI with a 20-second cooldown
      if (now - lastDirectorCallRef.current > 20000) {
        lastDirectorCallRef.current = now;
        const recentTurns = mainTurns.slice(-10);
        const transcript = recentTurns
          .map(turn => `${turn.author}: ${turn.text}`)
          .join('\n');

        if (transcript.trim().length > 0) {
            getDirectorSuggestions(transcript);
        }
      }
    }
  }, [mainTurns, fanTurns, sendToFanAI, sendToJudgeAI, getDirectorSuggestions, host1, host2]);

  const visibleTurns = mainTurns.filter(t => {
    if (t.role === 'system') {
      // Show system turns if they are for tools or from the producer
      return !!t.toolUseRequest || !!t.toolUseResponse || t.author === 'Producer' || !!t.generatedImage;
    }
    // Show all non-system turns (user, agent)
    return true;
  });


  const getAuthorClassName = (author: string) => {
    if (!host1 || !host2) return `author-${author.toLowerCase().replace(/[\s&]/g, '-')}`;
    if (author === host1.name) return 'author-host-1';
    if (author === host2.name) return 'author-host-2';
    return `author-${author.toLowerCase().replace(/[\s&]/g, '-')}`;
  };

  const getAuthorDisplayName = (author: string, role: string) => {
    if (role === 'user') return 'You';
    return author;
  };

  return (
    <>
      <div className="transcription-container">
        {visibleTurns.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <div className="transcription-view" ref={scrollRef}>
            {visibleTurns.map((t, i) => {
              return (
                <div
                  key={i}
                  className={`transcription-entry role-${t.role} ${getAuthorClassName(
                    t.author
                  )} ${!t.isFinal ? 'interim' : ''} ${
                    t.isForwarded ? 'is-forwarded' : ''
                  }`}
                >
                  <div className="transcription-header">
                    <div className="transcription-source">
                      {getAuthorDisplayName(t.author, t.role)}
                    </div>
                    <div className="transcription-timestamp">
                      {formatTimestamp(t.timestamp)}
                    </div>
                  </div>

                  {t.generatedImage && t.imagePrompt ? (
                    <FlippableImageCard
                      imageUrl={t.generatedImage}
                      prompt={t.imagePrompt}
                    />
                  ) : (
                    <>
                      {t.text && (
                        <div className="transcription-text-content">
                          {renderContent(t)}
                        </div>
                      )}
                      {t.toolUseRequest && (
                        <Collapsible
                          summary={
                            <div className="tool-call-summary">
                              <span className="icon">build</span>
                              <span>
                                Tool Call:{' '}
                                <code>
                                  {t.toolUseRequest.functionCalls
                                    .map(
                                      fc =>
                                        `${fc.name}(${formatFunctionCallArgs(
                                          fc.args,
                                        )})`,
                                    )
                                    .join(', ')}
                                </code>
                              </span>
                            </div>
                          }
                        >
                          <pre>
                            {JSON.stringify(
                              t.toolUseRequest.functionCalls,
                              null,
                              2,
                            )}
                          </pre>
                        </Collapsible>
                      )}

                      {t.toolUseResponse && (
                        <Collapsible
                          summary={
                            <div className="tool-call-summary">
                              <span className="icon">build_circle</span>
                              <span>
                                Tool Response for:{' '}
                                <code>
                                  {t.toolUseResponse.functionResponses
                                    ?.map(fr => `${fr.name}()`)
                                    .join(', ')}
                                </code>
                              </span>
                            </div>
                          }
                        >
                          <pre>
                            {JSON.stringify(
                              t.toolUseResponse.functionResponses,
                              null,
                              2,
                            )}
                          </pre>
                        </Collapsible>
                      )}
                      {t.webSearchQueries && t.webSearchQueries.length > 0 && (
                        <Collapsible
                          summary={
                            <div className="tool-call-summary">
                              <span className="icon">search</span>
                              <span>
                                Search Queries ({t.webSearchQueries.length})
                              </span>
                            </div>
                          }
                        >
                          <ul>
                            {t.webSearchQueries.map((query, index) => (
                              <li key={index}>
                                <code>{query}</code>
                              </li>
                            ))}
                          </ul>
                        </Collapsible>
                      )}
                      {t.groundingChunks && t.groundingChunks.length > 0 && (
                        <Collapsible
                          summary={
                            <div className="tool-call-summary">
                              <span className="icon">travel_explore</span>
                              <span>
                                Search Results (
                                {t.groundingChunks.filter(c => c.web && c.web.uri).length})
                              </span>
                            </div>
                          }
                        >
                          <ul>
                            {t.groundingChunks
                              .filter(chunk => chunk.web && chunk.web.uri)
                              .map((chunk, index) => (
                                <li key={index} className="grounding-chunk-item">
                                  <a
                                    href={chunk.web!.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="grounding-chunk-title"
                                  >
                                    {chunk.web!.title || 'Untitled'}
                                  </a>
                                  <span className="grounding-chunk-uri">
                                    {chunk.web!.uri}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </Collapsible>
                      )}
                      {t.urlContextMetadata &&
                        t.urlContextMetadata.url_metadata &&
                        t.urlContextMetadata.url_metadata.length > 0 && (
                          <Collapsible
                            summary={
                              <div className="tool-call-summary">
                                <span className="icon">link</span>
                                <span>
                                  URL Context (
                                  {t.urlContextMetadata.url_metadata.length})
                                </span>
                              </div>
                            }
                          >
                            <ul>
                              {t.urlContextMetadata.url_metadata.map(
                                (meta, index) => (
                                  <li key={index}>
                                    <a
                                      href={meta.retrieved_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {meta.retrieved_url}
                                    </a>
                                    <span
                                      className={`status-${meta.url_retrieval_status
                                        .replace('URL_RETRIEVAL_STATUS_', '')
                                        .toLowerCase()}`}
                                    >
                                      {' '}
                                      (
                                      {meta.url_retrieval_status.replace(
                                        'URL_RETRIEVAL_STATUS_',
                                        '',
                                      )}
                                      )
                                    </span>
                                  </li>
                                ),
                              )}
                            </ul>
                          </Collapsible>
                        )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}