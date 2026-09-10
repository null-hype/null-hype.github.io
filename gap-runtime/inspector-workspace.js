// The server publishes completed MCP comparisons to this tab's bounded channel.
// No dependency on Inspector's DOM, fetch implementation, or response rendering.
(() => {
 const params = new URLSearchParams(location.search);
 const owner = params.get('workspaceOrigin');
 const channel = params.get('workspaceChannel');
 if (!owner || !/^[a-f0-9-]{36}$/.test(channel || '') || parent === window) return;
 const seen = new Set();
 let stopped = false;
 async function poll() {
  try {
   const response = await fetch(`/inspector/workspace-results?channel=${encodeURIComponent(channel)}`,{cache:'no-store'});
   if (response.ok) {
    const {events} = await response.json();
    for (const event of events) {
     if (seen.has(event.callId)) continue;
     parent.postMessage({type:'retrospective-evidence-v1',channel,...event},owner);
     seen.add(event.callId);
    }
   }
  } catch {}
  if (!stopped) setTimeout(poll,1000);
 }
 window.addEventListener('pagehide',()=>{stopped=true;});
 poll();
})();
