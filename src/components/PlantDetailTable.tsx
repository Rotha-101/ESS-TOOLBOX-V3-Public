import React from 'react';
import type { PlantBlock } from '../lib/cycle-utils';

export function PlantDetailTable({ blocks = [] }: { blocks?: PlantBlock[] }) {
  if (!blocks) blocks = [];
  return (
    <table className="w-full text-[10px] font-mono text-left border-collapse">
      <thead>
        <tr className="border-b border-border-v/50 text-foreground/45 uppercase text-[9px]">
          <th className="py-2 px-3 font-semibold">PlantName</th>
          <th className="py-2 px-3 font-semibold">DeviceName</th>
          <th className="py-2 px-3 font-semibold text-center">ESS_Number</th>
          <th className="py-2 px-3 font-semibold text-right">LastEquivalentNumberOfCycle</th>
          <th className="py-2 px-3 font-semibold text-right text-green-400">AverageCycleOfBlock</th>
          <th className="py-2 px-3 font-semibold text-right text-accent-blue">AverageCycleOfSPPC</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-v/20">
        {blocks.length === 0 ? (
          <tr>
            <td colSpan={6} className="py-4 text-center text-foreground/30 font-mono">
              No ESS units parsed for this plant on this day.
            </td>
          </tr>
        ) : (
          blocks.map((b, i) => (
            <tr key={i} className="hover:bg-foreground/[0.02] transition-colors">
              <td className="py-2 px-3 text-foreground/80">{b.PlantName}</td>
              <td className="py-2 px-3 text-foreground font-bold">{b.DeviceName}</td>
              <td className="py-2 px-3 text-center text-foreground/80">{b.ESS_Number}</td>
              <td className="py-2 px-3 text-right">
                {isNaN(b.LastEquivalentNumberOfCycle) ? 'NaN' : b.LastEquivalentNumberOfCycle.toFixed(4)}
              </td>
              <td className="py-2 px-3 text-right text-green-400 font-bold">
                {b.AverageCycleOfBlock === null || isNaN(b.AverageCycleOfBlock)
                  ? ''
                  : b.AverageCycleOfBlock.toFixed(4)}
              </td>
              <td className="py-2 px-3 text-right text-accent-blue font-bold">
                {b.AverageCycleOfSPPC === null || isNaN(b.AverageCycleOfSPPC)
                  ? ''
                  : b.AverageCycleOfSPPC.toFixed(4)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

// â”€â”€â”€ Helper: generate smooth mock daily data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
