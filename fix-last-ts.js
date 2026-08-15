const fs = require('fs');

// 1. Fix ai-settings-view.tsx
const aiSettingsFile = 'frontend/src/components/dashboard/views/ai-settings-view.tsx';
let aiSettingsContent = fs.readFileSync(aiSettingsFile, 'utf-8');
const missingImports = `import { templateNames, goalOptions, toneOptions, languages } from "@/components/dashboard/shared/dashboard-ui"\n`;

if (!aiSettingsContent.includes('import { templateNames')) {
    aiSettingsContent = aiSettingsContent.replace(/import \* as React from "react"\n/, 'import * as React from "react"\n' + missingImports);
    fs.writeFileSync(aiSettingsFile, aiSettingsContent);
}

// 2. Fix settings-view.tsx
const settingsFile = 'frontend/src/components/dashboard/views/settings-view.tsx';
let settingsContent = fs.readFileSync(settingsFile, 'utf-8');
const functionsToRemove = [
    'PageTitle', 'PageMini', 'PageStatusBadge', 'formatDate', 'todayLabel',
    'isPastScheduledSlot', 'Stat', 'PostRow', 'Empty', 'SkeletonPage', 'badgeClass', 'GlobalModelSettings', 'slotStatusClass'
];

functionsToRemove.forEach(func => {
    // Regex for one-liner functions
    const regex1 = new RegExp(`function ${func}\\([\\s\\S]*?\\}\\n`, 'g');
    settingsContent = settingsContent.replace(regex1, '');
    
    // Regex for multi-liner functions
    const regex2 = new RegExp(`function ${func}\\([\\s\\S]*?\\n\\}\\n`, 'g');
    settingsContent = settingsContent.replace(regex2, '');
    
    // Regex for type declarations
    const regex3 = new RegExp(`type ${func} = \\{[\\s\\S]*?\\}\\n`, 'g');
    settingsContent = settingsContent.replace(regex3, '');
});
fs.writeFileSync(settingsFile, settingsContent);

console.log('Fixed last TS errors');
