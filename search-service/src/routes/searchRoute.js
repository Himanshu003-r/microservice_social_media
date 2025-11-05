import { Router } from "express";
import authenticateRequest from "../middlewares/authMiddleware.js";
import { searchPost } from "../controllers/searchController.js";
const router = Router()

router.use(authenticateRequest )
router.get('/posts',searchPost)

export default router