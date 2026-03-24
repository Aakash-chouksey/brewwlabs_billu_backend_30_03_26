const express = require('express');
const router = express.Router();
const { uploadSingle, uploadMultiple, uploadImageToCloudinary, deleteImageFromCloudinary } = require('../src/utils/imageUpload');
const { isVerifiedUser } = require('../middlewares/tokenVerification');

// Upload single image
router.post('/single', isVerifiedUser, uploadSingle, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Upload buffer to Cloudinary
    const result = await uploadImageToCloudinary(req.file.buffer, 'pos-images');

    const imageData = {
      url: result.url,
      public_id: result.public_id,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      format: result.format,
      width: result.width,
      height: result.height
    };

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: imageData
    });
  } catch (error) {
    console.error('Single image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

// Upload multiple images
router.post('/multiple', isVerifiedUser, uploadMultiple, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image files provided'
      });
    }

    // Upload all files to Cloudinary
    const uploadPromises = req.files.map(async (file) => {
      const result = await uploadImageToCloudinary(file.buffer, 'pos-images');
      return {
        url: result.url,
        public_id: result.public_id,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        format: result.format,
        width: result.width,
        height: result.height
      };
    });

    const imagesData = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: imagesData
    });
  } catch (error) {
    console.error('Multiple images upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: error.message
    });
  }
});

// Upload base64 image
router.post('/base64', isVerifiedUser, async (req, res) => {
  try {
    const { image, folder } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'No base64 image data provided'
      });
    }

    // Handle both data URL format and raw base64
    let imageData = image;
    if (image.startsWith('data:')) {
      imageData = image;
    }

    const result = await uploadImageToCloudinary(imageData, folder || 'pos-images');

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: result
    });
  } catch (error) {
    console.error('Base64 image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

// Delete image
router.delete('/:publicId', isVerifiedUser, async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    const result = await deleteImageFromCloudinary(publicId);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: result
    });
  } catch (error) {
    console.error('Image deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: error.message
    });
  }
});

module.exports = router;
