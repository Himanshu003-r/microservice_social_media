import User from "../models/User.js";
import logger from "../utils/logger.js";
import { validateLogin, validateRegistration } from "../utils/validation.js";
import generateToken from "../utils/generateToken.js";
import RefreshToken from "../models/RefereshToken.js";

export const registerUser = async (req, res) => {
  logger.info("User registration");
  try {
    // Validate the schema
    const { error } = validateRegistration(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { email, password, name } = req.body;

    let user = await User.findOne({
      $or: [{ email }, { name }],
    });

    if (user) {
      logger.warn("User already exists");
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    user = new User({ name, email, password });
    await user.save();
    logger.warn("User saved successfully", user._id);

    const { accessToken, refreshToken } = await generateToken(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    logger.error("Registration error occured");
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const loginUser = async (req, res) => {
  logger.info("User login");
  try {
    const { error } = validateLogin(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      logger.warn("Invalid user");
      return res.status(400).json({
        success: false,
        message: "Invalid credential",
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      logger.warn("Invalid password");
      return res.status(400).json({
        success: false,
        message: "Invalid password ",
      });
    }

    const { accessToken, refreshToken } = await generateToken(user);

    res.status(200).json({
      success: true,
      message: "User logged in successfully",
      data: user,
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    logger.error("Login error occured");
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const refreshTokenUser = async (req, res) => {
  logger.info("Requesting refresh token");
  try {
    const {refreshToken} = req.body
    if(!refreshToken){
      logger.warn('Refresh token missing')
            return res.status(400).json({
        success: false,
        message: "No refresh token provided",
      });
    }

    const storedToken = await RefreshToken.findOne({token: refreshToken})

    if(!storedToken || storedToken.expiresAt < new Date()){
      logger.warn('Invalid or expired refresh token')
            return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    const user = await User.findById(storedToken.user)

    if(!user){
            logger.warn('User not found')
            return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const {accessToken: newAccessToken, refreshToken: newRefreshToken} = await generateToken(user)
    
    await RefreshToken.deleteOne({_id: storedToken._id})

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    })
  } catch (error) {
    logger.error("Refresh token error occured");
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const logoutUser = async(req ,res) => {
  logger.info('Logout user')
  try {
    const {refreshToken} = req.body
        if(!refreshToken){
      logger.warn('Refresh token missing')
            return res.status(400).json({
        success: false,
        message: "No refresh token provided",
      });
    }

    await RefreshToken.deleteOne({token: refreshToken})
    logger.info('Refresh token deleted')

    res.status(200).json({
      success: true,
      message: 'User logged out'
    })
  } catch (error) {
        logger.error("Logout error occured");
    res.status(500).json({
      message: "Internal server error",
    });
  }
}
