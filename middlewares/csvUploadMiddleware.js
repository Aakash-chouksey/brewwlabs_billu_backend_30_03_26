const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = 'uploads/imports/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'import-' + Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.includes('csv') || file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet')) {
        cb(null, true);
    } else {
        cb(new Error('Only CSV or processed spreadsheet files are allowed!'), false);
    }
};

const csvUpload = multer({ 
    storage: storage, 
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } 
});

module.exports = csvUpload;
