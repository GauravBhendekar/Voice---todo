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

// ✅ Gemini 2.5 (correct + active)
const GEMINI_MODEL = "gemini-2.5-flash";

// 🎙 ElevenLabs Voice
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

app.post("/api/command", async (req, res) => {
  try {
    const { command, tasks } = req.body;

    if (!command) {
      return res.status(400).json({ feedback: "No command provided." });
    }

    /* ================= GEMINI PROMPT ================= */
    const prompt = `
You are a smart voice-based to-do assistant.

Current tasks:
${JSON.stringify(tasks)}

User command:
"${command}"

Rules:
- Add task only if physically and logically possible
- If impossible, explain why
- Respond ONLY with valid JSON

JSON format:
{
  "action": "add | delete | complete | clear | impossible | unknown",
  "taskText": "",
  "taskIndex": 0,
  "feedback": ""
}
`;

    /* ================= GEMINI CALL ================= */
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
      const err = await geminiRes.text();
      console.error("❌ Gemini error:", err);
      return res.status(500).json({ feedback: "AI is busy. Try again." });
    }

    const geminiData = await geminiRes.json();
    const raw =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let result;
    try {
      result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      result = { action: "unknown", feedback: "I didn’t understand that." };
    }

    /* ================= ELEVENLABS TTS ================= */
    let audio = null;

    // ✅ Speak ONLY if feedback exists and is short
    if (
      ELEVENLABS_API_KEY &&
      typeof result.feedback === "string" &&
      result.feedback.length > 2 &&
      result.feedback.length < 300
    ) {
      console.log("🗣 ElevenLabs speaking:", result.feedback);

      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text: result.feedback,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.7
            }
          })
        }
      );

      if (!ttsRes.ok) {
        const ttsErr = await ttsRes.text();
        console.error("❌ ElevenLabs error:", ttsRes.status, ttsErr);
      } else {
        const buffer = await ttsRes.arrayBuffer();
        audio = Buffer.from(buffer).toString("base64");
        console.log("🔊 Audio generated, size:", audio.length);
      }
    }

    return res.json({ ...result, audio });
  } catch (err) {
    console.error("🔥 SERVER CRASH:", err);
    return res.status(500).json({ feedback: "Server crashed." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
