
import './styles/tokens.css';
import './styles/reset.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';

import './features/auth/session-header.css';
import './components/skeleton-loader/skeleton-loader.css';
import './features/auth/auth.css';
import './features/dashboard/dashboard.css';
import './features/transactions/transactions.css';
import './components/asset-logo/asset-logo.css';
import './components/bottom-nav/bottom-nav.css';
import './main.css';

import { initializeApp } from './app/app-controller';

const appElement =
  document.querySelector<HTMLDivElement>('#app');

if (!appElement) {
  throw new Error(
    'Application root element "#app" was not found.',
  );
}

initializeApp(appElement);
