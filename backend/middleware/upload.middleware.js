const multer = require('multer');
const path = require('path');

// Use memoryStorage so NO files are saved to the server filesystem.
// Files will be streamed/saved directly to Google Drive.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Allow images, PDFs and Word documents
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes, PDFs y archivos de Word'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit in memory
    }
});

module.exports = upload;
