const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Image Optimization Middleware
 * Creates optimized versions of uploaded images and updates the request object
 */
const imageOptimizer = async (req, res, next) => {
  try {
    // Parse upload config from request body if present
    let uploadConfig = null;
    console.log('🔍 imageOptimizer - req.body:', req.body);
    if (req.body.uploadConfig) {
      try {
        uploadConfig = JSON.parse(req.body.uploadConfig);
        console.log('📦 Upload config received:', uploadConfig);
      } catch (e) {
        console.log('Failed to parse uploadConfig:', e, 'Raw value:', req.body.uploadConfig);
      }
    } else {
      console.log('⚠️ No uploadConfig in req.body');
    }

    // Create optimized directory if it doesn't exist
    const baseDir = path.join(__dirname, '../uploads/optimized');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    // Determine target directory from config
    let optimizedDir = baseDir;
    if (uploadConfig && uploadConfig.folder) {
      optimizedDir = path.join(baseDir, uploadConfig.folder);
      if (!fs.existsSync(optimizedDir)) {
        fs.mkdirSync(optimizedDir, { recursive: true });
        console.log(`📁 Created subfolder: ${uploadConfig.folder}`);
      }
    }

    req.optimizedImages = {};

    // Process uploaded files if they exist
    if (req.files) {
      for (const [fieldName, files] of Object.entries(req.files)) {
        // Skip timetable files - they are JSON, not images
        if (fieldName === 'timetable' || fieldName === 'timetable-file') {
          console.log(`⏭️ Skipping timetable file: ${fieldName}`);
          continue;
        }
        
        if (Array.isArray(files)) {
          for (const file of files) {
            try {
              await optimizeImage(file, fieldName, optimizedDir, req.optimizedImages, uploadConfig);
            } catch (fileError) {
              console.error(`❌ Error optimizing file ${file?.originalname || 'unknown'} in field ${fieldName}:`, fileError);
              // Continue processing other files even if one fails
            }
          }
        } else if (files) {
          try {
            await optimizeImage(files, fieldName, optimizedDir, req.optimizedImages, uploadConfig);
          } catch (fileError) {
            console.error(`❌ Error optimizing file ${files?.originalname || 'unknown'} in field ${fieldName}:`, fileError);
            // Continue even if this file fails
          }
        }
      }
    }

    next();
  } catch (error) {
    console.error('Image optimization error:', error);
    // Continue without optimization if there's an error
    next();
  }
};

/**
 * Optimize a single image file
 */
async function optimizeImage(file, fieldName, optimizedDir, optimizedImages, uploadConfig = null) {
  try {
    // Validate file object
    if (!file || !file.path || !file.filename) {
      console.log(`⏭️ Skipping invalid file object for field: ${fieldName}`);
      return;
    }
    
    const filePath = file.path;
    const fileName = file.filename;
    const originalName = file.originalname || fileName; // Get original filename from upload
    const fileExt = path.extname(fileName).toLowerCase();
    const originalExt = path.extname(originalName).toLowerCase();
    
    // Skip if not an image file (check both uploaded filename and original name)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    if (!imageExtensions.includes(fileExt) && !imageExtensions.includes(originalExt)) {
      console.log(`⏭️ Skipping non-image file: ${originalName} (${fileExt})`);
      return;
    }
    
    // Skip JSON files explicitly
    if (fileExt === '.json' || originalExt === '.json') {
      console.log(`⏭️ Skipping JSON file: ${originalName}`);
      return;
    }

    // Generate optimized filename
    let cleanBaseName;
    
    // Use custom filename if provided, otherwise use original
    if (uploadConfig && uploadConfig.customFilename) {
      cleanBaseName = uploadConfig.customFilename.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    } else {
      const originalBaseName = path.basename(originalName, path.extname(originalName));
      cleanBaseName = originalBaseName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    }
    
    // Add short random suffix to prevent conflicts
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const baseName = `${cleanBaseName}-${randomSuffix}`;
    
    const optimizedFileName = `${baseName}-optimized.webp`;
    const optimizedPath = path.join(optimizedDir, optimizedFileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File does not exist: ${filePath}`);
      return;
    }
    
    // Create optimized versions
    const image = sharp(filePath);
    const metadata = await image.metadata();
    
    // Validate metadata
    if (!metadata || !metadata.width || !metadata.height) {
      console.error(`❌ Invalid image metadata for file: ${originalName}`);
      return;
    }

    // Determine which sizes to generate
    const defaultSizes = {
      size200: { width: 200, height: 200 },
      size400: { width: 400, height: 400 },
      size800: { width: 800, height: 800 },
      size1200: { width: 1200, height: 1200 },
      size1920: { width: 1920, height: 1920 }
    };

    // Filter sizes based on config
    let sizesToGenerate = defaultSizes;
    if (uploadConfig && uploadConfig.sizes) {
      sizesToGenerate = {};
      Object.keys(defaultSizes).forEach(key => {
        if (uploadConfig.sizes[key]) {
          sizesToGenerate[key] = defaultSizes[key];
        }
      });
    }

    for (const [size, dimensions] of Object.entries(sizesToGenerate)) {
      const sizeFileName = `${baseName}-${dimensions.width}x${dimensions.height}.webp`;
      const sizePath = path.join(optimizedDir, sizeFileName);
      
      await image
        .resize(dimensions.width, dimensions.height, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .webp({ 
          quality: 80,
          effort: 6 
        })
        .toFile(sizePath);

      // Calculate relative path from optimized base
      const relativePath = uploadConfig && uploadConfig.folder 
        ? `/uploads/optimized/${uploadConfig.folder}/${sizeFileName}`
        : `/uploads/optimized/${sizeFileName}`;

      // Store the optimized path
      if (!optimizedImages[fieldName]) {
        optimizedImages[fieldName] = [];
      }
      optimizedImages[fieldName].push({
        original: `/uploads/${fileName}`,
        optimized: relativePath,
        size: size
      });
    }

    // Also create a main optimized version if enabled in config
    const shouldCreateMain = uploadConfig && uploadConfig.sizes && uploadConfig.sizes.optimized === true;
    
    if (shouldCreateMain) {
      await image
        .resize(metadata.width > 1200 ? 1200 : metadata.width, null, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .webp({ 
          quality: 85,
          effort: 6 
        })
        .toFile(optimizedPath);

      // Calculate relative path from optimized base
      const relativePath = uploadConfig && uploadConfig.folder 
        ? `/uploads/optimized/${uploadConfig.folder}/${optimizedFileName}`
        : `/uploads/optimized/${optimizedFileName}`;

      // Store the main optimized path
      if (!optimizedImages[fieldName]) {
        optimizedImages[fieldName] = [];
      }
      optimizedImages[fieldName].push({
        original: `/uploads/${fileName}`,
        optimized: relativePath,
        size: 'main'
      });
    }

    console.log(`✅ Optimized image: ${fileName} -> ${optimizedFileName}`);
  } catch (error) {
    console.error(`❌ Failed to optimize image ${file.filename}:`, error);
  }
}

module.exports = { imageOptimizer };




