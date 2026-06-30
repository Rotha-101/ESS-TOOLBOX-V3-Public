clc;
clear;
close all;

parentFolder = 'C:\Users\USER\Documents\Work Documents\Validity_Data\1. Daily_Evaluation\3. Cycle_Data_AllDays';

dayFoldersInfo = dir(parentFolder);
dayFoldersInfo = dayFoldersInfo([dayFoldersInfo.isdir]);

keepIdx = true(size(dayFoldersInfo));

for ii = 1:numel(dayFoldersInfo)
    nm = string(dayFoldersInfo(ii).name);

    if ismember(nm, [".",".."]) || ...
       strcmpi(nm,"Extracted_Output") || ...
       startsWith(nm,"SNTL_400_Cycle_Count_", 'IgnoreCase', true)

        keepIdx(ii) = false;
    end
end

dayFoldersInfo = dayFoldersInfo(keepIdx);

if isempty(dayFoldersInfo)
    error('No subfolders found in parent folder: %s', parentFolder);
end

SPPC1_Block = [1 2 3 4 5 6 8 9 10 12 19 20 23];
SPPC2_Block = [7 11 13 14 15 16 17 18 21 22 24 25];

dailySummary = table();

allDayTables  = {};
allHeaderInfo = {};
allSheetNames = {};

