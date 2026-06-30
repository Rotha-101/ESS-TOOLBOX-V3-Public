
% MATLAB Script for Active Power & SOC (All Plants)
% Make sure to place the JSON data file in the same directory as this script.
if ~exist('SAVE_FIG_AND_CLOSE', 'var')
    SAVE_FIG_AND_CLOSE = false;
end

dataFilename = 'evalData.json';
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

fig = figure('Name', 'Active Power & SOC (All Plants)', 'NumberTitle', 'off', 'Position', [100, 100, 1200, 800]);
if true
    set(fig, 'Color', 'w');
else
    set(fig, 'Color', [0.1 0.1 0.18]);
end
if SAVE_FIG_AND_CLOSE
    set(fig, 'Visible', 'off');
end

tlo = tiledlayout(2, 1, 'TileSpacing', 'compact', 'Padding', 'compact');
title(tlo, 'Active Power & SOC (All Plants)', 'FontWeight', 'bold', 'FontSize', 12);

axs = [];

SOC_HIGH_rng = [94.8 95.2];
SOC_LOW_rng  = [4.9  5.3 ];

% --- Plant: plant1 ---
ax = nexttile; axs = [axs, ax];
pTotal = data.pTotal.plant1;
cmdP = data.cmdP.plant1;
remoteP = data.remoteP.plant1;
soc = data.soc.plant1;

yyaxis left; ax.YColor = '#0072BD'; hold on;
legH = plot(t, pTotal, '-', 'Color', '#0072BD', 'LineWidth', 2);
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
if true, grid on; end

yyaxis right; ax.YColor = '#D95319'; hold on;
pSOC = plot(t, soc, '-', 'Color', '#D95319', 'LineWidth', 1.8);
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

title('SWG01 | Active Power & SOC');
legend(legH, legT, 'Location', 'northwest');
formatAxis(ax, t, true);

% --- Plant: plant2 ---
ax = nexttile; axs = [axs, ax];
pTotal = data.pTotal.plant2;
cmdP = data.cmdP.plant2;
remoteP = data.remoteP.plant2;
soc = data.soc.plant2;

yyaxis left; ax.YColor = '#0072BD'; hold on;
legH = plot(t, pTotal, '-', 'Color', '#0072BD', 'LineWidth', 2);
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
if true, grid on; end

yyaxis right; ax.YColor = '#D95319'; hold on;
pSOC = plot(t, soc, '-', 'Color', '#D95319', 'LineWidth', 1.8);
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

title('SWG02 | Active Power & SOC');
legend(legH, legT, 'Location', 'northwest');
formatAxis(ax, t, true);

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
    if isfield(data, 'dailyCycle') && isfield(data.dailyCycle, 'plant1')
        val = data.dailyCycle.plant1;
        cycleLines(end+1) = "  SWG01: " + sprintf('%.2f', val);
        sumDaily = sumDaily + val; countDaily = countDaily + 1;
    end
    if isfield(data, 'dailyCycle') && isfield(data.dailyCycle, 'plant2')
        val = data.dailyCycle.plant2;
        cycleLines(end+1) = "  SWG02: " + sprintf('%.2f', val);
        sumDaily = sumDaily + val; countDaily = countDaily + 1;
    end

    if countDaily > 0, cycleLines(end+1) = "  Average: " + sprintf('%.2f', sumDaily/countDaily); end

    totalCycleLines = ["Plant Total Cycle (" + dateStrPrint + "):"];
    sumTotal = 0; countTotal = 0;
    if isfield(data, 'totalCycle') && isfield(data.totalCycle, 'plant1')
        val = data.totalCycle.plant1;
        totalCycleLines(end+1) = "  SWG01: " + sprintf('%.2f', val);
        sumTotal = sumTotal + val; countTotal = countTotal + 1;
    end
    if isfield(data, 'totalCycle') && isfield(data.totalCycle, 'plant2')
        val = data.totalCycle.plant2;
        totalCycleLines(end+1) = "  SWG02: " + sprintf('%.2f', val);
        sumTotal = sumTotal + val; countTotal = countTotal + 1;
    end

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


if SAVE_FIG_AND_CLOSE
    savefig(fig, 'SNTL400MWH_Active_Power_SOC_All_Plants_20260621.fig');
    close(fig);
end

