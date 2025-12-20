


import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  CheckCircle,
  Circle,
  Trash2,
  Zap,
  Loader2,
  Volume2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function VoiceTodoApp() {
  const [tasks, setTasks] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef(null);

  /* ---------- Load / Save Tasks ---------- */
  useEffect(() => {
    const stored = localStorage.getItem("voiceTasks");
    if (stored) setTasks(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem("voiceTasks", JSON.stringify(tasks));
  }, [tasks]);

  /* ---------- Speech Recognition ---------- */
  const startListening = () => {
    if (isListening || isProcessing) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported. Use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("Listening...");
    };

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      sendCommandToBackend(text);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  /* ---------- Backend Call ---------- */
  const sendCommandToBackend = async (command) => {
    setIsProcessing(true);

    try {
      const res = await fetch("http://localhost:5000/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, tasks })
      });

      const data = await res.json();

      setAiResponse(data.feedback || "Okay.");

      // 🔊 Audio from backend
      // if (data.audio) {
      //   const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
      //   audio.play();
      // }

      if (data.audio && data.audio.length > 1000) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audio.volume = 1;
        audio.play().catch(() => {
          console.warn("Autoplay blocked");
        });
      }


      // 🧠 Apply actions SAFELY
      if (data.action === "add" && data.taskText) {
        setTasks((p) => [
          ...p,
          { id: Date.now(), text: data.taskText, completed: false }
        ]);
      }

      if (data.action === "delete" && Number.isInteger(data.taskIndex)) {
        setTasks((p) => p.filter((_, i) => i !== data.taskIndex));
      }

      if (data.action === "complete" && Number.isInteger(data.taskIndex)) {
        setTasks((p) =>
          p.map((t, i) =>
            i === data.taskIndex ? { ...t, completed: !t.completed } : t
          )
        );
      }

      if (data.action === "clear") {
        setTasks([]);
      }
    } catch (err) {
      setAiResponse("Backend error. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white">
      <div className="max-w-md mx-auto flex flex-col">

        {/* Header */}
        <header className="flex justify-between mb-10">
          <div>
            <h1 className="text-3xl font-extrabold">VoiceTask</h1>
            <p className="text-indigo-400 text-sm flex items-center gap-1">
              <Zap size={14} /> Gemini 2.5 Flash
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
            {tasks.length}
          </div>
        </header>

        {/* Mic */}
        <div className="flex justify-center mb-10 relative">
          {isListening && (
            <div className="absolute inset-0 bg-indigo-500/30 rounded-full animate-ping blur-xl" />
          )}
          <button
            onClick={startListening}
            disabled={isProcessing}
            className={`w-28 h-28 rounded-full flex items-center justify-center transition ${isListening ? "bg-indigo-500" : "bg-indigo-600"
              }`}
          >
            {isListening ? <Mic /> : <MicOff />}
          </button>
        </div>

        {/* Conversation */}
        <div className="space-y-4 mb-8">
          {transcript && (
            <div className="bg-indigo-600 p-4 rounded-xl text-sm">
              "{transcript}"
            </div>
          )}

          {aiResponse && (
            <div className="bg-slate-800 p-4 rounded-xl flex gap-2 items-start">
              {isProcessing ? <Loader2 className="animate-spin" /> : <Volume2 />}
              <p>{aiResponse}</p>
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-slate-800/50 p-6 rounded-2xl">
          <h2 className="text-xs text-slate-400 mb-4">YOUR TASKS</h2>

          <AnimatePresence>
            {tasks.length === 0 && (
              <p className="text-slate-500 text-sm text-center">
                No tasks yet. Tap the mic.
              </p>
            )}

            {tasks.map((t, i) => (
              <motion.div
                key={t.id}
                layout
                className="flex items-center gap-3 bg-slate-700/30 p-3 rounded-xl mb-2"
              >
                <button
                  onClick={() =>
                    setTasks((p) =>
                      p.map((x, j) =>
                        j === i ? { ...x, completed: !x.completed } : x
                      )
                    )
                  }
                >
                  {t.completed ? <CheckCircle /> : <Circle />}
                </button>

                <span className={t.completed ? "line-through" : ""}>
                  {t.text}
                </span>

                <button
                  className="ml-auto"
                  onClick={() =>
                    setTasks((p) => p.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
