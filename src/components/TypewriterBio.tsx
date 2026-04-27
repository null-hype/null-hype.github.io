import { useState, useEffect, useRef } from 'react';

const LINES = [
  '> Profile.init()',
  '> Richard Anthony // @public-rant',
  '> Security Researcher & Platform Engineer',
  '> Agentic Vulnerability Automation',
  '> Terraform · ArgoCD · Dagger | Bug Bounty',
  '> Status: building Cyber Farm infrastructure',
];

const SPEED = 32;   // ms per character
const LINE_PAUSE = 280; // ms between lines

export default function TypewriterBio() {
  const [displayed, setDisplayed] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [done, setDone] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (done) return;
    if (currentLine >= LINES.length) { setDone(true); return; }

    const line = LINES[currentLine];

    if (charIdx < line.length) {
      timeoutRef.current = setTimeout(() => {
        setDisplayed(prev => {
          const next = [...prev];
          next[currentLine] = (next[currentLine] ?? '') + line[charIdx];
          return next;
        });
        setCharIdx(c => c + 1);
      }, SPEED);
    } else {
      timeoutRef.current = setTimeout(() => {
        setCurrentLine(l => l + 1);
        setCharIdx(0);
      }, LINE_PAUSE);
    }

    return () => clearTimeout(timeoutRef.current);
  }, [currentLine, charIdx, done]);

  return (
    <div className="typewriter-bio">
      {displayed.map((line, i) => (
        <div key={i} className={`tw-line ${line.startsWith('>') ? 'tw-prompt' : 'tw-cont'}`}>
          {line}
          {i === currentLine && !done && <span className="tw-cursor">█</span>}
        </div>
      ))}
      {done && (
        <div className="tw-line tw-prompt tw-blink">
          {'> _'}<span className="tw-cursor blink">█</span>
        </div>
      )}
      <style>{`
        .typewriter-bio {
          font-family: 'Space Mono', monospace;
          font-size: 0.8rem;
          line-height: 1.8;
          color: #e3e0f3;
        }
        .tw-prompt { color: #00f5ff; }
        .tw-cont   { color: rgba(227,224,243,0.75); padding-left: 1rem; }
        .tw-cursor {
          display: inline-block;
          color: #00f5ff;
          animation: blink-cursor 0.9s step-end infinite;
          margin-left: 1px;
          font-size: 0.75em;
          vertical-align: baseline;
        }
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
