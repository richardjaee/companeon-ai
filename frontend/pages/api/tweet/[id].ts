import type { NextApiRequest, NextApiResponse } from 'next';
import { getTweet } from 'react-tweet/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const tweetId = req.query.id as string;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tweet = await getTweet(tweetId);

    if (!tweet) {
      return res.status(404).json({ data: null });
    }

    // Cache for 1 hour, stale-while-revalidate for 1 day
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400'
    );

    return res.status(200).json({ data: tweet });
  } catch {
    return res.status(404).json({ data: null });
  }
}
