const fs = require('fs');
const path = require('path');

const viewsToUpdate = [
    'ai-settings-view.tsx',
    'analytics-view.tsx',
    'post-list-view.tsx',
    'settings-view.tsx',
    'template-library-view.tsx'
];

const basePath = path.join(__dirname, 'frontend', 'src', 'components', 'dashboard', 'views');

for (const view of viewsToUpdate) {
    const filePath = path.join(basePath, view);
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Remove the remaining old @/types/models import completely
    content = content.replace(/import \{[\s\S]*?\} from "@\/types\/models"\n?/g, (match, p1, offset) => {
        // Only remove if it's NOT the one we just inserted at the very top
        // The one we inserted is near the top (offset < 200)
        if (offset > 200) return '';
        return match;
    });

    // Remove the old @/components/dashboard/shared/dashboard-ui import completely
    content = content.replace(/import \{[\s\S]*?\} from "@\/components\/dashboard\/shared\/dashboard-ui"\n?/g, (match, p1, offset) => {
        if (offset > 400) return '';
        return match;
    });
    
    // Remove the types that were still in the file
    // These were type PageConnection = ... type GlobalModelSettings = ... etc
    // Wait, let's see if the Duplicate Identifier is from an import or from the actual type definition!
    
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Cleaned leftover imports in ${view}`);
}
