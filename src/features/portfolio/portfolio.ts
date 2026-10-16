import type { InvestmentSheetsData } from '../../services/google-sheets.service';
import { demoInvestments } from '../../services/investment-service';

import { presentPortfolio } from './portfolio.presenter';
import { renderPortfolioTemplate } from './portfolio.template';

import type { PortfolioProvider } from './portfolio.types';

export function renderPortfolio(
  connectedData?: InvestmentSheetsData,
  provider: PortfolioProvider = 'GBM',
): string {
  const investments = connectedData?.investments ?? demoInvestments.map((item) => ({
    ...item,
    location: item.symbol === 'BTC' ? 'BITSO' : 'GBM',
  }));
  const providerInvestedCapital = provider === 'GBM'
    ? connectedData?.entryCapitalByProvider?.GBM
    : provider === 'BITSO'
      ? connectedData?.entryCapitalByProvider?.BITSO
      : undefined;
  const viewModel = presentPortfolio(
    investments,
    Boolean(connectedData),
    provider,
    providerInvestedCapital,
  );
  return renderPortfolioTemplate(viewModel);
}
