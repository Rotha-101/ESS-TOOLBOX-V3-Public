export interface CustomToolField {
  id: string;
  label: string;
  type: 'number' | 'text' | 'select';
  defaultValue?: any;
  options?: string[];
}

export interface CustomTool {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: string;
  group: string;
  iconName: string;
  fields: CustomToolField[];
  execute: (inputs: Record<string, any>) => string;
}

// Global utility helper to generate gorgeous premium engineering HTML blocks
function createEngineeringCard({
  title,
  subtitle,
  metrics,
  status,
  statusMsg,
  statusLevel
}: {
  title: string;
  subtitle: string;
  metrics: { label: string; value: string; unit?: string }[];
  status: string;
  statusMsg: string;
  statusLevel: 'info' | 'warning' | 'critical' | 'success';
}) {
  const colors = {
    info: { text: '#00A3FF', bg: 'rgba(0,163,255,0.04)', border: '#00A3FF' },
    warning: { text: '#F59E0B', bg: 'rgba(245,158,11,0.04)', border: '#F59E0B' },
    critical: { text: '#EF4444', bg: 'rgba(239,68,68,0.04)', border: '#EF4444' },
    success: { text: '#10B981', bg: 'rgba(16,185,129,0.04)', border: '#10B981' }
  };
  const color = colors[statusLevel];
  
  const metricsHtml = metrics.map(m => `
    <tr style="border-bottom: 1.5px solid rgba(255,255,255,0.03);">
      <td style="padding: 6px 0; color: rgba(255,255,255,0.6);">${m.label}:</td>
      <td style="padding: 6px 0; text-align: right; font-weight: bold; font-family: monospace;">${m.value}${m.unit ? ' ' + m.unit : ''}</td>
    </tr>
  `).join('');

  return `
    <div style="border: 1px solid rgba(255,255,255,0.12); background-color: #111A2E; border-radius: 6px; padding: 16px; margin: 16px 0; font-family: sans-serif; page-break-inside: avoid; color: #FFFFFF; max-width: 600px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
      <div style="font-weight: bold; font-size: 12px; color: ${color.text}; border-bottom: 1.5px solid rgba(255,255,255,0.08); padding-bottom: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; text-transform: uppercase; letter-spacing: 0.05em;">
        <span>${title}</span>
        <span style="font-size: 9px; font-family: monospace; color: rgba(255,255,255,0.4); font-weight: normal; text-transform: none; letter-spacing: 0;">${subtitle}</span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 12px;">
        <tbody>
          ${metricsHtml}
        </tbody>
      </table>
      <div style="background-color: ${color.bg}; border-left: 4px solid ${color.border}; padding: 10px; border-radius: 0 4px 4px 0; font-size: 11px; line-height: 1.4;">
        <strong style="color: ${color.border}; display: block; margin-bottom: 2px; font-family: monospace; text-transform: uppercase;">STATUS: ${status}</strong>
        ${statusMsg}
      </div>
    </div>
  `;
}

