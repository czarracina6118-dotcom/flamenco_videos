const {test}=require('node:test');
const assert=require('node:assert/strict');
const {selectedFilesTree}=require('./selected-files.js');
function video(name,webkitRelativePath=''){return {name,webkitRelativePath};}
test('nested courses keep repeated lesson names in their own folders',async()=>{
 const solea=video('01.mp4','GUITARRA/Soleá/Básico/01.mp4');
 const rumba=video('01.mp4','GUITARRA/Rumba/01.mp4');
 const root=selectedFilesTree([solea,rumba]);
 assert.equal(root.name,'GUITARRA');
 const basic=await(await root.getDirectoryHandle('Soleá')).getDirectoryHandle('Básico');
 assert.equal(await(await basic.getFileHandle('01.mp4')).getFile(),solea);
 const other=await root.getDirectoryHandle('Rumba');
 assert.equal(await(await other.getFileHandle('01.mp4')).getFile(),rumba);
 const listed=[];for await(const [name,h] of root.entries())listed.push([name,h.kind]);
 assert.deepEqual(listed,[['Soleá','directory'],['Rumba','directory']]);
 await assert.rejects(root.getFileHandle('01.mp4'));
 await assert.rejects(root.getDirectoryHandle('Ausente'));
});
test('individual files can be reopened without copying video contents',async()=>{
 const a=video('falseta.mp4'),b=video('acordes.pdf');
 const root=selectedFilesTree([a,b]);assert.equal(root.name,'Mis vídeos');
 assert.equal(await(await root.getFileHandle(a.name)).getFile(),a);
 assert.equal(await(await root.getFileHandle(b.name)).getFile(),b);
 await assert.rejects(root.getDirectoryHandle(a.name));
});
test('empty selection is safe',async()=>{
 const root=selectedFilesTree([]);let n=0;for await(const item of root.entries())n++;
 assert.equal(n,0);
});
