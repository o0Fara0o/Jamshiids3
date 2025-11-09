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

import { ReactNode } from 'react';
import cn from 'classnames';
import { useDraggable } from '../hooks/useDraggable';

interface DraggablePanelProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  iconName: string;
  wheelClass: string;
  children: ReactNode;
}

export default function DraggablePanel({ id, isOpen, onClose, title, iconName, wheelClass, children }: DraggablePanelProps) {
  const { ref, position, handleMouseDown } = useDraggable({
    id: id,
    // The panel is 66.6vw wide. So left margin is (100-66.6)/2 = 16.7vw.
    // The header is roughly 60px high. We'll add a small margin.
    defaultPosition: { x: window.innerWidth * 0.167, y: 70 },
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={ref} className="draggable-panel" style={{ top: `${position.y}px`, left: `${position.x}px` }}>
      <header className="draggable-panel-header" onMouseDown={handleMouseDown} title="Drag to move panel">
        <div className={cn('panel-header-wheel', wheelClass)}>
          <span className="icon">{iconName}</span>
        </div>
        <h3 className="panel-header-title">{title}</h3>
        <button className="panel-header-close" onClick={onClose} title={`Close ${title}`}>
          <span className="icon">close</span>
        </button>
      </header>
      <div className="draggable-panel-content">
        {children}
      </div>
    </div>
  );
}