%% --------------------------------------------------------------
% LOOP EACH DAY FOLDER
%% --------------------------------------------------------------
for ff = 1:numel(dayFoldersInfo)

    inputFolder = fullfile(parentFolder, dayFoldersInfo(ff).name);
    folderName  = dayFoldersInfo(ff).name;

    fprintf('\n====================================================\n');
    fprintf('PROCESSING FOLDER (%d/%d): %s\n', ff, numel(dayFoldersInfo), inputFolder);
    fprintf('====================================================\n');

    allFiles = [dir(fullfile(inputFolder, '**', '*.xlsx'));
                dir(fullfile(inputFolder, '**', '*.xls'))];

    allFiles = allFiles(~startsWith({allFiles.name}, '~$'));

    if isempty(allFiles)
        warning('No Excel files found in folder or subfolders: %s', inputFolder);
        continue;
    end

    folderLow = lower(string({allFiles.folder})');
    isESS = contains(folderLow, filesep + "ess") | ...
            endsWith(folderLow, "ess") | ...
            contains(folderLow, "ess");

    files = allFiles(isESS);
    nFiles = numel(files);

    if nFiles == 0
        warning('No Excel files found inside ESS subfolders: %s', inputFolder);
        continue;
    end

    fprintf('Found %d ESS Excel files.\n', nFiles);

    SPPC1_tbl = table();
    SPPC2_tbl = table();

    for k = 1:nFiles

        filePath = fullfile(files(k).folder, files(k).name);
        fprintf('\nReading ESS file (%d/%d): %s\n', k, nFiles, filePath);

        try
            T = readtable(filePath, 'PreserveVariableNames', true);
        catch ME
            warning('Failed to read file: %s\nReason: %s', filePath, ME.message);
            continue;
        end

        vars      = T.Properties.VariableNames;
        lowerVars = lower(vars);

        plantIdx = find(contains(lowerVars, 'plant') & contains(lowerVars, 'name'), 1);
        if isempty(plantIdx), continue; end
        plantCol = vars{plantIdx};

        deviceIdx = find(contains(lowerVars, 'device') & contains(lowerVars, 'name'), 1);
        if isempty(deviceIdx), continue; end
        deviceCol = vars{deviceIdx};

        startIdx = find(contains(lowerVars, 'start') & contains(lowerVars, 'time'), 1);
        if isempty(startIdx), continue; end
        startCol = vars{startIdx};

        if width(T) < 14
            continue;
        end

        eqColName = vars{14};

        subT = T(:, {plantCol, deviceCol, startCol, eqColName});
        subT.Properties.VariableNames = {'PlantName', 'DeviceName', 'StartTime', 'EquivalentNumberOfCycles'};

        if ~isnumeric(subT.EquivalentNumberOfCycles)
            subT.EquivalentNumberOfCycles = str2double(string(subT.EquivalentNumberOfCycles));
        end

        if ~isdatetime(subT.StartTime)
            subT.StartTime = tryParseDateTime(subT.StartTime);
        end

        devNames = string(subT.DeviceName);
        blockNum = nan(height(subT), 1);
        essNum   = nan(height(subT), 1);

        for i = 1:height(subT)
            name_i = devNames(i);

            tokBlock = regexp(name_i, 'B(\d+)-SmartLogger', 'tokens', 'once', 'ignorecase');

            if isempty(tokBlock)
                tokBlock = regexp(name_i, 'B(\d+)-ESS', 'tokens', 'once', 'ignorecase');
            end

            if ~isempty(tokBlock)
                blockNum(i) = str2double(tokBlock{1});
            end

            tokESS = regexp(name_i, 'ESS(\d+)', 'tokens', 'once', 'ignorecase');

            if ~isempty(tokESS)
                essNum(i) = str2double(tokESS{1});
            end
        end

        subT.Block_Number = blockNum;
        subT.ESS_Number   = essNum;

        subT = subT(:, {'PlantName', 'DeviceName', 'Block_Number', 'ESS_Number', 'StartTime', 'EquivalentNumberOfCycles'});

        for i = 1:height(subT)
            n = subT.Block_Number(i);

            if isnan(n)
                continue;
            end

            if ismember(n, SPPC1_Block)
                SPPC1_tbl = [SPPC1_tbl; subT(i, :)]; %#ok<AGROW>
            elseif ismember(n, SPPC2_Block)
                SPPC2_tbl = [SPPC2_tbl; subT(i, :)]; %#ok<AGROW>
            end
        end
    end

    if ~isempty(SPPC1_tbl)
        SPPC1_tbl = sortrows(SPPC1_tbl, {'Block_Number','ESS_Number','StartTime'});
    end

    if ~isempty(SPPC2_tbl)
        SPPC2_tbl = sortrows(SPPC2_tbl, {'Block_Number','ESS_Number','StartTime'});
    end

    folderDateStr = detectDateFromTables(SPPC1_tbl, SPPC2_tbl);

    if folderDateStr == "Unknown"
        folderDateStr = string(folderName);
    end

    p1 = buildPlantCycleTable(SPPC1_tbl, "SPPC1");
    p2 = buildPlantCycleTable(SPPC2_tbl, "SPPC2");

    p1 = addPlantAverageOnce(p1);
    p2 = addPlantAverageOnce(p2);

    finalDayTable = [p1; p2];

    sheetName = makeValidSheetName(folderName);

    headerInfo = table( ...
        ["Source Folder"; "Data Date"], ...
        [string(folderName); folderDateStr], ...
        'VariableNames', {'Info', 'Value'});

    allSheetNames{end+1} = sheetName; %#ok<SAGROW>
    allHeaderInfo{end+1} = headerInfo; %#ok<SAGROW>
    allDayTables{end+1}  = finalDayTable; %#ok<SAGROW>

    sppc1avg = getPlantAverageFromTable(p1);
    sppc2avg = getPlantAverageFromTable(p2);

    dailySummary = [dailySummary; table( ...
        string(folderName), ...
        folderDateStr, ...
        sppc1avg, ...
        sppc2avg, ...
        'VariableNames', { ...
            'SourceFolder', ...
            'DataDate', ...
            'SPPC1_TotalCycle', ...
            'SPPC2_TotalCycle'})]; %#ok<AGROW>

    fprintf('\nPrepared sheet: %s\n', sheetName);
end

%% --------------------------------------------------------------
% CREATE OUTPUT FOLDER AFTER CALCULATION
%% --------------------------------------------------------------
if isempty(dailySummary)
    error('No daily summary generated from input files.');
end

sortDate = NaT(height(dailySummary),1);

for i = 1:height(dailySummary)
    try
        sortDate(i) = datetime(dailySummary.DataDate(i), 'InputFormat', 'yyyy-MM-dd');
    catch
        sortDate(i) = NaT;
    end
end

validDates = sortDate(~isnat(sortDate));

if isempty(validDates)
    latestDateStr = datestr(now, 'yyyy-mm-dd');
else
    latestDateStr = datestr(max(validDates), 'yyyy-mm-dd');
end

outputFolder = fullfile(parentFolder, ...
    ['SNTL_400_Cycle_Count_' latestDateStr]);

if ~exist(outputFolder, 'dir')
    mkdir(outputFolder);
end

combinedOutputFile = fullfile(outputFolder, ...
    ['SPPC_Extracted_EquivalentCycles_AllDays_' latestDateStr '.xlsx']);

if isfile(combinedOutputFile)
    delete(combinedOutputFile);
end

%% --------------------------------------------------------------
% WRITE EACH DAY SHEET
%% --------------------------------------------------------------
for ii = 1:numel(allSheetNames)

    writetable(allHeaderInfo{ii}, combinedOutputFile, ...
        'Sheet', allSheetNames{ii}, ...
        'Range', 'A1', ...
        'WriteVariableNames', true);

    if ~isempty(allDayTables{ii})
        mainTableStartRow = height(allHeaderInfo{ii}) + 4;

        writetable(allDayTables{ii}, combinedOutputFile, ...
            'Sheet', allSheetNames{ii}, ...
            'Range', sprintf('A%d', mainTableStartRow), ...
            'WriteVariableNames', true);
    end
end

%% --------------------------------------------------------------
% DAILY SPPC CYCLE RESULT = D(t) - D(t-1)
%% --------------------------------------------------------------
dailySummary.SortDate = sortDate;
dailySummary = sortrows(dailySummary, 'SortDate');

SPPC1_DailyReached = nan(height(dailySummary),1);
SPPC2_DailyReached = nan(height(dailySummary),1);

Avg_TotalCycle_2Plants = nan(height(dailySummary),1);
Avg_DailyCycle_2Plants = nan(height(dailySummary),1);

for i = 2:height(dailySummary)

    SPPC1_DailyReached(i) = dailySummary.SPPC1_TotalCycle(i) - dailySummary.SPPC1_TotalCycle(i-1);
    SPPC2_DailyReached(i) = dailySummary.SPPC2_TotalCycle(i) - dailySummary.SPPC2_TotalCycle(i-1);

    Avg_TotalCycle_2Plants(i) = mean( ...
        [dailySummary.SPPC1_TotalCycle(i), dailySummary.SPPC2_TotalCycle(i)], ...
        'omitnan');

    Avg_DailyCycle_2Plants(i) = mean( ...
        [SPPC1_DailyReached(i), SPPC2_DailyReached(i)], ...
        'omitnan');
end

dailyCycleResult = table( ...
    dailySummary.SourceFolder, ...
    dailySummary.DataDate, ...
    dailySummary.SPPC1_TotalCycle, ...
    SPPC1_DailyReached, ...
    dailySummary.SPPC2_TotalCycle, ...
    SPPC2_DailyReached, ...
    Avg_TotalCycle_2Plants, ...
    Avg_DailyCycle_2Plants, ...
    'VariableNames', { ...
        'SourceFolder', ...
        'DataDate', ...
        'SPPC1_TotalCycle', ...
        'SPPC1_DailyReached', ...
        'SPPC2_TotalCycle', ...
        'SPPC2_DailyReached', ...
        'Average_Total_Plant_Cycle', ...
        'Average_Daily_Cycle'});

writetable(dailyCycleResult, combinedOutputFile, ...
    'Sheet', 'Daily_SPPC_Cycle_Result', ...
    'Range', 'A1', ...
    'WriteVariableNames', true);

fprintf('\n=========================================\n');
fprintf('Cycle result saved into:\n%s\n', combinedOutputFile);
fprintf('=========================================\n');

%% --------------------------------------------------------------
% LOCAL FUNCTIONS
%% --------------------------------------------------------------
function outTbl = buildPlantCycleTable(plantTbl, plantLabel)

    outTbl = table();

    if isempty(plantTbl)
        return;
    end

    plantTbl = sortrows(plantTbl, {'Block_Number','ESS_Number','StartTime'});
    uniqueBlock = unique(plantTbl.Block_Number(~isnan(plantTbl.Block_Number)));

    for i = 1:numel(uniqueBlock)

        blockNum = uniqueBlock(i);
        currentData = plantTbl(plantTbl.Block_Number == blockNum, :);

        existingESS = unique(currentData.ESS_Number(~isnan(currentData.ESS_Number)));
        existingESS = sort(existingESS);

        if isempty(existingESS)
            continue;
        end

        nESS = numel(existingESS);
        lastCycles = nan(nESS,1);

        for j = 1:nESS
            essNum = existingESS(j);
            essData = currentData(currentData.ESS_Number == essNum, :);

            if ~isempty(essData)
                essData = sortrows(essData, 'StartTime');
                lastCycles(j) = essData.EquivalentNumberOfCycles(end);
            end
        end

        avgCycleBlock = mean(lastCycles, 'omitnan');

        plantNames  = repmat(string(plantLabel), nESS, 1);
        blockNames  = repmat(string(sprintf('Block-%02d', blockNum)), nESS, 1);
        avgBlockCol = nan(nESS,1);
        avgBlockCol(1) = avgCycleBlock;
        avgPlantCol = nan(nESS,1);

        tmpTbl = table( ...
            plantNames, ...
            blockNames, ...
            existingESS(:), ...
            lastCycles, ...
            avgBlockCol, ...
            avgPlantCol, ...
            'VariableNames', { ...
                'PlantName', ...
                'BlockName', ...
                'ESS_Number', ...
                'LastEquivalentNumberOfCycle', ...
                'AverageCycleOfBlock', ...
                'AverageCycleOfSPPC'});

        outTbl = [outTbl; tmpTbl]; %#ok<AGROW>
    end
end

function outTbl = addPlantAverageOnce(inTbl)

    outTbl = inTbl;

    if isempty(outTbl)
        return;
    end

    plantAvg = mean(outTbl.AverageCycleOfBlock, 'omitnan');

    if ~isnan(plantAvg)
        outTbl.AverageCycleOfSPPC(1) = plantAvg;
    end
end

function val = getPlantAverageFromTable(T)

    val = NaN;

    if isempty(T)
        return;
    end

    idx = find(~isnan(T.AverageCycleOfSPPC), 1, 'first');

    if ~isempty(idx)
        val = T.AverageCycleOfSPPC(idx);
    end
end

function t = tryParseDateTime(x)

    t = NaT(size(x));

    if isnumeric(x)
        try
            t = datetime(x, 'ConvertFrom','excel', 'Format','yyyy-MM-dd HH:mm:ss');
        catch
        end
        return;
    end

    x = string(x);
    x = strip(x);

    bad = x=="" | lower(x)=="nan";
    x(bad) = missing;

    idx = ~ismissing(x);

    if ~any(idx)
        return;
    end

    fmts = [ ...
        "yyyy-MM-dd HH:mm:ss"
        "yyyy/MM/dd HH:mm:ss"
        "dd/MM/yyyy HH:mm:ss"
        "dd-MM-yyyy HH:mm:ss"
        "MM/dd/yyyy HH:mm:ss"
        "yyyy-MM-dd HH:mm"
        "yyyy/MM/dd HH:mm"
        "dd/MM/yyyy HH:mm"
        "dd-MM-yyyy HH:mm"
        "MM/dd/yyyy HH:mm"
        "dd-MMM-yyyy HH:mm:ss"
        "dd-MMM-yyyy HH:mm"
        "MM/dd/yyyy hh:mm:ss a"
        "dd/MM/yyyy hh:mm:ss a"
        "MM/dd/yyyy hh:mm a"
        "dd/MM/yyyy hh:mm a"];

    for f = 1:numel(fmts)

        try
            tf = datetime(x(idx), ...
                'InputFormat', fmts(f), ...
                'Format','yyyy-MM-dd HH:mm:ss');

            ok = ~isnat(tf);

            if any(ok)
                tmp = t(idx);
                tmp(ok) = tf(ok);
                t(idx) = tmp;
            end
        catch
        end

        if all(~isnat(t(idx)))
            break;
        end
    end

    still = idx & isnat(t);

    if any(still)
        try
            t(still) = datetime(x(still), 'Format','yyyy-MM-dd HH:mm:ss');
        catch
        end
    end
end

function outDateStr = detectDateFromTables(varargin)

    allTimes = NaT(0,1);

    for k = 1:nargin

        T = varargin{k};

        if ~isempty(T) && ismember('StartTime', T.Properties.VariableNames)

            tt = T.StartTime;
            tt = tt(~isnat(tt));

            if ~isempty(tt)
                allTimes = [allTimes; tt(:)]; %#ok<AGROW>
            end
        end
    end

    if isempty(allTimes)
        outDateStr = "Unknown";
        return;
    end

    d = dateshift(min(allTimes), 'start', 'day');
    outDateStr = string(d, 'yyyy-MM-dd');
end

function sheetName = makeValidSheetName(nameIn)

    sheetName = char(string(nameIn));
    badChars = [':' '\' '/' '?' '*' '[' ']'];

    for k = 1:numel(badChars)
        sheetName(sheetName == badChars(k)) = '_';
    end

    if strlength(string(sheetName)) > 31
        sheetName = extractBefore(string(sheetName), 32);
        sheetName = char(sheetName);
    end
end