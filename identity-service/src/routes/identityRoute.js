import { Router } from "express"
import {loginUser, logoutUser, refreshTokenUser, registerUser } from "../controllers/identityController.js"
const router = Router()

router.post('/register',registerUser)
router.post('/login',loginUser)
router.post('/refreshToken',refreshTokenUser)
router.post('/logout',logoutUser)
export default router