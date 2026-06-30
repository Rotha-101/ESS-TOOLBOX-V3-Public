import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

export const GlobalProgressModal: React.FC = () => {
  const { progress } = useAppStore();
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const formatHHMMSS = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const getRemainingTime = () => {
    if (progress.pct <= 1) return '--:--:--';
    const totalSecs = (elapsedTime / progress.pct) * 100;
    const remaining = Math.max(0, totalSecs - elapsedTime);
    return formatHHMMSS(remaining);
  };

  useEffect(() => {
    let intervalId: any = null;
    if (progress.active) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
      intervalId = setInterval(() => {
        if (startTimeRef.current !== null) {
          setElapsedTime((Date.now() - startTimeRef.current) / 1000);
        }
      }, 100);
    } else {
      startTimeRef.current = null;
      setElapsedTime(0);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [progress.active]);

  if (!progress.active) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center z-[9999] transition-all duration-300">
      <div className="bg-[#131B2E]/95 border border-slate-800/80 rounded-xl p-8 w-[min(96vw,52rem)] max-w-none shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-sm flex flex-col items-center gap-6 transition-all duration-300">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-accent-blue/10"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-accent-blue animate-spin"></div>
        </div>
        
        <div className="text-center space-y-2 w-full px-4">
          <h3 className="font-bold text-slate-200 text-xs tracking-wider uppercase font-mono leading-relaxed break-all">{progress.label}</h3>
          <p className="text-[10px] text-slate-500 font-mono">Do not refresh or close this app.</p>
        </div>

        <div className="w-full space-y-4 px-4">
          <div className="w-full bg-slate-950/40 h-3 rounded-full overflow-hidden border border-slate-800/60 p-0.5">
            <div 
              className="bg-accent-blue h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              style={{ width: `${progress.pct}%` }}
            ></div>
          </div>
          <div className="flex flex-nowrap justify-between items-center text-[9px] sm:text-[10px] font-mono border-t border-slate-800/50 pt-4 gap-1.5">
            <span className="bg-slate-800/60 border border-slate-700/30 px-1.5 sm:px-2 py-1 rounded text-slate-300 shrink-0 whitespace-nowrap">{progress.pct.toFixed(0)}% COMPLETE</span>
            <span className="text-accent-blue bg-accent-blue/10 border border-accent-blue/20 px-1.5 sm:px-2 py-1 rounded font-bold animate-pulse shrink-0 whitespace-nowrap">
              ELAPSED: {formatHHMMSS(elapsedTime)}
            </span>
            <span className="text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 sm:px-2 py-1 rounded font-bold animate-pulse shrink-0 whitespace-nowrap">
              REMAINING: {getRemainingTime()}
            </span>
            <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 sm:px-2 py-1 rounded font-bold shrink-0 whitespace-nowrap">STATUS: ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
