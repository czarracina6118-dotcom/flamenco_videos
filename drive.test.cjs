const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DriveClient,FOLDER}=require('./drive-client.js');
const {serveDriveMedia,contentRange}=require('./drive-media.js');
const folder=(id,name)=>({id,name,mimeType:FOLDER});
const video=(id,name)=>({id,name,mimeType:'video/mp4',size:'1000',capabilities:{canDownload:true}});
test('Drive walks paginated nested courses without downloading video bytes',async()=>{
 const calls=[];
 const api=new DriveClient({getToken:()=> 'test-token',mediaURL:m=>'https://example.test/_drive_media/'+m.id,
  fetcher:async(url,options)=>{
   calls.push({url,options});const u=new URL(url),q=u.searchParams.get('q');
   assert.equal(options.headers.Authorization,'Bearer test-token');
   assert(!u.searchParams.has('alt'));assert(!url.includes('test-token'));
   if(q?.includes("'guitar' in parents"))return Response.json({files:[folder('solea','Soleá'),folder('rumba','Rumba')]});
   if(q?.includes("'solea' in parents"))return Response.json(u.searchParams.has('pageToken')?{files:[video('lesson2','02.mp4')]}:{files:[video('lesson1','01.mp4')],nextPageToken:'next'});
   if(q?.includes("'rumba' in parents"))return Response.json({files:[video('lesson3','01.mp4')]});
   throw new Error('Unexpected API request');
  }});
 const root=api.directory(folder('guitar','GUITARRA'));
 const dirs=[];for await(const [name,h] of root.entries())dirs.push(h);
 const solea=await root.getDirectoryHandle('Soleá');assert.deepEqual(solea.parts,['GUITARRA','Soleá']);
 const lessons=[];for await(const [name,h] of solea.entries())lessons.push(h);
 assert.equal(lessons.length,2);
 const rumba=await root.getDirectoryHandle('Rumba');const sameName=await rumba.getFileHandle('01.mp4');
 assert.notEqual(sameName.id,lessons[0].id);
 assert.equal(await lessons[0].getMediaURL(),'https://example.test/_drive_media/lesson1');
 assert.equal(calls.length,4);
});
test('Drive reports expired sessions and failed reads instead of caching empty folders',async()=>{
 let token='',attempt=0;
 const api=new DriveClient({getToken:()=>token,fetcher:async()=>{attempt++;return attempt===1?new Response('{}',{status:401}):Response.json({files:[]});}});
 await assert.rejects(api.children('guitar'),/caducado/);assert.equal(attempt,0);
 token='test';await assert.rejects(api.children('guitar'),/caducado/);
 assert.deepEqual(await api.children('guitar'),[]);assert.equal(attempt,2);
});
test('Drive does not silently select one of two identically named folders',async()=>{
 const api=new DriveClient({getToken:()=> 'test',fetcher:async()=>Response.json({files:[folder('a','Curso'),folder('b','Curso')]})});
 await assert.rejects(api.directory(folder('g','GUITARRA')).getDirectoryHandle('Curso'),/identificar/);
});
test('Drive respects a file owner download restriction',async()=>{
 let played=false;const api=new DriveClient({getToken:()=> 'test',mediaURL:async()=>{played=true;}});
 const denied={...video('restricted','01.mp4'),capabilities:{canDownload:false}};
 await assert.rejects(api.file(denied).getMediaURL(),/no permite/);assert.equal(played,false);
});
test('the media bridge obtains authorization from the requesting page with a MessageChannel',async()=>{
 const response=await serveDriveMedia(new Request('https://example.test/_drive_media/lesson1'),{
  clientId:'page',clients:{get:async id=>{assert.equal(id,'page');return {postMessage:(message,ports)=>{
   assert.equal(message.type,'DRIVE_MEDIA_AUTH');assert.equal(message.fileId,'lesson1');
   ports[0].postMessage({token:'memory-only',meta:video('lesson1','01.mp4')});ports[0].close();
  }};}},fetcher:async(url,options)=>{assert.equal(options.headers.get('Authorization'),'Bearer memory-only');return new Response('media');}
 });assert.equal(response.status,200);assert.equal(await response.text(),'media');
});
test('media forwards Range and private authorization, streams the response, and excludes tokens from URLs',async()=>{
 let requestURL,requestOptions;
 const auth={token:'test-token',meta:{id:'lesson1',size:'1000',mimeType:'video/mp4',resourceKey:'resource'}};
 const response=await serveDriveMedia(new Request('https://example.test/course/_drive_media/lesson1',{headers:{Range:'bytes=10-12'}}),{
  clientId:'client',clients:{},authorize:async()=>auth,
  fetcher:async(url,options)=>{requestURL=url;requestOptions=options;return new Response(new Uint8Array([1,2,3]),{status:206,headers:{'Content-Length':'3'}});}
 });
 assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),'bytes 10-12/1000');
 assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('Content-Type'),'video/mp4');
 assert.equal(requestOptions.headers.get('Authorization'),'Bearer test-token');assert.equal(requestOptions.headers.get('Range'),'bytes=10-12');
 assert.equal(requestOptions.headers.get('X-Goog-Drive-Resource-Keys'),'lesson1/resource');assert(!requestURL.includes('test-token'));
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);
});
test('media denies unregistered files without contacting Drive',async()=>{
 let fetched=false;
 const response=await serveDriveMedia(new Request('https://example.test/_drive_media/other'),{
  clientId:'client',clients:{},authorize:async()=>null,fetcher:async()=>{fetched=true;}
 });assert.equal(response.status,401);assert.equal(fetched,false);
});
test('media does not substitute HTML or successful empty data for authorization failures',async()=>{
 const notices=[];
 const response=await serveDriveMedia(new Request('https://example.test/_drive_media/lesson1'),{
  clientId:'client',clients:{get:async()=>({postMessage:m=>notices.push(m)})},
  authorize:async()=>({token:'test',meta:video('lesson1','01.mp4')}),fetcher:async()=>new Response('private upstream error',{status:401})
 });assert.equal(response.status,401);assert.equal(response.headers.get('Cache-Control'),'no-store');assert(!((await response.text()).includes('private upstream error')));assert.equal(notices[0].status,401);
});
test('Safari range header reconstruction handles suffixes, open ends and invalid ranges',()=>{
 assert.equal(contentRange('bytes=0-1','1000','2'),'bytes 0-1/1000');
 assert.equal(contentRange('bytes=900-','1000','100'),'bytes 900-999/1000');
 assert.equal(contentRange('bytes=-10','1000','10'),'bytes 990-999/1000');
 assert.equal(contentRange('bytes=1000-2000','1000',''),null);
});
test('browser fetch keeps its Window receiver when the Drive client calls it',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const browser={URL,Map,Date,fetch:function(url,options){
  assert.equal(this,browser.window,'fetch must be called on Window');
  assert.equal(options.headers.Authorization,'Bearer test-token');
  return Promise.resolve(Response.json({files:[folder('guitar','GUITARRA')]}));
 }};
 const context=vm.createContext(browser);browser.window=vm.runInContext('globalThis',context);
 vm.runInContext(fs.readFileSync(__dirname+'/drive-client.js','utf8'),context);
 const client=new browser.DriveClient({getToken:()=> 'test-token'});
 const matches=await client.guitarFolders();assert.equal(matches[0].id,'guitar');
});
