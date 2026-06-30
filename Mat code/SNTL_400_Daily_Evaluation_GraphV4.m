clc;
clear;
close all;

%% ================= USER INPUT =================
mainDataRootFolder = 'C:\Users\USER\Documents\Work Documents\Validity_Data\1. Daily_Evaluation\1. Data'; % <<< CHANGE THIS ONLY FOR DATA

% Plant folders inside mainDataRootFolder
plantFolderNames = {'Plant_01','Plant_02'};
plantTitles      = {'SWG01 (Plant 01)','SWG02 (Plant 02)'};

% Sub-folder names inside each Plant folder
subFolder_ESR         = 'ESR';       
subFolder_ESS         = 'ESS';
subFolder_POC         = 'POC';
subFolder_SmartLogger = 'SmartLogger';

% Remote Active Power file rule inside each POC folder:
% file name must contain BOTH words: "Remote" and "Active"
remoteKeyword1 = "remote";
remoteKeyword2 = "active";

% ===== NCC COMMAND / STAIRCASE EXCEL FOLDER =====
% Keep this as a separate folder path as before.
cmdFolder = 'C:\Users\USER\Documents\Work Documents\Validity_Data\1. Daily_Evaluation\2. NCC_Command'; % <<< CHANGE THIS

% ===== DAILY CYCLE RESULT EXCEL PARENT FOLDER =====
% Keep this as a separate folder path as before.
cycleParentFolder = 'C:\Users\USER\Documents\Work Documents\Validity_Data\1. Daily_Evaluation\3. Cycle_Data_AllDays'; % <<< CHANGE THIS

dCycle = dir(fullfile(cycleParentFolder, 'SNTL_400_Cycle_Count_*'));
dCycle = dCycle([dCycle.isdir]);

if isempty(dCycle)
    error('No SNTL_400_Cycle_Count_* folder found in: %s', cycleParentFolder);
end

[~, idxLatest] = max([dCycle.datenum]);
cycleResultFolder = fullfile(dCycle(idxLatest).folder, dCycle(idxLatest).name);

dtTick = minutes(30);

% --------- Centers ----------
P_center_MW   = 0;
F_center      = 50;
Q_center_MVar = 0;

% --------- DEBUG SWITCH ----------
DEBUG = true;

% --------- FEEDER LISTS ----------
FeedersByPlant = {
    ["03","04","07","08"]   % Plant 1
    ["12","13","15"]        % Plant 2
};

% --------- SOC HIT RANGES ----------
SOC_HIGH_rng = [94.8 95.2];
SOC_LOW_rng  = [4.9  5.3 ];

% --------- PLOT COLORS ----------
cmdColor          = [0.8500 0.3250 0.0980];
cmdQColor         = [0 0 0];
remotePowerColor  = [0.45 0.10 0.65];   % Remote Active Power
dispatchColor     = [0.20 0.60 0.20];   % P dispatch allocation

% ===== Voltage colors copied from your previous code =====
voltageColor_Vab = [0.000 0.447 0.741];
voltageColor_Vbc = [0.466 0.674 0.188];
voltageColor_Vca = [0.494 0.184 0.556];

%% ================= DISPATCH ALLOCATION SETTINGS =================
dispatch_SOCmin = 5;
dispatch_SOCmax = 95;    
dispatch_P_limit = [150 150];    
dispatch_SOH = [1 1];
dispatch_Crate_dis = [0.5 0.5];
dispatch_Crate_cha = [0.5 0.5]; 

%% ================= OUTPUT =================
todayStamp = datestr(now,'yyyymmdd');

resultDir = fullfile(mainDataRootFolder, 'SNTL_400_Daily_Evaluation_Graph');
if ~exist(resultDir,'dir'), mkdir(resultDir); end

plantDir01 = fullfile(resultDir, '1. Plant_01');
plantDir02 = fullfile(resultDir, '2. Plant_02');
if ~exist(plantDir01,'dir'), mkdir(plantDir01); end
if ~exist(plantDir02,'dir'), mkdir(plantDir02); end

allPlantDir = fullfile(resultDir, '3. Subplot_P&SOC_and_Q_U_For_All_Plants');
if ~exist(allPlantDir,'dir'), mkdir(allPlantDir); end

set(0,'DefaultFigureVisible','off');

dbgLines = strings(0,1);
P_Q_V_F_SOC_Raw_Data = struct();
Result = struct();
DispatchTT = timetable();

P_Q_V_F_SOC_Raw_Data.meta.mainDataRootFolder = mainDataRootFolder;
P_Q_V_F_SOC_Raw_Data.meta.plantFolderNames   = plantFolderNames;
P_Q_V_F_SOC_Raw_Data.meta.cmdFolder         = cmdFolder;
P_Q_V_F_SOC_Raw_Data.meta.cycleResultFolder = cycleResultFolder;
P_Q_V_F_SOC_Raw_Data.meta.remoteSource       = 'POC folder files containing Remote + Active';
P_Q_V_F_SOC_Raw_Data.meta.plantTitles       = plantTitles;
P_Q_V_F_SOC_Raw_Data.meta.dtTick            = dtTick;
P_Q_V_F_SOC_Raw_Data.meta.todayStamp        = todayStamp;
P_Q_V_F_SOC_Raw_Data.meta.resultDir         = resultDir;


%% ================= STRUCTURED FOLDER / POC CHECK DEBUG =================
if DEBUG
    dbgLines = addStructuredFolderCheck(dbgLines, mainDataRootFolder, plantFolderNames, plantTitles, ...
        {subFolder_ESR, subFolder_ESS, subFolder_POC, subFolder_SmartLogger}, ...
        subFolder_POC, remoteKeyword1, remoteKeyword2, FeedersByPlant);
end

%% ================= LOAD COMMAND / STAIRCASE CURVE ONCE =================
CmdTT = timetable();
if exist(cmdFolder,'dir')
    try
        [CmdTT, dbgLines] = loadCmdFolder(cmdFolder, dbgLines, DEBUG);
    catch ME
        dbgLines = dbg(dbgLines, "WARNING: Command curve load failed: %s", ME.message);
        CmdTT = timetable();
    end
else
    dbgLines = dbg(dbgLines, "WARNING: cmdFolder not found: %s", cmdFolder);
end

