export interface UserFeatureFlags {
  show_new_feature: boolean;
  enable_new_model: boolean;
}

export type UserFeatureFlagsPatch = Partial<UserFeatureFlags>;

const DEFAULT_USER_FEATURE_FLAGS: UserFeatureFlags = {
  show_new_feature: false,
  enable_new_model: false,
};

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }

  return false;
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch (_error) {
      return {};
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function getDefaultUserFeatureFlags(): UserFeatureFlags {
  return { ...DEFAULT_USER_FEATURE_FLAGS };
}

export function normalizeUserFeatureFlags(value: unknown): UserFeatureFlags {
  const raw = toObject(value);
  return {
    show_new_feature: toBoolean(raw.show_new_feature),
    enable_new_model: toBoolean(raw.enable_new_model),
  };
}

export function normalizeUserFeatureFlagsPatch(value: unknown): UserFeatureFlagsPatch {
  const raw = toObject(value);
  const patch: UserFeatureFlagsPatch = {};

  if (Object.prototype.hasOwnProperty.call(raw, 'show_new_feature')) {
    patch.show_new_feature = toBoolean(raw.show_new_feature);
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'enable_new_model')) {
    patch.enable_new_model = toBoolean(raw.enable_new_model);
  }

  return patch;
}

