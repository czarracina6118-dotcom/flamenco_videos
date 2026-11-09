/* Android read-only folder handles; regular web browsers retain their existing picker. */
(() => {
  if (!window.AndroidFiles) return;
  let sequence = 0;
  const pending = new Map();
  const call = (method, args = {}) => new Promise((resolve, reject) => {
    const id = String(++sequence);
    pending.set(id, {resolve, reject});
    try { AndroidFiles.request(id, method, JSON.stringify(args)); }
    catch (error) { pending.delete(id); reject(error); }
  });
  class Handle {
    constructor(info) { Object.assign(this, info); }
    async queryPermission() { return 'granted'; }
    async requestPermission() { return 'granted'; }
    async *entries() {
      for (const item of await call('list', {id: this.id})) {
        yield [item.name, new Handle(item)];
      }
    }
    async getDirectoryHandle(name) {
      for await (const [childName, handle] of this.entries()) {
        if (childName === name && handle.kind === 'directory') return handle;
      }
      throw new Error('No se encuentra la carpeta: ' + name);
    }
    async getFile() {
      if (this.kind !== 'file') throw new Error('Selecciona un archivo');
      return {name: this.name, size: this.size, type: this.mime,
        nativeId: this.id, nativeUrl: 'https://appassets.androidplatform.net/media/' + this.id};
    }
  }
  window.NativeFiles = {
    call,
    async restore() { const info = await call('restore'); return info ? new Handle(info) : null; },
    complete(id, result, error) {
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      if (error) {
        const e = new Error(error.message);
        e.name = error.name || 'Error';
        request.reject(e);
      } else request.resolve(result);
    }
  };
  window.showDirectoryPicker = async () => new Handle(await call('pick'));
  window.addEventListener('unhandledrejection', event => {
    const status = document.getElementById('status');
    if (status) status.textContent = event.reason?.message || 'No se pudo abrir el archivo o la carpeta.';
    event.preventDefault();
  });
})();
