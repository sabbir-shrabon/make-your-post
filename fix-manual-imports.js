const fs = require('fs');

const data = {
  'frontend/src/components/dashboard/views/style-analyzer-view.tsx': `import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
`,
  'frontend/src/components/dashboard/views/page-tracker-view.tsx': `import Link from "next/link"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
`,
  'frontend/src/components/dashboard/views/composer-view.tsx': `import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { api, getApiErrorMessage } from "@/lib/api"
`,
  'frontend/src/components/dashboard/views/home-view.tsx': `import { RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
`,
  'frontend/src/components/dashboard/views/scheduled-slots-view.tsx': `import { CalendarClock, Loader2, Sparkles, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
`
};

for (const [file, imports] of Object.entries(data)) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/import \{ PageTitle.*?dashboard-ui"\n/, '$&\n' + imports);
  fs.writeFileSync(file, content);
}
