import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DraggableOverlayProps {
  children: React.ReactNode;
  initialX?: number;
  initialY?: number;
  defaultCentered?: boolean;
  className?: string;
}

export const DraggableOverlay: React.FC<DraggableOverlayProps> = ({ 
  children, 
  initialX = 0, 
  initialY = 0, 
  defaultCentered = false,
  className = ''
}) => {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: pos.x,
      initialY: pos.y
    };
    e.stopPropagation();
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPos({
        x: dragStart.current.initialX + (e.clientX - dragStart.current.x),
        y: dragStart.current.initialY + (e.clientY - dragStart.current.y)
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const style = defaultCentered 
    ? { left: `calc(50% + ${pos.x}px)`, top: `calc(50% + ${pos.y}px)`, transform: 'translate(-50%, -50%)' }
    : { left: pos.x, top: pos.y };

  return (
    <div 
      className={cn("absolute z-30 cursor-move pointer-events-auto", className)}
      style={style}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
};
