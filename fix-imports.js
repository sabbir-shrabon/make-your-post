const fs = require('fs');
const path = require('path');

const viewsToUpdate = [
    'ai-settings-view.tsx',
    'analytics-view.tsx',
    'post-list-view.tsx',
    'settings-view.tsx',
    'template-library-view.tsx',
    'home-view.tsx',
    'scheduled-slots-view.tsx',
    'composer-view.tsx',
    'page-tracker-view.tsx',
    'style-analyzer-view.tsx'
];

const basePath = path.join(__dirname, 'frontend', 'src', 'components', 'dashboard', 'views');

for (const view of viewsToUpdate) {
    const filePath = path.join(basePath, view);
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if we need to add persona-utils import
    if (!content.includes('persona-utils')) {
        const importStr = `import {
  includeOptions, neverOptions, structureOptions, llmProviderModels, ModelPreference,
  ModelProviderOption, emptyPromptConfig, PersonaTemplateDefault, templateDefaults,
  emptyPersona, promptConfig, buildSimplePrompt, buildRawPrompt, applyTemplate
} from "@/lib/persona-utils"
import { Stat, PostRow, Empty, SkeletonPage, badgeClass } from "@/components/dashboard/shared/dashboard-ui"\n`;
        
        // Insert after the first import
        content = content.replace(/import \* as React from "react"/, 'import * as React from "react"\n' + importStr);
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated imports in ${view}`);
}
