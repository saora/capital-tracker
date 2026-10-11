
import type { Investment } from '../../../../types/investment';

export type HoldingsCategory = 'stocks' | 'bank-accounts';

export interface HoldingsListData {
  investments: Investment[];
  limit?: number;
  category?: HoldingsCategory;
}
