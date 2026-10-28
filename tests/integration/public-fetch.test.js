import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {fetchPublicJson} from '../../scripts/data/public-fetch.mjs';
test('truncated body is retried and a later valid response is returned',async()=>{
 let calls=0;
 const server=createServer((req,res)=>{calls++;if(calls<3){res.writeHead(200,{'Content-Length':'100'});res.write('{');res.destroy();}else res.end('{"date":"2026-10-28"}');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const result=await fetchPublicJson(`http://127.0.0.1:${server.address().port}`,{delayMs:1});assert.equal(result.date,'2026-10-28');assert.equal(calls,3);}finally{await new Promise(r=>server.close(r));}
});
test('HTTP failures stop at the retry limit',async()=>{
 let calls=0;const server=createServer((req,res)=>{calls++;res.writeHead(503);res.end('unavailable');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{await assert.rejects(()=>fetchPublicJson(`http://127.0.0.1:${server.address().port}`,{delayMs:1}),/503/);assert.equal(calls,3);}finally{await new Promise(r=>server.close(r));}
});
