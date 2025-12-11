const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Allowed image MIME types
const ALLOWED_IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

// Allowed image extensions
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

// Sanitize filename to prevent path traversal attacks
function sanitizeFilename(filename) {
  // Remove directory separators and relative path components
  let sanitized = path.basename(filename);
  
  // Remove any remaining path components
  sanitized = sanitized.replace(/\.\./g, '').replace(/[/\\]/g, '');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Limit filename length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const nameWithoutExt = path.basename(sanitized, ext);
    sanitized = nameWithoutExt.substring(0, 255 - ext.length) + ext;
  }
  
  return sanitized;
}

// Validate file extension matches MIME type
function validateFileType(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();
  
  // Check if extension is in allowed list
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return false;
  }
  
  // Check if MIME type is in allowed list
  if (!ALLOWED_IMAGE_MIMETYPES.includes(mimeType)) {
    return false;
  }
  
  // Validate extension matches MIME type (basic check)
  const extToMime = {
    '.jpg': ['image/jpeg', 'image/jpg'],
    '.jpeg': ['image/jpeg', 'image/jpg'],
    '.png': ['image/png'],
    '.gif': ['image/gif'],
    '.webp': ['image/webp'],
    '.svg': ['image/svg+xml']
  };
  
  if (extToMime[ext] && !extToMime[ext].includes(mimeType)) {
    return false;
  }
  
  return true;
}

// Create secure multer storage configuration
function createSecureStorage(destination, prefix = '') {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      // Resolve to absolute path to prevent directory traversal
      const uploadDir = path.resolve(__dirname, '..', destination);
      
      // Ensure upload directory is within the project directory
      const projectRoot = path.resolve(__dirname, '..');
      if (!uploadDir.startsWith(projectRoot)) {
        return cb(new Error('Invalid upload directory'), null);
      }
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
      }
      
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      // Sanitize filename
      const sanitized = sanitizeFilename(file.originalname);
      const ext = path.extname(sanitized);
      const nameWithoutExt = path.basename(sanitized, ext);
      
      // Generate secure random filename
      const randomBytes = crypto.randomBytes(8).toString('hex');
      const timestamp = Date.now();
      const filename = `${prefix}${timestamp}-${randomBytes}${ext}`;
      
      cb(null, filename);
    }
  });
}

// Create secure multer upload configuration for images
function createSecureImageUpload(destination, maxSize = 10 * 1024 * 1024, prefix = '') {
  return multer({
    storage: createSecureStorage(destination, prefix),
    limits: {
      fileSize: maxSize,
      files: 10, // Max number of files
      fieldSize: 1024 * 1024 // 1MB field size limit
    },
    fileFilter: function (req, file, cb) {
      // Validate file type
      if (!validateFileType(file)) {
        return cb(new Error(`Invalid file type. Only ${ALLOWED_IMAGE_EXTENSIONS.join(', ')} files are allowed.`), false);
      }
      
      // Additional security: Check file extension from originalname
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
        return cb(new Error('Invalid file extension'), false);
      }
      
      cb(null, true);
    }
  });
}

// Create secure multer upload for KML files
function createSecureKMLUpload(destination) {
  return multer({
    storage: createSecureStorage(destination, 'kml-'),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
      files: 1
    },
    fileFilter: function (req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      
      // Only allow .kml and .kmz files
      if (ext === '.kml' || ext === '.kmz') {
        // Validate MIME type
        const allowedMimeTypes = ['application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz', 'application/xml', 'text/xml'];
        if (allowedMimeTypes.includes(file.mimetype) || file.mimetype === 'application/octet-stream') {
          return cb(null, true);
        }
      }
      
      cb(new Error('Only KML and KMZ files are allowed!'), false);
    }
  });
}

module.exports = {
  createSecureImageUpload,
  createSecureKMLUpload,
  sanitizeFilename,
  validateFileType,
  ALLOWED_IMAGE_MIMETYPES,
  ALLOWED_IMAGE_EXTENSIONS
};