%% ================= LOOP THROUGH PLANTS =================
for p = 1:numel(plantFolderNames)

    feedersWanted = FeedersByPlant{p};
    plantID = sprintf('%02d', p);

    plantFolder = resolveSubFolder(mainDataRootFolder, plantFolderNames{p});
    if plantFolder == ""
        warning('No plant folder found: %s', fullfile(mainDataRootFolder, plantFolderNames{p}));
        dbgLines = dbg(dbgLines, "WARNING: %s plant folder is missing.", plantTitles{p});
        continue;
    end

    pocFolder = resolveSubFolder(plantFolder, subFolder_POC);
    if pocFolder == ""
        warning('No POC folder found for %s', plantTitles{p});
        dbgLines = dbg(dbgLines, "WARNING: %s POC folder is missing.", plantTitles{p});
        continue;
    end

    % Realtime data comes from POC folder only.
    % Remote Active Power file also sits in POC, so exclude files whose names contain BOTH Remote and Active.
    filesAll = [dir(fullfile(pocFolder,'**','*.xlsx')); dir(fullfile(pocFolder,'**','*.xls'))];
    filesAll = filesAll(~startsWith({filesAll.name}, '~$'));
    isRemoteFile = false(numel(filesAll),1);
    for ii = 1:numel(filesAll)
        fnLow = lower(string(filesAll(ii).name));
        isRemoteFile(ii) = contains(fnLow, remoteKeyword1) && contains(fnLow, remoteKeyword2);
    end
    files = filesAll(~isRemoteFile);

    if isempty(files)
        warning('No realtime Excel files in POC folder: %s', pocFolder);
        dbgLines = dbg(dbgLines, "WARNING: %s has no realtime Excel files in POC folder.", plantTitles{p});
        continue;
    end

    dbgLines = dbg(dbgLines, "");
    dbgLines = dbg(dbgLines, "=============================================");
    dbgLines = dbg(dbgLines, "Processing: %s", plantTitles{p});
    dbgLines = dbg(dbgLines, "Expected feeders: %s", strjoin(string(feedersWanted), ", "));
    dbgLines = dbg(dbgLines, "POC realtime Excel files used for plotting: %d", numel(files));
    dbgLines = dbg(dbgLines, "POC Remote Active Excel files excluded from realtime: %d", sum(isRemoteFile));
    dbgLines = dbg(dbgLines, "=============================================");

    SVData = table();
    PQData = table();

    nPQ = 0; nSV = 0; nSkip = 0;

    for k = 1:numel(files)
        filePath = fullfile(files(k).folder, files(k).name);
        try
            T = readtable(filePath, 'PreserveVariableNames', true);
            fname = lower(files(k).name);

            isPQ = contains(fname,'p_q') || (contains(fname,'p') && contains(fname,'q')) || ...
                   contains(fname,'reactive') || contains(fname,'active');
            isSV = contains(fname,'voltage') || contains(fname,'soc') || contains(fname,'f-voltage') || ...
                   contains(fname,'fre');

            if isPQ && ~isSV
                PQData = appendUnionSmart(PQData, T);
                nPQ = nPQ + 1;
            else
                SVData = appendUnionSmart(SVData, T);
                nSV = nSV + 1;
            end
        catch ME
            nSkip = nSkip + 1;
            warning('Skip file: %s\nReason: %s', files(k).name, ME.message);
            dbgLines = dbg(dbgLines, "WARNING: Skip realtime file: %s | %s", files(k).name, ME.message);
        end
    end

    if DEBUG
        dbgLines = dbg(dbgLines, "");
        dbgLines = dbg(dbgLines, "[DEBUG] File classification summary:");
        dbgLines = dbg(dbgLines, "  PQ files: %d", nPQ);
        dbgLines = dbg(dbgLines, "  SV files: %d", nSV);
        dbgLines = dbg(dbgLines, "  Skipped : %d", nSkip);
    end

    if isempty(PQData) && isempty(SVData)
        warning('No usable data for %s', plantTitles{p});
        dbgLines = dbg(dbgLines, "WARNING: No usable data for %s", plantTitles{p});
        continue;
    end

    timeVarPQ = findTimeVarName(PQData);
    timeVarSV = findTimeVarName(SVData);

    if DEBUG
        dbgLines = dbg(dbgLines, "");
        dbgLines = dbg(dbgLines, "[DEBUG] Time column detection:");
        dbgLines = dbg(dbgLines, "  PQ time column: %s", quoteOrNone(timeVarPQ));
        dbgLines = dbg(dbgLines, "  SV time column: %s", quoteOrNone(timeVarSV));
    end

    if ~isempty(PQData) && timeVarPQ ~= ""
        PQData.Time = parseTimeColumn(PQData.(timeVarPQ));
        PQData = PQData(~isnat(PQData.Time), :);
        PQData = sortrows(PQData, "Time");
    end

    if ~isempty(SVData) && timeVarSV ~= ""
        SVData.Time = parseTimeColumn(SVData.(timeVarSV));
        SVData = SVData(~isnat(SVData.Time), :);
        SVData = sortrows(SVData, "Time");
    end

    %% ========== BUILD PQ ==========
    if ~isempty(PQData)
        [Praw, pColsUsed, pSource, pUnit] = getPlantSystemTotalP_MW(PQData);
        [Qraw, qColsUsed, qSource, qUnit] = getPlantSystemTotalQ_MVar(PQData);

        if isempty(Praw)
            [Praw, pColsUsed, pUnit] = sumPByFeeders_Strict_UnitAware(PQData, feedersWanted);
            pSource = "fallback: feeder SUM";
        end
        if isempty(Qraw)
            [Qraw, qColsUsed, qUnit] = sumQByFeeders_Strict_UnitAware(PQData, feedersWanted);
            qSource = "fallback: feeder SUM";
        end

        Praw = fillPrev(Praw);
        Qraw = fillPrev(Qraw);

        if DEBUG
            dbgLines = dbg(dbgLines, "");
            dbgLines = dbg(dbgLines, "[DEBUG] P source: %s | unit=%s", pSource, pUnit);
            dbgLines = dbg(dbgLines, "[DEBUG] Q source: %s | unit=%s", qSource, qUnit);

            dbgLines = dbg(dbgLines, "");
            dbgLines = dbg(dbgLines, "[DEBUG] Feeder P-column coverage check:");
            dbgLines = appendFeederCoverageDebug(dbgLines, PQData, feedersWanted, "P");

            dbgLines = dbg(dbgLines, "");
            dbgLines = dbg(dbgLines, "[DEBUG] Feeder Q-column coverage check:");
            dbgLines = appendFeederCoverageDebug(dbgLines, PQData, feedersWanted, "Q");

            dbgLines = dbg(dbgLines, "");
            dbgLines = dbg(dbgLines, "[DEBUG] Columns used for P total (%d):", numel(pColsUsed));
            dbgLines = appendColumnListDebug(dbgLines, pColsUsed);

            dbgLines = dbg(dbgLines, "");
            dbgLines = dbg(dbgLines, "[DEBUG] Columns used for Q total (%d):", numel(qColsUsed));
            dbgLines = appendColumnListDebug(dbgLines, qColsUsed);
        end

        if strcmpi(pUnit,"kW"), P_MW = Praw/1000; else, P_MW = Praw; end
        if strcmpi(qUnit,"kvar"), Q_MVar = Qraw/1000; else, Q_MVar = Qraw; end

        PQTT = timetable(PQData.Time, P_MW, Q_MVar, 'VariableNames', {'P_MW','Q_MVar'});
        PQTT = mergeDuplicatesLastNonNan(PQTT);
    else
        PQTT = timetable();
        pColsUsed = strings(0,1);
        qColsUsed = strings(0,1);
    end

    %% ========== BUILD SV ==========
    if ~isempty(SVData)
        freqCandidates = findVars2Contains(SVData, "freq", "hz");
        [Fcol, Fnote] = pickOneSourceFromCandidates(freqCandidates, feedersWanted);
        Fraw = nan(height(SVData),1);
        if Fcol ~= "", Fraw = safeToDouble(SVData.(Fcol)); end
        Fraw = fillPrev(Fraw);

        SOCcol = findVarContains(SVData, "soc");
        SOCraw = nan(height(SVData),1);
        if SOCcol ~= "", SOCraw = safeToDouble(SVData.(SOCcol)); end
        SOCraw = fillPrev(SOCraw);

        vabCandidates = findVarsContains(SVData, "vab");
        vbcCandidates = findVarsContains(SVData, "vbc");
        vcaCandidates = findVarsContains(SVData, "vca");

        [VfeederID, Vhow] = pickOneFeederIDForVoltage(vabCandidates, feedersWanted);

        if VfeederID ~= ""
            VabCol = pickColumnMatchingFeeder(vabCandidates, VfeederID);
            VbcCol = pickColumnMatchingFeeder(vbcCandidates, VfeederID);
            VcaCol = pickColumnMatchingFeeder(vcaCandidates, VfeederID);
        else
            VabCol = ""; VbcCol = ""; VcaCol = "";
            if ~isempty(vabCandidates), VabCol = vabCandidates(1); end
            if ~isempty(vbcCandidates), VbcCol = vbcCandidates(1); end
            if ~isempty(vcaCandidates), VcaCol = vcaCandidates(1); end
        end

        VabRaw = getAndFill(SVData, VabCol);
        VbcRaw = getAndFill(SVData, VbcCol);
        VcaRaw = getAndFill(SVData, VcaCol);

        SVTT = timetable(SVData.Time, Fraw, SOCraw, VabRaw, VbcRaw, VcaRaw, ...
            'VariableNames', {'F_Hz','SOC_pct','Vab_kV','Vbc_kV','Vca_kV'});
        SVTT = mergeDuplicatesLastNonNan(SVTT);

        if DEBUG
            dbgLines = dbg(dbgLines, "");
            dbgLines = dbg(dbgLines, "[DEBUG] SV selected source columns:");
            dbgLines = dbg(dbgLines, "  Frequency: %s (%s)", quoteOrNone(Fcol), Fnote);
            dbgLines = dbg(dbgLines, "  SOC      : %s", quoteOrNone(SOCcol));
            if VfeederID ~= ""
                dbgLines = dbg(dbgLines, "  Voltage  : voltage feeder=%s (%s)", VfeederID, Vhow);
            else
                dbgLines = dbg(dbgLines, "  Voltage  : voltage feeder=(not detected) (%s)", Vhow);
            end
            dbgLines = dbg(dbgLines, "  Vab      : %s", quoteOrNone(VabCol));
            dbgLines = dbg(dbgLines, "  Vbc      : %s", quoteOrNone(VbcCol));
            dbgLines = dbg(dbgLines, "  Vca      : %s", quoteOrNone(VcaCol));
        end
    else
        SVTT = timetable();
    end

    %% ========== DEFINE DAY RANGE ==========
    if ~isempty(PQTT)
        dayStart = dateshift(PQTT.Properties.RowTimes(1),'start','day');
        dayEnd   = dateshift(PQTT.Properties.RowTimes(end),'end','day');
    elseif ~isempty(SVTT)
        dayStart = dateshift(SVTT.Properties.RowTimes(1),'start','day');
        dayEnd   = dateshift(SVTT.Properties.RowTimes(end),'end','day');
    else
        continue;
    end

    dataStamp = datestr(dayStart,'yyyymmdd');

    if ~isempty(SVTT)
        if SVTT.Properties.RowTimes(1) > dayStart
            pad = timetable(dayStart, nan, 5, nan, nan, nan, ...
                'VariableNames', {'F_Hz','SOC_pct','Vab_kV','Vbc_kV','Vca_kV'});
            SVTT = [pad; SVTT];
        end
        SVTT.SOC_pct = fillmissing(SVTT.SOC_pct,'previous');
        SVTT.SOC_pct = fillmissing(SVTT.SOC_pct,'constant',5);
    end

    if ~isempty(PQTT)
        masterT = PQTT.Properties.RowTimes;
    else
        masterT = SVTT.Properties.RowTimes;
    end
    masterT = sort(masterT);

    if ~isempty(PQTT)
        PQ_aligned = PQTT;
    else
        PQ_aligned = timetable(masterT, nan(numel(masterT),1), nan(numel(masterT),1), ...
            'VariableNames', {'P_MW','Q_MVar'});
    end

    if ~isempty(SVTT)
        SV_aligned = retime(SVTT, masterT, 'previous');
    else
        SV_aligned = timetable(masterT, nan(numel(masterT),1), nan(numel(masterT),1), nan(numel(masterT),1), ...
            nan(numel(masterT),1), nan(numel(masterT),1), ...
            'VariableNames', {'F_Hz','SOC_pct','Vab_kV','Vbc_kV','Vca_kV'});
    end

    M = synchronize(PQ_aligned, SV_aligned, 'union');
    tt = M.Properties.RowTimes;

    %% ========== COMMAND ALIGN ==========
    cmdP = nan(numel(tt),1);
    cmdQ = nan(numel(tt),1);
    hasCmdP = false;
    hasCmdQ = false;

    if ~isempty(CmdTT)
        pName = "SWG" + sprintf('%02d',p) + "_MW";
        qName = "SWG" + sprintf('%02d',p) + "_Mvar";

        if ismember(pName, string(CmdTT.Properties.VariableNames))
            CmdAlignedP = retime(CmdTT(:, pName), tt, 'previous');
            cmdP = CmdAlignedP.(pName);
            hasCmdP = any(~isnan(cmdP));
        end
        if ismember(qName, string(CmdTT.Properties.VariableNames))
            CmdAlignedQ = retime(CmdTT(:, qName), tt, 'previous');
            cmdQ = CmdAlignedQ.(qName);
            hasCmdQ = any(~isnan(cmdQ));
        end
    end

    if DEBUG
        dbgLines = dbg(dbgLines, "[INFO] Command P available for SWG%02d (Plant %d): %d", p, p, double(hasCmdP));
        dbgLines = dbg(dbgLines, "[INFO] Command Q available for SWG%02d (Plant %d): %d", p, p, double(hasCmdQ));
    end

    %% ========== REMOTE ACTIVE POWER ALIGN ==========
    RemoteTT = timetable();
    RemoteRawTable = table();
    remoteP = nan(numel(tt),1);
    hasRemoteP = false;

    try
        [RemoteTT, RemoteRawTable, dbgLines] = loadRemoteActivePowerFromPOC( ...
            pocFolder, remoteKeyword1, remoteKeyword2, dayStart, dayEnd, dbgLines, DEBUG);
    catch ME
        dbgLines = dbg(dbgLines, "WARNING: Remote Active Power load failed for %s | %s", plantTitles{p}, ME.message);
    end

    if ~isempty(RemoteTT)
        RemoteAligned = retime(RemoteTT, tt, 'previous');
        remoteP = RemoteAligned.RemoteP_MW;
        hasRemoteP = any(~isnan(remoteP));
    end

    %% ================= SAVE FIGURES 1-4 =================
    if p == 1
        figPlantDir = plantDir01;
    elseif p == 2
        figPlantDir = plantDir02;
    end

    f1 = figure('Color','w');
    yyaxis left
    pP = plot(tt, M.P_MW, '-', 'LineWidth', 1.2);
    ylabel('Active Power (MW)'); ylim(centeredYLim(M.P_MW, P_center_MW, 1.05));
    yyaxis right
    pF = plot(tt, M.F_Hz, '-', 'LineWidth', 1.2);
    ylabel('Frequency (Hz)'); ylim(centeredYLim(M.F_Hz, F_center, 1.05));
    grid on; title([plantTitles{p} ' | Frequency vs Active Power']);
    legend([pP pF], {'P total','Frequency'}, 'Location','northwest');
    xlim([dayStart dayEnd]); xticks(dayStart:dtTick:dayEnd); xtickformat('HH:mm'); xtickangle(45); xlabel('Time');
    f1name = fullfile(figPlantDir, ['1. ' dataStamp '_SNTL400MWH_Frequency_ActivePower_SPPC-' plantID '.fig']);
    savefig(f1, f1name); close(f1);

    f2 = figure('Color','w');
    yyaxis left
    pP2 = plot(tt, M.P_MW, '-', 'LineWidth', 1.2); hold on
    legH_left = pP2; legT_left = {'P total'};
    if hasCmdP
        pCmdP2 = stairs(tt, cmdP, 'LineWidth', 1.6, 'Color', cmdColor);
        legH_left(end+1) = pCmdP2; legT_left{end+1} = 'P command from NCC';
    end
    % if hasRemoteP
    %     pRemote2 = plot(tt, remoteP, '-', 'LineWidth', 1.6, 'Color', remotePowerColor);
    %     legH_left(end+1) = pRemote2; legT_left{end+1} = 'Remote Active Power';
    % end
    hold off
    ylabel('Active Power (MW)'); ylim(centeredYLim([M.P_MW; cmdP; remoteP], P_center_MW, 1.05));
    yyaxis right
    pSOC = plot(tt, M.SOC_pct, '-', 'LineWidth', 1.2);
    ylabel('SOC (%)'); grid on; title([plantTitles{p} ' | SOC vs Active Power']);
    legend([legH_left pSOC], [legT_left {'SOC'}], 'Location','northwest');
    xlim([dayStart dayEnd]); xticks(dayStart:dtTick:dayEnd); xtickformat('HH:mm'); xtickangle(45); xlabel('Time');
    f2name = fullfile(figPlantDir, ['2. ' dataStamp '_SNTL400MWH_SOC_ActivePower_SPPC-' plantID '.fig']);
    savefig(f2, f2name); close(f2);

    f3 = figure('Color','w');
    yyaxis left
    pv1 = plot(tt, M.Vab_kV, '-', 'LineWidth', 1.2, 'Color', voltageColor_Vab); hold on
    pv2 = plot(tt, M.Vbc_kV, '-', 'LineWidth', 1.2, 'Color', voltageColor_Vbc);
    pv3 = plot(tt, M.Vca_kV, '-', 'LineWidth', 1.2, 'Color', voltageColor_Vca); hold off
    ylabel('Voltage (kV)');
    yyaxis right
    pq = plot(tt, M.Q_MVar, '-', 'LineWidth', 1.3); hold on
    legH3 = [pv1 pv2 pv3 pq]; legT3 = {'Vab','Vbc','Vca','Q total'};
    if hasCmdQ
        pCmdQ3 = stairs(tt, cmdQ, 'LineWidth', 1.6, 'Color', cmdQColor);
        legH3(end+1) = pCmdQ3; legT3{end+1} = 'Q command from NCC';
    end
    hold off
    ylabel('Reactive Power (MVar)'); ylim(centeredYLim([M.Q_MVar; cmdQ], Q_center_MVar, 1.05));
    grid on; title([plantTitles{p} ' | Reactive Power vs Voltage']);
    legend(legH3, legT3, 'Location','northwest');
    xlim([dayStart dayEnd]); xticks(dayStart:dtTick:dayEnd); xtickformat('HH:mm'); xtickangle(45); xlabel('Time');
    f3name = fullfile(figPlantDir, ['3. ' dataStamp '_SNTL400MWH_ReactivePower_Voltage_SPPC-' plantID '.fig']);
    savefig(f3, f3name); close(f3);

    f4 = figure('Color','w');
    set(f4,'Units','normalized','Position',[0.05 0.05 0.9 0.85]);
    tiledlayout(3,1,'TileSpacing','compact','Padding','compact');

    nexttile;
    yyaxis left
    pP_ = plot(tt, M.P_MW, '-', 'LineWidth', 1.2); ylabel('P (MW)'); ylim(centeredYLim(M.P_MW, P_center_MW, 1.05));
    yyaxis right
    pF_ = plot(tt, M.F_Hz, '-', 'LineWidth', 1.2); ylabel('F (Hz)'); ylim(centeredYLim(M.F_Hz, F_center, 1.05));
    grid on; title('Frequency & Active Power'); legend([pP_ pF_], {'P total','Frequency'}, 'Location','northwest');
    xlim([dayStart dayEnd]); xticks(dayStart:dtTick:dayEnd); xtickformat('HH:mm'); xtickangle(45);

    nexttile;
    yyaxis left
    pP__ = plot(tt, M.P_MW, '-', 'LineWidth', 1.2); hold on
    legH4_2 = pP__; legT4_2 = {'P total'};
    if hasCmdP
        pCmdP__ = stairs(tt, cmdP, 'LineWidth', 1.6, 'Color', cmdColor);
        legH4_2(end+1) = pCmdP__; legT4_2{end+1} = 'P command from NCC';
    end
    % if hasRemoteP
    %     pRemote__ = plot(tt, remoteP, '-', 'LineWidth', 1.6, 'Color', remotePowerColor);
    %     legH4_2(end+1) = pRemote__; legT4_2{end+1} = 'Remote Active Power';
    % end
    hold off
    ylabel('P (MW)'); ylim(centeredYLim([M.P_MW; cmdP; remoteP], P_center_MW, 1.05));
    yyaxis right
    pSOC_ = plot(tt, M.SOC_pct, '-', 'LineWidth', 1.2); ylabel('SOC (%)');
    grid on; title('SOC & Active Power'); legend([legH4_2 pSOC_], [legT4_2 {'SOC'}], 'Location','northwest');
    xlim([dayStart dayEnd]); xticks(dayStart:dtTick:dayEnd); xtickformat('HH:mm'); xtickangle(45);

    nexttile;
    yyaxis left
    pv1_ = plot(tt, M.Vab_kV, '-', 'LineWidth', 1.2, 'Color', voltageColor_Vab); hold on
    pv2_ = plot(tt, M.Vbc_kV, '-', 'LineWidth', 1.2, 'Color', voltageColor_Vbc);
    pv3_ = plot(tt, M.Vca_kV, '-', 'LineWidth', 1.2, 'Color', voltageColor_Vca); hold off
    ylabel('V (kV)');
    yyaxis right
    pq_ = plot(tt, M.Q_MVar, '-', 'LineWidth', 1.3); hold on
    legH4_3 = [pv1_ pv2_ pv3_ pq_]; legT4_3 = {'Vab','Vbc','Vca','Q total'};
    if hasCmdQ
        pCmdQ4 = stairs(tt, cmdQ, 'LineWidth', 1.8, 'Color', cmdQColor);
        legH4_3(end+1) = pCmdQ4; legT4_3{end+1} = 'Q command from NCC';
    end
    hold off
    ylabel('Q (MVar)'); ylim(centeredYLim([M.Q_MVar; cmdQ], Q_center_MVar, 1.05));
    grid on; title('Reactive Power & Voltage'); legend(legH4_3, legT4_3, 'Location','northwest');
    xlim([dayStart dayEnd]); xticks(dayStart:dtTick:dayEnd); xtickformat('HH:mm'); xtickangle(45); xlabel('Time');
    sgtitle([plantTitles{p} ' | Powerflow (Daily Check)'], 'FontWeight','bold');
    f4name = fullfile(figPlantDir, ['4. ' dataStamp '_SNTL400MWH_Powerflow_SPPC-' plantID '.fig']);
    savefig(f4, f4name); close(f4);

    %% ================= STORE RAW + RESULT =================
    plantKey = matlab.lang.makeValidName("Plant_" + string(p));

    P_Q_V_F_SOC_Raw_Data.(plantKey).title      = plantTitles{p};
    P_Q_V_F_SOC_Raw_Data.(plantKey).folder     = plantFolder;
    P_Q_V_F_SOC_Raw_Data.(plantKey).files      = string(fullfile({files.folder},{files.name}))';
    P_Q_V_F_SOC_Raw_Data.(plantKey).PQData_raw = PQData;
    P_Q_V_F_SOC_Raw_Data.(plantKey).SVData_raw = SVData;

    Result.(plantKey).title         = plantTitles{p};
    Result.(plantKey).feedersWanted = feedersWanted;
    Result.(plantKey).pColsUsed     = pColsUsed;
    Result.(plantKey).qColsUsed     = qColsUsed;
    Result.(plantKey).dayStart      = dayStart;
    Result.(plantKey).dayEnd        = dayEnd;
    Result.(plantKey).M_raw         = M;
    Result.(plantKey).cmdP          = cmdP;
    Result.(plantKey).cmdQ          = cmdQ;
    Result.(plantKey).hasCmdP       = hasCmdP;
    Result.(plantKey).hasCmdQ       = hasCmdQ;
    Result.(plantKey).remoteP       = remoteP;
    Result.(plantKey).hasRemoteP    = hasRemoteP;
    Result.(plantKey).RemoteTT      = RemoteTT;
