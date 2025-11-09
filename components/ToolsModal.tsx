
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState } from 'react';
import { useTools, FunctionCall } from '@/lib/state';
import Modal from './Modal';
import ToolEditorModal from './ToolEditorModal';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';

type ToolsModalProps = {
  onClose: () => void;
};

export default function ToolsModal({ onClose }: ToolsModalProps) {
  const { tools, toggleTool, addTool, removeTool, updateTool } = useTools();
  const { connected } = useLiveAPIContext();
  const [editingTool, setEditingTool] = useState<FunctionCall | null>(null);

  const handleSaveTool = (updatedTool: FunctionCall) => {
    if (editingTool) {
      updateTool(editingTool.name, updatedTool);
    }
    setEditingTool(null);
  };

  return (
    <>
      <Modal onClose={onClose}>
        <div className="tools-modal">
          <h2>Manage Tools (Function Calling)</h2>
          <div className="sidebar-section">
            <div className="tools-list">
              {tools.map(tool => (
                <div key={tool.name} className="tool-item">
                  <label className="tool-checkbox-wrapper">
                    <input
                      type="checkbox"
                      id={`tool-checkbox-${tool.name}`}
                      checked={tool.isEnabled}
                      onChange={() => toggleTool(tool.name)}
                      disabled={connected}
                    />
                    <span className="checkbox-visual"></span>
                  </label>
                  <label
                    htmlFor={`tool-checkbox-${tool.name}`}
                    className="tool-name-text"
                  >
                    {tool.name}
                  </label>
                  <div className="tool-actions">
                    <button
                      onClick={() => setEditingTool(tool)}
                      disabled={connected}
                      aria-label={`Edit ${tool.name}`}
                    >
                      <span className="icon">edit</span>
                    </button>
                    <button
                      onClick={() => removeTool(tool.name)}
                      disabled={connected}
                      aria-label={`Delete ${tool.name}`}
                    >
                      <span className="icon">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addTool}
              className="add-tool-button"
              disabled={connected}
            >
              <span className="icon">add</span> Add function call
            </button>
          </div>
          <div className="modal-actions">
            <button onClick={onClose} className="save-button">
              Close
            </button>
          </div>
        </div>
      </Modal>
      {editingTool && (
        <ToolEditorModal
          tool={editingTool}
          onClose={() => setEditingTool(null)}
          onSave={handleSaveTool}
        />
      )}
    </>
  );
}
