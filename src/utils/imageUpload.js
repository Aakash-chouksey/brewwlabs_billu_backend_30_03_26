/**
 * Image Upload Utility
 * Handles file uploads using multer and Cloudinary
 */

const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary (use env vars)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer storage configuration (memory for buffer processing)
const storage = multer.memoryStorage();

// File filter for images
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.'), false);
  }
};

// Upload limits
const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB max
  files: 10
};

// Single file upload middleware
const uploadSingle = multer({ storage, fileFilter, limits }).single('image');

// Multiple files upload middleware
const uploadMultiple = multer({ storage, fileFilter, limits }).array('images', 10);

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} buffer - Image buffer
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadImageToCloudinary = async (buffer, folder = 'pos-images') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes
          });
        }
      }
    );
    
    uploadStream.end(buffer);
  });
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Cloudinary deletion result
 */
const deleteImageFromCloudinary = async (publicId) => {
  return await cloudinary.uploader.destroy(publicId);
};

/**
 * Upload multiple images to Cloudinary
 * @param {Array<Buffer>} buffers - Array of image buffers
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<Array<Object>>} Array of upload results
 */
const uploadMultipleToCloudinary = async (buffers, folder = 'pos-images') => {
  const uploadPromises = buffers.map(buffer => uploadImageToCloudinary(buffer, folder));
  return await Promise.all(uploadPromises);
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadImageToCloudinary,
  uploadMultipleToCloudinary,
  deleteImageFromCloudinary,
  cloudinary
};
