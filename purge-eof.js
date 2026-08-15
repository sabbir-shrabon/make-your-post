const fs = require('fs');

const settingsFile = 'frontend/src/components/dashboard/views/settings-view.tsx';
let settingsContent = fs.readFileSync(settingsFile, 'utf-8');

const statIndex = settingsContent.indexOf('function Stat(');
if (statIndex > -1) {
    // Delete everything from ConnectedBanner (or Stat) down
    const connectedBannerIndex = settingsContent.indexOf('function ConnectedBanner(');
    const cutIndex = connectedBannerIndex > -1 ? connectedBannerIndex : statIndex;
    
    settingsContent = settingsContent.substring(0, cutIndex);
    fs.writeFileSync(settingsFile, settingsContent);
    console.log('Deleted legacy functions from EOF of settings-view.tsx');
}
