/* Browser integration: token consent, folder selection and a per-page media bridge. */
(function(scope){
  const CLIENT_ID='312738517630-sns0q4jfl7aorg1r9go6cd8nc25etenj.apps.googleusercontent.com';
  const SCOPE='https://www.googleapis.com/auth/drive.readonly';
  const SAVED='flamencoDriveFolder';
  let token='',expires=0,client=null,connecting=false,oauth=null,selected=null,stack=[];
  const allowedMedia=new Map();
  const el=id=>document.getElementById(id);
  const message=text=>{el('driveStatus').textContent=text;};
  function accessToken(){return expires>Date.now()?token:'';}
  function saved(){try{return JSON.parse(localStorage.getItem(SAVED));}catch{return null;}}
  function resetSession(){token='';expires=0;allowedMedia.clear();client?.clearCache();}
  async function ensureWorker(){
    if(!navigator.serviceWorker)throw new Error('Este navegador no permite la reproducción directa. Abre el curso en Safari mediante HTTPS.');
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller){
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',done);reject(new Error('Recarga el curso para activar la reproducción de Drive.'));},8000);
        function done(){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',done);resolve();}
        navigator.serviceWorker.addEventListener('controllerchange',done);
      });
    }
    const ready=await new Promise(resolve=>{
      const ch=new MessageChannel(),timer=setTimeout(()=>{ch.port1.close();resolve(false);},4000);
      ch.port1.onmessage=e=>{clearTimeout(timer);ch.port1.close();resolve(e.data?.drive===true);};
      navigator.serviceWorker.controller.postMessage({type:'DRIVE_PING'},[ch.port2]);
    });
    if(!ready)throw new Error('Hay una versión antigua abierta. Recarga el curso para activar Drive.');
  }
  navigator.serviceWorker?.addEventListener('message',event=>{
    const script=new URL('./sw.js',location.href).href;
    if(event.source?.scriptURL!==script)return;
    if(event.data?.type==='DRIVE_MEDIA_ERROR'){scope.onDriveMediaError?.(event.data.fileId,event.data.status);return;}
    if(event.data?.type!=='DRIVE_MEDIA_AUTH'||!event.ports[0])return;
    const meta=allowedMedia.get(event.data.fileId),access=accessToken();
    event.ports[0].postMessage(meta&&access?{token:access,meta}:{});
  });
  async function mediaURL(meta){
    await ensureWorker();
    allowedMedia.set(meta.id,{id:meta.id,size:meta.size,mimeType:meta.mimeType,resourceKey:meta.resourceKey});
    return new URL('./_drive_media/'+encodeURIComponent(meta.id),location.href).href;
  }
  client=new DriveClient({getToken:accessToken,mediaURL});
  function connect(){
    if(connecting)return;
    if(!scope.google?.accounts?.oauth2){message('La conexión de Google todavía no ha cargado. Espera unos segundos y vuelve a pulsar CONECTAR GOOGLE DRIVE.');return;}
    connecting=true;el('driveConnect').disabled=true;message('Elige tu cuenta y autoriza la lectura de Drive en la ventana de Google.');
    // This call stays in the click handler so Safari can open Google's consent popup.
    oauth=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPE,include_granted_scopes:false,
      callback:response=>{
        connecting=false;el('driveConnect').disabled=false;
        if(response.error||!response.access_token){message('No se completó la conexión con Google: '+(response.error||'sin permiso'));return;}
        if(!google.accounts.oauth2.hasGrantedAllScopes(response,SCOPE)){message('Hace falta autorizar la lectura de Drive para abrir GUITARRA.');return;}
        resetSession();token=response.access_token;expires=Date.now()+Math.max(0,Number(response.expires_in||3600)-30)*1000;
        el('driveDisconnect').hidden=false;el('driveChange').hidden=false;
        restoreOrBrowse().catch(report);
      },
      error_callback:error=>{connecting=false;el('driveConnect').disabled=false;message(error.type==='popup_closed'?'Has cerrado la ventana de Google. Puedes volver a conectar.':'Google no pudo abrir la conexión. Abre el curso en Safari y permite la ventana de inicio de sesión.');}
    });
    oauth.requestAccessToken({prompt:'select_account'});
  }
  async function restoreOrBrowse(){
    const previous=saved();
    if(previous?.id){
      message('Recuperando '+previous.name+'…');
      try{
        const meta=await client.metadata(previous.id);
        await choose(meta);return;
      }catch(error){message('No se pudo recuperar la carpeta guardada. Elige GUITARRA de nuevo. '+error.message);}
    }
    await browse();
  }
  function report(error){message(error.message||String(error));el('driveBrowser').hidden=false;}
  async function browse(){
    if(!accessToken()){connect();return;}
    client.clearCache();stack=[];selected=null;el('driveBrowser').hidden=false;el('driveUse').disabled=true;
    message('Buscando la carpeta GUITARRA…');
    const matches=await client.guitarFolders();
    if(matches.length===1){await showFolder(matches[0]);return;}
    if(matches.length){
      el('drivePath').textContent='Elige tu carpeta GUITARRA';renderOptions(matches);message('Hay varias carpetas llamadas GUITARRA. Elige la que contiene tus cursos.');return;
    }
    await showFolder({id:'root',name:'Mi unidad',mimeType:'application/vnd.google-apps.folder'});
  }
  function renderOptions(folders){
    const box=el('driveFolders');box.replaceChildren();
    folders.sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true})).forEach(meta=>{
      const button=document.createElement('button');button.textContent='📁 '+meta.name;
      button.onclick=()=>showFolder(meta,true).catch(report);box.appendChild(button);
    });
    if(!folders.length){const p=document.createElement('p');p.textContent='Esta carpeta no contiene más subcarpetas. Puedes elegirla con USAR ESTA CARPETA.';box.appendChild(p);}
    el('driveBack').disabled=stack.length===0;
  }
  async function showFolder(meta,push=false){
    if(push&&selected)stack.push(selected);
    selected=meta;el('driveUse').disabled=true;message('Leyendo '+meta.name+'…');
    el('drivePath').textContent=[...stack,meta].map(x=>x.name).join(' › ');
    const folders=(await client.children(meta.id)).filter(x=>x.mimeType==='application/vnd.google-apps.folder');
    renderOptions(folders);el('driveUse').disabled=meta.id==='root';message('Abre una subcarpeta o pulsa USAR ESTA CARPETA para cargar sus cursos.');
  }
  async function choose(meta){
    await ensureWorker();
    const dir=client.directory(meta);
    await scope.useDriveRoot(dir);
    localStorage.setItem(SAVED,JSON.stringify({id:meta.id,name:meta.name}));
    selected=meta;el('driveBrowser').hidden=true;
    message('Drive conectado · '+meta.name+'. La carpeta queda recordada. Si Google pide reconectar al volver, pulsa CONECTAR GOOGLE DRIVE.');
  }
  function disconnect(){
    const access=accessToken();resetSession();localStorage.removeItem(SAVED);
    el('driveDisconnect').hidden=true;el('driveChange').hidden=true;el('driveBrowser').hidden=true;
    scope.closeDriveRoot?.();message('Drive desconectado. Tus notas y tu progreso se conservan.');
    if(access&&scope.google?.accounts?.oauth2)google.accounts.oauth2.revoke(access,()=>{});
  }
  el('driveConnect').onclick=connect;
  el('driveChange').onclick=()=>browse().catch(report);
  el('driveUse').onclick=()=>{if(selected){el('driveUse').disabled=true;choose(selected).catch(error=>{el('driveUse').disabled=false;report(error);});}};
  el('driveBack').onclick=()=>{const parent=stack.pop();if(parent)showFolder(parent).catch(report);};
  el('driveBrowseRoot').onclick=()=>{stack=[];showFolder({id:'root',name:'Mi unidad',mimeType:'application/vnd.google-apps.folder'}).catch(report);};
  el('driveDisconnect').onclick=disconnect;
  scope.DriveConnection={connect,client,accessTokenAvailable:()=>Boolean(accessToken()),saved};
  const previous=saved();if(previous)message('Carpeta recordada: '+previous.name+'. Pulsa CONECTAR GOOGLE DRIVE para recuperar el acceso.');
})(globalThis);
