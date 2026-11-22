/* Read-only Drive adapter. OAuth tokens are supplied from memory by the caller. */
(function(scope){
  const FOLDER='application/vnd.google-apps.folder';
  const FIELDS='id,name,mimeType,size,resourceKey,capabilities(canDownload)';
  function queryValue(value){return String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
  class DriveClient {
    constructor({getToken,fetcher=(...args)=>scope.fetch(...args),mediaURL}){
      this.getToken=getToken;this.fetcher=fetcher;this.mediaURL=mediaURL;this.cache=new Map();
    }
    async request(path,params={}){
      const url=new URL('https://www.googleapis.com/drive/v3/'+path);
      Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
      const token=this.getToken();
      if(!token)throw new Error('La conexión con Drive ha caducado. Pulsa CONECTAR GOOGLE DRIVE.');
      const response=await this.fetcher(url.href,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      if(!response.ok){
        if(response.status===401)throw new Error('La conexión con Drive ha caducado. Pulsa CONECTAR GOOGLE DRIVE.');
        let detail='';try{detail=(await response.json()).error?.message||'';}catch{}
        throw new Error('Drive ('+response.status+'): '+(detail||'No se pudo leer este contenido.'));
      }
      return response;
    }
    async search(q){
      const files=[];let pageToken='';
      do{
        const result=await(await this.request('files',{
          q:'trashed = false and ('+q+')',fields:'nextPageToken,incompleteSearch,files('+FIELDS+')',
          pageSize:'1000',spaces:'drive',supportsAllDrives:'true',includeItemsFromAllDrives:'true',
          ...(pageToken?{pageToken}:{})
        })).json();
        if(result.incompleteSearch)throw new Error('Drive devolvió una búsqueda incompleta. Vuelve a intentarlo.');
        files.push(...(result.files||[]));pageToken=result.nextPageToken||'';
      }while(pageToken);
      return files;
    }
    async children(id){
      if(!this.cache.has(id)){
        const pending=this.search("'"+queryValue(id)+"' in parents");this.cache.set(id,pending);
        pending.catch(()=>this.cache.delete(id));
      }
      return this.cache.get(id);
    }
    async metadata(id){return (await this.request('files/'+encodeURIComponent(id),{fields:FIELDS,supportsAllDrives:'true'})).json();}
    clearCache(){this.cache.clear();}
    async guitarFolders(){return this.search("mimeType = '"+FOLDER+"' and (name = 'GUITARRA' or name = 'Guitarra' or name = 'guitarra')");}
    directory(meta,parts=[meta.name]){
      const client=this;
      if(meta.mimeType!==FOLDER)throw new Error('El elemento elegido no es una carpeta.');
      return {
        kind:'directory',drive:true,id:meta.id,name:meta.name,parts,
        async *entries(){
          for(const child of await client.children(meta.id)){
            const handle=child.mimeType===FOLDER?client.directory(child,[...parts,child.name]):client.file(child,parts);
            yield [child.name,handle];
          }
        },
        async getDirectoryHandle(name){
          const found=(await client.children(meta.id)).filter(x=>x.name===name&&x.mimeType===FOLDER);
          if(found.length!==1)throw new Error('No se pudo identificar la carpeta '+name+'. Actualiza el índice.');
          return client.directory(found[0],[...parts,name]);
        },
        async getFileHandle(name){
          const found=(await client.children(meta.id)).filter(x=>x.name===name&&x.mimeType!==FOLDER);
          if(found.length!==1)throw new Error('No se pudo identificar el archivo '+name+'.');
          return client.file(found[0],parts);
        }
      };
    }
    file(meta,parts=[]){
      const client=this;
      return {kind:'file',drive:true,id:meta.id,name:meta.name,parts,
        async getMediaURL(){
          if(meta.capabilities?.canDownload===false)throw new Error('Este vídeo no permite descargar su contenido para reproducirlo aquí.');
          if(!client.getToken())throw new Error('Pulsa CONECTAR GOOGLE DRIVE para recuperar el acceso.');
          return client.mediaURL(meta);
        },
        async getFile(){
          // Only explicitly opened documents use a complete Blob. Videos stream through the worker.
          const res=await client.request('files/'+encodeURIComponent(meta.id),{alt:'media',supportsAllDrives:'true'});
          return res.blob();
        }
      };
    }
  }
  scope.DriveClient=DriveClient;
  if(typeof module!=='undefined')module.exports={DriveClient,FOLDER,queryValue};
})(globalThis);
