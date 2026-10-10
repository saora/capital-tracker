import type { Investment } from '../../../../types/investment';

export interface HoldingsListData {
  investments: Investment[];
  limit?: number;
}