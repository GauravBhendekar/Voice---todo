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
  AlertCircle
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
            // 👇 UPDATED: Removed '.worklet' from the filename to match the real file
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white">
      <div className="max-w-md mx-auto flex flex-col">

        {/* Header */}
        <header className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-3xl font-extrabold">VoiceTask</h1>
            <p className="text-indigo-400 text-sm flex items-center gap-1">
              <Zap size={14} /> ElevenLabs + Gemini
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-sm font-bold">
              {tasks.length}
            </div>
            <div className={`text-xs px-2 py-1 rounded-full font-medium ${isConnected ? 'bg-green-500/20 text-green-400' :
                isConnecting ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
              }`}>
              {status}
            </div>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start gap-3"
          >
            <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-400 text-sm font-medium">Error</p>
              <p className="text-red-300 text-xs mt-1">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Mic Button */}
        <div className="flex justify-center mb-10 relative">
          {(isConnected || isSpeaking) && (
            <motion.div
              className="absolute inset-0 bg-indigo-500/30 rounded-full blur-xl"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}

          <button
            onClick={toggleSession}
            disabled={isProcessing || isConnecting}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${isConnected ? "bg-indigo-500 shadow-lg shadow-indigo-500/50" :
                isConnecting ? "bg-yellow-500 animate-pulse" :
                  "bg-indigo-600 hover:bg-indigo-500"
              }`}
          >
            {isConnected ? <Mic size={40} /> : <MicOff size={40} />}
          </button>
        </div>

        <p className="text-center text-sm text-slate-400 mb-6">
          {isConnecting ? "Connecting..." :
            isConnected ? (isSpeaking ? "Agent speaking..." : "Listening... Speak now") :
              "Click mic to start"}
        </p>

        {/* Conversation Display */}
        <div className="space-y-4 mb-8 min-h-[120px]">
          {transcript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-600 p-4 rounded-xl text-sm"
            >
              <p className="text-indigo-200 text-xs mb-1">You said:</p>
              <p className="font-medium">"{transcript}"</p>
            </motion.div>
          )}

          {aiResponse && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800 p-4 rounded-xl flex gap-3 items-start"
            >
              {isProcessing ? (
                <Loader2 className="animate-spin flex-shrink-0 text-indigo-400" size={20} />
              ) : (
                <Volume2 className="flex-shrink-0 text-indigo-400" size={20} />
              )}
              <p className="text-sm">{aiResponse}</p>
            </motion.div>
          )}
        </div>

        {/* Tasks List */}
        <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl">
          <h2 className="text-xs text-slate-400 mb-4 uppercase tracking-wide">
            Your Tasks
          </h2>

          <AnimatePresence mode="popLayout">
            {tasks.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-slate-500 text-sm text-center py-8"
              >
                No tasks yet. Tap the mic to add one.
              </motion.p>
            )}

            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                layout
                className="flex items-center gap-3 bg-slate-700/30 hover:bg-slate-700/50 p-3 rounded-xl mb-2 transition-colors"
              >
                <button
                  onClick={() =>
                    setTasks((prev) =>
                      prev.map((t, i) =>
                        i === index ? { ...t, completed: !t.completed } : t
                      )
                    )
                  }
                  className="flex-shrink-0 hover:scale-110 transition-transform"
                >
                  {task.completed ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <Circle className="text-slate-400" size={20} />
                  )}
                </button>

                <span className={`flex-1 text-sm ${task.completed ? "line-through text-slate-500" : "text-slate-200"
                  }`}>
                  {task.text}
                </span>

                <button
                  className="flex-shrink-0 opacity-50 hover:opacity-100 hover:text-red-400 transition-all"
                  onClick={() => setTasks((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}