const fs = require('fs');

// Read package.json to get the new version
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const newVersion = packageJson.version;

console.log(`Updating version to ${newVersion} in manifest files...`);

// Update manifest.json
const manifestPath = 'public/manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = newVersion;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));

// Update manifest-dev.json
const manifestDevPath = 'public/manifest-dev.json';
const manifestDev = JSON.parse(fs.readFileSync(manifestDevPath, 'utf8'));
manifestDev.version = newVersion;
fs.writeFileSync(manifestDevPath, JSON.stringify(manifestDev, null, 4));

console.log('✅ Version updated successfully in all manifest files');
