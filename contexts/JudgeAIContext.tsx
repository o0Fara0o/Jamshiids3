/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Chat,
  GenerateContentResponse,
  FunctionDeclaration,
  Type,
} from '@google/genai';
import {
  createContext,
  FC,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSettings, useLogStore, useJudgeStore, useProducerStudioStore } from '@/lib/state';
import { useLiveAPIContext } from './LiveAPIContext';
import { useAPIKey } from './APIKeyContext';

const sendFanCommentToPodcastTool: FunctionDeclaration = {
  name: 'send_fan_comment_to_podcast',
  description:
    'Forwards a selected fan comment to the main podcast chat for the hosts to see.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      fan_name: {
        type: Type.STRING,
        description:
          "The name of the fan's persona who made the comment (e.g., کیان, سارا, نیما).",
      },
      comment: {
        type: Type.STRING,
        description: 'The exact text of the fan comment to send to the hosts.',
      },
    },
    required: ['fan_name', 'comment'],
  },
};

type JudgeStatus = 'idle' | 'evaluating' | 'forwarded' | 'error';
interface JudgeAIContextType {
  sendTurnContext: (transcript: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  status: JudgeStatus;
  lastForwardedComment: string | null;
}

const JudgeAIContext = createContext<JudgeAIContextType | undefined>(undefined);

// FIX: Refactor to use module-level variables for the AI client and chat session
// This avoids potential issues with useRef type inference that may be causing
// the "Expected 1 arguments, but got 0" error, and aligns with the pattern
// used in other working contexts in the application.
let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;
let currentModel: string | null = null;
let currentPrompt: string | null = null;
let currentApiKey: string | null = null;

export const JudgeAIProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { judgeModel } = useSettings();
  const { judgeSystemPrompt } = useProducerStudioStore();
  const { addTurn: addJudgeTurn, updateLastTurn: updateLastJudgeTurn } =
    useJudgeStore.getState();
  const { addTurn: addMainTurn } = useLogStore.getState();
  const { client } = useLiveAPIContext();
  const API_KEY = useAPIKey();


  const [status, setStatus] = useState<JudgeStatus>('idle');
  const [lastForwardedComment, setLastForwardedComment] = useState<
    string | null
  >(null);
  const statusTimeoutRef = useRef<number | null>(null);

  // This effect runs when the judgeModel or prompt changes in settings
  useEffect(() => {
    // If the model or prompt changes, clear the existing AI and chat instances to force re-initialization on the next message
    if (ai && (judgeModel !== currentModel || judgeSystemPrompt !== currentPrompt)) {
      ai = null;
      chat = null;
      useJudgeStore.getState().clearTurns();
    }
  }, [judgeModel, judgeSystemPrompt]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  // Initialize lazily
  const initialize = () => {
    if (!ai || !chat || API_KEY !== currentApiKey || judgeModel !== currentModel || judgeSystemPrompt !== currentPrompt) {
      ai = new GoogleGenAI({ apiKey: API_KEY });
      chat = ai.chats.create({
        model: judgeModel,
        config: {
          systemInstruction: judgeSystemPrompt,
          tools: [{ functionDeclarations: [sendFanCommentToPodcastTool] }],
        },
      });
      currentModel = judgeModel;
      currentPrompt = judgeSystemPrompt;
      currentApiKey = API_KEY;
      // Add a greeting message when the chat is created
      addJudgeTurn({
        role: 'agent',
        author: 'Judge AI',
        text: "Judge AI online. I'll start evaluating as the conversation progresses.",
        isFinal: true,
      });
    }
  };

  const handleGeminiResponse = async (
    responseStream: AsyncGenerator<GenerateContentResponse>,
  ) => {
    addJudgeTurn({
      role: 'agent',
      author: 'Judge AI',
      text: '',
      isFinal: false,
    });

    let wasForwarded = false;
    let forwardedCommentText = '';

    for await (const chunk of responseStream) {
      const functionCalls = chunk.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const fc of functionCalls) {
          if (fc.name === 'send_fan_comment_to_podcast') {
            const { fan_name, comment } = fc.args as { fan_name: string, comment: string };
            if (fan_name && comment) {
              addMainTurn({
                role: 'agent',
                author: fan_name,
                text: comment,
                isFinal: true,
                isForwarded: true,
              });
              // Send the fan comment to the main AI for reaction
              if (client.status === 'connected') {
                client.send([
                  { text: `[FAN_COMMENT] ${fan_name}: ${comment}` },
                ]);
              }
              wasForwarded = true;
              forwardedCommentText = comment as string;
            }
          }
        }
      } else if (chunk.text) {
        const { turns, updateLastTurn: updateLastJudgeTurn } =
          useJudgeStore.getState();
        const lastTurn = turns[turns.length - 1];
        if (lastTurn && lastTurn.role === 'agent' && !lastTurn.isFinal) {
          updateLastJudgeTurn({ text: lastTurn.text + String(chunk.text) });
        }
      }
    }
    // Finalize the turn
    updateLastJudgeTurn({ isFinal: true });

    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);

    if (wasForwarded) {
      setStatus('forwarded');
      setLastForwardedComment(forwardedCommentText);
      statusTimeoutRef.current = window.setTimeout(() => {
        setStatus('idle');
      }, 5000);
    } else {
      setStatus('idle');
    }
  };

  const sendMessage = async (message: string) => {
    initialize();
    addJudgeTurn({
      role: 'user',
      author: 'Producer',
      text: message,
      isFinal: true,
    });

    if (!chat) return;

    try {
      setStatus('evaluating');
      const responseStream = await chat.sendMessageStream({
        message,
      });
      await handleGeminiResponse(responseStream);
    } catch (error) {
      console.error('Judge AI sendMessage failed:', error);
      addJudgeTurn({
        role: 'agent',
        author: 'Judge AI',
        text: 'Sorry, I had trouble responding.',
        isFinal: true,
      });
      setStatus('error');
    }
  };

  const sendTurnContext = async (context: string) => {
    const message = `Here is the latest context:\n\n${context}`;
    await sendMessage(message);
  };

  return (
    <JudgeAIContext.Provider
      value={{ sendMessage, sendTurnContext, status, lastForwardedComment }}
    >
      {children}
    </JudgeAIContext.Provider>
  );
};

export const useJudgeAIContext = () => {
  const context = useContext(JudgeAIContext);
  if (!context) {
    throw new Error('useJudgeAIContext must be used within a JudgeAIProvider');
  }
  return context;
};
