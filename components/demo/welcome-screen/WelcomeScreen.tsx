
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect } from 'react';
import './WelcomeScreen.css';

const WelcomeScreen: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const settings = {
        sectors: 12,
        lineWidth: 2.5,
        fadeSpeed: 0.08,
        hueSpeed: 0.5
    };

    let centerX: number, centerY: number;
    let hue = 0;
    const mouse = {
        x: 0,
        y: 0,
        lastX: 0,
        lastY: 0,
        isDrawing: false
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      ctx.scale(dpr, dpr);
      
      centerX = rect.width / 2;
      centerY = rect.height / 2;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };


    const getEventPos = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = 'clientX' in e ? e.clientX : (e.touches && e.touches[0].clientX);
        const clientY = 'clientY' in e ? e.clientY : (e.touches && e.touches[0].clientY);
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: MouseEvent | TouchEvent) => {
        mouse.isDrawing = true;
        const pos = getEventPos(e);
        mouse.x = mouse.lastX = pos.x;
        mouse.y = mouse.lastY = pos.y;
        if (e.type.startsWith('touch')) e.preventDefault();
    };

    const stopDrawing = () => {
        mouse.isDrawing = false;
    };

    const draw = (e: MouseEvent | TouchEvent) => {
        if (!mouse.isDrawing) return;
        const pos = getEventPos(e);
        mouse.x = pos.x;
        mouse.y = pos.y;
        if (e.type.startsWith('touch')) e.preventDefault();
    };

    const drawKaleidoscopeStroke = () => {
        const angleIncrement = (Math.PI * 2) / settings.sectors;
        
        const startX = mouse.lastX - centerX;
        const startY = mouse.lastY - centerY;
        const endX = mouse.x - centerX;
        const endY = mouse.y - centerY;

        for (let i = 0; i < settings.sectors; i++) {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(i * angleIncrement);
            
            // Original segment
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Reflected segment
            ctx.scale(-1, 1);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            ctx.restore();
        }
    };

    const animate = () => {
        const parent = canvas.parentElement;
        if(parent) {
             const rect = parent.getBoundingClientRect();
             ctx.fillStyle = `rgba(0, 0, 0, ${settings.fadeSpeed})`;
             ctx.fillRect(0, 0, rect.width, rect.height);
        }

        if (mouse.isDrawing) {
            ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
            ctx.lineWidth = settings.lineWidth;
            ctx.lineCap = 'round';
            drawKaleidoscopeStroke();
        }

        hue = (hue + settings.hueSpeed) % 360;
        
        mouse.lastX = mouse.x;
        mouse.lastY = mouse.y;

        animationFrameId.current = requestAnimationFrame(animate);
    };
    
    // Event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    window.addEventListener('resize', resize);

    resize();
    animate();

    return () => {
      // Cleanup
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
      window.removeEventListener('resize', resize);
    };

  }, []);

  return (
    <div className="welcome-screen">
      <canvas ref={canvasRef} id="kaleidoscopeCanvas"></canvas>
      <div className="welcome-content">
        <h2 className="welcome-title">جعبه شنی مکالمه هوش مصنوعی</h2>
        <p>
          برای شنیدن مکالمه جمشید و فروا، دکمه پخش را فشار دهید.
        </p>
        <p>
          شما می‌توانید هر لحظه با صدای خود، یا با ارسال پیام متنی یا تصویری از نوار ورودی پایین، صحبت آن‌ها را قطع کنید.
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
