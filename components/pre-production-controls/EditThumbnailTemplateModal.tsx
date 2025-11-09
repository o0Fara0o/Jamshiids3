/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { ThumbnailTemplate } from '@/lib/state';
import { useThumbnailAgent } from '@/contexts/ThumbnailAgentContext';
import { fileToDataUrl, urlToInlineData } from '@/lib/utils';
import cn from 'classnames';

interface EditThumbnailTemplateModalProps {
    template: ThumbnailTemplate | null;
    onClose: () => void;
    onSave: (template: Omit<ThumbnailTemplate, 'id'>, id?: string) => void;
}

type EditStep = 'base' | 'refine';

const EditThumbnailTemplateModal: React.FC<EditThumbnailTemplateModalProps> = ({ template, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [stylePrompt, setStylePrompt] = useState('');
    const [baseImageUrl, setBaseImageUrl] = useState('');
    
    const [editStep, setEditStep] = useState<EditStep>('base');
    const [basePrompt, setBasePrompt] = useState('');
    const [editPrompt, setEditPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const { generateImage, editImage } = useThumbnailAgent();

    useEffect(() => {
        if (template) {
            setName(template.name);
            setStylePrompt(template.stylePrompt);
            setBaseImageUrl(template.baseImageUrl);
            setEditStep('refine'); // Start on refine step if image exists
        }
    }, [template]);

    const handleGenerateBaseImage = async () => {
        if (!basePrompt.trim()) { alert("Please enter a prompt for the base image."); return; }
        setIsGenerating(true);
        const result = await generateImage({ prompt: basePrompt, aspectRatio: '16:9' });
        if (result) {
            setBaseImageUrl(result.imageUrl);
            setEditStep('refine');
        }
        setIsGenerating(false);
    };

    const handleApplyEdit = async () => {
        if (!editPrompt.trim() || !baseImageUrl) { alert("Please enter an edit prompt."); return; }
        setIsGenerating(true);
        try {
            const inlineData = await urlToInlineData(baseImageUrl);
            const result = await editImage({ baseImage: inlineData, prompt: editPrompt });
            if (result) {
                setBaseImageUrl(result.imageUrl);
            }
        } catch (error) {
            console.error('Error applying edit to thumbnail:', error);
            alert('Failed to apply image edit. Please check the console for details.');
        }
        setIsGenerating(false);
        setEditPrompt('');
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const dataUrl = await fileToDataUrl(file);
            setBaseImageUrl(dataUrl);
            setEditStep('refine');
        }
    };

    const handleSave = () => {
        if (!name.trim() || !stylePrompt.trim() || !baseImageUrl) {
            alert('Please provide a name, style prompt, and a base image.');
            return;
        }
        onSave({ name, stylePrompt, baseImageUrl }, template?.id);
    };
    
    return (
        <Modal onClose={onClose}>
            <div className="thumbnail-editor-modal">
                <h2>{template ? 'Edit' : 'Create'} Thumbnail Template</h2>
                <div className="thumbnail-editor-content">
                    <div className="editor-preview-area">
                        {isGenerating && <div className="spinner-overlay"><div className="spinner"></div></div>}
                        {baseImageUrl ? <img src={baseImageUrl} alt="Thumbnail preview" /> : <div className="image-placeholder"><span className="icon">image</span><p>Image will appear here</p></div>}
                    </div>
                    <div className="editor-controls-area">
                        <div className="form-field">
                            <label>Template Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., 'Bold Headline Style'"/>
                        </div>
                        <div className="form-field">
                            <label>Style Prompt</label>
                             <p className="panel-section-description" style={{marginTop: '0'}}>This prompt guides the final generation in the Launchpad, applying the episode's context to your style.</p>
                            <textarea
                                value={stylePrompt}
                                onChange={e => setStylePrompt(e.target.value)}
                                rows={3}
                                placeholder="e.g., bold, modern, energetic style, high-contrast colors..."
                            />
                        </div>

                        <div className="editor-step-tabs">
                           <button className={cn({active: editStep === 'base'})} onClick={() => setEditStep('base')}>1. Create Base Image</button>
                           <button className={cn({active: editStep === 'refine'})} onClick={() => setEditStep('refine')} disabled={!baseImageUrl}>2. Refine Image</button>
                        </div>
                        
                        {editStep === 'base' && (
                            <div className="editor-step-content">
                                <div className="form-field">
                                    <label>Generate with a prompt:</label>
                                     <p className="panel-section-description" style={{marginTop: '0'}}>Create a new background or scene from scratch.</p>
                                    <textarea value={basePrompt} onChange={e => setBasePrompt(e.target.value)} rows={3} placeholder="e.g., A podcast studio with a neon sign..." />
                                    <button onClick={handleGenerateBaseImage} disabled={isGenerating}>
                                        {isGenerating ? 'Generating...' : 'Generate Base'}
                                    </button>
                                </div>
                                <div className="form-field">
                                    <label>Or upload an image:</label>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} />
                                </div>
                            </div>
                        )}

                        {editStep === 'refine' && (
                             <div className="editor-step-content">
                                <div className="form-field">
                                    <label>Refine with an edit prompt:</label>
                                    <p className="panel-section-description" style={{marginTop: '0'}}>Iteratively change the current image.</p>
                                    <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} rows={3} placeholder="e.g., add a glowing logo on the wall" />
                                    <button onClick={handleApplyEdit} disabled={isGenerating}>
                                        {isGenerating ? 'Applying...' : 'Apply Edit'}
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
                <div className="modal-actions">
                    <button onClick={onClose} className="cancel-button">Cancel</button>
                    <button onClick={handleSave} className="save-button">Save Template</button>
                </div>
            </div>
        </Modal>
    );
};

export default EditThumbnailTemplateModal;