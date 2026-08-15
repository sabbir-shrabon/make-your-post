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
    
    // Fix AgenticPosterLab import
    content = content.replace(
        /import \{ AgenticPosterLab \} from ["']\.\/social-platform\/AgenticPosterLab["']/,
        'import { AgenticPosterLab } from "@/components/social-platform/AgenticPosterLab"'
    );
    
    // We also need to add models and dashboard-ui imports if missing, but wait...
    // Let's just insert them before 'import { useAuth }' or somewhere safe, 
    // or better, just at the top below 'import * as React'
    
    // Remove the old models import if it exists to prevent duplicates
    content = content.replace(/import \{[\s\S]*?\} from "@\/types\/models"\n/, '');
    
    // Remove the old dashboard-ui import if it exists
    content = content.replace(/import \{[\s\S]*?\} from "@\/components\/dashboard\/shared\/dashboard-ui"\n/, '');
    
    // Now insert the correct complete ones
    const newImports = `
import {
  PageConnection, Post, AIPersona, PromptStudioConfig, PerformanceInsights,
  Analytics, DashboardIntelligence, StyleAnalysis, TrackerDashboard, ScheduledSlotItem, GlobalModelSettings
} from "@/types/models"
import { PageTitle, PageMini, PageStatusBadge, formatDate, todayLabel, isPastScheduledSlot, slotStatusClass, MiniBars, emptySchedule, scheduleDayLabel, activeDaysToAbbrev, abbrevDaysToFull, scheduleFromLegacyPersona, LearnedInsightsPanel, ConnectEmpty, FacebookConnectButton, Stat, PostRow, Empty, SkeletonPage, badgeClass } from "@/components/dashboard/shared/dashboard-ui"
`;
    
    content = content.replace(/import \* as React from "react"/, 'import * as React from "react"\n' + newImports);
    
    // Fix local component redeclarations in composer-view and settings-view 
    // where they defined Empty, Stat, etc.
    if (view === 'composer-view.tsx') {
        content = content.replace(/function Empty\(\{ text, action \}[\s\S]*?\}\n/, '');
    }
    if (view === 'settings-view.tsx') {
        content = content.replace(/function Stat\(\{ label, value, tone[\s\S]*?\}\n/, '');
        content = content.replace(/function PostRow\(\{ post, timezone \}[\s\S]*?\)\n\}\n/, '');
        content = content.replace(/function Empty\(\{ text, action \}[\s\S]*?\}\n/, '');
        content = content.replace(/function SkeletonPage\(\)[\s\S]*?\}\n/, '');
        content = content.replace(/function badgeClass\(status: string\)[\s\S]*?\}\n/, '');
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fully fixed imports in ${view}`);
}
