export const generateAllMatlabScripts = (project: string, evalData: any): { name: string; script: string; safeName: string }[] => {
  if (!evalData || !evalData.timestamps) return [];

  const plants = project === 'SNTL400' ? ['plant1', 'plant2'] : ['plant1', 'plant2', 'plant3'];
  const allScripts: { name: string; script: string; safeName: string }[] = [];

  let graphConfig: any = {
    lineWidths: [2, 1.6, 1.6, 1.8, 1.2], lineDash: ['solid', 'solid', 'solid', 'dash', 'dot'], traceVisible: [true, true, true, true, true],
    bgWhite: true, showGrid: true
  };
  try {
    const savedCfg = localStorage.getItem('ess_graph_config');
    if (savedCfg) graphConfig = { ...graphConfig, ...JSON.parse(savedCfg) };
  } catch(e) {}

  const commonHelpers = `
% Helper function to balance Y-axes
function yl = centeredYLim(yData, centerPoint, marginFactor)
    if isempty(yData) || all(isnan(yData(:)))
        yl = centerPoint + [-10 10];
        return;
    end
    yMax = max(yData(:), [], 'omitnan');
    yMin = min(yData(:), [], 'omitnan');
    if isnan(yMax) || isnan(yMin)
        yl = centerPoint + [-10 10];
        return;
    end
    diffMax = abs(yMax - centerPoint);
    diffMin = abs(yMin - centerPoint);
    maxDiff = max(diffMax, diffMin);
    if maxDiff == 0
        maxDiff = 1;
    end
    yl = centerPoint + [-maxDiff maxDiff] * marginFactor;
end

% Helper function to format axes
function formatAxis(ax, t, showLabels)
    xlim(ax, [min(t) max(t)]);
    try
        ax.XTick = dateshift(min(t), 'start', 'minute', 0) : minutes(30) : max(t);
    catch
    end
    if showLabels
        xtickformat(ax, 'HH:mm');
        xtickangle(ax, 45);
    else
        xticklabels(ax, {});
    end
end
`;

  const socHelpers = `
% Detect First Hit
function [tHit, yHit] = detectFirstHitInRange(tt, yData, rng, defaultVal)
    tHit = defaultVal; yHit = NaN;
    idx = find(yData >= rng(1) & yData <= rng(2), 1, 'first');
    if ~isempty(idx)
        tHit = tt(idx);
        yHit = yData(idx);
    end
end

function [tHit, yHit] = detectMaxSOCPoint(tt, yData)
    tHit = NaT; yHit = NaN;
    if all(isnan(yData)), return; end
    [yHit, idx] = max(yData, [], 'omitnan');
    tHit = tt(idx);
end

function [tHit, yHit, usedBand] = detectLowSOCAfterHigh(tt, yData, rng, tHigh)
    tHit = NaT; yHit = NaN; usedBand = false;
    if all(isnan(yData)), return; end
    if isnat(tHigh)
        startIdx = 1;
    else
        startIdx = find(tt >= tHigh, 1, 'first');
        if isempty(startIdx), startIdx = 1; end
    end
    
    subY = yData(startIdx:end);
    idxSub = find(subY >= rng(1) & subY <= rng(2), 1, 'first');
    if ~isempty(idxSub)
        usedBand = true;
        idx = startIdx + idxSub - 1;
        tHit = tt(idx);
        yHit = yData(idx);
    else
        [yHit, idxSub] = min(subY, [], 'omitnan');
        if ~isempty(idxSub)
            idx = startIdx + idxSub - 1;
            tHit = tt(idx);
        end
    end
end

function makeDraggable(h)
    set(h, 'ButtonDownFcn', @dragStart);
    function dragStart(src, ~)
        fig = ancestor(src, 'figure');
        if isempty(fig), return; end
        startPt = get(fig, 'CurrentPoint');
        startPos = src.Position;
        set(fig, 'WindowButtonMotionFcn', @dragging);
        set(fig, 'WindowButtonUpFcn', @dragStop);
        function dragging(~, ~)
            currPt = get(fig, 'CurrentPoint');
            dx = (currPt(1) - startPt(1)) / fig.Position(3);
            dy = (currPt(2) - startPt(2)) / fig.Position(4);
            src.Position = [startPos(1)+dx, startPos(2)+dy, startPos(3), startPos(4)];
        end
        function dragStop(~, ~)
            set(fig, 'WindowButtonMotionFcn', '');
            set(fig, 'WindowButtonUpFcn', '');
        end
    end
end
`;

  const baseHeader = (title: string, dataFilename: string) => `
% MATLAB Script for ${title}
% Make sure to place the JSON data file in the same directory as this script.
if ~exist('SAVE_FIG_AND_CLOSE', 'var')
    SAVE_FIG_AND_CLOSE = false;
end

dataFilename = '${dataFilename}';
fid = fopen(dataFilename, 'r');
if fid < 0
    error('Could not open %s', dataFilename);
end
raw = fread(fid, '*char')';
fclose(fid);
data = jsondecode(raw);

% Convert timestamps
t = datetime(data.timestamps, 'InputFormat', 'yyyy-MM-dd''T''HH:mm:ss.SSSZ', 'TimeZone', 'UTC');
t.TimeZone = 'local';

% Define Colors
cmdColor = [0.8500 0.3250 0.0980];
cmdQColor = [0 0 0];
remotePowerColor = [0.45 0.10 0.65];
dispatchColor = [0.20 0.60 0.20];
vabColor = [0.000 0.447 0.741];
vbcColor = [0.466 0.674 0.188];
vcaColor = [0.494 0.184 0.556];

% Centers
P_center_MW = 0;
F_center = 50;
Q_center_MVar = 0;

fig = figure('Name', '${title}', 'NumberTitle', 'off', 'Position', [100, 100, 1200, 800]);
if ${graphConfig.bgWhite ? 'true' : 'false'}
    set(fig, 'Color', 'w');
else
    set(fig, 'Color', [0.1 0.1 0.18]);
end
if SAVE_FIG_AND_CLOSE
    set(fig, 'Visible', 'off');
end

tlo = tiledlayout(__TILES__, 1, 'TileSpacing', 'compact', 'Padding', 'compact');
title(tlo, '${title}', 'FontWeight', 'bold', 'FontSize', 12);

axs = [];
`;

  const footerCode = (safeName: string) => `
if SAVE_FIG_AND_CLOSE
    savefig(fig, '${safeName}.fig');
    close(fig);
end
`;

  const plantNameMap: any = { 'plant1': 'SWG01', 'plant2': 'SWG02', 'plant3': 'SWG03' };

  // Helper to generate the Powerflow (3 tiles per plant)

  const generateDailyEvaluationSummary = (pk: string) => {
    const scriptName = `Daily_Evaluation_Summary`;
    const dateStr = (evalData.dataDate || '').replace(/-/g, '');
    const projLabel = project.includes('SNTL') ? project + 'MWH' : project.includes('SNTV') ? project + ' 12MWH' : project.includes('SNTB') ? project + ' 30MWH' : project;
    const safeName = `${projLabel.replace(/\s+/g, '')}_${scriptName}_${dateStr}`;
    
    let script = baseHeader(`Daily Evaluation Summary`, 'evalData.json').replace('__TILES__', '3');
    
    script += `
% Extract plant data
pTotal = data.pTotal.${pk};
freq = data.freq.${pk};
cmdP = data.cmdP.${pk};
remoteP = data.remoteP.${pk};
soc = data.soc.${pk};
vab = data.vab.${pk};
vbc = data.vbc.${pk};
vca = data.vca.${pk};
qTotal = data.qTotal.${pk};
cmdQ = data.cmdQ.${pk};

% --- Tile 1: Frequency & Active Power ---
ax = nexttile; axs = [axs, ax];
yyaxis left; ax.YColor = '#0072BD';
plot(t, pTotal, '-', 'Color', '#0072BD', 'LineWidth', ${graphConfig.lineWidths[0]});
ylabel('P (MW)'); ylim(centeredYLim(pTotal, P_center_MW, 1.05));
if ${graphConfig.showGrid ? 'true' : 'false'}, grid on; end

yyaxis right; ax.YColor = '#D95319';
plot(t, freq, '-', 'Color', '#D95319', 'LineWidth', ${graphConfig.lineWidths[1]});
ylabel('F (Hz)'); ylim(centeredYLim(freq, F_center, 1.05));
title('Frequency & Active Power');
legend({'P (POC)', 'Frequency'}, 'Location', 'northwest');
formatAxis(ax, t, true);

% --- Tile 2: SOC & Active Power ---
ax = nexttile; axs = [axs, ax];
yyaxis left; ax.YColor = '#0072BD'; hold on;
legH = plot(t, pTotal, '-', 'Color', '#0072BD', 'LineWidth', ${graphConfig.lineWidths[0]});
legT = {'P (POC)'};
yDataAll = pTotal(:);

if any(~isnan(cmdP))
    pCmd = stairs(t, cmdP, 'LineWidth', 1.6, 'Color', cmdColor);
    legH(end+1) = pCmd; legT{end+1} = 'P command from NCC';
    yDataAll = [yDataAll; cmdP(:)];
end
if any(~isnan(remoteP))
    pRem = stairs(t, remoteP, 'LineWidth', 1.6, 'Color', remotePowerColor);
    legH(end+1) = pRem; legT{end+1} = 'Remote Active Power';
    yDataAll = [yDataAll; remoteP(:)];
end
ylabel('P (MW)'); ylim(centeredYLim(yDataAll, P_center_MW, 1.05));
if ${graphConfig.showGrid ? 'true' : 'false'}, grid on; end

yyaxis right; ax.YColor = '#D95319';
pSOC = plot(t, soc, '-', 'Color', '#D95319', 'LineWidth', ${graphConfig.lineWidths[3]});
ylabel('SOC (%)');
legH(end+1) = pSOC; legT{end+1} = 'SOC';
title('SOC & Active Power');
legend(legH, legT, 'Location', 'northwest');
formatAxis(ax, t, true);

% --- Tile 3: Reactive Power & Voltage ---
ax = nexttile; axs = [axs, ax];
yyaxis left; ax.YColor = '#0072BD'; hold on;
pVab = plot(t, vab, '-', 'Color', vabColor, 'LineWidth', ${graphConfig.lineWidths[0]});
pVbc = plot(t, vbc, '-', 'Color', vbcColor, 'LineWidth', ${graphConfig.lineWidths[1]});
pVca = plot(t, vca, '-', 'Color', vcaColor, 'LineWidth', ${graphConfig.lineWidths[2]});
ylabel('V (kV)'); ylim([20, 24]);
if ${graphConfig.showGrid ? 'true' : 'false'}, grid on; end

yyaxis right; ax.YColor = '#D95319'; hold on;
legH3 = [pVab, pVbc, pVca]; legT3 = {'Vab', 'Vbc', 'Vca'};

pQ = plot(t, qTotal, '-', 'Color', '#D95319', 'LineWidth', ${graphConfig.lineWidths[3]});
legH3(end+1) = pQ; legT3{end+1} = 'Q total';
yDataQ = qTotal(:);

if any(~isnan(cmdQ))
    pCmdQ = stairs(t, cmdQ, 'LineWidth', 1.6, 'Color', cmdQColor, 'LineStyle', '--');
    legH3(end+1) = pCmdQ; legT3{end+1} = 'Q command from NCC';
end
ylabel('Q (MVar)'); ylim([-30, 30]);
title('Reactive Power & Voltage');
legend(legH3, legT3, 'Location', 'northwest');
formatAxis(ax, t, true);

linkaxes(axs, 'x');

% --- Add Annotations ---
try
    if isfield(data, 'dataDate')
        dateStrPrint = string(data.dataDate);
    else
        dateStrPrint = "N/A";
    end

    if isfield(data, 'dailyCycle') && isfield(data.dailyCycle, '${pk}')
        dCyc = data.dailyCycle.${pk};
    else
        dCyc = NaN;
    end
    if isfield(data, 'totalCycle') && isfield(data.totalCycle, '${pk}')
        tCyc = data.totalCycle.${pk};
    else
        tCyc = NaN;
    end

    if ~isnan(dCyc) || ~isnan(tCyc)
        strBox = ["Daily cycle (" + dateStrPrint + "):", ...
                  "  Cycle Plant Avg = " + sprintf('%.3f', dCyc), ...
                  "", ...
                  "Total cycle:", ...
                  "  Total Plant Avg = " + sprintf('%.3f', tCyc)];
        tb = annotation('textbox', [0.22 0.01 0.15 0.05], 'String', strBox, 'BackgroundColor', [1 1 1 0.7], 'EdgeColor', 'none', 'FontSize', 9, 'FitBoxToText', 'on');
        makeDraggable(tb);
    end
catch ME
    disp('Could not add cycle annotation: ' + string(ME.message));
end

${commonHelpers}
${footerCode(safeName)}
`;
    allScripts.push({ name: scriptName, script, safeName });
  };

  const generatePowerflow = (pk: string) => {
    const label = plantNameMap[pk];
    const scriptName = `${label}_Powerflow_Check`;
    
    const dateStr = (evalData.dataDate || '').replace(/-/g, '');
    const projLabel = project.includes('SNTL') ? project + 'MWH' : project;
    const cleanName = scriptName.replace(/\s+/g, '_').replace(/SWG/g, 'SPPC_').replace(/-/g, '_');
    const safeName = `${projLabel}_${cleanName}_${dateStr}`;
    
    let script = baseHeader(`${label} | Powerflow Check`, 'evalData.json').replace('__TILES__', '3');
    
    script += `
% Extract plant data
pTotal = data.pTotal.${pk};
freq = data.freq.${pk};
cmdP = data.cmdP.${pk};
remoteP = data.remoteP.${pk};
soc = data.soc.${pk};
vab = data.vab.${pk};
vbc = data.vbc.${pk};
vca = data.vca.${pk};
qTotal = data.qTotal.${pk};
cmdQ = data.cmdQ.${pk};

% --- Tile 1: Frequency & Active Power ---
ax = nexttile; axs = [axs, ax];
yyaxis left; ax.YColor = '#0072BD';
plot(t, pTotal, '-', 'Color', '#0072BD', 'LineWidth', ${graphConfig.lineWidths[0]});
ylabel('P (MW)'); ylim(centeredYLim(pTotal, P_center_MW, 1.05));
if ${graphConfig.showGrid ? 'true' : 'false'}, grid on; end

yyaxis right; ax.YColor = '#D95319';
plot(t, freq, '-', 'Color', '#D95319', 'LineWidth', ${graphConfig.lineWidths[1]});
ylabel('F (Hz)'); ylim(centeredYLim(freq, F_center, 1.05));
title('Frequency & Active Power');
legend({'P total', 'Frequency'}, 'Location', 'northwest');
formatAxis(ax, t, true);

% --- Tile 2: SOC & Active Power ---
ax = nexttile; axs = [axs, ax];
yyaxis left; ax.YColor = '#0072BD'; hold on;
legH = plot(t, pTotal, '-', 'Color', '#0072BD', 'LineWidth', ${graphConfig.lineWidths[0]});
legT = {'P total'};
yDataAll = pTotal(:);

if any(~isnan(cmdP))
    pCmd = stairs(t, cmdP, 'LineWidth', 1.6, 'Color', cmdColor);
    legH(end+1) = pCmd; legT{end+1} = 'P command from NCC';
    yDataAll = [yDataAll; cmdP(:)];
end
if any(~isnan(remoteP))
    pRem = plot(t, remoteP, '-', 'LineWidth', 1.6, 'Color', remotePowerColor);
    legH(end+1) = pRem; legT{end+1} = 'Remote Active Power';
    yDataAll = [yDataAll; remoteP(:)];
end
ylabel('P (MW)'); ylim(centeredYLim(yDataAll, P_center_MW, 1.05));
if ${graphConfig.showGrid ? 'true' : 'false'}, grid on; end

yyaxis right; ax.YColor = '#D95319';
pSOC = plot(t, soc, '-', 'Color', '#D95319', 'LineWidth', ${graphConfig.lineWidths[3]});
ylabel('SOC (%)');
legH(end+1) = pSOC; legT{end+1} = 'SOC';
title('SOC & Active Power');
legend(legH, legT, 'Location', 'northwest');
formatAxis(ax, t, true);

% --- Tile 3: Reactive Power & Voltage ---
ax = nexttile; axs = [axs, ax];
yyaxis left; ax.YColor = '#0072BD'; hold on;
pVab = plot(t, vab, '-', 'Color', vabColor, 'LineWidth', ${graphConfig.lineWidths[0]});
pVbc = plot(t, vbc, '-', 'Color', vbcColor, 'LineWidth', ${graphConfig.lineWidths[1]});
pVca = plot(t, vca, '-', 'Color', vcaColor, 'LineWidth', ${graphConfig.lineWidths[2]});
ylabel('V (kV)');
if ${graphConfig.showGrid ? 'true' : 'false'}, grid on; end

yyaxis right; ax.YColor = '#D95319'; hold on;
legH3 = [pVab, pVbc, pVca];
legT3 = {'Vab', 'Vbc', 'Vca'};

pQ = plot(t, qTotal, '-', 'Color', '#D95319', 'LineWidth', ${graphConfig.lineWidths[3]});
legH3(end+1) = pQ; legT3{end+1} = 'Q total';
yDataQ = qTotal(:);

if any(~isnan(cmdQ))
    pCmdQ = stairs(t, cmdQ, 'LineWidth', 1.6, 'Color', cmdQColor, 'LineStyle', '--');
    legH3(end+1) = pCmdQ; legT3{end+1} = 'Q command from NCC';
    yDataQ = [yDataQ; cmdQ(:)];
end
ylabel('Q (MVar)'); ylim(centeredYLim(yDataQ, Q_center_MVar, 1.05));
title('Reactive Power & Voltage');
legend(legH3, legT3, 'Location', 'northwest');
formatAxis(ax, t, true);

linkaxes(axs, 'x');
${commonHelpers}
${footerCode(safeName)}
`;
    allScripts.push({ name: scriptName, script, safeName });
  };

  const generateSocAllPlants = () => {
    const scriptName = 'Active_Power_SOC_All_Plants';
    
    const dateStr = (evalData.dataDate || '').replace(/-/g, '');
    const projLabel = project.includes('SNTL') ? project + 'MWH' : project;
    const safeName = `${projLabel}_${scriptName}_${dateStr}`;
    
    let script = baseHeader('Active Power & SOC (All Plants)', 'evalData.json').replace('__TILES__', plants.length.toString());
    script += `
SOC_HIGH_rng = [94.8 95.2];
SOC_LOW_rng  = [4.9  5.3 ];
`;
    plants.forEach((pk, i) => {
      script += `
% --- Plant: ${pk} ---
ax = nexttile; axs = [axs, ax];
pTotal = data.pTotal.${pk};
cmdP = data.cmdP.${pk};
remoteP = data.remoteP.${pk};
soc = data.soc.${pk};

yyaxis left; ax.YColor = '#0072BD'; hold on;
legH = plot(t, pTotal, '-', 'Color', '#0072BD', 'LineWidth', ${graphConfig.lineWidths[0]});
legT = {'P total'};
yDataAll = pTotal(:);

if any(~isnan(cmdP))
    pCmd = stairs(t, cmdP, 'LineWidth', 1.6, 'Color', cmdColor);
    legH(end+1) = pCmd; legT{end+1} = 'P command from NCC';
    yDataAll = [yDataAll; cmdP(:)];
end
if any(~isnan(remoteP))
    pRem = plot(t, remoteP, '-', 'LineWidth', 1.6, 'Color', remotePowerColor);
    legH(end+1) = pRem; legT{end+1} = 'Remote Active Power';
    yDataAll = [yDataAll; remoteP(:)];
end
ylabel('P (MW)'); ylim(centeredYLim(yDataAll, P_center_MW, 1.05));
if ${graphConfig.showGrid ? 'true' : 'false'}, grid on; end

yyaxis right; ax.YColor = '#D95319'; hold on;
pSOC = plot(t, soc, '-', 'Color', '#D95319', 'LineWidth', ${graphConfig.lineWidths[3]});
ylabel('SOC (%)');
legH(end+1) = pSOC; legT{end+1} = 'SOC';

% SOC hit detection
[tHighBand, yHighBand] = detectFirstHitInRange(t, soc, SOC_HIGH_rng, NaT);
if ~isnat(tHighBand)
    tHigh = tHighBand; yHigh = yHighBand; highUsedBand = true;
else
    [tHigh, yHigh] = detectMaxSOCPoint(t, soc); highUsedBand = false;
end
if ~isnat(tHigh)
    hHigh = plot(tHigh, yHigh, 'o', 'LineWidth', 1.6, 'MarkerSize', 6);
    legH(end+1) = hHigh;
    if highUsedBand
        legT{end+1} = sprintf('High SOC hit %.1f-%.1f%%', SOC_HIGH_rng(1), SOC_HIGH_rng(2));
    else
        legT{end+1} = 'Max SOC point';
    end
end

[tLow, yLow, lowUsedBand] = detectLowSOCAfterHigh(t, soc, SOC_LOW_rng, tHigh);
if ~isnat(tLow)
    hLow = plot(tLow, yLow, 'o', 'LineWidth', 1.6, 'MarkerSize', 6);
    legH(end+1) = hLow;
    if lowUsedBand
        legT{end+1} = sprintf('Low SOC hit %.1f-%.1f%%', SOC_LOW_rng(1), SOC_LOW_rng(2));
    else
        legT{end+1} = 'Min SOC point';
    end
end

title('${plantNameMap[pk]} | Active Power & SOC');
legend(legH, legT, 'Location', 'northwest');
formatAxis(ax, t, true);
`;
    });
    script += `
% --- Add Annotations ---
try
    if isfield(data, 'deviations')
        txtHigh = "Max deviation (HIGH SOC): " + string(data.deviations.highSOC.pair) + " = " + string(data.deviations.highSOC.text);
        txtLow  = "Max deviation (LOW SOC): " + string(data.deviations.lowSOC.pair) + " = " + string(data.deviations.lowSOC.text);
    else
        txtHigh = "Max deviation (HIGH SOC): (not enough data)";
        txtLow  = "Max deviation (LOW SOC): (not enough data)";
    end

    if isfield(data, 'dataDate')
        dateStrPrint = string(data.dataDate);
    else
        dateStrPrint = "N/A";
    end

    cycleLines = ["Daily cycle (" + dateStrPrint + "):"];
    sumDaily = 0; countDaily = 0;
`;
    plants.forEach((pk) => {
      script += `    if isfield(data, 'dailyCycle') && isfield(data.dailyCycle, '${pk}')
        val = data.dailyCycle.${pk};
        cycleLines(end+1) = "  ${plantNameMap[pk]}: " + sprintf('%.2f', val);
        sumDaily = sumDaily + val; countDaily = countDaily + 1;
    end\n`;
    });
    script += `
    if countDaily > 0, cycleLines(end+1) = "  Average: " + sprintf('%.2f', sumDaily/countDaily); end

    totalCycleLines = ["Plant Total Cycle (" + dateStrPrint + "):"];
    sumTotal = 0; countTotal = 0;
`;
    plants.forEach((pk) => {
      script += `    if isfield(data, 'totalCycle') && isfield(data.totalCycle, '${pk}')
        val = data.totalCycle.${pk};
        totalCycleLines(end+1) = "  ${plantNameMap[pk]}: " + sprintf('%.2f', val);
        sumTotal = sumTotal + val; countTotal = countTotal + 1;
    end\n`;
    });
    script += `
    if countTotal > 0, totalCycleLines(end+1) = "  Average: " + sprintf('%.2f', sumTotal/countTotal); end

    txt1 = [ "Max deviation timings:", "  " + txtHigh, "  " + txtLow ];
    tb1 = annotation('textbox', [0.01, 0.01, 0.2, 0.05], 'String', txt1, ...
               'EdgeColor', 'none', 'FontSize', 9, 'BackgroundColor', [1 1 1 0.7], 'FitBoxToText', 'on');
    makeDraggable(tb1);

    tb2 = annotation('textbox', [0.22, 0.01, 0.15, 0.05], 'String', cycleLines, ...
               'EdgeColor', 'none', 'FontSize', 9, 'BackgroundColor', [1 1 1 0.7], 'FitBoxToText', 'on');
    makeDraggable(tb2);

    tb3 = annotation('textbox', [0.38, 0.01, 0.15, 0.05], 'String', totalCycleLines, ...
               'EdgeColor', 'none', 'FontSize', 9, 'BackgroundColor', [1 1 1 0.7], 'FitBoxToText', 'on');
    makeDraggable(tb3);
catch ME
    disp('Could not add cycle annotation: ' + string(ME.message));
end

linkaxes(axs, 'x');
${commonHelpers}
${socHelpers}
${footerCode(safeName)}
`;
    allScripts.push({ name: scriptName, script, safeName });
  };

  const generateVoltReactiveAllPlants = () => {
    const scriptName = 'Volt_Reactive_Power_All_Plants';
    
    const dateStr = (evalData.dataDate || '').replace(/-/g, '');
    const projLabel = project.includes('SNTL') ? project + 'MWH' : project;
    const safeName = `${projLabel}_${scriptName}_${dateStr}`;

    let script = baseHeader('Volt & Reactive Power (All Plants)', 'evalData.json').replace('__TILES__', plants.length.toString());
    plants.forEach((pk, i) => {
      script += `
% --- Plant: ${pk} ---
ax = nexttile; axs = [axs, ax];
vab = data.vab.${pk};
vbc = data.vbc.${pk};
vca = data.vca.${pk};
qTotal = data.qTotal.${pk};
cmdQ = data.cmdQ.${pk};

yyaxis left; ax.YColor = '#0072BD'; hold on;
pVab = plot(t, vab, '-', 'Color', vabColor, 'LineWidth', ${graphConfig.lineWidths[0]});
pVbc = plot(t, vbc, '-', 'Color', vbcColor, 'LineWidth', ${graphConfig.lineWidths[1]});
pVca = plot(t, vca, '-', 'Color', vcaColor, 'LineWidth', ${graphConfig.lineWidths[2]});
ylabel('V (kV)');
if ${graphConfig.showGrid ? 'true' : 'false'}, grid on; end

yyaxis right; ax.YColor = '#D95319'; hold on;
legH = [pVab, pVbc, pVca]; legT = {'Vab', 'Vbc', 'Vca'};

pQ = plot(t, qTotal, '-', 'Color', '#D95319', 'LineWidth', ${graphConfig.lineWidths[3]});
legH(end+1) = pQ; legT{end+1} = 'Q total';
yDataQ = qTotal(:);

if any(~isnan(cmdQ))
    pCmdQ = stairs(t, cmdQ, 'LineWidth', 1.6, 'Color', cmdQColor, 'LineStyle', '--');
    legH(end+1) = pCmdQ; legT{end+1} = 'Q command from NCC';
    yDataQ = [yDataQ; cmdQ(:)];
end
ylabel('Q (MVar)'); ylim(centeredYLim(yDataQ, Q_center_MVar, 1.05));

title('${plantNameMap[pk]} | Reactive Power & Voltage');
legend(legH, legT, 'Location', 'northwest');
formatAxis(ax, t, true);
`;
    });
    script += `
linkaxes(axs, 'x');
${commonHelpers}
${footerCode(safeName)}
`;
    allScripts.push({ name: scriptName, script, safeName });
  };

  const is20PercentProject = typeof project === 'string' && (project.startsWith('SNTB') || project.startsWith('SNTV') || project.startsWith('SNTD') || project.startsWith('SNTZ') || project.startsWith('MSGP'));

  // Add the scripts
  if (is20PercentProject) {
    generateDailyEvaluationSummary(plants[0]);
  } else {
    plants.forEach(pk => generatePowerflow(pk));
    if (plants.length > 1) {
      generateSocAllPlants();
      generateVoltReactiveAllPlants();
    }
  }

  return allScripts;
};

export const exportMatlabScriptsToZip = async (
  project: string,
  evalData: any,
  zipEntries: { name: string; data: Uint8Array }[],
  setProgress: (prog: any) => void
) => {
  const allScripts = generateAllMatlabScripts(project, evalData);
  if (allScripts.length === 0) return;

  // Generate evalData.json with standardized timestamps
  const timestampsStr = evalData.timestamps.map((t: any) => new Date(t).toISOString());
  const serializedEvalData = {
    ...evalData,
    timestamps: timestampsStr
  };
  const dataJson = JSON.stringify(serializedEvalData);
  const encoder = new TextEncoder();
  zipEntries.push({
    name: `MATLAB_Export/evalData.json`,
    data: encoder.encode(dataJson)
  });

  const total = allScripts.length;
  for (let i = 0; i < total; i++) {
    const s = allScripts[i];
    setProgress({ pct: 60 + ((i + 1) / total) * 30, active: true, label: `Generating MATLAB script ${i + 1} of ${total}: ${s.name}...` });
    
    zipEntries.push({
      name: `MATLAB_Export/${s.safeName}.m`,
      data: encoder.encode(s.script)
    });

    await new Promise(r => setTimeout(r, 0));
  }
};
