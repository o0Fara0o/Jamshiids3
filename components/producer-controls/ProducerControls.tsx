/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { memo, useEffect, useRef, useState } from 'react';
import cn from 'classnames';
import { Part } from '@google/genai';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import {
  useSettings,
  useLogStore,
  useDirectorStore,
  useUI,
  useHostStore,
  useProducerStore,
  useProducerStudioStore,
  usePodcastStore,
  useHostCreationAgentStore,
  useDescriptionAgentStore,
  useFilmDirectorAgentStore,
  useAgentStore,
  useTools,
  useVirtualSetStore,
  useLaunchpadStore,
} from '@/lib/state';
import {
  AVAILABLE_LIVE_MODELS,
  AVAILABLE_VOICES,
  AVAILABLE_DIRECTOR_MODELS,
  AVAILABLE_FAN_MODELS,
  AVAILABLE_JUDGE_MODELS,
} from '@/lib/constants';
import ToolsModal from '../ToolsModal';
import { useJudgeAIContext } from '../../contexts/JudgeAIContext';
import { useDirectorAIContext } from '../../contexts/DirectorAIContext';
import SessionsModal from '../sessions-modal/SessionsModal';
import { triggerDownload } from '@/lib/utils';

const dataUrlToBase64 = (dataUrl: string) => dataUrl.split(',')[1];

