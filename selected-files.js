/* Adapt FileList to the read-only directory interface used by the academy. */
(function (scope) {
  function directory(name) {
    const children = new Map();
    return {
      kind: 'directory', name, selectedFiles: true, children,
      async *entries() { yield* children.entries(); },
      async getDirectoryHandle(name) {
        const entry = children.get(name);
        if (entry?.kind !== 'directory') throw new Error('No encuentro la carpeta ' + name);
        return entry;
      },
      async getFileHandle(name) {
        const entry = children.get(name);
        if (entry?.kind !== 'file') throw new Error('No encuentro el archivo ' + name);
        return entry;
      }
    };
  }
  function selectedFilesTree(files) {
    const items = Array.from(files);
    const folderSelection = items.length > 0 && items.every(f => f.webkitRelativePath?.includes('/'));
    const name = folderSelection ? items[0].webkitRelativePath.split('/')[0] : 'Mis vídeos';
    const root = directory(name);
    for (const file of items) {
      const parts = folderSelection ? file.webkitRelativePath.split('/').slice(1) : [file.name];
      let parent = root;
      for (const part of parts.slice(0, -1)) {
        if (!parent.children.has(part)) parent.children.set(part, directory(part));
        parent = parent.children.get(part);
      }
      parent.children.set(parts.at(-1), {kind: 'file', name: file.name, getFile: async () => file});
    }
    return root;
  }
  scope.selectedFilesTree = selectedFilesTree;
  if (typeof module !== 'undefined') module.exports = {selectedFilesTree};
})(globalThis);
