/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import Modal from '../Modal';
import { VirtualSet } from '@/lib/state';
import { urlToInlineData, fileToDataUrl } from '@/lib/utils';

interface EditVirtualSetModalProps {
    set: VirtualSet;
    onClose: () => void;
    onSubmit: (data: {
        id: string;
        name: string;
        prompt: string;
        editImage?: { dataUrl: string; } | null;
    }) => void;
    onDelete: (id: string) => void;
}

const EditVirtualSetModal: React.FC<EditVirtualSetModalProps> = ({ set, onClose, onSubmit, onDelete }) => {
    const [currentName, setCurrentName] = useState(set.name);
    const [currentPrompt, setCurrentPrompt] = useState(set.generationPrompt);
    const [uploadedEditImage, setUploadedEditImage] = useState<{
        dataUrl: string;
        data: string;
        mimeType: string;
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setCurrentName(set.name);
        setCurrentPrompt(set.generationPrompt);
        setUploadedEditImage(null); // Reset on new set
    }, [set]);

    const handleSubmit = () => {
        if (!currentPrompt.trim()) {
            alert('Please enter an edit prompt.');
            return;
        }
        onSubmit({
            id: set.id,
            name: currentName.trim(),
            prompt: currentPrompt,
            editImage: uploadedEditImage ? { dataUrl: uploadedEditImage.dataUrl } : null,
        });
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleSubmit();
        }
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const dataUrl = await fileToDataUrl(file);
            const { data, mimeType } = await urlToInlineData(dataUrl);
            setUploadedEditImage({ dataUrl, data, mimeType });
        }
    };

    const handleDelete = () => {
        onDelete(set.id);
    }

    return (
        <Modal onClose={onClose}>
            <div className="edit-set-modal">
                <h2>Edit Virtual Set</h2>
                <div className="edit-set-content">
                    <div className="set-preview">
                        <img src={set.imageUrl} alt={currentName} />
                    </div>
                    <div className="set-form">
                        <div className="editor-control-group">
                            <label>Set Name</label>
                            <input type="text" value={currentName} onChange={e => setCurrentName(e.target.value)} />
                        </div>
                        
                        {uploadedEditImage && (
                            <div className="editor-control-group">
                                <label>Image for Editing</label>
                                <div className="edit-image-preview-container">
                                    <img src={uploadedEditImage.dataUrl} alt="Uploaded for edit" className="edit-image-preview" />
                                    <button className="remove-image-button" onClick={() => setUploadedEditImage(null)} title="Remove edit image">
                                        <span className="icon">close</span>
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <div className="editor-control-group">
                            <label>Set's Main Prompt (Used for Edits)</label>
                            <div className="prompt-input-bar">
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} id="edit-image-upload" />
                                <button onClick={() => fileInputRef.current?.click()} title="Upload Image for Edit" className="upload-btn">
                                    <span className="icon">add_photo_alternate</span>
                                </button>
                                <textarea
                                    value={currentPrompt}
                                    onChange={e => setCurrentPrompt(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={4}
                                    placeholder="Describe the set, or give instructions to edit it..."
                                />
                                <button onClick={handleSubmit} title="Send Edit (Ctrl+Enter)" className="send-btn">
                                    <span className="icon">send</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button onClick={handleDelete} className="delete-btn">Delete Set</button>
                </div>
            </div>
        </Modal>
    );
};

export default EditVirtualSetModal;