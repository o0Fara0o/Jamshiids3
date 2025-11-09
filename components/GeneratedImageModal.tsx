/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { useUI } from '@/lib/state';

const GeneratedImageModal: React.FC = () => {
  const {
    isImageModalOpen,
    closeImageModal,
    generatedImageUrl,
    isGeneratingImage,
  } = useUI();

  if (!isImageModalOpen) {
    return null;
  }

  const handleDownload = () => {
    if (generatedImageUrl) {
      const a = document.createElement('a');
      a.href = generatedImageUrl;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `podcast-image-${timestamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="image-gen-modal-shroud" onClick={closeImageModal}>
      <div className="image-gen-modal" onClick={e => e.stopPropagation()}>
        <div className="image-gen-modal-content">
          {isGeneratingImage ? (
            <div className="image-gen-modal-spinner"></div>
          ) : generatedImageUrl ? (
            <img src={generatedImageUrl} alt="Generated Podcast Artwork" />
          ) : (
            <p>Something went wrong. Please try again.</p>
          )}
        </div>
        <div className="image-gen-modal-actions">
          <button className="close-button" onClick={closeImageModal}>
            Close
          </button>
          <button
            className="download-button"
            onClick={handleDownload}
            disabled={!generatedImageUrl || isGeneratingImage}
          >
            <span className="icon">download</span>
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeneratedImageModal;
