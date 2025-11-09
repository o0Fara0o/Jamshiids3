/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import JSZip from 'jszip';
import Modal from '../Modal';
import { getAllSessions, deleteSession, getSession, SessionData, saveOrUpdateHost, getAllHosts, saveOrUpdateVirtualSet, getAllVirtualSets } from '@/lib/db';
import {
  ConversationTurn,
  useSettings,
  useProducerStudioStore,
  useHostCreationAgentStore,
  useDescriptionAgentStore,
  useFilmDirectorAgentStore,
  useAgentStore,
  useTools,
  useHostStore,
  useVirtualSetStore,
  useLaunchpadStore,
  useLogStore,
  useFanStore,
  useJudgeStore,
  useMediaStore,
  useAudioStore,
  HostPersonality,
  VirtualSet,
  StoredImage
} from '@/lib/state';
import { triggerDownload } from '@/lib/utils';
import cn from 'classnames';


const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

type SessionsModalProps = {
  onClose: () => void;
  onSessionSelect?: (session: SessionData) => void;
};

export default function SessionsModal({ onClose, onSessionSelect }: SessionsModalProps) {
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [exportingId, setExportingId] = useState<number | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const savedSessions = await getAllSessions();
            setSessions(savedSessions);
        } catch (error) {
            console.error("Failed to fetch sessions:", error);
            alert("Could not load projects from the database.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this project? This cannot be undone.')) {
            try {
                await deleteSession(id);
                setSessions(prevSessions => prevSessions.filter(session => session.id !== id));
            } catch (error) {
                console.error("Failed to delete session:", error);
                alert("Could not delete the project from the database.");
            }
        }
    };

    const handleExport = async (id: number) => {
        setExportingId(id);
        const session = await getSession(id);
        if (!session) {
            alert('Error: Project not found.');
            setExportingId(null);
            return;
        }

        const zip = new JSZip();
        const manifest = {
            version: "1.0",
            projectName: `${session.podcastName} - ${session.episodeTitle}`,
            exportedAt: new Date().toISOString(),
            files: [] as { role: string, path: string, [key: string]: any }[]
        };

        // Transcripts as JSON
        zip.file('main_transcript.json', JSON.stringify(session.mainTranscript, null, 2));
        manifest.files.push({ role: "main_transcript", path: "main_transcript.json" });
        zip.file('fan_chat.json', JSON.stringify(session.fanTranscript, null, 2));
        manifest.files.push({ role: "fan_transcript", path: "fan_chat.json" });
        zip.file('judge_chat.json', JSON.stringify(session.judgeTranscript, null, 2));
        manifest.files.push({ role: "judge_transcript", path: "judge_chat.json" });
        
        // Audio
        if (session.audioBlob) {
            zip.file('podcast_audio.wav', session.audioBlob);
            manifest.files.push({ role: "podcast_audio", path: "podcast_audio.wav" });
        }
        if (session.micAudioBlob) {
            zip.file('mic_input_audio.wav', session.micAudioBlob);
            manifest.files.push({ role: "mic_audio", path: "mic_input_audio.wav" });
        }

        // Config
        if (session.sessionConfig) {
            zip.file('session_config.json', JSON.stringify(session.sessionConfig, null, 2));
            manifest.files.push({ role: "config", path: "session_config.json" });
        }

        // Images
        if (session.images && session.images.length > 0) {
            const imgFolder = zip.folder('images');
            if (imgFolder) {
                for (const [index, img] of session.images.entries()) {
                    const imgBlob = dataURLtoBlob(img.url);
                    if (imgBlob) {
                        const filename = `image_${index + 1}.png`;
                        const path = `images/${filename}`;
                        imgFolder.file(filename, imgBlob);
                        // FIX: Added the 'category' property to the manifest to ensure all image data is saved.
                        manifest.files.push({ role: "image", path, prompt: img.prompt, model: img.model, category: img.category });
                    }
                }
            }
        }
        
        // Add manifest
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        const content = await zip.generateAsync({ type: 'blob' });
        
        const safeTitle = session.episodeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const zipFilename = `project_${session.podcastName}_${safeTitle}.zip`;

        triggerDownload(content, zipFilename);
        setExportingId(null);
    };

    const handleSelect = async (id: number) => {
        if (!onSessionSelect) return;
        const session = await getSession(id);
        if (session) {
            onSessionSelect(session);
        } else {
            alert('Error: Project not found.');
        }
    };

    const applyConfiguration = async (config: any) => {
        try {
            // Simple stores
            if(config.producerStudio) useProducerStudioStore.setState(config.producerStudio);
            if(config.hostCreationAgent) useHostCreationAgentStore.setState(config.hostCreationAgent);
            if(config.descriptionAgent) useDescriptionAgentStore.setState(config.descriptionAgent);
            if(config.filmDirectorAgent) useFilmDirectorAgentStore.setState(config.filmDirectorAgent);
            if(config.agentStore) useAgentStore.setState(config.agentStore);
            if(config.settings) useSettings.setState(config.settings);
            if(config.tools) useTools.setState(config.tools);
            if(config.launchpad) useLaunchpadStore.setState(config.launchpad);
    
            // Stores with DB persistence
            if (config.hostStore && config.hostStore.hosts) {
                const importedHosts = config.hostStore.hosts as HostPersonality[];
                for (const host of importedHosts) {
                    await saveOrUpdateHost(host);
                }
                const allHosts = await getAllHosts();
                useHostStore.getState().setHosts(allHosts);
                useHostStore.getState().setHost1Selection(config.hostStore.host1Selection);
                useHostStore.getState().setHost2Selection(config.hostStore.host2Selection);
            }
    
            if (config.virtualSetStore && config.virtualSetStore.sets) {
                const importedSets = config.virtualSetStore.sets as VirtualSet[];
                for (const set of importedSets) {
                    await saveOrUpdateVirtualSet(set);
                }
                const allSets = await getAllVirtualSets();
                useVirtualSetStore.getState().setSets(allSets);
            }
            
            return true; // Indicate success
    
        } catch (e) {
            console.error("Failed to apply configuration:", e);
            alert("An error occurred while applying the configuration. The file might be corrupted or in an old format.");
            return false; // Indicate failure
        }
    }

    const handleRestore = async (id: number) => {
        if (!window.confirm("This will overwrite your current studio configuration AND load the selected project's chat history into the main view. Continue?")) {
            return;
        }
        const session = await getSession(id);
        if (!session) {
            alert('Project data could not be found.');
            return;
        }

        // Restore Content Stores
        useLogStore.getState().restoreSession(session.mainTranscript, session.id);
        useFanStore.getState().restoreSession(session.fanTranscript);
        useJudgeStore.getState().restoreSession(session.judgeTranscript);
        useMediaStore.getState().restoreSession(session.images);
        useAudioStore.getState().setRecoveredBlobs(session.audioBlob, session.micAudioBlob);

        // Restore Configuration Stores (if available)
        if (session.sessionConfig) {
            await applyConfiguration(session.sessionConfig);
        }
        
        onClose();
    };

    const handleExportConfig = async (id: number) => {
        const session = await getSession(id);
        if (!session || !session.sessionConfig) {
            alert('Error: Configuration data not found for this project.');
            return;
        }

        const configBlob = new Blob([JSON.stringify(session.sessionConfig, null, 2)], { type: 'application/json' });
        
        const safeTitle = session.episodeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const jsonFilename = `config_${session.podcastName}_${safeTitle}.json`;

        triggerDownload(configBlob, jsonFilename);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);

        try {
            const zip = await JSZip.loadAsync(file);
            const manifestFile = zip.file('manifest.json');
            if (!manifestFile) {
                throw new Error('Invalid project file: manifest.json not found.');
            }

            const manifest = JSON.parse(await manifestFile.async('string'));
            
            if (!window.confirm(`This will overwrite your current session and studio configuration with the project '${manifest.projectName}'. Continue?`)) {
                setIsImporting(false);
                if (event.target) event.target.value = '';
                return;
            }

            // 1. Restore Config
            const configFile = manifest.files.find((f: any) => f.role === 'config');
            if (configFile) {
                const configContent = await zip.file(configFile.path)?.async('string');
                if (configContent) {
                   const success = await applyConfiguration(JSON.parse(configContent));
                   if (!success) throw new Error("Failed to apply configuration.");
                }
            }

            // Helper to parse transcript JSON
            const getTranscript = async (role: string) => {
                const fileInfo = manifest.files.find((f: any) => f.role === role);
                return fileInfo ? JSON.parse(await zip.file(fileInfo.path)?.async('string') || '[]') : [];
            };

            const mainTranscript = await getTranscript('main_transcript');
            const fanTranscript = await getTranscript('fan_transcript');
            const judgeTranscript = await getTranscript('judge_transcript');

            // 3. Restore Audio
            const getBlob = async (role: string) => {
                const fileInfo = manifest.files.find((f: any) => f.role === role);
                return fileInfo ? await zip.file(fileInfo.path)?.async('blob') : undefined;
            };

            const audioBlob = await getBlob('podcast_audio');
            const micAudioBlob = await getBlob('mic_audio');
            
            // 4. Restore Images
            const imageFiles = manifest.files.filter((f: any) => f.role === 'image');
            const images: StoredImage[] = [];
            for (const imageFile of imageFiles) {
                const imageBlob = await zip.file(imageFile.path)?.async('blob');
                if (imageBlob) {
                    const dataUrl = await new Promise<string>(resolve => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(imageBlob);
                    });
                    // FIX: Added 'category' property to the StoredImage object to match the type definition.
                    images.push({ url: dataUrl, prompt: imageFile.prompt, model: imageFile.model, category: imageFile.category || 'b-roll' });
                }
            }
            
            const newSessionId = Date.now();
            useLogStore.getState().restoreSession(mainTranscript, newSessionId);
            useFanStore.getState().restoreSession(fanTranscript);
            useJudgeStore.getState().restoreSession(judgeTranscript);
            useMediaStore.getState().restoreSession(images);
            useAudioStore.getState().setRecoveredBlobs(audioBlob, micAudioBlob);

            alert('Project imported successfully!');
            onClose();

        } catch (error) {
            console.error("Failed to import project:", error);
            alert(`Could not import project. The file might be invalid or corrupted. Error: ${(error as Error).message}`);
        } finally {
            setIsImporting(false);
            if (event.target) {
                event.target.value = '';
            }
        }
    };

    return (
        <Modal onClose={onClose}>
            <div className="sessions-modal-content">
                <h2>{onSessionSelect ? 'Select Project' : 'Project Manager'}</h2>
                <p className="panel-section-description">Manage your saved projects. You can restore a project's state into the app, or export a complete project archive as a .zip file.</p>
                <div className="sessions-list">
                    {loading && <p>Loading projects...</p>}
                    {!loading && sessions.length === 0 && <p>No saved projects found.</p>}
                    {!loading && sessions.map(session => (
                        <div key={session.id} className="session-item">
                            <div className="session-info">
                                <span className="session-title">
                                    {session.podcastName}: {session.episodeTitle}
                                </span>
                                <span className="session-details">
                                    {new Date(session.id).toLocaleString()}
                                    {' | '}
                                    {session.mainTranscript.length} turns
                                    {' | '}
                                    {session.images.length} images
                                </span>
                            </div>
                            <div className="session-actions">
                                {onSessionSelect ? (
                                    <button className="select-btn" onClick={() => handleSelect(session.id)}>
                                        <span className="icon">input</span>
                                        Select
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            className="restore-btn"
                                            onClick={() => handleRestore(session.id)}
                                            disabled={!!exportingId}
                                            title="Restore this project's content and configuration into the app"
                                        >
                                            <span className="icon">settings_backup_restore</span>
                                        </button>
                                        <button
                                            className="export-config-btn"
                                            onClick={() => handleExportConfig(session.id)}
                                            disabled={!session.sessionConfig || !!exportingId}
                                            title="Export Configuration File (.json)"
                                        >
                                            <span className="icon">share</span>
                                        </button>
                                        <button
                                            className="download-btn"
                                            onClick={() => handleExport(session.id)}
                                            disabled={exportingId === session.id}
                                            title="Export the complete project as a .zip archive"
                                        >
                                            <span className={cn('icon', { 'sync': exportingId === session.id })}>{exportingId === session.id ? 'sync' : 'archive'}</span>
                                        </button>
                                        <button
                                            className="delete-btn"
                                            onClick={() => handleDelete(session.id)}
                                            disabled={!!exportingId}
                                            title="Delete Project"
                                        >
                                            <span className="icon">delete</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
             <div className="modal-actions">
                <input type="file" accept=".zip" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} />
                <button onClick={handleImportClick} className="import-config-btn" disabled={isImporting}>
                    <span className={cn('icon', {'sync': isImporting})}>{isImporting ? 'sync' : 'upload_file'}</span>
                    {isImporting ? 'Importing...' : 'Import Project (.zip)'}
                </button>
                <button onClick={onClose} className="cancel-button">Close</button>
            </div>
        </Modal>
    );
}