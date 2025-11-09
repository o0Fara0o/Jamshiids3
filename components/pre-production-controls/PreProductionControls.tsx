/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import cn from 'classnames';
import { PodcastFormat, usePodcastStore, useHostStore, HostPersonality, useAgentStore, AgentTab, useHostCreationAgentStore, useVirtualSetStore, VirtualSet, useLaunchpadStore, useDescriptionAgentStore, useUI } from '@/lib/state';
import { useHostAgentContext, HostProfile } from '@/contexts/HostAgentContext';
import { useVirtualSetAgent } from '@/contexts/VirtualSetAgentContext';
import { useContentScoutAgentContext } from '@/contexts/ContentScoutAgentContext';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import EditHostModal from './EditHostModal';
import { fileToDataUrl, urlToInlineData } from '@/lib/utils';
import EditVirtualSetModal from './EditVirtualSetModal';
import {
    saveOrUpdateHost,
    deleteHost as dbDeleteHost,
    saveOrUpdateVirtualSet,
    deleteVirtualSet as dbDeleteVirtualSet,
} from '@/lib/db';
import { useDescriptionAgent } from '@/contexts/DescriptionAgentContext';

type PreProdTab = 'Launchpad' | 'Studio';
type StudioTab = 'Hosts' | 'Agent Briefing' | 'Virtual Set' | 'Description';

