// Local-only smoke verification: never contact production or any external API.
const originalFetch=globalThis.fetch;
globalThis.fetch=function(input,init){
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('External API disabled in local smoke check');
 return originalFetch(input,init);
};
