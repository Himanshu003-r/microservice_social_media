import mongoose from "mongoose";
import logger from "../utils/logger.js";
const connectDB = async () => {
   try {
     await mongoose.connect(process.env.MONGO_URI)
     logger.info('Connected to MongoDB')

   } catch (error) {
     logger.error('Mongo conection error',error)
     process.exit(1)
   }
}

export default connectDB