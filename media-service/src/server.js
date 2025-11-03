import dotenv from "dotenv"
import express from "express"
import connectDB from "./database/db.js"
import helmet from "helmet"
import cors from "cors"
import logger from "./utils/logger.js"
import mediaRoute from "./routes/mediaRoutes.js"
import errorHandler from "./middlewares/errorHandler.js"
import { connectRabbitMQ, consumeEvent } from "./utils/rabbitmq.js"
import { handlePostDeleted } from "./eventHandlers/mediaEventHandler.js"
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3003
connectDB()
app.use(cors())
app.use(helmet())
app.use(express.json())

app.use((req,res,next) => {
    logger.info(`Received ${req.method} request to ${req.url}`)
    logger.info(`Request body, ${req.body}`)
    next()
})

app.use('/api/media',mediaRoute)

app.use(errorHandler)

async function startServer(){
  try {
    await connectRabbitMQ()
    // consume events
    await consumeEvent('post.deleted',handlePostDeleted)
    app.listen(PORT, () => {
      logger.info(`Media service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server");
    process.exit(1);
  }
}
startServer()

//Unhandled promise rejection

process.on('unhandledRejection', (reason,promise) => {
    logger.error('Unhandled rejection at ', promise, ' reason', reason)
})