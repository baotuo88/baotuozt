export type PromptViolationCategory = 'sexual' | 'violence' | 'sensitive';

export interface PromptSafetyWordBank {
  sexual: string[];
  violence: string[];
  sensitive: string[];
}

export interface PromptSafetyResult {
  allowed: boolean;
  category?: PromptViolationCategory;
  matched_word?: string;
  message?: string;
}

export interface PromptWordBankRepository {
  getWordBank(): Promise<PromptSafetyWordBank>;
}

const DEFAULT_WORD_BANK: PromptSafetyWordBank = {
  sexual: ['裸露', '色情', '成人视频', '约炮', 'porn', 'nude', 'nsfw', 'sex'],
  violence: ['血腥', '虐杀', '爆头', '斩首', '恐怖袭击', 'kill', 'gore', 'behead'],
  sensitive: ['恐怖组织', '极端主义', '毒品交易', '仇恨言论', 'hate speech', 'bomb tutorial'],
};

function normalizeText(input: string): string {
  return input.toLowerCase().trim();
}

function findMatchedWord(input: string, words: string[]): string | undefined {
  const content = normalizeText(input);
  return words.find((word) => content.includes(normalizeText(word)));
}

export class PromptSafetyService {
  constructor(private readonly repository?: PromptWordBankRepository) {}

  async check(userInput?: string | null): Promise<PromptSafetyResult> {
    const content = (userInput ?? '').trim();
    if (!content) {
      return { allowed: true };
    }

    const bank = this.repository ? await this.repository.getWordBank() : DEFAULT_WORD_BANK;

    const sexualWord = findMatchedWord(content, bank.sexual);
    if (sexualWord) {
      return {
        allowed: false,
        category: 'sexual',
        matched_word: sexualWord,
        message: '输入内容包含违规色情信息，已拒绝生成。',
      };
    }

    const violenceWord = findMatchedWord(content, bank.violence);
    if (violenceWord) {
      return {
        allowed: false,
        category: 'violence',
        matched_word: violenceWord,
        message: '输入内容包含违规暴力信息，已拒绝生成。',
      };
    }

    const sensitiveWord = findMatchedWord(content, bank.sensitive);
    if (sensitiveWord) {
      return {
        allowed: false,
        category: 'sensitive',
        matched_word: sensitiveWord,
        message: '输入内容包含敏感词，已拒绝生成。',
      };
    }

    return { allowed: true };
  }
}
