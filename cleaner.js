const fs = require('fs');
const path = require('path');

function keepExports(filePath, keepList) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // We want to find all 'export function X'
    const exportRegex = /^export function ([A-Za-z0-9_]+)/gm;
    let match;
    const exportsFound = [];
    
    while ((match = exportRegex.exec(content)) !== null) {
        exportsFound.push({
            name: match[1],
            index: match.index
        });
    }
    
    exportsFound.push({ name: 'EOF', index: content.length });
    
    let newContent = '';
    let lastIndex = 0;
    
    for (let i = 0; i < exportsFound.length - 1; i++) {
        const current = exportsFound[i];
        const next = exportsFound[i + 1];
        
        if (i === 0) {
            // Add everything before the first export (imports, types, helpers)
            newContent += content.substring(0, current.index);
        }
        
        if (keepList.includes(current.name)) {
            newContent += content.substring(current.index, next.index);
        }
    }
    
    // Replace imports from models and dashboard-ui
    const importStr = `import {
  PageConnection, Post, AIPersona, PromptStudioConfig, PerformanceInsights,
  Analytics, DashboardIntelligence, StyleAnalysis, TrackerDashboard, ScheduledSlotItem
} from "@/types/models"\nimport { PageTitle, PageMini, PageStatusBadge, formatDate, todayLabel, isPastScheduledSlot, slotStatusClass, MiniBars, emptySchedule, scheduleDayLabel, activeDaysToAbbrev, abbrevDaysToFull, scheduleFromLegacyPersona, LearnedInsightsPanel, ConnectEmpty, FacebookConnectButton } from "@/components/dashboard/shared/dashboard-ui"\n`;

    newContent = newContent.replace(/type PageConnection = \{[\s\S]*?type ScheduledSlotItem = \{[\s\S]*?\n\}/, importStr);
    
    // Write it back
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Cleaned ${filePath}, kept: ${keepList.join(', ')}`);
}

const basePath = path.join(__dirname, 'frontend', 'src', 'components', 'dashboard', 'views');

keepExports(path.join(basePath, 'ai-settings-view.tsx'), ['AISettingsView']);
keepExports(path.join(basePath, 'analytics-view.tsx'), ['AnalyticsView']);
keepExports(path.join(basePath, 'post-list-view.tsx'), ['PostList']);
keepExports(path.join(basePath, 'settings-view.tsx'), ['SettingsView']);
keepExports(path.join(basePath, 'template-library-view.tsx'), ['TemplateLibraryView']);
