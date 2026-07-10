/**
 * Runtime API paths — imported from protocol/endpoints.json so the web client
 * cannot drift from the fixture the mock server and Kotlin tests also use.
 */
import endpoints from '../../protocol/endpoints.json';

export const RESPOND_PATH = endpoints.respond;
export const AUTH_REGISTER_PATH = endpoints.authRegister;
export const AUTH_LOGIN_PATH = endpoints.authLogin;
export const AUTH_REFRESH_PATH = endpoints.authRefresh;
export const AUTH_LOGOUT_PATH = endpoints.authLogout;
export const TASKS_PATH = endpoints.tasks;
export const INTEGRATIONS_PATH = endpoints.integrations;
export const OAUTH_CONNECT_TOKEN_PATH = endpoints.oauthConnectToken;
export const OAUTH_STATUS_PATH = endpoints.oauthStatus;
export const OAUTH_START_PATH = endpoints.oauthStart;
export const OAUTH_DISCONNECT_PATH = endpoints.oauthDisconnect;
export const OAUTH_PROVIDER_SAMPLE = endpoints.oauthProviderSample;

/** Directory prefix shared by the four auth routes (handy for tests/docs). */
export const AUTH_PATH_PREFIX = AUTH_REGISTER_PATH.replace(/\/register$/, '');
