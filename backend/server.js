// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import fetch from "node-fetch";

// dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json());

// const PORT = 5000;

// /* ================= ENV ================= */
// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// const GEMINI_MODEL = "gemini-1.5-flash"; // ✅ ACTIVE MODEL
// /* ======================================= */

// if (!GEMINI_API_KEY) {
//   console.error("❌ Missing GEMINI_API_KEY in .env");
//   process.exit(1);
// }

// /* ================= API ================= */
// app.post("/api/command", async (req, res) => {
//   try {
//     const { command, tasks } = req.body;

//     if (!command) {
//       return res.status(400).json({
//         action: "unknown",
//         feedback: "No command received."
//       });
//     }

//     /* -------- Gemini Prompt -------- */
//     const prompt = `
// You are an intelligent, voice-based to-do assistant.

// Current tasks (ZERO-BASED index):
// ${JSON.stringify(tasks)}

// User command:
// "${command}"

// Rules:
// 1. Add a task ONLY if it is physically and logically possible.
// 2. If a task is impossible, respond with action "impossible" and explain why.
// 3. Support actions: add, delete, complete, clear, impossible, unknown.
// 4. taskIndex MUST be zero-based.
// 5. Respond ONLY with valid JSON. No markdown. No extra text.

// JSON format:
// {
//   "action": "add | delete | complete | clear | impossible | unknown",
//   "taskText": "",
//   "taskIndex": 0,
//   "feedback": ""
// }
// `;

//     /* -------- Gemini API Call -------- */
//     const geminiRes = await fetch(
//       `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
//       {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           contents: [{ role: "user", parts: [{ text: prompt }] }]
//         })
//       }
//     );

//     if (!geminiRes.ok) {
//       const errText = await geminiRes.text();
//       console.error("❌ Gemini API error:", errText);
//       return res.status(500).json({
//         action: "unknown",
//         feedback: "AI is busy. Please try again."
//       });
//     }

//     const data = await geminiRes.json();
//     const raw =
//       data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

//     let result;
//     try {
//       result = JSON.parse(raw.replace(/```json|```/g, "").trim());
//     } catch (err) {
//       console.error("❌ JSON parse error:", raw);
//       result = {
//         action: "unknown",
//         feedback: "I couldn’t understand that."
//       };
//     }

//     return res.json(result);

//   } catch (err) {
//     console.error("🔥 Server crash:", err);
//     return res.status(500).json({
//       action: "unknown",
//       feedback: "Server error. Try again."
//     });
//   }
// });

// /* ================= START ================= */
// app.listen(PORT, () => {
//   console.log(`✅ Backend running at http://localhost:${PORT}`);
// });










import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

/* ================= ENV ================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash"; // ✅ FAST MODEL
/* ======================================= */

// Debug: Show where we're looking for .env
console.log("🔍 Looking for .env at:", path.join(__dirname, '.env'));

if (!GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in backend/.env");
  console.error("📝 Please create backend/.env with:");
  console.error("   GEMINI_API_KEY=your_gemini_api_key_here");
  process.exit(1);
}

/* ================= API ================= */
app.post("/api/command", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { command, tasks } = req.body;
    console.log(`\n🎤 Command received: "${command}"`);
    console.log(`📋 Current tasks: ${tasks?.length || 0}`);

    // Validate input
    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        action: "unknown",
        feedback: "No command received."
      });
    }

    if (!Array.isArray(tasks)) {
      return res.status(400).json({
        action: "unknown",
        feedback: "Invalid tasks data."
      });
    }

    /* -------- Optimized Gemini Prompt -------- */
    const taskList = tasks.length === 0 ? "No tasks yet" : JSON.stringify(tasks);
    
    const prompt = `You are a to-do assistant. 
Current tasks (0-indexed): ${taskList}
User: "${command}"

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "action": "add|delete|complete|clear|list|unknown",
  "taskText": "description",
  "taskIndex": 0,
  "isLogical": true,
  "feedback": "brief response"
}

Rules:
- For ADD: Check if physically possible. If impossible (e.g., "run 500 miles in 1 hour"), set isLogical=false and explain why in feedback
- For DELETE/COMPLETE: Extract task number from command (e.g., "task 1" = index 0, "first task" = index 0)
- For LIST: Return current task list in feedback
- taskIndex is 0-based (first task = 0)
- Keep feedback under 15 words`;

    /* -------- Gemini API Call with Timeout -------- */
    const geminiStart = Date.now();
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ 
              role: "user", 
              parts: [{ text: prompt }] 
            }],
            generationConfig: {
              temperature: 0.3,  // Lower = faster, more deterministic
              maxOutputTokens: 200,  // Limit response length
              topP: 0.8,
              topK: 40
            }
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);
      const geminiTime = Date.now() - geminiStart;
      console.log(`⏱️  Gemini response time: ${geminiTime}ms`);

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error("❌ Gemini API error:", errText);
        return res.status(500).json({
          action: "unknown",
          feedback: "AI is busy. Please try again."
        });
      }

      const data = await geminiRes.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      let result;
      try {
        // Clean and parse response - handle multiple formats
        let cleaned = raw.trim();
        
        // Remove markdown code blocks
        cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Remove any leading/trailing whitespace
        cleaned = cleaned.trim();
        
        // Try to find JSON object if there's extra text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        }
        
        result = JSON.parse(cleaned);
        
        // Validate required fields
        if (!result.action) {
          throw new Error("Missing action field");
        }
        
        // Ensure feedback exists
        if (!result.feedback) {
          result.feedback = "Done.";
        }
        
        console.log(`✅ Action: ${result.action}`);
        if (result.taskText) console.log(`📝 Task: ${result.taskText}`);
        if (typeof result.taskIndex === 'number') console.log(`🔢 Index: ${result.taskIndex}`);
        console.log(`💬 Feedback: ${result.feedback}`);
        
      } catch (err) {
        console.error("❌ JSON parse error. Raw response:", raw);
        result = {
          action: "unknown",
          feedback: "I couldn't understand that command."
        };
      }

      const totalTime = Date.now() - startTime;
      console.log(`⏱️  Total request time: ${totalTime}ms\n`);

      return res.json(result);

    } catch (fetchErr) {
      clearTimeout(timeout);
      
      if (fetchErr.name === 'AbortError') {
        console.error("⏰ Gemini request timeout");
        return res.status(504).json({
          action: "unknown",
          feedback: "Request timeout. Try again."
        });
      }
      throw fetchErr;
    }

  } catch (err) {
    console.error("🔥 Server crash:", err);
    return res.status(500).json({
      action: "unknown",
      feedback: "Server error. Try again."
    });
  }
});

/* ================= HEALTH CHECK ================= */
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    gemini: GEMINI_API_KEY ? "configured" : "missing",
    model: GEMINI_MODEL,
    timestamp: new Date().toISOString()
  });
});

/* ================= CORS TEST ================= */
app.get("/", (req, res) => {
  res.json({ 
    message: "Voice Todo Backend API",
    endpoints: {
      health: "GET /health",
      command: "POST /api/command"
    }
  });
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Backend running at http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Gemini Model: ${GEMINI_MODEL}`);
  console.log(`🔑 API Key: ${GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`${"=".repeat(50)}\n`);
  console.log("Waiting for commands...\n");
});