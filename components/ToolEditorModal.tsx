/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useState } from 'react';
import { FunctionCall } from '@/lib/state';
import Modal from './Modal';
import { Behavior, FunctionResponseScheduling } from '@google/genai';

type ToolEditorModalProps = {
  tool: FunctionCall;
  onClose: () => void;
  onSave: (updatedTool: FunctionCall) => void;
};

export default function ToolEditorModal({
  tool,
  onClose,
  onSave,
}: ToolEditorModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parametersStr, setParametersStr] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<FunctionResponseScheduling>(
    FunctionResponseScheduling.INTERRUPT,
  );
  const [behavior, setBehavior] = useState<Behavior>(Behavior.BLOCKING);

  useEffect(() => {
    if (tool) {
      setName(tool.name);
      setDescription(tool.description || '');
      setParametersStr(JSON.stringify(tool.parameters || {}, null, 2));
      setScheduling(tool.scheduling || FunctionResponseScheduling.INTERRUPT);
      setBehavior(tool.behavior || Behavior.BLOCKING);
      setJsonError(null);
    }
  }, [tool]);

  const handleSave = () => {
    let parsedParameters;
    try {
      parsedParameters = JSON.parse(parametersStr);
      setJsonError(null);
    } catch (error) {
      setJsonError('Invalid JSON format for parameters.');
      return;
    }

    onSave({
      ...tool,
      name,
      description,
      parameters: parsedParameters,
      scheduling,
      behavior,
    });
  };

  return (
    <Modal onClose={onClose}>
      <div className="tool-editor-modal">
        <h2>Edit Function Call</h2>
        <div className="form-field">
          <label htmlFor="tool-name">Name</label>
          <input
            id="tool-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="tool-description">Description</label>
          <textarea
            id="tool-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="form-field">
          <label htmlFor="tool-behavior">Execution Behavior</label>
          <select
            id="tool-behavior"
            value={behavior}
            onChange={e => setBehavior(e.target.value as Behavior)}
          >
            <option value={Behavior.BLOCKING}>Blocking</option>
            <option value={Behavior.NON_BLOCKING}>Non-Blocking</option>
          </select>
          <p className="scheduling-description">
            'Non-Blocking' allows the model to continue speaking while the
            function runs.
          </p>
        </div>
        <div className="form-field">
          <label htmlFor="tool-scheduling">Response Scheduling</label>
          <select
            id="tool-scheduling"
            value={scheduling}
            onChange={e =>
              setScheduling(e.target.value as FunctionResponseScheduling)
            }
          >
            <option value={FunctionResponseScheduling.INTERRUPT}>
              Interrupt
            </option>
            <option value={FunctionResponseScheduling.WHEN_IDLE}>
              When Idle
            </option>
            <option value={FunctionResponseScheduling.SILENT}>Silent</option>
          </select>
          <p className="scheduling-description">
            Determines when the model's response is spoken. 'Interrupt' speaks
            immediately. 'When Idle' waits for a pause. 'Silent' does not speak.
          </p>
        </div>
        <div className="form-field">
          <label htmlFor="tool-parameters">Parameters (JSON Schema)</label>
          <textarea
            id="tool-parameters"
            className="json-editor"
            value={parametersStr}
            onChange={e => setParametersStr(e.target.value)}
          />
          {jsonError && <p className="json-error">{jsonError}</p>}
        </div>
        <div className="modal-actions">
          <button onClick={onClose} className="cancel-button">
            Cancel
          </button>
          <button onClick={handleSave} className="save-button">
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
