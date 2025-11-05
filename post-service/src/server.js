import dotenv from "dotenv";
import express from "express";
import connectDB from "./database/db.js";
import helmet from "helmet";
import cors from "cors";
import logger from "./utils/logger.js";
import Redis from "ioredis";
import postRoute from "./routes/postRoutes.js";
import errorHandler from "./middlewares/errorHandler.js";
import { connectRabbitMQ } from "./utils/rabbitmq.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// Routes
app.use(
  "/api/posts",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  postRoute
);

app.use(errorHandler);

// connect to Database

connectDB();

async function startServer() {
  try {
    await connectRabbitMQ()
    app.listen(PORT, () => {
      logger.info(`Post service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server");
    process.exit(1);
  }
}


startServer()

//Unhandled promise rejection

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection at ", promise, " reason", reason);
});
