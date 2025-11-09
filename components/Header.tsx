/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { useUI } from '@/lib/state';
import cn from 'classnames';

export default function Header() {
  const {
    isProducerPanelOpen,
    toggleProducerPanel,
    isVisualPanelOpen,
    toggleVisualPanel,
    isPreProdPanelOpen,
    togglePreProdPanel,
    isAudioStudioPanelOpen,
    toggleAudioStudioPanel,
    isVideoStudioPanelOpen,
    toggleVideoStudioPanel,
  } = useUI();

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="app-title">jamshiid</h1>
      </div>
      <div className="header-center">
        <button
          className={cn('header-wheel', 'pre-production-controls-wheel', { active: isPreProdPanelOpen })}
          onClick={togglePreProdPanel}
          aria-label="Toggle Pre-Production Controls"
          title="Pre-Production Studio"
        >
          <span className="icon">edit_note</span>
        </button>
        <button
          className={cn('header-wheel', 'producer-controls-wheel', { active: isProducerPanelOpen })}
          onClick={toggleProducerPanel}
          aria-label="Toggle Producer Controls"
          title="Producer Controls"
        >
          <span className="icon">settings</span>
        </button>
        <button
          className={cn('header-wheel', 'visual-controls-wheel', { active: isVisualPanelOpen })}
          onClick={toggleVisualPanel}
          aria-label="Toggle Visual Controls"
          title="Visual Controls"
        >
          <span className="icon">palette</span>
        </button>
         <button
          className={cn('header-wheel', 'audio-studio-controls-wheel', { active: isAudioStudioPanelOpen })}
          onClick={toggleAudioStudioPanel}
          aria-label="Toggle Audio Studio"
          title="Audio Studio"
        >
          <span className="icon">graphic_eq</span>
        </button>
        <button
          className={cn('header-wheel', 'video-studio-controls-wheel', { active: isVideoStudioPanelOpen })}
          onClick={toggleVideoStudioPanel}
          aria-label="Toggle Video Studio"
          title="Video Studio"
        >
          <span className="icon">movie</span>
        </button>
      </div>
      <div className="header-right">
        {/* Sidebar toggles moved to App.tsx for edge positioning */}
      </div>
    </header>
  );
}