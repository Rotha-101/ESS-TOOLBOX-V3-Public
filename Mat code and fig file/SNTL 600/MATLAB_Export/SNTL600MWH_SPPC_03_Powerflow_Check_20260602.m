
% MATLAB Script for SWG03 | Powerflow Check
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

fig = figure('Name', 'SWG03 | Powerflow Check', 'NumberTitle', 'off', 'Position', [100, 100, 1200, 800]);
if true
    set(fig, 'Color', 'w');
else
    set(fig, 'Color', [0.1 0.1 0.18]);
end
if SAVE_FIG_AND_CLOSE
    set(fig, 'Visible', 'off');
end

tlo = tiledlayout(3, 1, 'TileSpacing', 'compact', 'Padding', 'compact');
title(tlo, 'SWG03 | Powerflow Check', 'FontWeight', 'bold', 'FontSize', 12);

axs = [];

% Extract plant data
pTotal = data.pTotal.plant3;
freq = data.freq.plant3;
cmdP = data.cmdP.plant3;
remoteP = data.remoteP.plant3;
soc = data.soc.plant3;
vab = data.vab.plant3;
vbc = data.vbc.plant3;
vca = data.vca.plant3;
qTotal = data.qTotal.plant3;
cmdQ = data.cmdQ.plant3;

% --- Tile 1: Frequency & Active Power ---
ax = nexttile; axs = [axs, ax];
yyaxis left; ax.YColor = '#0072BD';
plot(t, pTotal, '-', 'Color', '#0072BD', 'LineWidth', 2);
ylabel('P (MW)'); ylim(centeredYLim(pTotal, P_center_MW, 1.05));
if true, grid on; end

yyaxis right; ax.YColor = '#D95319';
plot(t, freq, '-', 'Color', '#D95319', 'LineWidth', 1.6);
ylabel('F (Hz)'); ylim(centeredYLim(freq, F_center, 1.05));
title('Frequency & Active Power');
legend({'P total', 'Frequency'}, 'Location', 'northwest');
formatAxis(ax, t, true);

% --- Tile 2: SOC & Active Power ---
ax = nexttile; axs = [axs, ax];
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

yyaxis right; ax.YColor = '#D95319';
pSOC = plot(t, soc, '-', 'Color', '#D95319', 'LineWidth', 1.8);
ylabel('SOC (%)');
legH(end+1) = pSOC; legT{end+1} = 'SOC';
title('SOC & Active Power');
legend(legH, legT, 'Location', 'northwest');
formatAxis(ax, t, true);

% --- Tile 3: Reactive Power & Voltage ---
ax = nexttile; axs = [axs, ax];
yyaxis left; ax.YColor = '#0072BD'; hold on;
pVab = plot(t, vab, '-', 'Color', vabColor, 'LineWidth', 2);
pVbc = plot(t, vbc, '-', 'Color', vbcColor, 'LineWidth', 1.6);
pVca = plot(t, vca, '-', 'Color', vcaColor, 'LineWidth', 1.6);
ylabel('V (kV)');
if true, grid on; end

yyaxis right; ax.YColor = '#D95319'; hold on;
legH3 = [pVab, pVbc, pVca];
legT3 = {'Vab', 'Vbc', 'Vca'};

pQ = plot(t, qTotal, '-', 'Color', '#D95319', 'LineWidth', 1.8);
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
    savefig(fig, 'SNTL600MWH_SPPC_03_Powerflow_Check_20260602.fig');
    save('evalData.mat', 'data');
    close(fig);
end

