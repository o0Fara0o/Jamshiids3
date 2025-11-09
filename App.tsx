

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect } from 'react';
import ErrorScreen from './components/demo/ErrorScreen';
import StreamingConsole from './components/demo/streaming-console/StreamingConsole';
import GeneratedImageModal from './components/GeneratedImageModal';
import ProducerControls from './components/producer-controls/ProducerControls';
import VisualControls from './components/visual-controls/VisualControls';
import Header from './components/Header';
import JudgeSidebar from './components/judge-sidebar/JudgeSidebar';
import FanSidebar from './components/fan-sidebar/FanSidebar';
import { useUI, useLogStore, useFanStore, useJudgeStore, useMediaStore, useHostStore, useVirtualSetStore, defaultVirtualSets, useAudioStore } from './lib/state';
import { findIncompleteSession, deleteSession, getSession, getAllHosts, saveOrUpdateHost, getAllVirtualSets, saveOrUpdateVirtualSet } from './lib/db';
import RecoveryModal from './components/RecoveryModal';
import { useAutosave } from './hooks/useAutosave';
import PreProductionControls from './components/pre-production-controls/PreProductionControls';
import { HOST_PERSONALITIES } from './lib/hosts';
import AudioStudioPanel from './components/audio-studio/AudioStudioModal';
import cn from 'classnames';
import VideoStudio from './components/video-studio/VideoStudio';
import { AppProviders } from './contexts/AppProviders';
import DraggablePanel from './components/DraggablePanel';

const API_KEY = process.env.API_KEY as string;
if (typeof API_KEY !== 'string') {
  throw new Error('Missing required environment variable: API_KEY');
}

/**
 * A simple component to activate the autosave hook globally.
 */
function AutosaveManager() {
  useAutosave();
  return null;
}

/**
 * Main application component that provides a streaming interface for Live API.
 * Manages video streaming state and provides controls for webcam/screen capture.
 */
