/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import cn from 'classnames';
import { useThumbnailAgent } from '@/contexts/ThumbnailAgentContext';
// FIX: Import `useUI` from `@/lib/state` to resolve the 'Cannot find name' error.
import { 
    useLogStore, 
    useHostStore, 
    useMediaStore, 
    usePodcastStore, 
    useVisualDirectorStore, 
    StoredImage,
    useLaunchpadStore,
    useUI
} from '@/lib/state';
import { useAPIKey } from '@/contexts/APIKeyContext';
import { triggerDownload } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';


type CreationCardType = 'Thumbnail' | 'CTA' | 'Live B-Roll';

interface CreationCardProps {
    type: CreationCardType;
}

const CreationCard: React.FC<CreationCardProps> = ({ type }) => {
    // Universal State
    const { addTurn } = useLogStore();
    const { addImage, images } = useMediaStore();
    const { podcastName, episodeTitle } = usePodcastStore();
    const { openImageModal, setGeneratedImage, setIsGeneratingImage } = useUI();
    const apiKey = useAPIKey();

    // Agent Hooks
    const { generateImage: generateWithImagen, editImage } = useThumbnailAgent();
    
    // B-Roll State
    const [isAgentActive, setIsAgentActive] = useState(false);
    const [bRollImageUrl, setBRollImageUrl] = useState('');
    const intervalRef = useRef<number | null>(null);
    const [isManuallyGenerating, setIsManuallyGenerating] = useState(false);

    // Form State (for Thumbnail & CTA)
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [headline, setHeadline] = useState('Subscribe Now!');
    const [actionText, setActionText] = useState('Click for More');
    const [finalPrompt, setFinalPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastSuccessfulPrompt, setLastSuccessfulPrompt] = useState('');

    const categoryMap: Record<CreationCardType, string> = {
        'Thumbnail': 'thumbnail',
        'CTA': 'cta',
        'Live B-Roll': 'b-roll',
    };
    const category = categoryMap[type];
    const filteredImages = images.filter(img => img.category === category);


    const handlePreviewPrompt = async () => {
        setIsGenerating(true);
        setFinalPrompt('');
        const { turns } = useLogStore.getState();
        const transcript = turns.slice(-15).map(t => `${t.author}: ${t.text}`).join('\n');

        let systemPrompt = '';
        if (type === 'Thumbnail') {
            const { thumbnailSystemPrompt } = useVisualDirectorStore.getState();
            systemPrompt = thumbnailSystemPrompt
                .replace(/\$\{aspectRatio\}/g, aspectRatio)
                .replace(/\$\{episodeTitle\}/g, episodeTitle)
                .replace(/\$\{podcastName\}/g, podcastName);
        } else if (type === 'CTA') {
            const { ctaSystemPrompt } = useVisualDirectorStore.getState();
            systemPrompt = ctaSystemPrompt
                .replace(/\$\{dimensions\}/g, `${aspectRatio} aspect ratio`)
                .replace(/\$\{headline\}/g, headline)
                .replace(/\$\{actionText\}/g, actionText);
        }

        if (!transcript.trim() || !systemPrompt) {
            alert('Could not generate prompt. Missing transcript or system prompt.');
            setIsGenerating(false);
            return;
        }
        
        // This is the inconsistent call we are fixing in a later step
        const ai = new GoogleGenAI({ apiKey });
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: transcript,
                config: {
                    systemInstruction: systemPrompt
                }
            });
            setFinalPrompt(response.text.trim());
        } catch (e) {
            console.error(e);
            alert(`Failed to generate prompt: ${e}`);
        }
        
        setIsGenerating(false);
    };

    const generateAndStoreImage = async (prompt: string, aspectRatio: '1:1' | '16:9' | '9:16') => {
        openImageModal();
        setIsGeneratingImage(true);
        setGeneratedImage(null);

        const result = await generateWithImagen({ prompt, aspectRatio });

        if (result) {
            setGeneratedImage(result.imageUrl);
            addTurn({
                role: 'system',
                author: 'Visual Director',
                text: '',
                isFinal: true,
                generatedImage: result.imageUrl,
                imagePrompt: prompt,
            });
            addImage({
                url: result.imageUrl,
                prompt: `${type}: ${prompt}`,
                model: 'imagen-4.0-generate-001',
                category,
            });
        }
        
        setIsGeneratingImage(false);
    };

    const handleGenerate = async () => {
        if (!finalPrompt.trim()) {
            alert('Please generate or write a prompt first.');
            return;
        }
        setLastSuccessfulPrompt(finalPrompt);
        await generateAndStoreImage(finalPrompt, aspectRatio as any);
    };

    const handleRegenerate = async () => {
        if (!lastSuccessfulPrompt) return;
        await generateAndStoreImage(lastSuccessfulPrompt, aspectRatio as any);
    };


    // B-Roll Agent Logic
    const { generateBrollImage } = useThumbnailAgent();
    
    const runBrollGeneration = async () => {
        const result = await generateBrollImage();
        if (result) {
            setBRollImageUrl(result.imageUrl);
            addTurn({
                role: 'system',
                author: 'Visual Director',
                text: '',
                isFinal: true,
                generatedImage: result.imageUrl,
                imagePrompt: "Live B-Roll based on recent conversation",
            });
             addImage({
                url: result.imageUrl,
                prompt: "Live B-Roll based on recent conversation",
                model: 'gemini-2.5-flash-image',
                category: 'b-roll',
            });
        }
    };
    
    const handleManualBrollGenerate = async () => {
        setIsManuallyGenerating(true);
        await runBrollGeneration();
        setIsManuallyGenerating(false);
    };

    const startAgent = () => {
        setIsAgentActive(true);
        runBrollGeneration(); // Run immediately
        intervalRef.current = window.setInterval(runBrollGeneration, 10000);
    };

    const stopAgent = () => {
        setIsAgentActive(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };
    
    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);


    const getTitleAndIcon = () => {
        switch(type) {
            case 'Thumbnail': return { title: 'Thumbnail Generator', icon: 'photo_camera' };
            case 'CTA': return { title: 'CTA Generator', icon: 'campaign' };
            case 'Live B-Roll': return { title: 'Live B-Roll Agent', icon: 'movie' };
            default: return { title: 'Generator', icon: 'auto_awesome' };
        }
    }
    const { title, icon } = getTitleAndIcon();

    return (
        <div className="panel-section creation-card">
            <h3 className="panel-section-title"><span className="icon">{icon}</span>{title}</h3>
            
            {type === 'Live B-Roll' && (
                <>
                    <p className="panel-section-description">
                        Generates a cinematic image every 10 seconds based on the conversation, hosts, and set.
                    </p>
                    <div className="live-b-roll-preview">
                        {bRollImageUrl ? <img src={bRollImageUrl} alt="Live B-Roll" /> : <p>Waiting for agent...</p>}
                    </div>
                    <div className="card-actions">
                        <button onClick={handleManualBrollGenerate} disabled={isAgentActive || isManuallyGenerating} className="secondary-btn">
                            <span className={cn("icon", {'sync': isManuallyGenerating})}>{isManuallyGenerating ? 'sync' : 'refresh'}</span>
                            Regenerate Now
                        </button>
                        <button onClick={isAgentActive ? stopAgent : startAgent} className={cn("primary-btn", {"stop-btn": isAgentActive})}>
                            <span className="icon">{isAgentActive ? 'stop_circle' : 'play_circle'}</span>
                            {isAgentActive ? 'Stop Agent' : 'Start Agent'}
                        </button>
                    </div>
                </>
            )}

            {(type === 'Thumbnail' || type === 'CTA') && (
                 <>
                    {type === 'Thumbnail' && <p className="panel-section-description">Create a thumbnail based on the episode context.</p>}
                    {type === 'CTA' && <p className="panel-section-description">Create a marketing call-to-action image.</p>}

                    <div className="form-field">
                        <label>AI Prompt Preview</label>
                        <p className="panel-section-description">Let the AI generate a detailed prompt based on the conversation.</p>
                        <button onClick={handlePreviewPrompt} disabled={isGenerating} className="secondary-btn">
                             <span className={cn("icon", {'sync': isGenerating})}>{isGenerating ? 'sync' : 'auto_awesome'}</span>
                            {isGenerating ? 'Generating...' : 'Preview Prompt'}
                        </button>
                    </div>

                    <div className="form-field">
                        <label>Final Prompt</label>
                        <textarea rows={4} value={finalPrompt} onChange={e => setFinalPrompt(e.target.value)} placeholder="Generate a prompt or write your own..." />
                    </div>

                    <details className="settings-group collapsible-details">
                         <summary>Settings</summary>
                         <div className="collapsible-content">
                            <div className="settings-group">
                                {type === 'Thumbnail' && <label>Aspect Ratio<select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}><option value="16:9">16:9</option><option value="1:1">1:1</option></select></label>}
                                {type === 'CTA' && (
                                    <>
                                        <label>Aspect Ratio<select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}><option value="1:1">1:1</option><option value="16:9">16:9</option><option value="9:16">9:16</option></select></label>
                                        <label>Headline<input type="text" value={headline} onChange={e => setHeadline(e.target.value)} /></label>
                                        <label>Action Text<input type="text" value={actionText} onChange={e => setActionText(e.target.value)} /></label>
                                    </>
                                )}
                            </div>
                         </div>
                    </details>
                    
                    <div className="card-actions">
                         <button onClick={handleRegenerate} disabled={!lastSuccessfulPrompt.trim()} className="secondary-btn">
                            <span className="icon">refresh</span>
                            Regenerate
                        </button>
                        <button onClick={handleGenerate} disabled={!finalPrompt.trim()} className="primary-btn">
                            <span className="icon">burst_mode</span>
                            Generate
                        </button>
                    </div>
                 </>
            )}
            
            <div className="section-divider"></div>

            <div className="image-stream">
                {filteredImages.length > 0 ? (
                    filteredImages.slice().reverse().map((img, i) => <img key={i} src={img.url} alt={img.prompt} onClick={() => { setGeneratedImage(img.url); openImageModal(); }}/>)
                ) : (
                    <div className="image-stream-placeholder">
                        <span className="icon">image</span>
                        <p>Generated images will appear here</p>
                    </div>
                )}
            </div>
        </div>
    );
}


