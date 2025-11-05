import Post from "../models/PostModel.js";
import logger from "../utils/logger.js";
import { publishEvent } from "../utils/rabbitmq.js";
import { validateCreatePost } from "../utils/validation.js";

async function invalidatePostCache(req, input){
    // Delete specific post cache
    const cacheKey = `post:${input}`
    await  req.redisClient.del(cacheKey)
    // Find all "posts:*" cache keys
    const keys = await req.redisClient.keys("posts:*")
    if(keys.length > 0){
        await req.redisClient.del(keys)
    }
}

export const createPost = async (req, res) => {
  logger.info("Create post");
  try {
    // Validate the schema
    const { error } = validateCreatePost(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { content, mediaIds } = req.body;
    const newPost = await Post.create({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || [],
    });
    await newPost.save();
    await publishEvent('post.created',{
      postId : newPost._id.toString(),
      userId : newPost.user.toString(),
      content : newPost.content,
      createdAt : newPost.createdAt
    })
    await invalidatePostCache(req,newPost._id.toString())
    logger.info("Post created", newPost);
    res.status(201).json({
      success: true,
      message: "Post created successfully",
    });
  } catch (error) {
    logger.error("Error while creating post", error);
    res.status(500).json({
      success: false,
      message: "Error while creating post",
    });
  }
};

export const getAllPost = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    const cacheKey = `posts:${page}:${limit}`;
    const cachedPosts = await req.redisClient.get(cacheKey);

    if (cachedPosts) {
      return res.json(JSON.parse(cachedPosts));
    }

    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    const total = await Post.countDocuments()

    const result = {
        posts,
        currentpage: page,
        totalPages: Math.ceil(total/limit),
        totalPosts: total
    }

    //save in redis cache
    await req.redisClient.setex(cacheKey,300, JSON.stringify(result))   // duration in secs

    res.json(result)
  } catch (error) {
    logger.error("Error fetching post", error);
    res.status(500).json({
      success: false,
      message: "Error fetching post",
    });
  }
};

export const getPost = async (req, res) => {
  try {
    const postId = req.params.id
    const cachekey = `post:${postId}`
    const cachedPosts = await req.redisClient.get(cachekey);

    if (cachedPosts) {
      return res.json(JSON.parse(cachedPosts));
    }

    const singlePost = await Post.findById(postId)

    if(!singlePost){
        return res.status(404).json({
            success: 'false',
            message: 'Post not found'
        })
    }

    await req.redisClient.setex(cachedPosts,3600, JSON.stringify(singlePost))
    res.json(singlePost)
  } catch (error) {
    logger.error("Error fetching post", error);
    res.status(500).json({
      success: false,
      message: "Error fetching post by ID",
    });
  }
};

export const deletePost = async (req, res) => {
  try {
   const post = await Post.findOneAndDelete({
    _id: req.params.id,
    user: req.user.userId
   })

       if(!post){
        return res.status(404).json({
            success: 'false',
            message: 'Post not found'
        })
    }

    //publish post delete method
    await publishEvent('post.deleted',{
      postId: post._id.toString(),
      userId: req.user.userId,
      mediaIds: post.mediaIds
    })
    await invalidatePostCache(req,req.params.id)
    res.json({
        message: 'Post deleted'
    })
  } catch (error) {
    logger.error("Error in deleting post", error);
    res.status(500).json({
      success: false,
      message: "Error in deleting post",
    });
  }
};
