/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface UseDraggableOptions {
  id: string;
  defaultPosition?: { x: number; y: number };
  onDragStart?: () => void;
  onDragEnd?: (pos: { x: number; y: number }) => void;
  onClick?: () => void;
}

export function useDraggable({
  id,
  defaultPosition = { x: 0, y: 20 },
  onDragStart,
  onDragEnd,
  onClick,
}: UseDraggableOptions) {
  const ref = useRef<HTMLDivElement>(null);

  const getInitialPosition = useCallback(() => {
    try {
      const savedPosition = localStorage.getItem(`draggable-pos-${id}`);
      if (savedPosition) {
        return JSON.parse(savedPosition);
      }
    } catch (e) {
      console.error('Failed to parse saved position', e);
    }
    // Just use the provided default position
    return defaultPosition;
  }, [id, defaultPosition]);

  const [position, setPosition] = useState(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, clientX: 0, clientY: 0 });
  const hasDraggedRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Prevent drag from starting on interactive elements inside the panel
      if ((e.target as HTMLElement).closest('button, a, input, select, textarea, .panel-content-wrapper')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      hasDraggedRef.current = false;
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
        clientX: e.clientX,
        clientY: e.clientY,
      };
      onDragStart?.();
    },
    [position.x, position.y, onDragStart]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = Math.abs(e.clientX - dragStartRef.current.clientX);
      const deltaY = Math.abs(e.clientY - dragStartRef.current.clientY);

      // Only register as a "drag" after moving a certain threshold
      if (deltaX > 5 || deltaY > 5) {
        hasDraggedRef.current = true;
      }
      
      if (!hasDraggedRef.current) return;

      if (!ref.current) return;

      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;

      const { offsetWidth, offsetHeight } = ref.current;
      const boundedX = Math.max(0, Math.min(newX, window.innerWidth - offsetWidth));
      const boundedY = Math.max(0, Math.min(newY, window.innerHeight - offsetHeight));

      setPosition({ x: boundedX, y: boundedY });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      if (!hasDraggedRef.current) {
        onClick?.();
      } else {
        localStorage.setItem(`draggable-pos-${id}`, JSON.stringify(position));
        onDragEnd?.(position);
      }
    }
  }, [isDragging, onClick, onDragEnd, position, id]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Recalculate default position on window resize if not manually moved
  useEffect(() => {
    const handleResize = () => {
      const savedPosition = localStorage.getItem(`draggable-pos-${id}`);
      if (!savedPosition) {
         setPosition(getInitialPosition());
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [id, getInitialPosition]);


  return { ref, position, isDragging, handleMouseDown };
}