/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { usePostProductionStore, useAudioDirectorStore, FAN_PERSONAS } from '@/lib/state';
import SessionsModal from '../sessions-modal/SessionsModal';
import { SessionData, getAllSessions } from '@/lib/db';
import cn from 'classnames';
import TranscriptEditor from './TranscriptEditor';
import { AVAILABLE_TTS_MODELS, AVAILABLE_TTS_VOICES } from '@/lib/constants';

type MainTab = 'generators' | 'studio';
type GeneratorTab = 'hosts' | 'fan' | 'judge';

const PromptEditor = ({ title, prompt, setPrompt, resetPrompt }: { title: string, prompt: string, setPrompt: (p: string) => void, resetPrompt: () => void }) => (
    <div className="prompt-editor-wrapper">
        <label>{title}</label>
        <textarea rows={6} value={prompt} onChange={e => setPrompt(e.target.value)} />
        <button onClick={resetPrompt} className="reset-prompt-btn">Reset to Default</button>
    </div>
);


export default function AudioStudioPanel() {
  const { loadedSession, setSession } = usePostProductionStore();
  const audioDirectorStore = useAudioDirectorStore();
  
  const [mainTab, setMainTab] = useState<MainTab>('generators');
  const [activeGeneratorTab, setActiveGeneratorTab] = useState<GeneratorTab>('hosts');
  const [isSessionSelectorOpen, setIsSessionSelectorOpen] = useState(false);

  useEffect(() => {
    const loadLastSession = async () => {
        const sessions = await getAllSessions();
        if (sessions.length > 0) {
            handleSessionSelect(sessions[0]);
        }
    };
    if (!loadedSession) {
        loadLastSession();
    }
  }, [loadedSession]);

  const handleSessionSelect = (session: SessionData) => {
    setSession(session);
    setIsSessionSelectorOpen(false);
    setActiveGeneratorTab('hosts');
  };

  const isSessionLoaded = !!loadedSession;

  const renderGenerators = () => {
    if (!isSessionLoaded) {
      return (
        <div className="studio-tab-content">
            <div className="audio-studio-placeholder">
              <span className="icon">mic_external_on</span>
              <h2>Post-Production Studio</h2>
              <p>Load a completed session to edit the transcript and re-synthesize the podcast with high-fidelity voices.</p>
              <button className="primary-btn" onClick={() => setIsSessionSelectorOpen(true)}>
                Load Session
              </button>
            </div>
        </div>
      );
    }

    return (
      <div className="post-production-workspace">
        <nav className="studio-tabs-nav">
          <button className={cn('studio-tab-button', {active: activeGeneratorTab === 'hosts'})} onClick={() => setActiveGeneratorTab('hosts')}>
              <span className="icon">description</span> Hosts Chat
          </button>
          <button className={cn('studio-tab-button', {active: activeGeneratorTab === 'fan'})} onClick={() => setActiveGeneratorTab('fan')}>
              <span className="icon">forum</span> Fan Chat
          </button>
          <button className={cn('studio-tab-button', {active: activeGeneratorTab === 'judge'})} onClick={() => setActiveGeneratorTab('judge')}>
              <span className="icon">gavel</span> Judge AI
          </button>
        </nav>
        <div className="studio-tab-content">
          <TranscriptEditor type={activeGeneratorTab} />
        </div>
      </div>
    );
  };
  
  const renderStudio = () => {
      const hostAuthors = loadedSession ? Array.from(new Set(loadedSession.mainTranscript.map(t => t.author).filter(a => a !== 'user' && a !== 'agent' && a !== 'System' && a !== 'Producer'))) : [];
      const fanAuthors = FAN_PERSONAS;
      const judgeAuthors = loadedSession ? Array.from(new Set(loadedSession.judgeTranscript.map(t => t.author).filter(a => a !== 'Producer'))) : [];

      return (
        <div className="producer-hub-content">
            <div className="studio-content" style={{ padding: '16px' }}>
                <details className="studio-section" open>
                    <summary><div className="summary-like-h3"><span className="icon">settings_voice</span>Global Synthesis Settings</div></summary>
                    <div className="settings-group">
                      <label>TTS Model
                        <select value={audioDirectorStore.ttsModel} onChange={e => audioDirectorStore.setTtsModel(e.target.value)}>
                          {AVAILABLE_TTS_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </label>
                    </div>
                    <PromptEditor
                      title="Global TTS System Prompt"
                      prompt={audioDirectorStore.ttsSystemPrompt}
                      setPrompt={audioDirectorStore.setTtsSystemPrompt}
                      resetPrompt={audioDirectorStore.resetTtsSystemPrompt}
                    />
                </details>

                <details className="studio-section">
                    <summary><div className="summary-like-h3"><span className="icon">person_pin</span>Voice Casting</div></summary>
                    <div className="voice-casting-grid">
                      {hostAuthors.length > 0 && <div className="voice-casting-group">
                        <h4>Hosts</h4>
                        {/* FIX: Replaced filter().map() with a single map containing a type guard to ensure 'author' is a string and fix type errors. */}
                        {hostAuthors.map(author => {
                          if (typeof author !== 'string') return null;
                          return (
                            <div key={author} className="voice-assignment-row">
                              <label>{author}</label>
                              <select value={audioDirectorStore.hostVoiceMap[author] || ''} onChange={e => audioDirectorStore.updateVoiceMap('hosts', author, e.target.value)}>
                                {AVAILABLE_TTS_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                          );
                        })}
                      </div>}
                      {fanAuthors.length > 0 && <div className="voice-casting-group">
                        <h4>Fans</h4>
                        {fanAuthors.map(author => (
                          <div key={author} className="voice-assignment-row">
                            <label>{author}</label>
                            <select value={audioDirectorStore.fanVoiceMap[author] || ''} onChange={e => audioDirectorStore.updateVoiceMap('fan', author, e.target.value)}>
                              {AVAILABLE_TTS_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>}
                       {judgeAuthors.length > 0 && <div className="voice-casting-group">
                        <h4>Judge AI</h4>
                        {/* FIX: Replaced filter().map() with a single map containing a type guard to ensure 'author' is a string and fix type errors. */}
                        {judgeAuthors.map(author => {
                          if (typeof author !== 'string') return null;
                          return (
                            <div key={author} className="voice-assignment-row">
                              <label>{author}</label>
                              <select value={audioDirectorStore.judgeVoiceMap[author] || ''} onChange={e => audioDirectorStore.updateVoiceMap('judge', author, e.target.value)}>
                                {AVAILABLE_TTS_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                          );
                        })}
                      </div>}
                    </div>
                </details>

                <details className="studio-section">
                    <summary><div className="summary-like-h3"><span className="icon">segment</span>Parser Configuration</div></summary>
                     <PromptEditor
                      title="Hosts Parser Prompt"
                      prompt={audioDirectorStore.hostsParserPrompt}
                      setPrompt={audioDirectorStore.setHostsParserPrompt}
                      resetPrompt={audioDirectorStore.resetHostsParserPrompt}
                    />
                     <PromptEditor
                      title="Fan Parser Prompt"
                      prompt={audioDirectorStore.fanParserPrompt}
                      setPrompt={audioDirectorStore.setFanParserPrompt}
                      resetPrompt={audioDirectorStore.resetFanParserPrompt}
                    />
                     <PromptEditor
                      title="Judge Parser Prompt"
                      prompt={audioDirectorStore.judgeParserPrompt}
                      setPrompt={audioDirectorStore.setJudgeParserPrompt}
                      resetPrompt={audioDirectorStore.resetJudgeParserPrompt}
                    />
                </details>
                
                <details className="studio-section">
                    <summary><div className="summary-like-h3"><span className="icon">theater_comedy</span>Emotion Director Prompts</div></summary>
                     <PromptEditor
                      title="Hosts Director Prompt"
                      prompt={audioDirectorStore.hostsDirectorPrompt}
                      setPrompt={audioDirectorStore.setHostsDirectorPrompt}
                      resetPrompt={audioDirectorStore.resetHostsDirectorPrompt}
                    />
                     <PromptEditor
                      title="Fan Director Prompt"
                      prompt={audioDirectorStore.fanDirectorPrompt}
                      setPrompt={audioDirectorStore.setFanDirectorPrompt}
                      resetPrompt={audioDirectorStore.resetFanDirectorPrompt}
                    />
                     <PromptEditor
                      title="Judge Director Prompt"
                      prompt={audioDirectorStore.judgeDirectorPrompt}
                      setPrompt={audioDirectorStore.setJudgeDirectorPrompt}
                      resetPrompt={audioDirectorStore.resetJudgeDirectorPrompt}
                    />
                </details>
            </div>
        </div>
      );
  };

  return (
    <>
      <div className="panel-content-wrapper">
        <div className="audio-studio-tabs">
          <button
              className={cn('audio-studio-tab-button', { active: mainTab === 'generators' })}
              onClick={() => setMainTab('generators')}
          >
              <span className="icon">graphic_eq</span>
              Audio Generators
          </button>
          <button
              className={cn('audio-studio-tab-button', { active: mainTab === 'studio' })}
              onClick={() => setMainTab('studio')}
          >
              <span className="icon">edit_note</span>
              Audio Studio
          </button>
        </div>
        
        {mainTab === 'generators' ? renderGenerators() : renderStudio()}

      </div>
      {isSessionSelectorOpen && <SessionsModal onClose={() => setIsSessionSelectorOpen(false)} onSessionSelect={handleSessionSelect} />}
    </>
  );
}