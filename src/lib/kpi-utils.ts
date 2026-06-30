import { hcByProject } from './audit-engine.js';

export const getDynamicKpis = (project: string) => {
  const currentPlants = hcByProject[project] || [];
  
  // Check if there are any uploaded files in this project
  let totalFiles = 0;
  let healthyFiles = 0;
  let totalSignals = 0;
  
  // Project-wide category tallies
  let totPoc = 0;
  let totEss = 0;
  let totSl = 0;
  let totEsr = 0;
  let totEsm = 0;

  currentPlants.forEach((plant: any) => {
    // Sum categories
    totPoc += plant.files.POC?.length || 0;
    totEss += plant.files.ESS?.length || 0;
    totSl += plant.files.SmartLogger?.length || 0;
    totEsr += plant.files.ESR?.length || 0;
    totEsm += plant.files.ESM?.length || 0;

    Object.values(plant.files).forEach((list: any) => {
      list.forEach((item: any) => {
        totalFiles++;
        if (item.report) {
          if (item.report.N) totalSignals += item.report.N;
          if (item.report.status === 'ok') healthyFiles++;
          else if (item.report.status === 'warning') healthyFiles += 0.7;
        }
      });
    });
  });

  const getPlantStatus = (plantIndex: number, defaultName: string) => {
    const plant = currentPlants[plantIndex];
    let value = "0";
    let subtext = "No files uploaded";
    let color = "text-foreground/40";
    let bg = "bg-foreground/10";
    let border = "border-border-v border-t-foreground/30";
    
    if (plant) {
      const poc = plant.files.POC?.length || 0;
      const ess = plant.files.ESS?.length || 0;
      const sl  = plant.files.SmartLogger?.length || 0;
      const esr = plant.files.ESR?.length || 0;
      const esm = plant.files.ESM?.length || 0;
      const totalPFiles = poc + ess + sl + esr + esm;
      value = String(totalPFiles);
      
      if (totalPFiles > 0) {
        let criticals = 0;
        let warnings = 0;
        Object.values(plant.files).forEach((list: any) => {
          list.forEach((item: any) => {
            if (item.report) {
              if (item.report.status === 'critical') criticals++;
              else if (item.report.status === 'warning') warnings++;
            }
          });
        });
        
        subtext = `POC: ${poc} | ESS: ${ess} | SL: ${sl} | ESR: ${esr} | ESM: ${esm}`;
        
        if (criticals > 0) {
          color = "text-red-500 font-semibold";
          bg = "bg-red-500/10";
          border = "border-red-500/20 border-t-red-500";
        } else if (warnings > 0) {
          color = "text-yellow-400 font-semibold";
          bg = "bg-yellow-400/10";
          border = "border-yellow-400/20 border-t-yellow-400";
        } else {
          color = "text-green-500 font-semibold";
          bg = "bg-green-500/10";
          border = "border-green-500/20 border-t-green-500";
        }
      }
    }
    
    return { name: plant?.name?.replace('_', ' ') || defaultName, value, unit: "Files", subtext, color, bg, border };
  };

  const p1 = getPlantStatus(0, "Plant 1");
  const p2 = getPlantStatus(1, "Plant 2");
  const p3 = getPlantStatus(2, "Plant 3");

  const qualityPct = totalFiles ? Math.round((healthyFiles / totalFiles) * 10000) / 100 : 100;
  
  return {
    p1, p2, p3,
    quality: {
      value: String(totalFiles),
      unit: "Excel Files",
      subtext: `Quality: ${qualityPct}% (POC: ${totPoc} | ESS: ${totEss} | SL: ${totSl} | ESR: ${totEsr} | ESM: ${totEsm})`,
      color: qualityPct > 90 ? "text-purple-400 font-semibold" : qualityPct > 70 ? "text-yellow-400 font-semibold" : "text-red-500 font-semibold",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20 border-t-purple-500",
      totalFiles
    }
  };
};
