/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import Modal from './Modal';

interface RecoveryModalProps {
  onRecover: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

const RecoveryModal: React.FC<RecoveryModalProps> = ({ onRecover, onDiscard, onClose }) => {
  return (
    <Modal onClose={onClose}>
      <div className="recovery-modal-content">
        <h2><span className="icon">history</span>Session Recovery</h2>
        <p>
          It looks like your last session ended unexpectedly. You can recover the
          transcripts, images, and audio to continue where you left off.
        </p>
      </div>
      <div className="modal-actions">
        <button className="discard-btn" onClick={onDiscard}>
            Discard Session
        </button>
        <button className="recover-btn" onClick={onRecover}>
          <span className="icon">rebase</span>
          Recover Session
        </button>
      </div>
    </Modal>
  );
};

export default RecoveryModal;