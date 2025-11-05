import { Router } from "express";
import { createPost, deletePost, getAllPost, getPost } from "../controllers/postController.js";
import authenticateRequest from "../middlewares/authMiddleware.js";
const router = Router()


router.use(authenticateRequest)
//applies authentication to every route defined after it

router.post('/create-post',createPost)
router.get('/posts',getAllPost)
router.get('/:id',getPost)
router.delete('/:id',deletePost)
export default router