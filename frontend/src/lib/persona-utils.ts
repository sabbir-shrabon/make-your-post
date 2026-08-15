import { AIPersona, PromptStudioConfig } from "@/types/models"

export const includeOptions = ["A question at the end", "A call to action", "Emojis", "A personal story angle", "A surprising fact", "A numbered list", "A relatable struggle"]
export const neverOptions = ["Use formal language", "Use slang", "Make promises", "Use more than 5 hashtags", "Start with the word 'I'", "Use exclamation marks excessively"]
export const structureOptions = ["No fixed structure, let AI decide", "Hook then value then CTA", "Story then lesson then question", "Fact then explanation then opinion", "List format", "Single powerful statement"]
export const llmProviderModels: Record<string, string[]> = {
  mistral: ["mistral-large-latest", "mistral-small-latest"],
  gemini: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"],
}

export type ModelPreference = {
  provider_name: string
  model_name: string
  configured?: boolean
}

export type ModelProviderOption = {
  id: string
  label: string
  models: { id: string; label: string }[]
  configured: boolean
}

export function emptyPromptConfig(): PromptStudioConfig {
  return {
    template: "Custom (blank)",
    audience: "",
    goal: "Educate my audience",
    brand_personality: ["Friendly", "Professional"],
    always_topics: [],
    never_topics: [],
    every_post_includes: ["A question at the end"],
    never_do: ["Make promises"],
    length: "Medium",
    structure: "No fixed structure, let AI decide",
    examples: "",
  }
}

export type PersonaTemplateDefault = Omit<Partial<AIPersona>, "prompt_config"> & { prompt_config?: Partial<PromptStudioConfig> }

export const templateDefaults: Record<string, PersonaTemplateDefault> = {
  "E-commerce Product Page": { niche: "products that help customers solve everyday problems", tone_tags: ["Friendly", "Professional"], prompt_config: { goal: "Sell a product or service", every_post_includes: ["A call to action", "A question at the end"], structure: "Hook then value then CTA" } },
  "Personal Brand / Creator": { niche: "personal stories, lessons, and useful ideas from a creator", tone_tags: ["Friendly", "Casual"], prompt_config: { goal: "Build a community", every_post_includes: ["A personal story angle", "A question at the end"], structure: "Story then lesson then question" } },
  "Local Restaurant": { niche: "local food, menu highlights, offers, and community moments", tone_tags: ["Friendly", "Energetic"], prompt_config: { goal: "Sell a product or service", every_post_includes: ["Emojis", "A call to action"], structure: "Hook then value then CTA" } },
  "Real Estate Agent": { niche: "real estate advice, market updates, and property buying guidance", tone_tags: ["Professional", "Authoritative"], prompt_config: { goal: "Educate my audience", structure: "Fact then explanation then opinion" } },
  "Fitness Coach": { niche: "fitness, nutrition, consistency, and healthy lifestyle coaching", tone_tags: ["Energetic", "Empathetic"], prompt_config: { goal: "Inspire and motivate", every_post_includes: ["A relatable struggle", "A call to action"] } },
  "Educational Content": { niche: "clear educational posts that make complex topics simple", tone_tags: ["Professional", "Friendly"], prompt_config: { goal: "Educate my audience", every_post_includes: ["A surprising fact", "A question at the end"], structure: "Fact then explanation then opinion" } },
  "News and Commentary": { niche: "timely news, commentary, and analysis", tone_tags: ["Authoritative", "Professional"], prompt_config: { goal: "Educate my audience", structure: "Fact then explanation then opinion" } },
  "Motivational Page": { niche: "motivation, mindset, discipline, and personal growth", tone_tags: ["Bold", "Empathetic"], prompt_config: { goal: "Inspire and motivate", structure: "Single powerful statement" } },
  "Tech and Startup": { niche: "technology, startups, product building, and business lessons", tone_tags: ["Witty", "Professional"], prompt_config: { goal: "Educate my audience", structure: "Hook then value then CTA" } },
  "Viral Meme & Scenario Creator": { niche: "relatable workplace humor, tech satire, everyday struggles, and situational meme comedy", tone_tags: ["Witty", "Humorous", "Casual"], content_mode: "meme", meme_format_preference: "modern_card", meme_theme_id: "tech-startups", prompt_config: { goal: "Entertain with viral memes", every_post_includes: ["A relatable struggle", "Emojis"], structure: "No fixed structure, let AI decide" } },
}

