import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  Mic,
  MicOff,
  CheckCircle,
  Circle,
  Trash2,
  Zap,
  Loader2,
  Volume2,
  AlertCircle,
  Sparkles // Added Sparkles to imports for the UI
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useConversation } from "@elevenlabs/react";

/* ================= CONFIG ================= */
const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
const BACKEND_URL = "http://localhost:5000/api/command";
/* ========================================== */

export default function VoiceTodoApp() {
  const [tasks, setTasks] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  // Refs for preventing duplicate processing
  const isProcessingRef = useRef(false);
  const messageProcessedRef = useRef(new Set());
  const tasksRef = useRef(tasks);

  /* ---------- Load / Save Tasks ---------- */
  useEffect(() => {
    const saved = localStorage.getItem("voiceTasks");
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load tasks:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("voiceTasks", JSON.stringify(tasks));
    tasksRef.current = tasks;
  }, [tasks]);

  /* ---------- Backend Call (Stable Callback) ---------- */
  const sendCommandToBackend = useCallback(async (text, messageId) => {
    if (messageProcessedRef.current.has(messageId)) {
      console.log("⚠️ Message already processed, skipping...");
      return;
    }

    if (isProcessingRef.current) {
      console.log("⚠️ Already processing another command, skipping...");
      return;
    }

    messageProcessedRef.current.add(messageId);
    isProcessingRef.current = true;
    setIsProcessing(true);
    setError("");

    console.log("📤 Sending to backend:", text);

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: text, tasks: tasksRef.current })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      console.log("📥 Backend response:", data);

      setAiResponse(data.feedback || "Okay.");

      // Apply actions
      if (data.action === "add" && data.taskText) {
        setTasks((prev) => [
          ...prev,
          {
            id: Date.now(),
            text: data.taskText,
            completed: false,
            timestamp: new Date().toISOString()
          }
        ]);
      }

      if (data.action === "delete" && Number.isInteger(data.taskIndex)) {
        setTasks((prev) => prev.filter((_, i) => i !== data.taskIndex));
      }

      if (data.action === "complete" && Number.isInteger(data.taskIndex)) {
        setTasks((prev) =>
          prev.map((t, i) =>
            i === data.taskIndex ? { ...t, completed: !t.completed } : t
          )
        );
      }

      if (data.action === "clear") {
        setTasks([]);
      }

    } catch (err) {
      console.error("❌ Backend error:", err);
      const errorMsg = "Backend error. Try again.";
      setAiResponse(errorMsg);
      setError(errorMsg);
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  }, []);

  /* ---------- ElevenLabs Config ---------- */
  const conversationOptions = useMemo(() => ({
    // Connection settings
    connectionDelay: { android: 3000, ios: 0, default: 0 },
    useWakeLock: true,

    onConnect: () => {
      console.log("✅ Connected to ElevenLabs");
      setError("");
      messageProcessedRef.current.clear();
    },
    onDisconnect: () => {
      console.log("❌ Disconnected from ElevenLabs");
      messageProcessedRef.current.clear();
    },
    onMessage: (msg) => {
      const messageId = `${msg.source}-${msg.message}-${Date.now()}`;
      if (msg.source === "user" && msg.message) {
        setTranscript(msg.message);
        sendCommandToBackend(msg.message, messageId);
      }
    },
    onError: (err) => {
      const errorMsg = String(err?.message || err).toLowerCase();
      // Ignore normal cleanup errors
      if (errorMsg.includes("closing") || errorMsg.includes("closed")) return;
      console.error("❌ Error:", err);
      setError(`Connection error: ${err.message || 'Unknown error'}`);
    }
  }), [sendCommandToBackend]);

  const conversation = useConversation(conversationOptions);

  // Extract states
  const { status, isSpeaking } = conversation;
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  /* ---------- Session Control ---------- */
  const toggleSession = async () => {
    try {
      if (isConnected) {
        await conversation.endSession();
      } else {
        await conversation.startSession({
          agentId: AGENT_ID,
          workletPaths: {
            rawAudioProcessor: '/elevenlabs/rawAudioProcessor.js',
            audioConcatProcessor: '/elevenlabs/audioConcatProcessor.js',
          },
        });
      }
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  /* ---------- UI ---------- */
  return (
    // MAIN CONTAINER: Full screen, flexible padding for different devices
    <div className="min-h-screen w-full bg-[#0f172a] text-white relative overflow-hidden selection:bg-indigo-500/30 font-sans">
      
      {/* DECORATIVE BACKGROUND BLOBS (Responsive Positioning) */}
      <div className="absolute top-0 left-[-10%] w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-indigo-600/20 rounded-full blur-[80px] md:blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-[-10%] w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-purple-600/10 rounded-full blur-[80px] md:blur-[120px] pointer-events-none mix-blend-screen" />

      {/* CONTENT WRAPPER */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 md:p-8 lg:p-12">
        
        {/* MAIN GLASS CARD: Max width increased to 5xl for Laptop split-view */}
        <div className="w-full max-w-lg lg:max-w-5xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-white/5 overflow-hidden flex flex-col">
          
          {/* HEADER (Spans full width) */}
          <header className="flex justify-between items-center p-6 md:p-8 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg hidden md:block">
                 <Zap size={20} className="text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-300 via-white to-indigo-300 bg-clip-text text-transparent tracking-tight">
                  VoiceTask
                </h1>
                <p className="text-slate-400 text-xs font-medium mt-0.5 hidden md:block">
                  AI Powered Workspace
                </p>
              </div>
            </div>
            
            {/* Status Pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border backdrop-blur-md transition-all duration-500 ${
              isConnected 
                ? 'bg-green-500/10 border-green-500/20 text-green-400 shadow-[0_0_15px_-3px_rgba(74,222,128,0.2)]' 
                : isConnecting 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                  : 'bg-white/5 border-white/5 text-slate-400'
            }`}>
              <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-current'}`} />
              <span className="text-[10px] md:text-xs font-bold tracking-wide uppercase">{status}</span>
            </div>
          </header>

          {/* MAIN CONTENT GRID (Split view on LG screens) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-white/5">
            
            {/* LEFT COLUMN: INTERACTION (Mic & Transcript) */}
            <div className="p-6 md:p-10 flex flex-col justify-center min-h-[400px]">
              
              {/* Error Banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 flex items-center gap-3"
                  >
                    <AlertCircle className="text-red-400" size={18} />
                    <p className="text-red-200 text-xs">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mic Section */}
              <div className="flex flex-col items-center justify-center flex-1">
                <div className="relative group">
                  {/* Ripple Effects */}
                  {(isConnected || isSpeaking) && (
                    <>
                      <motion.div 
                        className="absolute inset-0 bg-indigo-500/20 rounded-full"
                        animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                      />
                      <motion.div 
                        className="absolute inset-0 bg-indigo-500/20 rounded-full"
                        animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }}
                      />
                    </>
                  )}

                  <button
                    onClick={toggleSession}
                    disabled={isProcessing || isConnecting}
                    className={`relative z-10 w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isConnected 
                        ? "bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] ring-4 ring-indigo-500/30" 
                        : isConnecting 
                          ? "bg-slate-700 animate-pulse" 
                          : "bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 shadow-xl ring-1 ring-white/10"
                    }`}
                  >
                    {isConnected ? <Mic size={40} className="text-white" /> : <MicOff size={40} className="text-slate-400" />}
                  </button>
                </div>
                
                <p className="mt-6 text-sm md:text-base font-medium text-slate-300/80 animate-pulse tracking-wide">
                  {isConnecting ? "Establishing Connection..." : isConnected ? (isSpeaking ? "Agent is speaking..." : "Listening...") : "Tap microphone to start"}
                </p>
              </div>

              {/* Transcript / Chat Area */}
              <div className="mt-8 space-y-3 min-h-[120px] flex flex-col justify-end">
                <AnimatePresence mode="wait">
                  {!transcript && !aiResponse && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="text-center text-slate-500/40 text-sm italic py-4"
                    >
                      Your conversation history will appear here...
                    </motion.div>
                  )}
                  
                  {transcript && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="self-end max-w-[90%]">
                      <div className="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm md:text-base shadow-lg">
                        {transcript}
                      </div>
                      <p className="text-[10px] text-slate-400 text-right mt-1 mr-1">You</p>
                    </motion.div>
                  )}

                  {aiResponse && (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="self-start max-w-[90%]">
                      <div className="bg-white/10 backdrop-blur-md border border-white/5 text-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm text-sm md:text-base shadow-lg flex items-start gap-3">
                        {isProcessing ? <Loader2 className="animate-spin w-4 h-4 mt-1 text-indigo-400 flex-shrink-0"/> : <Sparkles className="w-4 h-4 mt-1 text-indigo-400 flex-shrink-0"/>}
                        <span className="leading-relaxed">{aiResponse}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 ml-1 mt-1">AI Agent</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* RIGHT COLUMN: TASKS (Full height on Desktop) */}
            <div className="bg-black/20 lg:bg-transparent flex flex-col h-full min-h-[300px] lg:min-h-0">
              <div className="p-4 md:p-6 border-b border-white/5 bg-black/10 lg:bg-transparent flex justify-between items-center">
                 <h2 className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <CheckCircle size={14} /> Your Tasks
                 </h2>
                 <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-slate-300 font-mono">{tasks.length}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-2.5">
                <AnimatePresence mode="popLayout">
                  {tasks.length === 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                      className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2"
                    >
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
                        <CheckCircle size={20} className="text-slate-600" />
                      </div>
                      <p>No active tasks.</p>
                      <p className="text-xs text-slate-600">Try saying "Add a task..."</p>
                    </motion.div>
                  )}

                  {tasks.map((task, index) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      layout
                      className="group flex items-start gap-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/30 rounded-xl p-3.5 transition-all duration-200"
                    >
                      <button
                        onClick={() => setTasks((prev) => prev.map((t, i) => i === index ? { ...t, completed: !t.completed } : t))}
                        className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition-all flex-shrink-0 ${
                          task.completed ? "bg-green-500/20 border-green-500 text-green-400" : "border-slate-500 text-transparent hover:border-indigo-400"
                        }`}
                      >
                        <CheckCircle size={12} className={task.completed ? "opacity-100" : "opacity-0"} />
                      </button>

                      <span className={`flex-1 text-sm md:text-base leading-relaxed transition-all ${task.completed ? "line-through text-slate-500" : "text-slate-200"}`}>
                        {task.text}
                      </span>

                      <button
                        onClick={() => setTasks((prev) => prev.filter((_, i) => i !== index))}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all text-slate-500"
                        title="Delete task"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}