end

%% ================= BUILD REMOTE Pset + DISPATCH ALLOCATION =================
hasP1 = isfield(Result,'Plant_1') && isfield(Result.Plant_1,'M_raw') && isfield(Result.Plant_1,'remoteP');
hasP2 = isfield(Result,'Plant_2') && isfield(Result.Plant_2,'M_raw') && isfield(Result.Plant_2,'remoteP');

if hasP1 && hasP2 
    try
        M1 = Result.Plant_1.M_raw(:, {'SOC_pct'}); M1.Properties.VariableNames = {'SOC1_pct'};
        M2 = Result.Plant_2.M_raw(:, {'SOC_pct'}); M2.Properties.VariableNames = {'SOC2_pct'};

        tt1 = Result.Plant_1.M_raw.Properties.RowTimes;
        tt2 = Result.Plant_2.M_raw.Properties.RowTimes;

        R1 = timetable(tt1, Result.Plant_1.remoteP(:), 'VariableNames', {'RemoteP1_MW'});
        R2 = timetable(tt2, Result.Plant_2.remoteP(:), 'VariableNames', {'RemoteP2_MW'});

        AllTT = synchronize(R1, R2, M1, M2, 'union');
        ttAll = AllTT.Properties.RowTimes;
        AllTT = retime(AllTT, ttAll, 'previous');

        AllTT.RemoteP1_MW = fillPrev(AllTT.RemoteP1_MW);
        AllTT.RemoteP2_MW = fillPrev(AllTT.RemoteP2_MW);
        AllTT.SOC1_pct  = fillmissing(fillPrev(AllTT.SOC1_pct),'constant',dispatch_SOCmin);
        AllTT.SOC2_pct  = fillmissing(fillPrev(AllTT.SOC2_pct),'constant',dispatch_SOCmin);

        Pset_total_MW = AllTT.RemoteP1_MW + AllTT.RemoteP2_MW;

        nAll = height(AllTT);
        Pdisp = nan(nAll,2);

        for k = 1:nAll
            SOCk  = [AllTT.SOC1_pct(k), AllTT.SOC2_pct(k)];
            Psetk = Pset_total_MW(k);

            if any(isnan(SOCk)) || isnan(Psetk)
                continue;
            end

            [Pi_k, ~] = alloc_with_limits(Psetk, SOCk, dispatch_SOH, dispatch_SOCmin, dispatch_SOCmax, ...
                dispatch_Crate_dis, dispatch_Crate_cha, dispatch_P_limit);
            Pdisp(k,:) = Pi_k;
        end

        DispatchTT = timetable(ttAll, AllTT.RemoteP1_MW, AllTT.RemoteP2_MW, ...
            Pset_total_MW, Pdisp(:,1), Pdisp(:,2), ...
            AllTT.SOC1_pct, AllTT.SOC2_pct, ...
            'VariableNames', {'RemoteP_Plant01_MW','RemoteP_Plant02_MW', ...
            'Pset_total_MW','Pdispatch_Plant01_MW','Pdispatch_Plant02_MW', ...
            'SOC1_pct','SOC2_pct'});

        DispatchTT = mergeDuplicatesLastNonNan(DispatchTT);

        dbgLines = dbg(dbgLines, "");
        dbgLines = dbg(dbgLines, "=============================================");
        dbgLines = dbg(dbgLines, "Remote Active Power Dispatch Allocation");
        dbgLines = dbg(dbgLines, "Pset source: Remote Active Power sum of Plant 01/02");
        dbgLines = dbg(dbgLines, "Rows: %d", height(DispatchTT));
        dbgLines = dbg(dbgLines, "=============================================");

    catch ME
        dbgLines = dbg(dbgLines, "WARNING: Failed to build Remote dispatch allocation | %s", ME.message);
        DispatchTT = timetable();
    end
else
    dbgLines = dbg(dbgLines, "WARNING: Cannot build dispatch allocation because Remote Active Power data is missing for one or more plants.");
end

%% ================= MAP DISPATCH BACK TO EACH PLANT =================
if ~isempty(DispatchTT)
    for p = 1:2
        plantKey = matlab.lang.makeValidName("Plant_" + string(p));
        if ~isfield(Result, plantKey) || ~isfield(Result.(plantKey), 'M_raw')
            continue;
        end

        ttPlant = Result.(plantKey).M_raw.Properties.RowTimes;

        switch p
            case 1
                varName = 'Pdispatch_Plant01_MW';
            case 2
                varName = 'Pdispatch_Plant02_MW';
        end

        try
            DAlign = retime(DispatchTT(:, varName), ttPlant, 'previous');
            Result.(plantKey).Pdispatch_alloc_MW = DAlign.(varName);
            Result.(plantKey).hasDispatchAlloc = any(~isnan(Result.(plantKey).Pdispatch_alloc_MW));
        catch
            Result.(plantKey).Pdispatch_alloc_MW = nan(numel(ttPlant),1);
            Result.(plantKey).hasDispatchAlloc = false;
        end
    end
end

%% ================= FIGURE 5 (ALL PLANTS: P & SOC + GRID + SOC DOT LOGIC + CYCLE LEGEND + DEVIATION LEGEND) =================
allDayStarts = NaT(0,1);
for p = 1:numel(plantTitles)
    plantKey = matlab.lang.makeValidName("Plant_" + string(p));
    if isfield(Result, plantKey) && isfield(Result.(plantKey), "dayStart")
        allDayStarts(end+1,1) = Result.(plantKey).dayStart;
    end
end
if ~isempty(allDayStarts)
    fig5Stamp = datestr(min(allDayStarts),'yyyymmdd');
else
    fig5Stamp = todayStamp;
end
CycleInfo = struct();
CycleInfo.hasData = false;
CycleInfo.dateStr = string(datetime(fig5Stamp,'InputFormat','yyyyMMdd','Format','yyyy-MM-dd'));
CycleInfo.SWG01 = NaN;
CycleInfo.SWG02 = NaN;
CycleInfo.Average_Daily_Cycle = NaN;
CycleInfo.SWG01_txt = "Cycle_Plant 01 = (no data)";
CycleInfo.SWG02_txt = "Cycle_Plant 02 = (no data)";
CycleInfo.Average_Daily_Cycle_txt = "Average Daily Cycle = (no data)";
CycleInfo.SWG01_Total_txt = "Plant 01 Total Cycle = (no data)";
CycleInfo.SWG02_Total_txt = "Plant 02 Total Cycle = (no data)";
CycleInfo.AvgTotal_txt = "Average Total Plant Cycle = (no data)";
if exist(cycleResultFolder,'dir')
    try
        [CycleInfo, dbgLines] = loadDailyCycleInfo(cycleResultFolder, fig5Stamp, dbgLines, DEBUG);
    catch ME
        dbgLines = dbg(dbgLines, "WARNING: Daily cycle result load failed: %s", ME.message);
    end
else
    dbgLines = dbg(dbgLines, "WARNING: cycleResultFolder not found: %s", cycleResultFolder);
end
avgIdx = find(strcmpi(T.Properties.VariableNames,'Average_Daily_Cycle'), 1);
if ~isempty(avgIdx)
    CycleInfo.Average_Daily_Cycle = T{rowIdx, avgIdx};

    if ~isnumeric(CycleInfo.Average_Daily_Cycle)
        CycleInfo.Average_Daily_Cycle = str2double(string(CycleInfo.Average_Daily_Cycle));
    end

    if ~isnan(CycleInfo.Average_Daily_Cycle)
        CycleInfo.Average_Daily_Cycle_txt = sprintf( ...
            'Average Daily Cycle = %.3f', CycleInfo.Average_Daily_Cycle);
    end
