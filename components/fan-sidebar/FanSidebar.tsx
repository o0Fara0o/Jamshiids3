/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef, useState } from 'react';
import { useFanStore, ConversationTurn } from '@/lib/state';
import { useFanAIContext } from '@/contexts/FanAIContext';
import { formatTimestamp } from '@/lib/utils';
import cn from 'classnames';
import './FanSidebar.css';

const renderContent = (turn: ConversationTurn) => {
  return <>{turn.text}</>;
};

export default function FanSidebar({ isOpen }: { isOpen: boolean }) {
  const turns = useFanStore(state => state.turns);
  const { sendMessage, status } = useFanAIContext();
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  const handleSend = () => {
    if (inputText.trim()) {
      sendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getAuthorClassName = (author: string) => {
    const personaMap: { [key: string]: string } = {
      'کیان': 'fan-kian',
      'سارا': 'fan-sara',
      'نیما': 'fan-nima',
      'پروانه': 'fan-parvaneh',
      'آرش': 'fan-arash',
      'user': 'user',
      'System': 'system',
    };
    const key = author.trim();
    return personaMap[key] ? `author-${personaMap[key]}` : `author-default`;
  };
  
  const getAuthorDisplayName = (author: string, role: string) => {
    if (role === 'user') return 'You';
    return author;
  };

  const getStatusInfo = () => {
    switch (status) {
      case 'thinking': return { icon: 'sync', text: 'Thinking...' };
      case 'error': return { icon: 'error', text: 'Error' };
      case 'idle':
      default: return { icon: 'chat_bubble_outline', text: 'Idle' };
    }
  };

  const { icon, text } = getStatusInfo();

  return (
    <aside className={cn("sidebar fan-sidebar", { open: isOpen })}>
      <div className="sidebar-header">
        <h3>Fan Chat</h3>
        <div className="fan-status-indicator">
          <span className={`icon ${icon === 'sync' ? 'sync' : ''} ${status}`}>{icon}</span>
          <span>{text}</span>
        </div>
      </div>
      <div className="sidebar-content" ref={scrollRef}>
        {turns.map((t, i) => (
          <div
            key={i}
            className={`sidebar-entry role-${t.role} ${getAuthorClassName(t.author)} ${!t.isFinal ? 'interim' : ''}`}
          >
            <div className="sidebar-entry-header">
              <div className="sidebar-source">
                {getAuthorDisplayName(t.author, t.role)}
              </div>
              <div className="sidebar-timestamp">
                {formatTimestamp(t.timestamp)}
              </div>
            </div>
            <div className="sidebar-text-content">{renderContent(t)}</div>
          </div>
        ))}
      </div>
      <div className="sidebar-input-bar">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Chat as a fan..."
        />
        <button onClick={handleSend} disabled={!inputText.trim()}>
          <span className="icon">send</span>
        </button>
      </div>
    </aside>
  );
}