/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import './StarryNightOverlay.css';

interface StarryNightOverlayProps {
  onClose: () => void;
}

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

const STAR_COUNT = 100;

const generateStars = (): Star[] =>
  Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 65, // Keep stars above the ground
    size: 1 + Math.random() * 2.5,
    duration: 1.5 + Math.random() * 3,
    delay: Math.random() * 4,
  }));

const StarryNightOverlay: React.FC<StarryNightOverlayProps> = ({ onClose }) => {
  const [exiting, setExiting] = useState(false);
  const stars = useMemo(() => generateStars(), []);

  const handleClose = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onClose, 1000);
  }, [exiting, onClose]);

  return ReactDOM.createPortal(
    <div className={`starry-night-overlay ${exiting ? 'starry-night-overlay--out' : ''}`} onClick={handleClose} role='presentation'>
      {/* Sky */}
      <div className='starry-night-sky' />

      {/* Moon */}
      <div className='starry-night-moon' />

      {/* Stars */}
      {stars.map((s) => (
        <div
          key={s.id}
          className='starry-night-star'
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* Shooting star */}
      <div className='starry-night-shooting-star' style={{ top: '15%', left: '20%' }} />

      {/* Ground hill + silhouettes (SVG) */}
      <svg className='starry-night-ground' viewBox='0 0 1200 400' preserveAspectRatio='xMidYMax slice' style={{ height: '35%' }}>
        {/* Grass field */}
        <path d='M0 280 Q200 220 400 250 Q500 260 600 240 Q750 210 900 230 Q1050 250 1200 220 L1200 400 L0 400 Z' fill='#0a1a0a' />
        {/* Darker foreground hill */}
        <path d='M0 320 Q300 270 600 290 Q900 310 1200 280 L1200 400 L0 400 Z' fill='#061006' />

        {/* Cat silhouette — sitting on the hill, looking up */}
        <g transform='translate(540, 210)'>
          {/* Body */}
          <ellipse cx='0' cy='30' rx='18' ry='25' fill='#050505' />
          {/* Head */}
          <circle cx='0' cy='2' r='14' fill='#050505' />
          {/* Left ear */}
          <polygon points='-12,-4 -14,-20 -4,-8' fill='#050505' />
          {/* Right ear */}
          <polygon points='12,-4 14,-20 4,-8' fill='#050505' />
          {/* Tail */}
          <path d='M15 40 Q35 20 40 35 Q42 45 30 50' stroke='#050505' strokeWidth='5' fill='none' strokeLinecap='round' />
        </g>

        {/* Girl silhouette — sitting next to the cat, looking up */}
        <g transform='translate(580, 195)'>
          {/* Body / dress */}
          <path d='M0 30 Q-15 20 -20 45 L20 45 Q15 20 0 30 Z' fill='#050505' />
          {/* Torso */}
          <rect x='-8' y='15' width='16' height='18' rx='5' fill='#050505' />
          {/* Head */}
          <circle cx='0' cy='8' r='11' fill='#050505' />
          {/* Hair flowing */}
          <path d='M-11 5 Q-15 15 -18 25 Q-16 20 -12 12' fill='#050505' />
          <path d='M10 3 Q14 12 16 22 Q14 16 11 8' fill='#050505' />
          {/* Hair top */}
          <ellipse cx='0' cy='2' rx='12' ry='7' fill='#050505' />
          {/* Legs */}
          <path d='M-10 44 L-14 60 L-6 60 L-4 44' fill='#050505' />
          <path d='M4 44 L2 60 L10 60 L12 44' fill='#050505' />
        </g>

        {/* Small flowers / grass details */}
        <circle cx='200' cy='300' r='2' fill='#0d250d' />
        <circle cx='350' cy='285' r='1.5' fill='#0d250d' />
        <circle cx='800' cy='290' r='2' fill='#0d250d' />
        <circle cx='1000' cy='270' r='1.5' fill='#0d250d' />
      </svg>

      {/* Dedication text */}
      <div className='starry-night-text'>
        <h2 className='starry-night-text__title'>Happy Valentine&#39;s Day 2026</h2>
        <p className='starry-night-text__subtitle'>With love, from your Margay cat</p>
      </div>

      {/* Click hint */}
      <div className='starry-night-hint'>click anywhere to close</div>
    </div>,
    document.body
  );
};

export default StarryNightOverlay;
