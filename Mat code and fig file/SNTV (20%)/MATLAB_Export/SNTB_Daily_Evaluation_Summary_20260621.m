
% MATLAB Script for Daily Evaluation Summary
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

fig = figure('Name', 'Daily Evaluation Summary', 'NumberTitle', 'off', 'Position', [100, 100, 1200, 800]);
if true
    set(fig, 'Color', 'w');
else
    set(fig, 'Color', [0.1 0.1 0.18]);
end
if SAVE_FIG_AND_CLOSE
    set(fig, 'Visible', 'off');
end

tlo = tiledlayout(3, 1, 'TileSpacing', 'compact', 'Padding', 'compact');
title(tlo, 'Daily Evaluation Summary', 'FontWeight', 'bold', 'FontSize', 12);

axs = [];

SOC_HIGH_rng = [94.8 95.2];
SOC_LOW_rng  = [4.9  5.3 ];

pk = 'plant1';
pTotal = data.pTotal.(pk);
cmdP = data.cmdP.(pk);
remoteP = data.remoteP.(pk);
freq = data.freq.(pk);
soc = data.soc.(pk);
vab = data.vab.(pk);
vbc = data.vbc.(pk);
vca = data.vca.(pk);
qTotal = data.qTotal.(pk);
cmdQ = data.cmdQ.(pk);

% TILE 1: Frequency & Active Power
ax1 = nexttile; axs = ax1;
yyaxis left; ax1.YColor = '#0072BD'; hold on;
legH1 = plot(t, pTotal, '-', 'Color', '#0072BD', 'LineWidth', 2);
legT1 = {'P (POC)'};
yDataP = pTotal(:);
ylabel('P (MW)'); ylim(centeredYLim(yDataP, P_center_MW, 1.05));
if true, grid on; end

yyaxis right; ax1.YColor = '#D95319'; hold on;
pFreq = plot(t, freq, '-', 'Color', '#D95319', 'LineWidth', 1.5);
ylabel('F (Hz)'); ylim(centeredYLim(freq(:), F_center, 1.05));
legH1(end+1) = pFreq; legT1{end+1} = 'Frequency';
title('Frequency & Active Power');
legend(legH1, legT1, 'Location', 'northwest');
formatAxis(ax1, t, false);

% TILE 2: SOC & Active Power
ax2 = nexttile; axs = [axs, ax2];
yyaxis left; ax2.YColor = '#0072BD'; hold on;
legH2 = plot(t, pTotal, '-', 'Color', '#0072BD', 'LineWidth', 2);
legT2 = {'P (POC)'};
if any(~isnan(cmdP))
    pCmd = stairs(t, cmdP, 'LineWidth', 1.6, 'Color', cmdColor);
    legH2(end+1) = pCmd; legT2{end+1} = 'P command from NCC';
end
if any(~isnan(remoteP))
    pRem = stairs(t, remoteP, 'LineWidth', 1.6, 'Color', remotePowerColor);
    legH2(end+1) = pRem; legT2{end+1} = 'Remote Active Power';
end
ylabel('P (MW)'); ylim(centeredYLim(yDataP, P_center_MW, 1.05));
if true, grid on; end

yyaxis right; ax2.YColor = '#D95319'; hold on;
pSOC = plot(t, soc, '-', 'Color', '#D95319', 'LineWidth', 1.8);
ylabel('SOC (%)');
legH2(end+1) = pSOC; legT2{end+1} = 'SOC';
title('SOC & Active Power');
legend(legH2, legT2, 'Location', 'northwest');
formatAxis(ax2, t, false);

% TILE 3: Reactive Power & Voltage
ax3 = nexttile; axs = [axs, ax3];
yyaxis left; ax3.YColor = '#0072BD'; hold on;
pVab = plot(t, vab, '-', 'Color', vabColor, 'LineWidth', 2);
pVbc = plot(t, vbc, '-', 'Color', vbcColor, 'LineWidth', 1.6);
pVca = plot(t, vca, '-', 'Color', vcaColor, 'LineWidth', 1.6);
ylabel('V (kV)');
if true, grid on; end

yyaxis right; ax3.YColor = '#D95319'; hold on;
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
formatAxis(ax3, t, true);

linkaxes(axs, 'x');

% Daily Cycle Annotation
try
    if isfield(data, 'dailyCycle') && isfield(data.dailyCycle, pk), dCyc = data.dailyCycle.(pk); else, dCyc = NaN; end
    if isfield(data, 'totalCycle') && isfield(data.totalCycle, pk), tCyc = data.totalCycle.(pk); else, tCyc = NaN; end
    if isfield(data, 'dataDate'), dateStrPrint = string(data.dataDate); else, dateStrPrint = "N/A"; end

    if ~isnan(dCyc) || ~isnan(tCyc)
        strBox = ["Daily cycle (" + dateStrPrint + "):", ...
                  "  Cycle Plant Avg = " + sprintf('%.3f', dCyc), ...
                  "", ...
                  "Total cycle:", ...
                  "  Total Plant Avg = " + sprintf('%.3f', tCyc)];
        tb = annotation('textbox', [0.22 0.01 0.15 0.05], 'String', strBox, 'BackgroundColor', [1 1 1 0.7], 'EdgeColor', 'none', 'FontSize', 9, 'FitBoxToText', 'on');
        makeDraggable(tb);
    end
catch
end


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
    savefig(fig, 'SNTB_Daily_Evaluation_Summary_20260621.fig');
    save('evalData.mat', 'data');
    close(fig);
end

