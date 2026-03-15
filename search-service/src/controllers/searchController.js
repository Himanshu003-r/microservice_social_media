import Search from "../models/SearchModel.js";
import logger from "../utils/logger.js";

export const searchPost = async (req, res) => {
  logger.info("Search endpoint hit");

  try {
    const { query } = req.query;
    const cacheKey = `posts:${query}`;
    const cachedPosts = await req.redisClient.get(cacheKey);

    if (cachedPosts) {
      return res.json(JSON.parse(cachedPosts));
    }

    const results = await Search.find(
      {
        $text: { $search: query },
      },
      {
        //$meta is a MongoDB operator that retrieves metadata about the query results. 
        // It gives extra information that's not stored in documents.
        score: { $meta: "textScore" },
      }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(10);
    await req.redisClient.setex(cacheKey, 180, JSON.stringify(results));
    res.json(results);
  } catch (error) {
    logger.error("Error in searching post", error);
    res.status(500).json({
      success: false,
      message: "Error in searching post",
    });
  }
};
