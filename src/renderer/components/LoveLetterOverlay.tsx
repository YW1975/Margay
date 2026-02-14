/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useAddEventListener } from '@/renderer/utils/emitter';
import './LoveLetterOverlay.css';

type Phase = 'prompt' | 'letter';

const LOVE_LETTER = `
              Happy Valentine's Day 2026

              To my love --

              In every row of every table,
              across every database in the world,
              I searched with SELECT * FROM universe
              WHERE beauty = 'maximum'

              ...and every query returned only you.

              With mass storage of love,
              and infinite cache of affection,

              -- Your Margay Cat
`;

const CAT_FACE = `
       /\\_____/\\
      /  o   o  \\
     ( ==  ^  == )
      )         (
     (           )
    ( (  )   (  ) )
   (__(__)___(__)__)

   meow~ I love you purr~
`;

const LoveLetterOverlay: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [phase, setPhase] = useState<Phase>('prompt');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    clearTimeout(timerRef.current);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      setPhase('prompt');
    }, 600);
  }, [exiting]);

  useAddEventListener(
    'valentine.loveletter',
    () => {
      setVisible(true);
      setExiting(false);
      setPhase('prompt');
      clearTimeout(timerRef.current);
    },
    [dismiss]
  );

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleReveal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPhase('letter');
  }, []);

  if (!visible) return null;

  return ReactDOM.createPortal(
    <div className={`love-letter-overlay ${exiting ? 'love-letter-overlay--out' : ''}`} onClick={dismiss} role='presentation'>
      {/* Floating hearts background */}
      {Array.from({ length: 15 }, (_, i) => (
        <span
          key={i}
          className='love-letter-bg-heart'
          style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${3 + Math.random() * 4}s`,
            animationDelay: `${Math.random() * 2}s`,
            fontSize: `${14 + Math.random() * 18}px`,
            opacity: 0.15,
          }}
        >
          {'\u2764\uFE0F'}
        </span>
      ))}

      {phase === 'prompt' ? (
        <div className='love-letter-prompt' onClick={(e) => e.stopPropagation()}>
          <div className='love-letter-prompt__icon'>{'\uD83D\uDC8C'}</div>
          <p className='love-letter-prompt__text'>There&apos;s a love letter for you on my GitHub repo</p>
          <p className='love-letter-prompt__subtext'>
            <a href='https://github.com/YW1975/Margay' target='_blank' rel='noopener noreferrer' className='love-letter-prompt__link' onClick={(e) => e.stopPropagation()}>
              github.com/YW1975/Margay
            </a>
          </p>
          <p className='love-letter-prompt__question'>{'\u60F3\u770B\u5417\uFF1F'} Want to see it?</p>
          <div className='love-letter-prompt__actions'>
            <button type='button' className='love-letter-btn love-letter-btn--yes' onClick={handleReveal}>
              {'\u2764\uFE0F'} Yes!
            </button>
            <button type='button' className='love-letter-btn love-letter-btn--no' onClick={dismiss}>
              Later
            </button>
          </div>
        </div>
      ) : (
        <div className='love-letter-card' onClick={(e) => e.stopPropagation()}>
          <div className='love-letter-card__seal'>{'\uD83C\uDF39'}</div>
          <pre className='love-letter-card__body'>{LOVE_LETTER}</pre>
          <pre className='love-letter-card__cat'>{CAT_FACE}</pre>
          <button type='button' className='love-letter-btn love-letter-btn--close' onClick={dismiss}>
            {'\uD83D\uDC95'} Close
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};

export default LoveLetterOverlay;
