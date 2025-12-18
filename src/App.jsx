// import React, { useState, useEffect, useCallback } from 'react';
// import { Mic, MicOff, CheckCircle, Circle, AlertCircle } from 'lucide-react';
// // 1. Import the Hook, not a Component
// import { useConversation } from '@elevenlabs/react';

// // CONFIGURATION
// const GEMINI_API_KEY = "AIzaSyBHBz1OI0eCceNxiZWxCkuD-BAfRWHJ6VA11"; // REPLACE THIS
// const ELEVENLABS_AGENT_ID = "agent_4901kcjzx7yhevfvw94dy1kmne611f"; // REPLACE THIS

// export default function VoiceTodoApp() {
//   const [tasks, setTasks] = useState([]);
//   const [transcript, setTranscript] = useState('');
//   const [response, setResponse] = useState('');
//   const [isProcessing, setIsProcessing] = useState(false);

//   // 2. Setup the ElevenLabs Hook
//   const conversation = useConversation({
//     onConnect: () => console.log("Connected to ElevenLabs"),
//     onDisconnect: () => console.log("Disconnected from ElevenLabs"),
//     onMessage: (message) => {
//       // If the message comes from the user (transcription)
//       if (message.source === 'user') {
//         setTranscript(message.message);
//         processVoiceCommand(message.message);
//       }
//       // If the message comes from the AI
//       if (message.source === 'ai') {
//         console.log("AI Speaking:", message.message);
//       }
//     },
//     onError: (error) => console.error('ElevenLabs Error:', error),
//   });

//   const { status, startSession, endSession } = conversation;
//   const isConnected = status === 'connected';

//   // Load tasks
//   useEffect(() => {
//     try {
//       const stored = localStorage.getItem('voiceTasks');
//       if (stored) setTasks(JSON.parse(stored));
//     } catch (e) { console.error(e); }
//   }, []);

//   // Save tasks
//   useEffect(() => {
//     localStorage.setItem('voiceTasks', JSON.stringify(tasks));
//   }, [tasks]);

//   const processVoiceCommand = async (command) => {
//     if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") return;

//     setIsProcessing(true);
//     try {
//       const systemPrompt = `
//         You are a smart to-do list assistant. 
//         Current tasks: ${JSON.stringify(tasks)}
//         User Command: "${command}"

//         Analyze action: 1.ADD, 2.LIST, 3.DELETE, 4.COMPLETE, 5.CLEAR
//         Respond with JSON only:
//         {
//           "action": "add|list|delete|complete|clear|unknown",
//           "taskText": "description",
//           "taskIndex": number,
//           "isLogical": boolean,
//           "feedback": "Conversational response"
//         }
//       `;

//       const geminiReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
//       });

//       const data = await geminiReq.json();
//       const rawText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
//       const result = JSON.parse(rawText);

//       setResponse(result.feedback);

//       // Execute Logic
//       switch (result.action) {
//         case 'add':
//           if (result.isLogical) setTasks(prev => [...prev, { id: Date.now(), text: result.taskText, completed: false, timestamp: new Date().toISOString() }]);
//           break;
//         case 'delete':
//           if (result.taskIndex >= 0) setTasks(prev => prev.filter((_, i) => i !== result.taskIndex));
//           break;
//         case 'complete':
//           if (result.taskIndex >= 0) setTasks(prev => prev.map((t, i) => i === result.taskIndex ? { ...t, completed: true } : t));
//           break;
//         case 'clear':
//           setTasks([]);
//           break;
//       }

//       // Note: Typically you can't force the ElevenLabs Agent to say *this* specific specific text 
//       // unless you are using a custom tool. The agent usually generates its own reply.

