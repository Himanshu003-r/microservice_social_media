import dotenv from 'dotenv'
import express from "express";
import connectDB from "./database/db.js";
import helmet from "helmet";
import cors from "cors";
import logger from "./utils/logger.js";
import Redis from "ioredis";
import errorHandler from "./middlewares/errorHandler.js";
import searchRouter from "./routes/searchRoute.js"
import { connectRabbitMQ ,consumeEvent } from "./utils/rabbitmq.js";
import {handlePostCreated, handlePostDeleted} from './eventHandler/searchEventHandler.js';
dotenv.config();

const app = express()
const PORT = process.env.PORT || 3004

connectDB()
const redisClient = new Redis(process.env.REDIS_URL);
// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.urlencoded());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
});

app.use('/api/search',(req,res,next)=>{
    req.redisClient = redisClient
    next()
},searchRouter)

app.use(errorHandler)

async function startServer(){
    try {
        await connectRabbitMQ()

        // consume the event
        await consumeEvent('post.created',handlePostCreated)
        await consumeEvent('post.deleted',handlePostDeleted)

            app.listen(PORT, () => {
      logger.info(`Search service running on port ${PORT}`);
    });
    } catch (error) {
        logger.error('Failed to start search service', error)
    }
}

startServer()