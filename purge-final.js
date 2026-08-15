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
    
    // Find the multi-line models import that causes trouble
    const oldImportRegex = /import \{\s*PageConnection,\s*Post,\s*AIPersona,\s*PromptStudioConfig,\s*PerformanceInsights,\s*Analytics,\s*DashboardIntelligence,\s*StyleAnalysis,\s*TrackerDashboard,\s*ScheduledSlotItem\s*\} from "@\/types\/models"/;
    
    // Find the first exported function which is the main view component
    const exportRegex = /export function /;
    
    const startMatch = content.match(oldImportRegex);
    const endMatch = content.match(exportRegex);
    
    if (startMatch && endMatch) {
        const startIndex = startMatch.index;
        // Search for the export function AFTER the old import regex
        const contentAfterImport = content.substring(startIndex);
        const nextExportMatch = contentAfterImport.match(exportRegex);
        
        if (nextExportMatch) {
            const endIndex = startIndex + nextExportMatch.index;
            
            // Just to be safe, only replace if the distance isn't massive 
            // (e.g. less than 15000 characters, which is about 400 lines)
            if (endIndex - startIndex < 20000) {
                const chunkToRemove = content.substring(startIndex, endIndex);
                content = content.replace(chunkToRemove, '\n');
                console.log(`Purged legacy chunk from ${view} (Removed ${chunkToRemove.length} chars)`);
            }
        }
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
}
