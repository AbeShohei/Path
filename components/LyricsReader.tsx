import React, { useEffect, useRef, useState } from 'react';

interface LyricsReaderProps {
  text: string;
  isPlaying: boolean;
  duration: number; // in seconds
  onReplay?: () => void;
  theme?: 'light' | 'dark'; // 'light' for dark backgrounds, 'dark' for light backgrounds
}

const LyricsReader: React.FC<LyricsReaderProps> = ({ text, isPlaying, duration, onReplay, theme = 'dark' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [progress, setProgress] = useState(0); // 0.0 to 1.0
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Helper to determine text styles based on theme and status
  const getTextStyles = (status: 'normal' | 'read' | 'reading' | 'unread') => {
    const isLight = theme === 'light';

    switch (status) {
      case 'normal':
        return isLight
          ? 'text-gray-100 opacity-100 scale-100'
          : 'text-gray-700 opacity-100 scale-100';
      case 'read':
        return isLight
          ? 'text-white/60 blur-[0.5px]'
          : 'text-gray-800 opacity-60 blur-[0.5px]';
      case 'reading':
        return isLight
          ? 'text-cyan-300 scale-105 drop-shadow-md'
          : 'text-indigo-700 opacity-100 scale-105 drop-shadow-md';
      case 'unread':
        return isLight
          ? 'text-white/40 blur-[0.5px] scale-95'
          : 'text-gray-400 opacity-70 blur-[0.5px] scale-95';
    }
  };

  // Reset progress when text changes or play status toggles to true
  useEffect(() => {
    if (isPlaying && duration > 0) {
      startTimeRef.current = Date.now();
      setProgress(0);

      const animate = () => {
        const now = Date.now();
        const elapsed = (now - (startTimeRef.current || now)) / 1000;
        const p = Math.min(elapsed / duration, 1.0);

        setProgress(p);

        if (p < 1.0) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    } else if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setProgress(0);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, duration, text]);

  // Split text into lines: Split after punctuation (。、)
  // We use replace to add a newline after punctuation, then split by newline.
  const lines = text
    .replace(/([。、]+)/g, '$1\n') // Add newline after punctuation
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');

  // Calculate current active line index
  const totalLength = text.length;
  const currentCharIndex = Math.floor(totalLength * progress);

  let tempCharCount = 0;
  let activeLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i].length;
    if (currentCharIndex >= tempCharCount && currentCharIndex < tempCharCount + lineLen) {
      activeLineIndex = i;
      break;
    }
    tempCharCount += lineLen;
  }
  // If finished, set to last line
  if (progress >= 1.0) activeLineIndex = lines.length - 1;


  // Scroll active line to center
  useEffect(() => {
    if (activeLineIndex !== -1 && lineRefs.current[activeLineIndex]) {
      lineRefs.current[activeLineIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);


  let charCount = 0;

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="space-y-6 text-left"
      >
        {lines.map((line, i) => {
          const lineStart = charCount;
          const lineEnd = charCount + line.length;
          charCount += line.length;

          // Determine line status
          const isRead = currentCharIndex >= lineEnd;
          const isReading = currentCharIndex >= lineStart && currentCharIndex < lineEnd;

          let status: 'normal' | 'read' | 'reading' | 'unread' = 'normal';
          if (!isPlaying && duration > 0) status = 'normal';
          else if (isRead) status = 'read';
          else if (isReading) status = 'reading';
          else status = 'unread';

          return (
            <p
              key={i}
              ref={el => { lineRefs.current[i] = el; }}
              className={`text-lg md:text-xl font-medium transition-all duration-500 leading-loose font-serif ${getTextStyles(status)}`}
            >
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
};

export default LyricsReader;