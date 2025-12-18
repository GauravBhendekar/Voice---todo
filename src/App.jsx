
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Mic,
  MicOff,
  CheckCircle,
  Circle,
  Loader2,
  Trash2,
  Zap,
  AlertTriangle,
  Volume2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ================= CONFIG ================= */
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel (can change)
/* ========================================== */

export default function VoiceTodoApp() {
  const [tasks, setTasks] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const tasksRef = useRef([]);
  const recognitionRef = useRef(null);
  const isGeminiBusyRef = useRef(false);

  /* ---------- Load Tasks ---------- */
  useEffect(() => {
    const stored = localStorage.getItem("voiceTasks");
    if (stored) {
      const parsed = JSON.parse(stored);
      setTasks(parsed);
      tasksRef.current = parsed;
    }
  }, []);

  /* ---------- Save Tasks ---------- */
  useEffect(() => {
    localStorage.setItem("voiceTasks", JSON.stringify(tasks));
    tasksRef.current = tasks;
  }, [tasks]);

  /* ---------- ElevenLabs TTS ---------- */
  const speak = async (text) => {
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.7
            }
          })
        }
      );

      const audioBlob = await res.blob();
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.play();
    } catch (e) {
      console.error("TTS error", e);
    }
  };

  /* ---------- Web Speech API ---------- */
  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported");
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

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      processVoiceCommand(text);
    };

    recognition.onend = () => setIsListening(false);

    recognition.onerror = () => {
      setIsListening(false);
      setTranscript("Mic error");
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  /* ---------- Gemini Processing ---------- */
  const processVoiceCommand = useCallback(async (command) => {
    if (!GEMINI_API_KEY) return;
    if (isGeminiBusyRef.current) return;

    isGeminiBusyRef.current = true;
    setIsProcessing(true);

    const prompt = `
You are an intelligent to-do assistant.

Current tasks:
${JSON.stringify(tasksRef.current)}

User command:
"${command}"

Rules:
- If task is physically or logically impossible, DO NOT add it.
- Explain why and suggest a realistic alternative.
- ONLY add task if it is feasible.

Return ONLY valid JSON:
{
  "action": "add | delete | complete | clear | impossible | unknown",
  "taskText": "",
  "taskIndex": 0,
  "feedback": "",
  "suggestedTask": ""
}
`;

    try {
      let res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
          })
        }
      );

      if (res.status === 429) {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }]
            })
          }
        );
      }

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const result = JSON.parse(raw.replace(/```json|```/g, ""));

      setAiResponse(result.feedback);
      speak(result.feedback);

      const idx =
        typeof result.taskIndex === "number" ? result.taskIndex : null;

      switch (result.action) {
        case "add":
          if (result.taskText) {
            setTasks((p) => [
              ...p,
              { id: Date.now(), text: result.taskText, completed: false }
            ]);
            speak("Task added successfully.");
          }
          break;

        case "impossible":
          if (result.suggestedTask) {
            speak(`You could try: ${result.suggestedTask}`);
          }
          break;

        case "delete":
          if (idx !== null) {
            setTasks((p) => p.filter((_, i) => i !== idx));
          }
          break;

        case "complete":
          if (idx !== null) {
            setTasks((p) =>
              p.map((t, i) =>
                i === idx ? { ...t, completed: !t.completed } : t
              )
            );
          }
          break;

        case "clear":
          setTasks([]);
          break;
      }
    } catch (e) {
      setAiResponse("Something went wrong.");
      speak("Please try again.");
    } finally {
      setIsProcessing(false);
      isGeminiBusyRef.current = false;
    }
  }, []);
  /* 🟢 PASTE THIS OVER YOUR EXISTING return (...) BLOCK */
 
  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white">
      <div className="max-w-3xl mx-auto">

        <header className="flex justify-between mb-8">
          <h1 className="text-3xl font-bold flex gap-2">
            VoiceTask Flash <Zap />
          </h1>
        </header>

        {/* MIC */}
        <div className="flex justify-center mb-6">
          <button
            onClick={startListening}
            className={`w-24 h-24 rounded-full flex items-center justify-center ${
              isListening ? "bg-red-500 animate-pulse" : "bg-indigo-600"
            }`}
          >
            {isListening ? <Mic /> : <MicOff />}
          </button>
        </div>

        {/* TRANSCRIPT */}
        <div className="bg-white/5 p-6 rounded-xl mb-6">
          <p className="text-sm text-yellow-400">You said:</p>
          <p>{transcript || "Waiting..."}</p>
          <div className="mt-3 flex gap-2 items-center">
            {isProcessing ? <Loader2 className="animate-spin" /> : <Volume2 />}
            <p>{aiResponse || "Ready."}</p>
          </div>
        </div>

        {/* TASKS */}
        <div className="bg-white/5 p-6 rounded-xl">
          <h2 className="mb-4 font-bold">Tasks ({tasks.length})</h2>

          <AnimatePresence>
            {tasks.map((t, i) => (
              <motion.div
                key={t.id}
                layout
                className="flex items-center gap-4 p-4 mb-3 bg-white/10 rounded-xl"
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
                <p className={t.completed ? "line-through" : ""}>{t.text}</p>
                <button
                  onClick={() =>
                    setTasks((p) => p.filter((_, j) => j !== i))
                  }
                  className="ml-auto"
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
