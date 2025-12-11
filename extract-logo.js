const fs = require('fs');

// Read the installer file
const content = fs.readFileSync('hyello-widget-installer.cjs', 'utf8');

// Find the CUSTOM_IMAGE line
const match = content.match(/const CUSTOM_IMAGE = '(data:image\/png;base64,[^']+)'/);

if (match && match[1]) {
    const base64Image = match[1];
    console.log('Found logo! Length:', base64Image.length);
    
    // Write just the base64 string to a file
    const logoCode = `const CUSTOM_IMAGE = '${base64Image}';`;
    fs.writeFileSync('hyello-logo.txt', logoCode, 'utf8');
    console.log('Logo saved to hyello-logo.txt');
    console.log('First 100 chars:', base64Image.substring(0, 100));
} else {
    console.log('Logo not found in file');
}



