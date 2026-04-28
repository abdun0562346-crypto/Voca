/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Mic, 
  MicOff, 
  Terminal, 
  Layout, 
  Settings, 
  Globe, 
  Cpu, 
  MessageSquare, 
  Command,
  Power,
  Volume2,
  X,
  ExternalLink,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from "@google/genai";

// --- Types & Constants ---

enum SystemStatus {
  READY = 'READY',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  EXECUTING = 'EXECUTING',
  ERROR = 'ERROR'
}

interface LogEntry {
  id: string;
  timestamp: string;
  sender: 'SYSTEM' | 'USER' | 'VOCA';
  message: string;
  type?: 'cmd' | 'info' | 'error' | 'success';
}

interface AppInstance {
  id: string;
  name: string;
  icon: React.ReactNode;
  isOpen: boolean;
}

// --- App Component ---

export default function App() {
  const [status, setStatus] = useState<SystemStatus>(SystemStatus.READY);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [activeApps, setActiveApps] = useState<string[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  
  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }), []);

  // --- Initial Log ---
  useEffect(() => {
    addLog('SYSTEM', 'Initializing Voca OS v1.0.4...', 'info');
    addLog('SYSTEM', 'Kernel loaded. Voice interfaces active.', 'success');
    addLog('VOCA', 'Awaiting voice command. Say "Help" for list of functions.', 'cmd');
  }, []);

  // --- Logging Helper ---
  const addLog = (sender: LogEntry['sender'], message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      sender,
      message,
      type
    }]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // --- Voice Engine Setup ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const current = event.resultIndex;
        const text = event.results[current][0].transcript;
        setTranscript(text);
        if (event.results[current].isFinal) {
          handleCommand(text);
          setTranscript('');
        }
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
        if (status === SystemStatus.LISTENING) setStatus(SystemStatus.READY);
      };

      recognitionRef.current.onerror = (event: any) => {
        addLog('SYSTEM', `Speech engine error: ${event.error}`, 'error');
        setStatus(SystemStatus.ERROR);
      };
    } else {
      addLog('SYSTEM', 'Speech Recognition not supported in this browser.', 'error');
    }
  }, [status]);

  const toggleListening = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setTranscript('');
      setStatus(SystemStatus.LISTENING);
      setIsRecording(true);
      recognitionRef.current?.start();
    }
  };

  // --- AI Command Processor ---
  const handleCommand = async (cmd: string) => {
    if (!cmd.trim()) return;
    addLog('USER', cmd, 'cmd');
    setStatus(SystemStatus.THINKING);

    try {
      const prompt = `You are Voca OS, a technical computer assistant. 
      The user just said: "${cmd}"
      
      Determine the intent. Possible actions:
      - OPEN_APP (terminal, browser, settings, notes, music)
      - CLOSE_APP (app name)
      - SEARCH (query)
      - STATUS (provide system update)
      - CHAT (general conversation)
      - HELP (list commands)
      
      Respond in the voice of a professional OS assistant. If you want to trigger a system action, include it in your response as [ACTION: TYPE: VALUE].
      Keep responses concise and "cyber-themed".`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text || "Command processed.";
      processActions(text);
      addLog('VOCA', text.replace(/\[ACTION:.*\]/g, '').trim(), 'success');
      setStatus(SystemStatus.READY);
    } catch (error) {
      addLog('SYSTEM', "Internal AI failure: Unable to parse intent.", 'error');
      setStatus(SystemStatus.ERROR);
    }
  };

  const processActions = (text: string) => {
    const actionMatch = text.match(/\[ACTION: (.*?): (.*?)\]/);
    if (actionMatch) {
      const [_, type, value] = actionMatch;
      const cleanValue = value.toLowerCase().trim();
      
      if (type === 'OPEN_APP') {
        setActiveApps(prev => prev.includes(cleanValue) ? prev : [...prev, cleanValue]);
        addLog('SYSTEM', `Launching virtual process: ${cleanValue}...`, 'info');
      } else if (type === 'CLOSE_APP') {
        setActiveApps(prev => prev.filter(a => a !== cleanValue));
        addLog('SYSTEM', `Terminating process: ${cleanValue}`, 'info');
      }
    }
  };

  const closeApp = (appId: string) => {
    setActiveApps(prev => prev.filter(a => a !== appId));
    addLog('SYSTEM', `Manually closed: ${appId}`, 'info');
  };

  // --- Render Helpers ---

  const appMeta: Record<string, { name: string, icon: any, color: string }> = {
    terminal: { name: 'Terminal v1.0', icon: <Terminal size={20} />, color: 'var(--os-accent)' },
    browser: { name: 'Web Core', icon: <Globe size={20} />, color: '#4facfe' },
    settings: { name: 'OS Registry', icon: <Settings size={20} />, color: '#f093fb' },
    notes: { name: 'Memory Bank', icon: <MessageSquare size={20} />, color: '#f6d365' },
    music: { name: 'Audio Synth', icon: <Volume2 size={20} />, color: '#ff0844' },
  };

  return (
    <div className="h-screen w-screen relative flex flex-col font-mono overflow-hidden">
      <div className="os-scanline" />
      
      {/* --- Top Bar --- */}
      <header className="h-10 border-b border-[var(--os-border)] flex items-center justify-between px-4 bg-[var(--os-panel)] z-40">
        <div className="flex items-center gap-3">
          <Cpu className="text-[var(--os-accent)] animate-pulse" size={18} />
          <span className="text-xs font-bold tracking-widest uppercase glow-text">Voca OS // Root</span>
        </div>
        <div className="flex items-center gap-6 text-[10px] text-[var(--os-text-dim)] uppercase tracking-tighter">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${status === SystemStatus.READY ? 'bg-[var(--os-accent)]' : 'bg-yellow-400'} animate-ping`} />
            Status: {status}
          </div>
          <div>CPU usage: 12.4%</div>
          <div>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </header>

      {/* --- Desktop Area --- */}
      <main className="flex-1 relative p-6 overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ 
          backgroundImage: 'radial-gradient(var(--os-accent) 0.5px, transparent 0.5px)',
          backgroundSize: '30px 30px'
        }} />

        {/* Windows / Active Apps */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full auto-rows-max">
          <AnimatePresence>
            {activeApps.map(appId => (
              <motion.div
                key={appId}
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="os-glass rounded-lg shadow-2xl flex flex-col overflow-hidden min-h-[300px]"
                id={`app-${appId}`}
              >
                <div className="h-8 bg-black/40 px-3 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-[var(--os-text-dim)]">
                    <span style={{ color: appMeta[appId]?.color || 'inherit' }}>
                      {appMeta[appId]?.icon}
                    </span>
                    {appMeta[appId]?.name || appId}
                  </div>
                  <button 
                    onClick={() => closeApp(appId)}
                    className="hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex-1 p-4 text-[11px] overflow-auto">
                    {appId === 'terminal' && (
                        <div className="space-y-1">
                            <div className="text-white">voca@root:~$ neofetch</div>
                            <div className="text-[var(--os-accent)]">
                                OS: Voca Virtual Arch x86_64<br/>
                                Kernel: 5.15.0-voca<br/>
                                Uptime: {Math.floor(performance.now() / 60000)} mins<br/>
                                Shell: vsh 5.1<br/>
                                Resolution: {window.innerWidth}x{window.innerHeight}<br/>
                                CPU: Gemini 3-Flash (8) @ 2.400GHz<br/>
                                Memory: 1.2GB / 12GB (10%)
                            </div>
                        </div>
                    )}
                    {appId === 'browser' && (
                        <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-4">
                            < Globe size={48} className="animate-spin-slow" />
                            <p className="text-center font-bold uppercase">Sandbox Web Environment Access restricted to simulated index nodes.</p>
                        </div>
                    )}
                    {appId === 'settings' && (
                        <div className="space-y-4">
                            <div className="p-2 border border-white/10 rounded">
                                <label className="text-[9px] uppercase opacity-50 block mb-1">Voice Sensitivity</label>
                                <div className="h-1 bg-[var(--os-accent)] w-[70%]" />
                            </div>
                            <div className="p-2 border border-white/10 rounded">
                                <label className="text-[9px] uppercase opacity-50 block mb-1">AI Verbosity</label>
                                <div className="h-1 bg-[var(--os-accent)] w-[90%]" />
                            </div>
                            <div className="p-2 border border-white/10 rounded">
                                <label className="text-[9px] uppercase opacity-50 block mb-1">Theme Palette</label>
                                <div className="flex gap-2 mt-1">
                                    <div className="w-4 h-4 rounded-full bg-[#00ff9d]" />
                                    <div className="w-4 h-4 rounded-full bg-[#ff0844]" />
                                    <div className="w-4 h-4 rounded-full bg-[#4facfe]" />
                                </div>
                            </div>
                        </div>
                    )}
                    {!appMeta[appId] && (
                        <div className="flex items-center justify-center h-full opacity-40 italic">
                            Process initialized. No specific UI rendered for this mock module.
                        </div>
                    )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State Desktop Icons */}
        {activeApps.length === 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none opacity-20">
                <Command size={120} className="mx-auto mb-4" />
                <h2 className="text-2xl font-bold uppercase tracking-[1rem]">Standby</h2>
                <p className="mt-2 text-sm">Voca OS is listening for root commands.</p>
            </div>
        )}
      </main>

      {/* --- Footer Console / Mic --- */}
      <footer className="h-48 border-t border-[var(--os-border)] bg-[var(--os-panel)] flex z-50">
        {/* Terminal Log */}
        <div className="flex-1 border-r border-[var(--os-border)] p-3 overflow-auto text-[10px] relative scroll-smooth bg-black/30">
          <div className="sticky top-0 left-0 bg-[var(--os-panel)]/80 backdrop-blur px-2 py-1 mb-2 border border-white/5 rounded text-[8px] uppercase font-bold flex items-center gap-2">
            <Terminal size={10} /> Kernel Log // Output_Buffer
          </div>
          <div className="space-y-1">
            {logs.map(log => (
              <div key={log.id} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-[var(--os-text-dim)] shrink-0">[{log.timestamp}]</span>
                <span className={`font-bold shrink-0 ${
                  log.sender === 'SYSTEM' ? 'text-gray-400' : 
                  log.sender === 'USER' ? 'text-[var(--os-accent)]' : 
                  'text-white'
                }`}>
                  {log.sender}:
                </span>
                <span className={`${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-[var(--os-accent)]' :
                  log.type === 'cmd' ? 'text-blue-400 italic' :
                  'text-[var(--os-text)]'
                }`}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Mic Control */}
        <div className="w-56 flex flex-col items-center justify-center p-4 relative overflow-hidden">
          {isRecording && (
            <div className="absolute inset-0 flex items-center justify-center -z-10">
               <motion.div 
                 initial={{ scale: 0.5, opacity: 0 }}
                 animate={{ scale: [1, 2, 1.5], opacity: [0.1, 0.3, 0.1] }}
                 transition={{ duration: 2, repeat: Infinity }}
                 className="w-32 h-32 bg-[var(--os-accent)] rounded-full blur-2xl"
               />
            </div>
          )}
          
          <div className="mb-2 text-[10px] uppercase font-bold tracking-tighter glow-text">
            {isRecording ? "Listening..." : "Voice Input Offline"}
          </div>

          <button
            id="mic-trigger"
            onClick={toggleListening}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${
                isRecording 
                ? 'bg-red-900/20 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                : 'bg-[var(--os-accent-dim)] border-[var(--os-accent)] text-[var(--os-accent)] shadow-[0_0_20px_rgba(0,255,157,0.2)] hover:scale-110'
            }`}
          >
            {isRecording ? <Mic size={28} /> : <MicOff size={28} />}
          </button>

          <div className="mt-4 text-[9px] text-center text-[var(--os-text-dim)] uppercase max-w-[120px]">
            {transcript || (isRecording ? "Say something..." : "Click to wake")}
          </div>
        </div>
      </footer>

      {/* Global CSS for spin */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
