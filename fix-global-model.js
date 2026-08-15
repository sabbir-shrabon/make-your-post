const fs = require('fs');

const settingsFile = 'frontend/src/components/dashboard/views/settings-view.tsx';
let settingsContent = fs.readFileSync(settingsFile, 'utf-8');

const startIndex = settingsContent.indexOf('type GlobalModelSettings = {');
if (startIndex > -1) {
    const endIndex = settingsContent.indexOf('}', startIndex) + 1;
    const chunkToRemove = settingsContent.substring(startIndex, endIndex);
    settingsContent = settingsContent.replace(chunkToRemove, '');
    fs.writeFileSync(settingsFile, settingsContent);
    console.log('Removed GlobalModelSettings locally!');
}
