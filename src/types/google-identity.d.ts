interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(options: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { message?: string }) => void;
  }): GoogleTokenClient;
}

interface GoogleIdentity {
  accounts: {
    oauth2: GoogleOAuth2;
  };
}

interface Window {
  google?: GoogleIdentity;
}