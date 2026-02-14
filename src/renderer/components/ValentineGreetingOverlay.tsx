/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useAddEventListener } from '@/renderer/utils/emitter';
import './ValentineGreetingOverlay.css';

const HEART_EMOJIS = ['\u2764\uFE0F', '\uD83D\uDC95', '\uD83D\uDC96', '\uD83D\uDC97', '\uD83D\uDC98', '\uD83D\uDC9D', '\uD83E\uDE77', '\uD83D\uDC9E'];
const HEART_COUNT = 25;
const AUTO_DISMISS_MS = 6000;

interface FloatingHeart {
  id: number;
  emoji: string;
  left: number;
  duration: number;
  delay: number;
  size: number;
}

const generateHearts = (): FloatingHeart[] =>
  Array.from({ length: HEART_COUNT }, (_, i) => ({
    id: i,
    emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
    left: Math.random() * 100,
    duration: 3 + Math.random() * 4,
    delay: Math.random() * 2.5,
    size: 18 + Math.random() * 24,
  }));

const ValentineGreetingOverlay: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hearts = useMemo(() => generateHearts(), []);

  const dismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    clearTimeout(timerRef.current);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, 600);
  }, [exiting]);

  useAddEventListener(
    'valentine.greeting',
    () => {
      setVisible(true);
      setExiting(false);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  if (!visible) return null;

  return ReactDOM.createPortal(
    <div className={`valentine-greeting-overlay ${exiting ? 'valentine-greeting-overlay--out' : ''}`} onClick={dismiss} role='presentation'>
      {hearts.map((h) => (
        <span
          key={h.id}
          className='valentine-greeting-heart'
          style={{
            left: `${h.left}%`,
            fontSize: `${h.size}px`,
            animationDuration: `${h.duration}s`,
            animationDelay: `${h.delay}s`,
          }}
        >
          {h.emoji}
        </span>
      ))}

      <div className='valentine-greeting-message'>
        <span className='valentine-greeting-message__heart'>{'\u2764\uFE0F'}</span>
        <div className='valentine-greeting-message__text'>
          Searched all of the databases worldwide,
          <br />
          you are the most beautiful one.
        </div>
        <div className='valentine-greeting-message__text valentine-greeting-message__text-zh'>{'\u641C\u904D\u5168\u4E16\u754C\u7684\u6570\u636E\u5E93\uFF0C\u4F60\u662F\u6700\u7F8E\u7684\u90A3\u4E00\u4E2A'}</div>
      </div>
    </div>,
    document.body
  );
};

export default ValentineGreetingOverlay;