end
highHitTimes = NaT(1, numel(plantTitles));
lowHitTimes  = NaT(1, numel(plantTitles));
f5 = figure('Color','w');
set(f5,'Units','normalized','Position',[0.08 0.10 0.85 0.60]);
tiledlayout(2,1,'TileSpacing','compact','Padding','compact');
axList = gobjects(1,numel(plantTitles));
for p = 1:numel(plantTitles)
    plantKey = matlab.lang.makeValidName("Plant_" + string(p));
    if ~isfield(Result, plantKey) || ~isfield(Result.(plantKey), "M_raw")
        ax = nexttile; axList(p)=ax;
        grid on; title([plantTitles{p} ' | (no data)']);
        continue;
    end
    M5  = Result.(plantKey).M_raw;
    tt5 = M5.Properties.RowTimes;
    cmdP5 = Result.(plantKey).cmdP;
    hasCmd5 = Result.(plantKey).hasCmdP;
    remoteP5 = Result.(plantKey).remoteP;
    hasRemote5 = Result.(plantKey).hasRemoteP;
    
    if isfield(Result.(plantKey),'Pdispatch_alloc_MW')
        pDisp5 = Result.(plantKey).Pdispatch_alloc_MW;
    else
        pDisp5 = nan(size(tt5));
    end
    if isfield(Result.(plantKey),'hasDispatchAlloc')
        hasDisp5 = Result.(plantKey).hasDispatchAlloc;
    else
        hasDisp5 = false;
    end

    ax = nexttile; axList(p)=ax;
    yyaxis left
    pP5 = plot(tt5, M5.P_MW, '-', 'LineWidth', 1.2); hold on
    legH = pP5;
    legT = {'P total'};

    if hasCmd5
        pCmd5 = stairs(tt5, cmdP5, 'LineWidth', 1.6, 'Color', cmdColor);
        legH(end+1) = pCmd5;
        legT{end+1} = 'P command from NCC';
    end

    % if hasRemote5
    %     pRemote5 = plot(tt5, remoteP5, '-', 'LineWidth', 1.6, 'Color', remotePowerColor);
    %     legH(end+1) = pRemote5;
    %     legT{end+1} = 'Remote Active Power';
    % end
    % 
    % if hasDisp5
    %     pDispLine = plot(tt5, pDisp5, '--', 'LineWidth', 1.8, 'Color', dispatchColor);
    %     legH(end+1) = pDispLine;
    %     legT{end+1} = 'P dispatch allocation';
    % end
    hold off
    ylabel('Active Power (MW)');ylim(centeredYLim(M.P_MW, P_center_MW, 1.05));
    yyaxis right
    pSOC5 = plot(tt5, M5.SOC_pct, '-', 'LineWidth', 1.2); hold on
    ylabel('SOC (%)');
    soc = M5.SOC_pct(:);
    hHigh = gobjects(1);
    hLow  = gobjects(1);
    [tHighBand, yHighBand] = detectFirstHitInRange(tt5, soc, SOC_HIGH_rng, NaT); 
    if ~isnat(tHighBand)
        tHigh = tHighBand;
        yHigh = yHighBand;
        highUsedBand = true;
    else
        [tHigh, yHigh] = detectMaxSOCPoint(tt5, soc);
        highUsedBand = false;
    end
    if ~isnat(tHigh)
        hHigh = plot(tHigh, yHigh, 'o', 'LineWidth', 1.6, 'MarkerSize', 6);
        highHitTimes(p) = tHigh;
    end

    [tLow, yLow, lowUsedBand] = detectLowSOCAfterHigh(tt5, soc, SOC_LOW_rng, tHigh);

    if ~isnat(tLow)
        hLow = plot(tLow, yLow, 'o', 'LineWidth', 1.6, 'MarkerSize', 6);
        lowHitTimes(p) = tLow;
    end
    hold off
    grid on;
    title([plantTitles{p} ' | Active Power & SOC']);
    legH(end+1) = pSOC5;
    legT{end+1} = 'SOC';
    if isgraphics(hHigh)
        legH(end+1) = hHigh;
        if highUsedBand
            legT{end+1} = sprintf('High SOC hit %.1f-%.1f%%', SOC_HIGH_rng(1), SOC_HIGH_rng(2));
        else
            legT{end+1} = 'Max SOC point';
        end
    end
    if isgraphics(hLow)
        legH(end+1) = hLow;
        if lowUsedBand
            legT{end+1} = sprintf('Low SOC hit %.1f-%.1f%%', SOC_LOW_rng(1), SOC_LOW_rng(2));
        else
            legT{end+1} = 'Min SOC point';
        end
    end
    legend(legH, legT, 'Location','northwest');
    xlim([Result.(plantKey).dayStart Result.(plantKey).dayEnd]);
    xticks(Result.(plantKey).dayStart:dtTick:Result.(plantKey).dayEnd);
    xtickformat('HH:mm');
    xtickangle(45);
    if p == numel(plantTitles)
        xlabel('Time');
    end
end

%% ===== 2nd LEGEND ON SUBPLOT 1: DAILY CYCLE OF EACH PLANT =====
if numel(axList) >= 1 && isgraphics(axList(1))
    cycleLines = {
        char("Daily cycle (" + CycleInfo.dateStr + "):")
        char(CycleInfo.Plant01_txt) % Updated from SWG01_txt
        char(CycleInfo.Plant02_txt) % Updated from SWG02_txt
        char(CycleInfo.AvgDaily_txt)
        };
    addSecondLegendOnOverlay(axList(1), cycleLines, 'northeast');
end

%% ===== 3rd LEGEND ON SUBPLOT 1: TOTAL CYCLE =====
if numel(axList) >= 1 && isgraphics(axList(1))
    totalCycleLines = {
        'Total cycle:'
        char(CycleInfo.Plant01_Total_txt)
        char(CycleInfo.Plant02_Total_txt)
        char(CycleInfo.AvgTotal_txt)
        };

    addSecondLegendOnOverlay(axList(1), totalCycleLines, 'northwest');
end
%% ===== 2nd LEGEND ON SUBPLOT 2: MAX TIME DEVIATION =====
if numel(axList) >= 2 && isgraphics(axList(2))
    [pairHigh, dtHigh] = maxPairDeviation(highHitTimes);
    [pairLow,  dtLow ] = maxPairDeviation(lowHitTimes);

    if pairHigh ~= ""
        txtHigh = "Max deviation (HIGH SOC): " + pairHigh + " = " + formatDuration(dtHigh);
    else
        txtHigh = "Max deviation (HIGH SOC): (not enough data)";
    end

    if pairLow ~= ""
        txtLow  = "Max deviation (LOW SOC): " + pairLow + " = " + formatDuration(dtLow);
    else
        txtLow  = "Max deviation (LOW SOC): (not enough data)";
    end

    addSecondLegendOnOverlay(axList(2), {char(txtHigh), char(txtLow)}, 'best');
end

sgtitle([fig5Stamp ' | Active Power & SOC (All Plants)'], 'FontWeight','bold');
f5name = fullfile(allPlantDir, ['1. ' fig5Stamp '_SNTL400MWH_ActivePower_SOC_AllPlants.fig']);
savefig(f5, f5name); close(f5);
dbgLines = dbg(dbgLines, "[INFO] Saved: %s", f5name);

%% ================= FIGURE 6 ALL PLANTS: Q & V =================
fig6Stamp = fig5Stamp;
f6 = figure('Color','w');
set(f6,'Units','normalized','Position',[0.05 0.08 0.92 0.82]);
tiledlayout(2,1,'TileSpacing','compact','Padding','compact');

for p = 1:numel(plantTitles)
    plantKey = matlab.lang.makeValidName("Plant_" + string(p));
    if ~isfield(Result, plantKey) || ~isfield(Result.(plantKey), "M_raw")
        nexttile; grid on; title([plantTitles{p} ' | (no data)']);
        continue;
    end

    M6 = Result.(plantKey).M_raw;
    tt6 = M6.Properties.RowTimes;
    cmdQ6 = Result.(plantKey).cmdQ;
    hasCmdQ6 = Result.(plantKey).hasCmdQ;

    nexttile;
    yyaxis left
    pv1 = plot(tt6, M6.Vab_kV, '-', 'LineWidth', 1.2, 'Color', voltageColor_Vab); hold on
    pv2 = plot(tt6, M6.Vbc_kV, '-', 'LineWidth', 1.2, 'Color', voltageColor_Vbc);
    pv3 = plot(tt6, M6.Vca_kV, '-', 'LineWidth', 1.2, 'Color', voltageColor_Vca); hold off
    ylabel('Voltage (kV)'); grid on;

    yyaxis right
    pq = plot(tt6, M6.Q_MVar, '-', 'LineWidth', 1.3); hold on
    legH6 = [pv1 pv2 pv3 pq]; legT6 = {'Vab','Vbc','Vca','Q total'};
    if hasCmdQ6
        pCmdQ = stairs(tt6, cmdQ6, '--', 'LineWidth', 1.8, 'Color', cmdQColor);
        legH6(end+1) = pCmdQ; legT6{end+1} = 'Q command from NCC';
    end
    hold off
    ylabel('Reactive Power (MVar)'); ylim(centeredYLim([M6.Q_MVar; cmdQ6], Q_center_MVar, 1.05));
    title([plantTitles{p} ' | Reactive Power & Voltage']);
    legend(legH6, legT6, 'Location','northwest');
    xlim([Result.(plantKey).dayStart Result.(plantKey).dayEnd]);
    xticks(Result.(plantKey).dayStart:dtTick:Result.(plantKey).dayEnd);
    xtickformat('HH:mm'); xtickangle(45);
    if p == numel(plantTitles), xlabel('Time'); end
end

sgtitle([fig6Stamp ' | Reactive Power & Voltage (All Plants)'], 'FontWeight','bold');
f6name = fullfile(allPlantDir, ['2. ' fig6Stamp '_SNTL400MWH_ReactivePower_Voltage_AllPlants.fig']);
savefig(f6, f6name); close(f6);

%% ================= ADD HISTORICAL DATA =================
Historical = struct();
Historical.meta.mainDataRootFolder = mainDataRootFolder;
Historical.meta.source = 'ESS and SmartLogger subfolders inside each Plant folder';

if exist(mainDataRootFolder,'dir')
    try
        [Historical, dbgLines] = loadHistoricalStructuredFolder(mainDataRootFolder, plantFolderNames, ...
            subFolder_ESS, subFolder_SmartLogger, dbgLines, DEBUG);
    catch ME
        dbgLines = dbg(dbgLines, "WARNING: Historical load failed: %s", ME.message);
    end
else
    dbgLines = dbg(dbgLines, "WARNING: mainDataRootFolder not found: %s", mainDataRootFolder);
end

%% ================= EXPORT DEBUG / DISPATCH / MAT =================
allStarts = NaT(0,1);
for p = 1:numel(plantTitles)
    plantKey = matlab.lang.makeValidName("Plant_" + string(p));
    if isfield(Result, plantKey) && isfield(Result.(plantKey), "dayStart")
        allStarts(end+1,1) = Result.(plantKey).dayStart;
    end
end
if ~isempty(allStarts)
    dataStampGlobal = datestr(min(allStarts),'yyyymmdd');
else
    dataStampGlobal = datestr(now,'yyyymmdd');
end

debugDateStr = datestr(datetime(dataStampGlobal,'InputFormat','yyyyMMdd'),'yyyy-mm-dd');
outXlsx = fullfile(resultDir, ['Realtime_Data_Debug_' debugDateStr '.xlsx']);
matFile = fullfile(resultDir, ['1. SNTL400MWH_', dataStampGlobal, '_data.mat']);

try
    Tlog = table(dbgLines, 'VariableNames', {'Message'});
    writetable(Tlog, outXlsx, 'Sheet', 'Message');
    fprintf('\n[INFO] Debug exported to:\n%s\n', outXlsx);
catch ME
    warning('Failed to write debug Excel: %s', ME.message);
end
try
    save(matFile, 'P_Q_V_F_SOC_Raw_Data', 'Historical', 'DispatchTT', '-v7.3');
    fprintf('\n[INFO] Saved RAW DATA + HISTORICAL RAW DATA + DISPATCH MAT file to:\n%s\n', matFile);
catch ME
    warning('Failed to save MAT file: %s', ME.message);
end

set(0,'DefaultFigureVisible','on');
fprintf('\n[DONE]\nOutput folder:\n%s\n', resultDir);

