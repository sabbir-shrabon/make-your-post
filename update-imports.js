const fs = require('fs');
const path = require('path');

const viewMapping = {
  'HomeView': 'home-view',
  'AISettingsView': 'ai-settings-view',
  'AnalyticsView': 'analytics-view',
  'Composer': 'composer-view',
  'PageTrackerView': 'page-tracker-view',
  'PostList': 'post-list-view',
  'ScheduledSlotsView': 'scheduled-slots-view',
  'SettingsView': 'settings-view',
  'StyleAnalyzerView': 'style-analyzer-view',
  'TemplateLibraryView': 'template-library-view'
};

const pagesDir = path.join(__dirname, 'frontend', 'src', 'app', 'dashboard');

function updateImports(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      updateImports(fullPath);
    } else if (file === 'page.tsx') {
      let content = fs.readFileSync(fullPath, 'utf-8');
      
      const regex = /import\s*\{\s*([A-Za-z0-9_]+)\s*\}\s*from\s*["']@\/components\/social-platform["']/;
      const match = content.match(regex);
      
      if (match) {
        const componentName = match[1];
        const newFile = viewMapping[componentName];
        if (newFile) {
          content = content.replace(regex, `import { ${componentName} } from "@/components/dashboard/views/${newFile}"`);
          fs.writeFileSync(fullPath, content, 'utf-8');
          console.log(`Updated ${fullPath}`);
        }
      }
    }
  }
}

updateImports(pagesDir);
