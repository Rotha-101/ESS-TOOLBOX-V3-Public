import React, { startTransition, useDeferredValue, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Filter,
  Pin,
  RefreshCw,
  Search,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface WorkbookPreviewSource {
  id: string;
  name: string;
  path: string;
  plant: string;
  category: string;
  status: string;
  file: File;
}

interface ParsedRow {
  __rowNumber: number;
  [key: string]: any;
}

interface ParsedSheet {
  name: string;
  columns: string[];
  rows: ParsedRow[];
}

interface WorkbookPreviewProps {
  source: WorkbookPreviewSource;
  project: string;
  theme: 'dark' | 'light';
  onClose: () => void;
}

const PAGE_SIZE_OPTIONS = [50, 100, 250, 500];

function isBlankCell(value: any) {
  return value === null || value === undefined || value === '';
}

function toDisplayValue(value: any) {
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

function normalizeHeaderValue(value: any, index: number, seen: Map<string, number>) {
  const base = toDisplayValue(value).trim() || `Column_${index + 1}`;
  const current = seen.get(base) || 0;
  seen.set(base, current + 1);
  return current === 0 ? base : `${base}_${current + 1}`;
}

function parseComparableValue(value: any) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const text = toDisplayValue(value).trim();
  if (!text) return '';
  const numeric = Number(text);
  if (!Number.isNaN(numeric) && text === String(numeric)) return numeric;
  return text.toLowerCase();
}

function escapeCsv(value: any) {
  const text = toDisplayValue(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildSheetSummaries(rawWorkbook: any, sheetUtils: any): ParsedSheet[] {
  const sheets: ParsedSheet[] = [];

  rawWorkbook.SheetNames.forEach((sheetName: string) => {
    const sheet = rawWorkbook.Sheets[sheetName];
    const matrix = sheetUtils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    }) as any[][];

    const headerIndex = matrix.findIndex(
      row => Array.isArray(row) && row.some(cell => !isBlankCell(cell))
    );

    if (headerIndex < 0) {
      sheets.push({ name: sheetName, columns: [], rows: [] });
      return;
    }

    const headerRow = matrix[headerIndex] || [];
    const seen = new Map<string, number>();
    const columns = headerRow.map((value, index) => normalizeHeaderValue(value, index, seen));

    const rows = matrix
      .slice(headerIndex + 1)
      .filter(row => Array.isArray(row) && row.some(cell => !isBlankCell(cell)))
      .map((row, rowIndex) => {
        const record: ParsedRow = {
          __rowNumber: headerIndex + rowIndex + 2,
        };

        columns.forEach((column, columnIndex) => {
          record[column] = row[columnIndex] ?? null;
        });

        return record;
      });

    sheets.push({
      name: sheetName,
      columns,
      rows,
    });
  });

  return sheets;
}

export function WorkbookPreview({ source, project, theme, onClose }: WorkbookPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetsByName, setSheetsByName] = useState<Record<string, ParsedSheet>>({});
  const [selectedSheet, setSelectedSheet] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [sortState, setSortState] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(1);
  const [statsColumn, setStatsColumn] = useState('');
  const [highlightMode, setHighlightMode] = useState<'none' | 'blank' | 'duplicate' | 'numeric'>('none');
  const [showOnlyBlankRows, setShowOnlyBlankRows] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ rowNumber: number; column: string; value: any } | null>(null);
  const [goToRow, setGoToRow] = useState('');
  const [activityMessage, setActivityMessage] = useState('');

  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkbook() {
      setIsLoading(true);
      setError('');
      setActivityMessage('');

      try {
        const buffer = await source.file.arrayBuffer();
        const rawWorkbook = XLSX.read(buffer, {
          type: 'array',
          cellDates: true,
          raw: true,
        });

        const parsedSheets = buildSheetSummaries(rawWorkbook, XLSX.utils);
        const byName = Object.fromEntries(parsedSheets.map(sheet => [sheet.name, sheet]));
        const firstSheet = parsedSheets[0]?.name || '';
        const firstColumn = parsedSheets[0]?.columns[0] || '';

        if (!cancelled) {
          startTransition(() => {
            setSheetsByName(byName);
            setSheetNames(parsedSheets.map(sheet => sheet.name));
            setSelectedSheet(firstSheet);
            setStatsColumn(firstColumn);
            setSearchTerm('');
            setColumnFilters({});
            setHiddenColumns([]);
            setSortState(null);
            setPageSize(100);
            setPage(1);
            setHighlightMode('none');
            setShowOnlyBlankRows(false);
            setSelectedCell(null);
            setGoToRow('');
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Unable to open workbook preview.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadWorkbook();
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (!activityMessage) return;
    const timer = window.setTimeout(() => setActivityMessage(''), 2400);
    return () => window.clearTimeout(timer);
  }, [activityMessage]);

  const activeSheet = selectedSheet ? sheetsByName[selectedSheet] : undefined;
  const visibleColumns = activeSheet
    ? activeSheet.columns.filter(column => !hiddenColumns.includes(column))
    : [];

  const activeStatsColumn = visibleColumns.includes(statsColumn)
    ? statsColumn
    : visibleColumns[0] || '';

  const filteredRows = (() => {
    if (!activeSheet) return [];
    const term = deferredSearchTerm.trim().toLowerCase();

    return activeSheet.rows.filter(row => {
      if (term) {
        const haystack = visibleColumns.map(column => toDisplayValue(row[column]).toLowerCase()).join(' ');
        if (!haystack.includes(term)) return false;
      }

      for (const column of activeSheet.columns) {
        const filterValue = (columnFilters[column] || '').trim().toLowerCase();
        if (!filterValue) continue;
        if (!toDisplayValue(row[column]).toLowerCase().includes(filterValue)) return false;
      }

      if (showOnlyBlankRows) {
        const hasBlank = visibleColumns.some(column => isBlankCell(row[column]));
        if (!hasBlank) return false;
      }

      return true;
    });
  })();

  const sortedRows = (() => {
    if (!sortState) return filteredRows;
    const nextRows = [...filteredRows];
    nextRows.sort((left, right) => {
      const leftValue = parseComparableValue(left[sortState.column]);
      const rightValue = parseComparableValue(right[sortState.column]);
      if (leftValue < rightValue) return sortState.direction === 'asc' ? -1 : 1;
      if (leftValue > rightValue) return sortState.direction === 'asc' ? 1 : -1;
      return left.__rowNumber - right.__rowNumber;
    });
    return nextRows;
  })();

  const duplicateValueSet = (() => {
    if (!activeStatsColumn || highlightMode !== 'duplicate') return new Set<string>();
    const counts = new Map<string, number>();
    sortedRows.forEach(row => {
      const text = toDisplayValue(row[activeStatsColumn]).trim();
      if (!text) return;
      counts.set(text, (counts.get(text) || 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([value]) => value));
  })();

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const stats = (() => {
    if (!activeStatsColumn) {
      return {
        populated: 0,
        blanks: 0,
        unique: 0,
        numericCount: 0,
        min: '',
        max: '',
      };
    }

    const values = sortedRows.map(row => row[activeStatsColumn]);
    const nonBlankValues = values.filter(value => !isBlankCell(value));
    const numericValues = nonBlankValues
      .map(value => {
        if (typeof value === 'number') return value;
        const parsed = Number(toDisplayValue(value));
        return Number.isNaN(parsed) ? null : parsed;
      })
      .filter((value): value is number => value !== null);

    return {
      populated: nonBlankValues.length,
      blanks: values.length - nonBlankValues.length,
      unique: new Set(nonBlankValues.map(value => toDisplayValue(value))).size,
      numericCount: numericValues.length,
      min: numericValues.length ? String(Math.min(...numericValues)) : '--',
      max: numericValues.length ? String(Math.max(...numericValues)) : '--',
    };
  })();

  const resetView = () => {
    setSearchTerm('');
    setColumnFilters({});
    setHiddenColumns([]);
    setSortState(null);
    setPage(1);
    setPageSize(100);
    setHighlightMode('none');
    setShowOnlyBlankRows(false);
    setSelectedCell(null);
    setGoToRow('');
    if (activeSheet?.columns[0]) {
      setStatsColumn(activeSheet.columns[0]);
    }
    setActivityMessage('View reset');
  };

  const copySelectedCell = async () => {
    if (!selectedCell) {
      setActivityMessage('Select a cell first');
      return;
    }

    try {
      await navigator.clipboard.writeText(toDisplayValue(selectedCell.value));
      setActivityMessage(`Copied ${selectedCell.column}`);
    } catch {
      setActivityMessage('Clipboard not available');
    }
  };

  const exportFilteredCsv = () => {
    if (!activeSheet || visibleColumns.length === 0) return;
    const lines = [
      visibleColumns.map(column => escapeCsv(column)).join(','),
      ...sortedRows.map(row => visibleColumns.map(column => escapeCsv(row[column])).join(',')),
    ];
    downloadBlob(
      new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }),
      `${source.name.replace(/\.[^.]+$/, '')}_${activeSheet.name}_filtered.csv`
    );
    setActivityMessage('Filtered CSV exported');
  };

  const exportFilteredWorkbook = async () => {
    if (!activeSheet || visibleColumns.length === 0) return;
    const aoa = [
      visibleColumns,
      ...sortedRows.map(row => visibleColumns.map(column => row[column] ?? '')),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeSheet.name.slice(0, 31));
    XLSX.writeFile(workbook, `${source.name.replace(/\.[^.]+$/, '')}_${activeSheet.name}_filtered.xlsx`);
    setActivityMessage('Filtered workbook exported');
  };

  const goToRowInPreview = () => {
    const target = Number(goToRow);
    if (!Number.isInteger(target) || target <= 0) {
      setActivityMessage('Enter a valid row number');
      return;
    }

    const rowIndex = sortedRows.findIndex(row => row.__rowNumber === target);
    if (rowIndex < 0) {
      setActivityMessage('Row not found in current view');
      return;
    }

    setPage(Math.floor(rowIndex / pageSize) + 1);
    const focusColumn = activeStatsColumn || visibleColumns[0];
    setSelectedCell({
      rowNumber: target,
      column: focusColumn,
      value: focusColumn ? sortedRows[rowIndex][focusColumn] : '',
    });
    setActivityMessage(`Jumped to row ${target}`);
  };

  return (
    <section className="flex-1 min-h-0 bg-panel border border-border-v rounded-sm flex flex-col relative overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      {/* ── Row 1: Title bar ─────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-border-v bg-surface flex items-center gap-3 shrink-0 min-w-0">
        {/* Back button */}
        <Button
          className="h-8 px-3 bg-red-600 hover:bg-red-500 text-[10px] text-white shrink-0 flex items-center gap-1.5"
          onClick={onClose}
        >
          <ArrowLeft size={12} />
          Back to Validation
        </Button>

        {/* File icon + name + path */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileSpreadsheet size={14} className="text-sky-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider truncate text-foreground leading-tight">
              {source.name}
            </div>
            <div className="text-[9px] font-mono text-foreground/40 truncate leading-tight">
              {source.path}
            </div>
          </div>
        </div>

        {/* Badges: Project · Plant · Category · Status */}
        <div className="flex items-center gap-1.5 text-[9px] font-mono shrink-0">
          <span className="px-2 py-0.5 rounded border border-border-v/70 bg-background/80 text-foreground/90">{project}</span>
          <span className="px-2 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-300">{source.plant}</span>
          <span className="px-2 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-violet-300">{source.category}</span>
          <span className="px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 uppercase">{source.status}</span>
        </div>
      </div>

      {/* ── Row 2: Controls bar ───────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-border-v bg-surface flex items-center gap-2 shrink-0 min-w-0 overflow-x-auto">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none" />
          <input
            value={searchTerm}
            onChange={event => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search across visible cells"
            className="w-full h-9 bg-background/85 border border-border-v rounded-md pl-8 pr-3 text-[10px] text-foreground font-mono outline-none focus:border-sky-500/60 focus:bg-background"
          />
        </div>

        {/* Sheet selector */}
        <select
          value={selectedSheet}
          onChange={event => {
            const nextSheet = event.target.value;
            const nextColumns = sheetsByName[nextSheet]?.columns || [];
            setSelectedSheet(nextSheet);
            setStatsColumn(nextColumns[0] || '');
            setColumnFilters({});
            setHiddenColumns([]);
            setSortState(null);
            setPage(1);
          }}
          className="h-9 w-40 bg-surface/80 border border-border-v rounded-md px-2 text-[10px] text-foreground font-mono outline-none focus:border-violet-500/60 shrink-0"
          title="Sheet"
        >
          {sheetNames.map(sheetName => (
            <option key={sheetName} value={sheetName} className="bg-surface text-foreground">{sheetName}</option>
          ))}
        </select>

        {/* Page size */}
        <select
          value={pageSize}
          onChange={event => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}
          className="h-9 w-32 bg-surface/80 border border-border-v rounded-md px-2 text-[10px] text-foreground font-mono outline-none focus:border-emerald-500/60 shrink-0"
          title="Page size"
        >
          {PAGE_SIZE_OPTIONS.map(option => (
            <option key={option} value={option} className="bg-surface text-foreground">{option} rows</option>
          ))}
        </select>

        {/* Highlight mode */}
        <select
          value={highlightMode}
          onChange={event => setHighlightMode(event.target.value as 'none' | 'blank' | 'duplicate' | 'numeric')}
          className="h-9 w-40 bg-surface/80 border border-border-v rounded-md px-2 text-[10px] text-foreground font-mono outline-none focus:border-amber-500/60 shrink-0"
          title="Highlight mode"
        >
          <option value="none" className="bg-surface text-foreground">No highlight</option>
          <option value="blank" className="bg-surface text-foreground">Blank cells</option>
          <option value="duplicate" className="bg-surface text-foreground">Duplicate values</option>
          <option value="numeric" className="bg-surface text-foreground">Numeric values</option>
        </select>

        {/* Divider */}
        <div className="w-px h-5 bg-border-v/70 shrink-0" />

        {/* Go to row + Jump */}
        <input
          value={goToRow}
          onChange={event => setGoToRow(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && goToRowInPreview()}
          placeholder="Row #"
          className="h-9 w-20 bg-background/85 border border-border-v rounded-md px-2 text-[10px] text-foreground font-mono outline-none focus:border-sky-500/60 shrink-0"
        />
        <Button
          className="h-9 px-3 bg-sky-500 text-slate-950 hover:bg-sky-400 text-[10px] font-bold rounded-md shadow-[0_0_12px_rgba(56,189,248,0.18)] shrink-0"
          onClick={goToRowInPreview}
        >
          Jump
        </Button>

        {/* Status indicator */}
        <div className="hidden xl:inline-flex items-center gap-1.5 rounded-md border border-border-v bg-background/60 px-2.5 h-9 text-[9px] font-mono text-foreground/40 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]"></span>
          Preview ready
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-0 hidden xl:block" />

        {/* Action buttons */}
        <Button
          variant="outline"
          className="h-9 px-3 text-[10px] border-amber-500/25 bg-amber-500/8 text-amber-600 dark:text-amber-100 hover:bg-amber-500/14 hover:text-amber-700 dark:hover:text-white rounded-md shrink-0"
          onClick={resetView}
        >
          <RefreshCw size={11} className="mr-1" />
          Reset
        </Button>
        <Button
          variant="outline"
          className="h-9 px-3 text-[10px] border-emerald-500/25 bg-emerald-500/8 text-emerald-600 dark:text-emerald-100 hover:bg-emerald-500/14 hover:text-emerald-700 dark:hover:text-white rounded-md shrink-0"
          onClick={exportFilteredCsv}
        >
          <Download size={11} className="mr-1" />
          CSV
        </Button>
        <Button
          className="h-9 px-3 text-[10px] bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-md shadow-[0_0_12px_rgba(34,197,94,0.18)] shrink-0"
          onClick={exportFilteredWorkbook}
        >
          <Download size={11} className="mr-1" />
          XLSX
        </Button>
      </div>


      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="w-[320px] border-r border-border-v bg-panel p-4 overflow-y-auto scrollbar-clean shrink-0 space-y-4">
          <div className="rounded-xl border border-sky-500/18 bg-background/20 p-3 space-y-3 shadow-[0_10px_24px_rgba(14,165,233,0.06)]">
            <div className="text-[10px] uppercase tracking-widest text-foreground/50 font-bold">Workbook Summary</div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="rounded-lg border border-border-v bg-surface/20 p-2">
                <div className="text-foreground/40 uppercase text-[8px]">Sheets</div>
                <div className="text-[13px] font-bold text-sky-400">{sheetNames.length}</div>
              </div>
              <div className="rounded-lg border border-border-v bg-surface/20 p-2">
                <div className="text-foreground/40 uppercase text-[8px]">Visible cols</div>
                <div className="text-[13px] font-bold text-violet-300">{visibleColumns.length}</div>
              </div>
              <div className="rounded-lg border border-border-v bg-surface/20 p-2">
                <div className="text-foreground/40 uppercase text-[8px]">Filtered rows</div>
                <div className="text-[13px] font-bold text-emerald-400">{sortedRows.length}</div>
              </div>
              <div className="rounded-lg border border-border-v bg-surface/20 p-2">
                <div className="text-foreground/40 uppercase text-[8px]">Theme</div>
                <div className="text-[13px] font-bold uppercase text-foreground">{theme}</div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-[10px] font-mono text-foreground/80">
              <input
                type="checkbox"
                checked={showOnlyBlankRows}
                onChange={event => {
                  setShowOnlyBlankRows(event.target.checked);
                  setPage(1);
                }}
                className="h-3.5 w-3.5 rounded border-border-v/70 bg-background"
              />
              Show only rows with blanks
            </label>
            {selectedCell && (
              <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-2.5 text-[10px] font-mono">
                <div className="text-sky-300 font-bold mb-2 uppercase tracking-widest text-[9px]">Selected cell</div>
                <div className="text-foreground/90">Row {selectedCell.rowNumber}</div>
                <div className="truncate text-sky-600 dark:text-sky-200">{selectedCell.column}</div>
                <div className="truncate text-foreground/80 mt-1">{toDisplayValue(selectedCell.value) || '(blank)'}</div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" className="h-8 px-3 text-[9px] border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-100 hover:bg-sky-500/18 rounded-md" onClick={copySelectedCell}>
                    <Copy size={11} className="mr-1.5" />
                    Copy cell
                  </Button>
                </div>
              </div>
            )}
            {activityMessage && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-[10px] font-mono text-emerald-300">
                {activityMessage}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-violet-500/18 bg-background/20 p-3 space-y-3 shadow-[0_10px_24px_rgba(139,92,246,0.06)]">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-foreground/50 font-bold">Column Stats</div>
              <select
                value={activeStatsColumn}
                onChange={event => setStatsColumn(event.target.value)}
                className="h-8 max-w-[140px] bg-surface/90 border border-border-v rounded-md px-2 text-[10px] text-foreground font-mono outline-none focus:border-violet-500/60 truncate overflow-hidden"
                title={activeStatsColumn}
              >
                {visibleColumns.map(column => (
                  <option key={column} value={column} className="bg-surface text-foreground" title={column}>{column}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="rounded-lg border border-border-v bg-surface/20 p-2">
                <div className="text-foreground/40 uppercase text-[8px]">Populated</div>
                <div className="text-[12px] font-bold text-violet-600 dark:text-violet-200">{stats.populated}</div>
              </div>
              <div className="rounded-lg border border-border-v bg-surface/20 p-2">
                <div className="text-foreground/40 uppercase text-[8px]">Blanks</div>
                <div className="text-[12px] font-bold text-violet-600 dark:text-violet-200">{stats.blanks}</div>
              </div>
              <div className="rounded-lg border border-border-v bg-surface/20 p-2">
                <div className="text-foreground/40 uppercase text-[8px]">Unique</div>
                <div className="text-[12px] font-bold text-violet-600 dark:text-violet-200">{stats.unique}</div>
              </div>
              <div className="rounded-lg border border-border-v bg-surface/20 p-2">
                <div className="text-foreground/40 uppercase text-[8px]">Numeric</div>
                <div className="text-[12px] font-bold text-violet-600 dark:text-violet-200">{stats.numericCount}</div>
              </div>
              <div className="rounded-lg border border-border-v bg-surface/20 p-2">
                <div className="text-foreground/40 uppercase text-[8px]">Min</div>
                <div className="text-[12px] font-bold truncate text-violet-600 dark:text-violet-200">{stats.min}</div>
              </div>
              <div className="rounded-lg border border-border-v bg-surface/20 p-2">
                <div className="text-foreground/40 uppercase text-[8px]">Max</div>
                <div className="text-[12px] font-bold truncate text-violet-600 dark:text-violet-200">{stats.max}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/18 bg-background/20 p-3 space-y-3 shadow-[0_10px_24px_rgba(245,158,11,0.06)]">
            <div className="text-[10px] uppercase tracking-widest text-foreground/50 font-bold flex items-center gap-2">
              <Filter size={12} className="text-amber-300" />
              Column Filters
            </div>
            <div className="max-h-[260px] overflow-y-auto scrollbar-clean space-y-2 pr-1">
              {activeSheet?.columns.map(column => (
                <label key={column} className="block">
                  <span className="text-[9px] uppercase tracking-wider text-foreground/40 block mb-1 truncate" title={column}>{column}</span>
                  <input
                    value={columnFilters[column] || ''}
                    onChange={event => {
                      setColumnFilters(prev => ({ ...prev, [column]: event.target.value }));
                      setPage(1);
                    }}
                    placeholder="contains..."
                    className="w-full h-8 bg-surface/20 border border-border-v rounded-md px-2 text-[10px] text-foreground font-mono outline-none focus:border-amber-500/60"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/18 bg-background/20 p-3 space-y-3 shadow-[0_10px_24px_rgba(16,185,129,0.06)]">
            <div className="text-[10px] uppercase tracking-widest text-foreground/50 font-bold flex items-center gap-2">
              <Pin size={12} className="text-emerald-300" />
              Column Visibility
            </div>
            <div className="max-h-[260px] overflow-y-auto scrollbar-clean space-y-2 pr-1">
              {activeSheet?.columns.map(column => {
                const isVisible = !hiddenColumns.includes(column);
                return (
                  <label key={column} className="flex items-center justify-between gap-2 rounded-lg border border-border-v bg-surface/20 px-2 py-1.5 text-[10px] font-mono">
                    <span className="truncate text-foreground/90" title={column}>{column}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setHiddenColumns(prev => {
                          if (prev.includes(column)) {
                            return prev.filter(item => item !== column);
                          }
                          if (activeSheet.columns.length - prev.length <= 1) {
                            setActivityMessage('Keep at least one column visible');
                            return prev;
                          }
                          return [...prev, column];
                        });
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded border text-[9px] uppercase tracking-wider',
                        isVisible
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                          : 'border-border-v/70 bg-background text-foreground/40'
                      )}
                    >
                      {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                      {isVisible ? 'Shown' : 'Hidden'}
                    </button>
                  </label>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-panel">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 p-4 border-b border-border-v shrink-0">
            <div className="rounded-xl border border-sky-500/18 bg-sky-500/20 p-3 shadow-[0_10px_20px_rgba(14,165,233,0.05)]">
              <div className="text-[9px] uppercase tracking-widest text-foreground/50">Search matches</div>
              <div className="text-[18px] font-bold text-sky-600 dark:text-sky-300">{sortedRows.length}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/18 bg-emerald-500/20 p-3 shadow-[0_10px_20px_rgba(16,185,129,0.05)]">
              <div className="text-[9px] uppercase tracking-widest text-foreground/50">Current page</div>
              <div className="text-[18px] font-bold text-emerald-600 dark:text-emerald-300">{clampedPage} / {totalPages}</div>
            </div>
            <div className="rounded-xl border border-violet-500/18 bg-violet-500/20 p-3 shadow-[0_10px_20px_rgba(139,92,246,0.05)]">
              <div className="text-[9px] uppercase tracking-widest text-foreground/50">Active sort</div>
              <div className="text-[12px] font-bold truncate text-violet-600 dark:text-violet-200">{sortState ? `${sortState.column} (${sortState.direction})` : 'none'}</div>
            </div>
            <div className="rounded-xl border border-amber-500/18 bg-amber-500/20 p-3 shadow-[0_10px_20px_rgba(245,158,11,0.05)]">
              <div className="text-[9px] uppercase tracking-widest text-foreground/50">Frozen column</div>
              <div className="text-[12px] font-bold truncate text-amber-700 dark:text-amber-100">{visibleColumns[0] || '--'}</div>
            </div>
            <div className="rounded-xl border border-fuchsia-500/18 bg-fuchsia-500/20 p-3 shadow-[0_10px_20px_rgba(217,70,239,0.05)]">
              <div className="text-[9px] uppercase tracking-widest text-foreground/50">Selected sheet</div>
              <div className="text-[12px] font-bold truncate text-fuchsia-600 dark:text-fuchsia-200">{selectedSheet || '--'}</div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto scrollbar-clean">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-[12px] uppercase tracking-widest text-foreground/40 font-mono">
                Loading workbook preview...
              </div>
            ) : error ? (
              <div className="h-full flex items-center justify-center p-8 text-center">
                <div className="max-w-md rounded-lg border border-red-500/20 bg-red-500/10 p-5 text-red-300 text-[11px] font-mono">
                  {error}
                </div>
              </div>
            ) : !activeSheet || visibleColumns.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[12px] uppercase tracking-widest text-foreground/40 font-mono">
                No previewable columns found in this sheet.
              </div>
            ) : (
              <table className="min-w-max w-full border-collapse text-[11px] font-mono">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-surface/95 backdrop-blur border-b border-border-v/70">
                    <th className="sticky left-0 z-30 w-14 bg-surface/95 border-r border-border-v/70 px-3 py-3 text-left uppercase tracking-widest text-[9px] text-foreground/50 shadow-[6px_0_12px_rgba(0,0,0,0.18)]">
                      Row
                    </th>
                    {visibleColumns.map((column, index) => {
                      const isSorted = sortState?.column === column;
                      const stickyClass = index === 0 ? 'sticky left-14 z-20 bg-surface/95 border-r border-border-v/70 shadow-[6px_0_12px_rgba(0,0,0,0.18)]' : '';
                      return (
                        <th
                          key={column}
                          className={cn(
                            'px-3 py-3 text-left uppercase tracking-widest text-[9px] text-foreground/50 border-r border-border-v min-w-[180px]',
                            stickyClass
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setStatsColumn(column);
                              setSortState(prev => {
                                if (!prev || prev.column !== column) return { column, direction: 'asc' };
                                if (prev.direction === 'asc') return { column, direction: 'desc' };
                                return null;
                              });
                            }}
                            className="w-full flex items-center justify-between gap-2 hover:text-foreground transition-colors"
                          >
                            <span className="truncate">{column}</span>
                            <span className={cn('text-[10px]', isSorted ? 'text-sky-600 dark:text-sky-300' : 'text-foreground/30')}>
                              {isSorted ? (sortState?.direction === 'asc' ? 'ASC' : 'DESC') : 'SORT'}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(row => (
                    <tr key={row.__rowNumber} className="border-b border-border-v/40 hover:bg-foreground/5">
                      <td className="sticky left-0 z-10 bg-panel border-r border-border-v px-3 py-2.5 text-foreground/40 shadow-[6px_0_12px_rgba(0,0,0,0.12)]">
                        {row.__rowNumber}
                      </td>
                      {visibleColumns.map((column, index) => {
                        const cellValue = row[column];
                        const text = toDisplayValue(cellValue);
                        const isSelected =
                          selectedCell?.rowNumber === row.__rowNumber &&
                          selectedCell?.column === column;
                        const isDuplicate =
                          highlightMode === 'duplicate' &&
                          activeStatsColumn === column &&
                          duplicateValueSet.has(text.trim()) &&
                          text.trim() !== '';
                        const isBlank = highlightMode === 'blank' && isBlankCell(cellValue);
                        const isNumeric = highlightMode === 'numeric' && !Number.isNaN(Number(text)) && text !== '';
                        const stickyClass = index === 0 ? 'sticky left-14 z-10 bg-panel border-r border-border-v shadow-[6px_0_12px_rgba(0,0,0,0.12)]' : '';

                        return (
                          <td
                            key={`${row.__rowNumber}-${column}`}
                            className={cn(
                              'px-3 py-2.5 border-r border-border-v/40 align-top max-w-[260px] text-foreground',
                              stickyClass,
                              isSelected && 'outline outline-1 outline-sky-400 bg-sky-500/12 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.15)]',
                              isDuplicate && 'bg-violet-500/12 text-violet-700 dark:text-violet-100',
                              isBlank && 'bg-amber-500/12 text-amber-700 dark:text-amber-100',
                              isNumeric && 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-100'
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCell({
                                  rowNumber: row.__rowNumber,
                                  column,
                                  value: cellValue,
                                });
                                setStatsColumn(column);
                              }}
                              className="w-full text-left whitespace-nowrap overflow-hidden text-ellipsis"
                              title={text || '(blank)'}
                            >
                              {text || <span className="text-foreground/30">(blank)</span>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-4 py-3 border-t border-border-v bg-surface/95 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
            <div className="text-[10px] font-mono text-foreground/50">
              Showing {(clampedPage - 1) * pageSize + (pageRows.length ? 1 : 0)}-{(clampedPage - 1) * pageSize + pageRows.length} of {sortedRows.length} filtered rows
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-8 px-3 text-[10px] border-border-v/70 bg-surface/80 text-foreground/90 hover:bg-surface"
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={clampedPage <= 1}
              >
                Prev
              </Button>
              <div className="px-3 py-1 rounded-md border border-sky-500/20 bg-sky-500/8 text-[10px] font-mono text-sky-700 dark:text-sky-100">
                Page {clampedPage} / {totalPages}
              </div>
              <Button
                variant="outline"
                className="h-8 px-3 text-[10px] border-border-v/70 bg-surface/80 text-foreground/90 hover:bg-surface"
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={clampedPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
