/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { useVideoStudioStore, useLogStore, usePostProductionStore, useHostStore, useVirtualSetStore, useLaunchpadStore, ScenePlan, useFilmDirectorAgentStore } from '@/lib/state';
import { useFilmDirectorAI } from '@/contexts/FilmDirectorAIContext';
import { useVirtualSetAgent } from '@/contexts/VirtualSetAgentContext';
import { useThumbnailAgent } from '@/contexts/ThumbnailAgentContext';
import { useVideoAgent } from '@/contexts/VideoAgentContext';
import cn from 'classnames';

// A new component for the Scene Card
const SceneCard: React.FC<{ scene: ScenePlan; index: number }> = ({ scene, index }) => {
    const { updateScene } = useVideoStudioStore();
    const { generateVideoClip } = useVideoAgent();
    const { composeScene } = useVirtualSetAgent();
    const { generateImage } = useThumbnailAgent();
    
    const {
        aRollImageModel, aRollImageGenerationPrompt,
        bRollImageModel, bRollImageGenerationPrompt,
        videoGenerationModel, videoGenerationPrompt,
    } = useFilmDirectorAgentStore.getState();
    const { generatedSceneUrl } = useLaunchpadStore.getState();
    const { getHostByName } = useHostStore.getState();
    const { host1Selection, host2Selection } = useHostStore.getState();
    const { sets } = useVirtualSetStore.getState();
    const { selectedSetId } = useLaunchpadStore.getState();

    const host1 = getHostByName(host1Selection);
    const host2 = getHostByName(host2Selection);
    const virtualSet = sets.find(s => s.id === selectedSetId);


    const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateScene(index, { finalVideoPrompt: e.target.value });
    };

    const handleGenerateImage = async () => {
        updateScene(index, { isGeneratingBase: true, baseImageUrl: undefined, finalVideoUrl: undefined });
        let newImageUrl: string | null = null;
        try {
            if (scene.shotType === 'A-Roll') {
                if (!generatedSceneUrl) {
                    alert('Master scene image is missing from the Launchpad. Cannot generate A-Roll.');
                    throw new Error('Master scene image not found.');
                }
                const result = await composeScene({
                    baseStudioUrl: generatedSceneUrl,
                    host1ImageUrl: '', 
                    host2ImageUrl: '', 
                    prompt: `${aRollImageGenerationPrompt} The action is: ${scene.actionPrompt}`
                });
                newImageUrl = result?.imageUrl || null;
            } else { // B-Roll
                const result = await generateImage({
                    prompt: `${bRollImageGenerationPrompt} The creative brief is: ${scene.bRollPrompt}`,
                    aspectRatio: '16:9'
                });
                newImageUrl = result?.imageUrl || null;
            }
            if (newImageUrl) {
                updateScene(index, { baseImageUrl: newImageUrl });
            }
        } catch (error) {
            console.error(`Failed to generate image for scene ${index + 1}:`, error);
        } finally {
            updateScene(index, { isGeneratingBase: false });
        }
    };

    const handleGenerateVideo = async () => {
        const currentSceneState = useVideoStudioStore.getState().shootingScript?.[index];
        if (!currentSceneState?.baseImageUrl || !currentSceneState?.finalVideoPrompt) {
            alert("Base image or final prompt is missing.");
            return;
        }
        updateScene(index, { isGeneratingVideo: true });
        const videoUrl = await generateVideoClip({ 
            baseImageUrl: currentSceneState.baseImageUrl, 
            prompt: `${videoGenerationPrompt} The action is: ${currentSceneState.finalVideoPrompt}`
        });
        updateScene(index, { finalVideoUrl: videoUrl || undefined, isGeneratingVideo: false });
    };

    if (scene.shotType === 'Placeholder') {
        return (
             <div className="scene-card placeholder">
                <div className="scene-card-preview">
                    <span className="icon">movie</span>
                </div>
                <div className="scene-card-info">
                    <p><strong>Scene #{index + 1}</strong></p>
                    <p><em>{scene.transcriptChunk}</em></p>
                </div>
             </div>
        );
    }

    return (
        <div className="scene-card">
            <div className="scene-card-preview">
                {(scene.isGeneratingBase || scene.isGeneratingVideo) && (
                    <div className="spinner-overlay">
                        <div className="spinner"></div>
                        <p>{scene.isGeneratingVideo ? 'Animating clip...' : 'Creating shot...'}</p>
                    </div>
                )}
                {scene.finalVideoUrl ? (
                    <video src={scene.finalVideoUrl} controls loop key={scene.finalVideoUrl} />
                ) : scene.baseImageUrl ? (
                    <img src={scene.baseImageUrl} alt={`Base for scene ${index + 1}`} />
                ) : <div className="image-placeholder-text"><span className="icon">image</span></div>}

                {scene.finalVideoUrl && scene.baseImageUrl && (
                    <img src={scene.baseImageUrl} alt="Base image thumbnail" className="base-image-thumbnail" />
                )}
            </div>
            <div className="scene-card-info">
                 <details className="scene-inputs-collapsible">
                    <summary>Scene Inputs</summary>
                    <div className="scene-inputs-content">
                        {host1 && <div className="input-thumb"><img src={host1.primaryImageUrl} alt={host1.name} /><span>{host1.name}</span></div>}
                        {host2 && <div className="input-thumb"><img src={host2.primaryImageUrl} alt={host2.name} /><span>{host2.name}</span></div>}
                        {virtualSet && <div className="input-thumb"><img src={virtualSet.imageUrl} alt={virtualSet.name} /><span>{virtualSet.name}</span></div>}
                    </div>
                 </details>
                <p><strong>#{index + 1} / {scene.shotType}</strong></p>
                <p><strong>Angle:</strong> {scene.cameraAngle}</p>
                <p><em>"{scene.transcriptChunk}"</em></p>
            </div>
            <div className="scene-card-prompt">
                <label>Video Generation Prompt</label>
                <textarea
                    rows={4}
                    value={scene.finalVideoPrompt}
                    onChange={handlePromptChange}
                    disabled={scene.isGeneratingVideo}
                />
            </div>
            <div className="scene-card-actions">
                <button onClick={handleGenerateImage} disabled={scene.isGeneratingBase || scene.isGeneratingVideo}>
                     <span className={cn("icon", { 'sync': scene.isGeneratingBase })}>{scene.isGeneratingBase ? 'sync' : 'image'}</span>
                    {scene.isGeneratingBase ? 'Generating...' : scene.baseImageUrl ? 'Regen Image' : 'Generate Image'}
                </button>
                <button onClick={handleGenerateVideo} disabled={!scene.baseImageUrl || !scene.finalVideoPrompt || scene.isGeneratingVideo}>
                    <span className={cn("icon", { 'sync': scene.isGeneratingVideo })}>{scene.isGeneratingVideo ? 'sync' : 'movie'}</span>
                    {scene.isGeneratingVideo ? 'Generating...' : scene.finalVideoUrl ? 'Regen Clip' : 'Generate Clip'}
                </button>
            </div>
        </div>
    );
};

