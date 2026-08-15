const fs = require('fs');

// 1. Fix ai-settings-view.tsx
const aiSettingsFile = 'frontend/src/components/dashboard/views/ai-settings-view.tsx';
let aiSettingsContent = fs.readFileSync(aiSettingsFile, 'utf-8');
const missingImports = `import {
  includeOptions, neverOptions, structureOptions, llmProviderModels, ModelPreference,
  ModelProviderOption, emptyPromptConfig, PersonaTemplateDefault, templateDefaults,
  emptyPersona, promptConfig, buildSimplePrompt, buildRawPrompt, applyTemplate
} from "@/lib/persona-utils"
import { dayOptions, personaColors, scheduleDayKeys, dayFullToAbbrev, PersonaScheduleData } from "@/components/dashboard/shared/dashboard-ui"\n`;

aiSettingsContent = aiSettingsContent.replace(/import \* as React from "react"\n/, 'import * as React from "react"\n' + missingImports);
fs.writeFileSync(aiSettingsFile, aiSettingsContent);

// 2. Fix settings-view.tsx
const settingsFile = 'frontend/src/components/dashboard/views/settings-view.tsx';
let settingsContent = fs.readFileSync(settingsFile, 'utf-8');
const functionsToRemove = [
    'PageTitle', 'PageMini', 'PageStatusBadge', 'formatDate', 'todayLabel',
    'isPastScheduledSlot', 'Stat', 'PostRow', 'Empty', 'SkeletonPage', 'badgeClass', 'GlobalModelSettings'
];

functionsToRemove.forEach(func => {
    // Attempt multiple patterns because function arguments differ
    const regex1 = new RegExp(`function ${func}\\([\\s\\S]*?\\n\\}\\n`, 'g');
    settingsContent = settingsContent.replace(regex1, '');
    const regex2 = new RegExp(`type ${func} = \\{[\\s\\S]*?\\}\\n`, 'g');
    settingsContent = settingsContent.replace(regex2, '');
});
fs.writeFileSync(settingsFile, settingsContent);

// 3. Fix scheduled-slots-view.tsx missing Link and RefreshCw
const slotsFile = 'frontend/src/components/dashboard/views/scheduled-slots-view.tsx';
let slotsContent = fs.readFileSync(slotsFile, 'utf-8');
slotsContent = slotsContent.replace(/import \{ CalendarClock/, 'import { CalendarClock, RefreshCw');
slotsContent = slotsContent.replace(/import \{ toast/, 'import Link from "next/link"\nimport { toast');
fs.writeFileSync(slotsFile, slotsContent);

console.log('Fixed final TS errors');