%% ================= LOCAL FUNCTIONS =================
function dbgLines = dbg(dbgLines, fmt, varargin)
    if nargin == 2
        line = string(fmt);
    else
        line = string(sprintf(fmt, varargin{:}));
    end
    fprintf('%s\n', line);
    dbgLines(end+1,1) = line;
end

function s = quoteOrNone(x)
    if isempty(x) || string(x) == ""
        s = "(none)";
    else
        s = string(sprintf('\"%s\"', char(string(x))));
    end
end

function dbgLines = appendColumnListDebug(dbgLines, cols)
    cols = string(cols(:));
    cols = cols(cols ~= "");
    if isempty(cols)
        dbgLines = dbg(dbgLines, "  (none)");
        return;
    end
    for i = 1:numel(cols)
        dbgLines = dbg(dbgLines, "  %s", quoteOrNone(cols(i)));
    end
end

function dbgLines = appendFeederCoverageDebug(dbgLines, T, feedersWanted, pqType)
    if isempty(T)
        dbgLines = dbg(dbgLines, "  No %s realtime table available.", pqType);
        return;
    end

    vars = string(T.Properties.VariableNames);
    vlow = lower(vars);
    foundIDs = strings(0,1);

    for f = 1:numel(feedersWanted)
        feederID = string(feedersWanted(f));
        hitCols = strings(0,1);

        for i = 1:numel(vars)
            nmLow = vlow(i);
            if ~isFeederColumnName(nmLow, feederID)
                continue;
            end
            if upper(string(pqType)) == "P"
                isPQCol = isPColumnName(nmLow);
            else
                isPQCol = isQColumnName(nmLow);
            end
            if isPQCol
                hitCols(end+1,1) = vars(i); %#ok<AGROW>
            end
        end

        if ~isempty(hitCols)
            foundIDs(end+1,1) = feederID; %#ok<AGROW>
            for k = 1:numel(hitCols)
                dbgLines = dbg(dbgLines, "  Found feeder %s: %s", feederID, quoteOrNone(hitCols(k)));
            end
        end
    end

    missingIDs = setdiff(string(feedersWanted(:)), foundIDs, 'stable');
    if isempty(missingIDs)
        dbgLines = dbg(dbgLines, "  Missing feeder %s IDs: (none)", upper(string(pqType)));
    else
        dbgLines = dbg(dbgLines, "  Missing feeder %s IDs: %s", upper(string(pqType)), strjoin(missingIDs, ", "));
    end
end

function tf = isFeederColumnName(nmLow, feederID)
    idNum = str2double(feederID);
    id1 = string(idNum);          % 03 -> 3
    id2 = sprintf('%02d', idNum); % 3 -> 03
    patterns = [
        "f" + id1
        "f" + id2
        "-f" + id1
        "-f" + id2
        "feeder" + id1
        "feeder" + id2
        "incoming-f" + id1
        "incoming-f" + id2
    ];
    tf = any(contains(string(nmLow), patterns));
end
function tf = isPColumnName(nmLow)

    nmLow = string(nmLow);

    if contains(nmLow,"reactive") || contains(nmLow,"q(") || ...
       contains(nmLow,"q（") || contains(nmLow," q ")
        tf = false;
        return;
    end
    tf = contains(nmLow,"active") || ...
         contains(nmLow,"p(") || ...
         contains(nmLow,"p（") || ...
         contains(nmLow,"p kw") || ...
         contains(nmLow,"p mw") || ...
         contains(nmLow,"kw") || ...
         contains(nmLow,"mw");
end

function tf = isQColumnName(nmLow)
    nmLow = string(nmLow);
    tf = contains(nmLow,"reactive") || ...
         contains(nmLow,"q(") || ...
         contains(nmLow,"q（") || ...
         contains(nmLow,"q kvar") || ...
         contains(nmLow,"q mvar") || ...
         contains(nmLow,"kvar") || ...
         contains(nmLow,"mvar");
end

function dbgLines = addStructuredFolderCheck(dbgLines, mainDataRootFolder, plantFolderNames, plantTitles, expectedSubFolders, pocFolderName, keyword1, keyword2, FeedersByPlant)
    dbgLines = dbg(dbgLines, "");
    dbgLines = dbg(dbgLines, "=============================================");
    dbgLines = dbg(dbgLines, "Structured Folder Check");
    dbgLines = dbg(dbgLines, "Expected plant folders: Plant_01, Plant_02, Plant_03");
    dbgLines = dbg(dbgLines, "Expected subfolders in each plant: ESR, ESS, POC, SmartLogger");
    dbgLines = dbg(dbgLines, "POC rule: Remote Active file name contains both Remote + Active; other Excel files are realtime data.");
    dbgLines = dbg(dbgLines, "Realtime dispatch sheet export: DISABLED");
    dbgLines = dbg(dbgLines, "=============================================");

    for p = 1:numel(plantFolderNames)
        plantFolder = resolveSubFolder(mainDataRootFolder, plantFolderNames{p});

        dbgLines = dbg(dbgLines, "");
        dbgLines = dbg(dbgLines, "[CHECK] %s", plantTitles{p});
        dbgLines = dbg(dbgLines, "  Expected feeders: %s", strjoin(string(FeedersByPlant{p}), ", "));

        if plantFolder == ""
            dbgLines = dbg(dbgLines, "  Status: NOT READY");
            dbgLines = dbg(dbgLines, "  Missing plant folder: %s", plantFolderNames{p});
            continue;
        end

        foundCount = 0;
        missingFolders = strings(0,1);

        for i = 1:numel(expectedSubFolders)
            subName = string(expectedSubFolders{i});
            subPath = resolveSubFolder(plantFolder, subName);
            if subPath ~= ""
                foundCount = foundCount + 1;
            else
                missingFolders(end+1,1) = subName;
            end
        end

        dbgLines = dbg(dbgLines, "  Subfolder check: %d/4 found", foundCount);

        if isempty(missingFolders)
            dbgLines = dbg(dbgLines, "  Missing subfolders: None");
        else
            dbgLines = dbg(dbgLines, "  Missing subfolders: %s", strjoin(missingFolders, ", "));
        end

        pocFolder = resolveSubFolder(plantFolder, pocFolderName);
        if pocFolder == ""
            dbgLines = dbg(dbgLines, "  POC status: NOT READY - POC folder missing");
            continue;
        end

        filesAll = [dir(fullfile(pocFolder,'**','*.xlsx')); dir(fullfile(pocFolder,'**','*.xls'))];
        filesAll = filesAll(~startsWith({filesAll.name}, '~$'));

        isRemoteFile = false(numel(filesAll),1);
        for ii = 1:numel(filesAll)
            fnLow = lower(string(filesAll(ii).name));
            isRemoteFile(ii) = contains(fnLow, keyword1) && contains(fnLow, keyword2);
        end

        remoteCount = sum(isRemoteFile);
        realtimeCount = numel(filesAll) - remoteCount;

        dbgLines = dbg(dbgLines, "  POC Excel check:");
        dbgLines = dbg(dbgLines, "    Remote Active Excel files: %d", remoteCount);
        dbgLines = dbg(dbgLines, "    Realtime Excel files: %d", realtimeCount);

        if remoteCount == 1 && realtimeCount == 2 && isempty(missingFolders)
            dbgLines = dbg(dbgLines, "  Status: READY");
        else
            dbgLines = dbg(dbgLines, "  Status: CHECK REQUIRED");
            if remoteCount ~= 1
                dbgLines = dbg(dbgLines, "    Expected Remote Active Excel files: 1");
            end
            if realtimeCount ~= 2
                dbgLines = dbg(dbgLines, "    Expected realtime Excel files: 2");
            end
        end
    end
end

function [G, dbgLines] = readFileGroup(fpaths, groupName, dbgLines, DEBUG)
    G = emptyFileGroup();
    G.files = string(fpaths(:));
    G.tables = cell(numel(G.files),1);
    G.readOk = false(numel(G.files),1);
    G.error = strings(numel(G.files),1);

    if isempty(G.files)
        return;
    end

    for i = 1:numel(G.files)
        fp = G.files(i);
        [~, baseName, ext] = fileparts(fp);
        shortName = string(baseName) + string(ext);

        try
            if endsWith(lower(fp), ".csv")
                T = readtable(fp, 'PreserveVariableNames', true);
            else
                T = readtable(fp, 'PreserveVariableNames', true);
            end

            G.tables{i} = T;
            G.readOk(i) = true;
        catch ME
            G.error(i) = string(ME.message);
            if DEBUG
                dbgLines = dbg(dbgLines, "  [SKIP Historical] %s | %s", shortName, ME.message);
            end
        end
    end

    if DEBUG
        dbgLines = dbg(dbgLines, "  [Historical] %s loaded: %d/%d files", groupName, sum(G.readOk), numel(G.files));
    end
end

function nameOnly = getFileNameOnly(filePath)
    [~, n, e] = fileparts(string(filePath));
    nameOnly = n + e;
end

function Tout = appendUnionSmart(Tout, Tin)
    if isempty(Tout), Tout = Tin; return; end
    vars = unique([string(Tout.Properties.VariableNames), string(Tin.Properties.VariableNames)], 'stable');
    for v = vars
        if ~ismember(v, string(Tout.Properties.VariableNames))
            Tout.(v) = createMissingLikeFromTable(Tin, v, height(Tout));
        end
        if ~ismember(v, string(Tin.Properties.VariableNames))
            Tin.(v) = createMissingLikeFromTable(Tout, v, height(Tin));
        end
    end
    Tout = Tout(:, vars);
    Tin = Tin(:, vars);
    Tout = [Tout; Tin];
end

function out = createMissingLikeFromTable(Tref, varName, n)
    if ismember(varName, string(Tref.Properties.VariableNames))
        x = Tref.(varName);
        if isdatetime(x), out = NaT(n,1);
        elseif isstring(x), out = strings(n,1);
        elseif iscell(x), out = cell(n,1);
        elseif isnumeric(x) || islogical(x), out = nan(n,1);
        else, out = strings(n,1); 
        end
    else
        out = nan(n,1);
    end
end

function timeVar = findTimeVarName(T)
    timeVar = "";
    if isempty(T), return; end
    vars = string(T.Properties.VariableNames);
    idx = find(strcmpi(vars,"Time"),1); if ~isempty(idx), timeVar = vars(idx); return; end
    idx = find(strcmpi(vars,"DateTime"),1); if ~isempty(idx), timeVar = vars(idx); return; end
    idx = find(strcmpi(vars,"Datetime"),1); if ~isempty(idx), timeVar = vars(idx); return; end
    idx = find(contains(lower(vars),"time"),1); if ~isempty(idx), timeVar = vars(idx); end
end

function t = parseTimeColumn(x)
    t = NaT(size(x));
    if isnumeric(x)
        try, t = datetime(x, 'ConvertFrom','excel', 'Format','yyyy-MM-dd HH:mm:ss'); catch, end
        return;
    end
    if isdatetime(x), t = x; return; end

    x = string(x); x = strip(x);
    bad = x=="Average" | x=="Max" | x=="Min" | x=="" | ismissing(x);
    x(bad) = missing;
    idx = ~ismissing(x);
    if ~any(idx), return; end

    fmts = ["yyyy-MM-dd HH:mm:ss";"yyyy/MM/dd HH:mm:ss";"dd/MM/yyyy HH:mm:ss";"dd-MM-yyyy HH:mm:ss";"MM/dd/yyyy HH:mm:ss";"dd/MM/yyyy HH:mm";"dd-MM-yyyy HH:mm";"yyyy-MM-dd HH:mm";"yyyy/MM/dd HH:mm";"dd-MMM-yyyy HH:mm:ss";"dd-MMM-yyyy HH:mm";"MM/dd/yyyy hh:mm:ss a";"dd/MM/yyyy hh:mm:ss a";"MM/dd/yyyy hh:mm a";"dd/MM/yyyy hh:mm a"];

    for f = 1:numel(fmts)
        try
            tf = datetime(x(idx), 'InputFormat', fmts(f), 'Format','yyyy-MM-dd HH:mm:ss');
            ok = ~isnat(tf);
            if any(ok)
                tmp = t(idx); tmp(ok) = tf(ok); t(idx) = tmp;
            end
        catch
        end
        if all(~isnat(t(idx))), break; end
    end

    still = idx & isnat(t);
    if any(still)
        try, t(still) = datetime(x(still), 'Format','yyyy-MM-dd HH:mm:ss'); catch, end
    end
end

function nameOut = findVarContains(T, key)
    nameOut = "";
    if isempty(T), return; end
    vars = string(T.Properties.VariableNames);
    hit = vars(contains(lower(vars), lower(key)));
    if ~isempty(hit), nameOut = hit(1); end
end