const ControlPanel = () => {
  const { client, connected, isConnecting, connect, disconnect, isSetupComplete, saveSession, isSaving, muted, setMuted } = useLiveAPIContext();
  const { addTurn, setIsEnding, sessionStartTime } = useLogStore();
  const { getHostByName } = useHostStore();
  const { host1Selection, host2Selection } = useSettings();
  const host1 = getHostByName(host1Selection);
  const host2 = getHostByName(host2Selection);
  const areHostsReady = !!host1 && !!host2;
  const { isSessionsModalOpen, toggleSessionsModal } = useUI();
  
  const prevSetupComplete = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { inputText, setInputText, image, setImage, initialPayload, setInitialPayload, clearInput } = useProducerStore();
  
  // Judge AI Status
  const { status: judgeStatus, lastForwardedComment } = useJudgeAIContext();
  
  // Director AI State and Hooks
  const { staticPrompts, dynamicPrompts, staticEndPrompts, dynamicEndPrompts } = useDirectorStore();
  const { getSuggestions: getDirectorSuggestions, getEndShowSuggestions } = useDirectorAIContext();

  const canSend = connected && (inputText.trim() !== '' || image !== null);

  useEffect(() => {
    if (isSetupComplete && !prevSetupComplete.current) {
      if (initialPayload) {
        const parts: Part[] = initialPayload.image
          ? [{ inlineData: { mimeType: initialPayload.image.mimeType, data: dataUrlToBase64(initialPayload.image.dataUrl) } }]
          : [];
        if (initialPayload.text.trim() !== '') {
          parts.push({ text: initialPayload.text });
        }
        if (parts.length > 0) {
          addTurn({ role: 'user', author: 'user', text: initialPayload.text, image: initialPayload.image?.dataUrl, isFinal: true });
          client.send(parts);
        }
        setInitialPayload(null);
        clearInput(); // Clear the inputs from the global store
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        client.send([{ text: '[START]' }]);
      }
    }
    prevSetupComplete.current = isSetupComplete;
  }, [isSetupComplete, client, addTurn, initialPayload, setInitialPayload, clearInput]);

  const handleConnectClick = () => {
    if (connected) {
      disconnect();
    } else if (!isConnecting) {
      if (sessionStartTime && !connected) { // This means an unsaved session exists
        if (!window.confirm('You have an unsaved session. Starting a new session will discard it. Are you sure you want to continue?')) {
            return; // User cancelled, so we stop here.
        }
      }
      setInitialPayload(null);
      connect();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = loadEvent => {
        setImage({ dataUrl: loadEvent.target?.result as string, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const sendCurrentInput = () => {
    if (!canSend) return;
    const parts: Part[] = [];
    if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: dataUrlToBase64(image.dataUrl) } });
    if (inputText.trim() !== '') parts.push({ text: inputText });
    addTurn({ role: 'user', author: 'user', text: inputText, image: image?.dataUrl, isFinal: true });
    client.send(parts);
    clearInput();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (!inputText.trim() && !image) return;
      if (!connected) { setInitialPayload({ text: inputText, image }); connect(); } 
      else { sendCurrentInput(); }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCurrentInput();
    }
  };

  const handleSendMoodPrompt = (prompt: string) => {
    if (!connected) { alert('You must be connected to send a mood prompt.'); return; }
    const promptText = `[PRODUCER_PROMPT] ${prompt}`;
    client.send([{ text: promptText }]);
    addTurn({ role: 'system', author: 'Producer', text: `Injected mood prompt: "${prompt}"`, isFinal: true });
  };
  
  const handleSendEndPrompt = (prompt: string) => {
    if (!connected) { alert('You must be connected to end the show.'); return; }
    setIsEnding(true);
    const promptText = `[END_PODCAST] ${prompt}`;
    client.send([{ text: promptText }]);
    addTurn({ role: 'system', author: 'Producer', text: `Sent instruction to end the podcast: "${prompt}"`, isFinal: true });
  };
  
  const handleGenerateSuggestions = (type: 'mood' | 'end') => {
    const { turns } = useLogStore.getState();
    const recentTurns = turns.slice(-10);
    const transcript = recentTurns.map(turn => `${turn.author}: ${turn.text}`).join('\n');
    if (!transcript.trim()) { alert("Cannot generate suggestions, the podcast hasn't started."); return; }
    if (type === 'mood') getDirectorSuggestions(transcript); else getEndShowSuggestions(transcript);
  }

  const getJudgeStatusInfo = () => {
    switch (judgeStatus) {
      case 'evaluating': return { icon: 'sync', text: 'Evaluating...' };
      case 'forwarded': return { icon: 'gavel', text: 'Comment Sent!' };
      case 'error': return { icon: 'error', text: 'Judge AI Error' };
      default: return { icon: 'hourglass_empty', text: 'Waiting...' };
    }
  };
  const { icon: judgeIcon, text: judgeText } = getJudgeStatusInfo();

  // Button State Logic
  const podcastStatusText = isConnecting ? 'Connecting...' : connected ? 'Podcast is Live' : 'Ready to Stream';
  const connectButtonTitle = connected ? 'Stop streaming' : 'Start streaming';
  const isConnectButtonDisabled = isConnecting || (!connected && !areHostsReady);
  const isSaveButtonDisabled = !sessionStartTime || connected || isSaving;

  
  return (
    <div className="producer-panel-content">
        <div className="studio-section live-controls-card">
            <div className="live-controls-grid">
                <div className="podcast-status-container">
                    <div className={cn('podcast-status', { connected, connecting: isConnecting })}><p>{podcastStatusText}</p></div>
                </div>
                <div className="connection-buttons">
                    <div className={cn('connection-container', { connected })}>
                        <button
                          className={cn('action-button connect-toggle', { connected, connecting: isConnecting })}
                          onClick={handleConnectClick}
                          title={connectButtonTitle}
                          disabled={isConnectButtonDisabled}
                        >
                          <span className={cn('icon', { sync: isConnecting })}>
                            {isConnecting ? 'sync' : connected ? 'pause' : 'play_arrow'}
                          </span>
                        </button>
                        <span className="text-indicator">Streaming</span>
                    </div>
                    <button className={cn('action-button mic-toggle')} onClick={() => setMuted(!muted)} title={muted ? 'Unmute' : 'Mute'} disabled={!connected}>
                        <span className="icon">{muted ? 'mic_off' : 'mic'}</span>
                    </button>
                    <button
                        className={cn('action-button save-session-btn', { saving: isSaving })}
                        onClick={saveSession}
                        title="Save Session"
                        disabled={isSaveButtonDisabled}
                    >
                        <span className={cn('icon', { sync: isSaving })}>{isSaving ? 'sync' : 'save'}</span>
                    </button>
                    <button
                        className="action-button sessions-btn"
                        onClick={toggleSessionsModal}
                        title="Project Manager"
                    >
                        <span className="icon">folder_open</span>
                    </button>
                </div>
                <div className="status-indicators-container">
                    <div className="judge-status-indicator-condensed">
                        <span className={cn('icon', { sync: judgeIcon === 'sync' }, judgeStatus)}>{judgeIcon}</span>
                        <p>Judge AI: {judgeText}</p>
                    </div>
                </div>
            </div>
            {judgeStatus === 'forwarded' && lastForwardedComment && (
                <div className="last-comment-bar"><p>Last forwarded: "{lastForwardedComment}"</p></div>
            )}
        </div>

        <div className="studio-section director-cues-card">
            <details open>
                <summary><h3><span className="icon">emoji_objects</span>Mood Director</h3></summary>
                <div className="director-content">
                  <div className="director-prompts-grid">
                    <div className="director-prompt-group">
                      <h4><span className="icon">bookmark</span>Saved Prompts</h4>
                      {staticPrompts.map((prompt, index) => (
                        <button key={index} onClick={() => handleSendMoodPrompt(prompt)} disabled={!connected} className="director-static-prompt-btn">
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <div className="director-prompt-group">
                      <h4><span className="icon">smart_toy</span>AI Suggestions <button onClick={() => handleGenerateSuggestions('mood')} className="refresh-suggestions-btn"><span className="icon">refresh</span></button></h4>
                      <div className="director-dynamic-prompts">
                        {dynamicPrompts.map((prompt, index) => (
                          <button key={index} onClick={() => handleSendMoodPrompt(prompt)} disabled={!connected} className="director-dynamic-prompt">
                            <span className="icon">auto_awesome</span>{prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
            </details>
            <div className="section-divider"></div>
            <details>
                <summary><h3><span className="icon">movie_filter</span>End Show Director</h3></summary>
                <div className="director-content">
                  <div className="director-prompts-grid">
                    <div className="director-prompt-group">
                      <h4><span className="icon">bookmark_border</span>Routine Commands</h4>
                      {staticEndPrompts.map((prompt, index) => (
                        <button key={index} onClick={() => handleSendEndPrompt(prompt)} disabled={!connected} className="director-static-prompt-btn end-show-static-prompt">
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <div className="director-prompt-group">
                      <h4><span className="icon">lightbulb</span>AI Suggestions <button onClick={() => handleGenerateSuggestions('end')} className="refresh-suggestions-btn"><span className="icon">refresh</span></button></h4>
                      <div className="director-dynamic-prompts">
                        {dynamicEndPrompts.map((prompt, index) => (
                          <button key={index} onClick={() => handleSendEndPrompt(prompt)} disabled={!connected} className="director-dynamic-prompt end-show-dynamic-prompt">
                            <span className="icon">auto_awesome</span>{prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
            </details>
        </div>
        
        <div className="studio-section producer-input-card">
            <h3 className="producer-input-header"><span className="icon">input</span>Producer Input</h3>
            <div className="producer-input-section">
                {image && (
                  <div className="image-preview-container">
                    <img src={image.dataUrl} alt="Preview" className="image-preview" />
                    <button className="remove-image-button" onClick={() => { setImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} title="Remove image">
                      <span className="icon">close</span>
                    </button>
                  </div>
                )}
                <div className="producer-input-bar">
                  <div className="input-bar-form">
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" style={{ display: 'none' }} />
                    <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={handleKeyDown} placeholder={connected ? 'Jump in...' : 'Type and press Ctrl+Enter to start'} />
                    <button type="button" className="icon-button" title="Attach image" onClick={() => fileInputRef.current?.click()}><span className="icon">attach_file</span></button>
                    <button type="button" className="icon-button send-button" title="Send" disabled={!canSend} onClick={sendCurrentInput}><span className="icon">send</span></button>
                  </div>
                </div>
            </div>
        </div>

      {isSessionsModalOpen && <SessionsModal onClose={toggleSessionsModal} />}
    </div>
  );
};

const PromptEditor = ({ title, prompt, setPrompt, resetPrompt }: { title:string, prompt:string, setPrompt:(p:string)=>void, resetPrompt:()=>void }) => (
    <div className="prompt-editor-wrapper">
        <label>{title}</label>
        <textarea rows={8} value={prompt} onChange={e => setPrompt(e.target.value)} />
        <button onClick={resetPrompt} className="reset-prompt-btn">Reset to Default</button>
    </div>
);

const Studio = () => {
    const { connected } = useLiveAPIContext();
    const { model, voice, fanModel, judgeModel, setModel, setVoice, setFanModel, setJudgeModel } = useSettings();
    const { directorModel, setDirectorModel, staticPrompts, updateStaticPrompt, staticEndPrompts, updateStaticEndPrompt } = useDirectorStore();
    const { mainChatSystemPrompt, setMainChatSystemPrompt, resetMainChatSystemPrompt, fanSystemPrompt, setFanSystemPrompt, resetFanSystemPrompt, judgeSystemPrompt, setJudgeSystemPrompt, resetJudgeSystemPrompt, directorSystemPrompt, setDirectorSystemPrompt, resetDirectorSystemPrompt, endShowDirectorSystemPrompt, setEndShowDirectorSystemPrompt, resetEndShowDirectorSystemPrompt } = useProducerStudioStore();
    const [showToolsModal, setShowToolsModal] = useState(false);

    return (
        <fieldset className="studio-content" disabled={connected}>
            <details className="studio-section" open>
                <summary><h3><span className="icon">tune</span>Global Settings</h3></summary>
                <div className="settings-group">
                    <label>Live Model<select value={model} onChange={e => setModel(e.target.value)}>{AVAILABLE_LIVE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
                    <label>Voice Model<select value={voice} onChange={e => setVoice(e.target.value)}>{AVAILABLE_VOICES.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
                </div>
                <div className="settings-group">
                    <label>Fan AI Model<select value={fanModel} onChange={e => setFanModel(e.target.value)}>{AVAILABLE_FAN_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
                    <label>Judge AI Model<select value={judgeModel} onChange={e => setJudgeModel(e.target.value)}>{AVAILABLE_JUDGE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
                </div>
                 <div className="settings-group">
                    <label>Director AI Model<select value={directorModel} onChange={e => setDirectorModel(e.target.value)}>{AVAILABLE_DIRECTOR_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
                    <button onClick={() => setShowToolsModal(true)} style={{flex: '1'}}>Manage Tools (Functions)</button>
                </div>
            </details>

            <details className="studio-section">
                <summary><h3><span className="icon">podcasts</span>Main Chat System Prompt</h3></summary>
                <PromptEditor title="Main Podcast AI" prompt={mainChatSystemPrompt} setPrompt={setMainChatSystemPrompt} resetPrompt={resetMainChatSystemPrompt} />
            </details>
            
            <details className="studio-section">
                <summary><h3><span className="icon">chat</span>Fan & Judge AI System Prompts</h3></summary>
                <PromptEditor title="Fan AI" prompt={fanSystemPrompt} setPrompt={setFanSystemPrompt} resetPrompt={resetFanSystemPrompt} />
                <PromptEditor title="Judge AI" prompt={judgeSystemPrompt} setPrompt={setJudgeSystemPrompt} resetPrompt={resetJudgeSystemPrompt} />
            </details>
            
            <details className="studio-section">
                <summary><h3><span className="icon">movie_filter</span>Director AI System Prompts & Saved Cues</h3></summary>
                <PromptEditor title="Mood Director AI" prompt={directorSystemPrompt} setPrompt={setDirectorSystemPrompt} resetPrompt={resetDirectorSystemPrompt} />
                <div className="prompt-editor-wrapper">
                    <label>Saved Mood Director Cues</label>
                    <div className="director-cues-editor">
                        {staticPrompts.map((p, i) => <input key={i} type="text" value={p} onChange={e => updateStaticPrompt(i, e.target.value)} />)}
                    </div>
                </div>
                <PromptEditor title="End Show Director AI" prompt={endShowDirectorSystemPrompt} setPrompt={setEndShowDirectorSystemPrompt} resetPrompt={resetEndShowDirectorSystemPrompt} />
                 <div className="prompt-editor-wrapper">
                    <label>Saved End Show Director Cues</label>
                    <div className="director-cues-editor">
                        {staticEndPrompts.map((p, i) => <input key={i} type="text" value={p} onChange={e => updateStaticEndPrompt(i, e.target.value)} />)}
                    </div>
                </div>
            </details>
            {showToolsModal && <ToolsModal onClose={() => setShowToolsModal(false)} />}
        </fieldset>
    );
};


function ProducerControls() {
  const [activeTab, setActiveTab] = useState<'control' | 'studio'>('control');
  const { connected } = useLiveAPIContext();

  // Switch to control panel automatically when connecting
  useEffect(() => {
    if (connected) {
      setActiveTab('control');
    }
  }, [connected]);

  return (
    <div className="panel-content-wrapper">
        <div className="producer-hub-tabs">
            <button
                className={cn('producer-hub-tab-button', { active: activeTab === 'control' })}
                onClick={() => setActiveTab('control')}
            >
                <span className="icon">gamepad</span>
                Control Panel
            </button>
            <button
                className={cn('producer-hub-tab-button', { active: activeTab === 'studio' })}
                onClick={() => setActiveTab('studio')}
            >
                <span className="icon">biotech</span>
                Producer Studio
            </button>
        </div>
        <div className="producer-hub-content">
            {activeTab === 'control' ? <ControlPanel /> : <Studio />}
        </div>
    </div>
  );
}

export default memo(ProducerControls);