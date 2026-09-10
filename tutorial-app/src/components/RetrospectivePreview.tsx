import { useEffect, useState } from 'react';
import tutorialStore from 'tutorialkit:store';
import { webcontainer } from 'tutorialkit:core';
import { evidenceFiles } from '../lib/retrospectiveWorkspace.mjs';

export default function RetrospectivePreview() {
 const endpoint = import.meta.env.PUBLIC_RETRO_RUNTIME_URL || (import.meta.env.DEV
  ? 'http://localhost:8812' : 'https://retrospective-mcp.tidelands.dev');
 const inspector = `${endpoint}/inspector/?autoConnect=${encodeURIComponent(`${endpoint}/mcp`)}&tab=tools`;
 const [status, setStatus] = useState('Run a comparison in Live Preview to add evidence files.');
 useEffect(() => {
  const channel = crypto.randomUUID();
  let active = true;
  let queue = Promise.resolve();
  const seen = new Set<string>();
  const frame = () => document.querySelector<HTMLIFrameElement>('#previews-container iframe[title="Live Preview — Investigation"]');
  function connect() {
   const iframe = frame();
   if (!iframe?.src) return;
   const mcp = `${endpoint}/mcp?workspaceChannel=${channel}`;
   const url = `${endpoint}/inspector/?autoConnect=${encodeURIComponent(mcp)}&tab=tools&workspaceOrigin=${encodeURIComponent(location.origin)}&workspaceChannel=${channel}`;
   if (iframe.src === url) return;
   // Navigate from the tutorial origin. Redirecting from the WebContainer's
   // public origin to a loopback development server is blocked by browsers.
   iframe.src = url;
  }
  function receive(event: MessageEvent) {
   if (event.source !== frame()?.contentWindow) return;
   if (event.origin !== endpoint || event.data?.type !== 'retrospective-evidence-v1' ||
       event.data.channel !== channel || typeof event.data.callId !== 'string' || seen.has(event.data.callId)) return;
   seen.add(event.data.callId);
   const result = event.data.result;
   queue = queue.then(async () => {
    if (!active) return;
    const run = crypto.randomUUID();
    const files = evidenceFiles(result, run);
    const container = await webcontainer;
    for (const [path, content] of Object.entries(files)) {
     if (!active) return;
     if (tutorialStore.documents.get()[path]) throw new Error('Evidence destination already exists');
     await container.fs.mkdir(path.slice(0,path.lastIndexOf('/')), {recursive:true});
     await tutorialStore.addFile(path);
     if (!active) return;
     tutorialStore.updateFile(path, content as string);
    }
    tutorialStore.setSelectedFile(`/evidence/${run}/comparison.json`);
    setStatus(`Added ${result.changes.length} change metadata file(s) and comparison.json. Your plan is unchanged.`);
   }).catch(error => { if (active) setStatus(`Evidence could not be added: ${error.message}`); });
  }
  window.addEventListener('message', receive);
  const timer = setInterval(connect, 750);
  return () => { active = false; clearInterval(timer); window.removeEventListener('message', receive); };
 }, [endpoint]);
 return <section aria-label="Evidence workspace">
  <p role="status">{status}</p>
  <p><a href={inspector} target="_blank" rel="noreferrer">Sign in / open investigation</a></p>
  <p>After signing in, use the reload button in Live Preview. Run tools inside that pane to add evidence to this editor.</p>
 </section>;
}
