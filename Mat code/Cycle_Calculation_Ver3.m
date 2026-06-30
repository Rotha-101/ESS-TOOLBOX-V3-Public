clc;
clear;
close all;

%% --------------------------------------------------------------
% PARENT FOLDER SETTINGS
%% --------------------------------------------------------------
parentFolder = 'C:\Users\USER\Documents\MATLAB\Cycle_Data_AllDays';

dayFoldersInfo = dir(parentFolder);
dayFoldersInfo = dayFoldersInfo([dayFoldersInfo.isdir]);

keepIdx = true(size(dayFoldersInfo));
for ii = 1:numel(dayFoldersInfo)
    nm = string(dayFoldersInfo(ii).name);
    if ismember(nm, [".",".."]) || strcmpi(nm,"Extracted_Output") || startsWith(nm,"SNTL_600_Cycle_Count_", 'IgnoreCase', true)
        keepIdx(ii) = false;
    end
end
dayFoldersInfo = dayFoldersInfo(keepIdx);

if isempty(dayFoldersInfo)
    error('No subfolders found in parent folder: %s', parentFolder);
end

%% --------------------------------------------------------------
% DEFINE SACU GROUPS PER SPPC
%% --------------------------------------------------------------
SPPC1_SACU = [1 2 3 4 5 6 7 8 9 10 11 12 13 14 16 17];
SPPC2_SACU = [15 18 21 24 27 30 31 32 33 34];
SPPC3_SACU = [19 20 22 23 25 26 28 29 35 36 37];

dailySummary = table();

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
    isESS = contains(folderLow, filesep + "ess") | endsWith(folderLow, "ess") | contains(folderLow, "ess");

    files = allFiles(isESS);

    if isempty(files)
        warning('No Excel files found inside ESS subfolders: %s', inputFolder);
        continue;
    end

    fprintf('Found %d ESS Excel files.\n', numel(files));

    SPPC1_tbl = table();
    SPPC2_tbl = table();
    SPPC3_tbl = table();

    for k = 1:numel(files)

        filePath = fullfile(files(k).folder, files(k).name);
        fprintf('\nReading ESS file (%d/%d): %s\n', k, numel(files), filePath);

        try
            T = readtable(filePath, 'PreserveVariableNames', true);
        catch ME
            warning('Failed to read file: %s\nReason: %s', filePath, ME.message);
            continue;
        end

        vars = T.Properties.VariableNames;
        lowerVars = lower(vars);

        plantIdx  = find(contains(lowerVars, 'plant') & contains(lowerVars, 'name'), 1);
        deviceIdx = find(contains(lowerVars, 'device') & contains(lowerVars, 'name'), 1);
        startIdx  = find(contains(lowerVars, 'start') & contains(lowerVars, 'time'), 1);

        eqIdx = find(strcmp(vars, 'Equivalent number of cycles'), 1);
        if isempty(eqIdx)
            eqIdx = find(contains(lowerVars, 'equivalent') & contains(lowerVars, 'cycle'), 1);
        end

        if isempty(plantIdx) || isempty(deviceIdx) || isempty(startIdx) || isempty(eqIdx)
            warning('Missing required columns in file: %s', files(k).name);
            continue;
        end

        subT = T(:, {vars{plantIdx}, vars{deviceIdx}, vars{startIdx}, vars{eqIdx}});
        subT.Properties.VariableNames = {'PlantName','DeviceName','StartTime','EquivalentNumberOfCycles'};

        if ~isnumeric(subT.EquivalentNumberOfCycles)
            subT.EquivalentNumberOfCycles = str2double(string(subT.EquivalentNumberOfCycles));
        end

        if ~isdatetime(subT.StartTime)
            subT.StartTime = tryParseDateTime(subT.StartTime);
        end

        devNames = string(subT.DeviceName);
        sacuNum = nan(height(subT),1);
        essNum  = nan(height(subT),1);

        for i = 1:height(subT)
            name_i = devNames(i);

            tokSACU = regexp(name_i, '(SACU|STS)-?(\d+)', 'tokens', 'once', 'ignorecase');
            if ~isempty(tokSACU)
                sacuNum(i) = str2double(tokSACU{2});
            end

            tokESS = regexp(name_i, 'ESS[-_ ]?0?(\d+)', 'tokens', 'once', 'ignorecase');
            if ~isempty(tokESS)
                essNum(i) = str2double(tokESS{1});
            end
        end

        subT.SACU_Number = sacuNum;
        subT.ESS_Number  = essNum;

        subT = subT(:, {'PlantName','DeviceName','SACU_Number','ESS_Number','StartTime','EquivalentNumberOfCycles'});

        for i = 1:height(subT)
            n = subT.SACU_Number(i);

            if isnan(n)
                continue;
            end

            if ismember(n, SPPC1_SACU)
                SPPC1_tbl = [SPPC1_tbl; subT(i,:)]; 
            elseif ismember(n, SPPC2_SACU)
                SPPC2_tbl = [SPPC2_tbl; subT(i,:)]; 
            elseif ismember(n, SPPC3_SACU)
                SPPC3_tbl = [SPPC3_tbl; subT(i,:)]; 
            end
        end
    end

    if ~isempty(SPPC1_tbl)
        SPPC1_tbl = sortrows(SPPC1_tbl, {'SACU_Number','ESS_Number','StartTime'});
    end
    if ~isempty(SPPC2_tbl)
        SPPC2_tbl = sortrows(SPPC2_tbl, {'SACU_Number','ESS_Number','StartTime'});
    end
    if ~isempty(SPPC3_tbl)
        SPPC3_tbl = sortrows(SPPC3_tbl, {'SACU_Number','ESS_Number','StartTime'});
    end

    folderDateStr = detectDateFromTables(SPPC1_tbl, SPPC2_tbl, SPPC3_tbl);

    p1 = buildPlantCycleTable(SPPC1_tbl, "SWG01 (Plant 01)");
    p2 = buildPlantCycleTable(SPPC2_tbl, "SWG02 (Plant 02)");
    p3 = buildPlantCycleTable(SPPC3_tbl, "SWG03 (Plant 03)");

    p1 = addPlantAverageOnce(p1);
    p2 = addPlantAverageOnce(p2);
    p3 = addPlantAverageOnce(p3);

    swg1avg = getPlantAverageFromTable(p1);
    swg2avg = getPlantAverageFromTable(p2);
    swg3avg = getPlantAverageFromTable(p3);

    dailySummary = [dailySummary; table( ...
        string(folderName), ...
        folderDateStr, ...
        swg1avg, swg2avg, swg3avg, ...
        'VariableNames', {'SourceFolder','DataDate','SWG01_TotalCycle','SWG02_TotalCycle','SWG03_TotalCycle'})]; 
