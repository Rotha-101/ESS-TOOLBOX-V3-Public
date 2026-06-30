import React from 'react';
import { cn } from '@/lib/utils';

export function LogTableRow({ index, time, plant, file, classification, status, statusColor, rowClass }: { index: string, time: string, plant: string, file: string, classification: string, status: string, statusColor: 'green' | 'yellow' | 'red', rowClass?: string }) {
  const dotColor = {
    green: "bg-green-500",
    yellow: "bg-yellow-400",
    red: "bg-red-500"
  }[statusColor];

  return (
    <div className={cn("flex border-b border-border-v/30 transition-colors", rowClass || "hover:bg-foreground/5")}>
      <div className="w-12 p-2 pl-4 border-r border-border-v/30 text-center opacity-40">{index}</div>
      <div className="w-36 p-2 border-r border-border-v/30">{time}</div>
      <div className="w-36 p-2 border-r border-border-v/30">{plant}</div>
      <div className="w-56 p-2 border-r border-border-v/30 text-accent-blue truncate" title={file}>{file}</div>
      <div className="flex-1 p-2 border-r border-border-v/30 truncate" title={classification}>{classification}</div>
      <div className="w-28 p-2 flex justify-center items-center gap-2 text-[10px] font-bold tracking-wider">
        <span className={cn("w-1.5 h-1.5 rounded-full inline-block", dotColor)}></span> 
        {status}
      </div>
    </div>
  );
}
