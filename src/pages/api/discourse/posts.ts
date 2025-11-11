import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch("https://gov.near.org/posts.json");

    if (!response.ok) {
      throw new Error(`Discourse API error: ${response.status}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error: any) {
    console.error("Error fetching Discourse posts:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch posts from Discourse",
    });
  }
}
