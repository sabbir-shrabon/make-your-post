export type PageConnection = {
  id: number
  facebook_page_id?: string
  page_id: string
  page_name: string
  profile_picture_url?: string | null
  page_picture_url?: string | null
  connection_status: string
  connected_at: string
  disconnected_at?: string | null
  reconnect_count?: number
  post_count?: number
  scheduled_post_count?: number
  paused_post_count?: number
}

export type Post = {
  id: number
  content: string
  status: string
  posted_at?: string | null
  scheduled_at?: string | null
  media_urls: string[]
  image_url?: string | null
  image_status?: string | null
  link_url?: string | null
  page_name?: string | null
  page_picture_url?: string | null
  facebook_connection_id?: number | null
  page_connection_id?: number | null
  page_id?: string | null
  persona_name?: string | null
  failure_reason?: string | null
  ai_generated: boolean
  auto_generated: boolean
  likes_count?: number
  comments_count?: number
  shares_count?: number
  reach_count?: number
  engagement_score?: number
  low_engagement?: boolean
  facebook_post_id?: string | null
  error_message?: string | null
}

export type AIPersona = {
  id?: number
  page_connection_id?: number
  persona_name: string
  niche: string
  tone_tags: string[]
  custom_instructions: string | null
  prompt_config?: PromptStudioConfig | null
  custom_prompt?: string | null
  creativity_level: number
  language: string
  hashtags_enabled: boolean
  hashtag_count: number
  always_include_engagement_hook: boolean
  assigned_days: string[]
  posting_time_slots: string[]
  priority_level: "High" | "Normal" | "Low"
  is_active: boolean
  learning_mode_enabled: boolean
  minimum_engagement_threshold: number
  include_image?: boolean
  image_fallback_policy?: "text_only" | "use_library" | "skip_post"
  performance_score?: number
  template_image_generation_enabled?: boolean
  template_logo_url?: string | null
  template_layers_json?: any | null
  template_reference_image_url?: string | null
  total_posts_published?: number
  learned_patterns_summary?: string | null
  brand_palette_id?: string | null
  brand_font_pair_id?: string | null
  content_mode?: "standard" | "meme" | "hybrid"
  meme_format_preference?: "modern_card" | "classic"
  meme_theme_id?: string | null
}

export type PromptStudioConfig = {
  template: string
  audience: string
  goal: string
  brand_personality: string[]
  always_topics: string[]
  never_topics: string[]
  every_post_includes: string[]
  never_do: string[]
  length: "Short" | "Medium" | "Long"
  structure: string
  examples: string
}

export type PerformanceInsights = {
  enabled: boolean
  reason?: string | null
  persona_scores: { id: number; name: string; score: number }[]
  time_slot_heatmap: { day: string; hour: number; average_score: number }[]
  top_posts: {
    id: number
    content: string
    persona_name: string
    published_at?: string | null
    likes_count: number
    comments_count: number
    shares_count: number
    reach_count: number
    engagement_score: number
  }[]
  recommendations: { id: number; text: string; generated_at: string }[]
}

export type Analytics = {
  total_posts: number
  total_likes: number
  total_comments: number
  total_shares: number
  posts_per_day: { date: string; count: number }[]
}

export type DashboardIntelligence = {
  next_scheduled_post?: { id: number; content: string; scheduled_at?: string | null; minutes_until: number } | null
  last_published_post?: { id: number; content: string; posted_at?: string | null; likes_count: number; comments_count: number; shares_count: number; reach_count: number; engagement_score: number } | null
  facebook_connections: { id: number; page_name: string; status: string; token_expires_at?: string | null }[]
  cron_health: { ok: boolean; last_run_at?: string | null; age_seconds?: number | null }
  onboarding_steps: { label: string; done: boolean; href: string }[]
  learned_insights: {
    best_post?: { id: number; content: string; score: number; insight: string } | null
    best_time_slot?: { slot: string; score: number; insight: string } | null
    best_persona?: { id: number; name: string; score: number; insight: string } | null
  }
  action_items: { id: string; text: string; action_label: string; href: string; priority: string }[]
  warnings: { level: "red" | "amber"; text: string; href: string }[]
}

export type StyleAnalysis = {
  id: number
  source_type: string
  source_identifier: string
  page_name?: string | null
  report: any
  created_at: string
}

export type TrackerDashboard = {
  tracked_pages: { id: number; nickname: string; page_identifier: string; page_name?: string | null; is_active: boolean; last_checked_at?: string | null }[]
  posts: { id: number; page_name: string; content: string; posted_at?: string | null; likes_count: number; comments_count: number; shares_count: number; engagement_score: number; topic?: string | null }[]
  comparison: { id: number; nickname: string; posts: number; average_likes: number; average_comments: number; average_shares: number; most_active_day: string; most_used_topics: string }[]
  trends: { id: number; topic: string; summary: string; page_count: number; generated_at: string }[]
}

export type ScheduledSlotItem = {
  id: string
  type: "persona_slot" | "manual_post"
  persona_name: string
  content_preview?: string | null
  scheduled_at: string
  scheduled_at_local: string
  status: string
  error_message?: string | null
}

export type GlobalModelSettings = {
  post_generation_provider: "openai" | "gemini" | "anthropic" | "mistral"
  post_generation_model: string
  image_generation_provider: "gemini" | "openai" | "stability"
  image_generation_model: string
}

