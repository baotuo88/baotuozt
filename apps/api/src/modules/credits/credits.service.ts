import type { GenerateMode } from '../style-system';

export interface CreditRule {
  mode: GenerateMode;
  cost: number;
}

export interface CreditDeductionReceipt {
  deduction_id: string;
  user_id: number;
  credits_used: number;
  mode: GenerateMode;
  created_at: string;
}

export interface CreditsRepository {
  atomicDeduct(params: {
    user_id: number;
    credits: number;
    mode: GenerateMode;
  }): Promise<{ deduction_id: string; balance_after: number } | null>;
  rollbackDeduction(deductionId: string): Promise<void>;
  rollbackByTaskId(taskId: number): Promise<void>;
}

const CREDIT_RULES: Record<GenerateMode, number> = {
  ecommerce: 5,
  portrait: 2,
  social: 1,
  general: 1,
};

export function getCreditsCost(mode: GenerateMode): number {
  return CREDIT_RULES[mode] ?? 1;
}

export class CreditsService {
  constructor(private readonly creditsRepository: CreditsRepository) {}

  async deductForGeneration(userId: number, mode: GenerateMode): Promise<CreditDeductionReceipt> {
    const credits = getCreditsCost(mode);

    const result = await this.creditsRepository.atomicDeduct({
      user_id: userId,
      credits,
      mode,
    });

    if (!result) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    return {
      deduction_id: result.deduction_id,
      user_id: userId,
      credits_used: credits,
      mode,
      created_at: new Date().toISOString(),
    };
  }

  async rollbackDeduction(deductionId: string): Promise<void> {
    await this.creditsRepository.rollbackDeduction(deductionId);
  }

  async rollbackByTaskId(taskId: number): Promise<void> {
    await this.creditsRepository.rollbackByTaskId(taskId);
  }
}
