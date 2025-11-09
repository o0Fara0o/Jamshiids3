/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';

interface FlippableImageCardProps {
  imageUrl: string;
  prompt: string;
}

const FlippableImageCard: React.FC<FlippableImageCardProps> = ({
  imageUrl,
  prompt,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => setIsFlipped(!isFlipped);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleFlip();
    }
  };

  return (
    <div
      className="flippable-card-container"
      onClick={handleFlip}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Flippable image card. Click to see the prompt."
    >
      <div className={`flippable-card-inner ${isFlipped ? 'is-flipped' : ''}`}>
        <div className="flippable-card-front">
          <img src={imageUrl} alt="Generated content based on conversation" />
        </div>
        <div className="flippable-card-back">
          <p className="prompt-title">PROMPT</p>
          <p>{prompt}</p>
        </div>
      </div>
    </div>
  );
};

export default FlippableImageCard;