const DirectorBriefing = () => {
    const { 
        scriptGenerationModel, setScriptGenerationModel,
        aRollImageModel, setARollImageModel,
        bRollImageModel, setBRollImageModel,
        videoGenerationModel, setVideoGenerationModel,

        scriptGenerationPrompt, setScriptGenerationPrompt, resetScriptGenerationPrompt,
        aRollImageGenerationPrompt, setARollImageGenerationPrompt, resetARollImageGenerationPrompt,
        bRollImageGenerationPrompt, setBRollImageGenerationPrompt, resetBRollImageGenerationPrompt,
        videoGenerationPrompt, setVideoGenerationPrompt, resetVideoGenerationPrompt
    } = useFilmDirectorAgentStore();
    
    return (
        <div className="director-briefing-content">
            <details className="studio-section" open>
                <summary><h3><span className="icon">biotech</span>AI Models</h3></summary>
                <div className="settings-group">
                    <label>Script Generation<select value={scriptGenerationModel} onChange={e => setScriptGenerationModel(e.target.value)}><option value="gemini-2.5-flash">gemini-2.5-flash</option></select></label>
                    <label>A-Roll Image Gen<select value={aRollImageModel} onChange={e => setARollImageModel(e.target.value)}><option value="gemini-2.5-flash-image">gemini-2.5-flash-image</option></select></label>
                </div>
                <div className="settings-group">
                    <label>B-Roll Image Gen<select value={bRollImageModel} onChange={e => setBRollImageModel(e.target.value)}><option value="imagen-4.0-generate-001">imagen-4.0-generate-001</option></select></label>
                    <label>Video Generation<select value={videoGenerationModel} onChange={e => setVideoGenerationModel(e.target.value)}><option value="veo-2.0-generate-001">veo-2.0-generate-001</option></select></label>
                </div>
            </details>
            <details className="studio-section" open>
                <summary><h3><span className="icon">edit_note</span>System Prompts</h3></summary>
                <div className="prompt-editor-wrapper">
                    <label>Script Generation Prompt</label>
                    <textarea value={scriptGenerationPrompt} onChange={e => setScriptGenerationPrompt(e.target.value)} rows={8} />
                    <button onClick={resetScriptGenerationPrompt} className="reset-prompt-btn">Reset</button>
                </div>
                 <div className="prompt-editor-wrapper">
                    <label>A-Roll Image Generation Prompt</label>
                    <textarea value={aRollImageGenerationPrompt} onChange={e => setARollImageGenerationPrompt(e.target.value)} rows={4} />
                    <button onClick={resetARollImageGenerationPrompt} className="reset-prompt-btn">Reset</button>
                </div>
                 <div className="prompt-editor-wrapper">
                    <label>B-Roll Image Generation Prompt</label>
                    <textarea value={bRollImageGenerationPrompt} onChange={e => setBRollImageGenerationPrompt(e.target.value)} rows={4} />
                    <button onClick={resetBRollImageGenerationPrompt} className="reset-prompt-btn">Reset</button>
                </div>
                 <div className="prompt-editor-wrapper">
                    <label>Video Generation Prompt</label>
                    <textarea value={videoGenerationPrompt} onChange={e => setVideoGenerationPrompt(e.target.value)} rows={4} />
                    <button onClick={resetVideoGenerationPrompt} className="reset-prompt-btn">Reset</button>
                </div>
            </details>
        </div>
    );
};


