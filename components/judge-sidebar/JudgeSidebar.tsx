/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef, useState } from 'react';
import { useJudgeStore, ConversationTurn } from '@/lib/state';
import { useJudgeAIContext } from '@/contexts/JudgeAIContext';
import { formatTimestamp } from '@/lib/utils';
import cn from 'classnames';
import './JudgeSidebar.css';

const renderContent = (turn: ConversationTurn) => {
  return <>{turn.text}</>;
};

export default function JudgeSidebar({ isOpen }: { isOpen: boolean }) {
  const turns = useJudgeStore(state => state.turns);
  const { sendMessage, status, lastForwardedComment } = useJudgeAIContext();
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
      'Judge AI': 'judge-ai',
      'Producer': 'producer',
    };
    const key = author.trim();
    return personaMap[key] ? `author-${personaMap[key]}` : `author-default`;
  };

  const getStatusInfo = () => {
    switch (status) {
      case 'evaluating': return { icon: 'sync', text: 'Evaluating...' };
      case 'forwarded': return { icon: 'gavel', text: 'Comment Sent!' };
      case 'error': return { icon: 'error', text: 'Error' };
      case 'idle':
      default: return { icon: 'hourglass_empty', text: 'Idle' };
    }
  };

  const { icon, text } = getStatusInfo();

  return (
    <aside className={cn("sidebar judge-sidebar", { open: isOpen })}>
      <div className="sidebar-header">
        <h3>Producer & Judge Chat</h3>
        <div className="judge-status-indicator">
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
              <div className="sidebar-source">{t.author}</div>
              <div className="sidebar-timestamp">{formatTimestamp(t.timestamp)}</div>
            </div>
            <div className="sidebar-text-content">{renderContent(t)}</div>
          </div>
        ))}
      </div>
       {status === 'forwarded' && lastForwardedComment && (
        <div className="last-forwarded-banner">
            <span className="icon">info</span>
            <p>Forwarded: "{lastForwardedComment}"</p>
        </div>
      )}
      <div className="sidebar-input-bar">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Talk to the Judge AI..."
        />
        <button onClick={handleSend} disabled={!inputText.trim()}>
          <span className="icon">send</span>
        </button>
      </div>
    </aside>
  );
}