function App() {
  const {
    isFanSidebarOpen,
    toggleFanSidebar,
    isJudgeSidebarOpen,
    toggleJudgeSidebar,
    isRecoveryModalOpen,
    incompleteSessionId,
    openRecoveryModal,
    closeRecoveryModal,
    isProducerPanelOpen,
    isVisualPanelOpen,
    isPreProdPanelOpen,
    isAudioStudioPanelOpen,
    isVideoStudioPanelOpen,
    toggleProducerPanel,
    toggleVisualPanel,
    togglePreProdPanel,
    toggleAudioStudioPanel,
    toggleVideoStudioPanel,
  } = useUI();

  useEffect(() => {
    // Check for incomplete session on startup
    findIncompleteSession().then(session => {
      if (session) {
        openRecoveryModal(session.id);
      }
    });
    
    // Initialize asset stores from IndexedDB
    const initializeAssets = async () => {
        // Hosts
        const dbHosts = await getAllHosts();
        if (dbHosts.length > 0) {
            useHostStore.getState().setHosts(dbHosts);
        } else {
            // First run, save the embedded default hosts to the DB.
            for (const host of HOST_PERSONALITIES) {
                await saveOrUpdateHost(host);
            }
        }

        // Virtual Sets
        const dbSets = await getAllVirtualSets();
        if (dbSets.length > 0) {
            useVirtualSetStore.getState().setSets(dbSets);
        } else {
            // First run, save the embedded default sets to the DB.
            for (const set of defaultVirtualSets) {
                await saveOrUpdateVirtualSet(set);
            }
            useVirtualSetStore.getState().setSets(defaultVirtualSets);
        }
    };

    initializeAssets();
  }, [openRecoveryModal]);

  const handleRecover = async () => {
    if (!incompleteSessionId) return;

    const session = await getSession(incompleteSessionId);
    if (session) {
      // Restore state to all stores
      useLogStore.getState().restoreSession(session.mainTranscript, session.id);
      useFanStore.getState().restoreSession(session.fanTranscript);
      useJudgeStore.getState().restoreSession(session.judgeTranscript);
      useMediaStore.getState().restoreSession(session.images);
      useAudioStore.getState().setRecoveredBlobs(session.audioBlob, session.micAudioBlob);
    }
    closeRecoveryModal();
  };

  const handleDiscard = async () => {
    if (incompleteSessionId) {
      await deleteSession(incompleteSessionId);
    }
    closeRecoveryModal();
  };


  return (
    <div className="App">
      {isRecoveryModalOpen && (
         <RecoveryModal
            onRecover={handleRecover}
            onDiscard={handleDiscard}
            onClose={handleDiscard} // Closing is same as discarding
          />
      )}
      {/* FIX: Wrap application components in AppProviders to provide context and fix missing 'children' prop error. */}
      <AppProviders apiKey={API_KEY}>
        <AutosaveManager />
        <ErrorScreen />
        <GeneratedImageModal />
        <div className="app-container">
          <Header />
          <div className="main-content-area">
            <JudgeSidebar isOpen={isJudgeSidebarOpen} />
            <div className="streaming-console">
              <main>
                <div className="main-app-area">
                  <StreamingConsole />
                </div>
              </main>
            </div>
            <FanSidebar isOpen={isFanSidebarOpen} />
          </div>
        </div>
        
        <button
          className={cn('sidebar-toggle left', { active: isJudgeSidebarOpen })}
          onClick={toggleJudgeSidebar}
          aria-label="Toggle Judge Sidebar"
          title="Toggle Judge Sidebar"
        >
          <span className="icon">chevron_right</span>
        </button>
        <button
          className={cn('sidebar-toggle right', { active: isFanSidebarOpen })}
          onClick={toggleFanSidebar}
          aria-label="Toggle Fan Sidebar"
          title="Toggle Fan Sidebar"
        >
          <span className="icon">chevron_left</span>
        </button>

        {/* FIX: Ensure DraggablePanel wraps its content to fix missing 'children' prop error. */}
        <DraggablePanel
          id="pre-prod-panel"
          isOpen={isPreProdPanelOpen}
          onClose={togglePreProdPanel}
          title="Pre-Production Studio"
          iconName="edit_note"
          wheelClass="pre-production-controls-wheel"
        >
          <PreProductionControls />
        </DraggablePanel>
        {/* FIX: Ensure DraggablePanel wraps its content to fix missing 'children' prop error. */}
        <DraggablePanel
          id="producer-panel"
          isOpen={isProducerPanelOpen}
          onClose={toggleProducerPanel}
          title="Producer Hub"
          iconName="settings"
          wheelClass="producer-controls-wheel"
        >
          <ProducerControls />
        </DraggablePanel>
        {/* FIX: Ensure DraggablePanel wraps its content to fix missing 'children' prop error. */}
        <DraggablePanel
          id="visual-panel"
          isOpen={isVisualPanelOpen}
          onClose={toggleVisualPanel}
          title="Visual Controls"
          iconName="palette"
          wheelClass="visual-controls-wheel"
        >
          <VisualControls />
        </DraggablePanel>
        {/* FIX: Ensure DraggablePanel wraps its content to fix missing 'children' prop error. */}
        <DraggablePanel
          id="audio-studio-panel"
          isOpen={isAudioStudioPanelOpen}
          onClose={toggleAudioStudioPanel}
          title="Audio Studio"
          iconName="graphic_eq"
          wheelClass="audio-studio-controls-wheel"
        >
          <AudioStudioPanel />
        </DraggablePanel>
        {/* FIX: Ensure DraggablePanel wraps its content to fix missing 'children' prop error. */}
        <DraggablePanel
          id="video-studio-panel"
          isOpen={isVideoStudioPanelOpen}
          onClose={toggleVideoStudioPanel}
          title="Video Studio"
          iconName="movie"
          wheelClass="video-studio-controls-wheel"
        >
          <VideoStudio />
        </DraggablePanel>
      </AppProviders>
    </div>
  );
}

export default App;