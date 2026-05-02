import type { PromptSafetyWordBank, PromptWordBankRepository } from './prompt-safety.service';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

interface ConfigRow {
  value: PromptSafetyWordBank;
}

const DEFAULT_WORD_BANK: PromptSafetyWordBank = {
  sexual: ['裸露', '色情', '成人视频', '约炮', 'porn', 'nude', 'nsfw', 'sex'],
  violence: ['血腥', '虐杀', '爆头', '斩首', '恐怖袭击', 'kill', 'gore', 'behead'],
  sensitive: ['恐怖组织', '极端主义', '毒品交易', '仇恨言论', 'hate speech', 'bomb tutorial'],
};

export class PromptWordBankPgRepository implements PromptWordBankRepository {
  constructor(private readonly pg: PgClientLike) {}

  async getWordBank(): Promise<PromptSafetyWordBank> {
    const result = await this.pg.query<ConfigRow>(
      `SELECT value
       FROM system_config
       WHERE key = $1
       LIMIT 1`,
      ['prompt_safety_word_bank'],
    );

    const value = result.rows[0]?.value;
    if (!value) {
      return DEFAULT_WORD_BANK;
    }

    return {
      sexual: Array.isArray(value.sexual) ? value.sexual : DEFAULT_WORD_BANK.sexual,
      violence: Array.isArray(value.violence) ? value.violence : DEFAULT_WORD_BANK.violence,
      sensitive: Array.isArray(value.sensitive) ? value.sensitive : DEFAULT_WORD_BANK.sensitive,
    };
  }
}