export const DEFAULT_LIBRARY_TOOLS: CustomTool[] = [
  // ==========================================
  // TAB 1: BESS Metrics -> Group: Capacity & Aging (17 tools)
  // ==========================================
  {
    id: "battery_soh_calculator",
    name: "Battery SOH Degradation",
    shortName: "SOH Audit",
    description: "Calculates battery State of Health (SOH) and degradation stats based on operating cycles and ambient cell temperature.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "BatteryCheck",
    fields: [
      { id: "cycles", label: "Operational Cycles", type: "number", defaultValue: 1200 },
      { id: "temp", label: "Avg Cell Temp (°C)", type: "number", defaultValue: 27 },
      { id: "chemistry", label: "Battery Chemistry", type: "select", defaultValue: "LFP", options: ["LFP (Lithium Iron Phosphate)", "NMC (Nickel Manganese Cobalt)"] }
    ],
    execute: (inputs) => {
      const cycles = parseFloat(inputs.cycles) || 0;
      const temp = parseFloat(inputs.temp) || 25;
      const chemistry = inputs.chemistry || "LFP";
      const baseCoef = chemistry.includes("NMC") ? 0.00018 : 0.00012;
      const tempFactor = temp > 35 ? 1.6 : (temp > 28 ? 1.25 : (temp < 15 ? 0.95 : 1.0));
      const capacityLoss = cycles * baseCoef * tempFactor;
      const soh = Math.max(0, 100 - capacityLoss * 100).toFixed(1);
      
      let level: 'success' | 'warning' | 'critical' = 'success';
      let text = 'OPTIMAL';
      let msg = `Thermal penalty of ${tempFactor.toFixed(2)}x cycle wear applied. State of health is healthy.`;
      
      if (parseFloat(soh) < 80) {
        level = 'critical';
        text = 'EOL WARNING';
        msg = 'Critical capacity loss. Battery has reached End of Life (EOL) parameters. Action required.';
      } else if (parseFloat(soh) < 90) {
        level = 'warning';
        text = 'WARNING';
        msg = 'Moderate degradation detected. Check HVAC system cooling capacity parameters.';
      }
      
      return createEngineeringCard({
        title: "🔋 Battery State of Health Audit",
        subtitle: `${chemistry} Chemistry`,
        metrics: [
          { label: "Total Cumulative Cycles", value: String(cycles) },
          { label: "Mean Cell Temperature", value: String(temp), unit: "°C" },
          { label: "Est. Capacity Retention", value: `${soh}%`, unit: "" }
        ],
        status: text,
        statusMsg: msg,
        statusLevel: level
      });
    }
  },
  {
    id: "capacity_fading_model",
    name: "Capacity Fading Model",
    shortName: "Cap Fade",
    description: "Evaluates capacity fading rate over operating days and depths of discharge.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "SlidersHorizontal",
    fields: [
      { id: "days", label: "Operating Days", type: "number", defaultValue: 365 },
      { id: "dod", label: "Average Daily DOD (%)", type: "number", defaultValue: 80 }
    ],
    execute: (inputs) => {
      const days = parseFloat(inputs.days) || 0;
      const dod = parseFloat(inputs.dod) || 80;
      const fade = (days * 0.005 + (dod / 100) * 1.5).toFixed(2);
      return createEngineeringCard({
        title: "Capacity Fading Analysis",
        subtitle: "Electrode Solid Electrolyte Interphase (SEI) Degradation",
        metrics: [
          { label: "Operating Duration", value: String(days), unit: "days" },
          { label: "Mean Operational DOD", value: String(dod), unit: "%" },
          { label: "Calculated Capacity Fade", value: `${fade}%` }
        ],
        status: "NORMAL",
        statusMsg: "Capacity decay matches design lifecycle profile.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "calendar_aging_estimator",
    name: "Calendar Aging Estimator",
    shortName: "Cal Aging",
    description: "Calculates static calendar aging capacity loss based on temperature and storage SOC.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "CalendarClock",
    fields: [
      { id: "years", label: "Calendar Years", type: "number", defaultValue: 3 },
      { id: "temp", label: "Avg Storage Temp (°C)", type: "number", defaultValue: 25 },
      { id: "soc", label: "Average Storage SOC (%)", type: "number", defaultValue: 50 }
    ],
    execute: (inputs) => {
      const years = parseFloat(inputs.years) || 0;
      const temp = parseFloat(inputs.temp) || 25;
      const soc = parseFloat(inputs.soc) || 50;
      const loss = (years * 1.1 * Math.exp((temp - 20) / 10) * (soc / 50)).toFixed(2);
      return createEngineeringCard({
        title: "📅 Calendar Aging Evaluation",
        subtitle: "Non-operational Passive Degradation",
        metrics: [
          { label: "Static Storage Duration", value: String(years), unit: "years" },
          { label: "Mean Storage Temp", value: String(temp), unit: "°C" },
          { label: "Storage SOC Target", value: String(soc), unit: "%" },
          { label: "Est. Calendar Capacity Loss", value: `${loss}%` }
        ],
        status: parseFloat(loss) > 8 ? "WARNING" : "OPTIMAL",
        statusMsg: parseFloat(loss) > 8 ? "High storage temp/SOC accelerated calendar fading. Adjust climate settings." : "Calendar aging losses are within normal thresholds.",
        statusLevel: parseFloat(loss) > 8 ? "warning" : "success"
      });
    }
  },
  {
    id: "cycle_aging_calculator",
    name: "Cycle Aging Calculator",
    shortName: "Cycle Aging",
    description: "Computes cyclic capacity fading based on active charge-discharge cycles and average C-rate.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "RefreshCcw",
    fields: [
      { id: "cycles", label: "Total Cycles Completed", type: "number", defaultValue: 800 },
      { id: "crate", label: "Average Operating C-rate", type: "number", defaultValue: 0.5 }
    ],
    execute: (inputs) => {
      const cycles = parseFloat(inputs.cycles) || 0;
      const crate = parseFloat(inputs.crate) || 0.5;
      const decay = (cycles * 0.008 * (1 + crate * 0.5)).toFixed(2);
      return createEngineeringCard({
        title: "Cycle Aging Assessment",
        subtitle: "Active Charge/Discharge Degradation",
        metrics: [
          { label: "Cycles Completed", value: String(cycles) },
          { label: "Operational C-Rate Ratio", value: String(crate), unit: "C" },
          { label: "Est. Cycle Capacity Fade", value: `${decay}%` }
        ],
        status: "ACTIVE STATE",
        statusMsg: `SOH degradation coefficient is running at ${(0.008 * (1 + crate * 0.5) * 100).toFixed(4)}% per 100 cycles.`,
        statusLevel: "success"
      });
    }
  },
  {
    id: "impedance_growth_tracker",
    name: "Impedance Growth Tracker",
    shortName: "Impedance",
    description: "Estimates battery internal resistance growth and power capability penalty.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "Gauge",
    fields: [
      { id: "cycles", label: "Cycles Completed", type: "number", defaultValue: 1000 },
      { id: "initial", label: "Initial Resistance (mΩ)", type: "number", defaultValue: 0.45 }
    ],
    execute: (inputs) => {
      const cycles = parseFloat(inputs.cycles) || 0;
      const initial = parseFloat(inputs.initial) || 0.45;
      const growth = (cycles * 0.05).toFixed(1); // 50% increase at 1000 cycles
      const current = (initial * (1 + parseFloat(growth) / 100)).toFixed(3);
      return createEngineeringCard({
        title: "📈 Internal Impedance Growth",
        subtitle: "Cell Resistance Telemetry",
        metrics: [
          { label: "Baseline DCIR", value: String(initial), unit: "mΩ" },
          { label: "Completed Cycles", value: String(cycles) },
          { label: "Calculated Impedance Growth", value: `${growth}%` },
          { label: "Estimated Current DCIR", value: String(current), unit: "mΩ" }
        ],
        status: parseFloat(growth) > 40 ? "WARNING" : "HEALTHY",
        statusMsg: parseFloat(growth) > 40 ? "Internal resistance rise exceeds limits. Heat generation will escalate during peak C-rates." : "Impedance growth rate is normal.",
        statusLevel: parseFloat(growth) > 40 ? "warning" : "success"
      });
    }
  },
  {
    id: "dod_impact_calc",
    name: "Depth of Discharge Impact",
    shortName: "DOD Wear",
    description: "Calculates degradation multiplier based on the cycle depth of discharge.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "TrendingDown",
    fields: [
      { id: "dod", label: "Target Operational DOD (%)", type: "number", defaultValue: 90 }
    ],
    execute: (inputs) => {
      const dod = parseFloat(inputs.dod) || 90;
      // DOD penalty curve: 1.0 at 80%, higher at 100%, lower at 50%
      const multiplier = (Math.exp((dod - 80) / 40)).toFixed(2);
      return createEngineeringCard({
        title: "DOD Cycle Wear Penalty",
        subtitle: "Stress Coefficient Profiler",
        metrics: [
          { label: "Operational DOD setting", value: String(dod), unit: "%" },
          { label: "Lifetime Wear Penalty Factor", value: `${multiplier}x` }
        ],
        status: parseFloat(multiplier) > 1.25 ? "WARNING (HIGH STRAIN)" : "EFFICIENT",
        statusMsg: parseFloat(multiplier) > 1.25 ? "Operating above 85% DOD increases anode strain. Restricting DOD to 80% will triple cyclic longevity." : "DOD setting provides optimal battery lifespan.",
        statusLevel: parseFloat(multiplier) > 1.25 ? "warning" : "success"
      });
    }
  },
  {
    id: "soc_limit_advisor",
    name: "SOC Limit Advisor",
    shortName: "SOC Limit",
    description: "Advises charge/discharge limit settings to minimize chemical degradation.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "Lightbulb",
    fields: [
      { id: "minSOC", label: "Min SOC Setting (%)", type: "number", defaultValue: 5 },
      { id: "maxSOC", label: "Max SOC Setting (%)", type: "number", defaultValue: 98 }
    ],
    execute: (inputs) => {
      const min = parseFloat(inputs.minSOC) || 5;
      const max = parseFloat(inputs.maxSOC) || 98;
      
      let lvl: 'success' | 'warning' = 'success';
      let title = "SAFE";
      let msg = "SOC ranges are balanced for daily operations.";
      
      if (min < 3 || max > 97) {
        lvl = 'warning';
        title = "AGGRESSIVE STATE";
        msg = "Charging beyond 95% or discharging below 5% accelerates material cracking. Recommend setting bounds to 10%-90%.";
      }
      
      return createEngineeringCard({
        title: "SOC Constraint Validation",
        subtitle: "Parameter Threshold Check",
        metrics: [
          { label: "Configured Discharge Threshold", value: String(min), unit: "%" },
          { label: "Configured Charge Threshold", value: String(max), unit: "%" }
        ],
        status: title,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "cell_voltage_mismatch",
    name: "Cell Voltage Mismatch",
    shortName: "Volt Deviation",
    description: "Analyzes battery rack cell voltage deviations and determines balance warnings.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "Diff",
    fields: [
      { id: "maxV", label: "Maximum Cell Voltage (V)", type: "number", defaultValue: 3.42 },
      { id: "minV", label: "Minimum Cell Voltage (V)", type: "number", defaultValue: 3.31 }
    ],
    execute: (inputs) => {
      const max = parseFloat(inputs.maxV) || 3.3;
      const min = parseFloat(inputs.minV) || 3.3;
      const delta = ((max - min) * 1000).toFixed(0);
      
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let status = "BALANCED";
      let msg = "Cell voltages are closely matched.";
      
      if (parseInt(delta) > 100) {
        lvl = 'critical';
        status = "CRITICAL MISMATCH";
        msg = "Voltage delta exceeds 100mV. Rack active balancing is offline or cell failure is imminent. Dispatch site check.";
      } else if (parseInt(delta) > 40) {
        lvl = 'warning';
        status = "WARNING";
        msg = "Moderate voltage spread. Monitor balancing current logs during next charging cycle.";
      }
      
      return createEngineeringCard({
        title: "Cell Voltage Deviation",
        subtitle: "BMS Rack Diagnostics",
        metrics: [
          { label: "Max Cell Voltage", value: String(max), unit: "V" },
          { label: "Min Cell Voltage", value: String(min), unit: "V" },
          { label: "Voltage Delta", value: String(delta), unit: "mV" }
        ],
        status: status,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "balance_duration_calc",
    name: "Balance Duration Estimator",
    shortName: "Balance Time",
    description: "Estimates the required balancing time for a pack based on cell delta SOC and balance current.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "AlarmClock",
    fields: [
      { id: "deltaAh", label: "Cell Capacity Delta (Ah)", type: "number", defaultValue: 4.5 },
      { id: "balCurrent", label: "Passive Bal Current (mA)", type: "number", defaultValue: 150 }
    ],
    execute: (inputs) => {
      const delta = parseFloat(inputs.deltaAh) || 4.5;
      const current = parseFloat(inputs.balCurrent) || 150;
      const hours = (delta / (current / 1000)).toFixed(1);
      return createEngineeringCard({
        title: "Passive Balancing Estimator",
        subtitle: "BMS Balancing Subsystem",
        metrics: [
          { label: "Capacity Delta", value: String(delta), unit: "Ah" },
          { label: "Active Bal Current", value: String(current), unit: "mA" },
          { label: "Estimated Duration to Match", value: String(hours), unit: "hours" }
        ],
        status: parseFloat(hours) > 24 ? "CRITICAL DELAY" : "NORMAL",
        statusMsg: parseFloat(hours) > 24 ? "Passive balancing will take over 24 hours. Cell matching check recommended." : "Balancing cycle is within expected operational timeframe.",
        statusLevel: parseFloat(hours) > 24 ? "critical" : "success"
      });
    }
  },
  {
    id: "cell_temp_gradient",
    name: "Cell Temp Gradient Audit",
    shortName: "Thermal Spread",
    description: "Evaluates thermal delta between cells in a module to locate airflow and HVAC issues.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "Thermometer",
    fields: [
      { id: "maxT", label: "Max Cell Temperature (°C)", type: "number", defaultValue: 34.5 },
      { id: "minT", label: "Min Cell Temperature (°C)", type: "number", defaultValue: 28.2 }
    ],
    execute: (inputs) => {
      const max = parseFloat(inputs.maxT) || 30;
      const min = parseFloat(inputs.minT) || 28;
      const delta = (max - min).toFixed(1);
      
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let title = "UNIFORM";
      let msg = "Thermal distribution across rack is within tolerances.";
      
      if (parseFloat(delta) > 5) {
        lvl = 'critical';
        title = "EXCESSIVE GRADIENT";
        msg = "Temperature delta exceeds 5°C. Accelerated local cell aging is occurring. Inspect fan filters and cabinet exhaust.";
      } else if (parseFloat(delta) > 3) {
        lvl = 'warning';
        title = "THERMAL SPREAD WARNING";
        msg = "Elevated temperature spread. Balancing cooling layout is recommended.";
      }
      
      return createEngineeringCard({
        title: "Thermal Gradient Audit",
        subtitle: "Cabinet Airflow Assessment",
        metrics: [
          { label: "Max Cell Temp", value: String(max), unit: "°C" },
          { label: "Min Cell Temp", value: String(min), unit: "°C" },
          { label: "Thermal Delta (ΔT)", value: String(delta), unit: "°C" }
        ],
        status: title,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "soh_prognosticator",
    name: "Battery SOH Prognosticator",
    shortName: "SOH Forecast",
    description: "Projects battery SOH for the next 5 years based on current decay trends.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "TrendingUp",
    fields: [
      { id: "currentSoh", label: "Current SOH (%)", type: "number", defaultValue: 92.5 },
      { id: "decayRate", label: "Annual Decay Rate (%/yr)", type: "number", defaultValue: 2.1 }
    ],
    execute: (inputs) => {
      const current = parseFloat(inputs.currentSoh) || 100;
      const rate = parseFloat(inputs.decayRate) || 2;
      const fiveYear = (current - rate * 5).toFixed(1);
      return createEngineeringCard({
        title: "SOH Prognostics (5-Year)",
        subtitle: "Degradation Trend Modeler",
        metrics: [
          { label: "Current Audited SOH", value: `${current}%` },
          { label: "Annual Baseline Decay", value: `${rate}%`, unit: "/yr" },
          { label: "Projected SOH in 5 Years", value: `${fiveYear}%` }
        ],
        status: parseFloat(fiveYear) < 80 ? "ALERT (EOL PREDICTED)" : "HEALTHY",
        statusMsg: parseFloat(fiveYear) < 80 ? `Battery will drop below EOL threshold (80%) in ${((current - 80) / rate).toFixed(1)} years.` : "Long term prognosis indicates normal lifetime retention.",
        statusLevel: parseFloat(fiveYear) < 80 ? "critical" : "success"
      });
    }
  },
  {
    id: "remaining_useful_life",
    name: "Remaining Useful Life (RUL)",
    shortName: "RUL Estimator",
    description: "Predicts the remaining cycles before the cells hit EOL capacity fading limit.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "Hourglass",
    fields: [
      { id: "soh", label: "Current SOH (%)", type: "number", defaultValue: 86.4 },
      { id: "cycleRate", label: "Completed Cycles", type: "number", defaultValue: 1400 }
    ],
    execute: (inputs) => {
      const soh = parseFloat(inputs.soh) || 86;
      const cycles = parseFloat(inputs.cycleRate) || 1000;
      const decayPerCycle = (100 - soh) / cycles;
      const remCycles = Math.max(0, Math.round((soh - 80) / decayPerCycle));
      return createEngineeringCard({
        title: "Remaining Useful Life (RUL)",
        subtitle: "Cycles to 80% EOL Threshold",
        metrics: [
          { label: "Current SOH", value: `${soh}%` },
          { label: "Cycles Logged", value: String(cycles) },
          { label: "Estimated Remaining Cycles", value: String(remCycles) }
        ],
        status: remCycles < 400 ? "WARNING (CLOSE TO LIMIT)" : "STABLE",
        statusMsg: remCycles < 400 ? "Active capacity margin is small. Initiate site procurement budget process." : "Sufficient operational lifetime margin remains.",
        statusLevel: remCycles < 400 ? "warning" : "success"
      });
    }
  },
  {
    id: "sei_thickness_est",
    name: "Anode SEI Thickness Estimator",
    shortName: "SEI Thickness",
    description: "Evaluates solid electrolyte interphase buildup based on cumulative charge throughput.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "Layers3",
    fields: [
      { id: "throughput", label: "Throughput (MWh)", type: "number", defaultValue: 450 }
    ],
    execute: (inputs) => {
      const tp = parseFloat(inputs.throughput) || 100;
      // Modeler: Thickness grows by sqrt(throughput)
      const thickness = (0.2 * Math.sqrt(tp)).toFixed(2);
      return createEngineeringCard({
        title: "SEI Layer Thickness Evaluation",
        subtitle: "Diffusion Limit Modeler",
        metrics: [
          { label: "Cumulative Throughput", value: String(tp), unit: "MWh" },
          { label: "Model Anode SEI Thickness", value: String(thickness), unit: "nm" }
        ],
        status: "NORMAL PROGRESSION",
        statusMsg: "Anode SEI growth matches square-root kinetics. Passivation layer is active.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "lithium_plating_risk",
    name: "Lithium Plating Risk Detector",
    shortName: "Plating Risk",
    description: "Analyzes charging temperature and high C-rate periods to estimate metallic lithium plating risks.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "Snowflake",
    fields: [
      { id: "chargeTemp", label: "Min Charging Temp (°C)", type: "number", defaultValue: 4 },
      { id: "crate", label: "Peak Charging C-rate", type: "number", defaultValue: 0.8 }
    ],
    execute: (inputs) => {
      const temp = parseFloat(inputs.chargeTemp) || 20;
      const crate = parseFloat(inputs.crate) || 0.5;
      
      // Plating risk escalates if temp is low and C-rate is high
      const riskIndex = (crate * 10) / Math.max(1, temp);
      let status = "LOW RISK";
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let msg = "No lithium plating risks detected. Temperatures are sufficient.";
      
      if (riskIndex > 1.5) {
        lvl = 'critical';
        status = "CRITICAL PLATING RISK";
        msg = "Severe risk of anode lithium dendrite formation! Lower temperature charging at high C-rate detected. Restrict peak C-rate below 0.1C.";
      } else if (riskIndex > 0.6) {
        lvl = 'warning';
        status = "MODERATE RISK";
        msg = "Elevated risk. Warm battery cabinets before ramping charging rates above 0.5C.";
      }
      
      return createEngineeringCard({
        title: "Lithium Plating Diagnostics",
        subtitle: "Low Temp Charging Safeguard",
        metrics: [
          { label: "Min Recorded Temp during charge", value: String(temp), unit: "°C" },
          { label: "Max Operating Charge Rate", value: String(crate), unit: "C" },
          { label: "Risk Index Coefficient", value: riskIndex.toFixed(3) }
        ],
        status: status,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "thermal_wear_penalty",
    name: "Thermal Wear Penalty",
    shortName: "Thermal Wear",
    description: "Calculates the wear penalty multiplier for cells operating at high temperatures.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "Flame",
    fields: [
      { id: "avgT", label: "Average Cell Temp (°C)", type: "number", defaultValue: 39.1 }
    ],
    execute: (inputs) => {
      const temp = parseFloat(inputs.avgT) || 25;
      // Arrhenius rate equation approximation
      const penalty = Math.exp((temp - 25) / 10).toFixed(2);
      return createEngineeringCard({
        title: "Thermal Wear Factor",
        subtitle: "Arrhenius Reaction Degradation Penalty",
        metrics: [
          { label: "Mean Cell Temperature", value: String(temp), unit: "°C" },
          { label: "Arrhenius Aging Multiplier", value: `${penalty}x` }
        ],
        status: parseFloat(penalty) > 2.0 ? "CRITICAL HEAT OVERHEAD" : "HEALTHY",
        statusMsg: parseFloat(penalty) > 2.0 ? "Chemical reaction rates are doubled. Battery aging is accelerated 2x. Enhance HVAC compressor setpoints." : "Thermal aging rate is within acceptable design limit.",
        statusLevel: parseFloat(penalty) > 2.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "cell_self_discharge",
    name: "Cell Self-Discharge Estimator",
    shortName: "Self-Discharge",
    description: "Evaluates monthly passive self-discharge rate based on resting temperature.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "BatteryLow",
    fields: [
      { id: "temp", label: "Resting Temperature (°C)", type: "number", defaultValue: 32 }
    ],
    execute: (inputs) => {
      const temp = parseFloat(inputs.temp) || 20;
      const rate = (1.5 * Math.exp((temp - 20) / 15)).toFixed(2);
      return createEngineeringCard({
        title: "Cell Self-Discharge Rate",
        subtitle: "Passive Charge Degradation",
        metrics: [
          { label: "Mean Idle Temperature", value: String(temp), unit: "°C" },
          { label: "Est. Self-Discharge Loss", value: `${rate}%`, unit: "/month" }
        ],
        status: parseFloat(rate) > 3.0 ? "WARNING" : "OPTIMAL",
        statusMsg: parseFloat(rate) > 3.0 ? "High idle self-discharge. Adjust active auxiliary fans to evacuate heat during inactive periods." : "Passive losses are within acceptable bounds.",
        statusLevel: parseFloat(rate) > 3.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "rechar_validator",
    name: "Re-characterization Validator",
    shortName: "Rechar Audit",
    description: "Validates capacity recalibration logs to determine actual discharge parameters.",
    category: "bess_ops",
    group: "capacity_aging",
    iconName: "FileCheck",
    fields: [
      { id: "measuredAh", label: "Measured Recalibrated (Ah)", type: "number", defaultValue: 278.4 },
      { id: "ratedAh", label: "Nominal Rated (Ah)", type: "number", defaultValue: 280 }
    ],
    execute: (inputs) => {
      const meas = parseFloat(inputs.measuredAh) || 280;
      const rated = parseFloat(inputs.ratedAh) || 280;
      const pct = ((meas / rated) * 100).toFixed(1);
      return createEngineeringCard({
        title: "Capacity Recalibration Audit",
        subtitle: "Actual vs Rated Discharge Capacity",
        metrics: [
          { label: "Measured Discharge", value: String(meas), unit: "Ah" },
          { label: "Nominal Design Capacity", value: String(rated), unit: "Ah" },
          { label: "Actual Cell Margin", value: `${pct}%` }
        ],
        status: parseFloat(pct) < 95 ? "WARNING" : "OPTIMAL",
        statusMsg: parseFloat(pct) < 95 ? "Measured capacity indicates significant wear. Update maximum SOC telemetry mapping in SCADA." : "System matches rated parameter profiles.",
        statusLevel: parseFloat(pct) < 95 ? "warning" : "success"
      });
    }
  },

  // ==========================================
  // TAB 1: BESS Metrics -> Group: Energy & Efficiency (17 tools)
  // ==========================================
  {
    id: "round_trip_efficiency",
    name: "Round Trip Efficiency",
    shortName: "RTE Calc",
    description: "Calculates BESS DC-DC and AC-AC Round Trip Efficiency (RTE) based on charge/discharge energy logs.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "Zap",
    fields: [
      { id: "chargeMwh", label: "Energy Charged (MWh)", type: "number", defaultValue: 104.2 },
      { id: "dischargeMwh", label: "Energy Discharged (MWh)", type: "number", defaultValue: 91.7 },
      { id: "auxMwh", label: "HVAC & Aux Energy (MWh)", type: "number", defaultValue: 5.4 }
    ],
    execute: (inputs) => {
      const charge = parseFloat(inputs.chargeMwh) || 1;
      const discharge = parseFloat(inputs.dischargeMwh) || 0;
      const aux = parseFloat(inputs.auxMwh) || 0;
      
      const dcRte = ((discharge / charge) * 100).toFixed(1);
      const acRte = ((discharge / (charge + aux)) * 100).toFixed(1);
      
      let level: 'success' | 'warning' | 'critical' = 'success';
      let status = 'EFFICIENT';
      let msg = 'RTE values meet contractual performance specifications.';
      
      if (parseFloat(acRte) < 80) {
        level = 'critical';
        status = 'CRITICAL EFFICIENCY';
        msg = 'AC RTE is below 80%. Excessive auxiliary load (HVAC cooling/heating) is degrading site yield. Check thermal sealing.';
      } else if (parseFloat(acRte) < 85) {
        level = 'warning';
        status = 'EFFICIENCY WARNING';
        msg = 'RTE is slightly degraded. Investigate inverter power module temperatures and auxiliary fan runtimes.';
      }
      
      return createEngineeringCard({
        title: "🔋 Round-Trip Efficiency Audit",
        subtitle: "AC/DC Power Balance Analysis",
        metrics: [
          { label: "Active Energy Charged", value: String(charge), unit: "MWh" },
          { label: "Active Energy Discharged", value: String(discharge), unit: "MWh" },
          { label: "HVAC & Auxiliary Load", value: String(aux), unit: "MWh" },
          { label: "DC-DC Core Efficiency", value: `${dcRte}%`, unit: "" },
          { label: "System AC-AC Net Efficiency", value: `${acRte}%`, unit: "" }
        ],
        status: status,
        statusMsg: msg,
        statusLevel: level
      });
    }
  },
  {
    id: "aux_power_loss",
    name: "Aux Power Loss Analysis",
    shortName: "Aux Load",
    description: "Evaluates monthly auxiliary power loss percentage against total dispatched energy.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "ZapOff",
    fields: [
      { id: "totalEnergy", label: "Dispatched Energy (MWh)", type: "number", defaultValue: 1200 },
      { id: "auxEnergy", label: "Auxiliary Energy (MWh)", type: "number", defaultValue: 108 }
    ],
    execute: (inputs) => {
      const tot = parseFloat(inputs.totalEnergy) || 1200;
      const aux = parseFloat(inputs.auxEnergy) || 0;
      const ratio = ((aux / tot) * 100).toFixed(2);
      return createEngineeringCard({
        title: "Auxiliary Energy Loss Ratio",
        subtitle: "Parasitic Load Assessment",
        metrics: [
          { label: "Net Dispatched energy", value: String(tot), unit: "MWh" },
          { label: "Aux Consumption", value: String(aux), unit: "MWh" },
          { label: "Parasitic Overhead Ratio", value: `${ratio}%` }
        ],
        status: parseFloat(ratio) > 8 ? "WARNING (HIGH LOSS)" : "OPTIMAL",
        statusMsg: parseFloat(ratio) > 8 ? "HVAC parasitic losses exceed 8% budget. Check compressor cycle thresholds." : "Auxiliary energy consumption is within budgeted envelope.",
        statusLevel: parseFloat(ratio) > 8 ? "warning" : "success"
      });
    }
  },
  {
    id: "standby_power",
    name: "Standby Power Consumption",
    shortName: "Standby Load",
    description: "Estimates baseline standing standby power draw when the plant is in idle state.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "PowerOff",
    fields: [
      { id: "idleHours", label: "Monthly Idle Hours", type: "number", defaultValue: 340 },
      { id: "baseDraw", label: "Standby Baseline Draw (kW)", type: "number", defaultValue: 18.5 }
    ],
    execute: (inputs) => {
      const hours = parseFloat(inputs.idleHours) || 0;
      const draw = parseFloat(inputs.baseDraw) || 18.5;
      const energy = ((hours * draw) / 1000).toFixed(2);
      return createEngineeringCard({
        title: "Standby Baseline Idle Draw",
        subtitle: "Non-dispatch Parasitic Consumption",
        metrics: [
          { label: "Active Idle Duration", value: String(hours), unit: "hrs/month" },
          { label: "Measured Standby Draw", value: String(draw), unit: "kW" },
          { label: "Cumulative Idle Loss", value: String(energy), unit: "MWh" }
        ],
        status: draw > 25 ? "WARNING" : "OPTIMAL",
        statusMsg: draw > 25 ? "High standby baseline. Check module communication node sleeping states." : "Standby baseline draw matches factory specifications.",
        statusLevel: draw > 25 ? "warning" : "success"
      });
    }
  },
  {
    id: "self_discharge_audit",
    name: "Self-Discharge Audit",
    shortName: "Self-Discharge",
    description: "Evaluates monthly passive self-discharge rate for cells based on temperature.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "BatteryWarning",
    fields: [
      { id: "temp", label: "Resting Temperature (°C)", type: "number", defaultValue: 32 }
    ],
    execute: (inputs) => {
      const temp = parseFloat(inputs.temp) || 20;
      const rate = (1.5 * Math.exp((temp - 20) / 15)).toFixed(2);
      return createEngineeringCard({
        title: "Cell Self-Discharge Rate",
        subtitle: "Passive Charge Degradation",
        metrics: [
          { label: "Mean Idle Temperature", value: String(temp), unit: "°C" },
          { label: "Est. Self-Discharge Loss", value: `${rate}%`, unit: "/month" }
        ],
        status: parseFloat(rate) > 3.0 ? "WARNING" : "OPTIMAL",
        statusMsg: parseFloat(rate) > 3.0 ? "High idle self-discharge. Adjust active auxiliary fans to evacuate heat during inactive periods." : "Passive losses are within acceptable bounds.",
        statusLevel: parseFloat(rate) > 3.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "energy_throughput",
    name: "Cumulative Energy Throughput",
    shortName: "Throughput",
    description: "Calculates total energy charged and discharged to verify cell equivalent cycles.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "ArrowLeftRight",
    fields: [
      { id: "capacityMwh", label: "BESS Rated Capacity (MWh)", type: "number", defaultValue: 20 },
      { id: "mwhThroughput", label: "Total Charged Energy (MWh)", type: "number", defaultValue: 16800 }
    ],
    execute: (inputs) => {
      const cap = parseFloat(inputs.capacityMwh) || 20;
      const tp = parseFloat(inputs.mwhThroughput) || 0;
      const eqCycles = (tp / cap).toFixed(0);
      return createEngineeringCard({
        title: "Equivalent Cycle Audit",
        subtitle: "Throughput-to-Cycle Converter",
        metrics: [
          { label: "Site Rated Capacity", value: String(cap), unit: "MWh" },
          { label: "Charged Throughput", value: String(tp), unit: "MWh" },
          { label: "Calculated Equivalent Cycles", value: String(eqCycles) }
        ],
        status: "HEALTHY",
        statusMsg: `Throughput validation complete. Site has run ${eqCycles} equivalent cycles.`,
        statusLevel: "success"
      });
    }
  },
  {
    id: "active_power_ramp",
    name: "Active Power Ramp Evaluator",
    shortName: "Power Ramp",
    description: "Measures active power response ramp times during rapid dispatch changes.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "FastForward",
    fields: [
      { id: "targetPower", label: "Ramp Step Delta (MW)", type: "number", defaultValue: 10 },
      { id: "durationSec", label: "Measured Duration (s)", type: "number", defaultValue: 1.8 }
    ],
    execute: (inputs) => {
      const power = parseFloat(inputs.targetPower) || 10;
      const sec = parseFloat(inputs.durationSec) || 2.0;
      const rate = (power / sec).toFixed(2);
      return createEngineeringCard({
        title: "Active Power Ramp Rate",
        subtitle: "Inverter Dynamic Gate Driver Response",
        metrics: [
          { label: "Ramp Power Step Delta", value: String(power), unit: "MW" },
          { label: "Response Ramping Duration", value: String(sec), unit: "seconds" },
          { label: "Ramp Rate Velocity", value: String(rate), unit: "MW/s" }
        ],
        status: parseFloat(rate) < 2.0 ? "WARNING" : "OPTIMAL",
        statusMsg: parseFloat(rate) < 2.0 ? "Slow active power ramp rate. Check AGC power limiter configs." : "Ramp rate meets utility grid-code requirements.",
        statusLevel: parseFloat(rate) < 2.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "reactive_power_shift",
    name: "Reactive Power Shift Calc",
    shortName: "Var Shift",
    description: "Computes voltage shift during reactive power injection/absorption tests.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "Sliders",
    fields: [
      { id: "mvar", label: "Reactive Dispatch (MVAR)", type: "number", defaultValue: 4.0 },
      { id: "gridImpedance", label: "System Impedance (%)", type: "number", defaultValue: 8.5 }
    ],
    execute: (inputs) => {
      const mvar = parseFloat(inputs.mvar) || 0;
      const imp = parseFloat(inputs.gridImpedance) || 8.5;
      const shift = (mvar * (imp / 100) * 1.15).toFixed(2);
      return createEngineeringCard({
        title: "Reactive Power Voltage Shift",
        subtitle: "Volt-VAR Regulation Telemetry",
        metrics: [
          { label: "Dispatched VAR command", value: String(mvar), unit: "MVAR" },
          { label: "Grid Impedance Parameter", value: String(imp), unit: "%" },
          { label: "Calculated Voltage Shift", value: `${shift}%` }
        ],
        status: parseFloat(shift) > 5 ? "WARNING" : "STABLE",
        statusMsg: parseFloat(shift) > 5 ? "Voltage deviation exceeds 5%. Restrict peak MVAR injection." : "Grid voltage shift complies with stability bounds.",
        statusLevel: parseFloat(shift) > 5 ? "warning" : "success"
      });
    }
  },
  {
    id: "crate_limit_check",
    name: "C-rate Limit Compliance Check",
    shortName: "C-Rate Check",
    description: "Validates current operational C-rate parameters against maximum safe thresholds.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "AlertTriangle",
    fields: [
      { id: "maxCurrent", label: "Max Discharged Current (A)", type: "number", defaultValue: 280 },
      { id: "ratedAh", label: "Cell Rated Capacity (Ah)", type: "number", defaultValue: 280 }
    ],
    execute: (inputs) => {
      const current = parseFloat(inputs.maxCurrent) || 280;
      const cap = parseFloat(inputs.ratedAh) || 280;
      const crate = (current / cap).toFixed(2);
      return createEngineeringCard({
        title: "C-rate Safety Auditor",
        subtitle: "Peak C-rate Limit Check",
        metrics: [
          { label: "Peak Discharged Current", value: String(current), unit: "A" },
          { label: "Cell Rated Capacity", value: String(cap), unit: "Ah" },
          { label: "Operational C-Rate", value: `${crate} C` }
        ],
        status: parseFloat(crate) > 1.0 ? "WARNING (HIGH C-RATE)" : "SAFE",
        statusMsg: parseFloat(crate) > 1.0 ? "Operating above 1C. Rapid cell degradation and high heat losses will occur. Limit peaks to 0.7C." : "C-rate is within safe design boundaries.",
        statusLevel: parseFloat(crate) > 1.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "heat_dissipation_rate",
    name: "Heat Dissipation Rate",
    shortName: "Heat Dissip",
    description: "Estimates the required heat dissipation rate during high power cycles.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "Wind",
    fields: [
      { id: "powerMw", label: "Discharge Power (MW)", type: "number", defaultValue: 5 },
      { id: "efficiency", label: "Inverter-Battery Loss (%)", type: "number", defaultValue: 4.8 }
    ],
    execute: (inputs) => {
      const mw = parseFloat(inputs.powerMw) || 5;
      const loss = parseFloat(inputs.efficiency) || 5;
      const heat = (mw * 1000 * (loss / 100)).toFixed(1);
      return createEngineeringCard({
        title: "Thermal Dissipation Overhead",
        subtitle: "System Waste Heat Auditor",
        metrics: [
          { label: "Active Power Output", value: String(mw), unit: "MW" },
          { label: "Total Heat Loss Percentage", value: String(loss), unit: "%" },
          { label: "Required Heat Dissipation", value: String(heat), unit: "kW" }
        ],
        status: parseFloat(heat) > 200 ? "WARNING" : "OPTIMAL",
        statusMsg: parseFloat(heat) > 200 ? "Heat load exceeds 200kW. HVAC fans must be set to maximum cooling speed." : "Required dissipation matches heat ventilation capability.",
        statusLevel: parseFloat(heat) > 200 ? "warning" : "success"
      });
    }
  },
  {
    id: "inverter_efficiency",
    name: "Inverter Efficiency Profiler",
    shortName: "PCS Eff",
    description: "Profiles power conversion system (PCS) efficiency based on AC vs DC power metrics.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "BarChart2",
    fields: [
      { id: "dcPower", label: "Inverter DC Input (kW)", type: "number", defaultValue: 5200 },
      { id: "acPower", label: "Inverter AC Output (kW)", type: "number", defaultValue: 5110 }
    ],
    execute: (inputs) => {
      const dc = parseFloat(inputs.dcPower) || 1;
      const ac = parseFloat(inputs.acPower) || 0;
      const eff = ((ac / dc) * 100).toFixed(2);
      return createEngineeringCard({
        title: "PCS Inverter Efficiency",
        subtitle: "IGBT Gate Conversion Loss Audit",
        metrics: [
          { label: "DC Input Power", value: String(dc), unit: "kW" },
          { label: "AC Output Power", value: String(ac), unit: "kW" },
          { label: "Inverter Conversion Efficiency", value: `${eff}%` }
        ],
        status: parseFloat(eff) < 98.0 ? "WARNING" : "OPTIMAL",
        statusMsg: parseFloat(eff) < 98.0 ? "PCS efficiency is low. Check IGBT junction temperatures and switching frequency harmonics." : "PCS is operating at high efficiency.",
        statusLevel: parseFloat(eff) < 98.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "transformer_losses",
    name: "Transformer Losses Estimator",
    shortName: "XFRM Loss",
    description: "Calculates MV/LV transformer core and copper losses during peak loading.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "Plug",
    fields: [
      { id: "loadPct", label: "Transformer Load Level (%)", type: "number", defaultValue: 85 }
    ],
    execute: (inputs) => {
      const load = parseFloat(inputs.loadPct) || 85;
      const coreLoss = 2.5; // Constant core loss (kW)
      const copperLoss = 15.0 * Math.pow(load / 100, 2); // I2R loss
      const totalLoss = (coreLoss + copperLoss).toFixed(2);
      return createEngineeringCard({
        title: "Transformer Efficiency Audit",
        subtitle: "Core and Copper Losses",
        metrics: [
          { label: "Transformer Load Level", value: String(load), unit: "%" },
          { label: "Estimated Core Loss", value: String(coreLoss), unit: "kW" },
          { label: "Estimated Copper Loss (I²R)", value: copperLoss.toFixed(2), unit: "kW" },
          { label: "Total Combined Losses", value: String(totalLoss), unit: "kW" }
        ],
        status: parseFloat(totalLoss) > 12 ? "HIGH LOAD WARNING" : "OPTIMAL",
        statusMsg: parseFloat(totalLoss) > 12 ? "High copper losses. Check transformer winding hot-spot temperature telemetry." : "Transformer losses are within normal thresholds.",
        statusLevel: parseFloat(totalLoss) > 12 ? "warning" : "success"
      });
    }
  },
  {
    id: "dc_bus_voltage_drop",
    name: "DC Bus Voltage Drop Calculator",
    shortName: "DC Drop",
    description: "Computes voltage drop and energy losses across the DC busbar system.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "ArrowDown",
    fields: [
      { id: "dcCurrent", label: "DC Bus Current (A)", type: "number", defaultValue: 2500 },
      { id: "resistance", label: "Busbar Resistance (mΩ)", type: "number", defaultValue: 0.04 }
    ],
    execute: (inputs) => {
      const current = parseFloat(inputs.dcCurrent) || 0;
      const res = parseFloat(inputs.resistance) || 0.04;
      const drop = (current * (res / 1000)).toFixed(2);
      const loss = ((current * parseFloat(drop)) / 1000).toFixed(2);
      return createEngineeringCard({
        title: "DC Busbar Voltage Drop",
        subtitle: "DC Interconnection Loss Audit",
        metrics: [
          { label: "DC Bus Current", value: String(current), unit: "A" },
          { label: "Busbar Resistance", value: String(res), unit: "mΩ" },
          { label: "Calculated Voltage Drop", value: String(drop), unit: "V" },
          { label: "Loss Power", value: String(loss), unit: "kW" }
        ],
        status: parseFloat(drop) > 0.2 ? "WARNING" : "HEALTHY",
        statusMsg: parseFloat(drop) > 0.2 ? "Voltage drop exceeds 0.2V. Check busbar bolt torque values to prevent hotspots." : "DC Busbar connections are tight and efficient.",
        statusLevel: parseFloat(drop) > 0.2 ? "warning" : "success"
      });
    }
  },
  {
    id: "aux_sys_efficiency",
    name: "Auxiliary System Efficiency",
    shortName: "Aux Efficiency",
    description: "Rates the efficiency of the auxiliary systems supporting the battery modules.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "CheckCircle",
    fields: [
      { id: "auxDraw", label: "Auxiliary Power Draw (kW)", type: "number", defaultValue: 45 },
      { id: "moduleTemp", label: "Average Cabinet Temp (°C)", type: "number", defaultValue: 26.5 }
    ],
    execute: (inputs) => {
      const draw = parseFloat(inputs.auxDraw) || 45;
      const temp = parseFloat(inputs.moduleTemp) || 26.5;
      
      let lvl: 'success' | 'warning' = 'success';
      let title = "OPTIMAL";
      let msg = "Auxiliary system power draw is normal.";
      
      if (draw > 60 && temp > 28) {
        lvl = 'warning';
        title = "REDUCED EFFICIENCY";
        msg = "High auxiliary power draw combined with elevated cabinet temperatures. HVAC condenser maintenance recommended.";
      }
      
      return createEngineeringCard({
        title: "Aux System Efficiency Rating",
        subtitle: "Thermal-Electric Overhead Audit",
        metrics: [
          { label: "Aux Power Draw", value: String(draw), unit: "kW" },
          { label: "Average Cabinet Temp", value: String(temp), unit: "°C" }
        ],
        status: title,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "state_of_energy",
    name: "Battery State of Energy (SOE)",
    shortName: "SOE Tracker",
    description: "Tracks the actual State of Energy (SOE) based on cell capacity and voltage curves.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "BatteryMedium",
    fields: [
      { id: "cellCapacity", label: "Cell Capacity (Ah)", type: "number", defaultValue: 280 },
      { id: "measuredVoltage", label: "Measured Voltage (V)", type: "number", defaultValue: 3.32 }
    ],
    execute: (inputs) => {
      const cap = parseFloat(inputs.cellCapacity) || 280;
      const volt = parseFloat(inputs.measuredVoltage) || 3.32;
      const soe = ((volt - 3.0) / (3.6 - 3.0) * 100).toFixed(1);
      return createEngineeringCard({
        title: "State of Energy (SOE) Audit",
        subtitle: "Voltage-Capacity Energy Model",
        metrics: [
          { label: "Measured Capacity", value: String(cap), unit: "Ah" },
          { label: "Measured Voltage", value: String(volt), unit: "V" },
          { label: "Estimated SOE", value: `${soe}%` }
        ],
        status: "ACTIVE",
        statusMsg: `Actual State of Energy computed based on electrochemical state curves.`,
        statusLevel: "success"
      });
    }
  },
  {
    id: "thermal_cop",
    name: "Thermal Management COP Calc",
    shortName: "HVAC COP",
    description: "Calculates the Coefficient of Performance (COP) of the HVAC cooling system.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "Calculator",
    fields: [
      { id: "coolingCapacity", label: "Cooling Output (kW)", type: "number", defaultValue: 35 },
      { id: "hvacDraw", label: "HVAC Input Power (kW)", type: "number", defaultValue: 11.2 }
    ],
    execute: (inputs) => {
      const output = parseFloat(inputs.coolingCapacity) || 35;
      const input = parseFloat(inputs.hvacDraw) || 11.2;
      const cop = (output / input).toFixed(2);
      return createEngineeringCard({
        title: "HVAC COP Evaluation",
        subtitle: "Cooling Coefficient of Performance",
        metrics: [
          { label: "Delivered Cooling Capacity", value: String(output), unit: "kW" },
          { label: "HVAC Electric Power Draw", value: String(input), unit: "kW" },
          { label: "Coefficient of Performance (COP)", value: String(cop) }
        ],
        status: parseFloat(cop) < 2.5 ? "WARNING" : "EFFICIENT",
        statusMsg: parseFloat(cop) < 2.5 ? "Low HVAC efficiency. Inspect refrigerant pressure levels and clean condenser coils." : "HVAC thermal cycle efficiency is healthy.",
        statusLevel: parseFloat(cop) < 2.5 ? "warning" : "success"
      });
    }
  },
  {
    id: "inverter_clipping",
    name: "Inverter Power Clipping Estimator",
    shortName: "Inverter Clip",
    description: "Calculates energy losses due to inverter power clipping during peak battery charging.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "Scissors",
    fields: [
      { id: "peakDcPower", label: "Peak Battery Power (kW)", type: "number", defaultValue: 5250 },
      { id: "inverterRating", label: "PCS Rated Capacity (kW)", type: "number", defaultValue: 5000 }
    ],
    execute: (inputs) => {
      const dc = parseFloat(inputs.peakDcPower) || 0;
      const rating = parseFloat(inputs.inverterRating) || 5000;
      const clip = Math.max(0, dc - rating);
      const lossPct = ((clip / dc) * 100).toFixed(2);
      return createEngineeringCard({
        title: "Inverter Power Clipping",
        subtitle: "DC Peak Power Limitation Audit",
        metrics: [
          { label: "Peak Battery Output", value: String(dc), unit: "kW" },
          { label: "PCS Rated AC Capacity", value: String(rating), unit: "kW" },
          { label: "Clipped Power Margin", value: String(clip), unit: "kW" },
          { label: "Energy Loss Percentage", value: `${lossPct}%` }
        ],
        status: clip > 0 ? "CLIPPING ACTIVE" : "NORMAL",
        statusMsg: clip > 0 ? "DC output exceeds inverter limit. Power clipping is actively shedding peak energy." : "DC peak power is within inverter limits.",
        statusLevel: clip > 0 ? "warning" : "success"
      });
    }
  },
  {
    id: "grid_connection_impedance",
    name: "Grid Connection Impedance",
    shortName: "Grid Impedance",
    description: "Calculates impedance losses at the MV grid connection point.",
    category: "bess_ops",
    group: "energy_efficiency",
    iconName: "Network",
    fields: [
      { id: "gridVoltage", label: "Grid Voltage (kV)", type: "number", defaultValue: 33 },
      { id: "shortCircuitPower", label: "Short Circuit Level (MVA)", type: "number", defaultValue: 450 }
    ],
    execute: (inputs) => {
      const kv = parseFloat(inputs.gridVoltage) || 33;
      const mva = parseFloat(inputs.shortCircuitPower) || 450;
      // Z = V^2 / S
      const z = (Math.pow(kv, 2) / mva).toFixed(3);
      return createEngineeringCard({
        title: "Grid Coupling Impedance",
        subtitle: "Point of Common Coupling Impedance Calc",
        metrics: [
          { label: "Nominal Grid Voltage", value: String(kv), unit: "kV" },
          { label: "Short Circuit Level (Scc)", value: String(mva), unit: "MVA" },
          { label: "Estimated Grid Impedance (Z)", value: String(z), unit: "Ω" }
        ],
        status: parseFloat(z) > 4.5 ? "WEAK GRID WARNING" : "STRONG GRID",
        statusMsg: parseFloat(z) > 4.5 ? "Weak grid connection detected. Fast frequency injection may cause voltage oscillations." : "Point of Common Coupling is robust.",
        statusLevel: parseFloat(z) > 4.5 ? "warning" : "success"
      });
    }
  },

  // ==========================================
  // TAB 1: BESS Metrics -> Group: Inverter & HVAC (16 tools)
  // ==========================================
  {
    id: "inverter_temp_audit",
    name: "Inverter Temperature Audit",
    shortName: "IGBT Temp",
    description: "Analyzes inverter IGBT power module temperatures and checks for overheat faults.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Cpu",
    fields: [
      { id: "igbtTemp", label: "Max IGBT Junction Temp (°C)", type: "number", defaultValue: 82.4 },
      { id: "ambientTemp", label: "Inverter Cabinet Temp (°C)", type: "number", defaultValue: 39.5 }
    ],
    execute: (inputs) => {
      const temp = parseFloat(inputs.igbtTemp) || 25;
      const amb = parseFloat(inputs.ambientTemp) || 25;
      
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let status = 'NORMAL';
      let msg = 'IGBT modules are operating within safe thermal zones.';
      
      if (temp > 85) {
        lvl = 'critical';
        status = 'OVERHEAT DANGER';
        msg = 'Critical IGBT junction temperature detected. PCS is scaling down power output (derating). Clean heat exchange fans.';
      } else if (temp > 75) {
        lvl = 'warning';
        status = 'ELEVATED TEMP';
        msg = 'Elevated switching temperatures. Winding resistance is rising. Boost cooling systems.';
      }
      
      return createEngineeringCard({
        title: "⚡ Inverter IGBT Thermal Audit",
        subtitle: "PCS Power Silicon Health",
        metrics: [
          { label: "PCS Cabinet Ambient", value: String(amb), unit: "°C" },
          { label: "IGBT Silicon Junction Temp", value: String(temp), unit: "°C" },
          { label: "Safe Operating Limit", value: "95.0", unit: "°C" }
        ],
        status: status,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "hvac_performance",
    name: "HVAC Performance Evaluator",
    shortName: "HVAC Flow",
    description: "Profiles HVAC unit cooling/heating capabilities against target battery cabinet requirements.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "AirVent",
    fields: [
      { id: "cop", label: "HVAC COP Coefficient", type: "number", defaultValue: 2.8 },
      { id: "flowRate", label: "Exhaust Flow Rate (m³/h)", type: "number", defaultValue: 3400 }
    ],
    execute: (inputs) => {
      const cop = parseFloat(inputs.cop) || 2.5;
      const flow = parseFloat(inputs.flowRate) || 3000;
      return createEngineeringCard({
        title: "HVAC Performance Audit",
        subtitle: "Cabinet Forced Air Ventilation",
        metrics: [
          { label: "Cooling Cycle COP Coefficient", value: String(cop) },
          { label: "Forced Air Flow Rate", value: String(flow), unit: "m³/h" }
        ],
        status: flow < 2000 ? "WARNING (RESTRICTED)" : "EFFICIENT",
        statusMsg: flow < 2000 ? "Air flow rate is below module rating. Clean intake debris and change filter media." : "Cooling loop airflow complies with specs.",
        statusLevel: flow < 2000 ? "warning" : "success"
      });
    }
  },
  {
    id: "coolant_flow_audit",
    name: "Coolant Flow Rate Audit",
    shortName: "Liquid Flow",
    description: "Validates liquid cooling loop flow rates and pressures for cells.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Droplet",
    fields: [
      { id: "pressurePsi", label: "Pump Outlet Pressure (PSI)", type: "number", defaultValue: 42.5 },
      { id: "gpm", label: "Measured Flow Rate (GPM)", type: "number", defaultValue: 12.8 }
    ],
    execute: (inputs) => {
      const psi = parseFloat(inputs.pressurePsi) || 40;
      const gpm = parseFloat(inputs.gpm) || 12;
      return createEngineeringCard({
        title: "Liquid Cooling Loop Audit",
        subtitle: "Active Liquid Chiller Subsystem",
        metrics: [
          { label: "Pump Outlet Pressure", value: String(psi), unit: "PSI" },
          { label: "Loop Flow Velocity", value: String(gpm), unit: "GPM" }
        ],
        status: gpm < 10.0 ? "CRITICAL (LOW FLOW)" : "NORMAL",
        statusMsg: gpm < 10.0 ? "Liquid flow velocity is critically low. Air lock or valve restriction detected. Check expansion tank levels." : "Chiller pump pressure and flow rates are nominal.",
        statusLevel: gpm < 10.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "fan_power_calc",
    name: "Fan Power Consumption",
    shortName: "Fan Power",
    description: "Estimates the energy consumed by the enclosure cooling fans.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Fan",
    fields: [
      { id: "fanCount", label: "Active Cooling Fans", type: "number", defaultValue: 8 },
      { id: "fanPowerW", label: "Single Fan Power (W)", type: "number", defaultValue: 350 }
    ],
    execute: (inputs) => {
      const fans = parseFloat(inputs.fanCount) || 8;
      const power = parseFloat(inputs.fanPowerW) || 350;
      const totalKw = ((fans * power) / 1000).toFixed(2);
      return createEngineeringCard({
        title: "Cooling Fan Power Draw",
        subtitle: "Auxiliary Air Evacuation",
        metrics: [
          { label: "Active Cooling Fans", value: String(fans) },
          { label: "Single Fan Power", value: String(power), unit: "W" },
          { label: "Total Power Consumption", value: String(totalKw), unit: "kW" }
        ],
        status: "ACTIVE",
        statusMsg: "Cabinet ventilation fan load calculated successfully.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "condensation_risk",
    name: "Condensation Risk Assessor",
    shortName: "Dew Point",
    description: "Evaluates dew point temperatures inside the enclosure to alert on condensation risk.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "CloudRain",
    fields: [
      { id: "cabTemp", label: "Cabinet Temperature (°C)", type: "number", defaultValue: 22.4 },
      { id: "humidity", label: "Relative Humidity (%)", type: "number", defaultValue: 78 }
    ],
    execute: (inputs) => {
      const temp = parseFloat(inputs.cabTemp) || 22.4;
      const hum = parseFloat(inputs.humidity) || 78;
      
      // Dew point approximation: Td = T - ((100 - RH)/5)
      const dewPoint = (temp - ((100 - hum) / 5)).toFixed(1);
      const delta = (temp - parseFloat(dewPoint)).toFixed(1);
      
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let status = "LOW RISK";
      let msg = "Cabinet humidity levels are normal. Low risk of condensation.";
      
      if (parseFloat(delta) < 2.0) {
        lvl = 'critical';
        status = "CRITICAL RISK";
        msg = "Cabinet temperature is close to the Dew Point! Water condensation on high-voltage terminals is highly likely. Activate HVAC dehumidification cycle.";
      } else if (parseFloat(delta) < 4.0) {
        lvl = 'warning';
        status = "ELEVATED RISK";
        msg = "High humidity detected. Recommend reducing cooling rate to prevent reaching dew point.";
      }
      
      return createEngineeringCard({
        title: "Condensation Dew Point Audit",
        subtitle: "Cabinet Climate Safety Check",
        metrics: [
          { label: "Cabinet Temperature", value: String(temp), unit: "°C" },
          { label: "Relative Humidity (RH)", value: String(hum), unit: "%" },
          { label: "Calculated Dew Point", value: String(dewPoint), unit: "°C" },
          { label: "Margin to Condensation", value: String(delta), unit: "°C" }
        ],
        status: status,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "enclosure_pressure",
    name: "Enclosure Pressure Safety",
    shortName: "Encl Pressure",
    description: "Checks enclosure internal pressure to ensure proper ventilation seal and venting parameters.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Compass",
    fields: [
      { id: "pressurePa", label: "Differential Pressure (Pa)", type: "number", defaultValue: 12.4 }
    ],
    execute: (inputs) => {
      const pressure = parseFloat(inputs.pressurePa) || 12.4;
      return createEngineeringCard({
        title: "Enclosure Pressure Differential",
        subtitle: "Ingress Protection seal check",
        metrics: [
          { label: "Differential Pressure", value: String(pressure), unit: "Pa" },
          { label: "Minimum Positive Target", value: "5.0", unit: "Pa" }
        ],
        status: pressure < 5.0 ? "WARNING (LOW SEAL)" : "NOMINAL",
        statusMsg: pressure < 5.0 ? "Pressure delta is low. Ingress protection (IP54) may be compromised. Check seal gaskets." : "Positive pressure keeps dust and moisture out.",
        statusLevel: pressure < 5.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "liquid_coolant_delta_t",
    name: "Liquid Coolant Delta T",
    shortName: "Chiller Delta",
    description: "Analyzes the difference between chiller inlet and outlet temperatures.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "ThermometerSun",
    fields: [
      { id: "inletT", label: "Chiller Inlet Temp (°C)", type: "number", defaultValue: 21.8 },
      { id: "outletT", label: "Chiller Outlet Temp (°C)", type: "number", defaultValue: 17.2 }
    ],
    execute: (inputs) => {
      const inlet = parseFloat(inputs.inletT) || 21.8;
      const outlet = parseFloat(inputs.outletT) || 17.2;
      const delta = (inlet - outlet).toFixed(1);
      return createEngineeringCard({
        title: "Chiller Temperature Delta",
        subtitle: "Liquid Loop Heat Removal",
        metrics: [
          { label: "Coolant Inlet Temp (Return)", value: String(inlet), unit: "°C" },
          { label: "Coolant Outlet Temp (Supply)", value: String(outlet), unit: "°C" },
          { label: "Temperature Delta (ΔT)", value: String(delta), unit: "°C" }
        ],
        status: parseFloat(delta) > 6.0 ? "WARNING" : "NORMAL",
        statusMsg: parseFloat(delta) > 6.0 ? "High thermal absorption. Increase chiller coolant velocity to prevent module hotspot gradients." : "Heat extraction rate matches module specifications.",
        statusLevel: parseFloat(delta) > 6.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "air_flow_velocity",
    name: "Air Flow Velocity Inspector",
    shortName: "Air Speed",
    description: "Measures cooling duct air speed velocity using anemometer logs.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "ChevronsRight",
    fields: [
      { id: "velocity", label: "Air Velocity (m/s)", type: "number", defaultValue: 4.8 }
    ],
    execute: (inputs) => {
      const vel = parseFloat(inputs.velocity) || 4.8;
      return createEngineeringCard({
        title: "Duct Air Velocity",
        subtitle: "Forced Air Cooling Speed",
        metrics: [
          { label: "Duct Air Speed Velocity", value: String(vel), unit: "m/s" },
          { label: "Target Nominal Range", value: "3.5 - 6.0", unit: "m/s" }
        ],
        status: vel < 3.5 ? "LOW VELOCITY" : "OPTIMAL",
        statusMsg: vel < 3.5 ? "Duct speed is too slow. Cabinet fan power degradation detected. Inspect fan belts." : "Air speed velocity provides nominal convective cooling coefficients.",
        statusLevel: vel < 3.5 ? "warning" : "success"
      });
    }
  },
  {
    id: "expansion_valve_diag",
    name: "Thermal Expansion Valve Diag",
    shortName: "TXV Status",
    description: "Evaluates expansion valve suction and liquid temperatures to verify valve operation.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Wrench",
    fields: [
      { id: "suctionT", label: "Suction Line Temp (°C)", type: "number", defaultValue: 14.5 },
      { id: "liquidT", label: "Liquid Line Temp (°C)", type: "number", defaultValue: 32.2 }
    ],
    execute: (inputs) => {
      const suction = parseFloat(inputs.suctionT) || 14.5;
      const liquid = parseFloat(inputs.liquidT) || 32.2;
      const superheat = (suction - 5.0).toFixed(1); // Mock evaporator saturation temp = 5C
      return createEngineeringCard({
        title: "HVAC Expansion Valve Diagnostics",
        subtitle: "Evaporator Superheat Audit",
        metrics: [
          { label: "Suction Line Temperature", value: String(suction), unit: "°C" },
          { label: "Liquid Line Temperature", value: String(liquid), unit: "°C" },
          { label: "Evaporator Superheat Margin", value: String(superheat), unit: "°C" }
        ],
        status: parseFloat(superheat) > 12.0 ? "TXV BLOCKED (HIGH SUPERHEAT)" : "NOMINAL",
        statusMsg: parseFloat(superheat) > 12.0 ? "Superheat exceeds 12°C. Expansion valve is under-feeding refrigerant. Check for TXV blockage." : "Expansion valve regulation is within target limits.",
        statusLevel: parseFloat(superheat) > 12.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "inverter_igbt_stress",
    name: "Inverter IGBT Stress Monitor",
    shortName: "IGBT Stress",
    description: "Evaluates voltage spikes (Vce) across IGBT terminals during high power switching.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Microchip",
    fields: [
      { id: "spikeV", label: "Peak Switching Spike (V)", type: "number", defaultValue: 1120 },
      { id: "busV", label: "DC Bus Voltage (V)", type: "number", defaultValue: 950 }
    ],
    execute: (inputs) => {
      const spike = parseFloat(inputs.spikeV) || 1120;
      const bus = parseFloat(inputs.busV) || 950;
      const margin = (1200 - spike).toFixed(0); // 1200V is IGBT limit
      return createEngineeringCard({
        title: "IGBT Switching Stress Audit",
        subtitle: "PCS Overvoltage Safety Margin",
        metrics: [
          { label: "DC Link Voltage", value: String(bus), unit: "V" },
          { label: "Peak Switching Overshoot (Vce)", value: String(spike), unit: "V" },
          { label: "Breakdown Margin", value: String(margin), unit: "V" }
        ],
        status: parseInt(margin) < 100 ? "CRITICAL STRESS WARNING" : "SAFE",
        statusMsg: parseInt(margin) < 100 ? "Switching transient voltage spike approaches IGBT breakdown rating. Inspect snubber capacitors." : "IGBT switching margin is safe.",
        statusLevel: parseInt(margin) < 100 ? "critical" : "success"
      });
    }
  },
  {
    id: "cabinet_ingress_leak",
    name: "Cabinet Ingress Leak Alert",
    shortName: "Cabinet Leak",
    description: "Monitors humidity sensor logs at the bottom of the cabinet to check for liquid leaks.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Droplets",
    fields: [
      { id: "floorMoisture", label: "Floor Moisture Level (RH)", type: "number", defaultValue: 45 }
    ],
    execute: (inputs) => {
      const moisture = parseFloat(inputs.floorMoisture) || 45;
      return createEngineeringCard({
        title: "Ingress Liquid Leak Audit",
        subtitle: "Cabinet Floor Humidity Sensor",
        metrics: [
          { label: "Floor Humidity Reading", value: String(moisture), unit: "%" }
        ],
        status: moisture > 85 ? "CRITICAL MOISTURE ALERT" : "DRY",
        statusMsg: moisture > 85 ? "High moisture reading at the cabinet base floor. Potential coolant hose leak or exterior rain ingress! Check site drains." : "Cabinet floor is dry and sealed.",
        statusLevel: moisture > 85 ? "critical" : "success"
      });
    }
  },
  {
    id: "hvac_runtime_eval",
    name: "HVAC Cycle Runtime Evaluator",
    shortName: "HVAC Cycles",
    description: "Evaluates HVAC cooling compressor cycle count and daily runtimes to identify wear.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Timer",
    fields: [
      { id: "cyclesCount", label: "Daily HVAC Compressor Cycles", type: "number", defaultValue: 24 },
      { id: "runtimeHours", label: "HVAC Run Duration (hrs)", type: "number", defaultValue: 14.5 }
    ],
    execute: (inputs) => {
      const cycles = parseFloat(inputs.cyclesCount) || 24;
      const hours = parseFloat(inputs.runtimeHours) || 12;
      const avgDuration = ((hours * 60) / cycles).toFixed(0);
      return createEngineeringCard({
        title: "HVAC Compressor Runtime Audit",
        subtitle: "Cooling Compressor Wear Analysis",
        metrics: [
          { label: "Compressor Cycles", value: String(cycles), unit: "cycles/day" },
          { label: "Daily Cumulative Runtime", value: String(hours), unit: "hours" },
          { label: "Average Cycle Duration", value: String(avgDuration), unit: "minutes" }
        ],
        status: parseFloat(avgDuration) < 15.0 ? "WARNING (SHORT CYCLING)" : "NOMINAL",
        statusMsg: parseFloat(avgDuration) < 15.0 ? "HVAC compressor is short-cycling. Wears out starter contactors. Adjust temperature deadband values from 1°C to 2°C." : "Compressor cycle runtimes are healthy.",
        statusLevel: parseFloat(avgDuration) < 15.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "filter_pressure_drop",
    name: "Filter Pressure Drop Inspector",
    shortName: "Filter Status",
    description: "Monitors pressure drop across the cooling air filters to detect dust blockage.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Filter",
    fields: [
      { id: "pressureDropPa", label: "Pressure Drop Delta (Pa)", type: "number", defaultValue: 85 }
    ],
    execute: (inputs) => {
      const drop = parseFloat(inputs.pressureDropPa) || 0;
      return createEngineeringCard({
        title: "Cabinet Intake Air Filter Audit",
        subtitle: "Differential Pressure Sensor Reading",
        metrics: [
          { label: "Filter Pressure Drop Delta", value: String(drop), unit: "Pa" },
          { label: "Maximum Allowable Limit", value: "120", unit: "Pa" }
        ],
        status: drop > 100 ? "WARNING (FILTER BLOCKED)" : "CLEAN",
        statusMsg: drop > 100 ? "Intake filter pressure drop exceeds limits. Fans consume more power, reducing cooling. Schedule filter replacement." : "Filter media pressure drop is within bounds.",
        statusLevel: drop > 100 ? "warning" : "success"
      });
    }
  },
  {
    id: "chill_water_balance",
    name: "Chill Water System Balance",
    shortName: "Chiller Bal",
    description: "Evaluates chilling liquid distribution across battery cabinets to identify hydraulic imbalance.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Scale",
    fields: [
      { id: "maxFlow", label: "Max Flow Cabinet (GPM)", type: "number", defaultValue: 4.8 },
      { id: "minFlow", label: "Min Flow Cabinet (GPM)", type: "number", defaultValue: 3.1 }
    ],
    execute: (inputs) => {
      const max = parseFloat(inputs.maxFlow) || 4;
      const min = parseFloat(inputs.minFlow) || 4;
      const delta = (max - min).toFixed(1);
      return createEngineeringCard({
        title: "Liquid Cooling Loop Balance",
        subtitle: "Hydraulic Loop Flow Variance Audit",
        metrics: [
          { label: "Max Cabinet Flow Velocity", value: String(max), unit: "GPM" },
          { label: "Min Cabinet Flow Velocity", value: String(min), unit: "GPM" },
          { label: "Flow Variance Delta", value: String(delta), unit: "GPM" }
        ],
        status: parseFloat(delta) > 1.2 ? "WARNING (IMBALANCE)" : "BALANCED",
        statusMsg: parseFloat(delta) > 1.2 ? "Hydraulic flow imbalance detected. Cabinet with lowest flow will degrade faster. Balance liquid manifold valves." : "Liquid coolant distribution is balanced.",
        statusLevel: parseFloat(delta) > 1.2 ? "warning" : "success"
      });
    }
  },
  {
    id: "rack_intake_temp",
    name: "Rack Intake Temp Spread",
    shortName: "Duct Intake",
    description: "Tracks temperature delta between hot and cold air aisles inside the battery enclosure.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Server",
    fields: [
      { id: "hotAisle", label: "Hot Aisle Temp (°C)", type: "number", defaultValue: 35.8 },
      { id: "coldAisle", label: "Cold Aisle Temp (°C)", type: "number", defaultValue: 21.2 }
    ],
    execute: (inputs) => {
      const hot = parseFloat(inputs.hotAisle) || 30;
      const cold = parseFloat(inputs.coldAisle) || 20;
      const delta = (hot - cold).toFixed(1);
      return createEngineeringCard({
        title: "Aisle Air Temperature Delta",
        subtitle: "Enclosure Air Re-circulation Audit",
        metrics: [
          { label: "Hot Aisle Exhaust Temp", value: String(hot), unit: "°C" },
          { label: "Cold Aisle Supply Temp", value: String(cold), unit: "°C" },
          { label: "Temperature Spread (ΔT)", value: String(delta), unit: "°C" }
        ],
        status: parseFloat(delta) > 18.0 ? "CRITICAL RE-CIRCULATION" : "NOMINAL",
        statusMsg: parseFloat(delta) > 18.0 ? "Air temperature delta exceeds 18°C. Hot exhaust air is leaking into the cold air aisle. Adjust rack blanking panels." : "Aisle thermal isolation is functioning correctly.",
        statusLevel: parseFloat(delta) > 18.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "inverter_harmonics",
    name: "Inverter Harmonics Injection",
    shortName: "PCS Harmonics",
    description: "Estimates the Total Harmonic Distortion (THD) generated by the inverter switches.",
    category: "bess_ops",
    group: "inverter_hvac",
    iconName: "Waves",
    fields: [
      { id: "filterStatus", label: "LC Filter Health Status", type: "select", defaultValue: "Optimal", options: ["Optimal", "Degraded (Capacitor Wear)"] },
      { id: "thdPercentage", label: "Measured Current THD (%)", type: "number", defaultValue: 1.8 }
    ],
    execute: (inputs) => {
      const filter = inputs.filterStatus || "Optimal";
      const thd = parseFloat(inputs.thdPercentage) || 1.8;
      
      let lvl: 'success' | 'warning' = 'success';
      let title = "COMPLIANT";
      let msg = "Inverter output harmonics are well below utility limits.";
      
      if (thd > 3.0 || filter.includes("Degraded")) {
        lvl = 'warning';
        title = "HARMONICS ELEVATED";
        msg = "Elevated THD detected. LC grid filter capacitors are showing signs of degradation. Schedule maintenance inspection.";
      }
      
      return createEngineeringCard({
        title: "Inverter Output THD Audit",
        subtitle: "Power Quality Harmonics",
        metrics: [
          { label: "Grid Filter Health State", value: filter },
          { label: "Measured Current THD", value: String(thd), unit: "%" }
        ],
        status: title,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },

  // ==========================================
  // TAB 2: Grid Engineering -> Group: Frequency Response (17 tools)
  // ==========================================
  {
    id: "frequency_compliance_auditor",
    name: "Frequency Compliance Auditor",
    shortName: "Grid Freq",
    description: "Evaluates grid frequency response compliance, primary droop commands, and power output telemetry.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "Activity",
    fields: [
      { id: "gridFreq", label: "Grid Frequency (Hz)", type: "number", defaultValue: 50.15 },
      { id: "nominalFreq", label: "Nominal Grid Freq (Hz)", type: "select", defaultValue: "50 Hz", options: ["50 Hz", "60 Hz"] },
      { id: "droopPercent", label: "Governor Droop (%)", type: "number", defaultValue: 4.0 }
    ],
    execute: (inputs) => {
      const freq = parseFloat(inputs.gridFreq) || 50;
      const nomStr = inputs.nominalFreq || "50 Hz";
      const droop = parseFloat(inputs.droopPercent) || 4;
      const nom = nomStr.includes("60") ? 60 : 50;
      const deltaF = freq - nom;
      
      let level: 'success' | 'warning' | 'critical' = 'success';
      let status = 'COMPLIANT';
      let msg = 'System is executing correct droop response power injection commands.';
      
      if (Math.abs(deltaF) > 0.25) {
        level = 'critical';
        status = 'GRID TRANSIENT ALERT';
        msg = `Severe frequency excursion detected. Battery is discharging at maximum power limit to support grid stability.`;
      } else if (Math.abs(deltaF) > 0.05) {
        level = 'warning';
        status = 'ACTIVE DROOP';
        msg = 'Frequency outside deadband. Battery is actively stabilizing the grid power flow.';
      }
      
      return createEngineeringCard({
        title: "⚡ Frequency Response Validation",
        subtitle: "Grid Interconnection Code",
        metrics: [
          { label: "Measured Grid Frequency", value: String(freq), unit: "Hz" },
          { label: "Nominal Grid Baseline", value: String(nom), unit: "Hz" },
          { label: "Frequency Deviation (Δf)", value: deltaF.toFixed(3), unit: "Hz" },
          { label: "Active Droop Curve Setting", value: String(droop), unit: "%" }
        ],
        status: status,
        statusMsg: msg,
        statusLevel: level
      });
    }
  },
  {
    id: "droop_response_auditor",
    name: "Droop Response Auditor",
    shortName: "Droop Audit",
    description: "Verifies BESS active power injection accuracy matching configured droop curves.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "LineChart",
    fields: [
      { id: "targetMw", label: "Curve Target Output (MW)", type: "number", defaultValue: 8.5 },
      { id: "measuredMw", label: "Measured PCS Output (MW)", type: "number", defaultValue: 8.1 }
    ],
    execute: (inputs) => {
      const target = parseFloat(inputs.targetMw) || 0;
      const measured = parseFloat(inputs.measuredMw) || 0;
      const error = (Math.abs(target - measured)).toFixed(2);
      return createEngineeringCard({
        title: "Droop Response Accuracy",
        subtitle: "Frequency Response Power Verification",
        metrics: [
          { label: "Curve Target Output", value: String(target), unit: "MW" },
          { label: "Measured Inverter Output", value: String(measured), unit: "MW" },
          { label: "Discrepancy Deviation", value: String(error), unit: "MW" }
        ],
        status: parseFloat(error) > 0.5 ? "WARNING (COMPLIANCE ERR)" : "COMPLIANT",
        statusMsg: parseFloat(error) > 0.5 ? "Droop discrepancy exceeds utility limits. Check frequency telemetry sensor latency." : "Active power output matches droop curve targets.",
        statusLevel: parseFloat(error) > 0.5 ? "warning" : "success"
      });
    }
  },
  {
    id: "deadband_violation",
    name: "Deadband Violation Detector",
    shortName: "Deadband Audit",
    description: "Scans active frequency logs to find instances where the BESS activated inside the deadband.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "AlertCircle",
    fields: [
      { id: "deadband", label: "Configured Deadband (Hz)", type: "number", defaultValue: 0.03 },
      { id: "measuredDev", label: "Small Excursion Triggered (Hz)", type: "number", defaultValue: 0.015 }
    ],
    execute: (inputs) => {
      const db = parseFloat(inputs.deadband) || 0.03;
      const dev = parseFloat(inputs.measuredDev) || 0.015;
      return createEngineeringCard({
        title: "Frequency Deadband Violation",
        subtitle: "Primary Frequency Control Guard",
        metrics: [
          { label: "Configured Frequency Deadband", value: String(db), unit: "Hz" },
          { label: "Excursion Magnitude Trigger", value: String(dev), unit: "Hz" }
        ],
        status: dev < db ? "WARNING (VIOLATION)" : "NORMAL",
        statusMsg: dev < db ? "Inverters triggered active primary power while frequency was within deadband. Wastes cycles. Calibrate SCADA triggers." : "Inverters remain inactive during standard deadband frequency waves.",
        statusLevel: dev < db ? "warning" : "success"
      });
    }
  },
  {
    id: "primary_reserve_calc",
    name: "Primary Reserve Calculator",
    shortName: "Primary Reserve",
    description: "Calculates the BESS capacity reserve margins required to support primary frequency control.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "ClockAlert",
    fields: [
      { id: "totalCapMwh", label: "BESS Rated Capacity (MWh)", type: "number", defaultValue: 40 },
      { id: "reserveHours", label: "Required Duration Limit (min)", type: "number", defaultValue: 30 }
    ],
    execute: (inputs) => {
      const cap = parseFloat(inputs.totalCapMwh) || 40;
      const mins = parseFloat(inputs.reserveHours) || 30;
      const reserveMw = (cap / (mins / 60)).toFixed(1);
      return createEngineeringCard({
        title: "Primary Reserve Headroom",
        subtitle: "Utility Frequency Reserve Cap",
        metrics: [
          { label: "Net BESS Capacity", value: String(cap), unit: "MWh" },
          { label: "Reserve Response Duration", value: String(mins), unit: "minutes" },
          { label: "Available Reserve Dispatch", value: String(reserveMw), unit: "MW" }
        ],
        status: "NOMINAL",
        statusMsg: `Primary reserve headroom calculated successfully. Reserve capability is ${reserveMw} MW.`,
        statusLevel: "success"
      });
    }
  },
  {
    id: "secondary_reserve_mon",
    name: "Secondary Reserve Monitor",
    shortName: "Secondary Reserve",
    description: "Monitors battery state-of-charge capacity limits to verify active secondary reserves.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "BatteryCharging",
    fields: [
      { id: "soc", label: "Active SOC (%)", type: "number", defaultValue: 54.5 }
    ],
    execute: (inputs) => {
      const soc = parseFloat(inputs.soc) || 50;
      return createEngineeringCard({
        title: "Secondary Reserve Capacity Check",
        subtitle: "Spinning Capacity Check",
        metrics: [
          { label: "Active Battery SOC", value: String(soc), unit: "%" },
          { label: "Target SOC Hold Range", value: "40 - 60", unit: "%" }
        ],
        status: (soc < 30 || soc > 70) ? "WARNING (RESERVES LOW)" : "HEALTHY",
        statusMsg: (soc < 30 || soc > 70) ? "SOC is outside the target hold window. Fast response bid might fail if grid calls. Charge/discharge to 50%." : "SOC holds sufficient headroom for bidirectional secondary response.",
        statusLevel: (soc < 30 || soc > 70) ? "warning" : "success"
      });
    }
  },
  {
    id: "ffr_evaluator",
    name: "FFR Evaluator",
    shortName: "FFR Response",
    description: "Evaluates BESS Fast Frequency Response (FFR) trigger speeds and peak currents.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "Bolt",
    fields: [
      { id: "triggerMs", label: "Measured Response Time (ms)", type: "number", defaultValue: 145 }
    ],
    execute: (inputs) => {
      const ms = parseFloat(inputs.triggerMs) || 145;
      return createEngineeringCard({
        title: "Fast Frequency Response Speed",
        subtitle: "Inverter Dynamic Gate Driver Response",
        metrics: [
          { label: "Measured Response Time", value: String(ms), unit: "ms" },
          { label: "Utility Grid Code Threshold", value: "200.0", unit: "ms" }
        ],
        status: ms > 200 ? "WARNING (NON-COMPLIANT)" : "COMPLIANT",
        statusMsg: ms > 200 ? "FFR trigger response exceeds 200ms limit. Check phase-locked loop (PLL) filter parameters." : "FFR response time is compliant and extremely fast.",
        statusLevel: ms > 200 ? "warning" : "success"
      });
    }
  },
  {
    id: "freq_ramp_rate",
    name: "Frequency Ramp Rate Monitor",
    shortName: "Ramp Safety",
    description: "Checks if power ramp velocity during frequency events is within grid restrictions.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "ChevronsUp",
    fields: [
      { id: "rampRate", label: "Power Ramp Rate (MW/s)", type: "number", defaultValue: 12.8 }
    ],
    execute: (inputs) => {
      const ramp = parseFloat(inputs.rampRate) || 12.8;
      return createEngineeringCard({
        title: "Primary Ramp Velocity Audit",
        subtitle: "Grid Injection Safety Check",
        metrics: [
          { label: "Active Power Ramp Velocity", value: String(ramp), unit: "MW/s" },
          { label: "Grid Maximum Allowed", value: "15.0", unit: "MW/s" }
        ],
        status: ramp > 15.0 ? "WARNING (OVER-RAMP)" : "SAFE",
        statusMsg: ramp > 15.0 ? "Power ramp rate exceeds grid code limit. May cause local line voltage spikes. Increase inverter filter damping." : "Ramp rate complies with grid transient bounds.",
        statusLevel: ramp > 15.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "voltage_droop_compensator",
    name: "Voltage Droop Compensator",
    shortName: "Volt-VAR Audit",
    description: "Checks grid coupling point voltage stability and reactive power compensation rates.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "GitCompare",
    fields: [
      { id: "voltagePcc", label: "Voltage at PCC (V)", type: "number", defaultValue: 33450 },
      { id: "ratedVoltage", label: "Nominal Grid Voltage (V)", type: "number", defaultValue: 33000 }
    ],
    execute: (inputs) => {
      const pcc = parseFloat(inputs.voltagePcc) || 33000;
      const nom = parseFloat(inputs.ratedVoltage) || 33000;
      const dev = (((pcc - nom) / nom) * 100).toFixed(2);
      
      let lvl: 'success' | 'warning' = 'success';
      let title = "STABLE";
      let msg = "Bus voltage is within acceptable grid tolerances.";
      
      if (Math.abs(parseFloat(dev)) > 1.5) {
        lvl = 'warning';
        title = "BUS VOLTAGE EXCURSION";
        msg = "Voltage delta exceeds 1.5%. Adjust Volt-VAR active power factor setpoints to stabilize line voltage.";
      }
      
      return createEngineeringCard({
        title: "Volt-VAR Voltage Deviation",
        subtitle: "Grid Interconnection Bus Voltage",
        metrics: [
          { label: "Measured PCC Bus Voltage", value: String(pcc), unit: "V" },
          { label: "Nominal MV Grid Voltage", value: String(nom), unit: "V" },
          { label: "Line Voltage Deviation", value: `${dev}%` }
        ],
        status: title,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "power_factor_auditor",
    name: "Power Factor Compliance",
    shortName: "PF Audit",
    description: "Evaluates active and reactive power values to audit power factor at utility boundary.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "PieChart",
    fields: [
      { id: "activeP", label: "Active Power (MW)", type: "number", defaultValue: 15.0 },
      { id: "reactiveQ", label: "Reactive Power (MVAR)", type: "number", defaultValue: 3.5 }
    ],
    execute: (inputs) => {
      const p = parseFloat(inputs.activeP) || 1;
      const q = parseFloat(inputs.reactiveQ) || 0;
      const s = Math.sqrt(Math.pow(p, 2) + Math.pow(q, 2));
      const pf = (p / s).toFixed(3);
      
      let lvl: 'success' | 'warning' = 'success';
      let status = "COMPLIANT";
      let msg = "Power factor is within target range.";
      
      if (parseFloat(pf) < 0.95) {
        lvl = 'warning';
        status = "NON-COMPLIANT";
        msg = "Power factor is below 0.95. Penalty fees are active. Adjust reactive power setpoint to correct boundary power factor.";
      }
      
      return createEngineeringCard({
        title: "Boundary Power Factor Audit",
        subtitle: "Utility Power Quality Check",
        metrics: [
          { label: "Active Power (P)", value: String(p), unit: "MW" },
          { label: "Reactive Power (Q)", value: String(q), unit: "MVAR" },
          { label: "Apparent Power (S)", value: s.toFixed(2), unit: "MVA" },
          { label: "Measured Power Factor", value: String(pf) }
        ],
        status: status,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "harmonics_distortion",
    name: "Harmonics Distortion Audit",
    shortName: "Harmonics",
    description: "Profiles total current harmonic distortion (THD-I) injected into grid feeder line.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "AudioWaveform",
    fields: [
      { id: "thdI", label: "Total Current THD (%)", type: "number", defaultValue: 2.1 }
    ],
    execute: (inputs) => {
      const thd = parseFloat(inputs.thdI) || 2.1;
      return createEngineeringCard({
        title: "Current Harmonics Ingestion",
        subtitle: "Feeder Line Power Quality Audit",
        metrics: [
          { label: "Measured Current THD", value: String(thd), unit: "%" },
          { label: "IEEE-519 Grid Feeder Limit", value: "5.0", unit: "%" }
        ],
        status: thd > 5.0 ? "CRITICAL (THD LIMIT EXCEEDED)" : "COMPLIANT",
        statusMsg: thd > 5.0 ? "Feeder harmonics exceed IEEE-519 limits! Check MV transformer LC filter grounding connections." : "feeder line current harmonics comply with IEEE-519.",
        statusLevel: thd > 5.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "voltage_squeeze",
    name: "Voltage Squeeze Calculator",
    shortName: "Volt Squeeze",
    description: "Calculates grid voltage rise margin during high active power discharge periods.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "ArrowDownNarrowWide",
    fields: [
      { id: "dispatchMw", label: "Dispatched Power (MW)", type: "number", defaultValue: 20 },
      { id: "rGrid", label: "Grid Resistance (Ω)", type: "number", defaultValue: 0.15 }
    ],
    execute: (inputs) => {
      const mw = parseFloat(inputs.dispatchMw) || 20;
      const r = parseFloat(inputs.rGrid) || 0.15;
      const rise = ((mw * r) / 330).toFixed(2); // 33kV baseline
      return createEngineeringCard({
        title: "Feeder Line Voltage Rise",
        subtitle: "High Dispatch Voltage Squeeze Audit",
        metrics: [
          { label: "Active Power Dispatched", value: String(mw), unit: "MW" },
          { label: "Line Resistance parameter", value: String(r), unit: "Ω" },
          { label: "Calculated Voltage Rise", value: String(rise), unit: "kV" }
        ],
        status: parseFloat(rise) > 0.6 ? "WARNING (HIGH RISE)" : "OPTIMAL",
        statusMsg: parseFloat(rise) > 0.6 ? "Voltage rise approaches limits (above 1.8%). Lower active power peaks to prevent overvoltage trips." : "Voltage rise is safe and within limits.",
        statusLevel: parseFloat(rise) > 0.6 ? "warning" : "success"
      });
    }
  },
  {
    id: "voltage_unbalance",
    name: "Voltage Unbalance Inspector",
    shortName: "Volt Unbalance",
    description: "Monitors three-phase voltage lines to calculate percentage phase unbalance.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "Shuffle",
    fields: [
      { id: "vA", label: "Phase A Voltage (V)", type: "number", defaultValue: 19100 },
      { id: "vB", label: "Phase B Voltage (V)", type: "number", defaultValue: 19050 },
      { id: "vC", label: "Phase C Voltage (V)", type: "number", defaultValue: 18800 }
    ],
    execute: (inputs) => {
      const a = parseFloat(inputs.vA) || 19000;
      const b = parseFloat(inputs.vB) || 19000;
      const c = parseFloat(inputs.vC) || 19000;
      
      const avg = (a + b + c) / 3;
      const maxDev = Math.max(Math.abs(a - avg), Math.abs(b - avg), Math.abs(c - avg));
      const unbalance = ((maxDev / avg) * 100).toFixed(2);
      
      return createEngineeringCard({
        title: "Three-Phase Voltage Balance",
        subtitle: "Phase Unbalance Ratio Audit",
        metrics: [
          { label: "Average Phase Voltage", value: avg.toFixed(0), unit: "V" },
          { label: "Maximum Deviation", value: maxDev.toFixed(0), unit: "V" },
          { label: "Voltage Unbalance Ratio", value: `${unbalance}%` }
        ],
        status: parseFloat(unbalance) > 1.0 ? "WARNING (UNBALANCED)" : "NOMINAL",
        statusMsg: parseFloat(unbalance) > 1.0 ? "Voltage unbalance exceeds 1% limits. Winding stresses in transformers are rising. Check substation load distribution." : "Phase balance complies with grid specifications.",
        statusLevel: parseFloat(unbalance) > 1.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "reactive_power_capability",
    name: "Reactive Power Capability",
    shortName: "Q Cap Limit",
    description: "Checks maximum available dynamic reactive power headroom based on active power load.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "CircuitBoard",
    fields: [
      { id: "apparentMva", label: "Inverter Rating (MVA)", type: "number", defaultValue: 10 },
      { id: "activeMw", label: "Active Power Output (MW)", type: "number", defaultValue: 7.5 }
    ],
    execute: (inputs) => {
      const s = parseFloat(inputs.apparentMva) || 10;
      const p = parseFloat(inputs.activeMw) || 0;
      // Q = sqrt(S^2 - P^2)
      const qMax = Math.sqrt(Math.max(0, Math.pow(s, 2) - Math.pow(p, 2))).toFixed(2);
      return createEngineeringCard({
        title: "Dynamic MVAR Headroom",
        subtitle: "Inverter Reactive Capability",
        metrics: [
          { label: "Inverter Rating (S)", value: String(s), unit: "MVA" },
          { label: "Active Power Output (P)", value: String(p), unit: "MW" },
          { label: "Available Dynamic VAR (Q)", value: String(qMax), unit: "MVAR" }
        ],
        status: "ACTIVE STATE",
        statusMsg: `Dynamic reactive capacity is ${qMax} MVAR. Dynamic VAR capability is available.`,
        statusLevel: "success"
      });
    }
  },
  {
    id: "grid_source_impedance",
    name: "Grid Source Impedance",
    shortName: "Source Imped",
    description: "Estimates grid equivalent impedance to check line strength and voltage impact.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "Cable",
    fields: [
      { id: "scc", label: "Short Circuit Level (MVA)", type: "number", defaultValue: 450 }
    ],
    execute: (inputs) => {
      const scc = parseFloat(inputs.scc) || 450;
      // Z = 33kV^2 / S
      const z = (Math.pow(33, 2) / scc).toFixed(3);
      return createEngineeringCard({
        title: "Grid Coupling Strength",
        subtitle: "Point of Common Coupling Impedance",
        metrics: [
          { label: "Short Circuit Level (Scc)", value: String(scc), unit: "MVA" },
          { label: "Estimated Source Impedance", value: String(z), unit: "Ω" }
        ],
        status: scc < 200 ? "WARNING (WEAK GRID)" : "STRONG GRID",
        statusMsg: scc < 200 ? "Extremely weak grid detected. Active/Reactive power steps must be sloped to prevent voltage trip overrides." : "Grid coupling strength is nominal.",
        statusLevel: scc < 200 ? "warning" : "success"
      });
    }
  },
  {
    id: "flicker_index",
    name: "Flicker Index Estimator",
    shortName: "Flicker Audit",
    description: "Measures short-term voltage flicker index (Pst) during high dynamic switching events.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "Eye",
    fields: [
      { id: "pstVal", label: "Flicker Level (Pst)", type: "number", defaultValue: 0.74 }
    ],
    execute: (inputs) => {
      const pst = parseFloat(inputs.pstVal) || 0.74;
      return createEngineeringCard({
        title: "Voltage Flicker Index (Pst)",
        subtitle: "Utility Power Quality Flicker Check",
        metrics: [
          { label: "Measured Flicker Level (Pst)", value: String(pst) },
          { label: "Regulatory Standard Limit", value: "1.00" }
        ],
        status: pst > 1.00 ? "CRITICAL (FLICKER OUT OF BOUNDS)" : "COMPLIANT",
        statusMsg: pst > 1.00 ? "Flicker index exceeds limits. PCS switching frequency is modulating grid line voltage. Check snubber circuits." : "Voltage flicker complies with regulatory grid code.",
        statusLevel: pst > 1.00 ? "critical" : "success"
      });
    }
  },
  {
    id: "voltage_stability_margin",
    name: "Grid Voltage Stability Margin",
    shortName: "Volt Stability",
    description: "Calculates active power threshold before line voltage collapses on weak buses.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "ShieldHalf",
    fields: [
      { id: "busV", label: "Bus Voltage (p.u.)", type: "number", defaultValue: 0.96 },
      { id: "rFeeder", label: "Line Resistance (p.u.)", type: "number", defaultValue: 0.08 }
    ],
    execute: (inputs) => {
      const v = parseFloat(inputs.busV) || 1.0;
      const r = parseFloat(inputs.rFeeder) || 0.08;
      // PV Curve peak approx: Pmax = V^2 / 4R
      const pMax = (Math.pow(v, 2) / (4 * r)).toFixed(2);
      return createEngineeringCard({
        title: "Voltage Collapse Limit",
        subtitle: "Bus Power Stability Threshold",
        metrics: [
          { label: "Measured Bus Voltage", value: String(v), unit: "p.u." },
          { label: "Feeder Line Resistance", value: String(r), unit: "p.u." },
          { label: "Max Power Stability Limit", value: String(pMax), unit: "p.u. MW" }
        ],
        status: parseFloat(pMax) < 3.5 ? "WARNING (LOW COLLAPSE MARGIN)" : "SAFE",
        statusMsg: parseFloat(pMax) < 3.5 ? "Low power transfer margin. Active power dispatch spikes could collapse bus voltage. Implement slope restrictions." : "Voltage stability margins are compliant.",
        statusLevel: parseFloat(pMax) < 3.5 ? "warning" : "success"
      });
    }
  },
  {
    id: "active_dampening_check",
    name: "Active Dampening Check",
    shortName: "Dampening",
    description: "Audits active resonance damping parameters in the PCS controls to prevent grid oscillation.",
    category: "grid_eng",
    group: "freq_response",
    iconName: "Signal",
    fields: [
      { id: "dampingFactor", label: "Damping Gain Coefficient", type: "number", defaultValue: 0.12 }
    ],
    execute: (inputs) => {
      const gain = parseFloat(inputs.dampingFactor) || 0.12;
      return createEngineeringCard({
        title: "Active Resonance Dampening",
        subtitle: "Inverter Controls Optimization",
        metrics: [
          { label: "Damping Gain Setting", value: String(gain) },
          { label: "Target Optimal Gain Range", value: "0.08 - 0.20" }
        ],
        status: gain < 0.08 ? "WARNING (UNDER-DAMPED)" : "STABLE",
        statusMsg: gain < 0.08 ? "Low damping factor increases filter resonance risk. Raise damping gain coefficient to 0.15." : "PCS resonance damping is active and calibrated.",
        statusLevel: gain < 0.08 ? "warning" : "success"
      });
    }
  },

  // ==========================================
  // TAB 2: Grid Engineering -> Group: Power Dispatch (16 tools)
  // ==========================================
  {
    id: "power_dispatch_discrepancy",
    name: "Power Dispatch Discrepancy",
    shortName: "Dispatch Dev",
    description: "Evaluates dispatcher active power target mismatch metrics against actual measured inverter output.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "SplitSquareHorizontal",
    fields: [
      { id: "targetMw", label: "Feeder Target Power (MW)", type: "number", defaultValue: 12.0 },
      { id: "measuredMw", label: "Measured Active Power (MW)", type: "number", defaultValue: 11.6 },
      { id: "soc", label: "Active SOC (%)", type: "number", defaultValue: 9.8 }
    ],
    execute: (inputs) => {
      const target = parseFloat(inputs.targetMw) || 0;
      const measured = parseFloat(inputs.measuredMw) || 0;
      const soc = parseFloat(inputs.soc) || 50;
      const diff = (target - measured).toFixed(2);
      
      let level: 'success' | 'warning' | 'critical' = 'success';
      let status = 'COMPLIANT';
      let msg = 'Power output conforms to target dispatch parameters.';
      
      if (soc < 10 && Math.abs(parseFloat(diff)) > 0.1) {
        level = 'warning';
        status = 'LOW SOC CLIPPING';
        msg = `BESS cannot deliver full dispatch because SOC is at ${soc}%. Inverters are scaling back outputs to prevent deep-discharge cell trip.`;
      } else if (Math.abs(parseFloat(diff)) > 0.5) {
        level = 'critical';
        status = 'DISCREPANCY ALERT';
        msg = 'Dispatch discrepancy exceeds 0.5MW. Inspect communication status or PCS contactor breakers.';
      }
      
      return createEngineeringCard({
        title: "⚡ Active Power Dispatch Audit",
        subtitle: "Utility Command Verification",
        metrics: [
          { label: "Configured target Power", value: String(target), unit: "MW" },
          { label: "Measured Site Active Output", value: String(measured), unit: "MW" },
          { label: "Dispatch Deviation Mismatch", value: String(diff), unit: "MW" },
          { label: "Current Battery SOC", value: String(soc), unit: "%" }
        ],
        status: status,
        statusMsg: msg,
        statusLevel: level
      });
    }
  },
  {
    id: "curtailment_auditor",
    name: "Curtailment Severity Auditor",
    shortName: "Curtailment",
    description: "Evaluates curtailment events to calculate lost energy yield during grid constraints.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "ScissorsLineDashed",
    fields: [
      { id: "lostMw", label: "Clipped/Curtailment Level (MW)", type: "number", defaultValue: 6.5 },
      { id: "hours", label: "Curtailment Duration (hrs)", type: "number", defaultValue: 3.2 }
    ],
    execute: (inputs) => {
      const lost = parseFloat(inputs.lostMw) || 0;
      const hrs = parseFloat(inputs.hours) || 0;
      const energy = (lost * hrs).toFixed(2);
      return createEngineeringCard({
        title: "Curtailment Energy Audit",
        subtitle: "Grid Constraint Losses",
        metrics: [
          { label: "Curtailment Power Limit", value: String(lost), unit: "MW" },
          { label: "Duration", value: String(hrs), unit: "hours" },
          { label: "Lost Dispatched Yield", value: String(energy), unit: "MWh" }
        ],
        status: parseFloat(energy) > 15 ? "CRITICAL LIMITATION" : "NORMAL",
        statusMsg: parseFloat(energy) > 15 ? "High energy loss from grid curtailment. Investigate line thermal limits with grid operator." : "Curtailment constraints are minor.",
        statusLevel: parseFloat(energy) > 15 ? "critical" : "success"
      });
    }
  },
  {
    id: "ramp_rate_cap",
    name: "Ramp Rate Cap Checker",
    shortName: "Ramp Cap",
    description: "Checks if the rate of power change complies with maximum utility limits.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "CircleGauge",
    fields: [
      { id: "measuredRamp", label: "Measured Ramp Rate (MW/min)", type: "number", defaultValue: 9.8 }
    ],
    execute: (inputs) => {
      const ramp = parseFloat(inputs.measuredRamp) || 9.8;
      return createEngineeringCard({
        title: "Active Power Ramp Rate Limit",
        subtitle: "Ramp Rate Compliance",
        metrics: [
          { label: "Measured Ramp Rate Velocity", value: String(ramp), unit: "MW/min" },
          { label: "Feeder Code Limit", value: "10.0", unit: "MW/min" }
        ],
        status: ramp > 10.0 ? "WARNING (LIMIT EXCEEDED)" : "COMPLIANT",
        statusMsg: ramp > 10.0 ? "Ramp speed exceeds limit. Grid code violations may trigger. Increase SCADA power ramp damping variables." : "Ramp rate complies with utility boundary constraints.",
        statusLevel: ramp > 10.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "dispatch_deviation",
    name: "Dispatch Schedule Deviation",
    shortName: "Schedule Dev",
    description: "Tracks accumulated deviation from the daily power dispatch plan.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "FileText",
    fields: [
      { id: "accumulatedDev", label: "Total Deviation (MWh)", type: "number", defaultValue: 1.45 }
    ],
    execute: (inputs) => {
      const dev = parseFloat(inputs.accumulatedDev) || 0;
      return createEngineeringCard({
        title: "Cumulative Plan Mismatch",
        subtitle: "Daily Dispatch Schedule Tracking",
        metrics: [
          { label: "Accumulated Schedule Deviation", value: String(dev), unit: "MWh" },
          { label: "Maximum Allowable Daily Limit", value: "2.0", unit: "MWh" }
        ],
        status: dev > 2.0 ? "WARNING (OUT OF BOUNDS)" : "COMPLIANT",
        statusMsg: dev > 2.0 ? "Deviation exceeds 2MWh tolerance. Settlement penalties are active. Align dispatch schedule controller." : "Accumulated deviation is within safe limits.",
        statusLevel: dev > 2.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "over_injection_safeguard",
    name: "Over-injection Safeguard",
    shortName: "Over-Injection",
    description: "Evaluates site power output to verify it doesn't exceed grid connection limits.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "ShieldAlert",
    fields: [
      { id: "activeMw", label: "Site Active Power (MW)", type: "number", defaultValue: 20.45 }
    ],
    execute: (inputs) => {
      const power = parseFloat(inputs.activeMw) || 20.45;
      return createEngineeringCard({
        title: "Feeder Over-injection Check",
        subtitle: "Export Limit Safeguard",
        metrics: [
          { label: "Measured Feeder Power", value: String(power), unit: "MW" },
          { label: "PCC Contract Export Limit", value: "20.0", unit: "MW" }
        ],
        status: power > 20.0 ? "CRITICAL (OVER-EXPORT LIMIT)" : "SAFE",
        statusMsg: power > 20.0 ? "Exporting above contract limits! Grid connection breaker trip warning. Trigger immediate inverter throttle command." : "Feeder export levels comply with interconnect agreement.",
        statusLevel: power > 20.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "under_injection_recovery",
    name: "Under-injection Recovery",
    shortName: "Under-Injection",
    description: "Checks for power output deficits and schedules recovery discharging.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "RotateCcw",
    fields: [
      { id: "deficitMw", label: "Feeder Power Deficit (MW)", type: "number", defaultValue: 2.1 }
    ],
    execute: (inputs) => {
      const deficit = parseFloat(inputs.deficitMw) || 0;
      return createEngineeringCard({
        title: "Feeder Under-injection Check",
        subtitle: "Site Discharge Verification",
        metrics: [
          { label: "Feeder Deficit Power", value: String(deficit), unit: "MW" }
        ],
        status: deficit > 0.5 ? "WARNING (DEFICIT)" : "NOMINAL",
        statusMsg: deficit > 0.5 ? "Under-injecting dispatch targets. Schedule secondary battery packs online to recover output deficit." : "Power delivery is meeting schedule parameters.",
        statusLevel: deficit > 0.5 ? "warning" : "success"
      });
    }
  },
  {
    id: "peak_shaving_sched",
    name: "Peak-Shaving Scheduler",
    shortName: "Peak Shaving",
    description: "Calculates optimal battery discharge timing matching local grid peak load tariffs.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "Clock",
    fields: [
      { id: "peakStart", label: "Peak Period Start Hour", type: "number", defaultValue: 17 },
      { id: "socReserve", label: "SOC Peak Reserve (%)", type: "number", defaultValue: 95 }
    ],
    execute: (inputs) => {
      const start = parseFloat(inputs.peakStart) || 17;
      const reserve = parseFloat(inputs.socReserve) || 95;
      return createEngineeringCard({
        title: "Peak-Shaving Dispatch Scheduler",
        subtitle: "Grid Load Leveling Target",
        metrics: [
          { label: "Peak Period Start Hour", value: `${start}:00` },
          { label: "Target SOC Hold Level", value: String(reserve), unit: "%" }
        ],
        status: reserve < 80 ? "WARNING" : "OPTIMAL",
        statusMsg: reserve < 80 ? "Battery reserve SOC is low. BESS might not discharge fully during the peak tariff window." : "Sufficient energy reserve is held for peak-shaving dispatch window.",
        statusLevel: reserve < 80 ? "warning" : "success"
      });
    }
  },
  {
    id: "black_start_readiness",
    name: "Black Start Readiness",
    shortName: "Black Start",
    description: "Verifies auxiliary generator diesel and battery energy storage reserve parameters for black-start grids.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "Play",
    fields: [
      { id: "generatorFuel", label: "Diesel Fuel Level (%)", type: "number", defaultValue: 82 },
      { id: "bessSoc", label: "Emergency Reserve SOC (%)", type: "number", defaultValue: 38 }
    ],
    execute: (inputs) => {
      const fuel = parseFloat(inputs.generatorFuel) || 82;
      const soc = parseFloat(inputs.bessSoc) || 38;
      
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let title = "READY";
      let msg = "Black start emergency subsystems are online and fully fueled.";
      
      if (fuel < 50 || soc < 20) {
        lvl = 'critical';
        title = "CRITICAL UNREADY STATE";
        msg = "Emergency fuel or backup SOC is critically low! Black-start capabilities are offline. Replenish diesel fuel immediately.";
      } else if (fuel < 70 || soc < 30) {
        lvl = 'warning';
        title = "WARNING";
        msg = "Marginal backup reserve fuel level. Scheduled refueling is recommended.";
      }
      
      return createEngineeringCard({
        title: "Black-Start Reserve Audit",
        subtitle: "Grid Island Recovery Readiness Check",
        metrics: [
          { label: "Emergency Diesel Fuel Level", value: String(fuel), unit: "%" },
          { label: "Reserve Battery Energy (SOC)", value: String(soc), unit: "%" }
        ],
        status: title,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "agc_lag_calc",
    name: "AGC Lag Calculator",
    shortName: "AGC Lag",
    description: "Evaluates the latency between Automatic Generation Control (AGC) commands and site response.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "StopCircle",
    fields: [
      { id: "responseLagSec", label: "Measured Lag Time (s)", type: "number", defaultValue: 3.8 }
    ],
    execute: (inputs) => {
      const lag = parseFloat(inputs.responseLagSec) || 3.8;
      return createEngineeringCard({
        title: "AGC Power Command Latency",
        subtitle: "Grid Dispatch Telemetry Check",
        metrics: [
          { label: "AGC Command Response Lag", value: String(lag), unit: "seconds" },
          { label: "Regulatory Target Threshold", value: "4.0", unit: "seconds" }
        ],
        status: lag > 4.0 ? "WARNING (COMPLIANCE LAG)" : "COMPLIANT",
        statusMsg: lag > 4.0 ? "AGC lag exceeds 4.0s. Penalties may apply. Check SCADA communication poll rates." : "AGC command response latency complies with grid guidelines.",
        statusLevel: lag > 4.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "soc_recovery_dispatcher",
    name: "Battery SOC Recovery",
    shortName: "SOC Recovery",
    description: "Schedules low-tariff charging cycles to recover battery state-of-charge capacity.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "BatteryFull",
    fields: [
      { id: "currentSoc", label: "Active SOC (%)", type: "number", defaultValue: 14.8 },
      { id: "targetSoc", label: "Recovery Target SOC (%)", type: "number", defaultValue: 50 }
    ],
    execute: (inputs) => {
      const soc = parseFloat(inputs.currentSoc) || 15;
      const target = parseFloat(inputs.targetSoc) || 50;
      const deficit = (target - soc).toFixed(1);
      return createEngineeringCard({
        title: "State of Charge Recovery",
        subtitle: "Tariff Window Charging Schedule",
        metrics: [
          { label: "Active SOC", value: String(soc), unit: "%" },
          { label: "Target SOC Hold Level", value: String(target), unit: "%" },
          { label: "Energy Deficit Requirement", value: `${deficit}%` }
        ],
        status: soc < 15 ? "CRITICAL CHARGE REQUIRED" : "NORMAL",
        statusMsg: soc < 15 ? "Battery SOC is below critical limit (15%). Initialize emergency low-tariff charging grid draw." : "SOC holds sufficient headroom for bidirectional secondary response.",
        statusLevel: soc < 15 ? "critical" : "success"
      });
    }
  },
  {
    id: "anti_islanding_auditor",
    name: "Anti-Islanding Protection Auditor",
    shortName: "Anti-Islanding",
    description: "Verifies sub-second inverter trip times during grid disconnect events.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "Radio",
    fields: [
      { id: "tripTimeMs", label: "Measured Inverter Trip Time (ms)", type: "number", defaultValue: 85 }
    ],
    execute: (inputs) => {
      const ms = parseFloat(inputs.tripTimeMs) || 85;
      return createEngineeringCard({
        title: "Anti-Islanding Trip Speed",
        subtitle: "Substation Protection Relay Verify",
        metrics: [
          { label: "Inverter Trip Time", value: String(ms), unit: "ms" },
          { label: "Maximum Regulatory Limit", value: "2000.0", unit: "ms" }
        ],
        status: ms > 2000 ? "CRITICAL PROTECTION FAILURE" : "COMPLIANT",
        statusMsg: ms > 2000 ? "Inverter failed to trip within 2.0s limit! Grid backfeeding danger during outage. Recalibrate islanding frequency shift gains." : "Anti-islanding protection is active and highly responsive.",
        statusLevel: ms > 2000 ? "critical" : "success"
      });
    }
  },
  {
    id: "virtual_inertia",
    name: "Virtual Inertia Emulation Checker",
    shortName: "Inertia Check",
    description: "Evaluates virtual rotor mass emulation parameters in the grid-forming inverter controls.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "Globe",
    fields: [
      { id: "inertiaConstant", label: "Inertia Constant H (s)", type: "number", defaultValue: 4.2 }
    ],
    execute: (inputs) => {
      const h = parseFloat(inputs.inertiaConstant) || 4.2;
      return createEngineeringCard({
        title: "Virtual Rotor Inertia Emulation",
        subtitle: "Grid-Forming Inverter Control Loop",
        metrics: [
          { label: "Virtual Inertia Constant (H)", value: String(h), unit: "seconds" },
          { label: "Target Code Requirement", value: "3.0 - 5.0", unit: "seconds" }
        ],
        status: h < 3.0 ? "WARNING (LOW INERTIA)" : "STABLE",
        statusMsg: h < 3.0 ? "Virtual inertia is low. Grid frequency rate-of-change (RoCoF) may trigger local breaker trips. Raise emulated inertia gain." : "Virtual rotor inertia emulation matches target grid code values.",
        statusLevel: h < 3.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "dynamic_active_power",
    name: "Dynamic Active Power Control",
    shortName: "Dynamic Power",
    description: "Checks dynamic active power dispatch variables based on bus voltage levels.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "Sparkles",
    fields: [
      { id: "busVolt", label: "Feeder Bus Voltage (p.u.)", type: "number", defaultValue: 1.035 }
    ],
    execute: (inputs) => {
      const v = parseFloat(inputs.busVolt) || 1.0;
      return createEngineeringCard({
        title: "Active Power Vol-Watt Throttle",
        subtitle: "Grid Overvoltage Throttle Guard",
        metrics: [
          { label: "Measured Bus Voltage", value: String(v), unit: "p.u." },
          { label: "Volt-Watt Throttle Threshold", value: "1.03", unit: "p.u." }
        ],
        status: v > 1.03 ? "ACTIVE THROTTLING" : "NOMINAL",
        statusMsg: v > 1.03 ? "High feeder bus voltage. Inverter active output is dynamically throttled to prevent line trips." : "Feeder bus voltage is normal. Throttling is inactive.",
        statusLevel: v > 1.03 ? "warning" : "success"
      });
    }
  },
  {
    id: "synthetic_frequency",
    name: "Synthetic Frequency Droop",
    shortName: "Synthetic Droop",
    description: "Simulates synthetic frequency responses to stabilize high RoCoF events.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "Repeat",
    fields: [
      { id: "rocofVal", label: "Measured Grid RoCoF (Hz/s)", type: "number", defaultValue: 0.85 }
    ],
    execute: (inputs) => {
      const rocof = parseFloat(inputs.rocofVal) || 0.85;
      return createEngineeringCard({
        title: "Fast Synthetic Droop Injection",
        subtitle: "High RoCoF Contingency Control",
        metrics: [
          { label: "Measured Grid RoCoF (df/dt)", value: String(rocof), unit: "Hz/s" },
          { label: "FFR Response Trigger Level", value: "0.50", unit: "Hz/s" }
        ],
        status: rocof > 0.50 ? "ACTIVE FFR TRIGGERED" : "NOMINAL",
        statusMsg: rocof > 0.50 ? "High RoCoF transient event detected. Fast synthetic droop active injection triggered." : "Grid frequency rate of change is normal.",
        statusLevel: rocof > 0.50 ? "warning" : "success"
      });
    }
  },
  {
    id: "spinning_reserve_margin",
    name: "Spinning Reserve Margin",
    shortName: "Spin Margin",
    description: "Calculates available spinning reserve margins during peak demand bidding windows.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "BarChart3",
    fields: [
      { id: "activeLoad", label: "Active Dispatch Load (MW)", type: "number", defaultValue: 14 },
      { id: "capRating", label: "Inverter Continuous Rating (MW)", type: "number", defaultValue: 20 }
    ],
    execute: (inputs) => {
      const load = parseFloat(inputs.activeLoad) || 0;
      const cap = parseFloat(inputs.capRating) || 20;
      const margin = (cap - load).toFixed(1);
      return createEngineeringCard({
        title: "Spinning Reserve Margin",
        subtitle: "Feeder Peak Load Reserve Headroom",
        metrics: [
          { label: "Active Dispatch Load", value: String(load), unit: "MW" },
          { label: "Inverter Rating Limit", value: String(cap), unit: "MW" },
          { label: "Available Spinning Reserve", value: String(margin), unit: "MW" }
        ],
        status: parseFloat(margin) < 3.0 ? "WARNING (LOW RESERVES)" : "NOMINAL",
        statusMsg: parseFloat(margin) < 3.0 ? "Spinning reserve margin is tight. BESS has little headroom for frequency events." : "Available spinning reserve margins comply with peak load bidding limits.",
        statusLevel: parseFloat(margin) < 3.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "dynamic_headroom",
    name: "Dynamic Headroom Capability",
    shortName: "Dynamic Headroom",
    description: "Estimates the dynamic charge/discharge headroom available under current temperature limits.",
    category: "grid_eng",
    group: "power_dispatch",
    iconName: "ArrowUpRight",
    fields: [
      { id: "tempLimit", label: "Max Cell Temperature (°C)", type: "number", defaultValue: 41.5 }
    ],
    execute: (inputs) => {
      const temp = parseFloat(inputs.tempLimit) || 25;
      const headroom = Math.max(0, 100 - (temp - 30) * 5).toFixed(0);
      return createEngineeringCard({
        title: "Thermal Power Throttle Margin",
        subtitle: "Dynamic Thermal Derating Check",
        metrics: [
          { label: "Max Recorded Cell Temp", value: String(temp), unit: "°C" },
          { label: "Thermal Power Headroom", value: `${headroom}%` }
        ],
        status: parseFloat(headroom) < 50 ? "WARNING (THERMAL THROTTLING)" : "NOMINAL",
        statusMsg: parseFloat(headroom) < 50 ? "Thermal limit restricts maximum power dispatch. Inverters will derate active output by 50%." : "Batteries are operating within optimal temperature bands.",
        statusLevel: parseFloat(headroom) < 50 ? "warning" : "success"
      });
    }
  },

  // ==========================================
  // TAB 3: Safety & Protection -> Group: Thermal Safety (10 tools)
  // ==========================================
  {
    id: "thermal_runaway_predictor",
    name: "Thermal Runaway Predictor",
    shortName: "Runaway Risk",
    description: "Evaluates temperature rise velocity (dT/dt) in modules to flag potential thermal runaway risks.",
    category: "safety_diag",
    group: "thermal_safety",
    iconName: "FlameKindling",
    fields: [
      { id: "tempRise", label: "Temp Rise Velocity (°C/min)", type: "number", defaultValue: 2.1 },
      { id: "maxTemp", label: "Peak Cell Temp (°C)", type: "number", defaultValue: 46.8 }
    ],
    execute: (inputs) => {
      const rise = parseFloat(inputs.tempRise) || 0;
      const temp = parseFloat(inputs.maxTemp) || 25;
      
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let status = 'SAFE';
      let msg = 'Thermal dynamics are within normal operational limits.';
      
      if (rise > 1.5 || temp > 55) {
        lvl = 'critical';
        status = 'CRITICAL THERMAL RUNAWAY RISK';
        msg = 'CRITICAL ALERT: Rapid cell heating detected. Thermal runaway threshold breached. Trigger automatic gaseous fire suppression venting loops immediately!';
      } else if (rise > 0.5 || temp > 45) {
        lvl = 'warning';
        status = 'HIGH TEMP WARNING';
        msg = 'High cell heating rate. Chillers set to maximum output. Power output throttled to 30%.';
      }
      
      return createEngineeringCard({
        title: "🔥 Thermal Runaway Diagnostics",
        subtitle: "Hazard Prevention Audit",
        metrics: [
          { label: "Temp Rise Velocity (dT/dt)", value: String(rise), unit: "°C/min" },
          { label: "Peak Cell Temp", value: String(temp), unit: "°C" },
          { label: "Venting Trigger Threshold", value: "2.0 °C/min or 55 °C" }
        ],
        status: status,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "venting_gas_analyzer",
    name: "Venting Gas Analyzer",
    shortName: "Gas Sensor",
    description: "Audits VOC and off-gas detector readings inside the battery cabinet.",
    category: "safety_diag",
    group: "thermal_safety",
    iconName: "Tornado",
    fields: [
      { id: "vocPpm", label: "VOC Concentration (PPM)", type: "number", defaultValue: 8.5 }
    ],
    execute: (inputs) => {
      const voc = parseFloat(inputs.vocPpm) || 0;
      return createEngineeringCard({
        title: "Off-gas VOC Sensor Audit",
        subtitle: "Enclosure Internal Gas Concentration",
        metrics: [
          { label: "VOC Concentration", value: String(voc), unit: "PPM" },
          { label: "Venting Safety Limit", value: "25.0", unit: "PPM" }
        ],
        status: voc > 25.0 ? "CRITICAL (OFF-GAS DETECTED)" : "CLEAN",
        statusMsg: voc > 25.0 ? "Dangerous gas buildup! Battery cell venting or electrolyte leak occurred. Trip cabinet breaker and purge cabinet air." : "Gas sensors indicate zero volatile leaks or cell off-gassing.",
        statusLevel: voc > 25.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "hotspot_temp_check",
    name: "Hotspot Temp Boundary Check",
    shortName: "Hotspot Check",
    description: "Evaluates temperature profiles to detect cell-to-cell hotspots.",
    category: "safety_diag",
    group: "thermal_safety",
    iconName: "ThermometerSnowflake",
    fields: [
      { id: "hotspotT", label: "Max Hotspot Temp (°C)", type: "number", defaultValue: 41.5 }
    ],
    execute: (inputs) => {
      const temp = parseFloat(inputs.hotspotT) || 25;
      return createEngineeringCard({
        title: "Cell Hotspot Assessment",
        subtitle: "Cabinet Thermal Safety Check",
        metrics: [
          { label: "Max Hotspot Temp", value: String(temp), unit: "°C" },
          { label: "Shutdown Limit Threshold", value: "50.0", unit: "°C" }
        ],
        status: temp > 45.0 ? "WARNING (HIGH TEMP)" : "SAFE",
        statusMsg: temp > 45.0 ? "Cell hotspot exceeds 45°C. Cooling loop airflow is inadequate. Reduce continuous C-rate." : "Cell temperature profiles are safe and stable.",
        statusLevel: temp > 45.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "thermal_profile_analyzer",
    name: "Thermal Delta Balancer",
    shortName: "Thermal Balance",
    description: "Compares maximum and minimum pack temperatures and reports balanced thermal states.",
    category: "safety_diag",
    group: "thermal_safety",
    iconName: "MapPin",
    fields: [
      { id: "maxT", label: "Max Module Temp (°C)", type: "number", defaultValue: 34.2 },
      { id: "minT", label: "Min Module Temp (°C)", type: "number", defaultValue: 28.5 }
    ],
    execute: (inputs) => {
      const max = parseFloat(inputs.maxT) || 25;
      const min = parseFloat(inputs.minT) || 25;
      const delta = (max - min).toFixed(1);
      
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let status = "BALANCED";
      let msg = "Cabinet thermal variance is balanced.";
      
      if (parseFloat(delta) > 5) {
        lvl = 'warning';
        status = "HIGH THERMAL DELTA";
        msg = "Thermal unbalance detected. Cabinet HVAC fan layout balance requires check.";
      }
      
      return createEngineeringCard({
        title: "Thermal Balance Audit",
        subtitle: "Battery Module Thermal Gradient Check",
        metrics: [
          { label: "Max Module Temp", value: String(max), unit: "°C" },
          { label: "Min Module Temp", value: String(min), unit: "°C" },
          { label: "Thermal Delta (ΔT)", value: String(delta), unit: "°C" }
        ],
        status: status,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "fire_suppression_check",
    name: "Fire Suppression System Check",
    shortName: "Fire Safety",
    description: "Checks pressure level of gaseous fire suppression bottles (Novec/FM200).",
    category: "safety_diag",
    group: "thermal_safety",
    iconName: "ShieldCheck",
    fields: [
      { id: "bottlePressure", label: "Suppressor Pressure (bar)", type: "number", defaultValue: 24.8 }
    ],
    execute: (inputs) => {
      const pressure = parseFloat(inputs.bottlePressure) || 24.8;
      return createEngineeringCard({
        title: "Gaseous Fire Suppressor Pressure",
        subtitle: "FM200 / Novec-1230 System Audit",
        metrics: [
          { label: "Suppressor Bottle Pressure", value: String(pressure), unit: "bar" },
          { label: "Nominal Target Range", value: "22.0 - 26.0", unit: "bar" }
        ],
        status: pressure < 20.0 ? "CRITICAL (PRESSURE LOSS)" : "NOMINAL",
        statusMsg: pressure < 20.0 ? "Suppressor pressure is low! Fire system containment might fail during thermal runaway event. Refill gaseous tanks." : "Suppressor containment pressure complies with NFPA-855 safety guidelines.",
        statusLevel: pressure < 20.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "cabinet_temp_gradient",
    name: "Cabinet Temp Gradient",
    shortName: "Cab Gradient",
    description: "Evaluates temperature delta between top and bottom layers of the module stack.",
    category: "safety_diag",
    group: "thermal_safety",
    iconName: "Mountain",
    fields: [
      { id: "topT", label: "Top Stack Temp (°C)", type: "number", defaultValue: 33.5 },
      { id: "bottomT", label: "Bottom Stack Temp (°C)", type: "number", defaultValue: 26.1 }
    ],
    execute: (inputs) => {
      const top = parseFloat(inputs.topT) || 30;
      const bottom = parseFloat(inputs.bottomT) || 26;
      const delta = (top - bottom).toFixed(1);
      return createEngineeringCard({
        title: "Vertical Thermal Gradient",
        subtitle: "Cabinet Air Layer Stack Audit",
        metrics: [
          { label: "Top Stack Temperature", value: String(top), unit: "°C" },
          { label: "Bottom Stack Temperature", value: String(bottom), unit: "°C" },
          { label: "Vertical Delta (ΔT)", value: String(delta), unit: "°C" }
        ],
        status: parseFloat(delta) > 6.0 ? "WARNING (HIGH GRADIENT)" : "NOMINAL",
        statusMsg: parseFloat(delta) > 6.0 ? "Vertical gradient is too high. Hot air accumulates at top stack. Enable secondary exhaust boosters." : "Vertical cabinet air circulation is nominal.",
        statusLevel: parseFloat(delta) > 6.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "ground_fault_detector",
    name: "Ground Fault Detection",
    shortName: "GFD System",
    description: "Monitors DC link insulation leakage currents to locate ground faults.",
    category: "safety_diag",
    group: "thermal_safety",
    iconName: "Unplug",
    fields: [
      { id: "leakageCurrent", label: "Leakage Current (mA)", type: "number", defaultValue: 1.2 }
    ],
    execute: (inputs) => {
      const leak = parseFloat(inputs.leakageCurrent) || 0;
      return createEngineeringCard({
        title: "DC Link Insulation Leakage",
        subtitle: "Ground Fault Safety Auditor",
        metrics: [
          { label: "DC Leakage Current", value: String(leak), unit: "mA" },
          { label: "Insulation Leak Safety Limit", value: "10.0", unit: "mA" }
        ],
        status: leak > 10.0 ? "CRITICAL (GROUND FAULT)" : "SAFE",
        statusMsg: leak > 10.0 ? "DC Link insulation breakdown! Positive or Negative terminal leakage to frame chassis. Halt dispatch immediately." : "Insulation leakage currents are within safe thresholds.",
        statusLevel: leak > 10.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "insulation_resistance",
    name: "Insulation Resistance Audit",
    shortName: "Insulation Check",
    description: "Evaluates insulation resistance between high-voltage busbar and enclosure chassis.",
    category: "safety_diag",
    group: "thermal_safety",
    iconName: "Layers",
    fields: [
      { id: "resistanceMohm", label: "Insulation Resistance (MΩ)", type: "number", defaultValue: 85 }
    ],
    execute: (inputs) => {
      const res = parseFloat(inputs.resistanceMohm) || 85;
      return createEngineeringCard({
        title: "HV DC Busbar Insulation Resistance",
        subtitle: "Insulation Barrier Health",
        metrics: [
          { label: "Insulation Resistance", value: String(res), unit: "MΩ" },
          { label: "Minimum Safety Limit", value: "2.0", unit: "MΩ" }
        ],
        status: res < 2.0 ? "CRITICAL (INSULATION RETRACTED)" : "HEALTHY",
        statusMsg: res < 2.0 ? "Insulation barrier resistance is below critical 2MΩ limit! High risk of short circuit and shock hazards." : "High voltage busbar insulation resistance is healthy.",
        statusLevel: res < 2.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "overcurrent_margin",
    name: "Overcurrent Protection Margin",
    shortName: "Overcurrent",
    description: "Calculates the dynamic load margin before the feeder breaker overcurrent trip activates.",
    category: "safety_diag",
    group: "thermal_safety",
    iconName: "MoveUp",
    fields: [
      { id: "peakCurrent", label: "Peak Load Current (A)", type: "number", defaultValue: 2150 },
      { id: "breakerTrip", label: "Breaker Trip Rating (A)", type: "number", defaultValue: 2500 }
    ],
    execute: (inputs) => {
      const peak = parseFloat(inputs.peakCurrent) || 0;
      const trip = parseFloat(inputs.breakerTrip) || 2500;
      const marginVal = trip - peak;
      const margin = marginVal.toFixed(0);
      const marginPct = ((marginVal / trip) * 100).toFixed(1);
      return createEngineeringCard({
        title: "Feeder Breaker Overcurrent Margin",
        subtitle: "Overcurrent Trip Safety Margin",
        metrics: [
          { label: "Measured Peak Current", value: String(peak), unit: "A" },
          { label: "Breaker Trip Threshold", value: String(trip), unit: "A" },
          { label: "Trip Margin Headroom", value: String(margin), unit: "A" },
          { label: "Margin Percentage", value: `${marginPct}%` }
        ],
        status: parseFloat(marginPct) < 15.0 ? "WARNING (TRIP MARGIN TIGHT)" : "SAFE",
        statusMsg: parseFloat(marginPct) < 15.0 ? "Feeder current approaches trip setting. Peak active power discharge ramp rate must be limited." : "Breaker overcurrent headroom margin is healthy.",
        statusLevel: parseFloat(marginPct) < 15.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "short_circuit_fault",
    name: "Short Circuit Fault Level",
    shortName: "Fault Level",
    description: "Estimates prospective short circuit fault currents based on grid connection impedance.",
    category: "safety_diag",
    group: "thermal_safety",
    iconName: "OctagonX",
    fields: [
      { id: "faultCurrentKa", label: "Prospective Fault (kA)", type: "number", defaultValue: 14.8 }
    ],
    execute: (inputs) => {
      const fault = parseFloat(inputs.faultCurrentKa) || 14.8;
      return createEngineeringCard({
        title: "Prospective Short Circuit Fault Level",
        subtitle: "Feeder Protection Breaker Breaking Capacity Check",
        metrics: [
          { label: "Prospective Fault Current", value: String(fault), unit: "kA" },
          { label: "Breaker Breaking Capacity Limit", value: "25.0", unit: "kA" }
        ],
        status: fault > 25.0 ? "CRITICAL (OVER-CAPACITY FAULT)" : "SAFE",
        statusMsg: fault > 25.0 ? "Prospective short circuit current exceeds breaker breaking capacity! Breaker may explode during a fault. Upgrade breaker." : "Breaker breaking capacity is nominal.",
        statusLevel: fault > 25.0 ? "critical" : "success"
      });
    }
  },

  // ==========================================
  // TAB 3: Safety & Protection -> Group: Protection Systems (10 tools)
  // ==========================================
  {
    id: "surge_protection_check",
    name: "Surge Protective Device Check",
    shortName: "SPD Audit",
    description: "Verifies state and health parameters of surge arrestors on MV/LV feeders.",
    category: "safety_diag",
    group: "protection_systems",
    iconName: "ShieldPlus",
    fields: [
      { id: "spdLeakage", label: "SPD Leakage Current (μA)", type: "number", defaultValue: 14.5 }
    ],
    execute: (inputs) => {
      const leak = parseFloat(inputs.spdLeakage) || 14.5;
      return createEngineeringCard({
        title: "Surge Protective Device Audit",
        subtitle: "Arrestor insulation leakage",
        metrics: [
          { label: "SPD Leakage Current", value: String(leak), unit: "μA" },
          { label: "Replacement Threshold", value: "100.0", unit: "μA" }
        ],
        status: leak > 100.0 ? "CRITICAL (SPD BLOWN)" : "HEALTHY",
        statusMsg: leak > 100.0 ? "Surge arrestor leakage current indicates breakdown. Varistor is damaged. Replace SPD cartridge immediately." : "Surge protective devices are active and healthy.",
        statusLevel: leak > 100.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "arc_flash_boundary",
    name: "Arc Flash Hazard Boundary",
    shortName: "Arc Flash",
    description: "Calculates the dynamic flash protection boundary for safe maintenance access.",
    category: "safety_diag",
    group: "protection_systems",
    iconName: "Crosshair",
    fields: [
      { id: "energyLevel", label: "Incident Energy (cal/cm²)", type: "number", defaultValue: 4.8 }
    ],
    execute: (inputs) => {
      const energy = parseFloat(inputs.energyLevel) || 4.8;
      // boundary approx: d = sqrt(4.184 * energy)
      const boundary = (Math.sqrt(4.184 * energy) * 0.3048).toFixed(2);
      return createEngineeringCard({
        title: "Arc Flash Hazard Boundary",
        subtitle: "NFPA-70E Maintenance Safe Access Check",
        metrics: [
          { label: "Incident Energy Level", value: String(energy), unit: "cal/cm²" },
          { label: "Flash Protection Boundary", value: String(boundary), unit: "meters" }
        ],
        status: energy > 8.0 ? "CRITICAL (CAT 3 PPE REQUIRED)" : "NOMINAL (CAT 2 PPE)",
        statusMsg: energy > 8.0 ? "Incident energy exceeds 8 cal/cm². Heavy blast PPE suit is mandatory for cabinet open access." : "Maintenance boundaries require standard category 2 blast clothing protection.",
        statusLevel: energy > 8.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "fault_severity_lookup",
    name: "Fault Severity Level Lookup",
    shortName: "Fault Severity",
    description: "Checks registered SCADA alarm codes to determine severity metrics.",
    category: "safety_diag",
    group: "protection_systems",
    iconName: "ListChecks",
    fields: [
      { id: "faultCode", label: "SCADA Alarm Code", type: "text", defaultValue: "F_PCS_042" }
    ],
    execute: (inputs) => {
      const code = inputs.faultCode || "F_PCS_042";
      
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let title = "INFO";
      let msg = "Alarm code represents minor telemetry logs. Self-clear is expected.";
      
      if (code.includes("F_PCS_") || code.includes("F_BMS_CRIT")) {
        lvl = 'critical';
        title = "CRITICAL STOP SHUTDOWN";
        msg = "Alarm indicates power semiconductor or cell over-voltage hardware shutdown. Site check mandatory.";
      } else if (code.includes("F_HVAC_")) {
        lvl = 'warning';
        title = "ENVIRONMENTAL WARNING";
        msg = "Climate chiller controller alerts low gas. Efficiency derate warning.";
      }
      
      return createEngineeringCard({
        title: "SCADA Alarm Severity Lookup",
        subtitle: "Feeder Control System Fault Map",
        metrics: [
          { label: "Registered Alarm Code", value: code }
        ],
        status: title,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "maintenance_overdue",
    name: "Maintenance Overdue Alarm",
    shortName: "Maintenance",
    description: "Calculates the days remaining before the next scheduled cabinet hardware inspection.",
    category: "safety_diag",
    group: "protection_systems",
    iconName: "ClipboardX",
    fields: [
      { id: "lastMaintDays", label: "Days Since Inspection", type: "number", defaultValue: 185 }
    ],
    execute: (inputs) => {
      const days = parseFloat(inputs.lastMaintDays) || 0;
      const margin = 180 - days;
      return createEngineeringCard({
        title: "Cabinet Hardware Inspection Audit",
        subtitle: "Scheduled Maintenance Cycles",
        metrics: [
          { label: "Days Since Last Audit", value: String(days), unit: "days" },
          { label: "Standard Maintenance Window", value: "180", unit: "days" },
          { label: "Days Overdue Margin", value: String(Math.abs(margin)), unit: "days" }
        ],
        status: margin < 0 ? "CRITICAL (MAINTENANCE OVERDUE)" : "HEALTHY",
        statusMsg: margin < 0 ? "Site hardware inspection window has expired. Terminal torque checks and filter cleans are overdue." : "Site complies with planned maintenance schedules.",
        statusLevel: margin < 0 ? "critical" : "success"
      });
    }
  },
  {
    id: "sensor_drift_diag",
    name: "Sensor Drift Diagnostic",
    shortName: "Sensor Drift",
    description: "Evaluates SCADA and local BMS analog temperature channel readings to identify drift.",
    category: "safety_diag",
    group: "protection_systems",
    iconName: "ScanLine",
    fields: [
      { id: "scadaTemp", label: "SCADA Temperature (°C)", type: "number", defaultValue: 28.5 },
      { id: "bmsTemp", label: "BMS Local Sensor (°C)", type: "number", defaultValue: 26.2 }
    ],
    execute: (inputs) => {
      const scada = parseFloat(inputs.scadaTemp) || 0;
      const bms = parseFloat(inputs.bmsTemp) || 0;
      const drift = Math.abs(scada - bms).toFixed(1);
      return createEngineeringCard({
        title: "Analog Sensor Drift Audit",
        subtitle: "SCADA vs Local BMS Calibration Check",
        metrics: [
          { label: "SCADA Telemetry Reading", value: String(scada), unit: "°C" },
          { label: "BMS Local Sensor Reading", value: String(bms), unit: "°C" },
          { label: "Measured Drift Variance", value: String(drift), unit: "°C" }
        ],
        status: parseFloat(drift) > 2.0 ? "WARNING (DRIFT DETECTED)" : "NOMINAL",
        statusMsg: parseFloat(drift) > 2.0 ? "Sensor calibration mismatch exceeds 2°C limits. Re-calibrate analog temperature channel modules." : "Sensor drift variance is within bounds.",
        statusLevel: parseFloat(drift) > 2.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "emergency_estop_check",
    name: "Emergency E-Stop Check",
    shortName: "E-Stop Status",
    description: "Verifies the continuity and status of the hardware Emergency E-Stop loop.",
    category: "safety_diag",
    group: "protection_systems",
    iconName: "Hand",
    fields: [
      { id: "loopResistance", label: "E-Stop Loop Resistance (Ω)", type: "number", defaultValue: 4.8 }
    ],
    execute: (inputs) => {
      const res = parseFloat(inputs.loopResistance) || 4.8;
      return createEngineeringCard({
        title: "Hardware E-Stop Loop Continuity",
        subtitle: "Safety Circuit Resistance Check",
        metrics: [
          { label: "E-Stop Loop Resistance", value: String(res), unit: "Ω" },
          { label: "Maximum Allowable Resistance", value: "10.0", unit: "Ω" }
        ],
        status: res > 10.0 ? "CRITICAL (E-STOP OPEN LOOP)" : "NOMINAL",
        statusMsg: res > 10.0 ? "Emergency E-Stop loop shows open-circuit high resistance! Loop is broken. Shutdown triggers may fail. Locate open contact." : "E-Stop loop continuity is healthy and closed.",
        statusLevel: res > 10.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "intruder_interlock",
    name: "Enclosure Door Interlock Check",
    shortName: "Door Intruder",
    description: "Checks door limit switch status to identify enclosure open-door access hazards.",
    category: "safety_diag",
    group: "protection_systems",
    iconName: "Lock",
    fields: [
      { id: "doorStatus", label: "Enclosure Door Status", type: "select", defaultValue: "Closed & Locked", options: ["Closed & Locked", "Open (Maintenance)", "Open (Intruder)"] }
    ],
    execute: (inputs) => {
      const door = inputs.doorStatus || "Closed & Locked";
      
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let title = "NOMINAL";
      let msg = "All cabinet enclosure doors are locked and sealed.";
      
      if (door.includes("Intruder")) {
        lvl = 'critical';
        title = "SECURITY CRITICAL ALERT";
        msg = "Intruder Alert! Enclosure door opened without badge entry authorization. Alarm dispatched to local station.";
      } else if (door.includes("Maintenance")) {
        lvl = 'warning';
        title = "MAINTENANCE OPEN";
        msg = "Door limit switch open. Cabinet HVAC cooling is derated during maintenance access.";
      }
      
      return createEngineeringCard({
        title: "Enclosure Access Security Check",
        subtitle: "Enclosure Interlock Loop",
        metrics: [
          { label: "Enclosure Door Status", value: door }
        ],
        status: title,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "bms_communication_loss",
    name: "BMS Comm Loss Diagnostic",
    shortName: "Comm Health",
    description: "Evaluates packet loss ratios on the Modbus TCP bus between BMS master and SCADA.",
    category: "safety_diag",
    group: "protection_systems",
    iconName: "WifiOff",
    fields: [
      { id: "packetLoss", label: "Telemetry Packet Loss (%)", type: "number", defaultValue: 0.12 }
    ],
    execute: (inputs) => {
      const loss = parseFloat(inputs.packetLoss) || 0;
      return createEngineeringCard({
        title: "BMS to SCADA Modbus Communication",
        subtitle: "Modbus TCP Packet Loss Audit",
        metrics: [
          { label: "Measured Packet Loss Ratio", value: String(loss), unit: "%" },
          { label: "Maximum Allowable Limit", value: "1.0", unit: "%" }
        ],
        status: loss > 1.0 ? "CRITICAL (COMM FAILING)" : "HEALTHY",
        statusMsg: loss > 1.0 ? "Modbus TCP communication loss exceeds 1.0% limits. SCADA response latency will increase. Check network switch cables." : "Modbus communication link is operating cleanly.",
        statusLevel: loss > 1.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "high_voltage_interlock",
    name: "HV Interlock Loop Audit",
    shortName: "HVIL Status",
    description: "Evaluates High Voltage Interlock Loop (HVIL) signal integrity.",
    category: "safety_diag",
    group: "protection_systems",
    iconName: "TriangleAlert",
    fields: [
      { id: "hvilVolt", label: "HVIL Circuit Voltage (V)", type: "number", defaultValue: 4.8 }
    ],
    execute: (inputs) => {
      const volt = parseFloat(inputs.hvilVolt) || 4.8;
      return createEngineeringCard({
        title: "HVIL Signal Integrity Audit",
        subtitle: "High Voltage Interlock Safety Circuit",
        metrics: [
          { label: "HVIL Circuit Voltage", value: String(volt), unit: "V" },
          { label: "Target Closed Signal Voltage", value: "5.0", unit: "V" }
        ],
        status: volt < 4.0 ? "CRITICAL (HVIL BROKEN)" : "NOMINAL",
        statusMsg: volt < 4.0 ? "HVIL voltage signal has dropped! Connector cover open or cable cut detected. Disconnect HV bus contactors." : "HVIL safety loop is closed and operational.",
        statusLevel: volt < 4.0 ? "critical" : "success"
      });
    }
  },
  {
    id: "breaker_aux_contact",
    name: "Breaker Aux Contact Status",
    shortName: "Breaker Contact",
    description: "Audits feedback status lines from secondary contacts to identify breaker state mismatch.",
    category: "safety_diag",
    group: "protection_systems",
    iconName: "Contact",
    fields: [
      { id: "breakerStatus", label: "Breaker SCADA Feedback", type: "select", defaultValue: "Closed", options: ["Closed", "Open", "Tripped (Overcurrent)"] }
    ],
    execute: (inputs) => {
      const status = inputs.breakerStatus || "Closed";
      
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let title = "NOMINAL";
      let msg = "Breaker aux feedback matches target switch parameters.";
      
      if (status.includes("Tripped")) {
        lvl = 'critical';
        title = "CRITICAL BREAKER FAULT";
        msg = "Feeder breaker tripped under load! Lockout active. Manual breaker reset and insulation test required.";
      } else if (status.includes("Open")) {
        lvl = 'warning';
        title = "BREAKER DISCONNECTED";
        msg = "Breaker aux feedback reports switch is open. Feeder line is offline.";
      }
      
      return createEngineeringCard({
        title: "Feeder Breaker Switch Status",
        subtitle: "Aux Contact Telemetry Verification",
        metrics: [
          { label: "Breaker SCADA Feedback", value: status }
        ],
        status: title,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },

  // ==========================================
  // TAB 3: Safety & Protection -> Group: Alarms & Checklists (11 tools)
  // ==========================================
  {
    id: "active_alarm_matrix",
    name: "Active Alarm Matrix",
    shortName: "Alarms Grid",
    description: "Evaluates current active alarm codes from SCADA and BMS, displaying priority rankings.",
    category: "safety_diag",
    group: "alarms_checklists",
    iconName: "Bell",
    fields: [
      { id: "criticalAlarms", label: "Critical Alarms Count", type: "number", defaultValue: 0 },
      { id: "warningAlarms", label: "Warning Alarms Count", type: "number", defaultValue: 2 }
    ],
    execute: (inputs) => {
      const crit = parseFloat(inputs.criticalAlarms) || 0;
      const warn = parseFloat(inputs.warningAlarms) || 0;
      
      let level: 'success' | 'warning' | 'critical' = 'success';
      let text = 'NO ACTIVE CRITICALS';
      let msg = 'System is operating safely. Attend warning logs during weekly site review.';
      
      if (crit > 0) {
        level = 'critical';
        text = 'CRITICAL ALARMS ACTIVE';
        msg = `CRITICAL ALERT: ${crit} high-priority alarms require immediate SCADA operator response. Automatic shutdown loops are armed.`;
      } else if (warn > 3) {
        level = 'warning';
        text = 'ALARM CONGESTION';
        msg = 'High volume of warnings. Check communication bus delays or sensor health profiles.';
      }
      
      return createEngineeringCard({
        title: "⚡ Active Alarm Severity Matrix",
        subtitle: "Feeder Control SCADA Diagnostics",
        metrics: [
          { label: "Active Critical Alarms", value: String(crit) },
          { label: "Active Warning Alarms", value: String(warn) },
          { label: "Total Active Codes", value: String(crit + warn) }
        ],
        status: text,
        statusMsg: msg,
        statusLevel: level
      });
    }
  },
  {
    id: "smoke_detector_test",
    name: "Cabinet Smoke Detector Test",
    shortName: "Smoke Check",
    description: "Audits photoelectric smoke detector sensor voltage levels inside BESS cabinets.",
    category: "safety_diag",
    group: "alarms_checklists",
    iconName: "AlertOctagon",
    fields: [
      { id: "smokeVolt", label: "Smoke Sensor output (V)", type: "number", defaultValue: 0.25 }
    ],
    execute: (inputs) => {
      const volt = parseFloat(inputs.smokeVolt) || 0.25;
      return createEngineeringCard({
        title: "Photoelectric Smoke Sensor",
        subtitle: "VESDA Smoke Detection Audit",
        metrics: [
          { label: "Smoke Sensor Voltage", value: String(volt), unit: "V" },
          { label: "Smoke Alarm Threshold", value: "1.50", unit: "V" }
        ],
        status: volt > 1.50 ? "CRITICAL (SMOKE ALARM ACTIVE)" : "NOMINAL",
        statusMsg: volt > 1.50 ? "Smoke detected inside cabinet! Fire containment armed. Emergency venting fans starting." : "Smoke detector registers zero particulate smoke concentration.",
        statusLevel: volt > 1.50 ? "critical" : "success"
      });
    }
  },
  {
    id: "weekly_visual_safety",
    name: "Weekly Visual Safety checklist",
    shortName: "Visual Safety",
    description: "Evaluates checks for structural seals, liquid leaks, and cabinet door seals.",
    category: "safety_diag",
    group: "alarms_checklists",
    iconName: "ClipboardList",
    fields: [
      { id: "doorSeals", label: "Door Seals Intact?", type: "select", defaultValue: "Yes", options: ["Yes", "No"] },
      { id: "chillerLeaks", label: "Chiller Leaks Visible?", type: "select", defaultValue: "No", options: ["Yes", "No"] }
    ],
    execute: (inputs) => {
      const seals = inputs.doorSeals || "Yes";
      const leaks = inputs.chillerLeaks || "No";
      
      let lvl: 'success' | 'critical' = 'success';
      let title = "PASSED";
      let msg = "Weekly visual safety checklist passed successfully.";
      
      if (seals === 'No' || leaks === 'Yes') {
        lvl = 'critical';
        title = "CHECKLIST FAILED";
        msg = "Visual checks failed. Door seals are damaged or chiller leaks detected. Issue site maintenance work order.";
      }
      
      return createEngineeringCard({
        title: "Weekly Site Visual Checklist",
        subtitle: "Visual Maintenance Audit",
        metrics: [
          { label: "Cabinet Door Seals Intact", value: seals },
          { label: "Chiller Hydraulic Leaks", value: leaks }
        ],
        status: title,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "ups_battery_health",
    name: "UPS Backup Battery Health",
    shortName: "UPS Audit",
    description: "Checks backup Uninterruptible Power Supply (UPS) state-of-charge and battery health.",
    category: "safety_diag",
    group: "alarms_checklists",
    iconName: "Power",
    fields: [
      { id: "upsSoc", label: "UPS Battery SOC (%)", type: "number", defaultValue: 98 },
      { id: "upsSoh", label: "UPS Battery SOH (%)", type: "number", defaultValue: 82 }
    ],
    execute: (inputs) => {
      const soc = parseFloat(inputs.upsSoc) || 100;
      const soh = parseFloat(inputs.upsSoh) || 100;
      return createEngineeringCard({
        title: "UPS Backup Power System",
        subtitle: "Secondary DC Controller Supply Check",
        metrics: [
          { label: "UPS Battery State of Charge", value: String(soc), unit: "%" },
          { label: "UPS Battery State of Health", value: String(soh), unit: "%" }
        ],
        status: (soc < 90 || soh < 80) ? "WARNING (UPS DEGRADED)" : "HEALTHY",
        statusMsg: (soc < 90 || soh < 80) ? "UPS backup system is compromised. Battery replacement recommended to ensure control system runtime during outage." : "UPS backup batteries are fully charged and healthy.",
        statusLevel: (soc < 90 || soh < 80) ? "warning" : "success"
      });
    }
  },
  {
    id: "exhaust_fan_vent_audit",
    name: "Exhaust Fan Vent Audit",
    shortName: "Exhaust Vent",
    description: "Evaluates cabinet purge and exhaust fan ventilation operation checks.",
    category: "safety_diag",
    group: "alarms_checklists",
    iconName: "HardDrive",
    fields: [
      { id: "fanRpm", label: "Exhaust Fan RPM", type: "number", defaultValue: 2150 }
    ],
    execute: (inputs) => {
      const rpm = parseFloat(inputs.fanRpm) || 0;
      return createEngineeringCard({
        title: "Cabinet Purge Exhaust Fan",
        subtitle: "Air Vent purge flow check",
        metrics: [
          { label: "Exhaust Fan Speed", value: String(rpm), unit: "RPM" },
          { label: "Minimum Target Speed", value: "1800", unit: "RPM" }
        ],
        status: rpm < 1800 ? "WARNING (LOW SPEED)" : "NOMINAL",
        statusMsg: rpm < 1800 ? "Exhaust fan RPM is low. Exhaust fan motor degradation detected. Check bearings and power wiring." : "Purge exhaust speed provides nominal air evacuation rate.",
        statusLevel: rpm < 1800 ? "warning" : "success"
      });
    }
  },
  {
    id: "humidity_safety_check",
    name: "Relative Humidity Safety Check",
    shortName: "Humidity Audit",
    description: "Tracks Relative Humidity (RH) levels inside the battery modules.",
    category: "safety_diag",
    group: "alarms_checklists",
    iconName: "CloudDrizzle",
    fields: [
      { id: "rhPercentage", label: "Module Humidity Level (%)", type: "number", defaultValue: 58 }
    ],
    execute: (inputs) => {
      const rh = parseFloat(inputs.rhPercentage) || 58;
      return createEngineeringCard({
        title: "Cabinet Relative Humidity Audit",
        subtitle: "Module Corrosion Prevention Check",
        metrics: [
          { label: "Measured Module Humidity", value: String(rh), unit: "%" },
          { label: "Safe Maximum Limit", value: "70", unit: "%" }
        ],
        status: rh > 70 ? "WARNING (HIGH HUMIDITY)" : "SAFE",
        statusMsg: rh > 70 ? "High humidity detected. Accelerated busbar corrosion risks. Adjust HVAC climate control dryer loop parameters." : "Module humidity levels are safe and dry.",
        statusLevel: rh > 70 ? "warning" : "success"
      });
    }
  },
  {
    id: "weekly_estop_log",
    name: "Weekly E-Stop Log Check",
    shortName: "E-Stop Check",
    description: "Evaluates checks for testing the Emergency E-stop loop monthly.",
    category: "safety_diag",
    group: "alarms_checklists",
    iconName: "FileWarning",
    fields: [
      { id: "lastTestDays", label: "Days Since E-Stop Test", type: "number", defaultValue: 24 }
    ],
    execute: (inputs) => {
      const days = parseFloat(inputs.lastTestDays) || 0;
      return createEngineeringCard({
        title: "Monthly E-Stop Loop Verification",
        subtitle: "Safety Circuit Maintenance Audit",
        metrics: [
          { label: "Days Since Last Test", value: String(days), unit: "days" },
          { label: "Standard Testing Interval", value: "30", unit: "days" }
        ],
        status: days > 30 ? "CRITICAL (TEST OVERDUE)" : "PASSED",
        statusMsg: days > 30 ? "Monthly E-Stop loop test is overdue. Schedule hardware dry-contact simulation test." : "E-Stop loop checks are compliant.",
        statusLevel: days > 30 ? "critical" : "success"
      });
    }
  },
  {
    id: "insulation_leakage_history",
    name: "Insulation Leakage History",
    shortName: "Insulation Log",
    description: "Profiles insulation resistance historical averages over time.",
    category: "safety_diag",
    group: "alarms_checklists",
    iconName: "FileClock",
    fields: [
      { id: "historicalAvg", label: "Insulation Resist Average (MΩ)", type: "number", defaultValue: 14.5 }
    ],
    execute: (inputs) => {
      const avg = parseFloat(inputs.historicalAvg) || 14.5;
      return createEngineeringCard({
        title: "Insulation Barrier Leak History",
        subtitle: "Insulation Resistance Log",
        metrics: [
          { label: "Historical Resistance Average", value: String(avg), unit: "MΩ" }
        ],
        status: avg < 10.0 ? "WARNING (DEGRADATION TREND)" : "STABLE",
        statusMsg: avg < 10.0 ? "Insulation barrier shows degradation over past audits. Clean dust build-up on busbar insulators." : "Insulation resistance values are stable.",
        statusLevel: avg < 10.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "surge_arrestor_log",
    name: "Surge Arrestor Log Check",
    shortName: "Arrestor Log",
    description: "Checks SCADA logs for voltage surge arrestor operation occurrences.",
    category: "safety_diag",
    group: "alarms_checklists",
    iconName: "FileBarChart",
    fields: [
      { id: "surgeCount", label: "Recorded Surge Events", type: "number", defaultValue: 4 }
    ],
    execute: (inputs) => {
      const count = parseFloat(inputs.surgeCount) || 0;
      return createEngineeringCard({
        title: "Surge Arrestor Trigger History",
        subtitle: "Transient Overvoltage Log",
        metrics: [
          { label: "Surge Event Counts", value: String(count) }
        ],
        status: count > 3 ? "WARNING (HIGH SURGES)" : "NOMINAL",
        statusMsg: count > 3 ? "High surge trigger count. Inspect arrestor health status indicator window for damage." : "Surge event logs are within normal thresholds.",
        statusLevel: count > 3 ? "warning" : "success"
      });
    }
  },
  {
    id: "water_leakage_detector_test",
    name: "Water Leak Detector Test",
    shortName: "Water Sensor Check",
    description: "Checks health of water leakage sensors at floor drains and bottom panels.",
    category: "safety_diag",
    group: "alarms_checklists",
    iconName: "Pipette",
    fields: [
      { id: "waterSensorStatus", label: "Water Sensor Health", type: "select", defaultValue: "Healthy", options: ["Healthy", "Degraded (Open Loop)", "Triggered (Water Detected)"] }
    ],
    execute: (inputs) => {
      const status = inputs.waterSensorStatus || "Healthy";
      
      let lvl: 'success' | 'warning' | 'critical' = 'success';
      let title = "NOMINAL";
      let msg = "Water leakage sensors are active and dry.";
      
      if (status.includes("Triggered")) {
        lvl = 'critical';
        title = "CRITICAL COLD WATER LEAK";
        msg = "Water detected at cabinet bottom panel floor drains! Shutdown HVAC cooling pump immediately.";
      } else if (status.includes("Degraded")) {
        lvl = 'warning';
        title = "SENSOR FAULT";
        msg = "Leak sensor loop reports open circuit. Sensor replacement required.";
      }
      
      return createEngineeringCard({
        title: "Water Leak Detector Health Check",
        subtitle: "Moisture safety loop audit",
        metrics: [
          { label: "Water Leakage Sensor State", value: status }
        ],
        status: title,
        statusMsg: msg,
        statusLevel: lvl
      });
    }
  },
  {
    id: "emergency_lighting_test",
    name: "Emergency Lighting Test",
    shortName: "Emergency Light",
    description: "Logs emergency lighting battery runtime test results.",
    category: "safety_diag",
    group: "alarms_checklists",
    iconName: "Lamp",
    fields: [
      { id: "lightRuntime", label: "Backup Battery Runtime (min)", type: "number", defaultValue: 95 }
    ],
    execute: (inputs) => {
      const time = parseFloat(inputs.lightRuntime) || 0;
      return createEngineeringCard({
        title: "Emergency Enclosure Lighting",
        subtitle: "Emergency DC Light battery test",
        metrics: [
          { label: "Emergency Battery Runtime", value: String(time), unit: "minutes" },
          { label: "Minimum Regulatory Target", value: "90", unit: "minutes" }
        ],
        status: time < 90 ? "CRITICAL (INSUFFICIENT RUNTIME)" : "NOMINAL",
        statusMsg: time < 90 ? "Emergency lighting runtime is below 90 minutes. Safety hazard. Replace battery packs." : "Emergency cabinet backup lighting complies with NFPA-101 code.",
        statusLevel: time < 90 ? "critical" : "success"
      });
    }
  },

  // ==========================================
  // TAB 4: Financials & Optimization -> Group: Revenue & Arbitrage (10 tools)
  // ==========================================
  {
    id: "degradation_cost_estimator",
    name: "Degradation Cost Estimator",
    shortName: "Cycle Cost",
    description: "Estimates the marginal cost of battery degradation per cycle based on capital costs and cycle life.",
    category: "financial_opt",
    group: "revenue_arbitrage",
    iconName: "ChartNoAxesCombined",
    fields: [
      { id: "packCost", label: "Pack Replacement Cost ($)", type: "number", defaultValue: 145000 },
      { id: "cycleLife", label: "Rated Cycle Life (cycles)", type: "number", defaultValue: 6000 },
      { id: "cycleEfficiency", label: "RTE (Fraction)", type: "number", defaultValue: 0.88 }
    ],
    execute: (inputs) => {
      const cost = parseFloat(inputs.packCost) || 1;
      const cycles = parseFloat(inputs.cycleLife) || 1;
      const rte = parseFloat(inputs.cycleEfficiency) || 0.85;
      
      const rawCostPerCycle = cost / cycles;
      const wearCostPerMwh = (rawCostPerCycle / (20 * rte)).toFixed(2); // Mock 20MWh pack
      
      let level: 'success' | 'warning' = 'success';
      let status = 'EFFICIENT';
      let msg = 'Degradation costs are normal and comply with business model targets.';
      
      if (parseFloat(wearCostPerMwh) > 15) {
        level = 'warning';
        status = 'EXPENSIVE CYCLING';
        msg = 'High degradation cost per cycle. Operating cells at extreme temperatures is accelerating capacity loss values.';
      }
      
      return createEngineeringCard({
        title: "💰 Dynamic Degradation Costing",
        subtitle: "Battery CapEx Amortization Model",
        metrics: [
          { label: "Pack Replacement Cost", value: `$${cost.toLocaleString()}` },
          { label: "Rated Total Cycle Life", value: String(cycles) },
          { label: "Core AC-AC Efficiency", value: String(rte) },
          { label: "Amortized Cost per Cycle", value: `$${rawCostPerCycle.toFixed(2)}` },
          { label: "Marginal Cost of Storage (LCOS)", value: `$${wearCostPerMwh}`, unit: "/MWh" }
        ],
        status: status,
        statusMsg: msg,
        statusLevel: level
      });
    }
  },
  {
    id: "arbitrage_profit_calculator",
    name: "Arbitrage Profit Calculator",
    shortName: "Arbitrage Calc",
    description: "Calculates net arbitrage revenue based on buy/sell energy prices and round-trip efficiency.",
    category: "financial_opt",
    group: "revenue_arbitrage",
    iconName: "DollarSign",
    fields: [
      { id: "buyPrice", label: "Charging Cost ($/MWh)", type: "number", defaultValue: 18.5 },
      { id: "sellPrice", label: "Discharging Yield ($/MWh)", type: "number", defaultValue: 95.4 },
      { id: "rtePct", label: "System RTE (%)", type: "number", defaultValue: 86.5 }
    ],
    execute: (inputs) => {
      const buy = parseFloat(inputs.buyPrice) || 0;
      const sell = parseFloat(inputs.sellPrice) || 0;
      const rte = parseFloat(inputs.rtePct) || 85;
      // Net Profit = Sell - (Buy / RTE)
      const costOfCharging = buy / (rte / 100);
      const netProfit = (sell - costOfCharging).toFixed(2);
      return createEngineeringCard({
        title: "Arbitrage Yield Assessment",
        subtitle: "Energy Arbitrage Optimization Model",
        metrics: [
          { label: "Charging Cost (Buy)", value: `$${buy.toFixed(2)}`, unit: "/MWh" },
          { label: "Discharging Revenue (Sell)", value: `$${sell.toFixed(2)}`, unit: "/MWh" },
          { label: "Effective Cost of Charging", value: `$${costOfCharging.toFixed(2)}`, unit: "/MWh" },
          { label: "Net Arbitrage Margin", value: `$${netProfit}`, unit: "/MWh" }
        ],
        status: parseFloat(netProfit) > 0 ? "PROFITABLE" : "WARNING (UNPROFITABLE)",
        statusMsg: parseFloat(netProfit) > 0 ? "Arbitrage spreads are positive. Dispatch batteries according to scheduling window." : "Arbitrage margins are negative. Charging costs exceed discharging yield due to efficiency losses.",
        statusLevel: parseFloat(netProfit) > 0 ? "success" : "warning"
      });
    }
  },
  {
    id: "peak_shaving_savings",
    name: "Peak Shaving Savings",
    shortName: "Shaving Yield",
    description: "Estimates utility billing savings by discharging batteries to offset monthly demand peaks.",
    category: "financial_opt",
    group: "revenue_arbitrage",
    iconName: "CircleDollarSign",
    fields: [
      { id: "reducedKw", label: "Reduced Demand Peak (kW)", type: "number", defaultValue: 1500 },
      { id: "tariffRate", label: "Demand Tariff ($/kW-month)", type: "number", defaultValue: 14.5 }
    ],
    execute: (inputs) => {
      const kw = parseFloat(inputs.reducedKw) || 0;
      const rate = parseFloat(inputs.tariffRate) || 0;
      const savings = (kw * rate).toFixed(2);
      return createEngineeringCard({
        title: "Demand Charge Peak Shaving",
        subtitle: "Cooperative Load Leveling Savings Model",
        metrics: [
          { label: "Peak Demand Reduced", value: String(kw), unit: "kW" },
          { label: "Peak Demand Charge Rate", value: `$${rate.toFixed(2)}`, unit: "/kW-month" },
          { label: "Monthly Tariff Savings", value: `$${parseFloat(savings).toLocaleString()}` }
        ],
        status: "ACTIVE",
        statusMsg: "Load leveling scheduler has minimized monthly utility peak capacity charges.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "capacity_market_yield",
    name: "Capacity Market Yield",
    shortName: "Capacity Market",
    description: "Calculates monthly capacity market availability payments based on bid uptime percentages.",
    category: "financial_opt",
    group: "revenue_arbitrage",
    iconName: "AreaChart",
    fields: [
      { id: "capacityBidMw", label: "Uptime Capacity Bid (MW)", type: "number", defaultValue: 10 },
      { id: "availPct", label: "Measured Availability (%)", type: "number", defaultValue: 99.4 }
    ],
    execute: (inputs) => {
      const bid = parseFloat(inputs.capacityBidMw) || 10;
      const avail = parseFloat(inputs.availPct) || 100;
      const rate = 12500; // Capacity rate ($/MW-month)
      const gross = bid * rate;
      const net = (gross * (avail / 100)).toFixed(2);
      return createEngineeringCard({
        title: "Capacity Market Settlement",
        subtitle: "Grid Availability Bidding Model",
        metrics: [
          { label: "Uptime Capacity Bid", value: String(bid), unit: "MW" },
          { label: "Measured Availability Ratio", value: `${avail}%` },
          { label: "Calculated Gross Revenue", value: `$${gross.toLocaleString()}` },
          { label: "Net Settlement Yield", value: `$${parseFloat(net).toLocaleString()}` }
        ],
        status: avail < 98.0 ? "WARNING (AVAILABILITY PENALTY)" : "OPTIMAL",
        statusMsg: avail < 98.0 ? "Availability is below contract SLA limits. Incurring availability penalties. Schedule thermal sensor replacement." : "Availability compliant. Full capacity payment released.",
        statusLevel: avail < 98.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "ancillary_services_calc",
    name: "Ancillary Services Yield",
    shortName: "Ancillary Yield",
    description: "Tracks earnings from frequency regulation services (Regulation Up/Down).",
    category: "financial_opt",
    group: "revenue_arbitrage",
    iconName: "HandCoins",
    fields: [
      { id: "regHours", label: "Active Regulation Hours", type: "number", defaultValue: 185 },
      { id: "hourlyRate", label: "Regulation Rate ($/MW-hr)", type: "number", defaultValue: 22.4 }
    ],
    execute: (inputs) => {
      const hours = parseFloat(inputs.regHours) || 0;
      const rate = parseFloat(inputs.hourlyRate) || 22.4;
      const total = (hours * rate * 10).toFixed(2); // 10MW capacity
      return createEngineeringCard({
        title: "Frequency Regulation Revenue",
        subtitle: "Ancillary Services Market Yield",
        metrics: [
          { label: "Active Regulation Duration", value: String(hours), unit: "hours" },
          { label: "Regulation Market Rate", value: `$${rate.toFixed(2)}`, unit: "/MW-hr" },
          { label: "Estimated Settlement Yield", value: `$${parseFloat(total).toLocaleString()}` }
        ],
        status: "ACTIVE STATE",
        statusMsg: "Frequency regulation telemetry indicates constant active response regulation cycles.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "lcos_calculator",
    name: "Levelized Cost of Storage",
    shortName: "LCOS Calc",
    description: "Calculates the Levelized Cost of Storage (LCOS) including charging, capital, and operations costs.",
    category: "financial_opt",
    group: "revenue_arbitrage",
    iconName: "Sigma",
    fields: [
      { id: "capexMwh", label: "Capital Amortization ($/MWh)", type: "number", defaultValue: 65 },
      { id: "chargingMwh", label: "Charging Cost ($/MWh)", type: "number", defaultValue: 25 },
      { id: "opexMwh", label: "Operating & O&M ($/MWh)", type: "number", defaultValue: 12 }
    ],
    execute: (inputs) => {
      const capex = parseFloat(inputs.capexMwh) || 0;
      const charge = parseFloat(inputs.chargingMwh) || 0;
      const opex = parseFloat(inputs.opexMwh) || 0;
      const lcos = (capex + charge + opex).toFixed(2);
      return createEngineeringCard({
        title: "Levelized Cost of Storage (LCOS)",
        subtitle: "Total Lifecycle Storage Costing",
        metrics: [
          { label: "Capital Amortization (CapEx)", value: `$${capex.toFixed(2)}`, unit: "/MWh" },
          { label: "Charging Energy Cost", value: `$${charge.toFixed(2)}`, unit: "/MWh" },
          { label: "Operations & Maintenance (OpEx)", value: `$${opex.toFixed(2)}`, unit: "/MWh" },
          { label: "Estimated Levelized LCOS", value: `$${lcos}`, unit: "/MWh" }
        ],
        status: parseFloat(lcos) > 120 ? "WARNING (HIGH LCOS)" : "COMPETITIVE",
        statusMsg: parseFloat(lcos) > 120 ? "High levelized storage cost. Focus on charging during low-tariff windows." : "LCOS lies within competitive utility boundaries.",
        statusLevel: parseFloat(lcos) > 120 ? "warning" : "success"
      });
    }
  },
  {
    id: "cycle_cost_estimator",
    name: "Cycle Cost Estimator",
    shortName: "Cycle Wear Cost",
    description: "Computes direct wear and thermal aging penalty cost for a single complete cycle.",
    category: "financial_opt",
    group: "revenue_arbitrage",
    iconName: "RefreshCw",
    fields: [
      { id: "capacityMwh", label: "Cycle Energy (MWh)", type: "number", defaultValue: 15 },
      { id: "wearRate", label: "Wear Cost Coefficient ($/MWh)", type: "number", defaultValue: 8.5 }
    ],
    execute: (inputs) => {
      const energy = parseFloat(inputs.capacityMwh) || 15;
      const coefficient = parseFloat(inputs.wearRate) || 8.5;
      const total = (energy * coefficient).toFixed(2);
      return createEngineeringCard({
        title: "Direct Battery Cycling Wear Cost",
        subtitle: "Micro-Wear Degradation Costing",
        metrics: [
          { label: "Active Energy Cycle Capacity", value: String(energy), unit: "MWh" },
          { label: "Wear Cost Coefficient", value: `$${coefficient.toFixed(2)}`, unit: "/MWh" },
          { label: "Estimated Cycle Wear Cost", value: `$${total}` }
        ],
        status: "ACTIVE STATE",
        statusMsg: "Cycle wear cost is tracked and logged in the operations ledger.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "degradation_expense",
    name: "Degradation Expense Calc",
    shortName: "Degradation Cost",
    description: "Calculates the total monthly capacity loss value based on cycle degradation.",
    category: "financial_opt",
    group: "revenue_arbitrage",
    iconName: "Minus",
    fields: [
      { id: "monthlyCycles", label: "Completed Monthly Cycles", type: "number", defaultValue: 34 },
      { id: "costPerCycle", label: "Amortized Cost per Cycle ($)", type: "number", defaultValue: 24.15 }
    ],
    execute: (inputs) => {
      const cycles = parseFloat(inputs.monthlyCycles) || 0;
      const cost = parseFloat(inputs.costPerCycle) || 24.15;
      const total = (cycles * cost).toFixed(2);
      return createEngineeringCard({
        title: "Monthly Degradation Amortization",
        subtitle: "Battery Lifespan Cost Allocation",
        metrics: [
          { label: "Cycles Completed", value: String(cycles), unit: "cycles/month" },
          { label: "Cost per Cycle", value: `$${cost.toFixed(2)}` },
          { label: "Monthly Degradation Expense", value: `$${parseFloat(total).toLocaleString()}` }
        ],
        status: "ACTIVE",
        statusMsg: "Monthly battery degradation expense has been allocated.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "aux_energy_cost",
    name: "Aux Energy Cost",
    shortName: "Aux Load Cost",
    description: "Calculates the cost of electricity consumed by parasitic auxiliary loads (HVAC).",
    category: "financial_opt",
    group: "revenue_arbitrage",
    iconName: "Receipt",
    fields: [
      { id: "auxMwh", label: "Auxiliary Energy (MWh)", type: "number", defaultValue: 85 },
      { id: "tariffRate", label: "Average Tariff Rate ($/MWh)", type: "number", defaultValue: 48 }
    ],
    execute: (inputs) => {
      const energy = parseFloat(inputs.auxMwh) || 0;
      const rate = parseFloat(inputs.tariffRate) || 48;
      const cost = (energy * rate).toFixed(2);
      return createEngineeringCard({
        title: "Parasitic Auxiliary Energy Cost",
        subtitle: "HVAC and Auxiliary Utility Cost",
        metrics: [
          { label: "Auxiliary Energy", value: String(energy), unit: "MWh" },
          { label: "Utility Tariff Rate", value: `$${rate.toFixed(2)}`, unit: "/MWh" },
          { label: "Total Auxiliary Power Cost", value: `$${parseFloat(cost).toLocaleString()}` }
        ],
        status: parseFloat(cost) > 5000 ? "WARNING (HIGH PARASITICS)" : "OPTIMAL",
        statusMsg: parseFloat(cost) > 5000 ? "High auxiliary load cost. Inspect HVAC efficiency parameters and cabinet sealing." : "Auxiliary energy costs are normal.",
        statusLevel: parseFloat(cost) > 5000 ? "warning" : "success"
      });
    }
  },
  {
    id: "capex_amortization",
    name: "Capex Amortization",
    shortName: "CapEx Amort",
    description: "Calculates CapEx amortization cost per MWh based on pack purchase price and expected throughput.",
    category: "financial_opt",
    group: "revenue_arbitrage",
    iconName: "Landmark",
    fields: [
      { id: "purchaseCost", label: "Pack Purchase Cost ($)", type: "number", defaultValue: 1450000 },
      { id: "expectedThroughput", label: "Expected Throughput (MWh)", type: "number", defaultValue: 28000 }
    ],
    execute: (inputs) => {
      const cost = parseFloat(inputs.purchaseCost) || 1;
      const throughput = parseFloat(inputs.expectedThroughput) || 1;
      const amort = (cost / throughput).toFixed(2);
      return createEngineeringCard({
        title: "CapEx Throughput Amortization",
        subtitle: "Capital Cost Allocation",
        metrics: [
          { label: "Pack Purchase Cost", value: `$${cost.toLocaleString()}` },
          { label: "Expected Throughput", value: String(throughput), unit: "MWh" },
          { label: "Amortized Cost per Throughput MWh", value: `$${amort}`, unit: "/MWh" }
        ],
        status: "ACTIVE",
        statusMsg: "CapEx amortization matches baseline lifetime models.",
        statusLevel: "success"
      });
    }
  },

  // ==========================================
  // TAB 4: Financials & Optimization -> Group: Operating Costs (10 tools)
  // ==========================================
  {
    id: "maintenance_cost_predictor",
    name: "Maintenance Cost Predictor",
    shortName: "O&M Forecast",
    description: "Estimates yearly operations and maintenance (O&M) cost based on plant cycles and HVAC fan faults.",
    category: "financial_opt",
    group: "operating_costs",
    iconName: "Hammer",
    fields: [
      { id: "fanFaults", label: "Annual HVAC Fan Faults", type: "number", defaultValue: 3 },
      { id: "siteSize", label: "BESS Container Count", type: "number", defaultValue: 5 }
    ],
    execute: (inputs) => {
      const faults = parseFloat(inputs.fanFaults) || 0;
      const size = parseFloat(inputs.siteSize) || 1;
      
      const baseline = size * 12500;
      const repairs = faults * 1800;
      const total = (baseline + repairs).toFixed(2);
      
      return createEngineeringCard({
        title: "🔧 Planned O&M Cost Projection",
        subtitle: "Preventative Maintenance Budgeting",
        metrics: [
          { label: "BESS Containers Active", value: String(size) },
          { label: "Baseline Annual O&M Fee", value: `$${baseline.toLocaleString()}` },
          { label: "Repairs Expense Projection", value: `$${repairs.toLocaleString()}` },
          { label: "Total Projected O&M Budget", value: `$${parseFloat(total).toLocaleString()}` }
        ],
        status: faults > 4 ? "WARNING (HIGH FAULT RATE)" : "COMPLIANT",
        statusMsg: faults > 4 ? "Frequent HVAC fan failures are expanding O&M budgets. Order replacement fans in bulk to save." : "Operations and maintenance costs conform to budget plans.",
        statusLevel: faults > 4 ? "warning" : "success"
      });
    }
  },
  {
    id: "refrigerant_recharge_cost",
    name: "Refrigerant Recharge Cost",
    shortName: "Gas Recharge",
    description: "Calculates cost of HVAC refrigerant recharge based on system leakage rate.",
    category: "financial_opt",
    group: "operating_costs",
    iconName: "Icicle",
    fields: [
      { id: "leakageRate", label: "HVAC Gas Leakage Rate (kg/yr)", type: "number", defaultValue: 4.5 }
    ],
    execute: (inputs) => {
      const leak = parseFloat(inputs.leakageRate) || 0;
      const costPerKg = 85; // $85 per kg
      const total = (leak * costPerKg).toFixed(2);
      return createEngineeringCard({
        title: "HVAC Refrigerant Gas Leakage Cost",
        subtitle: "HVAC Maintenance Cost",
        metrics: [
          { label: "Measured Gas Leakage", value: String(leak), unit: "kg/year" },
          { label: "Total Recharge Expense", value: `$${total}` }
        ],
        status: leak > 5.0 ? "WARNING (HIGH LEAKAGE)" : "OPTIMAL",
        statusMsg: leak > 5.0 ? "HVAC leakage exceeds limits. Repair cooling loops to prevent compressor efficiency drops." : "Refrigerant leakage rate is low.",
        statusLevel: leak > 5.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "cabinet_filter_replace_cost",
    name: "Filter Replacement Cost",
    shortName: "Filter Cost",
    description: "Calculates cost of replacement filter cartridges for battery container air intakes.",
    category: "financial_opt",
    group: "operating_costs",
    iconName: "Package",
    fields: [
      { id: "containersCount", label: "BESS Container Count", type: "number", defaultValue: 5 }
    ],
    execute: (inputs) => {
      const count = parseFloat(inputs.containersCount) || 5;
      const costPerFilter = 120; // $120 per filter
      const filtersPerContainer = 8;
      const total = (count * filtersPerContainer * costPerFilter).toFixed(2);
      return createEngineeringCard({
        title: "Container Air Filter Replacements",
        subtitle: "Scheduled Air Filter Purchase O&M",
        metrics: [
          { label: "BESS Containers", value: String(count) },
          { label: "Filters per Container", value: String(filtersPerContainer) },
          { label: "Replacement Cost", value: `$${total}` }
        ],
        status: "ACTIVE",
        statusMsg: "Planned air filter replacement costs are mapped to annual operations budget.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "scada_license_fee",
    name: "SCADA License Fee",
    shortName: "SCADA Fee",
    description: "Evaluates annual SCADA software licensing and communication charges.",
    category: "financial_opt",
    group: "operating_costs",
    iconName: "Monitor",
    fields: [
      { id: "invertersCount", label: "Inverters Under SCADA Management", type: "number", defaultValue: 10 }
    ],
    execute: (inputs) => {
      const count = parseFloat(inputs.invertersCount) || 10;
      const baseFee = 8500;
      const nodeFee = count * 350;
      const total = (baseFee + nodeFee).toFixed(2);
      return createEngineeringCard({
        title: "SCADA Annual License Fee",
        subtitle: "Software License Allocation",
        metrics: [
          { label: "Inverter Nodes Monitored", value: String(count) },
          { label: "SCADA Node Management Fee", value: `$${nodeFee}` },
          { label: "Total Licensing Cost", value: `$${total}` }
        ],
        status: "ACTIVE",
        statusMsg: "SCADA software license renewal is scheduled in the operational ledger.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "site_insurance_premium",
    name: "Site Insurance Premium",
    shortName: "Insurance Cost",
    description: "Calculates monthly insurance premium based on safety status and fire suppression systems.",
    category: "financial_opt",
    group: "operating_costs",
    iconName: "Umbrella",
    fields: [
      { id: "fireSystemStatus", label: "Fire System Certified?", type: "select", defaultValue: "Yes", options: ["Yes", "No"] }
    ],
    execute: (inputs) => {
      const certified = inputs.fireSystemStatus || "Yes";
      const basePremium = 2450;
      const premium = (certified === "Yes" ? basePremium : basePremium * 1.5).toFixed(2);
      return createEngineeringCard({
        title: "Site Operations Insurance Premium",
        subtitle: "Hazard Safety Insurance Audit",
        metrics: [
          { label: "NFPA-855 Fire Suppression System Certified", value: certified },
          { label: "Insurance Premium Cost", value: `$${premium}`, unit: "/month" }
        ],
        status: certified === "No" ? "CRITICAL (UNRESOLVED EXPOSURE)" : "COMPLIANT",
        statusMsg: certified === "No" ? "Lack of fire suppression certification increases insurance rates by 50%. Complete inspections." : "Site safety certifications minimize insurance premium costs.",
        statusLevel: certified === "No" ? "critical" : "success"
      });
    }
  },
  {
    id: "battery_testing_cost",
    name: "Battery Testing Cost",
    shortName: "Testing Cost",
    description: "Calculates cost of periodic module electrochemical impedance spectroscopy (EIS) testing.",
    category: "financial_opt",
    group: "operating_costs",
    iconName: "FlaskConical",
    fields: [
      { id: "testedRacks", label: "Tested Battery Racks", type: "number", defaultValue: 12 }
    ],
    execute: (inputs) => {
      const racks = parseFloat(inputs.testedRacks) || 0;
      const costPerRack = 450; // $450 per rack
      const total = (racks * costPerRack).toFixed(2);
      return createEngineeringCard({
        title: "Module Impedance Testing (EIS)",
        subtitle: "Planned Testing O&M",
        metrics: [
          { label: "Tested Battery Racks", value: String(racks) },
          { label: "Testing Cost per Rack", value: `$${costPerRack}` },
          { label: "Total Testing Expense", value: `$${total}` }
        ],
        status: "ACTIVE",
        statusMsg: "Planned rack impedance testing is mapped to periodic diagnostics budget.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "aux_breaker_replace_cost",
    name: "Breaker Replacement Cost",
    shortName: "Breaker Replacement",
    description: "Estimates the cost of purchasing and replacing auxiliary circuit breakers.",
    category: "financial_opt",
    group: "operating_costs",
    iconName: "ToggleRight",
    fields: [
      { id: "breakersCount", label: "Breakers Replaced", type: "number", defaultValue: 2 }
    ],
    execute: (inputs) => {
      const count = parseFloat(inputs.breakersCount) || 0;
      const costPerBreaker = 850; // $850 per breaker
      const total = (count * costPerBreaker).toFixed(2);
      return createEngineeringCard({
        title: "Auxiliary Breaker Replacement Cost",
        subtitle: "Power Substation O&M Cost",
        metrics: [
          { label: "Breakers Replaced", value: String(count) },
          { label: "Breaker Unit Cost", value: `$${costPerBreaker}` },
          { label: "Total Replacement Expense", value: `$${total}` }
        ],
        status: "ACTIVE",
        statusMsg: "Auxiliary breaker replacement expense logged successfully.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "cell_balancing_service_cost",
    name: "Cell Balancing Service Cost",
    shortName: "Balancing Cost",
    description: "Calculates cost of active manual cell balancing service during shutdown maintenance.",
    category: "financial_opt",
    group: "operating_costs",
    iconName: "GitMerge",
    fields: [
      { id: "balancedContainers", label: "Balanced Containers Count", type: "number", defaultValue: 2 }
    ],
    execute: (inputs) => {
      const count = parseFloat(inputs.balancedContainers) || 0;
      const costPerContainer = 3500; // $3500 per container
      const total = (count * costPerContainer).toFixed(2);
      return createEngineeringCard({
        title: "Active Cell Balancing Maintenance",
        subtitle: "Site Balancing O&M Cost",
        metrics: [
          { label: "Balanced Containers", value: String(count) },
          { label: "Balancing Cost per Container", value: `$${costPerContainer}` },
          { label: "Total Balancing Expense", value: `$${total}` }
        ],
        status: "ACTIVE",
        statusMsg: "Manual active cell balancing cost logged successfully.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "water_treatment_cost",
    name: "Chiller Fluid Treatment Cost",
    shortName: "Chiller Fluid",
    description: "Tracks glycol and rust inhibitor fluid replenishment costs for the liquid coolant loops.",
    category: "financial_opt",
    group: "operating_costs",
    iconName: "TestTube2",
    fields: [
      { id: "fluidVolume", label: "Fluid Replenished (L)", type: "number", defaultValue: 150 }
    ],
    execute: (inputs) => {
      const volume = parseFloat(inputs.fluidVolume) || 0;
      const costPerLiter = 12; // $12 per liter
      const total = (volume * costPerLiter).toFixed(2);
      return createEngineeringCard({
        title: "Liquid Chiller Loop Fluid Treatment",
        subtitle: "Coolant Loop Glycol O&M",
        metrics: [
          { label: "Coolant Fluid Replenished", value: String(volume), unit: "L" },
          { label: "Fluid Cost per Liter", value: `$${costPerLiter}` },
          { label: "Total Chemical Expense", value: `$${total}` }
        ],
        status: "ACTIVE",
        statusMsg: "Chiller loop chemical treatment and glycol replenishment cost logged successfully.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "hvac_compressor_replace",
    name: "HVAC Compressor Replace Cost",
    shortName: "HVAC Compressor Cost",
    description: "Calculates cost of replacement cooling compressors for damaged HVAC cabinets.",
    category: "financial_opt",
    group: "operating_costs",
    iconName: "Replace",
    fields: [
      { id: "compressorCount", label: "Compressors Replaced", type: "number", defaultValue: 1 }
    ],
    execute: (inputs) => {
      const count = parseFloat(inputs.compressorCount) || 0;
      const costPerCompressor = 14500; // $14,500 per compressor
      const total = (count * costPerCompressor).toFixed(2);
      return createEngineeringCard({
        title: "HVAC Compressor Replacement Cost",
        subtitle: "Major HVAC Repair O&M",
        metrics: [
          { label: "Compressors Replaced", value: String(count) },
          { label: "Compressor Unit Cost", value: `$${costPerCompressor}` },
          { label: "Total Replacement Expense", value: `$${total}` }
        ],
        status: "ACTIVE",
        statusMsg: "HVAC compressor replacement expense logged successfully.",
        statusLevel: "success"
      });
    }
  },

  // ==========================================
  // TAB 4: Financials & Optimization -> Group: Scheduling Optimization (11 tools)
  // ==========================================
  {
    id: "co_location_yield",
    name: "Co-location PV-BESS Yield",
    shortName: "PV-BESS Yield",
    description: "Optimizes BESS charge cycles to capture clipped PV solar energy during peak solar noon.",
    category: "financial_opt",
    group: "scheduling_opt",
    iconName: "MapPinned",
    fields: [
      { id: "pvGeneration", label: "Total Solar Gen (MWh)", type: "number", defaultValue: 85.4 },
      { id: "curtailedSolar", label: "Clipped/Curtail Power (MW)", type: "number", defaultValue: 12.5 },
      { id: "chargeAccept", label: "BESS Charging Power (MW)", type: "number", defaultValue: 10.0 }
    ],
    execute: (inputs) => {
      const solar = parseFloat(inputs.pvGeneration) || 1;
      const clipped = parseFloat(inputs.curtailedSolar) || 0;
      const accept = parseFloat(inputs.chargeAccept) || 0;
      
      const captureRatio = ((Math.min(clipped, accept) / Math.max(1, clipped)) * 100).toFixed(1);
      const recoveredEnergy = (Math.min(clipped, accept) * 2.5).toFixed(2); // Mock 2.5 hr peak solar
      
      let level: 'success' | 'warning' = 'success';
      let text = 'PV CAPTURE ACTIVE';
      let msg = 'BESS is capturing solar generation that would otherwise be lost.';
      
      if (parseFloat(captureRatio) < 70) {
        level = 'warning';
        text = 'PV CLIPPING LOSS';
        msg = 'Solar clipping power exceeds BESS charge limits. Battery capacity is saturated. Recommend shifting discharge windows earlier.';
      }
      
      return createEngineeringCard({
        title: "☀️ Co-located Solar Recovery",
        subtitle: "Solar Curtailment Reclamation",
        metrics: [
          { label: "Peak Solar Generation", value: String(solar), unit: "MWh" },
          { label: "Excess Clipped Power", value: String(clipped), unit: "MW" },
          { label: "BESS Ingest Rate", value: String(accept), unit: "MW" },
          { label: "Solar Capture Efficiency", value: `${captureRatio}%`, unit: "" },
          { label: "Recovered Daily Solar Energy", value: `${recoveredEnergy} MWh`, unit: "" }
        ],
        status: text,
        statusMsg: msg,
        statusLevel: level
      });
    }
  },
  {
    id: "charging_window_optimizer",
    name: "Charging Window Optimizer",
    shortName: "Charging Window",
    description: "Determines the lowest tariff timeframe to complete battery charging.",
    category: "financial_opt",
    group: "scheduling_opt",
    iconName: "CalendarCheck",
    fields: [
      { id: "targetSOC", label: "Target SOC (%)", type: "number", defaultValue: 90 },
      { id: "gridTariff", label: "Night Tariff Rate ($/MWh)", type: "number", defaultValue: 15 }
    ],
    execute: (inputs) => {
      const target = parseFloat(inputs.targetSOC) || 90;
      const tariff = parseFloat(inputs.gridTariff) || 15;
      return createEngineeringCard({
        title: "Off-peak Charging Optimizer",
        subtitle: "Tariff Charging Schedule",
        metrics: [
          { label: "Target SOC", value: String(target), unit: "%" },
          { label: "Off-peak Night Tariff", value: `$${tariff.toFixed(2)}`, unit: "/MWh" }
        ],
        status: tariff > 30 ? "WARNING (HIGH TARIFF)" : "OPTIMAL",
        statusMsg: tariff > 30 ? "Off-peak tariff is high. Minimize charging or schedule charging window during negative price solar peaks." : "Low-tariff charging window is active and scheduled.",
        statusLevel: tariff > 30 ? "warning" : "success"
      });
    }
  },
  {
    id: "state_of_charge_targeter",
    name: "SOC Target Scheduler",
    shortName: "SOC Targeter",
    description: "Calculates target SOC requirements before the next scheduled dispatch period.",
    category: "financial_opt",
    group: "scheduling_opt",
    iconName: "Target",
    fields: [
      { id: "targetPeriod", label: "Next Dispatch (hrs)", type: "number", defaultValue: 4.5 },
      { id: "targetLoad", label: "Dispatch Load (MW)", type: "number", defaultValue: 12 }
    ],
    execute: (inputs) => {
      const hours = parseFloat(inputs.targetPeriod) || 0;
      const load = parseFloat(inputs.targetLoad) || 0;
      const requiredMwh = hours * load;
      const targetSoc = ((requiredMwh / 40) * 100).toFixed(0); // 40MWh rated site
      return createEngineeringCard({
        title: "SOC Dispatch Targets",
        subtitle: "Pre-dispatch Charging Targets",
        metrics: [
          { label: "Required Dispatch Duration", value: String(hours), unit: "hours" },
          { label: "Target Dispatch Load", value: String(load), unit: "MW" },
          { label: "Energy Requirement", value: String(requiredMwh), unit: "MWh" },
          { label: "Required Target SOC", value: `${targetSoc}%` }
        ],
        status: parseInt(targetSoc) > 100 ? "WARNING (EXCEEDS CAPACITY)" : "HEALTHY",
        statusMsg: parseInt(targetSoc) > 100 ? "Target energy requirement exceeds BESS capacity. Dispatch targets will not be met." : "Target SOC scheduler is active and charging profiles are generated.",
        statusLevel: parseInt(targetSoc) > 100 ? "warning" : "success"
      });
    }
  },
  {
    id: "discharge_peak_optimizer",
    name: "Discharge Peak Optimizer",
    shortName: "Peak Discharge",
    description: "Calculates the maximum power discharge limit based on thermal temperature limits.",
    category: "financial_opt",
    group: "scheduling_opt",
    iconName: "Rocket",
    fields: [
      { id: "currentTemp", label: "Cell Temperature (°C)", type: "number", defaultValue: 41.5 }
    ],
    execute: (inputs) => {
      const temp = parseFloat(inputs.currentTemp) || 25;
      const maxPower = Math.max(0, 10 - (temp - 35) * 0.5).toFixed(1); // 10MW baseline, derate 0.5MW/C above 35C
      return createEngineeringCard({
        title: "Thermal Power Derating Check",
        subtitle: "Active Power Limit Thermal Check",
        metrics: [
          { label: "Max Cell Temperature", value: String(temp), unit: "°C" },
          { label: "Available Active Discharge", value: String(maxPower), unit: "MW" }
        ],
        status: temp > 35.0 ? "WARNING (THERMAL DERATE)" : "OPTIMAL",
        statusMsg: temp > 35.0 ? "Cell temperature is elevated. Inverter active discharge limits are derated to prevent cell safety trips." : "Battery temperatures are normal. Full power capability is available.",
        statusLevel: temp > 35.0 ? "warning" : "success"
      });
    }
  },
  {
    id: "curtailment_recovery_yield",
    name: "Curtailment Recovery Yield",
    shortName: "Curtailment Recovery",
    description: "Calculates recovered solar energy by charging the BESS during grid curtailment constraints.",
    category: "financial_opt",
    group: "scheduling_opt",
    iconName: "Recycle",
    fields: [
      { id: "curtailPower", label: "Curtailment Power Limit (MW)", type: "number", defaultValue: 8.5 },
      { id: "curtailDuration", label: "Curtailment Duration (hrs)", type: "number", defaultValue: 3.2 }
    ],
    execute: (inputs) => {
      const power = parseFloat(inputs.curtailPower) || 0;
      const hours = parseFloat(inputs.curtailDuration) || 0;
      const energy = (power * hours).toFixed(2);
      return createEngineeringCard({
        title: "Grid Curtailment Recovery",
        subtitle: "Clipped Solar Recovery System",
        metrics: [
          { label: "Curtailment Power", value: String(power), unit: "MW" },
          { label: "Curtailment Duration", value: String(hours), unit: "hours" },
          { label: "Recovered Curtailment Energy", value: String(energy), unit: "MWh" }
        ],
        status: "ACTIVE",
        statusMsg: "Battery system charged during curtailment to recover lost solar generation.",
        statusLevel: "success"
      });
    }
  },
  {
    id: "arbitrage_cycle_target",
    name: "Arbitrage Cycle Target",
    shortName: "Arbitrage Cycles",
    description: "Determines optimal daily charge/discharge cycle count based on degradation cost and price spreads.",
    category: "financial_opt",
    group: "scheduling_opt",
    iconName: "MoveHorizontal",
    fields: [
      { id: "dailySpread", label: "Avg Price Spread ($/MWh)", type: "number", defaultValue: 85.0 },
      { id: "wearCost", label: "Degradation Cost ($/MWh)", type: "number", defaultValue: 28.5 }
    ],
    execute: (inputs) => {
      const spread = parseFloat(inputs.dailySpread) || 0;
      const wear = parseFloat(inputs.wearCost) || 28.5;
      const net = (spread - wear).toFixed(2);
      const targetCycles = spread > (wear * 1.5) ? "2.0" : "1.0";
      return createEngineeringCard({
        title: "Daily Arbitrage Cycle Scheduler",
        subtitle: "Economic Cycle Optimization",
        metrics: [
          { label: "Daily Price Spread", value: `$${spread.toFixed(2)}`, unit: "/MWh" },
          { label: "Degradation Wear Cost", value: `$${wear.toFixed(2)}`, unit: "/MWh" },
          { label: "Net Arbitrage Margin", value: `$${net}`, unit: "/MWh" },
          { label: "Scheduled Cycles Target", value: String(targetCycles), unit: "cycles/day" }
        ],
        status: parseFloat(net) < 10 ? "WARNING (LOW PROFIT)" : "NOMINAL",
        statusMsg: parseFloat(net) < 10 ? "Price spreads are close to degradation wear costs. Restrict cycles to prevent net loss." : "Arbitrage margins justify active cycling.",
        statusLevel: parseFloat(net) < 10 ? "warning" : "success"
      });
    }
  },
  {
    id: "soc_hold_schedule",
    name: "SOC Hold Scheduler",
    shortName: "SOC Hold",
    description: "Schedules SOC target limits during long resting periods to minimize calendar aging.",
    category: "financial_opt",
    group: "scheduling_opt",
    iconName: "PauseCircle",
    fields: [
      { id: "idleDays", label: "Planned Idle Duration (days)", type: "number", defaultValue: 14 }
    ],
    execute: (inputs) => {
      const days = parseFloat(inputs.idleDays) || 0;
      const holdSoc = days > 5 ? "50" : "75";
      return createEngineeringCard({
        title: "Idle State SOC Hold Target",
        subtitle: "Calendar Aging Mitigation Scheduler",
        metrics: [
          { label: "Planned Idle Duration", value: String(days), unit: "days" },
          { label: "Optimal Hold SOC Target", value: `${holdSoc}%` }
        ],
        status: "ACTIVE",
        statusMsg: `Idle hold scheduler is active. Target SOC set to ${holdSoc}% to minimize electrode stress.`,
        statusLevel: "success"
      });
    }
  },
  {
    id: "frequency_bid_opt",
    name: "Frequency Response Bid Opt",
    shortName: "Freq Bid Opt",
    description: "Optimizes primary frequency response bids based on historical grid event rates.",
    category: "financial_opt",
    group: "scheduling_opt",
    iconName: "Antenna",
    fields: [
      { id: "eventRate", label: "Daily Excursion Events", type: "number", defaultValue: 12 },
      { id: "bidSize", label: "Regulation Bid (MW)", type: "number", defaultValue: 10 }
    ],
    execute: (inputs) => {
      const events = parseFloat(inputs.eventRate) || 0;
      const bid = parseFloat(inputs.bidSize) || 10;
      const expectedWear = (events * 0.05).toFixed(2); // 0.05% degradation per event
      return createEngineeringCard({
        title: "Frequency Response Bid Optimizer",
        subtitle: "Grid Ancillary Bid Optimizer",
        metrics: [
          { label: "Daily Excursion Events", value: String(events), unit: "events/day" },
          { label: "Active Regulation Bid", value: String(bid), unit: "MW" },
          { label: "Expected Daily Degradation Wear", value: `${expectedWear}%` }
        ],
        status: events > 20 ? "WARNING (HIGH WEAR)" : "OPTIMAL",
        statusMsg: events > 20 ? "High frequency excursion rate. Grid stability operations are causing high cycle wear. Increase bid price." : "Excursion rates are normal. Bid margins are healthy.",
        statusLevel: events > 20 ? "warning" : "success"
      });
    }
  },
  {
    id: "demand_limit_scheduler",
    name: "Demand Charge Limit Scheduler",
    shortName: "Demand Sched",
    description: "Schedules charge throttling during site auxiliary peak demands to minimize grid demand fees.",
    category: "financial_opt",
    group: "scheduling_opt",
    iconName: "LayoutList",
    fields: [
      { id: "siteLimitKw", label: "Grid Feeder Limit (kW)", type: "number", defaultValue: 250 },
      { id: "peakAuxKw", label: "Peak Auxiliary Load (kW)", type: "number", defaultValue: 85 }
    ],
    execute: (inputs) => {
      const limit = parseFloat(inputs.siteLimitKw) || 250;
      const aux = parseFloat(inputs.peakAuxKw) || 85;
      const maxCharge = (limit - aux).toFixed(0);
      return createEngineeringCard({
        title: "Feeder Peak Demand Limiter",
        subtitle: "Auxiliary Demand Throttling",
        metrics: [
          { label: "Feeder Contract Peak Limit", value: String(limit), unit: "kW" },
          { label: "Peak Auxiliary Load Draw", value: String(aux), unit: "kW" },
          { label: "Max Allowed BESS Charge Rate", value: String(maxCharge), unit: "kW" }
        ],
        status: parseFloat(maxCharge) < 100 ? "WARNING (CHARGING RESTRICTED)" : "NOMINAL",
        statusMsg: parseFloat(maxCharge) < 100 ? "High auxiliary demand leaves little feeder capacity for BESS charging. Throttle charging." : "Feeder capacity is sufficient for parallel charging and HVAC operations.",
        statusLevel: parseFloat(maxCharge) < 100 ? "warning" : "success"
      });
    }
  },
  {
    id: "arbitrage_efficiency_adjust",
    name: "Arbitrage Efficiency Adjust",
    shortName: "RTE Adj",
    description: "Adjusts arbitrage pricing models dynamically based on measured round-trip efficiency values.",
    category: "financial_opt",
    group: "scheduling_opt",
    iconName: "Settings2",
    fields: [
      { id: "measuredRte", label: "Measured AC-AC RTE (%)", type: "number", defaultValue: 84.5 }
    ],
    execute: (inputs) => {
      const rte = parseFloat(inputs.measuredRte) || 84.5;
      const adjustmentFactor = (85 / rte).toFixed(2); // baseline 85%
      return createEngineeringCard({
        title: "Arbitrage RTE Adjustment Factor",
        subtitle: "Real-Time Arbitrage Pricing Adjustment",
        metrics: [
          { label: "Measured AC-AC RTE", value: String(rte), unit: "%" },
          { label: "Arbitrage Price Multiplier", value: `${adjustmentFactor}x` }
        ],
        status: parseFloat(adjustmentFactor) > 1.05 ? "WARNING (HIGH EFF LOSS)" : "NOMINAL",
        statusMsg: parseFloat(adjustmentFactor) > 1.05 ? "Low RTE requires larger price spreads to break even. Adjust arbitrage scheduler thresholds." : "RTE matches baseline arbitrage pricing models.",
        statusLevel: parseFloat(adjustmentFactor) > 1.05 ? "warning" : "success"
      });
    }
  },
  {
    id: "negative_pricing_charge",
    name: "Negative Price Charge Sched",
    shortName: "Negative Charge",
    description: "Schedules maximum battery charging during grid negative pricing wind/solar peaks.",
    category: "financial_opt",
    group: "scheduling_opt",
    iconName: "PlugZap",
    fields: [
      { id: "negativePrice", label: "Grid Price ($/MWh)", type: "number", defaultValue: -12.5 }
    ],
    execute: (inputs) => {
      const price = parseFloat(inputs.negativePrice) || 0;
      return createEngineeringCard({
        title: "Grid Negative Pricing Capture",
        subtitle: "Off-peak Charging Revenue Capture",
        metrics: [
          { label: "Measured Grid Feeder Price", value: `$${price.toFixed(2)}`, unit: "/MWh" }
        ],
        status: price < 0 ? "REVENUE CAPTURE ACTIVE" : "NOMINAL",
        statusMsg: price < 0 ? "Grid price is negative! Charging BESS is generating revenue. Charging scheduled at maximum rate." : "Grid prices are normal. Negative price capture is inactive.",
        statusLevel: price < 0 ? "success" : "warning"
      });
    }
  }
];
