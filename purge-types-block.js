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
    
    // Remove the type definitions
    content = content.replace(/type PageConnection = \{[\s\S]*?\}\n/g, '');
    content = content.replace(/type Post = \{[\s\S]*?\}\n/g, '');
    content = content.replace(/type AIPersona = \{[\s\S]*?\}\n/g, '');
    content = content.replace(/type PromptStudioConfig = \{[\s\S]*?\}\n/g, '');
    content = content.replace(/type PerformanceInsights = \{[\s\S]*?\}\n/g, '');
    content = content.replace(/type Analytics = \{[\s\S]*?\}\n/g, '');
    content = content.replace(/type DashboardIntelligence = \{[\s\S]*?\}\n/g, '');
    content = content.replace(/type StyleAnalysis = \{[\s\S]*?\}\n/g, '');
    content = content.replace(/type TrackerDashboard = \{[\s\S]*?\}\n/g, '');
    content = content.replace(/type ScheduledSlotItem = \{[\s\S]*?\}\n/g, '');
    content = content.replace(/type GlobalModelSettings = \{[\s\S]*?\}\n/g, '');
    
    // Remove functions that are now imported
    content = content.replace(/function slotStatusClass\([\s\S]*?\}\n/g, '');
    content = content.replace(/function PageTitle\([\s\S]*?\}\n/g, '');
    content = content.replace(/function PageMini\([\s\S]*?\}\n/g, '');
    content = content.replace(/function PageStatusBadge\([\s\S]*?\}\n/g, '');
    content = content.replace(/function formatDate\([\s\S]*?\}\n/g, '');
    content = content.replace(/function todayLabel\([\s\S]*?\}\n/g, '');
    content = content.replace(/function isPastScheduledSlot\([\s\S]*?\}\n/g, '');
    content = content.replace(/function MiniBars\([\s\S]*?\}\n/g, '');
    content = content.replace(/function emptySchedule\([\s\S]*?\}\n/g, '');
    content = content.replace(/function scheduleDayLabel\([\s\S]*?\}\n/g, '');
    content = content.replace(/function activeDaysToAbbrev\([\s\S]*?\}\n/g, '');
    content = content.replace(/function abbrevDaysToFull\([\s\S]*?\}\n/g, '');
    content = content.replace(/function scheduleFromLegacyPersona\([\s\S]*?\}\n/g, '');
    content = content.replace(/function LearnedInsightsPanel\([\s\S]*?\}\n/g, '');
    content = content.replace(/function ConnectEmpty\([\s\S]*?\}\n/g, '');
    content = content.replace(/function FacebookConnectButton\([\s\S]*?\}\n/g, '');
    content = content.replace(/function Stat\([\s\S]*?\}\n/g, '');
    content = content.replace(/function PostRow\([\s\S]*?\)\n\}\n/g, '');
    content = content.replace(/function Empty\([\s\S]*?\}\n/g, '');
    content = content.replace(/function SkeletonPage\([\s\S]*?\}\n/g, '');
    content = content.replace(/function badgeClass\([\s\S]*?\}\n/g, '');
    
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Purged types and functions in ${view}`);
}