function namesOut = findVarsContains(T, key)
    namesOut = strings(0,1);
    if isempty(T), return; end
    vars = string(T.Properties.VariableNames);
    namesOut = vars(contains(lower(vars), lower(key)))';
end

function namesOut = findVars2Contains(T, key1, key2)
    namesOut = strings(0,1);
    if isempty(T), return; end
    vars = string(T.Properties.VariableNames);
    namesOut = vars(contains(lower(vars), lower(key1)) & contains(lower(vars), lower(key2)))';
end

function [picked, note] = pickOneSourceFromCandidates(candidates, feederIDs)
    picked = ""; note = "no candidates found";
    if isempty(candidates), return; end
    for i = 1:numel(candidates)
        nmLow = lower(string(candidates(i)));
        for f = 1:numel(feederIDs)
            id = feederIDs(f);
            pat = "(^|[^0-9])" + id + "([^0-9]|$)";
            pat2 = "(^|[^0-9])f" + id + "([^0-9]|$)";
            if ~isempty(regexp(nmLow, pat, 'once')) || ~isempty(regexp(nmLow, pat2, 'once'))
                picked = candidates(i); note = "matched feeder " + id; return;
            end
        end
    end
    picked = candidates(1); note = "fallback: first available";
end

function [feederID, how] = pickOneFeederIDForVoltage(vabCandidates, feederIDs)
    feederID = ""; how = "none";
    if isempty(vabCandidates), return; end
    for i = 1:numel(vabCandidates)
        nmLow = lower(string(vabCandidates(i)));
        for f = 1:numel(feederIDs)
            id = feederIDs(f);
            pat = "(^|[^0-9])" + id + "([^0-9]|$)";
            pat2 = "(^|[^0-9])f" + id + "([^0-9]|$)";
            if ~isempty(regexp(nmLow, pat, 'once')) || ~isempty(regexp(nmLow, pat2, 'once'))
                feederID = id; how = "matched configured feeders list"; return;
            end
        end
    end
    nm = lower(string(vabCandidates(1)));
    tok = regexp(nm, 'incoming\-f(\d+)', 'tokens', 'once');
    if ~isempty(tok), feederID = sprintf('%02d', str2double(tok{1})); how = "extracted from Vab name"; return; end
    tok = regexp(nm, 'f(\d+)', 'tokens', 'once');
    if ~isempty(tok), feederID = sprintf('%02d', str2double(tok{1})); how = "extracted from Vab name"; return; end
end

function col = pickColumnMatchingFeeder(candidates, feederID)
    col = "";
    if isempty(candidates) || feederID=="", return; end
    id = string(feederID);
    for i = 1:numel(candidates)
        nmLow = lower(string(candidates(i)));
        pat = "(^|[^0-9])" + id + "([^0-9]|$)";
        pat2 = "(^|[^0-9])f" + id + "([^0-9]|$)";
        if ~isempty(regexp(nmLow, pat, 'once')) || ~isempty(regexp(nmLow, pat2, 'once'))
            col = candidates(i); return;
        end
    end
    col = candidates(1);
end

function vec = safeToDouble(x)
    if isnumeric(x), vec = double(x); return; end
    if islogical(x), vec = double(x); return; end
    x = string(x); x = strip(x); x(x=="--" | x=="") = missing;
    vec = str2double(x);
end

function y = fillPrev(y)
    if isempty(y), return; end
    firstValid = find(~isnan(y), 1, 'first');
    if ~isempty(firstValid) && firstValid > 1, y(1:firstValid-1) = y(firstValid); end
    for i = 2:numel(y)
        if isnan(y(i)), y(i) = y(i-1); end
    end
end

function v = getAndFill(T, varName)
    if varName ~= "" && ismember(varName, string(T.Properties.VariableNames))
        v = safeToDouble(T.(varName)); v = fillPrev(v);
    else
        v = nan(height(T),1);
    end
end

function TT = mergeDuplicatesLastNonNan(TT)
    if isempty(TT), return; end
    TT = sortrows(TT);
    [G, tu] = findgroups(TT.Properties.RowTimes);
    newVars = TT.Properties.VariableNames;
    newData = cell(1, numel(newVars));
    for k = 1:numel(newVars)
        x = TT.(newVars{k});
        newData{k} = splitapply(@lastNonNanGeneric, x, G);
    end
    TT = timetable(tu, newData{:}, 'VariableNames', newVars);
    TT = sortrows(TT);
end

function y = lastNonNanGeneric(v)
    if isdatetime(v)
        idx = find(~isnat(v), 1, 'last'); if isempty(idx), y = NaT; else, y = v(idx); end
    elseif isnumeric(v)
        idx = find(~isnan(v), 1, 'last'); if isempty(idx), y = NaN; else, y = v(idx); end
    elseif isstring(v)
        idx = find(v~="", 1, 'last'); if isempty(idx), y = ""; else, y = v(idx); end
    else
        y = v(end);
    end
end

function yl = centeredYLim(y, centerValue, marginFactor)
    if nargin < 3, marginFactor = 1.05; end
    y = y(:); y = y(~isnan(y));
    if isempty(y), yl = [centerValue-1, centerValue+1]; return; end
    dev = max(abs(y - centerValue));
    if dev == 0, dev = 1e-3; end
    dev = dev * marginFactor;
    yl = [centerValue - dev, centerValue + dev];
end

function [Pvec, colsUsed, sourceNote, unit] = getPlantSystemTotalP_MW(T)
    Pvec = []; colsUsed = strings(0,1); sourceNote = "system total P not found"; unit = "";
    if isempty(T), return; end
    vars = string(T.Properties.VariableNames); vlow = lower(vars);
    hitMW = vars(contains(vlow,"plant_systemtotal") & contains(vlow,"active") & contains(vlow,"plant") & contains(vlow,"mw"));
    if isempty(hitMW), hitMW = vars(contains(vlow,"systemtotal") & contains(vlow,"active") & contains(vlow,"mw")); end
    if ~isempty(hitMW), col = hitMW(1); Pvec = safeToDouble(T.(col)); colsUsed = string(col); sourceNote = "plant_systemTotal active power"; unit = "MW"; return; end
    hitKW = vars(contains(vlow,"plant_systemtotal") & contains(vlow,"active") & contains(vlow,"plant") & contains(vlow,"kw"));
    if isempty(hitKW), hitKW = vars(contains(vlow,"systemtotal") & contains(vlow,"active") & contains(vlow,"kw")); end
    if ~isempty(hitKW), col = hitKW(1); Pvec = safeToDouble(T.(col)); colsUsed = string(col); sourceNote = "plant_systemTotal active power"; unit = "kW"; return; end
end

function [Qvec, colsUsed, sourceNote, unit] = getPlantSystemTotalQ_MVar(T)
    Qvec = []; colsUsed = strings(0,1); sourceNote = "system total Q not found"; unit = "";
    if isempty(T), return; end
    vars = string(T.Properties.VariableNames); vlow = lower(vars);
    hitMV = vars(contains(vlow,"plant_systemtotal") & contains(vlow,"reactive") & contains(vlow,"plant") & contains(vlow,"mvar"));
    if isempty(hitMV), hitMV = vars(contains(vlow,"systemtotal") & contains(vlow,"reactive") & contains(vlow,"mvar")); end
    if ~isempty(hitMV), col = hitMV(1); Qvec = safeToDouble(T.(col)); colsUsed = string(col); sourceNote = "plant_systemTotal reactive power"; unit = "MVar"; return; end
    hitKV = vars(contains(vlow,"plant_systemtotal") & contains(vlow,"reactive") & contains(vlow,"plant") & contains(vlow,"kvar"));
    if isempty(hitKV), hitKV = vars(contains(vlow,"systemtotal") & contains(vlow,"reactive") & contains(vlow,"kvar")); end
    if ~isempty(hitKV), col = hitKV(1); Qvec = safeToDouble(T.(col)); colsUsed = string(col); sourceNote = "plant_systemTotal reactive power"; unit = "kvar"; return; end
end

function [Psum, colsUsed, unit] = sumPByFeeders_Strict_UnitAware(T, feederIDs)
    colsUsed = strings(0,1); unit = "";
    if isempty(T), Psum = []; return; end
    vars = string(T.Properties.VariableNames); vlow = lower(vars);
    pkwMask = ~cellfun(@isempty, regexp(vlow, '\sp[\(\（]\s*kw\s*[\)\）]', 'once'));
    pmwMask = ~cellfun(@isempty, regexp(vlow, '\sp[\(\（]\s*mw\s*[\)\）]', 'once'));
    if any(pmwMask), pCandidates = vars(pmwMask); unit = "MW"; else, pCandidates = vars(pkwMask); unit = "kW"; end
    keep = false(size(pCandidates));
    for i = 1:numel(pCandidates)
        nmLow = lower(string(pCandidates(i)));
        for f = 1:numel(feederIDs)
            id = feederIDs(f); pat = "(^|[^0-9])" + id + "([^0-9]|$)"; pat2 = "(^|[^0-9])f" + id + "([^0-9]|$)";
            if ~isempty(regexp(nmLow, pat, 'once')) || ~isempty(regexp(nmLow, pat2, 'once')), keep(i) = true; break; end
        end
    end
    hit = unique(pCandidates(keep), 'stable'); colsUsed = hit(:);
    Psum = zeros(height(T),1);
    for i = 1:numel(hit), Psum = Psum + safeToDouble(T.(hit(i))); end
end

function [Qsum, colsUsed, unit] = sumQByFeeders_Strict_UnitAware(T, feederIDs)
    colsUsed = strings(0,1); unit = "";
    if isempty(T), Qsum = []; return; end
    vars = string(T.Properties.VariableNames); vlow = lower(vars);
    qkvarMask = ~cellfun(@isempty, regexp(vlow, '\sq[\(\（]\s*kvar\s*[\)\）]', 'once'));
    qmvarMask = ~cellfun(@isempty, regexp(vlow, '\sq[\(\（]\s*mvar\s*[\)\）]', 'once'));
    if any(qmvarMask), qCandidates = vars(qmvarMask); unit = "MVar"; else, qCandidates = vars(qkvarMask); unit = "kvar"; end
    keep = false(size(qCandidates));
    for i = 1:numel(qCandidates)
        nmLow = lower(string(qCandidates(i)));
        for f = 1:numel(feederIDs)
            id = feederIDs(f); pat = "(^|[^0-9])" + id + "([^0-9]|$)"; pat2 = "(^|[^0-9])f" + id + "([^0-9]|$)";
            if ~isempty(regexp(nmLow, pat, 'once')) || ~isempty(regexp(nmLow, pat2, 'once')), keep(i) = true; break; end
        end
    end
    hit = unique(qCandidates(keep), 'stable'); colsUsed = hit(:);
    Qsum = zeros(height(T),1);
    for i = 1:numel(hit), Qsum = Qsum + safeToDouble(T.(hit(i))); end
end

function [CmdTT, dbgLines] = loadCmdFolder(cmdFolder, dbgLines, DEBUG)
    cmdFiles = [dir(fullfile(cmdFolder,'**','*.xlsx')); dir(fullfile(cmdFolder,'**','*.xls'))];
    cmdFiles = cmdFiles(~startsWith({cmdFiles.name}, '~$'));
    if isempty(cmdFiles), dbgLines = dbg(dbgLines, "WARNING: No Excel files found in cmdFolder: %s", cmdFolder); CmdTT = timetable(); return; end
    Tall = table(); nRead = 0;
    for k = 1:numel(cmdFiles)
        fp = fullfile(cmdFiles(k).folder, cmdFiles(k).name);
        try
            T = readtable(fp, 'PreserveVariableNames', true);
            vars = string(T.Properties.VariableNames); normKeys = normalizeColName(vars);
            map = containers.Map('KeyType','char','ValueType','char');
            for i = 1:numel(vars), map(char(normKeys(i))) = char(vars(i)); end
            getReal = @(desired) getByNormalized(map, desired);
            realDatetime = getReal("Datetime");
            realP1 = getReal("SWG01 P(MW)"); realQ1 = getReal("SWG01 Q(MVAR)");
            realP2 = getReal("SWG02 P(MW)"); realQ2 = getReal("SWG02 Q(MVAR)");
            if realDatetime=="" || any([realP1 realQ1 realP2 realQ2]==""), continue; end
            realSOC1 = getReal("SWG01 SOC(%)"); realSOC2 = getReal("SWG02 SOC(%)");
            Tout = table(); Tout.DateTime = T.(realDatetime);
            Tout.SWG01_MW = T.(realP1); Tout.SWG01_Mvar = T.(realQ1);
            Tout.SWG02_MW = T.(realP2); Tout.SWG02_Mvar = T.(realQ2);
            if realSOC1 ~= "", Tout.SWG01_SOC = T.(realSOC1); else, Tout.SWG01_SOC = NaN(height(T),1); end
            if realSOC2 ~= "", Tout.SWG02_SOC = T.(realSOC2); else, Tout.SWG02_SOC = NaN(height(T),1); end
            Tall = appendUnionSmart(Tall, Tout); nRead = nRead + 1;
            if DEBUG, dbgLines = dbg(dbgLines, "  [OK CMD] %s", cmdFiles(k).name); end
        catch ME
            dbgLines = dbg(dbgLines, "  [SKIP CMD] %s | %s", cmdFiles(k).name, ME.message);
        end
    end
    if nRead == 0, CmdTT = timetable(); return; end
    Tall.Time = parseTimeColumn(Tall.DateTime); Tall = Tall(~isnat(Tall.Time), :); Tall = sortrows(Tall, "Time");
    colsToNum = ["SWG01_MW","SWG02_MW","SWG01_Mvar","SWG02_Mvar","SWG01_SOC","SWG02_SOC"];
    for c = colsToNum
        if ismember(c, string(Tall.Properties.VariableNames)), Tall.(c) = fillPrev(safeToDouble(Tall.(c))); end
    end
    CmdTT = timetable(Tall.Time, Tall.SWG01_MW, Tall.SWG02_MW, Tall.SWG01_Mvar, Tall.SWG02_Mvar, Tall.SWG01_SOC, Tall.SWG02_SOC, ...
        'VariableNames', {'SWG01_MW','SWG02_MW','SWG01_Mvar','SWG02_Mvar','SWG01_SOC','SWG02_SOC'});
    CmdTT = mergeDuplicatesLastNonNan(CmdTT);
