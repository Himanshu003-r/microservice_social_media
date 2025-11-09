import dotenv from "dotenv"
import express from "express"
import connectDB from "./database/db.js"
import helmet from "helmet"
import cors from "cors"
import logger from "./utils/logger.js"
import {RateLimiterRedis} from "rate-limiter-flexible"
import {rateLimit} from "express-rate-limit"
import {RedisStore} from "rate-limit-redis"
import Redis from "ioredis"
import authRoute from "./routes/identityRoute.js"
import errorHandler from "./middlewares/errorHandler.js"
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

const redisClient = new Redis(process.env.REDIS_URL)

// Middlewares
app.use(helmet())
app.use(cors())
app.use(express.urlencoded());
app.use(express.json())

app.use((req,res,next) => {
    logger.info(`Received ${req.method} request to ${req.url}`)
    logger.info('Request body,',req.body)
    next()
})

//DDOS proc and rate limiting
const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'middleware',
    points: 10, // max no. of requests
    duration: 1 // in sec
})

app.use((req,res,next)=> {
    rateLimiter
    .consume(req.ip)
    .then(()=> next())
    .catch(() => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`)
        res.status(429).json({
            success: false,
            message: 'Too many requests'
        })
    })
})

//IP based rate limiting for sensitive endpoints
const sensitiveEndpoints = rateLimit({
    windowMs : 15 * 60 * 1000, // 15mins
    max : 50,
    standardHeaders: true, // allowing headers in response
    legacyHeaders: false,
    handler: (req ,res) => {
        logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`)
        res.status(429).json({
            success: false,
            message: 'Too many requests'
        })
    },
    store: new RedisStore({
        sendCommand : (...args)=> redisClient.call(...args)
    })
})


//apply the sensitive rate limiter to routes
app.use('/api/auth/register',sensitiveEndpoints)

// Routes
app.use('/api/auth', authRoute)

// Error handler
app.use(errorHandler)

// connect to Database

connectDB();

app.listen(PORT, () => {
    logger.info(`Identity service running on port ${PORT}`)
})

//Unhandled promise rejection

process.on('unhandledRejection', (reason,promise) => {
    logger.error('Unhandled rejection at ', promise, ' reason', reason)
})
