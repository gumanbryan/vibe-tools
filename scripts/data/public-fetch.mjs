import {setTimeout as pause} from 'node:timers/promises';
// Retry the entire body read as well as the connection: truncated JSON was the failure.
export async function fetchPublicJson(url,{attempts=3,timeoutMs=30000,delayMs=500}={}){
 let last;
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(timeoutMs)});
   if(!response.ok){await response.body?.cancel();throw Error(`HTTP ${response.status}`);}
   return await response.json();
  }catch(error){last=error;if(attempt+1<attempts)await pause(delayMs*2**attempt);}
 }
 throw last??Error('No fetch attempts');
}
