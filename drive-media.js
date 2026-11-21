/* Stream authenticated Drive byte ranges; never cache private media or tokens. */
(function(scope){
  async function clientAuthorization(clients,clientId,fileId){
    if(!clientId)return null;
    const client=await clients.get(clientId);if(!client)return null;
    return new Promise(resolve=>{
      const channel=new MessageChannel();
      const timer=setTimeout(()=>{channel.port1.close();resolve(null);},5000);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
      client.postMessage({type:'DRIVE_MEDIA_AUTH',fileId},[channel.port2]);
    });
  }
  function contentRange(range,size,length){
    const m=/^bytes=(\d*)-(\d*)$/.exec(range||'');
    const total=Number(size),count=Number(length);
    if(!m||!Number.isSafeInteger(total)||total<=0)return null;
    let start=m[1]?Number(m[1]):Math.max(0,total-Number(m[2]));
    let end=m[1]?(m[2]?Math.min(Number(m[2]),total-1):total-1):total-1;
    if(length&&Number.isSafeInteger(count)&&count>0)end=start+count-1;
    if(start>end||end>=total)return null;
    return 'bytes '+start+'-'+end+'/'+total;
  }
  async function serveDriveMedia(request,{clientId,clients,fetcher=scope.fetch,authorize=clientAuthorization}){
    const noStore={'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'};
    if(!['GET','HEAD'].includes(request.method))return new Response('Método no permitido',{status:405,headers:noStore});
    const fileId=new URL(request.url).pathname.split('/').pop();
    if(!/^[A-Za-z0-9_-]+$/.test(fileId))return new Response('Archivo no válido',{status:400,headers:noStore});
    const auth=await authorize(clients,clientId,fileId);
    if(!auth?.token||!auth.meta||auth.meta.id!==fileId)return new Response('Vuelve a conectar Google Drive.',{status:401,headers:noStore});
    const headers=new Headers({Authorization:'Bearer '+auth.token});
    const range=request.headers.get('Range');if(range)headers.set('Range',range);
    if(auth.meta.resourceKey)headers.set('X-Goog-Drive-Resource-Keys',fileId+'/'+auth.meta.resourceKey);
    const response=await fetcher('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId)+'?alt=media&supportsAllDrives=true',{
      method:request.method,headers,cache:'no-store',signal:request.signal
    });
    if(!response.ok){
      const client=await clients.get(clientId);client?.postMessage({type:'DRIVE_MEDIA_ERROR',fileId,status:response.status});
      if(response.status===416){const h=new Headers(noStore);const r=response.headers.get('Content-Range');if(r)h.set('Content-Range',r);return new Response(null,{status:416,headers:h});}
      return new Response(response.status===401?'Vuelve a conectar Google Drive.':'No se pudo reproducir el vídeo de Drive.',{status:response.status,headers:noStore});
    }
    const out=new Headers({'Cache-Control':'no-store','Accept-Ranges':'bytes','Content-Type':auth.meta.mimeType||response.headers.get('Content-Type')||'application/octet-stream'});
    for(const name of ['Content-Length','Content-Range','ETag','Last-Modified']){
      const value=response.headers.get(name);if(value)out.set(name,value);
    }
    if(response.status===206&&!out.has('Content-Range')){
      const inferred=contentRange(range,auth.meta.size,out.get('Content-Length'));
      if(inferred)out.set('Content-Range',inferred);
    }
    return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:out});
  }
  scope.serveDriveMedia=serveDriveMedia;
  if(typeof module!=='undefined')module.exports={serveDriveMedia,contentRange};
})(globalThis);
