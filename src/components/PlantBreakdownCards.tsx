import Plot from 'react-plotly.js';
import React from 'react';

import { hcByProject } from '../lib/audit-engine.js';
import { cn } from '@/lib/utils';

export function PlantBreakdownCards({ project, fontColor }: { project: string, fontColor: string }) {
  const currentPlants = hcByProject[project] || [];
  const chartColors = ['#00A3FF', '#22c55e', '#eab308', '#a855f7', '#ef4444'];
  const pieLabels = ['POC', 'ESS', 'SmartLogger', 'ESR', 'ESM'];

  const plantCharts = currentPlants.map((plant: any) => {
    const pocActual = plant.files?.POC?.length || 0;
    const essActual = plant.files?.ESS?.length || 0;
    const slActual  = plant.files?.SmartLogger?.length || 0;
    const esrActual = plant.files?.ESR?.length || 0;
    const esmActual = plant.files?.ESM?.length || 0;

    const values = [pocActual, essActual, slActual, esrActual, esmActual];
    const total = values.reduce((sum: number, v: number) => sum + v, 0);
    const exp = plant.expected || {};

    return {
      id: plant.id,
      name: plant.name.replace('_', ' '),
      values: total > 0 ? values : [1],
      labels: total > 0 ? pieLabels : ['No Data'],
      colors: total > 0 ? chartColors : ['#334155'],
      total,
      hasData: total > 0,
      breakdown: [
        { label: 'POC',            actual: pocActual, expected: exp.POC          ?? null, color: chartColors[0] },
        { label: 'ESS (battery)',  actual: essActual, expected: exp.ESS          ?? null, color: chartColors[1] },
        { label: 'SmartLogger',    actual: slActual,  expected: exp.SmartLogger  ?? null, color: chartColors[2] },
        { label: 'ESR (rack)',     actual: esrActual, expected: exp.ESR          ?? null, color: chartColors[3] },
        { label: 'ESM (module)',   actual: esmActual, expected: exp.ESM          ?? null, color: chartColors[4] },
      ],
    };
  });

  return (
    <div className={cn(
      "grid gap-3 w-full",
      plantCharts.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
    )}>
      {plantCharts.map((plantChart: any) => (
        <div key={plantChart.id} className="rounded-lg border border-border-v/60 bg-panel/70 p-2.5 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-foreground/55 font-bold truncate">{plantChart.name}</div>
            <div className="text-[9px] font-mono text-foreground/55 shrink-0">{plantChart.total} files</div>
          </div>
          <div className="h-[140px] w-full relative">
            <Plot
               data={[{
                 values: plantChart.values,
                 labels: plantChart.labels,
                 type: 'pie',
                 hole: 0.75,
                 pull: plantChart.values.map(() => 0.015),
                 marker: { 
                   colors: plantChart.colors,
                   line: { color: 'transparent', width: 0 }
                 },
                 textinfo: 'none',
                 hoverinfo: 'label+value+percent'
               }]}
               layout={{
                 autosize: true,
                 margin: { t: 0, r: 0, l: 0, b: 0 },
                 paper_bgcolor: 'transparent',
                 plot_bgcolor: 'transparent',
                 font: { family: 'JetBrains Mono', size: 9, color: fontColor },
                 showlegend: false,
                 annotations: [
                   {
                     text: plantChart.hasData
                       ? `<b>${plantChart.total}</b><br><span style="font-size:9px;color:${fontColor};opacity:.7">FILES</span>`
                       : `<span style="font-size:10px;color:${fontColor};opacity:.55">NO DATA</span>`,
                     showarrow: false,
                     font: { size: 12, color: fontColor }
                   }
                 ]
               }}
               useResizeHandler={true}
               style={{ width: '100%', height: '100%' }}
               config={{ displayModeBar: false }}
             />
          </div>
          <div className="mt-2 flex flex-col gap-0.5 border-t border-border-v/40 pt-2">
            {plantChart.breakdown.map((bdItem: any) => {
              const isComplete  = bdItem.expected !== null && bdItem.actual === bdItem.expected;
              const isExceeding = bdItem.expected !== null && bdItem.actual > bdItem.expected;
              const isPartial   = bdItem.expected !== null && bdItem.actual > 0 && bdItem.actual < bdItem.expected;
              const isEmpty     = bdItem.actual === 0;
              const textColor = isComplete ? 'text-green-500' : isExceeding ? 'text-amber-400' : isPartial ? 'text-blue-400' : isEmpty ? 'text-foreground/35' : 'text-foreground/50';
              const countLabel = bdItem.expected !== null
                ? `${bdItem.actual} / ${bdItem.expected.toLocaleString()}`
                : `${bdItem.actual} / -`;
              return (
                <div key={bdItem.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 opacity-70" style={{ backgroundColor: bdItem.color }} />
                    <span className="text-[9px] font-mono text-foreground/50 truncate">{bdItem.label}</span>
                  </div>
                  <span className={cn("text-[9px] font-mono font-bold shrink-0 tabular-nums", textColor)}>
                    {countLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}