export async function traverseFileTree(item: any, path: string): Promise<{file: File, path: string}[]> {
  return new Promise((resolve) => {
    if (item.isFile) {
      item.file((file: File) => {
        resolve([{ file, path: path + file.name }]);
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      dirReader.readEntries(async (entries: any[]) => {
        const promises = [];
        for (let i = 0; i < entries.length; i++) {
          promises.push(traverseFileTree(entries[i], path + item.name + "/"));
        }
        const results = await Promise.all(promises);
        resolve(results.flat());
      });
    } else {
      resolve([]);
    }
  });
}

export async function getFilesFromDataTransfer(dt: DataTransfer): Promise<{file: File, path: string}[]> {
  if (dt.items && dt.items.length > 0 && typeof dt.items[0].webkitGetAsEntry === 'function') {
    const promises = [];
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      const entry = item.webkitGetAsEntry();
      if (entry) {
        promises.push(traverseFileTree(entry, ''));
      }
    }
    const results = await Promise.all(promises);
    return results.flat();
  } else {
    return Array.from(dt.files).map(f => ({ file: f, path: f.webkitRelativePath || f.name }));
  }
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
