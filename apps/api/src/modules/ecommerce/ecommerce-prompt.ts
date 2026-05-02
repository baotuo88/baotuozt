export type EcommerceMode = 'main' | 'detail' | 'scene';

const ECOMMERCE_MODE_ENHANCERS: Record<EcommerceMode, string[]> = {
  main: ['clean background'],
  scene: ['realistic environment'],
  detail: ['highlight product features'],
};

export function getEcommerceEnhancers(mode: EcommerceMode): string[] {
  return ECOMMERCE_MODE_ENHANCERS[mode] ?? [];
}
