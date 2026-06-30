const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const os = require('os');

function toMatlabPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/'/g, "''");
}

function findMatlabExecutable() {
  const candidates = [];

  if (process.env.MATLAB_ROOT) {
    candidates.push(path.join(process.env.MATLAB_ROOT, 'bin', process.platform === 'win32' ? 'matlab.exe' : 'matlab'));
  }

  if (process.platform === 'win32') {
    const programFiles = [
      process.env['ProgramFiles'],
      process.env['ProgramFiles(x86)'],
      'C:\\Program Files',
      'C:\\Program Files (x86)',
    ].filter(Boolean);

    for (const root of programFiles) {
      const matlabRoot = path.join(root, 'MATLAB');
      if (!fs.existsSync(matlabRoot)) continue;
      const releases = fs.readdirSync(matlabRoot)
        .filter((name) => /^R\d{4}[ab]$/.test(name))
        .sort()
        .reverse();
      for (const release of releases) {
        candidates.push(path.join(matlabRoot, release, 'bin', 'matlab.exe'));
      }
    }
  } else if (process.platform === 'darwin') {
    const appRoot = '/Applications';
    if (fs.existsSync(appRoot)) {
      const apps = fs.readdirSync(appRoot).filter((name) => name.startsWith('MATLAB_R'));
      for (const app of apps.sort().reverse()) {
        candidates.push(path.join(appRoot, app, 'bin', 'matlab'));
      }
    }
  } else {
    candidates.push('/usr/local/MATLAB/current/bin/matlab', '/usr/local/bin/matlab');
  }

  candidates.push('matlab');

  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (candidate === 'matlab') return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function runMatlabBatch(matlabExe, scriptPath) {
  const matlabPath = toMatlabPath(scriptPath);
  // change to the directory of the script so it can find evalData.json and the .m files
  const scriptDir = path.dirname(scriptPath);
  const cdCmd = `cd('${toMatlabPath(scriptDir)}')`;
  const args = ['-batch', `${cdCmd}; try; run('${matlabPath}'); catch ME; disp(getReport(ME)); exit(1); end; exit(0);`];

  return new Promise((resolve) => {
    execFile(matlabExe, args, {
      windowsHide: true,
      timeout: 10 * 60 * 1000, // 10 mins
      maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: stdout || '',
        stderr: stderr || '',
        error: error ? (error.message || String(error)) : null,
      });
    });
  });
}

async function exportMatlabFigures({ outputZip, project, evalData, scripts }) {
  if (!outputZip) {
    return { success: false, error: 'Invalid or missing output ZIP path.' };
  }
  if (!evalData || !evalData.timestamps) {
    return { success: false, error: 'No evaluation data available for MATLAB export.' };
  }
  if (!scripts || !Array.isArray(scripts) || scripts.length === 0) {
    return { success: false, error: 'No scripts provided for MATLAB export.' };
  }

  const matlabExe = findMatlabExecutable();
  if (!matlabExe) {
    return {
      success: false,
      error: 'MATLAB was not found. Install MATLAB or set MATLAB_ROOT, then rebuild/relaunch the desktop app.',
    };
  }

  const tmpDir = path.join(os.tmpdir(), 'ess_toolbox_matlab_export_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const jsonPath = path.join(tmpDir, 'evalData.json');
  const runAllScriptPath = path.join(tmpDir, 'run_all.m');

  try {
    const timestampsStr = evalData.timestamps.map((t) => new Date(t).toISOString());
    const serializedEvalData = { ...evalData, timestamps: timestampsStr };
    fs.writeFileSync(jsonPath, JSON.stringify(serializedEvalData, null, 2));

    let runAllScriptContent = "SAVE_FIG_AND_CLOSE = true;\n";
    const expectedFiles = [];

    for (const s of scripts) {
      const filePath = path.join(tmpDir, `${s.safeName}.m`);
      fs.writeFileSync(filePath, s.script, 'utf8');
      runAllScriptContent += `try; run('${s.safeName}.m'); catch ME; disp('${s.safeName} failed:'); disp(getReport(ME)); end;\n`;
      expectedFiles.push(`${s.safeName}.fig`);
    }
    
    fs.writeFileSync(runAllScriptPath, runAllScriptContent, 'utf8');

    const result = await runMatlabBatch(matlabExe, runAllScriptPath);
    const createdFiles = expectedFiles.filter((name) => fs.existsSync(path.join(tmpDir, name)));

    if (!result.ok) {
      return {
        success: false,
        error: [
          'MATLAB export failed.',
          `MATLAB: ${matlabExe}`,
          result.stderr || result.error || 'Unknown MATLAB execution error.',
          result.stdout ? `Output:\n${result.stdout.trim()}` : '',
        ].filter(Boolean).join('\n\n'),
      };
    }

    if (createdFiles.length === 0) {
      return {
        success: false,
        error: [
          'MATLAB finished but no .fig files were created.',
          `MATLAB: ${matlabExe}`,
          result.stdout ? `Output:\n${result.stdout.trim()}` : 'No MATLAB output was captured.',
        ].join('\n\n'),
      };
    }

    // Zip everything in tmpDir
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    
    // Read the dir, only zip .m, .fig and .json files (exclude run_all.m)
    const allFiles = fs.readdirSync(tmpDir);
    for (const f of allFiles) {
      if (f === 'run_all.m') continue;
      zip.addLocalFile(path.join(tmpDir, f));
    }
    
    zip.writeZip(outputZip);

    return {
      success: true,
      matlabExe,
      files: createdFiles,
      outputFolder: outputZip,
      output: result.stdout.trim(),
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = {
  exportMatlabFigures,
  findMatlabExecutable,
};