export default function VisualControls() {
  const [activeTab, setActiveTab] = useState<'generators' | 'studio'>('generators');
  const { 
      thumbnailSystemPrompt, setThumbnailSystemPrompt, resetThumbnailSystemPrompt,
      ctaSystemPrompt, setCtaSystemPrompt, resetCtaSystemPrompt,
      liveBrollSystemPrompt, setLiveBrollSystemPrompt, resetLiveBrollSystemPrompt,
   } = useVisualDirectorStore();

  return (
    <div className="panel-content-wrapper">
        <div className="visual-controls-tabs">
            <button
                className={cn('visual-controls-tab-button', { active: activeTab === 'generators' })}
                onClick={() => setActiveTab('generators')}
            >
                <span className="icon">auto_awesome</span>
                Generators
            </button>
            <button
                className={cn('visual-controls-tab-button', { active: activeTab === 'studio' })}
                onClick={() => setActiveTab('studio')}
            >
                <span className="icon">edit_note</span>
                Visual Studio
            </button>
        </div>
        
        {activeTab === 'generators' && (
            <div className="visual-panel-content">
                <CreationCard type="Live B-Roll" />
                <CreationCard type="Thumbnail" />
                <CreationCard type="CTA" />
            </div>
        )}

        {activeTab === 'studio' && (
            <div className="producer-hub-content">
                <div className="studio-content">
                    <details className="studio-section" open>
                        <summary><h3><span className="icon">edit_document</span>System Prompts</h3></summary>
                         <div className="prompt-editor-wrapper">
                            <label>Live B-Roll Agent Prompt</label>
                            <textarea rows={6} value={liveBrollSystemPrompt} onChange={e => setLiveBrollSystemPrompt(e.target.value)} />
                            <button onClick={resetLiveBrollSystemPrompt} className="reset-prompt-btn">Reset to Default</button>
                        </div>
                        <div className="prompt-editor-wrapper">
                            <label>Thumbnail Generator Prompt</label>
                            <textarea rows={6} value={thumbnailSystemPrompt} onChange={e => setThumbnailSystemPrompt(e.target.value)} />
                            <button onClick={resetThumbnailSystemPrompt} className="reset-prompt-btn">Reset to Default</button>
                        </div>
                         <div className="prompt-editor-wrapper">
                            <label>CTA Generator Prompt</label>
                            <textarea rows={6} value={ctaSystemPrompt} onChange={e => setCtaSystemPrompt(e.target.value)} />
                            <button onClick={resetCtaSystemPrompt} className="reset-prompt-btn">Reset to Default</button>
                        </div>
                    </details>
                </div>
            </div>
        )}
    </div>
  );
}