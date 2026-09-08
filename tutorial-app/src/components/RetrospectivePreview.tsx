import { useState } from 'react';

export default function RetrospectivePreview() {
 const endpoint = import.meta.env.PUBLIC_RETRO_RUNTIME_URL || 'http://localhost:8812';
 const inspector = `${endpoint}/inspector/?autoConnect=${encodeURIComponent(`${endpoint}/mcp`)}&tab=tools`;
 const [generation, setGeneration] = useState(0);
 return <section aria-label="Retrospective investigation" style={{marginTop:'1.5rem'}}>
  <p><a href={inspector} target="_blank" rel="noreferrer">Sign in / open investigation</a>{' · '}
   <button onClick={() => setGeneration(g => g + 1)}>Reload preview</button></p>
  <p>The preview contains the real MCP Inspector. Choose <code>inspectSnapshotPair</code>, select a snapshot pair, and start with category <code>all</code>.</p>
  <iframe key={generation} title="Embedded retrospective MCP Inspector" src={inspector}
   style={{width:'100%',height:'760px',border:'1px solid #64748b',borderRadius:'8px',background:'#fff'}} />
 </section>;
}