end

function norm = normalizeColName(names)
    s = lower(string(names)); s = replace(s, [" ", char(9), "_"], ""); s = replace(s, ["（","）","(",")","%"], ""); s = replace(s, ["mvar","mvars"], "mvar"); s = replace(s, ["datetime","date_time"], "datetime"); norm = s;
end

function realName = getByNormalized(map, desiredLabel)
    key = char(normalizeColName(desiredLabel));
    if isKey(map, key), realName = string(map(key)); else, realName = ""; end
end

function [Historical, dbgLines] = loadHistoricalStructuredFolder(mainDataRootFolder, plantFolderNames, essFolderName, smartFolderName, dbgLines, DEBUG)
    Historical = struct();
    Historical.meta.mainDataRootFolder = mainDataRootFolder;
    Historical.meta.plantFolderNames = plantFolderNames;

    for p = 1:numel(plantFolderNames)
        plantKey = matlab.lang.makeValidName("Plant_" + string(p));
        plantFolder = resolveSubFolder(mainDataRootFolder, plantFolderNames{p});

        Historical.(plantKey) = struct();
        Historical.(plantKey).plantFolder = plantFolder;

        if plantFolder == ""
            dbgLines = dbg(dbgLines, "WARNING: Historical folder missing for %s.", plantFolderNames{p});
            Historical.(plantKey).ESS_data = emptyFileGroup();
            Historical.(plantKey).SmartLog = emptyFileGroup();
            continue;
        end

        essFolder = resolveSubFolder(plantFolder, essFolderName);
        smartFolder = resolveSubFolder(plantFolder, smartFolderName);

        essFiles = listDataFiles(essFolder);
        smartFiles = listDataFiles(smartFolder);

        if essFolder == ""
            dbgLines = dbg(dbgLines, "WARNING: ESS historical folder missing for %s.", plantFolderNames{p});
        end
        if smartFolder == ""
            dbgLines = dbg(dbgLines, "WARNING: SmartLogger historical folder missing for %s.", plantFolderNames{p});
        end

        Historical.(plantKey).ESS_folder = essFolder;
        Historical.(plantKey).SmartLogger_folder = smartFolder;
        [Historical.(plantKey).ESS_data, dbgLines] = readFileGroup(essFiles, plantKey + "_ESS_data", dbgLines, DEBUG);
        [Historical.(plantKey).SmartLog, dbgLines] = readFileGroup(smartFiles, plantKey + "_SmartLog", dbgLines, DEBUG);
    end
end

function G = emptyFileGroup()
    G = struct(); G.files = strings(0,1); G.tables = cell(0,1);G.readOk = false(0,1);G.error = strings(0,1);
end

function fpaths = listDataFiles(folderPath)
    if folderPath == "" || ~exist(folderPath,'dir')
        fpaths = strings(0,1);
        return;
    end
    allFiles = [dir(fullfile(folderPath,'**','*.xlsx')); dir(fullfile(folderPath,'**','*.xls')); dir(fullfile(folderPath,'**','*.csv'))];
    allFiles = allFiles(~startsWith({allFiles.name}, '~$'));
    fpaths = string(fullfile({allFiles.folder},{allFiles.name}))';
end

function folderPath = resolveSubFolder(parentFolder, wantedName)
    folderPath = "";
    if ~exist(parentFolder,'dir'), return; end

    directPath = fullfile(parentFolder, wantedName);
    if exist(directPath,'dir')
        folderPath = string(directPath);
        return;
    end
    d = dir(parentFolder);
    d = d([d.isdir]);
    d = d(~ismember({d.name},{'.','..'}));
    names = string({d.name});
    idx = find(strcmpi(names, string(wantedName)), 1, 'first');
    if isempty(idx)
        idx = find(contains(lower(names), lower(string(wantedName))), 1, 'first');
    end
    if ~isempty(idx)
        folderPath = string(fullfile(d(idx).folder, d(idx).name));
    end
end

function [RemoteTT, RemoteRawTable, dbgLines] = loadRemoteActivePowerFromPOC(pocFolder, keyword1, keyword2, dayStart, dayEnd, dbgLines, DEBUG)
    RemoteTT = timetable(); RemoteRawTable = table(); plantFolder = pocFolder;
    if plantFolder == "" || ~exist(plantFolder,'dir'), dbgLines = dbg(dbgLines, "WARNING: POC folder for Remote Active Power not found."); return; end
    filesAll = [dir(fullfile(plantFolder,'**','*.xlsx')); dir(fullfile(plantFolder,'**','*.xls'))];
    filesAll = filesAll(~startsWith({filesAll.name}, '~$'));
    useFile = false(numel(filesAll),1);
    for ii = 1:numel(filesAll)
        fnLow = lower(string(filesAll(ii).name));
        useFile(ii) = contains(fnLow, keyword1) && contains(fnLow, keyword2);
    end
    files = filesAll(useFile);
    if isempty(files), dbgLines = dbg(dbgLines, "WARNING: No Remote Active Power Excel found in POC by keyword Remote + Active."); return; end
    Tall = table();
    for k = 1:numel(files)
        fp = fullfile(files(k).folder, files(k).name);
        try
            T = readtable(fp, 'PreserveVariableNames', true); vars = string(T.Properties.VariableNames);
            timeCol = vars(1); pCol = vars(2); timeText = strip(string(T.(timeCol)));
            isDataRow = ~(lower(timeText)=="average" | lower(timeText)=="max" | lower(timeText)=="min" | timeText=="");
            T = T(isDataRow, :);
            Tout = table(); Tout.Time = parseTimeColumn(T.(timeCol)); Tout.RemoteP_kW = safeToDouble(T.(pCol));
            Tout = Tout(~isnat(Tout.Time), :); Tout = Tout(~isnan(Tout.RemoteP_kW), :);
            Tall = appendUnionSmart(Tall, Tout);
            if DEBUG, dbgLines = dbg(dbgLines, "  [OK Remote] %s", files(k).name); end
        catch ME
            dbgLines = dbg(dbgLines, "  [SKIP Remote] %s | %s", files(k).name, ME.message);
        end
    end
    if isempty(Tall), dbgLines = dbg(dbgLines, "WARNING: No usable Remote Active Power data in POC."); return; end
    Tall = sortrows(Tall, "Time"); Tall = Tall(Tall.Time >= dayStart & Tall.Time <= dayEnd, :);
    if isempty(Tall), dbgLines = dbg(dbgLines, "WARNING: Remote Active Power data is not in selected date range."); return; end
    Tall.RemoteP_MW = Tall.RemoteP_kW / 1000;
    RemoteRawTable = table(Tall.Time, Tall.RemoteP_kW, Tall.RemoteP_MW, 'VariableNames', {'Time','RemoteP_kW','RemoteP_MW'});
    RemoteTT = timetable(Tall.Time, Tall.RemoteP_MW, 'VariableNames', {'RemoteP_MW'});
    RemoteTT = mergeDuplicatesLastNonNan(RemoteTT);
end

function [tHit, yHit] = detectFirstHitInRange(tt, socVec, rng2, tAfter)
    tHit = NaT;
    yHit = NaN;
    if isempty(tt) || isempty(socVec), return; end

    socVec = socVec(:);
    tt = tt(:);

    inBand = socVec >= rng2(1) & socVec <= rng2(2) & ~isnan(socVec);

    if ~isnat(tAfter)
        inBand = inBand & (tt > tAfter);
    end

    idx = find(inBand, 1, 'first');
    if isempty(idx), return; end

    tHit = tt(idx);
    yHit = socVec(idx);
end

function [tHit, yHit] = detectMaxSOCPoint(tt, socVec)
    tHit = NaT;
    yHit = NaN;

    if isempty(tt) || isempty(socVec), return; end

    socVec = socVec(:);
    tt     = tt(:);

    valid = ~isnan(socVec) & ~isnat(tt);
    if ~any(valid), return; end

    socValid = socVec(valid);
    ttValid  = tt(valid);

    yMax = max(socValid);
    idx  = find(socValid == yMax, 1, 'first');
    if isempty(idx), return; end

    tHit = ttValid(idx);
    yHit = socValid(idx);
end

function [tHit, yHit] = detectMinSOCPoint(tt, socVec, tAfter)
    tHit = NaT;
    yHit = NaN;

    if isempty(tt) || isempty(socVec), return; end

    socVec = socVec(:);
    tt     = tt(:);

    valid = ~isnan(socVec) & ~isnat(tt);

    if ~isnat(tAfter)
        valid = valid & (tt > tAfter);
    end

    if ~any(valid), return; end

    socValid = socVec(valid);
    ttValid  = tt(valid);

    yMin = min(socValid);
    idx  = find(socValid == yMin, 1, 'first');
    if isempty(idx), return; end

    tHit = ttValid(idx);
    yHit = socValid(idx);
end

function [tLow, yLow, usedBand] = detectLowSOCAfterHigh(tt, socVec, lowRng, tHigh)
    tLow = NaT;
    yLow = NaN;
    usedBand = false;

    if isempty(tt) || isempty(socVec)
        return;
    end

    socVec = socVec(:);
    tt     = tt(:);

    if ~isnat(tHigh)
        [tBand, yBand] = detectFirstHitInRange(tt, socVec, lowRng, tHigh);
        if ~isnat(tBand)
            tLow = tBand;
            yLow = yBand;
            usedBand = true;
            return;
        end

        [tMinAfter, yMinAfter] = detectMinSOCPoint(tt, socVec, tHigh);
        if ~isnat(tMinAfter)
            tLow = tMinAfter;
            yLow = yMinAfter;
            usedBand = false;
            return;
        end
    end

    [tMin, yMin] = detectMinSOCPoint(tt, socVec, NaT);
    if ~isnat(tMin)
        tLow = tMin;
        yLow = yMin;
        usedBand = false;
    end
end

function [pairLabel, maxDelta] = maxPairDeviation(tArr)
    % Initialize outputs
    pairLabel = "";
    maxDelta  = seconds(NaN);

    % Check if we have at least 2 valid timestamps (for SWG01 and SWG02)
    valid = ~isnat(tArr);
    if sum(valid) < 2
        return;
    end

    % Calculate the absolute difference between only the first two elements
    % tArr(1) = SWG01, tArr(2) = SWG02
    d12 = abs(tArr(1) - tArr(2));

    % Since there are only 2 SWGs, the max deviation is simply the 12 difference
    maxDelta = seconds(d12);
    pairLabel = "SWG01-SWG02";
end

function s = formatDuration(d)
    if isa(d,'duration')
        totalSec = seconds(d);
    else
        totalSec = d;
    end
    if isnan(totalSec) || isinf(totalSec)
        s = "(n/a)";
        return;
    end
    totalSec = round(totalSec);
    mm = floor(totalSec/60);
    ss = totalSec - mm*60;
    s = sprintf('%dm %02ds', mm, ss);
end