const AgentConfigurator = ({ agentType }: { agentType: AgentTab }) => {
    const {
        agents,
        addSourceUrl,
        removeSourceUrl,
        updateSystemPrompt,
        toggleTool,
        resetPrompt
    } = useAgentStore();
    const agentConfig = agents[agentType];
    const [newUrl, setNewUrl] = useState('');

    if (!agentConfig) {
        return <p>Select an agent to configure.</p>;
    }

    const handleAddUrl = (e: React.FormEvent) => {
        e.preventDefault();
        if (newUrl.trim()) {
            addSourceUrl(agentType, newUrl.trim());
            setNewUrl('');
        }
    };

    return (
        <div className="agent-config-panel">
            <div className="panel-section directive-panel">
                <h4 className="panel-section-title minor"><span className="icon">edit</span>Core Directive (System Prompt)</h4>
                <p className="panel-section-description">This is the agent's main instruction. It defines its personality, task, and response format.</p>
                <textarea rows={12} value={agentConfig.systemPrompt} onChange={e => updateSystemPrompt(agentType, e.target.value)} />
                <button className="reset-prompt-btn" onClick={() => resetPrompt(agentType)}>Reset to Default</button>
            </div>
            
            <div className="panel-section sources-panel">
                <h4 className="panel-section-title minor"><span className="icon">link</span>Intelligence Sources</h4>
                <p className="panel-section-description">Provide URLs for the 'URL Context' tool to analyze. This is ignored if 'Google Search' is active.</p>
                <ul className="source-url-list">
                    {agentConfig.sourceUrls.map((url, i) => (
                        <li key={i} className="source-url-item">
                            <span>{url}</span>
                            <button onClick={() => removeSourceUrl(agentType, url)} className="delete-url-btn" title="Remove URL">
                                <span className="icon">close</span>
                            </button>
                        </li>
                    ))}
                </ul>
                <form onSubmit={handleAddUrl} className="add-source-form">
                    <input
                        type="url"
                        placeholder="Add a new URL..."
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                    />
                    <button type="submit">Add</button>
                </form>
            </div>

            <div className="panel-section capabilities-panel">
                <h4 className="panel-section-title minor"><span className="icon">build</span>Agent Capabilities</h4>
                <p className="panel-section-description">'Google Search' is for broad discovery. 'URL Context' is for deep analysis of specific sources.</p>
                <div className="tool-toggle-list">
                    <label className="tool-toggle-item">
                        <span>Google Search (Broad Sourcing)</span>
                        <div className="switch">
                            <input type="checkbox" checked={agentConfig.tools.googleSearch} onChange={() => toggleTool(agentType, 'googleSearch')} />
                            <span className="slider round"></span>
                        </div>
                    </label>
                     <label className="tool-toggle-item">
                        <span>URL Context (Deep Analysis)</span>
                         <div className="switch">
                            <input type="checkbox" checked={agentConfig.tools.urlContext} onChange={() => toggleTool(agentType, 'urlContext')} />
                            <span className="slider round"></span>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
};


function PreProductionControls() {
  const { connected } = useLiveAPIContext();
  const [activeTab, setActiveTab] = useState<PreProdTab>('Launchpad');
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>('Hosts');
  
  const { agents, addAgent, removeAgent } = useAgentStore();
  const agentNames = Object.keys(agents);
  const [activeAgentTab, setActiveAgentTab] = useState<AgentTab>(agentNames[0] || '');
  const [newAgentName, setNewAgentName] = useState('');


  const {
    episodeTitle,
    episodeDescription,
    episodeSubject,
    podcastFormat,
    sourceContext,
    setEpisodeTitle,
    setEpisodeDescription,
    setEpisodeSubject,
    setPodcastFormat,
    setSourceContext,
  } = usePodcastStore();
  
  const { hosts, addHost, removeHost, updateHost, host1Selection, host2Selection, setHost1Selection, setHost2Selection, getHostByName } = useHostStore();
  
  // Studio Asset State
  const { sets, addSet, removeSet, updateSet } = useVirtualSetStore();

  // Host Management State
  const [editingHost, setEditingHost] = useState<HostPersonality | null>(null);
  const [viewingHost, setViewingHost] = useState<HostPersonality | null>(null);

  // Host Agent State
  const { createHostProfile } = useHostAgentContext();
  const { systemPrompt: hostCreationPrompt, setSystemPrompt: setHostCreationPrompt, resetSystemPrompt: resetHostCreationPrompt } = useHostCreationAgentStore();
  const [isHostThinking, setIsHostThinking] = useState(false);
  const [generatedProfile, setGeneratedProfile] = useState<HostProfile | null>(null);
  const [newHostName, setNewHostName] = useState('');
  const [newHostInfo, setNewHostInfo] = useState('');
  const [newHostPrimaryImage, setNewHostPrimaryImage] = useState<string>('');
  
  // Description Agent State
  const { generateDescription } = useDescriptionAgent();
  const { systemPrompt: descriptionAgentPrompt, setSystemPrompt: setDescriptionAgentPrompt, resetSystemPrompt: resetDescriptionAgentPrompt } = useDescriptionAgentStore();
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  // Virtual Set State
  const { generateVirtualSet, composeScene } = useVirtualSetAgent();
  const [newSetPrompt, setNewSetPrompt] = useState('');
  const [isGeneratingSet, setIsGeneratingSet] = useState(false);
  const [editingSet, setEditingSet] = useState<VirtualSet | null>(null);

  // Launchpad State (from persistent store)
  const {
    selectedSetId, setSelectedSetId,
    generatedSceneUrl, setGeneratedSceneUrl,
    sceneGenerationPrompt, setSceneGenerationPrompt,
    resetLaunchpad,
  } = useLaunchpadStore();
  
  // Transient (non-persisted) UI state
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [sceneEditPrompt, setSceneEditPrompt] = useState('');
  
  // Topic selection state
  const [selectedSuggestions, setSelectedSuggestions] = useState<{title: string, url: string}[]>([]);
  const [isManuallyEditingTopic, setIsManuallyEditingTopic] = useState(false);
  
  // Agentic Fetching from new context
  const { fetchIdeas, suggestions, isThinking: isFetchingContent, error: fetchError, thinkingSteps, clearSuggestionsAndSteps } = useContentScoutAgentContext();
  
  // Make sure activeAgentTab is always valid
  useEffect(() => {
    if (agentNames.length > 0 && !agentNames.includes(activeAgentTab)) {
        setActiveAgentTab(agentNames[0]);
    } else if (agentNames.length === 0) {
        setActiveAgentTab('');
    }
  }, [agentNames, activeAgentTab]);

  useEffect(() => {
    if (viewingHost && !hosts.some(h => h.name === viewingHost.name)) {
      setViewingHost(null);
    }
  }, [hosts, viewingHost]);

  useEffect(() => {
      if (!viewingHost && host1Selection) {
          const host1 = getHostByName(host1Selection);
          if (host1) setViewingHost(host1);
      }
  }, [host1Selection, viewingHost, getHostByName]);

  const handleHostSelect = (slot: 'host1' | 'host2', hostName: string) => {
    if (connected) return;
    if (slot === 'host1') {
        if (host1Selection === hostName) { // unassign
            setHost1Selection('');
        } else {
            setHost1Selection(hostName);
        }
    } else { // slot === 'host2'
        if (host2Selection === hostName) { // unassign
            setHost2Selection('');
        } else {
            setHost2Selection(hostName);
        }
    }
  };

  const handleAddAgent = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newAgentName.trim();
    if (addAgent(trimmedName)) {
        setActiveAgentTab(trimmedName); // Switch to the new agent
        setNewAgentName(''); // Clear input
    }
  };

  const handleDeleteAgent = (agentNameToDelete: AgentTab) => {
    if (window.confirm(`Are you sure you want to delete the "${agentNameToDelete}" agent? This cannot be undone.`)) {
        removeAgent(agentNameToDelete);
    }
  };

  const handleSuggestionClick = (suggestion: {title: string, url: string}) => {
    if (connected) return;

    setIsManuallyEditingTopic(false);
    setSelectedSuggestions(currentSelection => {
        const isSelected = currentSelection.some(sel => sel.url === suggestion.url);
        const newSelection = isSelected
            ? currentSelection.filter(s => s.url !== suggestion.url)
            : [...currentSelection, suggestion];
        
        const titles = newSelection.map(s => s.title).join(' & ');
        const urls = newSelection.map(s => s.url).join(' ');

        setEpisodeTitle(titles);
        setSourceContext(urls);

        return newSelection;
    });
  };

  const handleManualTopicInput = (value: string) => {
    setIsManuallyEditingTopic(true);
    setSourceContext(value);
  };

  const handleGenerateDescription = async () => {
    if (!sourceContext.trim() && podcastFormat === 'Freestyle') {
        alert("Please set a topic first (Step 2) before generating a description.");
        return;
    }
    setIsGeneratingDesc(true);
    const context = sourceContext || `A freestyle conversation between ${host1Selection} and ${host2Selection}.`;
    const result = await generateDescription(context);
    if (result) {
        setEpisodeTitle(result.title);
        setEpisodeDescription(result.description);
        setEpisodeSubject(result.subject);
    }
    setIsGeneratingDesc(false);
  };
  
  const handleDeployAllScouts = () => {
    if (isFetchingContent || connected) return;
    clearSuggestionsAndSteps();
    agentNames.forEach(format => fetchIdeas(format as PodcastFormat));
  };

  const handleCreateHost = async () => {
    if (newHostName.trim() && newHostInfo.trim() && newHostPrimaryImage) {
        setIsHostThinking(true);
        setGeneratedProfile(null);
        const profile = await createHostProfile({ name: newHostName, backgroundInfo: newHostInfo, systemPrompt: hostCreationPrompt });
        if (profile) setGeneratedProfile(profile);
        setIsHostThinking(false);
    } else alert("Please provide a name, background information, and an image for the new host.");
  };

  const handleSaveHost = async () => {
    if (generatedProfile && newHostPrimaryImage) {
        const newHost = { ...generatedProfile, prompt: generatedProfile.personalityPrompt, primaryImageUrl: newHostPrimaryImage, imageUrls: [newHostPrimaryImage] };
        await saveOrUpdateHost(newHost);
        addHost(newHost);
        setNewHostName(''); setNewHostInfo(''); setNewHostPrimaryImage(''); setGeneratedProfile(null);
    } else alert('Please make sure a profile is generated and an image is selected.');
  };

  const handleHostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setNewHostPrimaryImage(await fileToDataUrl(file));
  };

  const handleDeleteHost = async (hostName: string) => {
    if (window.confirm(`Are you sure you want to delete "${hostName}"?`)) {
        await dbDeleteHost(hostName);
        removeHost(hostName);
    }
  };

  const handleSaveHostEdit = async (originalName: string, updatedHost: HostPersonality) => {
    await saveOrUpdateHost(updatedHost);
    updateHost(originalName, updatedHost);
    setEditingHost(null);
  };

  const handleGenerateSet = async () => {
    if (!newSetPrompt.trim()) { alert("Please enter a prompt for the virtual set."); return; }
    setIsGeneratingSet(true);
    const result = await generateVirtualSet(newSetPrompt);
    if (result) {
        const newSet: VirtualSet = { 
            id: Date.now().toString(), 
            name: newSetPrompt.substring(0, 50) || 'Untitled Set', 
            imageUrl: result.imageUrl,
            generationPrompt: newSetPrompt 
        };
        await saveOrUpdateVirtualSet(newSet);
        addSet(newSet);
    }
    setIsGeneratingSet(false);
    setNewSetPrompt('');
  }

    const handleAsyncSetEdit = async (data: {
        id: string;
        name: string;
        prompt: string;
        editImage?: { dataUrl: string; } | null;
    }) => {
        const { id, name, prompt, editImage: uploadedEditImage } = data;
        const currentSet = sets.find(s => s.id === id);
        if (!currentSet) return;

        const updatedSetData = {
            ...currentSet,
            name: name.trim(),
            generationPrompt: prompt,
            isGenerating: true,
        };
        await saveOrUpdateVirtualSet(updatedSetData);
        updateSet(id, updatedSetData);

        try {
            const result = await composeScene({ 
                baseStudioUrl: currentSet.imageUrl,
                host1ImageUrl: uploadedEditImage ? uploadedEditImage.dataUrl : '',
                host2ImageUrl: '',
                prompt: prompt 
            });


            if (result && result.imageUrl) {
                const finalSetData = { ...updatedSetData, imageUrl: result.imageUrl, isGenerating: false };
                await saveOrUpdateVirtualSet(finalSetData);
                updateSet(id, finalSetData);
            } else {
                throw new Error('Image generation did not return an image.');
            }
        } catch (error) {
            console.error('Error during async set edit:', error);
            alert('Failed to update the virtual set image.');
            const finalSetData = { ...updatedSetData, isGenerating: false };
            await saveOrUpdateVirtualSet(finalSetData);
            updateSet(id, finalSetData);
        }
    };
  
  const handleRemoveSet = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this virtual set?")) {
        await dbDeleteVirtualSet(id);
        removeSet(id);
        setEditingSet(null); // Close modal if open
    }
  };
  
  const handleGenerateScene = async () => {
      const host1 = getHostByName(host1Selection);
      const host2 = getHostByName(host2Selection);
      const set = sets.find(s => s.id === selectedSetId);
      if (!host1 || !host2 || !set) { alert("Please select two hosts and a virtual set."); return; }
      
      if (!sceneGenerationPrompt.trim()) {
        alert("Please provide a prompt for scene generation.");
        return;
      }
      
      setIsGeneratingScene(true);
      setGeneratedSceneUrl(''); // Clear previous image before new generation
      const result = await composeScene({ 
          baseStudioUrl: set.imageUrl, 
          host1ImageUrl: host1.primaryImageUrl, 
          host2ImageUrl: host2.primaryImageUrl,
          prompt: sceneGenerationPrompt 
      });

      if (result) {
        setGeneratedSceneUrl(result.imageUrl);
        // UX Enhancement: Automatically transition to the producer panel.
        useUI.getState().openProducerPanel();
        useUI.getState().closePreProdPanel();
      }
      setIsGeneratingScene(false);
  }

  const handleEditScene = async () => {
    if (!sceneEditPrompt.trim() || !generatedSceneUrl) return;
    setIsGeneratingScene(true);
    try {
        const inlineData = await urlToInlineData(generatedSceneUrl);
        const result = await composeScene({
            baseStudioUrl: generatedSceneUrl,
            host1ImageUrl: '', // Not needed for simple edit
            host2ImageUrl: '', // Not needed for simple edit
            prompt: sceneEditPrompt
        });
        if (result) {
            setGeneratedSceneUrl(result.imageUrl);
        }
    } catch (error) {
        console.error('Error editing scene:', error);
        alert('Failed to edit scene.');
    } finally {
        setIsGeneratingScene(false);
        setSceneEditPrompt('');
    }
  };

  const getHostBio = (prompt: string) => prompt.split('\n')[0];

  const renderLaunchpad = () => (
    <div className="tab-content launchpad-grid">
        <div className="panel-section host-selection-section">
          <h3 className="panel-section-title"><span className="icon">mic</span>Step 1: Choose Hosts</h3>
          <div className="host-selection-layout">
            <div className="host-list-panel">
                <div className="host-list">
                {hosts.map(host => (
                    <div
                        key={host.name}
                        className={cn('host-list-item', {
                            'selected-view': viewingHost?.name === host.name,
                            'is-host-1': host1Selection === host.name,
                            'is-host-2': host2Selection === host.name,
                        })}
                        onClick={() => setViewingHost(host)}
                        role="button"
                        tabIndex={0}
                        aria-label={`View details for ${host.name}`}
                    >
                        <img src={host.primaryImageUrl} alt={host.name} />
                        <span>{host.name}</span>
                        {host1Selection === host.name && <div className="host-badge host1">H1</div>}
                        {host2Selection === host.name && <div className="host-badge host2">H2</div>}
                    </div>
                ))}
                </div>
            </div>
            <div className="host-details-panel">
                {viewingHost ? (
                    <>
                        <img className="details-avatar" src={viewingHost.primaryImageUrl} alt={viewingHost.name} />
                        <h3>{viewingHost.name}</h3>
                        <p>{getHostBio(viewingHost.prompt)}</p>
                        <div className="details-actions">
                            <button
                                onClick={() => handleHostSelect('host1', viewingHost.name)}
                                className={cn({ active: host1Selection === viewingHost.name }, 'host1-btn')}
                                disabled={connected || host2Selection === viewingHost.name}
                            >
                                {host1Selection === viewingHost.name ? 'Unassign Host 1' : 'Set as Host 1'}
                            </button>
                            <button
                                onClick={() => handleHostSelect('host2', viewingHost.name)}
                                className={cn({ active: host2Selection === viewingHost.name }, 'host2-btn')}
                                disabled={connected || host1Selection === viewingHost.name}
                            >
                                {host2Selection === viewingHost.name ? 'Unassign Host 2' : 'Set as Host 2'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="details-placeholder">
                        <span className="icon">person_search</span>
                        <p>Select a host from the list to see their details and assign them to the show.</p>
                    </div>
                )}
            </div>
          </div>
        </div>
      
        <div className="panel-section format-source-section">
          <h3 className="panel-section-title"><span className="icon">list_alt</span>Step 2: Set Topic</h3>
           <div className="format-source-grid">
              <div className="format-selector">
                <button key="Freestyle" className={cn('format-card', {active: podcastFormat === 'Freestyle'})} onClick={() => setPodcastFormat('Freestyle')} disabled={connected}>
                  Freestyle
                </button>
                {agentNames.map(name => (
                  <button key={name} className={cn('format-card', {active: podcastFormat === name})} onClick={() => setPodcastFormat(name as PodcastFormat)} disabled={connected}>
                    {name}
                  </button>
                ))}
              </div>
              <div className="content-terminal">
                  <div className="terminal-header">Content Scout Terminal</div>
                  <div className="terminal-output">
                      {isFetchingContent && thinkingSteps.map((step, i) => <p key={i} className="terminal-log">{step}</p>)}
                      {fetchError && <p className="terminal-log error">{fetchError}</p>}
                      {Object.keys(suggestions).length > 0 && (
                          Object.entries(suggestions).map(([format, suggestionList]) => (
                            <div key={format} className="suggestion-group">
                              <h4>{format}</h4>
                              <div className="suggestion-list">
                                {suggestionList && Array.isArray(suggestionList) && suggestionList.map((s, i) => {
                                  const isSelected = !isManuallyEditingTopic && selectedSuggestions.some(sel => sel.url === s.url);
                                  return (
                                    <button key={i} className={cn('suggestion-card', {selected: isSelected})} onClick={() => handleSuggestionClick(s)} disabled={connected}>{s.title}</button>
                                  )
                                })}
                              </div>
                            </div>
                          ))
                      )}
                       {podcastFormat === 'Freestyle' && !isFetchingContent && Object.keys(suggestions).length === 0 && (
                          <p className="terminal-log disabled">Freestyle format selected. The hosts will choose their own topic.</p>
                       )}
                  </div>
                  <div className="terminal-actions">
                    <div className="batch-scout-actions">
                      {podcastFormat !== 'Freestyle' && (
                          <button className="fetch-content-btn" onClick={() => { clearSuggestionsAndSteps(); fetchIdeas(podcastFormat); }} disabled={isFetchingContent || connected}>
                              {isFetchingContent ? <><span className="icon sync">sync</span>Scouting...</> : <><span className="icon">travel_explore</span>{`Deploy ${podcastFormat} Scout`}</>}
                          </button>
                      )}
                      <button className="fetch-content-btn secondary" onClick={handleDeployAllScouts} disabled={isFetchingContent || connected}>
                          <span className="icon">hub</span>Deploy All Scouts
                      </button>
                    </div>
                    <input
                        type="text"
                        value={sourceContext}
                        onChange={e => handleManualTopicInput(e.target.value)}
                        placeholder="Or enter a URL / topic manually..."
                        disabled={connected}
                    />
                  </div>
              </div>
           </div>
        </div>

        <div className="panel-section description-generation-section">
            <h3 className="panel-section-title"><span className="icon">subtitles</span>Step 3: Finalize Description</h3>
            <div className="description-editor-form">
                <div className="form-field">
                    <label>Episode Title</label>
                    <input type="text" value={episodeTitle} onChange={e => setEpisodeTitle(e.target.value)} disabled={connected} />
                </div>
                <div className="form-field">
                    <label>Episode Subject / Keywords</label>
                    <input type="text" value={episodeSubject} onChange={e => setEpisodeSubject(e.target.value)} disabled={connected} />
                </div>
                <div className="form-field">
                    <label>Episode Description</label>
                    <textarea rows={5} value={episodeDescription} onChange={e => setEpisodeDescription(e.target.value)} disabled={connected}></textarea>
                </div>
                <button className="generate-host-btn" onClick={handleGenerateDescription} disabled={isGeneratingDesc || connected}>
                    {isGeneratingDesc ? <><span className="icon sync">sync</span>Generating...</> : <><span className="icon">auto_fix_high</span>Generate with AI</>}
                </button>
            </div>
        </div>
        
        <div className="panel-section set-selection-section">
            <h3 className="panel-section-title"><span className="icon">photo_camera_front</span>Step 4: Choose Your Set</h3>
            <div className="virtual-set-gallery">
                {sets.map(set => (
                    <div key={set.id} className={cn('asset-card', {selected: selectedSetId === set.id})} onClick={() => setSelectedSetId(set.id)} role="button" tabIndex={0} aria-label={`Select set ${set.name}`}>
                        <img src={set.imageUrl} alt={set.name} />
                        <p>{set.name}</p>
                    </div>
                ))}
            </div>
        </div>

        <div className="panel-section scene-composition-section">
            <h3 className="panel-section-title"><span className="icon">switch_video</span>Step 5: Compose Scene</h3>
            <div className="scene-generation-area">
                <div className="scene-preview">
                    {isGeneratingScene && <div className="spinner-overlay"><div className="spinner"></div></div>}
                    {generatedSceneUrl ? <img src={generatedSceneUrl} alt="Generated podcast scene" /> : <p className="image-placeholder-text">Scene will appear here</p>}
                </div>
                <div className="scene-generation-controls">
                    <div className="scene-editing-controls">
                        <label>Composition Prompt</label>
                        <div className="prompt-input-bar">
                           <textarea
                                value={sceneGenerationPrompt}
                                onChange={e => setSceneGenerationPrompt(e.target.value)}
                                rows={3}
                                disabled={isGeneratingScene}
                            />
                            <button onClick={handleGenerateScene} disabled={isGeneratingScene || !host1Selection || !host2Selection || !selectedSetId} title={generatedSceneUrl ? 'Regenerate Scene' : 'Generate Scene'}>
                                <span className="icon">{generatedSceneUrl ? 'refresh' : 'send'}</span>
                            </button>
                        </div>
                         <div className="suggestion-chips">
                            <button className="suggestion-chip" onClick={() => setSceneGenerationPrompt("Place the two hosts naturally within the scene, sitting at a desk and having an engaged conversation.")}>Engaged Conversation</button>
                            <button className="suggestion-chip" onClick={() => setSceneGenerationPrompt("A casual coffee shop setting with both hosts relaxed on sofas.")}>Coffee Shop</button>
                            <button className="suggestion-chip" onClick={() => setSceneGenerationPrompt("Rooftop interview at sunset with a city skyline view.")}>Rooftop Sunset</button>
                        </div>
                    </div>

                    {generatedSceneUrl && (
                        <div className="scene-editing-controls">
                            <label>Refine Scene Prompt</label>
                             <div className="prompt-input-bar">
                                <textarea
                                    value={sceneEditPrompt}
                                    onChange={e => setSceneEditPrompt(e.target.value)}
                                    placeholder="e.g., 'make the lighting warmer'"
                                    rows={2}
                                    disabled={isGeneratingScene}
                                />
                                <button onClick={handleEditScene} disabled={isGeneratingScene || !sceneEditPrompt.trim()} title="Apply Edit">
                                    <span className="icon">brush</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <footer className="launchpad-footer">
             <p className="panel-section-description" style={{textAlign: 'center', margin: '0'}}>
                Your episode is ready! Open the <span className="icon" style={{verticalAlign: 'text-bottom'}}>settings</span> <strong>Producer Hub</strong> to start the stream.
            </p>
        </footer>
    </div>
  );

  const renderStudio = () => (
    <div className="tab-content">
      <div className="studio-inner-tabs">
        <button className={cn('studio-tab-button', {active: activeStudioTab === 'Hosts'})} onClick={() => setActiveStudioTab('Hosts')}><span className="icon">groups</span>Host Studio</button>
        <button className={cn('studio-tab-button', {active: activeStudioTab === 'Agent Briefing'})} onClick={() => setActiveStudioTab('Agent Briefing')}><span className="icon">memory</span>Agent Briefing</button>
        <button className={cn('studio-tab-button', {active: activeStudioTab === 'Virtual Set'})} onClick={() => setActiveStudioTab('Virtual Set')}><span className="icon">videocam</span>Virtual Set</button>
        <button className={cn('studio-tab-button', {active: activeStudioTab === 'Description'})} onClick={() => setActiveStudioTab('Description')}><span className="icon">subtitles</span>Description Studio</button>
      </div>
      <div className="studio-main-content">
        {activeStudioTab === 'Hosts' && <>
            <div className="panel-section">
                <h3 className="panel-section-title"><span className="icon">recent_actors</span>Your Hosts</h3>
                <div className="host-card-gallery studio-host-gallery">
                    {hosts.map(host => (
                        <div key={host.name} className="host-card">
                             <div className="studio-host-actions">
                                <button title="Edit Host" onClick={() => setEditingHost(host)}><span className="icon">edit</span></button>
                                <button title="Delete Host" onClick={() => handleDeleteHost(host.name)}><span className="icon">delete</span></button>
                            </div>
                            <img src={host.primaryImageUrl} alt={host.name} className="host-card-avatar" />
                            <div className="host-card-info">
                                <h4 className="host-card-name">{host.name}</h4>
                                <p className="host-card-bio">{getHostBio(host.prompt)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="panel-section">
                <h3 className="panel-section-title"><span className="icon">person_add</span>Host Creation Agent</h3>
                <div className="host-creation-form">
                    <div className="host-creation-grid">
                        <div className="host-creation-inputs">
                            <label>Host Name</label>
                            <input type="text" placeholder="e.g., 'Socrates'" value={newHostName} onChange={e => setNewHostName(e.target.value)} disabled={isHostThinking} />
                            <label>Background Information</label>
                            <textarea placeholder="Paste text about the host's life, work, and personality..." value={newHostInfo} onChange={e => setNewHostInfo(e.target.value)} rows={8} disabled={isHostThinking}></textarea>
                            <label>Upload Portrait Image</label>
                            <input type="file" accept="image/*" onChange={handleHostImageUpload} disabled={isHostThinking} />
                        </div>
                        <div className="host-creation-preview">
                            {newHostPrimaryImage && <img src={newHostPrimaryImage} alt="Preview" className="host-image-preview" />}
                        </div>
                    </div>
                    <details className="collapsible-details">
                        <summary>View & Edit Host Creation Prompt</summary>
                         <div className="collapsible-content">
                            <textarea rows={8} value={hostCreationPrompt} onChange={(e) => setHostCreationPrompt(e.target.value)} />
                            <button className="reset-prompt-btn" style={{marginTop: '8px'}} onClick={() => resetHostCreationPrompt()}>Reset to Default</button>
                         </div>
                    </details>
                    <button className="generate-host-btn" onClick={handleCreateHost} disabled={isHostThinking || !newHostName.trim() || !newHostInfo.trim() || !newHostPrimaryImage}>
                      {isHostThinking ? <><span className="icon sync">sync</span>Generating...</> : <><span className="icon">auto_fix_high</span>Generate Profile</>}
                    </button>
                    {generatedProfile && (
                        <div className="generated-host-profile">
                            <h4>Generated Profile for "{generatedProfile.name}"</h4>
                            <p><strong>Bio:</strong> {generatedProfile.bio}</p>
                            <p><strong>Personality Prompt:</strong> {generatedProfile.personalityPrompt}</p>
                            <button className="save-host-btn" onClick={handleSaveHost}><span className="icon">save</span> Save Host</button>
                        </div>
                    )}
                </div>
            </div>
        </>}
        {activeStudioTab === 'Agent Briefing' && <div className="panel-section">
            <h3 className="panel-section-title"><span className="icon">smart_toy</span>Agent Briefing Room</h3>
            <p className="panel-section-description">Configure the behavior of your AI Content Scouts. Changes are saved automatically.</p>
            <div className="agent-tabs-container">
                <div className="agent-tabs">
                    {agentNames.map(name => (
                        <div key={name} className="agent-tab-wrapper">
                            <button className={cn({active: activeAgentTab === name})} onClick={() => setActiveAgentTab(name as AgentTab)}>
                                <span className="icon">smart_toy</span>{name}
                            </button>
                            <button className="delete-agent-btn" onClick={() => handleDeleteAgent(name as AgentTab)} title={`Delete ${name}`}>
                                <span className="icon">close</span>
                            </button>
                        </div>
                    ))}
                </div>
                <form onSubmit={handleAddAgent} className="add-agent-form">
                    <input 
                        type="text" 
                        value={newAgentName}
                        onChange={e => setNewAgentName(e.target.value)}
                        placeholder="New scout name..."
                    />
                    <button type="submit" disabled={!newAgentName.trim()}>Create</button>
                </form>
            </div>
            {activeAgentTab && <AgentConfigurator agentType={activeAgentTab} />}
        </div>}
         {activeStudioTab === 'Virtual Set' && <>
            <div className="panel-section">
                <h3 className="panel-section-title"><span className="icon">scene</span>Your Virtual Sets</h3>
                 <p className="panel-section-description">Your created sets are saved automatically. Click a set to edit it.</p>
                <div className="virtual-set-gallery">
                {sets.map(set => (
                    <div key={set.id} className="asset-card" onClick={() => setEditingSet(set)} role="button" tabIndex={0} aria-label={`Edit set ${set.name}`}>
                        {set.isGenerating && <div className="spinner-overlay"><div className="spinner"></div></div>}
                        <img src={set.imageUrl} alt={set.name} />
                        <p>{set.name}</p>
                    </div>
                ))}
                </div>
            </div>
            <div className="panel-section">
                <h3 className="panel-section-title"><span className="icon">add_a_photo</span>Create New Virtual Set</h3>
                <div className="asset-creation-form">
                    <textarea placeholder="Describe the empty studio..." value={newSetPrompt} onChange={e => setNewSetPrompt(e.target.value)} rows={3}/>
                    <button onClick={handleGenerateSet} disabled={isGeneratingSet}>
                        {isGeneratingSet ? 'Generating...' : 'Generate Set'}
                    </button>
                </div>
            </div>
        </>}
        {activeStudioTab === 'Description' && 
            <div className="panel-section">
                <h3 className="panel-section-title"><span className="icon">subtitles</span>Episode Description</h3>
                <p className="panel-section-description">This metadata will be used for your podcast platform. You can edit it here or generate it with AI based on the topic from the Launchpad.</p>
                <div className="description-editor-form">
                    <div className="form-field">
                        <label>Episode Title</label>
                        <input type="text" value={episodeTitle} onChange={e => setEpisodeTitle(e.target.value)} disabled={connected} />
                    </div>
                    <div className="form-field">
                        <label>Episode Subject / Keywords</label>
                        <input type="text" value={episodeSubject} onChange={e => setEpisodeSubject(e.target.value)} disabled={connected} />
                    </div>
                    <div className="form-field">
                        <label>Episode Description</label>
                        <textarea rows={8} value={episodeDescription} onChange={e => setEpisodeDescription(e.target.value)} disabled={connected}></textarea>
                    </div>
                    <button className="generate-host-btn" onClick={handleGenerateDescription} disabled={isGeneratingDesc || connected}>
                        {isGeneratingDesc ? <><span className="icon sync">sync</span>Generating...</> : <><span className="icon">auto_fix_high</span>Generate with AI</>}
                    </button>
                </div>
                <details className="collapsible-details" style={{marginTop: '24px'}}>
                    <summary>View & Edit Description Agent Prompt</summary>
                    <div className="collapsible-content">
                        <textarea rows={8} value={descriptionAgentPrompt} onChange={(e) => setDescriptionAgentPrompt(e.target.value)} />
                        <button className="reset-prompt-btn" style={{marginTop: '8px'}} onClick={() => resetDescriptionAgentPrompt()}>Reset to Default</button>
                    </div>
                </details>
            </div>
        }
      </div>
    </div>
  );

  return (
    <>
      <div className="panel-content-wrapper pre-production-panel-wrapper">
          <div className="pre-production-tabs">
              <button className={cn('tab-button', {active: activeTab === 'Launchpad'})} onClick={() => setActiveTab('Launchpad')}><span className="icon">rocket_launch</span>Launchpad</button>
              <button className={cn('tab-button', {active: activeTab === 'Studio'})} onClick={() => setActiveTab('Studio')}><span className="icon">construction</span>Studio</button>
          </div>
          <div className="panel-content-wrapper">
              <div className="pre-production-panel-content">
                  {activeTab === 'Launchpad' ? renderLaunchpad() : renderStudio()}
              </div>
          </div>
        </div>
      {editingHost && <EditHostModal host={editingHost} onClose={() => setEditingHost(null)} onSave={handleSaveHostEdit} />}
      {editingSet && <EditVirtualSetModal set={editingSet} onClose={() => setEditingSet(null)} onSubmit={handleAsyncSetEdit} onDelete={handleRemoveSet} />}
    </>
  );
}

export default PreProductionControls;