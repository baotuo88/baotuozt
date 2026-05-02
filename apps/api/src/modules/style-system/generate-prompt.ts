export type GenerateMode = 'ecommerce' | 'social' | 'portrait' | 'general';

export interface StyleConfig {
  id?: number;
  version?: number;
  prompt_template?: string | null;
  lighting?: string | null;
  composition?: string | null;
  camera?: string | null;
  details?: string | null;
  color_style?: string | null;
  quality_booster?: string | null;
  negative_prompt?: string | null;
}

export interface GeneratePromptInput {
  user_input?: string | null;
  style: StyleConfig;
  mode: GenerateMode;
  extra_enhancers?: string[];
}

export interface GeneratePromptResult {
  prompt: string;
  negative_prompt: string;
}

const MODE_ENHANCERS: Record<GenerateMode, string[]> = {
  ecommerce: ['high conversion', 'product focused'],
  social: ['viral', 'eye-catching'],
  portrait: ['realistic skin', 'natural light'],
  general: ['creative'],
};

const GLOBAL_QUALITY_TAGS = 'masterpiece, best quality, ultra detailed';

function cleanSegment(value?: string | null): string {
  return (value ?? '').trim();
}

function joinPromptSegments(segments: Array<string | null | undefined>): string {
  return segments
    .map(cleanSegment)
    .filter(Boolean)
    .join(', ');
}

export function generatePrompt({
  user_input,
  style,
  mode,
  extra_enhancers = [],
}: GeneratePromptInput): GeneratePromptResult {
  const modeEnhancers = MODE_ENHANCERS[mode] ?? [];

  const prompt = joinPromptSegments([
    user_input,
    style.prompt_template,
    style.lighting,
    style.composition,
    style.camera,
    style.details,
    style.color_style,
    style.quality_booster,
    ...modeEnhancers,
    ...extra_enhancers,
    GLOBAL_QUALITY_TAGS,
  ]);

  const negative_prompt = cleanSegment(style.negative_prompt);

  return {
    prompt,
    negative_prompt,
  };
}