export default function VideoStudio() {
    const { 
        workflowStage, setWorkflowStage,
        shootingScript, setShootingScript, replaceShootingScript,
        reset
    } = useVideoStudioStore();
    const [activeTab, setActiveTab] = useState<'timeline' | 'briefing'>('timeline');

    const { turns: liveTurns } = useLogStore();
    const { loadedSession } = usePostProductionStore();
    const { getHostByName } = useHostStore();
    const { host1Selection, host2Selection } = useHostStore();
    const { sets } = useVirtualSetStore();
    const { selectedSetId } = useLaunchpadStore();
    const { generateShootingScript } = useFilmDirectorAI();

    const handleGenerateScript = async () => {
        const host1 = getHostByName(host1Selection);
        const host2 = getHostByName(host2Selection);
        const virtualSet = sets.find(s => s.id === selectedSetId);
        const turnsToUse = loadedSession ? loadedSession.mainTranscript : liveTurns;
        const transcript = turnsToUse
            .filter(t => t.author === host1Selection || t.author === host2Selection)
            .map(t => `${t.author}: ${t.text}`)
            .join('\n');

        if (!transcript || !host1 || !host2 || !virtualSet) {
            alert('A full transcript, two hosts, and a virtual set are required to generate a shooting script. Please configure them in Pre-Production.');
            return;
        }
        setWorkflowStage('scripting');

        const scriptGenerator = generateShootingScript({
            transcript,
            hostNames: [host1.name, host2.name],
            virtualSetDescription: virtualSet.generationPrompt,
        });

        let firstSceneReceived = false;
        
        for await (const scene of scriptGenerator) {
            if (!firstSceneReceived) {
                // On the very first scene, clear the placeholders
                replaceShootingScript([]);
                firstSceneReceived = true;
            }
            
            const newScene = { ...scene, finalVideoPrompt: scene.actionPrompt || scene.bRollPrompt };
            setShootingScript([newScene]); // appends because the store is configured to do so
        }
        
        setWorkflowStage('editing');
    };

    return (
      <div className="video-studio-content">
        <div className="producer-hub-tabs">
            <button
                className={cn('producer-hub-tab-button', { active: activeTab === 'timeline' })}
                onClick={() => setActiveTab('timeline')}
            >
                <span className="icon">timeline</span>
                Timeline
            </button>
            <button
                className={cn('producer-hub-tab-button', { active: activeTab === 'briefing' })}
                onClick={() => setActiveTab('briefing')}
            >
                <span className="icon">assignment</span>
                Director's Briefing
            </button>
        </div>

        {activeTab === 'timeline' && (
            <div className="timeline-container">
                <div className="timeline-header">
                    <button onClick={handleGenerateScript} className="generate-script-btn" disabled={workflowStage === 'scripting'}>
                        <span className={cn("icon", {'sync': workflowStage === 'scripting'})}>{workflowStage === 'scripting' ? 'sync' : 'movie_filter'}</span>
                        {workflowStage === 'scripting' ? 'Generating Script...' : 'Generate Shooting Script'}
                    </button>
                    <button onClick={reset} className="reset-timeline-btn" title="Reset Timeline"><span className="icon">refresh</span></button>
                </div>
                 <div className="scene-card-list">
                    {shootingScript.map((scene, index) => (
                        <SceneCard key={index} scene={scene} index={index} />
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'briefing' && (
           <DirectorBriefing />
        )}
      </div>
    );
}