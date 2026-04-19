'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TOPOLOGIES } from '@/lib/topologies';

export default function Home() {
  const [topology, setTopology] = useState('round-table');
  const initialTop = TOPOLOGIES['round-table'];
  const [globalTask, setGlobalTask] = useState(initialTop.presets[0].globalTask);
  const [maxTurns, setMaxTurns] = useState(initialTop.presets[0].maxTurns);
  const [globalFiles, setGlobalFiles] = useState<File[]>([]);
  const [reflections, setReflections] = useState<Record<string, string[]>>({});
  const [documentNames, setDocumentNames] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);
  
  const getDefaultAgents = (topId: string) => {
    const top = TOPOLOGIES[topId] || TOPOLOGIES['round-table'];
    return top.slots.map((s, idx) => ({ 
      name: s.defaultName, 
      role: s.defaultRole, 
      model: idx === 0 ? 'openai/gpt-4o' : 'openai/gpt-4o-mini', 
      files: [] as File[], 
      roleId: s.roleId 
    }));
  };

  const [agents, setAgents] = useState(getDefaultAgents('round-table'));
  
  const [isDebating, setIsDebating] = useState(false);
  const [messages, setMessages] = useState<{agentId: string, text: string}[]>([]);
  const [isConcluded, setIsConcluded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [injectText, setInjectText] = useState('');
  const [injectFiles, setInjectFiles] = useState<File[]>([]);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [telemetry, setTelemetry] = useState<Record<string, { promptTokens: number, completionTokens: number }>>({});
  const [threadId, setThreadId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '_');

  const agentStyles = [
    { bg: 'bg-[#268bd2]/20 border-[#268bd2]/40', text: 'text-[#268bd2]', accent: '#268bd2' },
    { bg: 'bg-[#859900]/20 border-[#859900]/40', text: 'text-[#859900]', accent: '#859900' },
    { bg: 'bg-[#d33682]/20 border-[#d33682]/40', text: 'text-[#d33682]', accent: '#d33682' },
    { bg: 'bg-[#cb4b16]/20 border-[#cb4b16]/40', text: 'text-[#cb4b16]', accent: '#cb4b16' },
    { bg: 'bg-[#6c71c4]/20 border-[#6c71c4]/40', text: 'text-[#6c71c4]', accent: '#6c71c4' },
    { bg: 'bg-[#b58900]/20 border-[#b58900]/40', text: 'text-[#b58900]', accent: '#b58900' },
  ];

  const getAgentStyle = (agentId: string) => {
    if (agentId === 'System_Synthesizer' || agentId === 'System Synthesizer') {
      return { bg: 'bg-[#2aa198]/20 border-[#2aa198]/40 mx-auto max-w-4xl shadow-lg', text: 'text-[#2aa198]', align: 'mx-auto' };
    }
    if (agentId === 'Debate_Evaluator' || agentId === 'Evaluator' || agentId === 'System Error' || agentId === 'Frontend Error') {
      return { bg: 'bg-[#dc322f]/20 border-[#dc322f]/40', text: 'text-[#dc322f]', align: 'ml-0 mr-auto max-w-[80%]' };
    }
    if (agentId === 'Human_Evaluator' || agentId === 'Human Evaluator') {
      return { bg: 'bg-[#586e75]/20 border-[#586e75]/40 shadow-sm', text: 'text-[#586e75]', align: 'ml-auto mr-0 max-w-[80%]' };
    }
    const idx = agents.findIndex(a => sanitizeName(a.name) === agentId || a.name === agentId || a.name.replace(/ /g, '_') === agentId);
    const styleIdx = idx !== -1 ? idx % agentStyles.length : 0;
    // Alternate sides for even/odd agents to distinguish speakers
    const align = styleIdx % 2 === 0 ? 'mr-auto ml-0' : 'ml-auto mr-0';
    return { ...agentStyles[styleIdx], align: `${align} max-w-[85%]` };
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
      if (isNearBottom || messages.length <= 1) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setShowJumpButton(false);
      } else {
        setShowJumpButton(true);
      }
    }
  }, [messages]);

  const clearSession = () => {
    setThreadId(null);
    setIsDebating(false);
    setMessages([]);
    setTelemetry({});
    setIsConcluded(false);
  };

  const handleTopologyChange = (val: string) => {
    setTopology(val);
    setAgents(getDefaultAgents(val));
    const top = TOPOLOGIES[val];
    if (top && top.presets && top.presets.length > 0) {
      applyPreset(top.presets[0]);
    }
  };

  const applyPreset = (preset: any) => {
    setGlobalTask(preset.globalTask);
    setMaxTurns(preset.maxTurns);
  };

  const connectToStream = async (formData: FormData) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/debate', {
        method: 'POST',
        body: formData,
        signal: abortController.signal
      });

      if (!response.body) throw new Error('No readable stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
          const messageStr = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 2);
          
          if (messageStr.startsWith('data: ')) {
            const data = JSON.parse(messageStr.slice(6));
            if (data.type === 'thread_id') {
            setThreadId(data.threadId);
            if (data.documentNames) setDocumentNames(data.documentNames);
          } else if (data.type === 'message') {
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIdx = newMessages.length - 1;
                if (lastIdx >= 0 && newMessages[lastIdx].agentId === data.agentId) {
                  newMessages[lastIdx] = {
                    ...newMessages[lastIdx],
                    text: newMessages[lastIdx].text + data.chunk
                  };
                } else {
                  newMessages.push({ agentId: data.agentId, text: data.chunk });
                }
                return newMessages;
              });
            } else if (data.type === 'telemetry') {
              setTelemetry(data.telemetry);
            } else if (data.type === 'concluded') {
              setIsConcluded(true);
            } else if (data.type === 'error') {
              setMessages([{ agentId: 'System Error', text: data.error }]);
              setIsConcluded(true);
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('Stream paused by user');
      } else {
        console.error(e);
        setMessages([{ agentId: 'Frontend Error', text: e.message || String(e) }]);
      }
    }
  };

  const startDebate = async () => {
    setIsDebating(true);
    setMessages([]);
    setTelemetry({});
    setIsConcluded(false);
    setIsPaused(false);

    const formData = new FormData();
    formData.append('globalTask', globalTask);
    formData.append('topology', topology);
    formData.append('maxTurns', maxTurns.toString());
    globalFiles.forEach(f => formData.append('globalFiles', f));
    
    formData.append('agents', JSON.stringify(agents.map(a => ({ name: a.name, role: a.role, model: a.model }))));
    agents.forEach((agent, index) => {
      agent.files.forEach(f => {
        formData.append(`agent_${index}_files`, f);
      });
    });

    await connectToStream(formData);
  };

  useEffect(() => {
    if (agents.length > 0) {
      agents.forEach(async (a) => {
        try {
          const res = await fetch(`/api/memory?agentName=${encodeURIComponent(a.name)}`);
          const data = await res.json();
          if (data.reflections) {
            setReflections(prev => ({ ...prev, [a.name]: data.reflections }));
          }
        } catch (e) {
          console.error("Failed to fetch reflections", e);
        }
      });
    }
  }, [agents]);

  const togglePause = async () => {
    if (!threadId) return;

    if (isPaused) {
      // Resume
      setIsPaused(false);
      await fetch(`/api/debate/${threadId}/steer`, {
        method: 'POST',
        body: JSON.stringify({ action: 'resume' }),
        headers: { 'Content-Type': 'application/json' }
      });
      const formData = new FormData();
      formData.append('thread_id', threadId);
      await connectToStream(formData);
    } else {
      // Pause
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setIsPaused(true);
      const fd = new FormData();
      fd.append('action', 'pause');
      await fetch(`/api/debate/${threadId}/steer`, {
        method: 'POST',
        body: fd
      });
    }
  };

  const downloadAuditLog = async () => {
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, telemetry, threadId, globalTask, topology })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debate_audit_${threadId || 'export'}.json`;
      a.click();
    } catch (e) {
      console.error("Failed to download audit log", e);
    }
  };
   const verifyKnowledge = async () => {
     if (globalFiles.length === 0) return;
     setIsVerifying(true);
     setVerificationResult(null);
     try {
       const fd = new FormData();
       globalFiles.forEach(f => fd.append('files', f));
       const res = await fetch('/api/debug/knowledge', {
         method: 'POST',
         body: fd
       });
       const data = await res.json();
       if (data.error) throw new Error(data.error);
       setVerificationResult(data.summary || "No text extracted.");
     } catch (e: any) {
       setVerificationResult("Error: " + e.message);
     } finally {
       setIsVerifying(false);
     }
   };
  const handleInject = async () => {
    if (!threadId || (!injectText.trim() && injectFiles.length === 0)) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsPaused(true); // Temporarily pause

    setMessages(prev => [...prev, { agentId: 'Human Evaluator', text: injectText + (injectFiles.length > 0 ? ` [Attached ${injectFiles.length} files]` : '') }]);

    const fd = new FormData();
    fd.append('action', 'inject');
    if (injectText.trim()) fd.append('message', injectText);
    injectFiles.forEach(f => fd.append('files', f));

    await fetch(`/api/debate/${threadId}/steer`, {
      method: 'POST',
      body: fd
    });
    
    setInjectText('');
    setInjectFiles([]);
    setIsPaused(false);
    
    // Automatically resume
    const formData = new FormData();
    formData.append('thread_id', threadId);
    await connectToStream(formData);
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      if (isNearBottom || messages.length <= 1) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages]);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl font-sans">
      <div className="text-center mb-12 relative">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground animate-pulse">
          Quorum Debate
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">Autonomous Multi-Agent Analysis Platform</p>
      </div>

      {!isDebating ? (
        <div className="space-y-8 relative z-10">
          <Card className="bg-card border-border shadow-xl rounded-xl">
            <CardHeader>
              <CardTitle className="text-xl">Global Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-primary/80 mb-2 block">Debate Topology</label>
                <select 
                  className="w-full bg-background border border-border rounded-md p-2 text-foreground focus:ring-accent"
                  value={topology}
                  onChange={e => handleTopologyChange(e.target.value)}
                >
                  {Object.values(TOPOLOGIES).map(top => (
                    <option key={top.id} value={top.id}>{top.name}</option>
                  ))}
                </select>
                <div className="flex items-center gap-4 w-full sm:w-auto mt-6 mb-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <span className="text-sm font-semibold text-primary/80 whitespace-nowrap">Max Turns (Circuit Breaker):</span>
                  <Input 
                    type="number" 
                    min="1" 
                    max="50" 
                    value={maxTurns} 
                    onChange={e => setMaxTurns(parseInt(e.target.value) || 5)}
                    className="w-20 bg-background border-border h-10 font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-primary/80 mb-2 block">Global Task Description</label>
                <Textarea 
                  className="bg-background border-border focus-visible:ring-accent"
                  placeholder="Enter the global debate topic"
                  value={globalTask}
                  onChange={e => setGlobalTask(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-primary/80 mb-2 block">Global Knowledge Upload</label>
                <Input 
                  type="file" 
                  multiple 
                  className="bg-background border-border file:text-primary file:font-semibold hover:file:bg-primary/10"
                  onChange={e => setGlobalFiles(Array.from(e.target.files || []))}
                />
                <div className="mt-2 flex gap-2 flex-wrap">
                  {globalFiles.map((f, i) => (
                    <Badge key={i} variant="secondary" className="bg-accent/20 text-accent border border-accent/50">{f.name}</Badge>
                  ))}
                </div>
                {globalFiles.length > 0 && (
                  <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={verifyKnowledge} 
                      disabled={isVerifying}
                      className="text-xs font-bold uppercase tracking-widest"
                    >
                      {isVerifying ? '🔍 Verifying...' : '📋 Verify Document Content'}
                    </Button>
                    {verificationResult && (
                      <div className="mt-4 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap max-h-[200px] overflow-y-auto border-l-2 border-primary/30 pl-4 bg-background/50 p-2 rounded">
                        <p className="font-bold text-primary uppercase mb-2">Extraction Diagnostic:</p>
                        {verificationResult}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-xl rounded-xl">
            <CardHeader>
              <CardTitle className="text-xl text-primary">Demo Presets for {TOPOLOGIES[topology]?.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap">
              {TOPOLOGIES[topology]?.presets.map(preset => (
                <Button key={preset.id} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 transition-all" onClick={() => applyPreset(preset)}>
                  {preset.name}
                </Button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Topology Role Slots</h2>
                <p className="text-sm text-muted-foreground">{TOPOLOGIES[topology]?.description}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.map((agent, i) => (
                <Card key={i} className={`border-2 transition-all shadow-sm rounded-xl overflow-hidden ${agentStyles[i % agentStyles.length].bg}`}>
                  <CardHeader className="p-3 border-b border-black/5 flex flex-row items-center gap-3 space-y-0">
                    <img 
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(agent.name)}`} 
                      alt="avatar" 
                      className="w-8 h-8 rounded-full bg-background p-1 border border-black/10"
                    />
                    <div className="flex-1 min-w-0">
                      <Input 
                        value={agent.name} 
                        onChange={(e) => {
                          const newAgents = [...agents];
                          newAgents[i].name = e.target.value;
                          setAgents(newAgents);
                        }}
                        className={`font-bold h-7 bg-transparent border-none p-0 focus-visible:ring-0 text-sm ${agentStyles[i % agentStyles.length].text}`}
                      />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold opacity-70">
                        {TOPOLOGIES[topology]?.slots[i]?.defaultName || "Agent Slot"}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3">
                    <Textarea 
                      value={agent.role} 
                      onChange={(e) => {
                        const newAgents = [...agents];
                        newAgents[i].role = e.target.value;
                        setAgents(newAgents);
                      }}
                      className="min-h-[80px] text-xs resize-none bg-background/50 border-none focus-visible:ring-1 focus-visible:ring-black/10"
                      placeholder="Enter specific behavioral role..."
                    />
                    <div className="flex items-center justify-between">
                      <select
                        className="text-[10px] bg-transparent border border-black/10 rounded px-2 py-1"
                        value={agent.model}
                        onChange={e => {
                          const newAgents = [...agents];
                          newAgents[i].model = e.target.value;
                          setAgents(newAgents);
                        }}
                      >
                        <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                        <option value="openai/gpt-4o">GPT-4o</option>
                        <option value="anthropic/claude-3-sonnet">Claude 3 Sonnet</option>
                        <option value="google/gemini-pro-1.5">Gemini 1.5 Pro</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Button size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-widest uppercase transition-all shadow-lg rounded-xl" onClick={startDebate}>
            Initialize Debate Sequence
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative z-10 animate-in fade-in zoom-in duration-500">
          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-extrabold text-foreground flex items-center gap-4">
                Active Quorum
              </h2>
              <div className="flex gap-2">
                {!isConcluded && (
                  <Button variant="outline" className={`border-accent text-accent hover:bg-accent/10 h-8 text-xs ${isPaused ? 'bg-accent/10' : ''}`} onClick={togglePause}>
                    {isPaused ? '▶ Resume' : '⏸ Pause'}
                  </Button>
                )}
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground h-8 text-xs" onClick={clearSession}>⟲ Reset</Button>
              </div>
            </div>
            <div className="debate-arena h-auto min-h-[400px] max-h-[850px] flex flex-col gap-2 border border-border rounded-xl p-2 bg-card shadow-2xl relative overflow-hidden transition-all duration-500">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-30"></div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar" ref={scrollRef}>
                <div className="space-y-2 pb-4">
                  {messages.map((m, i) => {
                    if (m.agentId === 'System_Synthesizer' || m.agentId === 'System Synthesizer') {
                      return (
                        <div key={i} className="message-bubble p-2 rounded-lg shadow-lg border border-[#2aa198]/20 bg-gradient-to-br from-[#2aa198]/5 to-[#2aa198]/5 my-1 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                          <div className="absolute top-0 left-0 w-full h-1 bg-[#2aa198]"></div>
                          <div className="font-extrabold mb-1 tracking-widest uppercase text-xs text-[#2aa198] flex items-center gap-2 border-b border-[#2aa198]/10 pb-1">
                            <span className="text-base">🏛️</span>
                            Synthesis Report
                          </div>
                          <div className="prose prose-xs sm:prose-sm prose-slate dark:prose-invert max-w-none whitespace-pre-wrap leading-tight text-foreground font-medium prose-headings:mt-1 prose-headings:mb-0.5 prose-p:my-0.5 prose-ul:my-0.5 prose-li:my-0">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                          </div>
                        </div>
                      );
                    }

                    const style = getAgentStyle(m.agentId);

                    return (
                      <div key={i} className={`message-bubble p-2 rounded-lg shadow-sm border transition-all duration-200 ${style.bg} ${style.align} animate-in fade-in slide-in-from-bottom-1 duration-300`}>
                        <div className={`font-bold mb-1 tracking-wide uppercase text-[10px] flex items-center gap-2 ${style.text}`}>
                          <img 
                            src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(m.agentId)}`} 
                            alt="avatar" 
                          className="w-5 h-5 rounded-full bg-background p-0.5 border border-border"
                        />
                        <div className="flex items-center gap-2">
                          <span>{m.agentId.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                      <div className="prose prose-xs sm:prose-sm md:prose-base prose-slate dark:prose-invert max-w-none whitespace-pre-wrap leading-tight text-foreground font-normal prose-headings:my-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.text}
                        </ReactMarkdown>
                      </div>
                    </div>
                  );
                })}
                  
                  {isDebating && !isConcluded && !isPaused && (
                    <div className="flex items-center gap-2 text-muted-foreground p-4 animate-pulse">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-sm font-semibold tracking-widest uppercase ml-2">Agents are synthesizing...</span>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {showJumpButton && (
                <Button 
                  onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent/90 hover:bg-accent text-accent-foreground rounded-full shadow-2xl animate-bounce flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 h-8"
                >
                  ↓ Jump to Newest
                </Button>
              )}
              
              {isConcluded && (
                <div className="mt-4 bg-green-500/10 text-green-700 border border-green-500/30 p-4 rounded-xl text-center font-bold tracking-widest uppercase shadow-sm animate-in slide-in-from-bottom-4 duration-500">
                  Consensus Reached
                </div>
              )}
            </div>
            
            {!isConcluded && (
              <div className="mt-6 flex flex-col sm:flex-row gap-3 bg-card border border-border p-4 rounded-xl shadow-md">
                <Input 
                  className="bg-background border-border focus-visible:ring-accent flex-1"
                  placeholder="Inject an argument, pivot the debate, or provide feedback..."
                  value={injectText}
                  onChange={e => setInjectText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInject()}
                />
                <Input 
                  type="file" 
                  multiple 
                  onChange={e => setInjectFiles(Array.from(e.target.files || []))} 
                  className="file:bg-secondary file:text-secondary-foreground file:border-0 file:rounded-md file:px-2 file:py-1 w-full sm:w-auto"
                />
                <Button onClick={handleInject} className="bg-accent hover:bg-accent/80 text-accent-foreground font-bold shrink-0">Inject & Resume</Button>
              </div>
            )}
          </div>

          {/* Telemetry Dashboard Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-card/50 border-border shadow-xl backdrop-blur-sm sticky top-4">
              <CardHeader className="pb-2 border-b border-border/50">
                <CardTitle className="text-sm font-bold tracking-tighter uppercase text-muted-foreground flex items-center justify-between">
                  <span>📊 Telemetry</span>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">Real-Time</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-6">
                {/* Total Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Tokens</p>
                    <p className="text-xl font-mono font-bold text-foreground">
                      {Object.values(telemetry).reduce((acc, t) => acc + t.promptTokens + t.completionTokens, 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Est. Cost</p>
                    <p className="text-xl font-mono font-bold text-green-500">
                      ${(Object.values(telemetry).reduce((acc, t) => acc + (t.promptTokens * 0.15 + t.completionTokens * 0.6) / 1000000, 0)).toFixed(4)}
                    </p>
                  </div>
                </div>

                {/* Per-Agent Breakdown */}
                <div className="space-y-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest border-b border-border pb-1">Agent Load</p>
                  <div className="space-y-3">
                    {Object.entries(telemetry).map(([agentId, data]) => {
                      const style = getAgentStyle(agentId);
                      const total = data.promptTokens + data.completionTokens;
                      const maxTotal = Math.max(...Object.values(telemetry).map(t => t.promptTokens + t.completionTokens), 1);
                      const percentage = (total / maxTotal) * 100;
                      
                      return (
                        <div key={agentId} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-medium">
                            <span className={style.text}>{agentId}</span>
                            <span className="font-mono">{total.toLocaleString()} tkn</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 ${style.bg.replace('/20', '/60')}`} 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {Object.keys(telemetry).length === 0 && (
                      <p className="text-[10px] text-muted-foreground italic">Awaiting first turn...</p>
                    )}
                  </div>
                </div>

                {/* Knowledge Base Section */}
                <div className="pt-4 border-t border-border space-y-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest border-b border-border pb-1">Knowledge Base</p>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                    {documentNames.map((name, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[9px] text-foreground/80 bg-primary/5 p-1.5 rounded border border-primary/10">
                        <span className="text-primary opacity-60">📄</span>
                        <span className="truncate">{name}</span>
                      </div>
                    ))}
                    {documentNames.length === 0 && (
                      <p className="text-[9px] text-muted-foreground italic pl-2">Using global knowledge...</p>
                    )}
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="pt-4 border-t border-border space-y-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Reasoning Density</span>
                    <span className="text-foreground font-mono font-bold">HIGH</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Context Window</span>
                    <span className="text-foreground font-mono font-bold">4.2%</span>
                  </div>
                </div>


                {/* Export Action */}
                <div className="pt-4 border-t border-border">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-[10px] font-bold uppercase tracking-widest border-dashed border-muted-foreground/30 hover:border-accent hover:text-accent transition-all duration-300"
                    onClick={downloadAuditLog}
                    disabled={messages.length === 0}
                  >
                    📥 Export Session Audit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
