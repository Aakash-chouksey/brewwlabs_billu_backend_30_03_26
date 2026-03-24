const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Secure file path validation to prevent directory traversal attacks
 */
function validateFilePath(filePath, allowedBasePath = null) {
    const resolvedPath = path.resolve(filePath);
    
    // If allowed base path is specified, ensure the resolved path is within it
    if (allowedBasePath) {
        const resolvedBasePath = path.resolve(allowedBasePath);
        if (!resolvedPath.startsWith(resolvedBasePath)) {
            throw new Error(`Security violation: Path traversal detected - ${filePath} is outside allowed directory`);
        }
    }
    
    // Additional security checks
    if (filePath.includes('..') || filePath.includes('~')) {
        throw new Error(`Security violation: Dangerous path components detected in ${filePath}`);
    }
    
    return resolvedPath;
}

// Configure S3 (Optional, fallback to local)
const s3Client = process.env.AWS_ACCESS_KEY_ID ? new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
}) : null;

const ebillService = {
  generatePDF: async (orderData) => {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- PDF CONTENT GENERATION ---
      
      // Header
      doc.fontSize(20).text(orderData.businessName || 'BrewwLabs POS', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Order #: ${orderData.orderId}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.moveDown();

      // Items Table Header
      doc.font('Helvetica-Bold');
      doc.text('Item', 50, 150);
      doc.text('Qty', 250, 150);
      doc.text('Price', 350, 150);
      doc.text('Total', 450, 150);
      doc.font('Helvetica');
      doc.moveDown();

      // Items
      let y = 175;
      orderData.items.forEach(item => {
        doc.text(item.name, 50, y);
        doc.text(item.quantity.toString(), 250, y);
        doc.text(item.price.toFixed(2), 350, y);
        doc.text((item.price * item.quantity).toFixed(2), 450, y);
        y += 20;
      });

      // Total
      doc.moveDown();
      doc.font('Helvetica-Bold').text(`Grand Total: ${orderData.totalAmount}`, { align: 'right' });

      // Footer
      doc.moveDown();
      doc.fontSize(10).text('Thank you for your business!', { align: 'center' });

      doc.end();
    });
  },

  uploadToStorage: async (pdfBuffer, filename) => {
    if (s3Client) {
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `bills/${filename}`,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ACL: 'public-read' // Check bucket policy
      });
      await s3Client.send(command);
      return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/bills/${filename}`;
    } else {
      // Local storage fallback
      const uploadDir = path.join(__dirname, '../uploads/bills');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Secure file path validation
      const secureFilePath = validateFilePath(
          path.join(uploadDir, filename),
          uploadDir
      );
      
      fs.writeFileSync(secureFilePath, pdfBuffer);
      return `/uploads/bills/${filename}`; // Return relative path for serving via creating static route
    }
  }
};

module.exports = ebillService;
