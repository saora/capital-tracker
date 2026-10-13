import type { InvestmentSheetsData } from '../../services/google-sheets.service';
import { demoInvestments } from '../../services/investment-service';

import { presentPortfolio } from './portfolio.presenter';
import { renderPortfolioTemplate } from './portfolio.template';

export function renderPortfolio(connectedData?: InvestmentSheetsData): string {
  console.log('DEBUG: SE EJECUTA RENDER PORTFOLIO', {
    hasConnectedData: Boolean(connectedData),
    investmentsCount: connectedData?.investments.length,
  });
  
  const investments = connectedData?.investments ?? demoInvestments;
  const viewModel = presentPortfolio(
    investments,
    Boolean(connectedData),
    connectedData?.gainSummaryText,
  );
  return renderPortfolioTemplate(viewModel);
}