end

%% --------------------------------------------------------------
% CREATE OUTPUT FOLDER
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

outputFolder = fullfile(parentFolder, ['SNTL_600_Cycle_Count_' latestDateStr]);
if ~exist(outputFolder, 'dir')
    mkdir(outputFolder);
end

combinedOutputFile = fullfile(outputFolder, ['SPPC_Extracted_EquivalentCycles_AllDays_' latestDateStr '.xlsx']);

if isfile(combinedOutputFile)
    delete(combinedOutputFile);
end

%% --------------------------------------------------------------
% WRITE EACH DAILY DETAIL SHEET
%% --------------------------------------------------------------
for ff = 1:numel(dayFoldersInfo)

    inputFolder = fullfile(parentFolder, dayFoldersInfo(ff).name);
    folderName  = dayFoldersInfo(ff).name;

    allFiles = [dir(fullfile(inputFolder, '**', '*.xlsx'));
                dir(fullfile(inputFolder, '**', '*.xls'))];
    allFiles = allFiles(~startsWith({allFiles.name}, '~$'));

    if isempty(allFiles)
        continue;
    end

    folderLow = lower(string({allFiles.folder})');
    isESS = contains(folderLow, filesep + "ess") | endsWith(folderLow, "ess") | contains(folderLow, "ess");
    files = allFiles(isESS);

    if isempty(files)
        continue;
    end

    SPPC1_tbl = table();
    SPPC2_tbl = table();
    SPPC3_tbl = table();

    for k = 1:numel(files)

        filePath = fullfile(files(k).folder, files(k).name);

        try
            T = readtable(filePath, 'PreserveVariableNames', true);
        catch
            continue;
        end

        vars = T.Properties.VariableNames;
        lowerVars = lower(vars);

        plantIdx  = find(contains(lowerVars, 'plant') & contains(lowerVars, 'name'), 1);
        deviceIdx = find(contains(lowerVars, 'device') & contains(lowerVars, 'name'), 1);
        startIdx  = find(contains(lowerVars, 'start') & contains(lowerVars, 'time'), 1);

        eqIdx = find(strcmp(vars, 'Equivalent number of cycles'), 1);
        if isempty(eqIdx)
            eqIdx = find(contains(lowerVars, 'equivalent') & contains(lowerVars, 'cycle'), 1);
        end

        if isempty(plantIdx) || isempty(deviceIdx) || isempty(startIdx) || isempty(eqIdx)
            continue;
        end

        subT = T(:, {vars{plantIdx}, vars{deviceIdx}, vars{startIdx}, vars{eqIdx}});
        subT.Properties.VariableNames = {'PlantName','DeviceName','StartTime','EquivalentNumberOfCycles'};

        if ~isnumeric(subT.EquivalentNumberOfCycles)
            subT.EquivalentNumberOfCycles = str2double(string(subT.EquivalentNumberOfCycles));
        end

        if ~isdatetime(subT.StartTime)
            subT.StartTime = tryParseDateTime(subT.StartTime);
        end

        devNames = string(subT.DeviceName);
        sacuNum = nan(height(subT),1);
        essNum  = nan(height(subT),1);

        for i = 1:height(subT)
            name_i = devNames(i);

            tokSACU = regexp(name_i, '(SACU|STS)-?(\d+)', 'tokens', 'once', 'ignorecase');
            if ~isempty(tokSACU)
                sacuNum(i) = str2double(tokSACU{2});
            end

            tokESS = regexp(name_i, 'ESS[-_ ]?0?(\d+)', 'tokens', 'once', 'ignorecase');
            if ~isempty(tokESS)
                essNum(i) = str2double(tokESS{1});
            end
        end

        subT.SACU_Number = sacuNum;
        subT.ESS_Number  = essNum;

        subT = subT(:, {'PlantName','DeviceName','SACU_Number','ESS_Number','StartTime','EquivalentNumberOfCycles'});

        for i = 1:height(subT)
            n = subT.SACU_Number(i);

            if isnan(n)
                continue;
            end

            if ismember(n, SPPC1_SACU)
                SPPC1_tbl = [SPPC1_tbl; subT(i,:)]; 
            elseif ismember(n, SPPC2_SACU)
                SPPC2_tbl = [SPPC2_tbl; subT(i,:)]; 
            elseif ismember(n, SPPC3_SACU)
                SPPC3_tbl = [SPPC3_tbl; subT(i,:)];
            end
        end
    end

    if ~isempty(SPPC1_tbl)
        SPPC1_tbl = sortrows(SPPC1_tbl, {'SACU_Number','ESS_Number','StartTime'});
    end
    if ~isempty(SPPC2_tbl)
        SPPC2_tbl = sortrows(SPPC2_tbl, {'SACU_Number','ESS_Number','StartTime'});
    end
    if ~isempty(SPPC3_tbl)
        SPPC3_tbl = sortrows(SPPC3_tbl, {'SACU_Number','ESS_Number','StartTime'});
    end

    folderDateStr = detectDateFromTables(SPPC1_tbl, SPPC2_tbl, SPPC3_tbl);

    p1 = buildPlantCycleTable(SPPC1_tbl, "SWG01 (Plant 01)");
    p2 = buildPlantCycleTable(SPPC2_tbl, "SWG02 (Plant 02)");
    p3 = buildPlantCycleTable(SPPC3_tbl, "SWG03 (Plant 03)");

    p1 = addPlantAverageOnce(p1);
    p2 = addPlantAverageOnce(p2);
    p3 = addPlantAverageOnce(p3);

    finalDayTable = [p1; p2; p3];

    sheetName = makeValidSheetName(folderName);

    headerInfo = table( ...
        ["Source Folder"; "Data Date"], ...
        [string(folderName); folderDateStr], ...
        'VariableNames', {'Info','Value'});

    writetable(headerInfo, combinedOutputFile, 'Sheet', sheetName, ...
        'Range', 'A1', 'WriteVariableNames', true);

    mainTableStartRow = height(headerInfo) + 4;

    writetable(finalDayTable, combinedOutputFile, 'Sheet', sheetName, ...
        'Range', sprintf('A%d', mainTableStartRow), 'WriteVariableNames', true);

    fprintf('\nSaved sheet: %s\n', sheetName);
end

%% --------------------------------------------------------------
% DAILY SWG CYCLE RESULT
%% --------------------------------------------------------------
dailySummary.SortDate = sortDate;
dailySummary = sortrows(dailySummary, 'SortDate');

SWG01_DailyReached = nan(height(dailySummary),1);
SWG02_DailyReached = nan(height(dailySummary),1);
SWG03_DailyReached = nan(height(dailySummary),1);

for i = 2:height(dailySummary)
    SWG01_DailyReached(i) = dailySummary.SWG01_TotalCycle(i) - dailySummary.SWG01_TotalCycle(i-1);
    SWG02_DailyReached(i) = dailySummary.SWG02_TotalCycle(i) - dailySummary.SWG02_TotalCycle(i-1);
    SWG03_DailyReached(i) = dailySummary.SWG03_TotalCycle(i) - dailySummary.SWG03_TotalCycle(i-1);
end

Average_Total_Plant_Cycle = mean( ...
    [dailySummary.SWG01_TotalCycle, ...
     dailySummary.SWG02_TotalCycle, ...
     dailySummary.SWG03_TotalCycle], 2, 'omitnan');

Average_Daily_Cycle = mean( ...
    [SWG01_DailyReached, ...
     SWG02_DailyReached, ...
     SWG03_DailyReached], 2, 'omitnan');

dailyCycleResult = table( ...
    dailySummary.SourceFolder, ...
    dailySummary.DataDate, ...
    dailySummary.SWG01_TotalCycle, SWG01_DailyReached, ...
    dailySummary.SWG02_TotalCycle, SWG02_DailyReached, ...
    dailySummary.SWG03_TotalCycle, SWG03_DailyReached, ...
    Average_Total_Plant_Cycle, ...
    Average_Daily_Cycle, ...
    'VariableNames', { ...
        'SourceFolder','DataDate', ...
        'SWG01_TotalCycle','SWG01_DailyReached', ...
        'SWG02_TotalCycle','SWG02_DailyReached', ...
        'SWG03_TotalCycle','SWG03_DailyReached', ...
        'Average_Total_Plant_Cycle', ...
        'Average_Daily_Cycle'} );

writetable(dailyCycleResult, combinedOutputFile, 'Sheet', 'Daily_SWG_Cycle_Result', ...
    'Range', 'A1', 'WriteVariableNames', true);

fprintf('\n=========================================\n');
fprintf('DONE. Output workbook saved here:\n%s\n', combinedOutputFile);
fprintf('=========================================\n');

%% --------------------------------------------------------------
% LOCAL FUNCTIONS
%% --------------------------------------------------------------
function outTbl = buildPlantCycleTable(plantTbl, plantLabel)
    outTbl = table();

    if isempty(plantTbl)
        return;
    end

    plantTbl = sortrows(plantTbl, {'SACU_Number','ESS_Number','StartTime'});
    uniqueSACU = unique(plantTbl.SACU_Number(~isnan(plantTbl.SACU_Number)));

    for i = 1:numel(uniqueSACU)
        sacuNum = uniqueSACU(i);
        currentData = plantTbl(plantTbl.SACU_Number == sacuNum, :);

        existingESS = unique(currentData.ESS_Number(~isnan(currentData.ESS_Number)));
        existingESS = sort(existingESS);

        if sacuNum == 37 && numel(existingESS) == 3
            essListToUse = existingESS(:)';
        else
            essListToUse = [1 2 3 4];
        end

        lastCycles = nan(1, numel(essListToUse));

        for j = 1:numel(essListToUse)
            essNum = essListToUse(j);
            essData = currentData(currentData.ESS_Number == essNum, :);

            if ~isempty(essData)
                essData = sortrows(essData, 'StartTime');
                lastCycles(j) = essData.EquivalentNumberOfCycles(end);
            end
        end

        avgCycleBlock = mean(lastCycles, 'omitnan');
        deviceNameBlock = sprintf('SACU-%02d', sacuNum);

        tmpTbl = table( ...
            repmat(string(plantLabel), numel(essListToUse), 1), ...
            repmat(string(deviceNameBlock), numel(essListToUse), 1), ...
            essListToUse', ...
            lastCycles', ...
            [avgCycleBlock; nan(numel(essListToUse)-1,1)], ...
            nan(numel(essListToUse),1), ...
            'VariableNames', { ...
                'PlantName', ...
                'DeviceName', ...
                'ESS_Number', ...
                'LastEquivalentNumberOfCycle', ...
                'AverageCycleOfBlock', ...
                'AverageCycleOfSPPC'} );

        outTbl = [outTbl; tmpTbl]; 
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

    if isdatetime(x)
        t = x;
        return;
    end

    x = string(x);
    x = strip(x);

    bad = x == "" | lower(x) == "nan";
    x(bad) = missing;

    idx = ~ismissing(x);

    if ~any(idx)
        return;
    end

    fmts = [
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
        "dd/MM/yyyy hh:mm a"
        ];

    for f = 1:numel(fmts)
        try
            tf = datetime(x(idx), 'InputFormat', fmts(f), 'Format','yyyy-MM-dd HH:mm:ss');
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