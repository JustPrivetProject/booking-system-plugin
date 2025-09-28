const { execSync } = require('child_process');

// Check if there are changes that might warrant a version bump
function checkForVersionBump() {
    try {
        // Get list of changed files
        const changedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
            .trim()
            .split('\n')
            .filter(file => file.length > 0);

        // Check if any significant files were changed
        const significantChanges = changedFiles.some(
            file =>
                file.includes('src/') ||
                file.includes('public/') ||
                file.includes('package.json') ||
                file.includes('webpack.config.js'),
        );

        if (significantChanges) {
            console.log('\n🔍 Wykryto znaczące zmiany w kodzie.');
            console.log('💡 Rozważ aktualizację wersji:');
            console.log('   npm run version:patch  - dla poprawek błędów');
            console.log('   npm run version:minor  - dla nowych funkcji');
            console.log('   npm run version:major  - dla breaking changes');
            console.log('');
        }
    } catch (error) {
        // Ignore errors in git commands
    }
}

checkForVersionBump();