//     } catch (error) {
//       console.error('Gemini Error:', error);
//       setResponse("Sorry, error processing command.");
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   const toggleConversation = async () => {
//     if (isConnected) {
//       await endSession();
//     } else {
//       await startSession({ agentId: ELEVENLABS_AGENT_ID });
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 p-6 font-sans">
//       <div className="max-w-2xl mx-auto">
//         <div className="text-center mb-8">
//           <h1 className="text-4xl font-bold text-white mb-2">🎙️ Voice To-Do Assistant</h1>
//           <p className="text-blue-100">ElevenLabs Agent + Google Gemini</p>
//         </div>

//         {/* Control Button (Replaces the <Conversation> widget) */}
//         <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
//           <div className="text-center">
//             <button
//               onClick={toggleConversation}
//               className={`mx-auto flex items-center justify-center w-24 h-24 rounded-full transition-all transform hover:scale-105 ${
//                 isConnected 
//                   ? 'bg-red-500 animate-pulse shadow-red-500/50' 
//                   : 'bg-gradient-to-r from-purple-500 to-blue-500 shadow-blue-500/50'
//               }`}
//             >
//               {isConnected ? <Mic className="text-white" size={40} /> : <MicOff className="text-white" size={40} />}
//             </button>

//             <p className="mt-4 text-gray-600 font-medium">
//               {isConnected ? 'Listening...' : 'Tap to Start Conversation'}
//             </p>

//             {/* Status Indicators */}
//             <div className="mt-4 space-y-2">
//               {transcript && (
//                 <div className="p-3 bg-blue-50 rounded-lg text-left">
//                   <p className="text-xs font-bold text-gray-500">YOU:</p>
//                   <p className="text-gray-800">{transcript}</p>
//                 </div>
//               )}
//               {response && (
//                 <div className="p-3 bg-green-50 rounded-lg text-left">
//                   <p className="text-xs font-bold text-gray-500">GEMINI LOGIC:</p>
//                   <p className="text-gray-800">{response}</p>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Task List */}
//         <div className="bg-white rounded-2xl shadow-2xl p-6 min-h-[300px]">
//           <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Tasks ({tasks.length})</h2>
//           <div className="space-y-3">
//             {tasks.map((task, index) => (
//               <div key={task.id} className={`flex items-center justify-between p-4 rounded-lg border-l-4 ${task.completed ? 'bg-gray-50 border-green-500' : 'bg-white border-blue-500'}`}>
//                 <div className="flex items-center gap-4 flex-1">
//                   {task.completed ? <CheckCircle className="text-green-500" /> : <Circle className="text-gray-300" />}
//                   <span className={task.completed ? 'line-through text-gray-400' : 'text-gray-800'}>{task.text}</span>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }


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
import { useConversation } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";

/* ================= CONFIG ================= */
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ELEVENLABS_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
/* ========================================== */

export default function VoiceTodoApp() {
  const [tasks, setTasks] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  const tasksRef = useRef([]);
  const isGeminiBusyRef = useRef(false); // 🔒 rate-limit lock

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

  /* ---------- Gemini Call Helper ---------- */
  const callGemini = async (model, prompt) => {
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );
  };

  /* ---------- Gemini Processing ---------- */
  const processVoiceCommand = useCallback(async (command) => {
    if (!GEMINI_API_KEY) return;
    if (isGeminiBusyRef.current) return;

    isGeminiBusyRef.current = true;
    setIsProcessing(true);

    const systemPrompt = `
You are an intelligent, voice-based to-do assistant.

Current tasks (ZERO-BASED index):
${JSON.stringify(tasksRef.current)}

User command:
"${command}"

Your responsibilities:
1. Understand the user's intent.
2. Detect ADD, DELETE, COMPLETE, LIST, CLEAR actions.
3. BEFORE adding a task, check if it is:
   - Physically impossible
   - Time unrealistic
   - Logically contradictory

Impossible-task handling rules:
- If task is impossible or unrealistic:
  - DO NOT add the task
  - Explain briefly WHY
  - Suggest a realistic alternative

Index rules:
- taskIndex MUST be zero-based.

Output rules:
- Respond ONLY with valid JSON
- No markdown, no extra text

JSON FORMAT:
{
  "action": "add | delete | complete | list | clear | impossible | unknown",
  "taskText": "",
  "taskIndex": 0,
  "feedback": "Natural spoken response",
  "suggestedTask": ""
}
`;

    try {
      // 🔥 Try PRO first
      let res = await callGemini("gemini-2.5-pro", systemPrompt);

      // 🔁 Fallback if rate-limited
      if (res.status === 429) {
        res = await callGemini("gemini-2.5-flash", systemPrompt);
      }

      if (!res.ok) throw new Error("Gemini failed");

      const data = await res.json();
      let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      raw = raw.replace(/```json|```/g, "").trim();

      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        result = {
          action: "unknown",
          feedback: "Sorry, I didn’t understand that."
        };
      }

      setAiResponse(result.feedback || "Okay.");

      const index =
        typeof result.taskIndex === "number"
          ? Math.max(0, result.taskIndex)
          : null;

      switch (result.action) {
        case "add":
          if (result.taskText) {
            setTasks((p) => [
              ...p,
              { id: Date.now(), text: result.taskText, completed: false }
            ]);
          }
          break;

        case "impossible":
          if (result.suggestedTask) {
            setAiResponse(
              `${result.feedback} For example, you could try: ${result.suggestedTask}`
            );
          }
          break;

        case "delete":
          if (index !== null) {
            setTasks((p) => p.filter((_, i) => i !== index));
          }
          break;

        case "complete":
          if (index !== null) {
            setTasks((p) =>
              p.map((t, i) =>
                i === index ? { ...t, completed: !t.completed } : t
              )
            );
          }
          break;

        case "clear":
          setTasks([]);
          break;
      }
    } catch (err) {
      console.error(err);
      setAiResponse("Please wait a moment and try again.");
    } finally {
      setIsProcessing(false);
      isGeminiBusyRef.current = false;
    }
  }, []);

  /* ---------- ElevenLabs Conversation ---------- */
  const conversation = useConversation({
    onConnect: () => setConnectionError(""),
    onDisconnect: () => {},
    onMessage: (msg) => {
      // ✅ ONLY FINAL TRANSCRIPT
      if (msg.source === "user" && msg.isFinal) {
        setTranscript(msg.message);
        processVoiceCommand(msg.message);
      }
    },
    onError: () => {
      setConnectionError("Voice connection failed.");
    }
  });

  const { status, startSession, endSession } = conversation;
  const isConnected = status === "connected";

  /* ---------- SAFE START ---------- */
  const handleStartSession = async () => {
    if (!ELEVENLABS_AGENT_ID) {
      alert("ElevenLabs Agent ID missing.");
      return;
    }
    await startSession({ agentId: ELEVENLABS_AGENT_ID });
  };

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white">
      <div className="max-w-3xl mx-auto">

        <header className="flex justify-between mb-8">
          <h1 className="text-3xl font-bold flex gap-2">
            VoiceTask Flash <Zap />
          </h1>
          <span className="text-xs">{status}</span>
        </header>

        {connectionError && (
          <div className="bg-red-500/20 p-4 rounded-xl mb-4 flex gap-2">
            <AlertTriangle /> {connectionError}
          </div>
        )}

        <div className="flex justify-center mb-6">
          <button
            onClick={() => (isConnected ? endSession() : handleStartSession())}
            className={`w-24 h-24 rounded-full flex items-center justify-center ${
              isConnected ? "bg-red-500" : "bg-indigo-600"
            }`}
          >
            {isConnected ? <Mic /> : <MicOff />}
          </button>
        </div>

        <div className="bg-white/5 p-6 rounded-xl mb-6">
          <p className="text-sm text-yellow-400">You said:</p>
          <p>{transcript || "Waiting..."}</p>
          <div className="mt-3 flex gap-2 items-center">
            {isProcessing ? <Loader2 className="animate-spin" /> : <Volume2 />}
            <p>{aiResponse || "Ready."}</p>
          </div>
        </div>

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
