import Plot from 'react-plotly.js';
import React, { useState, useEffect } from "react";

import { Loader2, AlertTriangle } from "lucide-react";

interface Props {
  projectId: string;
  data: any; 
}

export function DynamicPlot({ projectId, data }: Props) {
  const [config, setConfig] = useState<{ traces: any[]; layout: any } | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAndEvaluateScript();
  }, [projectId, data]);

  const loadAndEvaluateScript = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      const api = (window as any).electronAPI;
      if (!api || !api.loadChartScript) {
        throw new Error("Electron API is not available.");
      }

      const res = await api.loadChartScript(projectId);
      if (res.ok && res.content) {
        try {
          const generatePlotConfig = new Function(
            "data", 
            res.content + "\nreturn generatePlotConfig(data);"
          ) as (data: any) => { traces: any[]; layout: any };
          
          const result = generatePlotConfig(data);
          setConfig(result);
        } catch (evalErr: any) {
          throw new Error("Failed to parse or execute custom script: " + evalErr.message);
        }
      } else {
        fallbackDefault();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      fallbackDefault();
    } finally {
      setIsLoading(false);
    }
  };

  const fallbackDefault = () => {
    if (!data || !data.timestamps) {
      setConfig({ traces: [], layout: { title: "No Data Available" } });
      return;
    }

    const t = data.timestamps.map((ts: string) => new Date(ts));
    
    setConfig({
      traces: [
        {
          x: t,
          y: data.pTotal?.plant1 || [],
          type: "scatter",
          mode: "lines",
          name: "Plant 1 Power",
          line: { color: "#0072BD", width: 2 }
        }
      ],
      layout: {
        title: "Default Dynamic View (No Script Found)",
        xaxis: { title: "Time" },
        yaxis: { title: "Power (MW)" },
        autosize: true,
        margin: { l: 50, r: 50, t: 50, b: 50 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { color: "#8B949E" }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="w-full h-[400px] flex flex-col items-center justify-center text-gray-500 bg-[#0A0B0D] border border-gray-800 rounded-lg">
        <Loader2 className="animate-spin mb-3 text-blue-500" size={32} />
        <div className="text-xs uppercase tracking-widest font-bold">Evaluating Dynamic Engine...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col relative border border-gray-800 rounded-lg overflow-hidden bg-[#0A0B0D]">
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/10 text-red-400 text-xs p-3 border-b border-red-500/20 flex items-center gap-2 z-10 font-mono font-bold">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}
      
      <div className="flex-1 w-full h-full">
        {config && (
          <Plot
            data={config.traces}
            layout={{
              ...config.layout,
              autosize: true,
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "100%" }}
            config={{ responsive: true, displaylogo: false }}
          />
        )}
      </div>
    </div>
  );
}