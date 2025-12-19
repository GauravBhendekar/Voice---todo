import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// 🔐 ENV
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// ✅ CORRECT GEMINI 2.5 MODEL
const GEMINI_MODEL = "gemini-2.5-flash";

app.post("/api/command", async (req, res) => {
  try {
    const { command, tasks } = req.body;

    if (!command) {
      return res.status(400).json({ feedback: "No command provided" });
    }

    const prompt = `
You are a smart voice-based to-do assistant.

Current tasks:
${JSON.stringify(tasks)}

User command:
"${command}"

Rules:
- Add task only if physically and logically possible
- If impossible, explain why
- Return ONLY valid JSON

JSON format:
{
  "action": "add | delete | complete | clear | impossible | unknown",
  "taskText": "",
  "taskIndex": 0,
  "feedback": ""
}
`;

    // 🔹 GEMINI CALL
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("❌ Gemini error:", errText);
      return res.status(500).json({ feedback: "AI busy. Try again." });
    }

    const data = await geminiRes.json();
    const raw =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let result;
    try {
      result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      result = { action: "unknown", feedback: "I didn’t understand." };
    }

    // 🔊 ElevenLabs TTS (optional)
    let audio = null;
    if (ELEVENLABS_API_KEY && result.feedback) {
      const tts = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text: result.feedback,
            model_id: "eleven_multilingual_v2"
          })
        }
      );

      if (tts.ok) {
        const buffer = await tts.arrayBuffer();
        audio = Buffer.from(buffer).toString("base64");
      }
    }

    res.json({ ...result, audio });
  } catch (err) {
    console.error("🔥 SERVER CRASH:", err);
    res.status(500).json({ feedback: "Server crashed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
