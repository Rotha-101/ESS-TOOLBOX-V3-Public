import React, { useState, useEffect, useRef } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Image, Table, AlertCircle, Code, Link as LinkIcon, Link2Off,
  Undo2, Redo2, FileText, FileDown, Trash2, Printer, ArrowRightToLine, FileSpreadsheet,
  Check, Copy, Sparkles, HelpCircle, RefreshCw, X, Plus, Upload,
  Battery, Activity, GitCompare, Thermometer, Zap, AlertTriangle, PenTool, Coins, Cpu, BarChart3, Settings,
  ChevronDown, ChevronRight, Folder
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_LIBRARY_TOOLS, CustomTool } from '../lib/defaultTools';

interface SmartReportProps {
  lastAiResponse?: string;
  project?: string;
  plant?: string;
  theme?: 'light' | 'dark';
}

export function SmartReport({ lastAiResponse = '', project = 'SNTL 400', plant = 'plant1', theme = 'dark' }: SmartReportProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Undo/Redo history states
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isHistoryAction, setIsHistoryAction] = useState(false);
  
  // UI popups and states
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  
  const [showCalloutModal, setShowCalloutModal] = useState(false);
  const [calloutType, setCalloutType] = useState<'info' | 'warning' | 'error'>('info');

  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Statistics
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Editor states
  const [activeFont, setActiveFont] = useState('Inter');
  const [activeSize, setActiveSize] = useState('14px');
  const [selectedPlant, setSelectedPlant] = useState(plant);

  // Report Generator States
  const [selectedProjectTemplate, setSelectedProjectTemplate] = useState(() => localStorage.getItem('ess_report_project_template') || 'SNTL400');
  const [reportBy, setReportBy] = useState(() => localStorage.getItem('ess_report_by') || 'Sorn Chanraksa');
  const [reportDate, setReportDate] = useState(() => localStorage.getItem('ess_report_date') || new Date().toISOString().split('T')[0]);
  const [edcResponse, setEdcResponse] = useState(() => localStorage.getItem('ess_report_edc') || 'The commands followed the NCC instructions, and no incorrect command was observed.');
  const [notices, setNotices] = useState(() => localStorage.getItem('ess_report_notices') || 'The Q was not aligned with the NCC command during some intervals because the control mode was changed from closed-loop to open-loop during grid forming testing.\n\nThe F deadband was ±0.2 Hz. We also observed that during some intervals, the frequency was outside the deadband and the BESS reacted to the frequency fluctuations. However, during other intervals, the frequency remained within the deadband range, but the BESS was still triggered to charge or discharge around 1-3 MW.\n\nThe Q of both plants injected or absorbed during some intervals due to the grid-forming response to voltage variations.');
  const [pfEvaluation, setPfEvaluation] = useState(() => localStorage.getItem('ess_report_pf_eval') || 'Normal');
  const [psocEvaluation, setPsocEvaluation] = useState(() => localStorage.getItem('ess_report_psoc_eval') || 'Normal');
  const [quEvaluation, setQuEvaluation] = useState(() => localStorage.getItem('ess_report_qu_eval') || 'Normal');
  const [cmcsPerformance, setCmcsPerformance] = useState(() => localStorage.getItem('ess_report_cmcs') || "The plants' active power was aligned with the CMCS command, with no noticeable deviations.");
  const [pfOpMode, setPfOpMode] = useState(() => localStorage.getItem('ess_report_pf_op') || 'Remote Control');
  const [psocOpMode, setPsocOpMode] = useState(() => localStorage.getItem('ess_report_psoc_op') || 'Remote Control');
  const [quOpMode, setQuOpMode] = useState(() => localStorage.getItem('ess_report_qu_op') || 'N/A');



  // Custom tool states


  // Ribbon layout interfaces
  interface RibbonCommand {
    id: string;
    label: string;
    iconName: string;
  }

  interface RibbonGroup {
    id: string;
    label: string;
    visible: boolean;
    commands: RibbonCommand[];
  }

  interface RibbonTab {
    id: string;
    label: string;
    visible: boolean;
    groups: RibbonGroup[];
  }

  const defaultSignatureTool: CustomTool = {
    id: "signature_sign_off_default",
    name: "Engineering Sign-off (Default)",
    shortName: "Sign-off",
    description: "Default signature box for operational and grid engineering reports.",
    category: "addins",
    group: "custom_tools",
    iconName: "PenTool",
    fields: [
      { id: "engineerName", label: "Engineer Name", type: "text", defaultValue: "Alex Mercer" },
      { id: "role", label: "Role/Title", type: "text", defaultValue: "Lead Battery Storage Engineer" },
      { id: "company", label: "Company", type: "text", defaultValue: "SNT Energy Solutions" }
    ],
    execute: (inputs) => {
      const name = inputs.engineerName || "Alex Mercer";
      const role = inputs.role || "Lead Battery Storage Engineer";
      const company = inputs.company || "SNT Energy Solutions";
      const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      return `
        <div class="engineering-signoff-box">
          <div style="font-weight: bold; font-size: 13px; color: #00A3FF; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">🖋️ Engineering Verification & Approval</div>
          <table class="signoff-table">
            <tr>
              <td style="padding: 6px 0; width: 35%;" class="signoff-label">Verified By:</td>
              <td style="padding: 6px 0; font-weight: bold;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;" class="signoff-label">Role / Designation:</td>
              <td style="padding: 6px 0;">${role}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;" class="signoff-label">Organization:</td>
              <td style="padding: 6px 0;">${company}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;" class="signoff-label">Verification Date:</td>
              <td style="padding: 6px 0; font-family: monospace;">${dateStr}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0;" class="signoff-label">Signature:</td>
              <td style="padding: 12px 0 0 0; font-family: 'Courier New', Courier, monospace; font-size: 16px; font-style: italic; color: #00A3FF; font-weight: bold;">
                /s/ ${name}
              </td>
            </tr>
          </table>
        </div>
      `;
    }
  };

  const [customTools, setCustomTools] = useState<CustomTool[]>([
    defaultSignatureTool,
    ...DEFAULT_LIBRARY_TOOLS
  ]);

  const [selectedTool, setSelectedTool] = useState<CustomTool | null>(null);
  const [showToolModal, setShowToolModal] = useState(false);
  const [toolInputs, setToolInputs] = useState<Record<string, any>>({});
  const toolFileInputRef = useRef<HTMLInputElement>(null);

  // States for category-routing tool uploader dialog
  const [pendingImportTool, setPendingImportTool] = useState<{ tool: CustomTool; content: string } | null>(null);
  const [showImportTargetModal, setShowImportTargetModal] = useState(false);
  const [importTargetTabId, setImportTargetTabId] = useState<string>('addins');
  const [importTargetGroupId, setImportTargetGroupId] = useState<string>('custom_tools');
  const [newTabName, setNewTabName] = useState<string>('');
  const [newGroupName, setNewGroupName] = useState<string>('');

  // Ribbon Toolbar States
  const [ribbonLayout, setRibbonLayout] = useState<RibbonTab[]>([]);
  const [activeRibbonTab, setActiveRibbonTab] = useState<string>("home");

  // Ribbon Customizer Modal States
  const [showCustomizeRibbonModal, setShowCustomizeRibbonModal] = useState(false);
  const [tempRibbonLayout, setTempRibbonLayout] = useState<RibbonTab[]>([]);
  const [selectedAvailableCommandId, setSelectedAvailableCommandId] = useState<string>("");
  const [selectedTreeNode, setSelectedTreeNode] = useState<{
    type: 'tab' | 'group' | 'command';
    tabId: string;
    groupId?: string;
    commandId?: string;
  } | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'tab_home': true,
    'tab_insert': true,
    'tab_addins': true
  });
  const [chooseCommandsFrom, setChooseCommandsFrom] = useState<string>("popular");
  const [showResetDropdown, setShowResetDropdown] = useState(false);
  const [showImportExportDropdown, setShowImportExportDropdown] = useState(false);
  const ribbonConfigFileInputRef = useRef<HTMLInputElement>(null);

  const defaultRibbonLayout: RibbonTab[] = [
    {
      id: "home",
      label: "Home",
      visible: true,
      groups: [
        {
          id: "font",
          label: "Font",
          visible: true,
          commands: [
            { id: "font_family", label: "Font Family", iconName: "Font" },
            { id: "font_size", label: "Font Size", iconName: "TextSize" },
            { id: "bold", label: "Bold", iconName: "Bold" },
            { id: "italic", label: "Italic", iconName: "Italic" },
            { id: "underline", label: "Underline", iconName: "Underline" },
            { id: "strikethrough", label: "Strikethrough", iconName: "Strikethrough" },
            { id: "colors", label: "Text & Highlight Colors", iconName: "Palette" }
          ]
        },
        {
          id: "paragraph",
          label: "Paragraph",
          visible: true,
          commands: [
            { id: "align_left", label: "Align Left", iconName: "AlignLeft" },
            { id: "align_center", label: "Align Center", iconName: "AlignCenter" },
            { id: "align_right", label: "Align Right", iconName: "AlignRight" },
            { id: "align_justify", label: "Align Justify", iconName: "AlignJustify" },
            { id: "list_bullet", label: "Bullet List", iconName: "List" },
            { id: "list_ordered", label: "Numbered List", iconName: "ListOrdered" },
            { id: "hr", label: "Horizontal Line", iconName: "ArrowRightToLine" },
            { id: "page_break", label: "Page Break", iconName: "PB" }
          ]
        }
      ]
    },
    {
      id: "insert",
      label: "Insert",
      visible: true,
      groups: [
        {
          id: "tables",
          label: "Tables",
          visible: true,
          commands: [
            { id: "table", label: "Table", iconName: "Table" }
          ]
        },
        {
          id: "illustrations",
          label: "Illustrations",
          visible: true,
          commands: [
            { id: "image", label: "Upload Image", iconName: "Image" }
          ]
        },
        {
          id: "links",
          label: "Links",
          visible: true,
          commands: [
            { id: "hyperlink", label: "Hyperlink", iconName: "LinkIcon" },
            { id: "unlink", label: "Remove Link", iconName: "Link2Off" }
          ]
        },
        {
          id: "analytics",
          label: "Grid Analytics",
          visible: true,
          commands: [
            { id: "callout", label: "Callout Box", iconName: "AlertCircle" },
            { id: "code_block", label: "Code Block", iconName: "Code" },
            { id: "ai_response", label: "AI Response", iconName: "Sparkles" },
            { id: "bess_graph", label: "BESS Graph", iconName: "FileSpreadsheet" }
          ]
        }
      ]
    }
  ];

  const MASTER_AVAILABLE_COMMANDS = [
    { id: "font_family", label: "Font Family", iconName: "Font" },
    { id: "font_size", label: "Font Size", iconName: "TextSize" },
    { id: "bold", label: "Bold", iconName: "Bold" },
    { id: "italic", label: "Italic", iconName: "Italic" },
    { id: "underline", label: "Underline", iconName: "Underline" },
    { id: "strikethrough", label: "Strikethrough", iconName: "Strikethrough" },
    { id: "colors", label: "Text & Highlight Colors", iconName: "Palette" },
    { id: "align_left", label: "Align Left", iconName: "AlignLeft" },
    { id: "align_center", label: "Align Center", iconName: "AlignCenter" },
    { id: "align_right", label: "Align Right", iconName: "AlignRight" },
    { id: "align_justify", label: "Align Justify", iconName: "AlignJustify" },
    { id: "list_bullet", label: "Bullet List", iconName: "List" },
    { id: "list_ordered", label: "Numbered List", iconName: "ListOrdered" },
    { id: "hr", label: "Horizontal Line", iconName: "ArrowRightToLine" },
    { id: "page_break", label: "Page Break", iconName: "PB" },
    { id: "table", label: "Table", iconName: "Table" },
    { id: "image", label: "Upload Image", iconName: "Image" },
    { id: "hyperlink", label: "Hyperlink", iconName: "LinkIcon" },
    { id: "unlink", label: "Remove Link", iconName: "Link2Off" },
    { id: "callout", label: "Callout Box", iconName: "AlertCircle" },
    { id: "code_block", label: "Code Block", iconName: "Code" },
    { id: "ai_response", label: "AI Response", iconName: "Sparkles" },
    { id: "bess_graph", label: "BESS Graph", iconName: "FileSpreadsheet" },
    { id: "import_tool", label: "Import Tool File", iconName: "Upload" }
  ];

  const getAvailableCommands = () => {
    const customCmds = customTools.map(t => ({
      id: `tool_${t.id}`,
      label: t.name,
      iconName: t.id
    }));
    return [...MASTER_AVAILABLE_COMMANDS, ...customCmds];
  };

  // Load custom tools and ribbon layout on mount
  useEffect(() => {
    // 1. Load saved tools
    const savedTools = localStorage.getItem('ess_imported_tools_code');
    if (savedTools) {
      try {
        const codes = JSON.parse(savedTools) as string[];
        const parsedTools: CustomTool[] = [];
        codes.forEach(code => {
          try {
            let tool: any;
            try {
              tool = new Function(`return ${code}`)();
            } catch (e1) {
              tool = eval(code);
            }
            if (tool && tool.id && tool.name && tool.execute) {
              parsedTools.push(tool);
            }
          } catch (err) {
            console.error("Error loading persisted tool", err);
          }
        });
        
        if (parsedTools.length > 0) {
          setCustomTools(prev => {
            const baseTools = prev.filter(t => t.id === 'signature_sign_off_default' || DEFAULT_LIBRARY_TOOLS.some(lt => lt.id === t.id));
            const baseIds = new Set(baseTools.map(b => b.id));
            const userImported = parsedTools.filter(t => !baseIds.has(t.id));
            return [...baseTools, ...userImported];
          });
        }
      } catch (e) {
        console.error("Failed to parse saved tools", e);
      }
    }

    // 2. Load ribbon layout
    const savedLayout = localStorage.getItem('ess_smart_report_ribbon_v3');
    if (savedLayout) {
      try {
        const layout = JSON.parse(savedLayout) as RibbonTab[];
        const hasBessOps = layout.some(tab => tab.id === 'bess_ops');
        if (hasBessOps) {
          setRibbonLayout(layout);
        } else {
          setRibbonLayout(defaultRibbonLayout);
          localStorage.setItem('ess_smart_report_ribbon_v3', JSON.stringify(defaultRibbonLayout));
        }
      } catch (e) {
        setRibbonLayout(defaultRibbonLayout);
      }
    } else {
      setRibbonLayout(defaultRibbonLayout);
    }
  }, []);

  const handleToolImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        let tool: any;
        try {
          tool = new Function(`return ${content}`)();
        } catch (e1) {
          tool = eval(content);
        }

        if (!tool || !tool.id || !tool.name || !tool.execute) {
          throw new Error("Missing required fields (id, name, or execute function)");
        }

        // Set pending tool and open destination selection modal
        setPendingImportTool({ tool, content });
        setImportTargetTabId('addins');
        setImportTargetGroupId('custom_tools');
        setNewTabName('');
        setNewGroupName('');
        setShowImportTargetModal(true);
      } catch (err: any) {
        alert(`Failed to parse tool file "${file.name}": ${err.message || err}`);
      }
    };
    reader.onerror = () => {
      alert(`Error reading file "${file.name}"`);
    };
    reader.readAsText(file);

    if (toolFileInputRef.current) {
      toolFileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImportTool) return;
    const { tool, content } = pendingImportTool;

    let targetTabId = importTargetTabId;
    let targetGroupId = importTargetGroupId;

    setRibbonLayout(prevLayout => {
      let updatedLayout = [...prevLayout];

      // 1. Check if we need to create a new tab
      if (targetTabId === 'create_new_tab') {
        const generatedTabId = `tab_${Date.now()}`;
        const generatedGroupId = `group_${Date.now()}`;
        const tabLabel = newTabName.trim() || "Custom Tab";
        const groupLabel = newGroupName.trim() || "Custom Group";

        const newTab: RibbonTab = {
          id: generatedTabId,
          label: tabLabel,
          visible: true,
          groups: [
            {
              id: generatedGroupId,
              label: groupLabel,
              visible: true,
              commands: [{ id: `tool_${tool.id}`, label: tool.name, iconName: tool.iconName || tool.id }]
            }
          ]
        };
        updatedLayout.push(newTab);
      } else {
        // Find existing tab
        updatedLayout = updatedLayout.map(tab => {
          if (tab.id === targetTabId) {
            let updatedGroups = [...tab.groups];

            // 2. Check if we need to create a new group in this tab
            if (targetGroupId === 'create_new_group') {
              const generatedGroupId = `group_${Date.now()}`;
              const groupLabel = newGroupName.trim() || "Custom Group";
              
              updatedGroups.push({
                id: generatedGroupId,
                label: groupLabel,
                visible: true,
                commands: [{ id: `tool_${tool.id}`, label: tool.name, iconName: tool.iconName || tool.id }]
              });
            } else {
              // Add to existing group
              updatedGroups = updatedGroups.map(group => {
                if (group.id === targetGroupId) {
                  const exists = group.commands.some(c => c.id === `tool_${tool.id}`);
                  if (!exists) {
                    return {
                      ...group,
                      commands: [...group.commands, { id: `tool_${tool.id}`, label: tool.name, iconName: tool.iconName || tool.id }]
                    };
                  }
                }
                return group;
              });
            }

            return { ...tab, groups: updatedGroups };
          }
          return tab;
        });
      }

      localStorage.setItem('ess_smart_report_ribbon_v3', JSON.stringify(updatedLayout));
      return updatedLayout;
    });

    // 3. Update customTools list
    setCustomTools(prev => {
      const filtered = prev.filter(t => t.id !== tool.id);
      return [...filtered, tool];
    });

    // 4. Persist tool code in registry
    const toolRegistry: Record<string, string> = JSON.parse(localStorage.getItem('ess_imported_tools_registry') || '{}');
    toolRegistry[tool.id] = content;
    localStorage.setItem('ess_imported_tools_registry', JSON.stringify(toolRegistry));
    localStorage.setItem('ess_imported_tools_code', JSON.stringify(Object.values(toolRegistry)));

    // Reset and close
    setPendingImportTool(null);
    setShowImportTargetModal(false);
  };

  const handleSelectTool = (toolId: string) => {
    if (!toolId) return;
    const tool = customTools.find(t => t.id === toolId);
    if (!tool) return;
    
    const initialInputs: Record<string, any> = {};
    tool.fields.forEach(field => {
      initialInputs[field.id] = field.defaultValue !== undefined ? field.defaultValue : '';
    });
    
    setToolInputs(initialInputs);
    setSelectedTool(tool);
    setShowToolModal(true);
  };

  const handleExecuteTool = () => {
    if (!selectedTool) return;
    try {
      const html = selectedTool.execute(toolInputs);
      insertHtmlAtCursor(html);
      setShowToolModal(false);
      setSelectedTool(null);
    } catch (err: any) {
      alert(`Error executing tool: ${err.message || err}`);
    }
  };

  const handleRibbonCommand = (cmdId: string) => {
    // 1. Text commands
    if (cmdId === 'bold') executeCommand('bold');
    else if (cmdId === 'italic') executeCommand('italic');
    else if (cmdId === 'underline') executeCommand('underline');
    else if (cmdId === 'strikethrough') executeCommand('strikeThrough');
    else if (cmdId === 'align_left') executeCommand('justifyLeft');
    else if (cmdId === 'align_center') executeCommand('justifyCenter');
    else if (cmdId === 'align_right') executeCommand('justifyRight');
    else if (cmdId === 'align_justify') executeCommand('justifyFull');
    else if (cmdId === 'list_bullet') executeCommand('insertUnorderedList');
    else if (cmdId === 'list_ordered') executeCommand('insertOrderedList');
    else if (cmdId === 'hr') executeCommand('insertHorizontalRule');
    else if (cmdId === 'page_break') {
      insertHtmlAtCursor('<hr class="page-break" title="Page Break" />');
    }
    
    // 2. Elements/Modals
    else if (cmdId === 'table') setShowTableModal(true);
    else if (cmdId === 'image') fileInputRef.current?.click();
    else if (cmdId === 'hyperlink') setShowLinkModal(true);
    else if (cmdId === 'unlink') executeCommand('unlink');
    else if (cmdId === 'callout') setShowCalloutModal(true);
    else if (cmdId === 'code_block') {
      insertHtmlAtCursor('<pre class="report-code-block"><code>// code parameters here...</code></pre>');
    }
    else if (cmdId === 'ai_response') handleImportAiResponse();
    else if (cmdId === 'bess_graph') handleImportActiveGraph();
    else if (cmdId === 'import_tool') toolFileInputRef.current?.click();
    
    // 3. Custom tools execution
    else if (cmdId.startsWith('tool_')) {
      const toolId = cmdId.substring(5);
      handleSelectTool(toolId);
    }
  };

  // Ribbon Customizer Actions
  const handleOpenRibbonCustomizer = () => {
    setTempRibbonLayout(JSON.parse(JSON.stringify(ribbonLayout)));
    setSelectedAvailableCommandId("");
    setSelectedTreeNode(null);
    setShowCustomizeRibbonModal(true);
  };

  const handleSaveRibbonCustomizer = () => {
    setRibbonLayout(tempRibbonLayout);
    localStorage.setItem('ess_smart_report_ribbon_v3', JSON.stringify(tempRibbonLayout));
    setShowCustomizeRibbonModal(false);
  };

  const handleAddCommand = () => {
    if (!selectedAvailableCommandId || !selectedTreeNode || selectedTreeNode.type !== 'group') return;
    
    const cmdList = getAvailableCommands();
    const cmdToCopy = cmdList.find(c => c.id === selectedAvailableCommandId);
    if (!cmdToCopy) return;

    const newLayout = tempRibbonLayout.map(tab => {
      if (tab.id === selectedTreeNode.tabId) {
        const newGroups = tab.groups.map(group => {
          if (group.id === selectedTreeNode.groupId) {
            // Avoid duplicates in the same group
            const exists = group.commands.some(c => c.id === cmdToCopy.id);
            if (!exists) {
              return {
                ...group,
                commands: [...group.commands, { id: cmdToCopy.id, label: cmdToCopy.label, iconName: cmdToCopy.iconName }]
              };
            }
          }
          return group;
        });
        return { ...tab, groups: newGroups };
      }
      return tab;
    });
    setTempRibbonLayout(newLayout);
  };

  const handleRemoveNode = () => {
    if (!selectedTreeNode) return;
    
    const { type, tabId, groupId, commandId } = selectedTreeNode;
    
    if (type === 'command') {
      const newLayout = tempRibbonLayout.map(tab => {
        if (tab.id === tabId) {
          const newGroups = tab.groups.map(group => {
            if (group.id === groupId) {
              return {
                ...group,
                commands: group.commands.filter(c => c.id !== commandId)
              };
            }
            return group;
          });
          return { ...tab, groups: newGroups };
        }
        return tab;
      });
      setTempRibbonLayout(newLayout);
      setSelectedTreeNode(null);
    } else if (type === 'group') {
      const newLayout = tempRibbonLayout.map(tab => {
        if (tab.id === tabId) {
          return {
            ...tab,
            groups: tab.groups.filter(g => g.id !== groupId)
          };
        }
        return tab;
      });
      setTempRibbonLayout(newLayout);
      setSelectedTreeNode(null);
    } else if (type === 'tab') {
      const newLayout = tempRibbonLayout.filter(t => t.id !== tabId);
      setTempRibbonLayout(newLayout);
      setSelectedTreeNode(null);
    }
  };

  const handleCreateNewTab = () => {
    const tabId = `tab_${Date.now()}`;
    const groupId = `group_${Date.now()}`;
    const newTab: RibbonTab = {
      id: tabId,
      label: "New Tab (Custom)",
      visible: true,
      groups: [
        {
          id: groupId,
          label: "New Group",
          visible: true,
          commands: []
        }
      ]
    };
    setTempRibbonLayout(prev => [...prev, newTab]);
    setSelectedTreeNode({ type: 'tab', tabId });
  };

  const handleCreateNewGroup = () => {
    if (!selectedTreeNode) return;
    const tabId = selectedTreeNode.tabId;
    const groupId = `group_${Date.now()}`;
    
    const newLayout = tempRibbonLayout.map(tab => {
      if (tab.id === tabId) {
        return {
          ...tab,
          groups: [...tab.groups, { id: groupId, label: "New Group (Custom)", visible: true, commands: [] }]
        };
      }
      return tab;
    });
    setTempRibbonLayout(newLayout);
    setSelectedTreeNode({ type: 'group', tabId, groupId });
  };

  const handleRenameNode = () => {
    if (!selectedTreeNode || selectedTreeNode.type === 'command') return;
    
    const { type, tabId, groupId } = selectedTreeNode;
    let oldName = "";
    
    if (type === 'tab') {
      const tab = tempRibbonLayout.find(t => t.id === tabId);
      if (tab) oldName = tab.label;
    } else if (type === 'group') {
      const tab = tempRibbonLayout.find(t => t.id === tabId);
      const group = tab?.groups.find(g => g.id === groupId);
      if (group) oldName = group.label;
    }
    
    const newName = prompt("Rename element:", oldName);
    if (!newName || newName.trim() === "") return;
    
    const newLayout = tempRibbonLayout.map(tab => {
      if (tab.id === tabId) {
        if (type === 'tab') {
          return { ...tab, label: newName.trim() };
        } else {
          const newGroups = tab.groups.map(group => {
            if (group.id === groupId) {
              return { ...group, label: newName.trim() };
            }
            return group;
          });
          return { ...tab, groups: newGroups };
        }
      }
      return tab;
    });
    setTempRibbonLayout(newLayout);
  };

  const handleToggleNodeVisibility = (tabId: string, groupId?: string) => {
    const newLayout = tempRibbonLayout.map(tab => {
      if (tab.id === tabId) {
        if (!groupId) {
          return { ...tab, visible: !tab.visible };
        } else {
          const newGroups = tab.groups.map(group => {
            if (group.id === groupId) {
              return { ...group, visible: !group.visible };
            }
            return group;
          });
          return { ...tab, groups: newGroups };
        }
      }
      return tab;
    });
    setTempRibbonLayout(newLayout);
  };

  const handleResetRibbonConfig = (mode: 'all' | 'selected') => {
    if (mode === 'all') {
      setTempRibbonLayout(defaultRibbonLayout);
    } else {
      if (!selectedTreeNode) return;
      const defaultTab = defaultRibbonLayout.find(t => t.id === selectedTreeNode.tabId);
      if (defaultTab) {
        const newLayout = tempRibbonLayout.map(t => {
          if (t.id === selectedTreeNode.tabId) {
            return JSON.parse(JSON.stringify(defaultTab));
          }
          return t;
        });
        setTempRibbonLayout(newLayout);
      } else {
        // If it's a custom tab, remove it
        const newLayout = tempRibbonLayout.filter(t => t.id !== selectedTreeNode.tabId);
        setTempRibbonLayout(newLayout);
        setSelectedTreeNode(null);
      }
    }
    setShowResetDropdown(false);
  };

  const handleExportRibbonConfig = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tempRibbonLayout, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "custom_ribbon_settings.json");
    dlAnchorElem.click();
    setShowImportExportDropdown(false);
  };

  const handleImportRibbonConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setTempRibbonLayout(imported);
          alert("Ribbon configuration loaded successfully!");
        } else {
          throw new Error("Invalid format. Must be an array of tabs.");
        }
      } catch (err: any) {
        alert("Failed to import configuration: " + err.message);
      }
    };
    reader.readAsText(file);
    if (ribbonConfigFileInputRef.current) ribbonConfigFileInputRef.current.value = "";
    setShowImportExportDropdown(false);
  };

  useEffect(() => {
    setSelectedPlant(plant);
  }, [plant]);

  // We intentionally do not load the raw HTML draft anymore.
  // The dependencies useEffect below will auto-generate the correct template HTML
  // using the persisted form states, ensuring the UI and HTML are always in perfect sync.
  useEffect(() => {
    // Clear out old obsolete drafts
    localStorage.removeItem('ess_smart_report_draft');
  }, []);

  // Update statistics helper
  const updateStats = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    
    // Character count
    setCharCount(text.length);
    
    // Word count
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    setWordCount(words.length);
  };

  // Content change auto-save & history handler
  const handleContentChange = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    
    // Auto-save to localStorage
    localStorage.setItem('ess_smart_report_draft', html);
    updateStats();

    if (!isHistoryAction) {
      saveToHistory(html);
    }
    setIsHistoryAction(false);
  };

  const saveToHistory = (html: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    // Limit history stack size to 50
    if (newHistory.length >= 50) {
      newHistory.shift();
    }
    newHistory.push(html);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setIsHistoryAction(true);
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      if (editorRef.current) {
        editorRef.current.innerHTML = history[nextIndex];
        localStorage.setItem('ess_smart_report_draft', history[nextIndex]);
        updateStats();
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setIsHistoryAction(true);
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      if (editorRef.current) {
        editorRef.current.innerHTML = history[nextIndex];
        localStorage.setItem('ess_smart_report_draft', history[nextIndex]);
        updateStats();
      }
    }
  };

  // Base64 helper for image insertion
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      insertHtmlAtCursor(`<img src="${base64}" alt="Uploaded report image" style="max-width: 100%; height: auto; border-radius: 4px; margin: 12px 0; border: 1px solid rgba(255,255,255,0.1);" />`);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper to execute standard commands
  const executeCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    handleContentChange();
    if (editorRef.current) editorRef.current.focus();
  };

  // Helper to insert HTML at cursor/selection
  const insertHtmlAtCursor = (html: string) => {
    if (editorRef.current) editorRef.current.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      const fragment = range.createContextualFragment(html);
      const lastNode = fragment.lastChild;
      range.insertNode(fragment);
      
      // Move cursor right after the inserted node
      if (lastNode) {
        const newRange = document.createRange();
        newRange.setStartAfter(lastNode);
        newRange.setEndAfter(lastNode);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
      handleContentChange();
    }
  };

  // Markdown parsing utility to convert Gemini response to clean editor HTML
  const parseMarkdownToHtml = (markdown: string): string => {
    let html = markdown;

    // Remove block code wrappers and format as code block
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
      const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
      return `<pre class="report-code-block"><code>${escaped}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="report-inline-code">$1</code>');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; font-weight: bold; margin-top: 16px; margin-bottom: 8px;">$1</h3>');
    html = html.replace(/^[#]{2} (.*$)/gim, '<h2 style="font-size: 18px; font-weight: bold; padding-bottom: 4px; margin-top: 20px; margin-bottom: 10px;">$1</h2>');
    html = html.replace(/^[#]{1} (.*$)/gim, '<h1 style="font-size: 22px; font-weight: bold; margin-top: 24px; margin-bottom: 12px;">$1</h1>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italics
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Horizontal Rule
    html = html.replace(/^---$/gim, '<hr style="margin: 16px 0;" />');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Bullet lists (simple mapping line by line)
    const lines = html.split('\n');
    let inList = false;
    let inOrderedList = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('* ') || line.startsWith('- ')) {
        const itemContent = line.substring(2);
        if (!inList) {
          lines[i] = `<ul style="list-style-type: disc; padding-left: 20px; margin: 10px 0;"><li>${itemContent}</li>`;
          inList = true;
        } else {
          lines[i] = `<li>${itemContent}</li>`;
        }
      } else if (/^\d+\.\s/.test(line)) {
        const itemContent = line.replace(/^\d+\.\s/, '');
        if (!inOrderedList) {
          lines[i] = `<ol style="list-style-type: decimal; padding-left: 20px; margin: 10px 0;"><li>${itemContent}</li>`;
          inOrderedList = true;
        } else {
          lines[i] = `<li>${itemContent}</li>`;
        }
      } else {
        if (inList) {
          lines[i - 1] += '</ul>';
          inList = false;
        }
        if (inOrderedList) {
          lines[i - 1] += '</ol>';
          inOrderedList = false;
        }
        // Add paragraph wrapper if not empty and not HTML tag
        if (line.length > 0 && !line.startsWith('<')) {
          lines[i] = `<p style="margin: 8px 0; line-height: 1.6;">${lines[i]}</p>`;
        }
      }
    }
    
    if (inList) lines[lines.length - 1] += '</ul>';
    if (inOrderedList) lines[lines.length - 1] += '</ol>';

    return lines.join('\n');
  };

  const handleImportAiResponse = () => {
    if (!lastAiResponse) {
      alert("No AI response has been generated yet in this session.");
      return;
    }
    const html = parseMarkdownToHtml(lastAiResponse);
    insertHtmlAtCursor(`
      <div style="border: 1px dashed rgba(0, 163, 255, 0.3); background-color: rgba(0, 163, 255, 0.02); padding: 12px; border-radius: 4px; margin: 10px 0;">
        <div style="font-size: 10px; font-family: monospace; color: #00A3FF; margin-bottom: 6px; font-weight: bold; display: flex; items-center; gap: 4px;">
          <span>✦ IMPORTED AI RESPONSE</span>
        </div>
        ${html}
      </div>
    `);
  };

  // Queries IndexedDB for active project/plant evaluation data, and inserts a gorgeous SVG line plot of actual power/SOC telemetry!
  const handleImportActiveGraph = () => {
    const request = indexedDB.open('ESS_Toolbox', 1);
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('eval_data')) {
        insertDummyGraph();
        return;
      }
      const tx = db.transaction('eval_data', 'readonly');
      // Format key to match App.tsx mapping: eval_data_${project}
      // Note: project prop is "SNTL 400" or "SNTL 600" or "SNTL 1000", but key is "eval_data_SNTL400" (no spaces)
      const cleanProj = project.replace(/\s+/g, '');
      const req = tx.objectStore('eval_data').get(`eval_data_${cleanProj}`);
      
      req.onsuccess = () => {
        const data = req.result;
        if (data && data.timestamps && data.timestamps.length > 0) {
          generateSvgGraph(data);
        } else {
          console.warn("No IndexedDB data found. Inserting high-fidelity dummy template graph instead.");
          insertDummyGraph();
        }
      };
      req.onerror = () => insertDummyGraph();
    };
    request.onerror = () => insertDummyGraph();
  };

  const insertDummyGraph = () => {
    insertHtmlAtCursor(`
      <div class="report-graph-box">
        <div class="graph-title">
          <span>📊 Telemetry Performance Plot (Demo Mode)</span>
          <span style="color: #00A3FF; font-size: 10px; font-weight: normal;">${project} | ${selectedPlant.toUpperCase()}</span>
        </div>
        <div class="graph-canvas">
          <!-- Grid lines -->
          <div class="graph-gridline" style="bottom: 135px;"></div>
          <div class="graph-gridline" style="bottom: 90px;"></div>
          <div class="graph-gridline" style="bottom: 45px;"></div>
          
          <!-- Mock line chart using absolute overlay -->
          <svg style="position: absolute; top:0; left:0; width: 100%; height: 100%; overflow: visible;" viewBox="0 0 100 100" preserveAspectRatio="none">
            <!-- P total (Blue curve) -->
            <path d="M 0 50 L 15 25 L 30 20 L 45 60 L 60 70 L 75 40 L 90 35 L 100 45" fill="none" stroke="#00A3FF" stroke-width="2.5" />
            <!-- SOC (Orange curve) -->
            <path d="M 0 80 L 15 75 L 30 70 L 45 60 L 60 40 L 75 35 L 90 38 L 100 50" fill="none" stroke="#D95319" stroke-width="2" stroke-dasharray="3,3" />
          </svg>
        </div>
        <div class="graph-legend-text">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:55</span>
        </div>
        <div style="display: flex; gap: 12px; margin-top: 10px; justify-content: center; font-size: 9px;">
          <span style="display: flex; align-items: center; gap: 4px; color: #00A3FF;">
            <span style="display: inline-block; width: 8px; height: 8px; background: #00A3FF; border-radius: 2px;"></span> P total (MW)
          </span>
          <span style="display: flex; align-items: center; gap: 4px; color: #D95319;">
            <span style="display: inline-block; width: 8px; height: 2px; border-top: 2px dashed #D95319;"></span> SOC (%)
          </span>
        </div>
      </div>
    `);
  };

  const generateSvgGraph = (data: any) => {
    const pk = selectedPlant === 'plant1' ? 'plant1' : selectedPlant === 'plant2' ? 'plant2' : 'plant3';
    
    // Extrapolate series data
    const pTotalRaw = data.pTotal?.[pk] || [];
    const socRaw = data.soc?.[pk] || [];
    
    // Subsample arrays if they are huge to prevent HTML bloat (e.g. limit to 80 points)
    const step = Math.max(1, Math.ceil(pTotalRaw.length / 80));
    const pTotal: number[] = [];
    const soc: number[] = [];
    
    for (let i = 0; i < pTotalRaw.length; i += step) {
      pTotal.push(pTotalRaw[i]);
      soc.push(socRaw[i] || 50); // Fallback
    }

    if (pTotal.length === 0) {
      insertDummyGraph();
      return;
    }

    // Min and max limits for normalization
    const pMin = Math.min(...pTotal);
    const pMax = Math.max(...pTotal);
    const pRange = pMax - pMin === 0 ? 1 : pMax - pMin;

    const sMin = Math.min(...soc);
    const sMax = Math.max(...soc);
    const sRange = sMax - sMin === 0 ? 1 : sMax - sMin;

    // Build SVG path coordinate points
    const width = 450;
    const height = 150;
    const pointsCount = pTotal.length;

    let pPath = '';
    let socPath = '';

    for (let i = 0; i < pointsCount; i++) {
      const x = (i / (pointsCount - 1)) * width;
      // SVG Y starts at 0 (top). We flip Y: (1 - normalizedVal) * height
      const yP = (1 - (pTotal[i] - pMin) / pRange) * (height - 20) + 10;
      const yS = (1 - (soc[i] - sMin) / sRange) * (height - 20) + 10;

      if (i === 0) {
        pPath += `M ${x} ${yP}`;
        socPath += `M ${x} ${yS}`;
      } else {
        pPath += ` L ${x} ${yP}`;
        socPath += ` L ${x} ${yS}`;
      }
    }

    insertHtmlAtCursor(`
      <div class="report-graph-box">
        <div class="graph-title">
          <span>📊 Live Telemetry Graph (Grid Response Data)</span>
          <span style="color: #00A3FF; font-size: 10px; font-weight: normal;">${project} | ${selectedPlant.toUpperCase()} | Date: ${data.dataDate || '20-May-2026'}</span>
        </div>
        <div class="graph-lines-container" style="position: relative;">
          <!-- SVG element for clean vector graphics offline -->
          <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 180px; overflow: visible;">
            <!-- Grid lines -->
            <line x1="0" y1="${height * 0.25}" x2="${width}" y2="${height * 0.25}" stroke="currentColor" stroke-dasharray="3,3" style="opacity: 0.15;" />
            <line x1="0" y1="${height * 0.5}" x2="${width}" y2="${height * 0.5}" stroke="currentColor" stroke-dasharray="3,3" style="opacity: 0.15;" />
            <line x1="0" y1="${height * 0.75}" x2="${width}" y2="${height * 0.75}" stroke="currentColor" stroke-dasharray="3,3" style="opacity: 0.15;" />
            
            <!-- P total (Blue Line) -->
            <path d="${pPath}" fill="none" stroke="#00A3FF" stroke-width="2" />
            <!-- SOC (Orange Line) -->
            <path d="${socPath}" fill="none" stroke="#D95319" stroke-width="1.8" stroke-dasharray="4,4" />
          </svg>
        </div>
        <div class="graph-legend-text" style="padding-left: 2px;">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:55</span>
        </div>
        <div style="display: flex; gap: 16px; margin-top: 10px; justify-content: center; font-size: 9px;">
          <span style="display: flex; align-items: center; gap: 4px; color: #00A3FF;">
            <span style="display: inline-block; width: 8px; height: 8px; background: #00A3FF; border-radius: 2px;"></span> P total (MW) [${pMin.toFixed(1)} to ${pMax.toFixed(1)}]
          </span>
          <span style="display: flex; align-items: center; gap: 4px; color: #D95319;">
            <span style="display: inline-block; width: 8px; height: 2px; border-top: 2px dashed #D95319;"></span> SOC (%) [${sMin.toFixed(0)}% to ${sMax.toFixed(0)}%]
          </span>
        </div>
      </div>
    `);
  };

  // Pre-formatted templates
  const loadTemplate = (type: string) => {
    let html = '';
    
    // Format date for template
    const formattedDate = reportDate ? new Date(reportDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '';
    
    const tableStyle = `
      <style>
        .report-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 30px; border: 1px solid black; }
        .report-table th, .report-table td { border: 1px solid black !important; padding: 10px; }
        .report-table th { font-weight: bold; text-align: center; }
        .inner-table { width: 100%; border-collapse: collapse; text-align: center; margin: -10px; }
        .inner-table td { border: none !important; padding: 4px; }
        .inner-table tr:first-child td { border-bottom: 1px solid black !important; }
        .inner-table td:first-child { border-right: 1px solid black !important; }
      </style>
    `;

    if (type === 'SNTL400') {
      html = `
        ${tableStyle}
        ${'<img src="data:image/png;base64,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" alt="Logo" style="display: block; margin: 0 auto; width: 100%; max-width: 800px; margin-bottom: 20px;" />'}

        <h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 25px; text-decoration: underline;">SNTL 400MWh BESS Sna Ansa</h2>
        <p style="font-size: 13px; margin-bottom: 10px;">Report by: <b>${reportBy}</b></p>
        <p style="font-size: 13px; margin-bottom: 20px;">Date Time: <b>${formattedDate}</b></p>
        
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 15%;">Items</th>
              <th style="width: 60%;" colspan="2">Observation</th>
              <th style="width: 25%;">Overall Judgement<br>Pass/Fail</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black; border-top: 2px solid black;">P-F</td>
              <td style="width: 30%; padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black; border-top: 2px solid black;">Operation Mode</td>
              <td style="width: 30%; padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black; border-top: 2px solid black;">${pfOpMode}</td>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black; border-top: 2px solid black;">Passed</td>
            </tr>
            <tr>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Evaluation</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">${pfEvaluation}</td>
            </tr>
            <tr>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black;">P-SOC</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black;">Operation Mode</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black;">${psocOpMode}</td>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Passed</td>
            </tr>
            <tr>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Evaluation</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">${psocEvaluation}</td>
            </tr>
            <tr>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Q-U</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black;">Operation Mode</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black;">${quOpMode}</td>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Passed</td>
            </tr>
            <tr>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Evaluation</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">${quEvaluation}</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid black;">EDC<br>Command<br>Response</td>
              <td colspan="2" style="padding: 10px; border: 1px solid black;">
                <ul style="list-style-type: none; padding-left: 15px; margin: 0;">
                  <li style="margin-bottom: 5px;">&#10148; ${edcResponse.replace(/\n/g, '<br>')}</li>
                </ul>
              </td>
              <td style="text-align: center; border: 1px solid black;">Passed</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid black;">Notice</td>
              <td colspan="2" style="padding: 10px; border: 1px solid black;">
                <ul style="list-style-type: none; padding-left: 15px; margin: 0;">
                  ${notices.split('\n').filter(Boolean).map(n => `<li style="margin-bottom: 8px;">&#10148; ${n}</li>`).join('')}
                </ul>
              </td>
              <td style="border: 1px solid black;"></td>
            </tr>
          </tbody>
        </table>
                
                
                </div>
              </td>
              <td style="text-align: center;">Passed</td>
            </tr>
            <tr>
              <td style="text-align: center;">EDC<br>Command<br>Response</td>
              <td style="padding: 10px;">
                <ul style="list-style-type: none; padding-left: 15px; margin: 0;">
                  <li style="margin-bottom: 5px;">&#10148; ${edcResponse.replace(/\n/g, '<br>')}</li>
                </ul>
              </td>
              <td style="text-align: center;">Passed (9)</td>
            </tr>
            <tr>
              <td style="text-align: center;">Notice</td>
              <td style="padding: 10px;">
                <ul style="list-style-type: none; padding-left: 15px; margin: 0;">
                  ${notices.split('\n\n').map(n => `<li style="margin-bottom: 8px;">&#10148; ${n.replace(/\n/g, '<br>')}</li>`).join('')}
                </ul>
              </td>
              <td style="text-align: center;"></td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (type === 'SNTL600') {
      html = `
        ${tableStyle}
        ${'<img src="data:image/png;base64,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" alt="Logo" style="display: block; margin: 0 auto; width: 100%; max-width: 800px; margin-bottom: 20px;" />'}

        <h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 25px; text-decoration: underline;">SNTL 600MWh BESS Amleang</h2>
        <p style="font-size: 13px; margin-bottom: 10px;">Report by: <b>${reportBy}</b></p>
        <p style="font-size: 13px; margin-bottom: 20px;">Date Time: <b>${formattedDate}</b></p>
        
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 15%;">Items</th>
              <th style="width: 60%;" colspan="2">Observation</th>
              <th style="width: 25%;">Overall Judgement<br>Pass/Fail</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black; border-top: 2px solid black;">P-F</td>
              <td style="width: 30%; padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black; border-top: 2px solid black;">Operation Mode</td>
              <td style="width: 30%; padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black; border-top: 2px solid black;">${pfOpMode}</td>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black; border-top: 2px solid black;">Passed</td>
            </tr>
            <tr>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Evaluation</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">${pfEvaluation}</td>
            </tr>
            <tr>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black;">P-SOC</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black;">Operation Mode</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black;">${psocOpMode}</td>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Passed</td>
            </tr>
            <tr>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Evaluation</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">${psocEvaluation}</td>
            </tr>
            <tr>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Q-U</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black;">Operation Mode</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 1px dashed black;">${quOpMode}</td>
              <td rowspan="2" style="text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Passed</td>
            </tr>
            <tr>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">Evaluation</td>
              <td style="padding: 6px; text-align: center; border: 1px solid black; border-bottom: 2px solid black;">${quEvaluation}</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid black;">CMCS<br>command<br>performance</td>
              <td colspan="2" style="padding: 10px; border: 1px solid black;">
                <ul style="list-style-type: none; padding-left: 15px; margin: 0;">
                  <li style="margin-bottom: 5px;">&#10148; ${cmcsPerformance.replace(/\n/g, '<br>')}</li>
                </ul>
              </td>
              <td style="text-align: center; border: 1px solid black;">Passed</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid black;">EDC<br>Command<br>Response</td>
              <td colspan="2" style="padding: 10px; border: 1px solid black;">
                <ul style="list-style-type: none; padding-left: 15px; margin: 0;">
                  <li style="margin-bottom: 5px;">&#10148; ${edcResponse.replace(/\n/g, '<br>')}</li>
                </ul>
              </td>
              <td style="text-align: center; border: 1px solid black;">Passed</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid black;">Notice</td>
              <td colspan="2" style="padding: 10px; border: 1px solid black;">
                <ul style="list-style-type: none; padding-left: 15px; margin: 0;">
                  ${notices.split('\n').filter(Boolean).map(n => `<li style="margin-bottom: 8px;">&#10148; ${n}</li>`).join('')}
                </ul>
              </td>
              <td style="border: 1px solid black;"></td>
            </tr>
          </tbody>
        </table>
                </div>
              </td>
              <td style="text-align: center;">Passed</td>
            </tr>
            <tr>
              <td style="text-align: center;">P-SOC</td>
              <td style="padding: 0 !important; border: 1px solid black !important;">
                <div style="padding: 0; margin: 0; width: 100%;">
                  <table style="width: 100%; border-collapse: collapse; text-align: center;">
                    <tr>
                      <td style="width: 50%; padding: 4px; border-bottom: 1px solid black; border-right: 1px solid black;">Operation Mode</td>
                      <td style="width: 50%; padding: 4px; border-bottom: 1px solid black;">${psocOpMode}</td>
                    </tr>
                    <tr>
                      <td style="width: 50%; padding: 4px; border-right: 1px solid black;">Evaluation</td>
                      <td style="width: 50%; padding: 4px;">${psocEvaluation}</td>
                    </tr>
                  </table>
                </div>
              </td>
              <td style="text-align: center;">Passed</td>
            </tr>
            <tr>
              <td style="text-align: center;">Q-U</td>
              <td style="padding: 0 !important; border: 1px solid black !important;">
                <div style="padding: 0; margin: 0; width: 100%;">
                  <table style="width: 100%; border-collapse: collapse; text-align: center;">
                    <tr>
                      <td style="width: 50%; padding: 4px; border-bottom: 1px solid black; border-right: 1px solid black;">Operation Mode</td>
                      <td style="width: 50%; padding: 4px; border-bottom: 1px solid black;">${quOpMode}</td>
                    </tr>
                    <tr>
                      <td style="width: 50%; padding: 4px; border-right: 1px solid black;">Evaluation</td>
                      <td style="width: 50%; padding: 4px;">${quEvaluation}</td>
                    </tr>
                  </table>
                </div>
              </td>
              <td style="text-align: center;">Passed</td>
            </tr>
            <tr>
              <td style="text-align: center;">CMCS<br>command<br>performance</td>
              <td style="padding: 10px;">
                <ul style="list-style-type: none; padding-left: 15px; margin: 0;">
                  <li style="margin-bottom: 5px;">&#10148; ${cmcsPerformance.replace(/\n/g, '<br>')}</li>
                </ul>
              </td>
              <td style="text-align: center;">Passed</td>
            </tr>
            <tr>
              <td style="text-align: center;">EDC<br>Command<br>Response</td>
              <td style="padding: 10px;">
                <ul style="list-style-type: none; padding-left: 15px; margin: 0;">
                  <li style="margin-bottom: 5px;">&#10148; ${edcResponse.replace(/\n/g, '<br>')}</li>
                </ul>
              </td>
              <td style="text-align: center;">Passed</td>
            </tr>
            <tr>
              <td style="text-align: center;">Notice</td>
              <td style="padding: 10px;">
                <ul style="list-style-type: none; padding-left: 15px; margin: 0;">
                  ${notices.split('\n\n').map(n => `<li style="margin-bottom: 8px;">&#10148; ${n.replace(/\n/g, '<br>')}</li>`).join('')}
                </ul>
              </td>
              <td style="text-align: center;"></td>
            </tr>
          </tbody>
        </table>
      `;
    } else {
      html = `<p><br></p>`;
    }

    if (editorRef.current && type !== '') {
      editorRef.current.innerHTML = html;
      localStorage.setItem('ess_smart_report_draft', html);
      updateStats();
      saveToHistory(html);
    }
  };

  useEffect(() => {
    if (selectedProjectTemplate) {
      loadTemplate(selectedProjectTemplate);
    }
  }, [selectedProjectTemplate, reportBy, reportDate, edcResponse, notices, pfEvaluation, psocEvaluation, quEvaluation, cmcsPerformance, pfOpMode, psocOpMode, quOpMode]);
  useEffect(() => {
    localStorage.setItem('ess_report_project_template', selectedProjectTemplate);
    localStorage.setItem('ess_report_by', reportBy);
    localStorage.setItem('ess_report_date', reportDate);
    localStorage.setItem('ess_report_edc', edcResponse);
    localStorage.setItem('ess_report_notices', notices);
    localStorage.setItem('ess_report_pf_eval', pfEvaluation);
    localStorage.setItem('ess_report_psoc_eval', psocEvaluation);
    localStorage.setItem('ess_report_qu_eval', quEvaluation);
    localStorage.setItem('ess_report_cmcs', cmcsPerformance);
    localStorage.setItem('ess_report_pf_op', pfOpMode);
    localStorage.setItem('ess_report_psoc_op', psocOpMode);
    localStorage.setItem('ess_report_qu_op', quOpMode);
  }, [selectedProjectTemplate, reportBy, reportDate, edcResponse, notices, pfEvaluation, psocEvaluation, quEvaluation, cmcsPerformance, pfOpMode, psocOpMode, quOpMode]);


  const loadInitialTemplate = () => {
    loadTemplate('bess');
  };

  // Inserting Link
  const handleInsertLink = () => {
    if (!linkUrl) return;
    executeCommand('createLink', linkUrl);
    setShowLinkModal(false);
    setLinkUrl('');
  };

  // Inserting Table
  const handleInsertTable = () => {
    let tableHtml = `<table class="report-table">`;
    
    // Headers
    tableHtml += `<thead><tr>`;
    for (let c = 0; c < tableCols; c++) {
      tableHtml += `<th>Header ${c + 1}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;

    // Rows
    for (let r = 0; r < tableRows; r++) {
      tableHtml += `<tr>`;
      for (let c = 0; c < tableCols; c++) {
        tableHtml += `<td>Data</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table>`;
    
    insertHtmlAtCursor(tableHtml);
    setShowTableModal(false);
  };

  // Inserting Callout Boxes
  const handleInsertCallout = () => {
    const textMap = {
      info: 'INFO',
      warning: 'WARNING',
      error: 'ALERT'
    };
    
    const html = `
      <div class="report-callout report-callout-${calloutType}">
        <strong style="color: inherit; font-size: 11px; tracking-wide: 0.05em; font-family: monospace; display: block; margin-bottom: 4px;">${textMap[calloutType]}</strong>
        Enter callout message details here...
      </div>
    `;
    insertHtmlAtCursor(html);
    setShowCalloutModal(false);
  };

  const handleClearDoc = () => {
    if (window.confirm("Are you sure you want to clear the entire document? This cannot be undone.")) {
      if (editorRef.current) {
        editorRef.current.innerHTML = '<p><br></p>';
        localStorage.removeItem('ess_smart_report_draft');
        updateStats();
        saveToHistory('<p><br></p>');
      }
    }
  };

  // Print/PDF trigger
  const handlePrint = () => {
    window.print();
  };

  // HTML Export download
  const handleExportHtml = () => {
    if (!editorRef.current) return;
    const body = editorRef.current.innerHTML;
    
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EMS Toolbox - Smart Report Export</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      color: #333333;
      background-color: #ffffff;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
    }
    h1, h2, h3 {
      font-family: 'Helvetica Neue', Helvetica, sans-serif;
      color: #111111;
    }
    h1 {
      border-bottom: 2px solid #00A3FF;
      padding-bottom: 10px;
      font-size: 28px;
    }
    h2 {
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 5px;
      font-size: 20px;
      margin-top: 30px;
      color: #0072BD;
    }
    p {
      margin: 10px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #cccccc;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #fcfcfc;
    }
    blockquote {
      border-left: 4px solid #00A3FF;
      padding-left: 15px;
      margin-left: 0;
      font-style: italic;
      color: #555555;
    }

    /* Report custom element styles */
    .report-callout {
      padding: 12px;
      margin: 15px 0;
      border-radius: 0 4px 4px 0;
      font-family: sans-serif;
      font-size: 13px;
    }
    .report-callout-info {
      background-color: rgba(0, 163, 255, 0.04);
      border-left: 4px solid #00A3FF;
      color: #1E293B;
    }
    .report-callout-warning {
      background-color: rgba(234, 179, 8, 0.04);
      border-left: 4px solid #EAB308;
      color: #1E293B;
    }
    .report-callout-error {
      background-color: rgba(239, 68, 68, 0.04);
      border-left: 4px solid #EF4444;
      color: #1E293B;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 12px;
      text-align: left;
    }
    .report-table th, .report-table td {
      padding: 8px;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }
    .report-table thead tr {
      background-color: rgba(0, 0, 0, 0.03);
      border-bottom: 2px solid rgba(0, 0, 0, 0.1);
    }
    .report-table tbody tr:nth-child(even) {
      background-color: rgba(0, 0, 0, 0.015);
    }

    .report-code-block {
      background-color: rgba(0, 0, 0, 0.03);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-left: 4px solid #00A3FF;
      padding: 12px;
      font-family: monospace;
      font-size: 12px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 12px 0;
      color: #1E293B;
      white-space: pre-wrap;
    }
    .report-inline-code {
      background-color: rgba(0, 0, 0, 0.05);
      padding: 2px 5px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9em;
      border: 1px solid rgba(0, 0, 0, 0.08);
      color: #0072BD;
    }

    .engineering-signoff-box {
      border: 1.5px solid rgba(0, 0, 0, 0.1);
      border-radius: 6px;
      padding: 18px;
      margin: 20px 0;
      background-color: rgba(0, 0, 0, 0.015);
      font-family: sans-serif;
      page-break-inside: avoid;
      color: #1E293B;
    }
    .signoff-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .signoff-table td {
      padding: 6px 0;
      border: none !important;
    }
    .signoff-label {
      color: rgba(0, 0, 0, 0.5);
    }

    .page-break {
      border: 1px dashed #cbd5e1;
      margin: 24px 0;
      height: 0;
      border-top: 1px dashed #cbd5e1;
    }

    .report-graph-box {
      border: 1px solid rgba(0, 0, 0, 0.1);
      background-color: #F8FAFC;
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
      max-width: 600px;
      font-family: sans-serif;
      page-break-inside: avoid;
      color: #1E293B;
    }
    .graph-title {
      font-weight: bold;
      font-size: 12px;
      color: #1E293B;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      padding-bottom: 6px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
    }
    .graph-canvas {
      height: 180px;
      width: 100%;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      border-left: 2px solid rgba(0, 0, 0, 0.2);
      border-bottom: 2px solid rgba(0, 0, 0, 0.2);
      padding-bottom: 5px;
      position: relative;
    }
    .graph-gridline {
      position: absolute;
      width: 100%;
      height: 1px;
      border-top: 1px dashed rgba(0, 0, 0, 0.06);
    }
    .graph-legend-text {
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: rgba(0, 0, 0, 0.5);
      margin-top: 6px;
      font-family: monospace;
    }
    .graph-lines-container {
      color: #1E293B;
      border-left: 2px solid rgba(0, 0, 0, 0.2);
      border-bottom: 2px solid rgba(0, 0, 0, 0.2);
      padding-bottom: 5px;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;

    // Trigger download
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Smart_Report_${project.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Convert HTML back to markdown regex utility
  const handleExportMarkdown = () => {
    if (!editorRef.current) return;
    let html = editorRef.current.innerHTML;

    // Convert HTML elements back to simple markdown structure
    let md = html;
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n');
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '* $1\n');
    md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n');
    md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');
    md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
    md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
    md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
    md = md.replace(/<hr[^>]*>/gi, '---\n\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<[^>]+>/g, ''); // strip remaining tags

    // Decode HTML entities
    md = md.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

    const blob = new Blob([md.trim()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Smart_Report_${project.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderIcon = (name: string, size = 16) => {
    switch (name) {
      case 'Font': return <FileText size={size} />;
      case 'TextSize': return <FileText size={size} />;
      case 'Bold': return <Bold size={size} />;
      case 'Italic': return <Italic size={size} />;
      case 'Underline': return <Underline size={size} />;
      case 'Strikethrough': return <Strikethrough size={size} />;
      case 'Palette': return <Sparkles size={size} />;
      case 'AlignLeft': return <AlignLeft size={size} />;
      case 'AlignCenter': return <AlignCenter size={size} />;
      case 'AlignRight': return <AlignRight size={size} />;
      case 'AlignJustify': return <AlignJustify size={size} />;
      case 'List': return <List size={size} />;
      case 'ListOrdered': return <ListOrdered size={size} />;
      case 'ArrowRightToLine': return <ArrowRightToLine size={size} className="rotate-90" />;
      case 'PB': return <span className="font-bold text-[9px] text-foreground/80 bg-foreground/10 px-1 rounded select-none">PB</span>;
      case 'Table': return <Table size={size} />;
      case 'Image': return <Image size={size} />;
      case 'LinkIcon': return <LinkIcon size={size} />;
      case 'Link2Off': return <Link2Off size={size} />;
      case 'AlertCircle': return <AlertCircle size={size} />;
      case 'Code': return <Code size={size} />;
      case 'Sparkles': return <Sparkles size={size} />;
      case 'FileSpreadsheet': return <FileSpreadsheet size={size} />;
      case 'Upload': return <Upload size={size} />;
    }

    const IconComponent = (Icons as any)[name];
    if (IconComponent) {
      return <IconComponent size={size} />;
    }

    if (name === 'signature_sign_off_default' || name === 'signature_sign_off') {
      return <Icons.PenTool size={size} className="text-blue-400" />;
    }
    
    return <Icons.Settings size={size} />;
  };

  const renderRibbonCommandItem = (cmd: RibbonCommand) => {
    if (cmd.id === 'font_family') {
      return (
        <select 
          key={cmd.id}
          value={activeFont}
          onChange={(e) => {
            setActiveFont(e.target.value);
            executeCommand('fontName', e.target.value);
          }}
          className="h-7 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-accent-blue/30 text-[10px] w-32 pl-2 pr-6 cursor-pointer outline-none transition-colors"
          title="Font Family"
        >
          <option value="Arial" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">Arial</option>
          <option value="Times New Roman" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">Times New Roman</option>
          <option value="Courier New" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">Courier</option>
          <option value="Georgia" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">Georgia</option>
          <option value="Inter" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">Inter</option>
          <option value="JetBrains Mono" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">JetBrains</option>
        </select>
      );
    }
    
    if (cmd.id === 'font_size') {
      return (
        <select 
          key={cmd.id}
          value={activeSize}
          onChange={(e) => {
            setActiveSize(e.target.value);
            const sizeMap: Record<string, string> = { '12px': '2', '14px': '3', '16px': '4', '18px': '5', '24px': '6', '32px': '7' };
            executeCommand('fontSize', sizeMap[e.target.value] || '3');
          }}
          className="h-7 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-accent-blue/30 text-[10px] w-20 pl-2 pr-6 cursor-pointer outline-none transition-colors"
          title="Font Size"
        >
          <option value="12px" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">12px</option>
          <option value="14px" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">14px</option>
          <option value="16px" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">16px</option>
          <option value="18px" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">18px</option>
          <option value="24px" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">24px</option>
          <option value="32px" className="bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200">32px</option>
        </select>
      );
    }
    
    if (cmd.id === 'colors') {
      return (
        <div key={cmd.id} className="flex items-center gap-1 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded px-1.5 h-7" title="Text & Highlight Color">
          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold font-sans">A</span>
          <input 
            type="color" 
            onChange={(e) => executeCommand('foreColor', e.target.value)} 
            className="w-3.5 h-3.5 bg-transparent border-0 rounded-full cursor-pointer p-0 overflow-hidden" 
            title="Text Color" 
            defaultValue="#FFFFFF"
          />
          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700/60" />
          <input 
            type="color" 
            onChange={(e) => executeCommand('hiliteColor', e.target.value)} 
            className="w-3.5 h-3.5 bg-transparent border-0 rounded-full cursor-pointer p-0 overflow-hidden" 
            title="Highlight Color" 
            defaultValue="#0F172A"
          />
        </div>
      );
    }
    
    if (cmd.id === 'bess_graph') {
      return (
        <div key={cmd.id} className="flex items-center bg-green-500/5 border border-green-500/20 rounded h-7 px-1">
          <select 
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            className="h-full bg-transparent border-0 text-[10px] w-20 px-1 cursor-pointer focus:ring-0 text-green-400 font-bold shrink-0 outline-none"
            title="Active Plant for Graph Import"
          >
            <option value="plant1" className="bg-surface text-foreground">Plant 1</option>
            <option value="plant2" className="bg-surface text-foreground">Plant 2</option>
            {project !== 'SNTL 400' && (
              <option value="plant3" className="bg-surface text-foreground">Plant 3</option>
            )}
          </select>
          <div className="w-px h-4 bg-green-500/20 shrink-0" />
          <button 
            onClick={() => handleRibbonCommand('bess_graph')}
            className="h-full px-2 hover:bg-green-500/10 text-green-400 flex items-center gap-1.5 rounded-r text-[10px] font-bold shrink-0 transition-colors"
            title="Insert vector SVG graph plot of current project telemetry dataset"
          >
            <FileSpreadsheet size={11} /> +BESS Graph
          </button>
        </div>
      );
    }

    const isCustomTool = cmd.id.startsWith('tool_');
    const toolId = isCustomTool ? cmd.id.substring(5) : cmd.id;
    
    if (isCustomTool) {
      const tool = customTools.find(t => t.id === toolId);
      const displayName = tool ? tool.name : cmd.label;
      const shortName = tool?.shortName || tool?.name || cmd.label;
      
      return (
        <button
          key={cmd.id}
          onClick={() => handleRibbonCommand(cmd.id)}
          className="flex flex-col items-center justify-center h-11 min-w-[56px] px-1 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800/60 active:bg-slate-300 dark:active:bg-slate-800 text-foreground/75 dark:text-slate-300 hover:text-foreground dark:hover:text-white border border-transparent rounded transition-all select-none gap-0.5 shrink-0"
          title={displayName}
        >
          {renderIcon(tool?.iconName || 'Settings', 14)}
          <span className="text-[8px] font-medium tracking-tight font-sans text-center leading-none max-w-[52px] truncate">{shortName}</span>
        </button>
      );
    }

    // Default icon-only buttons
    const icon = renderIcon(cmd.iconName, 13);
    return (
      <button 
        key={cmd.id}
        onClick={() => handleRibbonCommand(cmd.id)}
        className="h-7 w-7 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-foreground dark:hover:text-white active:bg-slate-300 dark:active:bg-slate-700 text-foreground/75 flex items-center justify-center rounded transition-colors"
        title={cmd.label}
      >
        {icon}
      </button>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-background relative min-w-0 h-full overflow-hidden text-foreground">
      {/* Editor Stylesheet for printing and theme overrides */}
      <style>{`

        /* Default adaptive typography and structure inside the editor */
        #print-area-wrapper h1 {
          color: #1E293B;
        }
        .dark #print-area-wrapper h1 {
          color: #FFFFFF;
        }
        #print-area-wrapper h2 {
          color: #1E293B;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }
        .dark #print-area-wrapper h2 {
          color: #00A3FF;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        #print-area-wrapper h3 {
          color: #0072BD;
        }
        .dark #print-area-wrapper h3 {
          color: #00A3FF;
        }

        /* Callout Boxes */
        .report-callout {
          padding: 12px;
          margin: 15px 0;
          border-radius: 0 4px 4px 0;
          font-family: sans-serif;
          font-size: 13px;
        }
        .report-callout-info {
          background-color: rgba(0, 163, 255, 0.04);
          border-left: 4px solid #00A3FF;
          color: #1E293B;
        }
        .dark .report-callout-info {
          background-color: rgba(0, 163, 255, 0.06);
          color: #E2E8F0;
        }
        .report-callout-warning {
          background-color: rgba(234, 179, 8, 0.04);
          border-left: 4px solid #EAB308;
          color: #1E293B;
        }
        .dark .report-callout-warning {
          background-color: rgba(234, 179, 8, 0.06);
          color: #E2E8F0;
        }
        .report-callout-error {
          background-color: rgba(239, 68, 68, 0.04);
          border-left: 4px solid #EF4444;
          color: #1E293B;
        }
        .dark .report-callout-error {
          background-color: rgba(239, 68, 68, 0.06);
          color: #E2E8F0;
        }

        /* Tables */
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 12px;
          text-align: left;
        }
        .report-table th, .report-table td {
          padding: 8px;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
        .dark .report-table th, .dark .report-table td {
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .report-table thead tr {
          background-color: rgba(0, 0, 0, 0.03);
          border-bottom: 2px solid rgba(0, 0, 0, 0.1);
        }
        .dark .report-table thead tr {
          background-color: rgba(255, 255, 255, 0.05);
          border-bottom: 2px solid rgba(255, 255, 255, 0.15);
        }
        .report-table tbody tr:nth-child(even) {
          background-color: rgba(0, 0, 0, 0.015);
        }
        .dark .report-table tbody tr:nth-child(even) {
          background-color: rgba(255, 255, 255, 0.02);
        }

        /* Code Blocks */
        .report-code-block {
          background-color: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-left: 4px solid #00A3FF;
          padding: 12px;
          font-family: monospace;
          font-size: 12px;
          border-radius: 4px;
          overflow-x: auto;
          margin: 12px 0;
          color: #1E293B;
          white-space: pre-wrap;
        }
        .dark .report-code-block {
          background-color: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #E0E0E0;
        }
        .report-inline-code {
          background-color: rgba(0, 0, 0, 0.05);
          padding: 2px 5px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
          border: 1px solid rgba(0, 0, 0, 0.08);
          color: #0072BD;
        }
        .dark .report-inline-code {
          background-color: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #00A3FF;
        }

        /* Engineering Sign-off Box */
        .engineering-signoff-box {
          border: 1.5px solid rgba(0, 0, 0, 0.1);
          border-radius: 6px;
          padding: 18px;
          margin: 20px 0;
          background-color: rgba(0, 0, 0, 0.015);
          font-family: sans-serif;
          page-break-inside: avoid;
          color: #1E293B;
        }
        .dark class .engineering-signoff-box,
        .dark .engineering-signoff-box {
          border: 1.5px solid rgba(255, 255, 255, 0.15);
          background-color: rgba(255, 255, 255, 0.02);
          color: #FFFFFF;
        }
        .signoff-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .signoff-table td {
          padding: 6px 0;
          border: none !important;
        }
        .signoff-label {
          color: rgba(0, 0, 0, 0.5);
        }
        .dark .signoff-label {
          color: rgba(255, 255, 255, 0.5);
        }

        /* Page Break */
        .page-break {
          border: 1px dashed #cbd5e1;
          margin: 24px 0;
          height: 0;
          border-top: 1px dashed #cbd5e1;
        }
        .dark .page-break {
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-top: 1px dashed #475569;
        }

        /* Telemetry Graphs */
        .report-graph-box {
          border: 1px solid rgba(0, 0, 0, 0.1);
          background-color: #F8FAFC;
          border-radius: 6px;
          padding: 16px;
          margin: 16px 0;
          max-width: 600px;
          font-family: sans-serif;
          page-break-inside: avoid;
          color: #1E293B;
        }
        .dark .report-graph-box {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background-color: #151F32;
          color: #FFFFFF;
        }
        .graph-title {
          font-weight: bold;
          font-size: 12px;
          color: #1E293B;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          padding-bottom: 6px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
        }
        .dark .graph-title {
          color: #FFFFFF;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .graph-canvas {
          height: 180px;
          width: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          border-left: 2px solid rgba(0, 0, 0, 0.2);
          border-bottom: 2px solid rgba(0, 0, 0, 0.2);
          padding-bottom: 5px;
          position: relative;
        }
        .dark .graph-canvas {
          border-left: 2px solid rgba(255, 255, 255, 0.2);
          border-bottom: 2px solid rgba(255, 255, 255, 0.2);
        }
        .graph-gridline {
          position: absolute;
          width: 100%;
          height: 1px;
          border-top: 1px dashed rgba(0, 0, 0, 0.06);
        }
        .dark .graph-gridline {
          border-top: 1px dashed rgba(255, 255, 255, 0.06);
        }
        .graph-legend-text {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          color: rgba(0, 0, 0, 0.5);
          margin-top: 6px;
          font-family: monospace;
        }
        .dark .graph-legend-text {
          color: rgba(255, 255, 255, 0.4);
        }
        .graph-lines-container {
          color: #1E293B;
          border-left: 2px solid rgba(0, 0, 0, 0.2);
          border-bottom: 2px solid rgba(0, 0, 0, 0.2);
          padding-bottom: 5px;
        }
        .dark .graph-lines-container {
          color: #E2E8F0;
          border-left: 2px solid rgba(255, 255, 255, 0.2);
          border-bottom: 2px solid rgba(255, 255, 255, 0.2);
        }

        @media print {
          body * {
            visibility: hidden;
          }
          #print-area-wrapper, #print-area-wrapper * {
            visibility: visible;
          }
          #print-area-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background-color: white !important;
            color: black !important;
            box-shadow: none !important;
            border: 0 !important;
            padding: 0 !important;
          }
          #print-area-wrapper h1, #print-area-wrapper h2, #print-area-wrapper h3, #print-area-wrapper p, #print-area-wrapper td, #print-area-wrapper th, #print-area-wrapper li {
            color: black !important;
          }
          #print-area-wrapper table, #print-area-wrapper th, #print-area-wrapper td {
            border: 1px solid #666666 !important;
          }
          #print-area-wrapper .page-break {
            page-break-before: always !important;
            border: 0 !important;
            height: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Main Top Header */}
      <div className="px-4 h-14 flex items-center justify-between border-b border-border-v bg-surface/50 shrink-0 select-none">
        <div className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-2">
          <FileText size={14} className="text-accent-blue" />
          Smart Report Document Engine
        </div>
        
        {/* Undo/Redo & Utility icons */}
        <div className="flex items-center gap-1">
          <button 
            onClick={handleUndo} 
            disabled={historyIndex <= 0} 
            className="h-7 w-7 rounded flex items-center justify-center hover:bg-foreground/5 text-foreground/60 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo"
          >
            <Undo2 size={14} />
          </button>
          <button 
            onClick={handleRedo} 
            disabled={historyIndex >= history.length - 1} 
            className="h-7 w-7 rounded flex items-center justify-center hover:bg-foreground/5 text-foreground/60 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo"
          >
            <Redo2 size={14} />
          </button>

        </div>
      </div>      {/* Main Layout Split */}

      <div className="flex-1 flex overflow-hidden bg-slate-100 dark:bg-slate-900/60">
        
        {/* LEFT COLUMN: Ribbon + Report Data */}
        <div className="flex-1 min-w-0 border-r border-border-v bg-surface flex flex-col z-20">
          
          {/* Word-like Ribbon Toolbar */}
      <div className="bg-slate-50 dark:bg-[#131B2E] border-b border-border-v flex flex-col shrink-0 select-none text-[11px] font-mono shadow-sm">
        {/* Tabs Headers Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-[#0F172A] px-2 h-8">
          <div className="flex items-center">
            {ribbonLayout.filter(tab => tab.visible).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveRibbonTab(tab.id)}
                className={cn(
                  "px-4 h-8 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 outline-none",
                  activeRibbonTab === tab.id 
                    ? "text-accent-blue border-accent-blue bg-slate-50 dark:bg-[#131B2E]" 
                    : "text-foreground/50 border-transparent hover:text-foreground hover:bg-foreground/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Settings cog to open Ribbon Customizer */}
          <button
            onClick={handleOpenRibbonCustomizer}
            className="flex items-center gap-1.5 px-3 h-7 text-[10px] text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded transition-all font-bold uppercase tracking-wider"
            title="Customize the Ribbon Toolbar commands and tabs"
          >
            <Settings size={12} /> Customize Ribbon
          </button>
        </div>

        {/* Tab content ribbon area */}
        <div className="px-3 h-[84px] py-1 bg-slate-50 dark:bg-[#131B2E] border-t border-slate-200 dark:border-slate-900/40 flex items-stretch gap-4 overflow-x-auto scrollbar-clean select-none">
          {ribbonLayout.find(tab => tab.id === activeRibbonTab)?.groups.filter(g => g.visible).map(group => (
            <div key={group.id} className="flex flex-col justify-between border-r border-slate-350 dark:border-slate-850/60 pr-3.5 last:border-0 relative pb-4 shrink-0 min-w-[40px] h-[72px]">
              <div className="flex items-center gap-1.5 h-11">
                {group.commands.map(cmd => renderRibbonCommandItem(cmd))}
              </div>
              <span className="absolute bottom-0.5 left-0 right-0 text-center text-[7.5px] uppercase tracking-widest text-slate-500 font-semibold font-sans select-none pointer-events-none">
                {group.label}
              </span>
            </div>
          ))}
          {(!ribbonLayout.find(tab => tab.id === activeRibbonTab)?.groups.some(g => g.visible)) && (
            <div className="text-[10px] text-foreground/30 font-bold uppercase pl-2 font-sans self-center">
              No visible groups in this tab. Click "Customize Ribbon" to configure.
            </div>
          )}
        </div>
      </div>

          {/* Left UI Bar (Inputs) */}
          <div className="flex-1 overflow-y-auto scrollbar-clean flex flex-col">
          <div className="p-4 border-b border-border-v bg-background/50 sticky top-0 z-10 flex items-center justify-between">
            <h3 className="font-bold text-[11px] uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <FileText size={14} className="text-accent-blue" />
              Report Data
            </h3>
          </div>
          
          <div className="p-4 flex flex-col gap-4 font-mono text-[11px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">Project Template</label>
              <select
                value={selectedProjectTemplate}
                onChange={(e) => {
                  setSelectedProjectTemplate(e.target.value);
                  loadTemplate(e.target.value);
                }}
                className="h-8 bg-background border border-border-v rounded px-2 text-accent-blue outline-none focus:border-accent-blue cursor-pointer font-bold text-[11px]"
              >
                <option value="" disabled hidden>Select Project</option>
                <option value="SNTL400">SNTL400</option>
                <option value="SNTL600">SNTL600</option>
                <option value="SNTL1000">SNTL1000</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">Report By</label>
              <input 
                type="text" 
                value={reportBy}
                onChange={(e) => setReportBy(e.target.value)}
                className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-accent-blue"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">Date</label>
              <input 
                type="date" 
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-accent-blue"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">P-F Op Mode</label>
                <select 
                  value={pfOpMode}
                  onChange={(e) => setPfOpMode(e.target.value)}
                  className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-accent-blue"
                >
                  <option value="Remote Control">Remote Control</option>
                  <option value="Manual Control">Manual Control</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">P-F Eval</label>
                <select 
                  value={pfEvaluation}
                  onChange={(e) => setPfEvaluation(e.target.value)}
                  className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-accent-blue"
                >
                  <option value="Normal">Normal</option>
                  <option value="Abnormal">Abnormal</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">P-SOC Op Mode</label>
                <select 
                  value={psocOpMode}
                  onChange={(e) => setPsocOpMode(e.target.value)}
                  className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-accent-blue"
                >
                  <option value="Remote Control">Remote Control</option>
                  <option value="Manual Control">Manual Control</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">P-SOC Eval</label>
                <select 
                  value={psocEvaluation}
                  onChange={(e) => setPsocEvaluation(e.target.value)}
                  className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-accent-blue"
                >
                  <option value="Normal">Normal</option>
                  <option value="Abnormal">Abnormal</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">Q-U Op Mode</label>
                <select 
                  value={quOpMode}
                  onChange={(e) => setQuOpMode(e.target.value)}
                  className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-accent-blue"
                >
                  <option value="Remote Control">Remote Control</option>
                  <option value="Manual Control">Manual Control</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">Q-U Eval</label>
                <select 
                  value={quEvaluation}
                  onChange={(e) => setQuEvaluation(e.target.value)}
                  className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-accent-blue"
                >
                  <option value="Normal">Normal</option>
                  <option value="Abnormal">Abnormal</option>
                </select>
              </div>
            </div>

            {selectedProjectTemplate === 'SNTL600' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">CMCS Command Perf</label>
                <textarea 
                  value={cmcsPerformance}
                  onChange={(e) => setCmcsPerformance(e.target.value)}
                  className="min-h-[80px] bg-background border border-border-v rounded p-2 text-foreground outline-none focus:border-accent-blue resize-y"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">EDC Command Response</label>
              <textarea 
                value={edcResponse}
                onChange={(e) => setEdcResponse(e.target.value)}
                className="min-h-[80px] bg-background border border-border-v rounded p-2 text-foreground outline-none focus:border-accent-blue resize-y"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-foreground/50 font-bold uppercase tracking-wider text-[10px]">Notices</label>
              <textarea 
                value={notices}
                onChange={(e) => setNotices(e.target.value)}
                className="min-h-[160px] bg-background border border-border-v rounded p-2 text-foreground outline-none focus:border-accent-blue resize-y"
              />
            </div>
            
            <button
              onClick={() => loadTemplate(selectedProjectTemplate)}
              className="mt-2 h-8 bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue border border-accent-blue/30 rounded font-bold uppercase tracking-wider text-[10px] transition-colors"
            >
              Force Regenerate Template
            </button>
          </div>
        </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex-1 flex flex-col min-w-0 relative bg-slate-100 dark:bg-slate-900/60">
          
          {/* Right Area (Output preview) */}
          <div className="flex-1 overflow-y-auto scrollbar-clean p-6 md:p-8 flex justify-center items-start">
          <div 
            id="print-area-wrapper"
            className="w-full max-w-[700px] min-h-[900px] h-max bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded-md shadow-2xl p-8 md:p-10 mb-8 text-sm font-sans focus:outline-none overflow-y-visible"
            contentEditable
            ref={editorRef}
            onInput={handleContentChange}
            style={{ 
              color: theme === 'dark' ? '#E2E8F0' : '#1E293B',
              lineHeight: '1.6',
              boxShadow: theme === 'dark' ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
              zoom: zoomLevel
            }}
          />
        </div>
        


      {/* Footer Word/Character Statistics status bar */}
      <div className="h-8 border-t border-border-v bg-surface/70 px-4 flex items-center justify-between text-[10px] font-mono text-foreground/50 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span>Words: <strong>{wordCount}</strong></span>
          <span className="text-foreground/20">|</span>
          <span>Chars: <strong>{charCount}</strong></span>
          <span className="text-foreground/20 ml-2">|</span>
          <div className="flex items-center gap-1 bg-background/50 rounded px-1.5 py-0.5 border border-border-v">
            <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} className="hover:bg-foreground/10 p-0.5 rounded text-foreground/70 hover:text-foreground transition-colors" title="Zoom Out">
              <Icons.ZoomOut size={12} />
            </button>
            <span className="w-9 text-center font-bold text-accent-blue">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel(z => Math.min(2.0, z + 0.1))} className="hover:bg-foreground/10 p-0.5 rounded text-foreground/70 hover:text-foreground transition-colors" title="Zoom In">
              <Icons.ZoomIn size={12} />
            </button>
          </div>
        </div>
        
        {/* Action Panel options */}
        <div className="flex items-center gap-4">
          <button onClick={handleClearDoc} className="text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors" title="Reset/Clear all content">
            <Trash2 size={12} /> Clear Doc
          </button>
          <button onClick={handlePrint} className="text-foreground/60 hover:text-foreground flex items-center gap-1.5 transition-colors" title="Print document or save as PDF">
            <Printer size={12} /> Print/PDF
          </button>
          <div className="flex items-center gap-2 border-l border-border-v pl-3">
            <button onClick={handleExportHtml} className="text-accent-blue hover:text-blue-400 flex items-center gap-1 transition-colors" title="Download report as HTML file">
              <FileDown size={12} /> Export HTML
            </button>
            <button onClick={handleExportMarkdown} className="text-green-400 hover:text-green-300 flex items-center gap-1 transition-colors" title="Download report as Markdown file">
              <FileDown size={12} /> Export MD
            </button>
          </div>
        </div>
      </div>
      </div>
      </div>

      {/* POPUP MODAL: Table Grid Creator */}
      {showTableModal && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-surface border border-border-v rounded-md p-5 w-72 flex flex-col gap-4 shadow-2xl">
            <div className="font-bold text-xs uppercase tracking-wider text-foreground border-b border-border-v pb-2 flex items-center gap-1.5">
              <Table size={14} className="text-accent-blue" />
              Insert Table
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
              <div className="flex flex-col gap-1">
                <span className="text-foreground/50">Rows</span>
                <input 
                  type="number" 
                  min="1" 
                  max="20" 
                  value={tableRows} 
                  onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))} 
                  className="h-8 bg-background border border-border-v rounded px-2 text-foreground text-xs outline-none focus:border-accent-blue"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-foreground/50">Columns</span>
                <input 
                  type="number" 
                  min="1" 
                  max="10" 
                  value={tableCols} 
                  onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))} 
                  className="h-8 bg-background border border-border-v rounded px-2 text-foreground text-xs outline-none focus:border-accent-blue"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-v">
              <button 
                onClick={() => setShowTableModal(false)}
                className="h-7 px-3 text-[10px] text-foreground/60 hover:text-foreground transition-colors uppercase font-bold tracking-wider"
              >
                Cancel
              </button>
              <button 
                onClick={handleInsertTable}
                className="h-7 px-3 bg-accent-blue hover:bg-blue-600 rounded text-white text-[10px] transition-colors uppercase font-bold tracking-wider"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Insert Link URL */}
      {showLinkModal && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-surface border border-border-v rounded-md p-5 w-80 flex flex-col gap-4 shadow-2xl">
            <div className="font-bold text-xs uppercase tracking-wider text-foreground border-b border-border-v pb-2 flex items-center gap-1.5">
              <LinkIcon size={14} className="text-accent-blue" />
              Insert Hyperlink
            </div>
            
            <div className="flex flex-col gap-1 text-[11px] font-mono">
              <span className="text-foreground/50">Link URL</span>
              <input 
                type="text" 
                placeholder="https://example.com" 
                value={linkUrl} 
                onChange={(e) => setLinkUrl(e.target.value)} 
                className="h-8 bg-background border border-border-v rounded px-2 text-foreground text-xs outline-none focus:border-accent-blue"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-v">
              <button 
                onClick={() => setShowLinkModal(false)}
                className="h-7 px-3 text-[10px] text-foreground/60 hover:text-foreground transition-colors uppercase font-bold tracking-wider"
              >
                Cancel
              </button>
              <button 
                onClick={handleInsertLink}
                className="h-7 px-3 bg-accent-blue hover:bg-blue-600 rounded text-white text-[10px] transition-colors uppercase font-bold tracking-wider"
              >
                Apply Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Insert Callout Box */}
      {showCalloutModal && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-surface border border-border-v rounded-md p-5 w-72 flex flex-col gap-4 shadow-2xl">
            <div className="font-bold text-xs uppercase tracking-wider text-foreground border-b border-border-v pb-2 flex items-center gap-1.5">
              <AlertCircle size={14} className="text-accent-blue" />
              Insert Callout Box
            </div>
            
            <div className="flex flex-col gap-1.5 text-[11px] font-mono">
              <span className="text-foreground/50">Callout Level</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCalloutType('info')} 
                  className={cn("flex-1 h-7 rounded text-[10px] font-bold transition-all border", calloutType === 'info' ? "bg-blue-500/10 border-blue-500 text-blue-400" : "bg-background border-border-v text-foreground/50")}
                >
                  INFO
                </button>
                <button 
                  onClick={() => setCalloutType('warning')} 
                  className={cn("flex-1 h-7 rounded text-[10px] font-bold transition-all border", calloutType === 'warning' ? "bg-yellow-500/10 border-yellow-500 text-yellow-400" : "bg-background border-border-v text-foreground/50")}
                >
                  WARN
                </button>
                <button 
                  onClick={() => setCalloutType('error')} 
                  className={cn("flex-1 h-7 rounded text-[10px] font-bold transition-all border", calloutType === 'error' ? "bg-red-500/10 border-red-500 text-red-400" : "bg-background border-border-v text-foreground/50")}
                >
                  ALERT
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-v">
              <button 
                onClick={() => setShowCalloutModal(false)}
                className="h-7 px-3 text-[10px] text-foreground/60 hover:text-foreground transition-colors uppercase font-bold tracking-wider"
              >
                Cancel
              </button>
              <button 
                onClick={handleInsertCallout}
                className="h-7 px-3 bg-accent-blue hover:bg-blue-600 rounded text-white text-[10px] transition-colors uppercase font-bold tracking-wider"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Operational Layout Templates */}
      {showTemplateModal && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-surface border border-border-v rounded-md p-5 w-80 flex flex-col gap-4 shadow-2xl">
            <div className="font-bold text-xs uppercase tracking-wider text-foreground border-b border-border-v pb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-accent-blue" />
              Load Report Template
            </div>
            
            <div className="text-[10.5px] text-foreground/40 leading-relaxed font-mono">
              Selecting a template will overwrite all active content. Save drafts beforehand!
            </div>
            
            <div className="flex flex-col gap-2 font-mono">
              <button 
                onClick={() => loadTemplate('bess')}
                className="h-10 text-left px-3 text-[11px] font-bold border border-border-v hover:border-accent-blue/30 rounded bg-background/50 hover:bg-accent-blue/5 text-foreground transition-colors flex items-center justify-between"
              >
                <span>BESS Operation Summary</span>
                <span className="text-[9px] text-foreground/40 uppercase">Recommended</span>
              </button>
              <button 
                onClick={() => loadTemplate('stability')}
                className="h-10 text-left px-3 text-[11px] font-bold border border-border-v hover:border-accent-blue/30 rounded bg-background/50 hover:bg-accent-blue/5 text-foreground transition-colors flex items-center justify-between"
              >
                <span>Grid Stability & Freq Audit</span>
                <span className="text-[9px] text-foreground/40 uppercase">Mitigations</span>
              </button>
              <button 
                onClick={() => loadTemplate('blank')}
                className="h-10 text-left px-3 text-[11px] font-bold border border-border-v hover:border-red-500/30 rounded bg-background/50 hover:bg-red-500/5 text-foreground transition-colors flex items-center justify-between"
              >
                <span>Blank Canvas Document</span>
                <span className="text-[9px] text-red-400 uppercase">Clear</span>
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-v">
              <button 
                onClick={() => setShowTemplateModal(false)}
                className="h-7 px-3 text-[10px] text-foreground/60 hover:text-foreground transition-colors uppercase font-bold tracking-wider"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Custom Tool Configuration */}
      {showToolModal && selectedTool && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-surface border border-border-v rounded-md p-5 w-96 flex flex-col gap-4 shadow-2xl max-h-[85%] overflow-hidden">
            <div className="font-bold text-xs uppercase tracking-wider text-foreground border-b border-border-v pb-2 flex items-center justify-between font-mono">
              <div className="flex items-center gap-1.5">
                <Code size={14} className="text-violet-400" />
                <span>Configure: {selectedTool.name}</span>
              </div>
              <button 
                onClick={() => { setShowToolModal(false); setSelectedTool(null); }}
                className="text-foreground/50 hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="text-[11px] text-foreground/60 leading-relaxed font-mono italic">
              {selectedTool.description}
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-clean pr-1 flex flex-col gap-3 font-mono text-[11px]">
              {selectedTool.fields.map(field => {
                if (field.type === 'select') {
                  return (
                    <div key={field.id} className="flex flex-col gap-1">
                      <span className="text-foreground/50">{field.label}</span>
                      <select
                        value={toolInputs[field.id] !== undefined ? toolInputs[field.id] : ''}
                        onChange={(e) => setToolInputs(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="h-8 bg-background border border-border-v rounded px-2 text-foreground text-xs outline-none focus:border-violet-500 cursor-pointer"
                      >
                        {field.options?.map(opt => (
                          <option key={opt} value={opt} className="bg-surface text-foreground">
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                } else if (field.type === 'number') {
                  return (
                    <div key={field.id} className="flex flex-col gap-1">
                      <span className="text-foreground/50">{field.label}</span>
                      <input
                        type="number"
                        value={toolInputs[field.id] !== undefined ? toolInputs[field.id] : ''}
                        onChange={(e) => setToolInputs(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="h-8 bg-background border border-border-v rounded px-2 text-foreground text-xs outline-none focus:border-violet-500"
                      />
                    </div>
                  );
                } else {
                  return (
                    <div key={field.id} className="flex flex-col gap-1">
                      <span className="text-foreground/50">{field.label}</span>
                      <input
                        type="text"
                        value={toolInputs[field.id] !== undefined ? toolInputs[field.id] : ''}
                        onChange={(e) => setToolInputs(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="h-8 bg-background border border-border-v rounded px-2 text-foreground text-xs outline-none focus:border-violet-500"
                      />
                    </div>
                  );
                }
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-v">
              <button 
                onClick={() => { setShowToolModal(false); setSelectedTool(null); }}
                className="h-7 px-3 text-[10px] text-foreground/60 hover:text-foreground transition-colors uppercase font-bold tracking-wider"
              >
                Cancel
              </button>
              <button 
                onClick={handleExecuteTool}
                className="h-7 px-3 bg-violet-600 hover:bg-violet-700 rounded text-white text-[10px] transition-colors uppercase font-bold tracking-wider"
              >
                Insert Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Customize Ribbon */}
      {showCustomizeRibbonModal && (
        <div className="absolute inset-0 bg-background/85 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-surface border border-border-v rounded-md p-6 w-[820px] h-[580px] flex flex-col gap-4 shadow-2xl overflow-hidden font-mono text-[11px]">
            {/* Header */}
            <div className="font-bold text-xs uppercase tracking-wider text-foreground border-b border-border-v pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={14} className="text-accent-blue" />
                <span>Customize Ribbon Options</span>
              </div>
              <button 
                onClick={() => setShowCustomizeRibbonModal(false)}
                className="text-foreground/50 hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Main Content Areas */}
            <div className="flex-1 flex gap-4 min-h-0">
              {/* Left Side: Choose commands from */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <span className="text-foreground/60 font-sans">Choose commands from:</span>
                <select
                  value={chooseCommandsFrom}
                  onChange={(e) => setChooseCommandsFrom(e.target.value)}
                  className="h-8 bg-background border border-border-v rounded px-2 text-foreground text-xs outline-none focus:border-accent-blue cursor-pointer"
                >
                  <option value="popular">Popular Commands</option>
                  <option value="all">All Commands</option>
                  <option value="tools">Custom Tools / Add-ins</option>
                </select>

                <div className="flex-1 border border-border-v bg-background rounded p-2 overflow-y-auto scrollbar-clean flex flex-col gap-0.5">
                  {getAvailableCommands()
                    .filter(c => {
                      if (chooseCommandsFrom === 'tools') return c.id.startsWith('tool_');
                      if (chooseCommandsFrom === 'popular') return !c.id.startsWith('tool_') || c.id === 'tool_signature_sign_off_default';
                      return true; // 'all'
                    })
                    .map(cmd => (
                      <button
                        key={cmd.id}
                        onClick={() => setSelectedAvailableCommandId(cmd.id)}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors",
                          selectedAvailableCommandId === cmd.id 
                            ? "bg-accent-blue/20 text-foreground border border-accent-blue/30" 
                            : "hover:bg-foreground/5 text-foreground/80 border border-transparent"
                        )}
                      >
                        {renderIcon(cmd.iconName, 13)}
                        <span className="truncate">{cmd.label}</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Center Controls: Add / Remove */}
              <div className="flex flex-col justify-center gap-3 px-1">
                <button
                  disabled={!selectedAvailableCommandId || !selectedTreeNode || selectedTreeNode.type !== 'group'}
                  onClick={handleAddCommand}
                  className="px-3 py-2 bg-slate-800 dark:bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-white border border-slate-700/60 rounded flex items-center gap-1 font-bold uppercase transition-all text-[10px]"
                  title="Add command to selected group"
                >
                  Add &gt;&gt;
                </button>
                <button
                  disabled={!selectedTreeNode}
                  onClick={handleRemoveNode}
                  className="px-3 py-2 bg-slate-800 dark:bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-white border border-slate-700/60 rounded flex items-center gap-1 font-bold uppercase transition-all text-[10px]"
                  title="Remove selected element"
                >
                  &lt;&lt; Remove
                </button>
              </div>

              {/* Right Side: Customize the Ribbon */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <span className="text-foreground/60 font-sans">Customize the Ribbon:</span>
                <select
                  value="main"
                  disabled
                  className="h-8 bg-background border border-border-v rounded px-2 text-foreground text-xs outline-none focus:border-accent-blue cursor-pointer"
                >
                  <option value="main">Main Tabs</option>
                </select>

                <div className="flex-1 border border-border-v bg-background rounded p-2 overflow-y-auto scrollbar-clean flex flex-col gap-1">
                  {tempRibbonLayout.map(tab => {
                    const isTabExpanded = expandedNodes[`tab_${tab.id}`] ?? false;
                    const isTabSelected = selectedTreeNode?.type === 'tab' && selectedTreeNode.tabId === tab.id;
                    
                    return (
                      <div key={tab.id} className="flex flex-col gap-0.5">
                        {/* Tab Row */}
                        <div className={cn(
                          "flex items-center justify-between p-1 rounded group/row transition-colors",
                          isTabSelected ? "bg-slate-800 dark:bg-slate-800 text-white font-bold" : "hover:bg-foreground/5 text-foreground/80"
                        )}>
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <button
                              onClick={() => setExpandedNodes(prev => ({ ...prev, [`tab_${tab.id}`]: !isTabExpanded }))}
                              className="p-0.5 text-foreground/45 hover:text-foreground"
                            >
                              {isTabExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                            <input
                              type="checkbox"
                              checked={tab.visible}
                              onChange={() => handleToggleNodeVisibility(tab.id)}
                              className="mr-1 h-3.5 w-3.5 border-border-v rounded text-accent-blue cursor-pointer bg-background focus:ring-0"
                            />
                            <Folder size={12} className="text-amber-500 shrink-0" />
                            <span 
                              onClick={() => setSelectedTreeNode({ type: 'tab', tabId: tab.id })}
                              className="cursor-pointer truncate flex-1 pr-2 ml-1"
                            >
                              {tab.label}
                            </span>
                          </div>
                        </div>

                        {/* Groups (if expanded) */}
                        {isTabExpanded && tab.groups.map(group => {
                          const isGroupExpanded = expandedNodes[`group_${group.id}`] ?? false;
                          const isGroupSelected = selectedTreeNode?.type === 'group' && selectedTreeNode.groupId === group.id;
                          
                          return (
                            <div key={group.id} className="pl-4 flex flex-col gap-0.5">
                              {/* Group Row */}
                              <div className={cn(
                                "flex items-center justify-between p-1 rounded transition-colors",
                                isGroupSelected ? "bg-slate-800 dark:bg-slate-800 text-white font-bold" : "hover:bg-foreground/5 text-foreground/75"
                              )}>
                                <div className="flex items-center gap-1 min-w-0 flex-1 pl-2">
                                  <button
                                    onClick={() => setExpandedNodes(prev => ({ ...prev, [`group_${group.id}`]: !isGroupExpanded }))}
                                    className="p-0.5 text-foreground/45 hover:text-foreground"
                                  >
                                    {isGroupExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  </button>
                                  <input
                                    type="checkbox"
                                    checked={group.visible}
                                    onChange={() => handleToggleNodeVisibility(tab.id, group.id)}
                                    className="mr-1 h-3 w-3 border-border-v rounded text-accent-blue cursor-pointer bg-background focus:ring-0"
                                  />
                                  <span 
                                    onClick={() => setSelectedTreeNode({ type: 'group', tabId: tab.id, groupId: group.id })}
                                    className="cursor-pointer truncate flex-1 pr-2 italic font-semibold text-slate-300 dark:text-slate-300 text-[10px] ml-1"
                                  >
                                    {group.label}
                                  </span>
                                </div>
                              </div>

                              {/* Commands (if expanded) */}
                              {isGroupExpanded && group.commands.map(cmd => {
                                const isCmdSelected = selectedTreeNode?.type === 'command' && selectedTreeNode.commandId === cmd.id && selectedTreeNode.groupId === group.id;
                                
                                return (
                                  <div 
                                    key={cmd.id} 
                                    onClick={() => setSelectedTreeNode({ type: 'command', tabId: tab.id, groupId: group.id, commandId: cmd.id })}
                                    className={cn(
                                      "pl-12 pr-2 py-1 rounded flex items-center gap-2 cursor-pointer transition-colors text-[10px]",
                                      isCmdSelected ? "bg-slate-900 dark:bg-slate-900 text-white font-bold" : "hover:bg-foreground/5 text-foreground/60"
                                    )}
                                  >
                                    {renderIcon(cmd.iconName, 12)}
                                    <span className="truncate">{cmd.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Configuration Modification Panel */}
            <div className="flex items-center justify-between border-t border-border-v pt-3 font-sans">
              <div className="flex gap-2">
                <button
                  onClick={handleCreateNewTab}
                  className="h-8 px-3 border border-border-v bg-background hover:bg-foreground/5 text-foreground rounded text-[10px] font-bold uppercase transition-all"
                >
                  New Tab
                </button>
                <button
                  disabled={!selectedTreeNode}
                  onClick={handleCreateNewGroup}
                  className="h-8 px-3 border border-border-v bg-background hover:bg-foreground/5 text-foreground rounded text-[10px] font-bold uppercase transition-all disabled:opacity-30 disabled:hover:bg-background"
                >
                  New Group
                </button>
                <button
                  disabled={!selectedTreeNode || selectedTreeNode.type === 'command'}
                  onClick={handleRenameNode}
                  className="h-8 px-3 border border-border-v bg-background hover:bg-foreground/5 text-foreground rounded text-[10px] font-bold uppercase transition-all disabled:opacity-30 disabled:hover:bg-background"
                >
                  Rename...
                </button>
              </div>

              <div className="flex items-center gap-2 relative">
                {/* Reset dropdown toggle */}
                <div className="relative">
                  <button
                    onClick={() => { setShowResetDropdown(!showResetDropdown); setShowImportExportDropdown(false); }}
                    className="h-8 px-3 border border-border-v bg-background hover:bg-foreground/5 text-foreground rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1"
                  >
                    Reset <ChevronDown size={11} />
                  </button>
                  {showResetDropdown && (
                    <div className="absolute bottom-10 right-0 w-44 bg-surface border border-border-v rounded shadow-2xl py-1 flex flex-col z-50 text-[10.5px]">
                      <button
                        onClick={() => handleResetRibbonConfig('selected')}
                        disabled={!selectedTreeNode}
                        className="w-full text-left px-3 py-2 hover:bg-foreground/5 text-foreground disabled:opacity-30"
                      >
                        Reset only selected tab
                      </button>
                      <button
                        onClick={() => handleResetRibbonConfig('all')}
                        className="w-full text-left px-3 py-2 hover:bg-foreground/5 text-foreground border-t border-border-v"
                      >
                        Reset all customizations
                      </button>
                    </div>
                  )}
                </div>

                {/* Import/Export dropdown toggle */}
                <div className="relative">
                  <button
                    onClick={() => { setShowImportExportDropdown(!showImportExportDropdown); setShowResetDropdown(false); }}
                    className="h-8 px-3 border border-border-v bg-background hover:bg-foreground/5 text-foreground rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1"
                  >
                    Import/Export <ChevronDown size={11} />
                  </button>
                  {showImportExportDropdown && (
                    <div className="absolute bottom-10 right-0 w-40 bg-surface border border-border-v rounded shadow-2xl py-1 flex flex-col z-50 text-[10px]">
                      <button
                        onClick={() => ribbonConfigFileInputRef.current?.click()}
                        className="w-full text-left px-3 py-2 hover:bg-foreground/5 text-foreground"
                      >
                        Import customization
                      </button>
                      <button
                        onClick={handleExportRibbonConfig}
                        className="w-full text-left px-3 py-2 hover:bg-foreground/5 text-foreground border-t border-border-v"
                      >
                        Export customization
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={ribbonConfigFileInputRef}
                    className="hidden"
                    accept=".json"
                    onChange={handleImportRibbonConfig}
                  />
                </div>
              </div>
            </div>

            {/* Footer OK/Cancel buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-border-v font-sans">
              <button 
                onClick={() => setShowCustomizeRibbonModal(false)}
                className="h-8 px-4 text-[10px] text-foreground/60 hover:text-foreground uppercase font-bold tracking-wider hover:bg-foreground/5 rounded transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveRibbonCustomizer}
                className="h-8 px-4 bg-accent-blue hover:bg-blue-600 rounded text-white text-[10px] transition-all uppercase font-bold tracking-wider"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Import Tool Destination Selector */}
      {showImportTargetModal && pendingImportTool && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-surface border border-border-v rounded-md p-5 w-[420px] flex flex-col gap-4 shadow-2xl font-mono text-[11px]">
            <div className="font-bold text-xs uppercase tracking-wider text-foreground border-b border-border-v pb-2 flex items-center gap-1.5">
              <Upload size={14} className="text-violet-400" />
              <span>Import Custom Tool: {pendingImportTool.tool.name}</span>
            </div>

            <div className="text-[10px] text-foreground/50 leading-relaxed italic">
              {pendingImportTool.tool.description}
            </div>

            <div className="flex flex-col gap-3 font-sans text-xs">
              {/* Tab Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-bold text-foreground/60 font-mono">Target Tab</span>
                <select
                  value={importTargetTabId}
                  onChange={(e) => {
                    setImportTargetTabId(e.target.value);
                    const tab = ribbonLayout.find(t => t.id === e.target.value);
                    if (tab && tab.groups.length > 0) {
                      setImportTargetGroupId(tab.groups[0].id);
                    } else {
                      setImportTargetGroupId('create_new_group');
                    }
                  }}
                  className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-violet-500 cursor-pointer font-mono"
                >
                  {ribbonLayout.map(tab => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label} (Tab ID: {tab.id})
                    </option>
                  ))}
                  <option value="create_new_tab" className="text-violet-400 font-bold">
                    + [Create New Tab...]
                  </option>
                </select>
              </div>

              {/* If "Create New Tab" is selected */}
              {importTargetTabId === 'create_new_tab' && (
                <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-violet-500">
                  <span className="text-[10px] uppercase font-bold text-foreground/60 font-mono">New Tab Name</span>
                  <input
                    type="text"
                    placeholder="E.g., Custom Analytics"
                    value={newTabName}
                    onChange={(e) => setNewTabName(e.target.value)}
                    className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-violet-500 font-mono"
                  />
                </div>
              )}

              {/* Group Selector */}
              {importTargetTabId !== 'create_new_tab' && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-foreground/60 font-mono">Target Group</span>
                  <select
                    value={importTargetGroupId}
                    onChange={(e) => setImportTargetGroupId(e.target.value)}
                    className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-violet-500 cursor-pointer font-mono"
                  >
                    {ribbonLayout.find(t => t.id === importTargetTabId)?.groups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.label}
                      </option>
                    ))}
                    <option value="create_new_group" className="text-violet-400 font-bold">
                      + [Create New Group...]
                    </option>
                  </select>
                </div>
              )}

              {/* If "Create New Group" is selected */}
              {(importTargetGroupId === 'create_new_group' || importTargetTabId === 'create_new_tab') && (
                <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-violet-500">
                  <span className="text-[10px] uppercase font-bold text-foreground/60 font-mono">New Group Name</span>
                  <input
                    type="text"
                    placeholder="E.g., Diagnostics"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="h-8 bg-background border border-border-v rounded px-2 text-foreground outline-none focus:border-violet-500 font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border-v font-sans">
              <button 
                onClick={() => {
                  setPendingImportTool(null);
                  setShowImportTargetModal(false);
                }}
                className="h-7 px-3 text-[10px] text-foreground/60 hover:text-foreground uppercase font-bold tracking-wider rounded transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmImport}
                className="h-7 px-4 bg-violet-600 hover:bg-violet-700 rounded text-white text-[10px] transition-all uppercase font-bold tracking-wider"
              >
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
