import type { NextApiRequest, NextApiResponse } from "next";

// In-memory rate limit store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

function checkRateLimit(
  ip: string,
  maxRequests: number = 3,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    // First request or window expired
    const newRecord = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(ip, newRecord);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: newRecord.resetTime,
    };
  }

  if (record.count >= maxRequests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  // Increment count
  record.count++;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get IP address
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : req.socket.remoteAddress || "unknown";

  // Check rate limit: 3 requests per 15 minutes
  const { allowed, remaining, resetTime } = checkRateLimit(
    ip,
    3,
    15 * 60 * 1000
  );

  // Add rate limit headers
  res.setHeader("X-RateLimit-Limit", "3");
  res.setHeader("X-RateLimit-Remaining", remaining.toString());
  res.setHeader("X-RateLimit-Reset", Math.floor(resetTime / 1000).toString());

  if (!allowed) {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    return res.status(429).json({
      error:
        "Rate limit exceeded. Please try again later or connect your NEAR wallet for unlimited evaluations.",
      retryAfter,
      resetTime: new Date(resetTime).toISOString(),
    });
  }

  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Missing title or content" });
  }

  try {
    // Your AI evaluation logic here
    // const evaluation = await runAIEvaluation(title, content);

    return res.status(200).json({
      // evaluation,
      // qualityScore,
      // attentionScore,
      timestamp: new Date().toISOString(),
      remaining, // Let user know how many requests they have left
    });
  } catch (error: any) {
    console.error("[Draft Evaluation] Error:", error);
    return res.status(500).json({
      error: "Failed to evaluate draft",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
