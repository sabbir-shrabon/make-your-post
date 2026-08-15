const fs = require('fs');

const settingsFile = 'frontend/src/components/dashboard/views/settings-view.tsx';
let settingsContent = fs.readFileSync(settingsFile, 'utf-8');

const cutIndex = settingsContent.indexOf('function PageTitle(');
if (cutIndex > -1) {
    settingsContent = settingsContent.substring(0, cutIndex);
    fs.writeFileSync(settingsFile, settingsContent);
    console.log('Successfully nuked the rest of the legacy helpers from settings-view.tsx!');
} else {
    console.log('PageTitle not found');
}
