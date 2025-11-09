/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { HostPersonality } from '@/lib/state';
import { fileToDataUrl } from '@/lib/utils';
import cn from 'classnames';

interface EditHostModalProps {
    host: HostPersonality;
    onClose: () => void;
    onSave: (originalName: string, updatedHost: HostPersonality) => void;
}

const EditHostModal: React.FC<EditHostModalProps> = ({ host, onClose, onSave }) => {
    const [name, setName] = useState(host.name);
    const [prompt, setPrompt] = useState(host.prompt);
    const [imageUrls, setImageUrls] = useState<string[]>(host.imageUrls || []);
    const [primaryImageUrl, setPrimaryImageUrl] = useState(host.primaryImageUrl || (host.imageUrls && host.imageUrls[0]) || '');

    useEffect(() => {
        setName(host.name);
        setPrompt(host.prompt);
        setImageUrls(host.imageUrls || []);
        setPrimaryImageUrl(host.primaryImageUrl || (host.imageUrls && host.imageUrls[0]) || '');
    }, [host]);

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const dataUrl = await fileToDataUrl(file);
            // Prepend the new image and set it as primary by default
            setImageUrls(prev => [dataUrl, ...prev]);
            setPrimaryImageUrl(dataUrl);
        }
    };
    
    const handleDeleteImage = (urlToDelete: string) => {
        const newImageUrls = imageUrls.filter(url => url !== urlToDelete);
        setImageUrls(newImageUrls);
        if (primaryImageUrl === urlToDelete) {
            setPrimaryImageUrl(newImageUrls[0] || '');
        }
    };

    const handleSave = () => {
        onSave(host.name, {
            name: name.trim(),
            prompt: prompt.trim(),
            imageUrls,
            primaryImageUrl,
        });
    };

    return (
        <Modal onClose={onClose}>
            <div className="edit-host-modal">
                <h2>Edit Host: {host.name}</h2>
                <div className="edit-host-form">
                    <div className="form-left-panel">
                        <div className="form-field">
                            <label htmlFor="host-name">Host Name</label>
                            <input
                                id="host-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="form-field">
                            <label htmlFor="host-prompt">Personality Prompt</label>
                            <textarea
                                id="host-prompt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={10}
                            />
                        </div>
                    </div>
                    <div className="form-right-panel">
                        <div className="form-field">
                            <label>Host Image Gallery</label>
                            <div className="host-image-gallery">
                                 <label htmlFor="host-image-upload" className="add-image-card">
                                    <span className="icon">add_a_photo</span>
                                    <span>Add Image</span>
                                </label>
                                <input
                                    id="host-image-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                                {imageUrls.map((url, index) => (
                                    <div key={index} className={cn("gallery-image-container", {primary: url === primaryImageUrl})}>
                                        <img src={url} alt={`Host image ${index + 1}`} />
                                        {url === primaryImageUrl && <div className="primary-badge">Primary</div>}
                                        <div className="gallery-image-actions">
                                            <button title="Set as Primary" onClick={() => setPrimaryImageUrl(url)} disabled={url === primaryImageUrl}>
                                                <span className="icon">star</span>
                                            </button>
                                            <button title="Delete Image" onClick={() => handleDeleteImage(url)}>
                                                <span className="icon">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button onClick={onClose} className="cancel-button">Cancel</button>
                    <button onClick={handleSave} className="save-button" disabled={!name.trim() || !prompt.trim() || !primaryImageUrl}>Save Changes</button>
                </div>
            </div>
        </Modal>
    );
};

export default EditHostModal;