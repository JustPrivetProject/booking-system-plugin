const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const manifestPaths = [
    path.join(rootDir, 'public', 'manifest.json'),
    path.join(rootDir, 'public', 'manifest-dev.json'),
];

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 4)}\n`, 'utf8');
}

function syncManifestVersion() {
    const packageJson = readJson(packageJsonPath);
    const targetVersion = packageJson.version;

    if (!targetVersion) {
        throw new Error('package.json version is missing');
    }

    for (const manifestPath of manifestPaths) {
        const manifest = readJson(manifestPath);

        if (manifest.version !== targetVersion) {
            manifest.version = targetVersion;
            writeJson(manifestPath, manifest);
            console.log(
                `Synced ${path.relative(rootDir, manifestPath)} to version ${targetVersion}`,
            );
        } else {
            console.log(
                `${path.relative(rootDir, manifestPath)} already uses version ${targetVersion}`,
            );
        }
    }
}

syncManifestVersion();
