import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import Redis from "ioredis";
import helemt from "helmet";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import logger from "./utils/logger.js";
import proxy from "express-http-proxy";
import errorHandler from "./middlewares/errorHandler.js";
import validateToken from "./middlewares/authMiddleware.js";
dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

const redisClient = new Redis(process.env.REDIS_URL);

app.use(helemt());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const ratelimitOptions = rateLimit({
  windowMs: 15 * 60 * 1000, // 15mins
  max: 100,
  standardHeaders: true, // allowing headers in response
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many requests",
    });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

app.use(ratelimitOptions);

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
});

// identity : /api/auth/register

const proxyOptions = {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace(/^\/v1/, "/api");
  },
  proxyErrorHandler: (err, res, next) => {
    logger.error(`Proxy error: ${err.message}`);
    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  },
};

// Setting the proxy for identity service

app.use(
  "/v1/auth",
  proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,
    // override most request options before issuing the proxyRequest
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      return proxyReqOpts;
    },
    //modify the proxy's response before sending it to the client.
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Identity service: ${proxyRes.statusCode}`
      );
      return proxyResData;
    },
  })
);
// Middleware to ensure user exists
const requireAuth = (req, res, next) => {
    if (!req.user || !req.user.userId) {
        logger.error('Authentication required but user not found in request');
        return res.status(401).json({ 
            success: false, 
            error: 'Authentication required' 
        });
    }
    next();
};

// Setting the proxy for post service
app.use(
  "/v1/posts",
  validateToken,
  requireAuth,
  proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;

      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Post service: ${proxyRes.statusCode}`
      );
      return proxyResData;
    },
  })
);

// Setting the proxy for media service
app.use('/v1/media',validateToken,proxy(process.env.MEDIA_SERVICE_URL,{
  ...proxyOptions,
  proxyReqOptDecorator: (proxyReqOpts, srcReq) =>{
    proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
    if(!(srcReq.headers['content-type'] || '').startsWith('multipart/form-data')){
      proxyReqOpts.headers["Content-Type"] = "application/json";
    }
    return proxyReqOpts
  },
      userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from search service: ${proxyRes.statusCode}`
      );
      return proxyResData;
    },
    parseReqBody: false
}))

// Setting the proxy for search service
app.use('/v1/search',validateToken,proxy(process.env.SEARCH_SERVICE_URL,{
  ...proxyOptions,
  proxyReqOptDecorator: (proxyReqOpts, srcReq) =>{
      proxyReqOpts.headers["Content-Type"] = "application/json";
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
    return proxyReqOpts
  },
      userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from media service: ${proxyRes.statusCode}`
      );
      return proxyResData;
    },
    parseReqBody: false
}))
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API gateway running on port ${PORT}`);
  logger.info(`Identity service running on port ${process.env.IDENTITY_SERVICE_URL}`);
  logger.info(`Post service running on port ${process.env.POST_SERVICE_URL}`);
  logger.info(`Media service running on port ${process.env.MEDIA_SERVICE_URL}`);
  logger.info(`Search service running on port ${process.env.SEARCH_SERVICE_URL}`);
  logger.info(`Redis url ${process.env.REDIS_URL}`);
});


