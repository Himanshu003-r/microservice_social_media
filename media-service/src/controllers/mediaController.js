import Media from "../models/MediaModel.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import logger from "../utils/logger.js";

export const uploadMedia = async (req, res) => {
  logger.info("Starting media upload");
  try {
    console.log(req.file, 'req.files');
    
    if (!req.file) {
      logger.info("No file found");
      return res.status(400).json({
        success: false,
        message: "Please add a file and try again",
      });
    }

    const { originalname, mimetype, buffer } = req.file;
    const userId = req.user.userId;

    logger.info(`File details: name=${originalname},type=${mimetype}`);
    logger.info("Uploading to cloudinary starting...");

    const cloudinaryUpload = await uploadToCloudinary(req.file);
    logger.info(
      `Cloudinary upload successful. Public Id:- ${cloudinaryUpload.public_id}`
    );

    const newMedia = await Media.create({
      publicId: cloudinaryUpload.public_id,
      originalName: originalname,
      mimeType: mimetype,
      url: cloudinaryUpload.secure_url,
      userId,
    });

    res.status(201).json({
        success: true,
        mediaId: newMedia._id,
        url: newMedia.url,
        message: 'Media uploaded to cloudinary successfully'
    })
  } catch (error) {
    logger.error("Error uploading media", error);
    res.status(500).json({
      success: false,
      message: "Error uploading media",
    });
  }
};

export const getAllMedia = async (req,res)=>{
  try {
    const results = await Media.find({})
    res.json({ results })
  } catch (error) {
        logger.error("Error fetching media", error);
    res.status(500).json({
      success: false,
      message: "Error fetching media",
    });
  }
}