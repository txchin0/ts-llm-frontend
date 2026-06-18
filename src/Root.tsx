import { App } from './App.tsx';
import { OAuthConnectedPage } from './components/OAuthConnectedPage.tsx';

const path = window.location.pathname.replace(/\/$/, '') || '/';
const isOAuthConnected = path === '/oauth/connected';

export function Root() {
  return isOAuthConnected ? <OAuthConnectedPage /> : <App />;
}