export function emptyPersona(): AIPersona {
  return {
    persona_name: "",
    niche: "",
    tone_tags: ["Professional"],
    custom_instructions: "",
    prompt_config: emptyPromptConfig(),
    custom_prompt: "",
    creativity_level: 7,
    language: "English",
    hashtags_enabled: false,
    hashtag_count: 5,
    always_include_engagement_hook: false,
    assigned_days: [],
    posting_time_slots: ["09:00"],
    priority_level: "Normal",
    is_active: true,
    learning_mode_enabled: true,
    minimum_engagement_threshold: 0,
    include_image: false,
    image_fallback_policy: "text_only",
    template_image_generation_enabled: false,
    template_logo_url: null,
    template_layers_json: null,
    template_reference_image_url: null,
    brand_palette_id: null,
    brand_font_pair_id: null,
    content_mode: "standard",
    meme_format_preference: "modern_card",
    meme_theme_id: "tech-startups",
  }
}

export function promptConfig(persona: AIPersona): PromptStudioConfig {
  return { ...emptyPromptConfig(), ...(persona.prompt_config || {}), brand_personality: persona.tone_tags.length ? persona.tone_tags : persona.prompt_config?.brand_personality || [] }
}

export function buildSimplePrompt(persona: AIPersona) {
  const config = promptConfig(persona)
  const parts = [
    `Write a Facebook post for a page about ${persona.niche || "[what this page is about]"}.`,
    config.audience ? `The audience is ${config.audience}.` : "",
    config.goal ? `The main goal is to ${config.goal.toLowerCase()}.` : "",
    persona.tone_tags.length ? `Use a ${persona.tone_tags.join(", ").toLowerCase()} brand personality.` : "",
    config.always_topics.length ? `Always write about: ${config.always_topics.join(", ")}.` : "",
    config.never_topics.length ? `Never write about: ${config.never_topics.join(", ")}.` : "",
    config.every_post_includes.length ? `Every post should include: ${config.every_post_includes.join(", ")}.` : "",
    config.never_do.length ? `Posts must never: ${config.never_do.join(", ").toLowerCase()}.` : "",
    `Aim for ${config.length.toLowerCase()} length.`,
    config.structure !== "No fixed structure, let AI decide" ? `Structure posts as: ${config.structure}.` : "Use the best structure for the idea.",
    persona.language ? `Write in ${persona.language}.` : "",
    config.examples ? `Study these style examples and match their feel:\n${config.examples}` : "",
    persona.custom_instructions ? persona.custom_instructions : "",
  ].filter(Boolean)
  return parts.join(" ")
}

export function buildRawPrompt(persona: AIPersona) {
  return [
    "SYSTEM: You are a professional Facebook content writer. Return only the finished post text, with no labels or commentary.",
    `CREATIVITY: ${persona.creativity_level}/10.`,
    `USER PROMPT: ${buildSimplePrompt(persona)}`,
  ].join("\n\n")
}

export function applyTemplate(persona: AIPersona, template: string): AIPersona {
  const baseConfig = promptConfig(persona)
  const defaults = templateDefaults[template] || {}
  return {
    ...persona,
    ...defaults,
    prompt_config: { ...baseConfig, ...(defaults.prompt_config || {}), template },
    tone_tags: defaults.tone_tags || persona.tone_tags,
  }
}
