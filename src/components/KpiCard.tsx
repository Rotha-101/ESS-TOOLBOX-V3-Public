import React from 'react';
import { cn } from '@/lib/utils';
import { EnergyFlowAnimation } from './EnergyFlowAnimation';

export function KpiCard({ title, value, unit, subtext, subtextColor, borderColor, bgClass, showFlow }: { title: string, value: string, unit: string, subtext: string, subtextColor: string, borderColor?: string, bgClass?: string, showFlow?: boolean }) {
  return (
    <div className={cn("border border-t-2 p-3 rounded-sm flex flex-col transition-colors", bgClass ? bgClass : "bg-panel", borderColor ? borderColor : "border-border-v border-t-border-v")}>
      <div className="text-[10px] text-foreground/40 uppercase mb-1 font-bold">{title}</div>
      <div className="text-5xl font-black font-mono tracking-tight flex items-baseline gap-1">
        {value} <span className="text-xs font-normal opacity-50 font-sans tracking-normal">{unit}</span>
      </div>
      <div className={cn("text-[10px] mt-1 font-medium", subtextColor)}>{subtext}</div>
      {showFlow && <EnergyFlowAnimation />}
    </div>
  );
}
