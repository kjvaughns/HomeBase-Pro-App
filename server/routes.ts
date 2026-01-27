import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { openai, HOMEBASE_SYSTEM_PROMPT } from "./openai";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // AI Chat endpoint - streaming response
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { messages } = req.body as { messages: ChatMessage[] };

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      // Add system prompt at the beginning
      const chatMessages: ChatMessage[] = [
        { role: "system", content: HOMEBASE_SYSTEM_PROMPT },
        ...messages,
      ];

      // Set up SSE for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: chatMessages,
        stream: true,
        max_tokens: 1024,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to get response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process chat request" });
      }
    }
  });

  // Non-streaming chat endpoint for simpler use
  app.post("/api/chat/simple", async (req: Request, res: Response) => {
    try {
      const { message } = req.body as { message: string };

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: HOMEBASE_SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        max_tokens: 1024,
      });

      const content = response.choices[0]?.message?.content || "";
      res.json({ response: content });
    } catch (error) {
      console.error("Error in simple chat:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
