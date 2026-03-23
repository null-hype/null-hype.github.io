import { useState } from 'react';

type State = 'idle' | 'passed' | 'liked' | 'super';

const TOASTS: Record<Exclude<State, 'idle'>, string> = {
  passed: 'NO_MATCH — not a fit',
  liked: 'LIKE_SENT — fingers crossed!',
  super: 'SUPER_LIKE — bold move 👀',
};

const COLORS: Record<Exclude<State, 'idle'>, string> = {
  passed: '#f87171',
  liked: '#ff4d80',
  super: '#00f5ff',
};

export default function SwipeActions() {
  const [state, setState] = useState<State>('idle');
  const [animKey, setAnimKey] = useState(0);

  function fire(next: Exclude<State, 'idle'>) {
    setState(next);
    setAnimKey(k => k + 1);
  }

  function reset() {
    setState('idle');
  }

  return (
    <div className="hero-actions">
      {state !== 'idle' && (
        <div
          key={animKey}
          className="swipe-toast"
          style={{ color: COLORS[state] }}
          onAnimationEnd={reset}
        >
          {TOASTS[state]}
        </div>
      )}

      <button
        className={`action-btn action-pass ${state === 'passed' ? 'btn-active' : ''}`}
        aria-label="Pass"
        onClick={() => fire('passed')}
      >
        <span className="material-symbols-outlined">close</span>
        <span className="action-label">PASS</span>
      </button>

      <button
        className={`action-btn action-super ${state === 'super' ? 'btn-active' : ''}`}
        aria-label="Super like"
        onClick={() => fire('super')}
      >
        <span className="material-symbols-outlined">star</span>
        <span className="action-label">SUPER</span>
      </button>

      <button
        className={`action-btn action-like ${state === 'liked' ? 'btn-active' : ''}`}
        aria-label="Like"
        onClick={() => fire('liked')}
      >
        <span className="material-symbols-outlined">favorite</span>
        <span className="action-label">LIKE</span>
      </button>

      <style>{`
        @keyframes toast-up {
          0%   { opacity: 0; transform: translateX(-50%) translateY(0); }
          15%  { opacity: 1; transform: translateX(-50%) translateY(-12px); }
          70%  { opacity: 1; transform: translateX(-50%) translateY(-16px); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-28px); }
        }
        .swipe-toast {
          position: absolute;
          bottom: calc(100% + 0.75rem);
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Space Mono', monospace;
          font-size: 0.62rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          white-space: nowrap;
          pointer-events: none;
          animation: toast-up 1.6s ease forwards;
        }
        .btn-active {
          filter: brightness(1.3) !important;
          transform: translateY(3px);
        }
      `}</style>
    </div>
  );
}