function lg2 = addSecondLegendOnOverlay(axBase, linesCell, loc)
    if nargin < 3, loc = 'best'; end
    fig = ancestor(axBase,'figure');

    ax2 = axes('Parent', fig, ...
        'Units', axBase.Units, ...
        'Position', axBase.Position, ...
        'Color','none', ...
        'XTick', [], 'YTick', [], ...
        'XColor','none', 'YColor','none', ...
        'Box','off', ...
        'Visible','off', ...
        'HitTest','off', ...
        'HandleVisibility','off');

    hold(ax2,'on');
    n = numel(linesCell);
    h = gobjects(1,n);
    for k = 1:n
        h(k) = plot(ax2, NaN, NaN, 'LineStyle','none', 'Marker','none');
    end
    hold(ax2,'off');
    lg2 = legend(ax2, h, linesCell, 'Location', loc);
    lg2.Interpreter = 'tex';
    lg2.FontSize    = 9;
    lg2.Box         = 'on';
    lg2.AutoUpdate  = 'off';

    set(fig,'SizeChangedFcn',@(src,evt) set(ax2,'Position', axBase.Position));
    uistack(ax2, 'top');
end

%% ================= DAILY CYCLE HELPERS =================
function [CycleInfo, dbgLines] = loadDailyCycleInfo(cycleResultFolder, fig5Stamp, dbgLines, DEBUG)

    CycleInfo = struct();
    CycleInfo.hasData = false;
    CycleInfo.dateStr = string(datetime(fig5Stamp,'InputFormat','yyyyMMdd','Format','yyyy-MM-dd'));

    % Daily cycle
    CycleInfo.Plant01 = NaN;
    CycleInfo.Plant02 = NaN;
    CycleInfo.AvgDaily = NaN;

    CycleInfo.Plant01_txt = "Cycle_Plant 01 = (no data)";
    CycleInfo.Plant02_txt = "Cycle_Plant 02 = (no data)";
    CycleInfo.AvgDaily_txt = "Average Daily Cycle = (no data)";

    % Total cycle
    CycleInfo.Plant01_Total = NaN;
    CycleInfo.Plant02_Total = NaN;
    CycleInfo.AvgTotal = NaN;

    CycleInfo.Plant01_Total_txt = "Plant 01 Total Cycle = (no data)";
    CycleInfo.Plant02_Total_txt = "Plant 02 Total Cycle = (no data)";
    CycleInfo.AvgTotal_txt = "Average Total Plant Cycle = (no data)";

    targetDate    = datetime(fig5Stamp,'InputFormat','yyyyMMdd','Format','yyyy-MM-dd');
    targetDateStr = string(targetDate,'yyyy-MM-dd');

    cycleFiles = [ ...
        dir(fullfile(cycleResultFolder, 'Daily_SPPC_Cycle_Result*.xlsx')); ...
        dir(fullfile(cycleResultFolder, 'SPPC_Extracted_EquivalentCycles_AllDays*.xlsx')) ...
        ];
    cycleFiles = cycleFiles(~startsWith({cycleFiles.name}, '~$'));

    if isempty(cycleFiles)
        dbgLines = dbg(dbgLines, "WARNING: No daily cycle result Excel found in: %s", cycleResultFolder);
        return;
    end

    pickedFile = fullfile(cycleFiles(1).folder, cycleFiles(1).name);
    T = table();

    for k = 1:numel(cycleFiles)
        fp = fullfile(cycleFiles(k).folder, cycleFiles(k).name);

        try
            [~, sheets] = xlsfinfo(fp);

            if any(strcmpi(sheets, 'Daily_SPPC_Cycle_Result'))
                T = readtable(fp, 'Sheet', 'Daily_SPPC_Cycle_Result', 'PreserveVariableNames', true);
                pickedFile = fp;
                break;
            else
                T = readtable(fp, 'PreserveVariableNames', true);
                pickedFile = fp;
                break;
            end
        catch
        end
    end

    if isempty(T)
        dbgLines = dbg(dbgLines, "WARNING: Cannot read daily cycle result table from folder: %s", cycleResultFolder);
        return;
    end

    vars = string(T.Properties.VariableNames);
    vlow = lower(vars);

    dateCol = "";
    p1DailyCol = "";
    p2DailyCol = "";
    avgDailyCol = "";
    p1TotalCol = "";
    p2TotalCol = "";
    avgTotalCol = "";

    idx = find(contains(vlow,'datadate'),1);
    if ~isempty(idx), dateCol = vars(idx); end

    idx = find(contains(vlow,'sppc1_dailyreached'),1);
    if ~isempty(idx), p1DailyCol = vars(idx); end

    idx = find(contains(vlow,'sppc2_dailyreached'),1);
    if ~isempty(idx), p2DailyCol = vars(idx); end

    idx = find(contains(vlow,'average_daily_cycle') | contains(vlow,'avg_dailycycle_2plants'),1);
    if ~isempty(idx), avgDailyCol = vars(idx); end

    idx = find(contains(vlow,'sppc1_totalcycle'),1);
    if ~isempty(idx), p1TotalCol = vars(idx); end

    idx = find(contains(vlow,'sppc2_totalcycle'),1);
    if ~isempty(idx), p2TotalCol = vars(idx); end

    idx = find(contains(vlow,'average_total_plant_cycle') | contains(vlow,'avg_totalcycle_2plants'),1);
    if ~isempty(idx), avgTotalCol = vars(idx); end

    if dateCol == ""
        dbgLines = dbg(dbgLines, "WARNING: DataDate column not found in cycle result file: %s", pickedFile);
        return;
    end

    rowDate = string(T.(dateCol));
    rowDate = strip(rowDate);

    idxRow = find(rowDate == targetDateStr, 1, 'first');

    if isempty(idxRow)
        try
            dt = parseDateFlex(T.(dateCol));
            idxRow = find(string(dt,'yyyy-MM-dd') == targetDateStr, 1, 'first');
        catch
            idxRow = [];
        end
    end

    if isempty(idxRow)
        dbgLines = dbg(dbgLines, "WARNING: No matching cycle row for date %s in file: %s", targetDateStr, pickedFile);
        return;
    end

    CycleInfo.hasData = true;

    %% ===== Daily cycle =====
    if p1DailyCol ~= ""
        CycleInfo.Plant01 = safeScalarNum(T.(p1DailyCol)(idxRow));
        CycleInfo.Plant01_txt = formatCycleLegendLine("Plant 01", CycleInfo.Plant01);
    end

    if p2DailyCol ~= ""
        CycleInfo.Plant02 = safeScalarNum(T.(p2DailyCol)(idxRow));
        CycleInfo.Plant02_txt = formatCycleLegendLine("Plant 02", CycleInfo.Plant02);
    end

    if avgDailyCol ~= ""
        CycleInfo.AvgDaily = safeScalarNum(T.(avgDailyCol)(idxRow));
        if ~isnan(CycleInfo.AvgDaily)
            CycleInfo.AvgDaily_txt = sprintf('Average Daily Cycle = %.3f', CycleInfo.AvgDaily);
        end
    end

    %% ===== Total cycle =====
    if p1TotalCol ~= ""
        CycleInfo.Plant01_Total = safeScalarNum(T.(p1TotalCol)(idxRow));
        if ~isnan(CycleInfo.Plant01_Total)
            CycleInfo.Plant01_Total_txt = sprintf('Plant 01 Total Cycle = %.3f', CycleInfo.Plant01_Total);
        end
    end

    if p2TotalCol ~= ""
        CycleInfo.Plant02_Total = safeScalarNum(T.(p2TotalCol)(idxRow));
        if ~isnan(CycleInfo.Plant02_Total)
            CycleInfo.Plant02_Total_txt = sprintf('Plant 02 Total Cycle = %.3f', CycleInfo.Plant02_Total);
        end
    end

    if avgTotalCol ~= ""
        CycleInfo.AvgTotal = safeScalarNum(T.(avgTotalCol)(idxRow));
        if ~isnan(CycleInfo.AvgTotal)
            CycleInfo.AvgTotal_txt = sprintf('Average Total Plant Cycle = %.3f', CycleInfo.AvgTotal);
        end
    end

    if DEBUG
        dbgLines = dbg(dbgLines, "[INFO] Daily cycle result loaded from: %s", pickedFile);
        dbgLines = dbg(dbgLines, "       Cycle date: %s", targetDateStr);
        dbgLines = dbg(dbgLines, "       Plant01 DailyReached = %.4f", CycleInfo.Plant01);
        dbgLines = dbg(dbgLines, "       Plant02 DailyReached = %.4f", CycleInfo.Plant02);
        dbgLines = dbg(dbgLines, "       Average Daily Cycle  = %.4f", CycleInfo.AvgDaily);
        dbgLines = dbg(dbgLines, "       Plant01 Total Cycle  = %.4f", CycleInfo.Plant01_Total);
        dbgLines = dbg(dbgLines, "       Plant02 Total Cycle  = %.4f", CycleInfo.Plant02_Total);
        dbgLines = dbg(dbgLines, "       Average Total Cycle  = %.4f", CycleInfo.AvgTotal);
    end
end

function x = safeScalarNum(v)
    if isnumeric(v)
        x = double(v(1));
    else
        x = str2double(string(v(1)));
    end
    if isnan(x)
        x = NaN;
    end
end

function txt = formatCycleLegendLine(plantLabel, cycleVal)
    if isnan(cycleVal)
        txt = sprintf('Cycle %s = (no data)', plantLabel);
        return;
    end

    [statusText, statusIcon] = classifyDailyCycleStatus(cycleVal);

    txt = sprintf('Cycle %s = %.3f  -> %s %s', ...
        plantLabel, cycleVal, statusIcon, statusText);
end

function [statusText, statusIcon] = classifyDailyCycleStatus(cycleVal)

    if isnan(cycleVal)
        statusText = 'No data';
        statusIcon = '\color[rgb]{0.5 0.5 0.5}\bullet\color{black}';
    elseif cycleVal < 0.5
        statusText = 'Take action';
        statusIcon = '\color[rgb]{0.85 0.20 0.25}\bullet\color{black}';
    elseif cycleVal >= 0.5 && cycleVal < 0.8
        statusText = 'Warning';
        statusIcon = '\color[rgb]{0.90 0.70 0.15}\bullet\color{black}';
    elseif cycleVal >= 0.8 && cycleVal <= 1
        statusText = 'Normal';
        statusIcon = '\color[rgb]{0.20 0.75 0.45}\bullet\color{black}';
    else
        statusText = 'Alert';
        statusIcon = '\color[rgb]{0.95 0.55 0.10}\blacktriangle\color{black}';
    end
end

function dt = parseDateFlex(x)
    dt = NaT(size(x));

    if isdatetime(x)
        dt = x;
        return;
    end

    if isnumeric(x)
        try
            dt = datetime(x, 'ConvertFrom','excel', 'Format','yyyy-MM-dd');
        catch
        end
        return;
    end

    x = string(x);
    x = strip(x);

    fmts = [ ...
        "yyyy-MM-dd"
        "dd-MMM-yy"
        "dd-MMM-yyyy"
        "dd/MM/yyyy"
        "MM/dd/yyyy"
        "yyyyMMdd"
        ];

    for f = 1:numel(fmts)
        try
            tf = datetime(x, 'InputFormat', fmts(f), 'Format','yyyy-MM-dd');
            ok = ~isnat(tf);
            dt(ok) = tf(ok);
            if all(~isnat(dt))
                return;
            end
        catch
        end
    end
    try
        dt = datetime(x, 'Format','yyyy-MM-dd');
    catch
    end
end
%% ================= DISPATCH FUNCTION =================
function [Pi, mode] = alloc_with_limits(Pset, SOCc, SOH, SOCmin, SOCmax, Crate_dis, Crate_cha, P_limit)
% Uses SOC-based weights + hard limits + redistribution
    Pi = zeros(1,2);
    if Pset > 0
        w = (SOCc - SOCmin) .* SOH .* Crate_dis;
        mode = "Discharge";
    elseif Pset < 0
        w = (SOCmax - SOCc) .* SOH .* Crate_cha;
        mode = "Charge";
    else
        mode = "Idle";
        return;
    end
    if sum(w) <= 0
        Pi(:) = 0;
        return;
    end
    signP = sign(Pset);
    Pmag  = abs(Pset);
    active = true(1,2);
    Pi_mag = zeros(1,2);
    remaining = Pmag;
    for iter = 1:2
        if remaining <= 1e-9, break; end
        if sum(w(active)) <= 0, break; end; alloc = zeros(1,2); alloc(active) = remaining * (w(active) / sum(w(active)));
        for i = 1:2
            if ~active(i), continue; end; cap = P_limit(i) - Pi_mag(i);
            if cap <= 1e-12
                active(i) = false;
                continue;
            end
            if alloc(i) >= cap
                Pi_mag(i) = Pi_mag(i) + cap;
                active(i) = false;
            else
                Pi_mag(i) = Pi_mag(i) + alloc(i);
            end
        end
        remaining = Pmag - sum(Pi_mag);
    end
    Pi = signP * Pi_mag;
end