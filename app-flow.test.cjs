const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {DriveClient,FOLDER}=require('./drive-client.js');
// Small DOM harness for the application's course logic; this does not emulate Safari.
function harness(saved=new Map()){
 class Element{
  constructor(){this.children=[];this.queries=new Map();this.dataset={};this.style={};this.value='';this.textContent='';this.hidden=false;this.currentTime=0;this.classList={add(){},remove(){},contains(){return false;},toggle(){}};}
  set innerHTML(value){this.html=value;this.children=[];this.queries.clear();}get innerHTML(){return this.html||'';}
  querySelector(selector){if(!this.queries.has(selector))this.queries.set(selector,new Element());return this.queries.get(selector);}
  querySelectorAll(){return this.children;}
  appendChild(child){this.children.push(child);return child;}replaceChildren(){this.children=[];}
  scrollIntoView(){}pause(){}load(){}removeAttribute(){}setAttribute(){}addEventListener(){}play(){return Promise.resolve();}
 }
 const html=fs.readFileSync(__dirname+'/index.html','utf8'),elements=new Map();
 for(const m of html.matchAll(/\bid="([^"]+)"/g))elements.set('#'+m[1],new Element());
 const document={getElementById:id=>elements.get('#'+id)||null,querySelector:s=>elements.get(s)||null,querySelectorAll:()=>[],createElement:()=>new Element(),addEventListener(){},hidden:false};
 const context=vm.createContext({console,document,DriveClient,URL,File,Blob,Response,Request,Headers,MessageChannel,location:{href:'https://example.test/flamenco/'},
  navigator:{},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)},
  indexedDB:{open:()=>{const r={result:{}};queueMicrotask(()=>r.onsuccess?.());return r;}},setTimeout,clearTimeout,setInterval,clearInterval,addEventListener(){}});
 context.window=context;context.globalThis=context;
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(match[1],context);
 return {context,elements,saved,run:code=>vm.runInContext(code,context)};
}
test('Drive course index, duplicate lesson names, saved notes and practice resolve after reloading',async()=>{
 const app=harness();
 const files={
  guitar:{id:'guitar',name:'GUITARRA',mimeType:FOLDER},
  solea:{id:'solea',name:'Soleá',mimeType:FOLDER},rumba:{id:'rumba',name:'Rumba',mimeType:FOLDER},
  a:{id:'a',name:'01.mp4',mimeType:'video/mp4'},b:{id:'b',name:'01.mp4',mimeType:'video/mp4'}
 };
 const children={guitar:[files.solea,files.rumba],solea:[files.a],rumba:[files.b]};
 const api=new DriveClient({getToken:()=> 'test',mediaURL:async meta=>'https://example.test/_drive_media/'+meta.id,
  fetcher:async url=>{const u=new URL(url);if(u.pathname.endsWith('/files')){const q=u.searchParams.get('q');const id=/\('([^']+)' in parents\)/.exec(q)[1];return Response.json({files:children[id]});}return Response.json(files[u.pathname.split('/').pop()]);}});
 app.context.testClient=api;app.context.testRoot=api.directory(files.guitar);
 app.context.DriveConnection={client:api,accessTokenAvailable:()=>true};
 await app.run('useDriveRoot(testRoot)');await app.run('scanAcademy()');
 const index=JSON.parse(app.saved.get('academyIndex:drive:guitar'));assert.equal(index.length,2);assert.equal(index[0].videos,1);
 app.context.course=index.find(x=>x.driveId==='solea');await app.run('openIndexedCourse(course)');
 assert.deepEqual(JSON.parse(app.run('JSON.stringify(path)')),['GUITARRA','Soleá']);
 await app.run('openEntry(entries[0])');
 app.elements.get('#note').value='Practicar lento';app.elements.get('#note').oninput();
 app.elements.get('#progress').value='aprendido';app.elements.get('#progress').onchange();
 assert.equal(JSON.parse(app.saved.get('file:drive:a')).note,'Practicar lento');assert.equal(app.saved.has('file:drive:b'),false);
 await app.run("addToday(currentEntry);buildPracticePlan()");
 assert.equal(app.elements.get('#practicePlan').children.length,1);
 const item=JSON.parse(app.run('JSON.stringify(getToday()[0])'));assert.equal(item.driveId,'a');assert.equal(item.rootId,'guitar');
 app.context.practiceItem=item;assert.equal(await app.run('(async()=> (await resolveToday(practiceItem)).h.id)()'),'a');
 const reloaded=harness(app.saved);reloaded.context.testRoot=api.directory(files.guitar);reloaded.context.DriveConnection={client:api,accessTokenAvailable:()=>true};
 await reloaded.run('useDriveRoot(testRoot)');reloaded.context.practiceItem=item;
 assert.equal(await reloaded.run('(async()=> (await resolveToday(practiceItem)).h.id)()'),'a');
 assert.equal(reloaded.run("data('drive:a').note"),'Practicar lento');assert.equal(reloaded.elements.get('#academyGrid').children.length,2);
});
test('Drive consent is user-initiated and the root bookmark contains no token',async()=>{
 const app=harness();let requested=0,config;const listeners=[];
 const worker={scriptURL:'https://example.test/flamenco/sw.js',postMessage:(msg,ports)=>{if(msg.type==='DRIVE_PING')ports[0].postMessage({drive:true});}};
 app.context.navigator.serviceWorker={controller:worker,register:async()=>{},ready:Promise.resolve(),addEventListener:(event,callback)=>listeners.push(callback)};
 app.context.google={accounts:{oauth2:{initTokenClient:c=>{config=c;return{requestAccessToken:()=>requested++};},hasGrantedAllScopes:()=>true,revoke(){}}}};
 const apiData={id:'guitar',name:'GUITARRA',mimeType:FOLDER};
 app.saved.set('flamencoDriveFolder',JSON.stringify({id:'guitar',name:'GUITARRA'}));
 app.context.fetch=async()=>Response.json(apiData);
 app.context.DriveClient=class extends DriveClient{constructor(options){super({...options,fetcher:app.context.fetch});}};
 vm.runInContext(fs.readFileSync(__dirname+'/drive-ui.js','utf8'),app.context);
 assert.equal(requested,0);app.elements.get('#driveConnect').onclick();assert.equal(requested,1);
 assert.equal(config.scope,'https://www.googleapis.com/auth/drive.readonly');
 // Stub app loading so this test isolates consent and bookmark behavior.
 let didLoad;const loaded=new Promise(resolve=>{didLoad=resolve;});app.context.useDriveRoot=async()=>{didLoad();};
 config.callback({access_token:'private-test-token',expires_in:3600});
 await loaded;await new Promise(r=>setImmediate(r));
 assert(![...app.saved.values()].some(value=>value.includes('private-test-token')));
 assert.deepEqual(JSON.parse(app.saved.get('flamencoDriveFolder')),{id:'guitar',name:'GUITARRA'});
 assert.match(app.elements.get('#driveStatus').textContent,/Drive conectado/);
 const channel=new MessageChannel();const response=new Promise(resolve=>channel.port1.onmessage=e=>{channel.port1.close();resolve(e.data);});
 listeners[0]({source:worker,data:{type:'DRIVE_MEDIA_AUTH',fileId:'unregistered'},ports:[channel.port2]});
 assert.deepEqual(await response,{});
});
test('missing Google response times out, allows retry and ignores a late response',()=>{
 const app=harness();let timeout;const configs=[];
 app.context.setTimeout=fn=>{timeout=fn;return 1;};app.context.clearTimeout=()=>{};
 app.context.google={accounts:{oauth2:{initTokenClient:config=>{configs.push(config);return {requestAccessToken(){}};},hasGrantedAllScopes:()=>true}}};
 vm.runInContext(fs.readFileSync(__dirname+'/drive-ui.js','utf8'),app.context);
 const button=app.elements.get('#driveConnect'),status=app.elements.get('#driveStatus');
 button.onclick();assert.equal(button.disabled,true);assert.match(status.textContent,/Paso 1\/3/);
 timeout();assert.equal(button.disabled,false);assert.match(status.textContent,/no ha devuelto/);
 button.onclick();assert.equal(configs.length,2);
 configs[0].callback({access_token:'late-token'});
 assert.equal(app.context.DriveConnection.accessTokenAvailable(),false);
 assert.equal(button.disabled,true);
 configs[1].error_callback({type:'popup_closed'});assert.equal(button.disabled,false);
});
