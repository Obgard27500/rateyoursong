(function () {
  const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
  const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
  const API_ENDPOINT = "https://api.spotify.com/v1";

  const STORAGE_KEYS = {
    clientId: "spotify_client_id",
    token: "spotify_access_token",
    expiresAt: "spotify_token_expires_at",
    refreshToken: "spotify_refresh_token",
    verifier: "spotify_pkce_verifier",
    state: "spotify_auth_state"
  };

  const DEFAULT_CLIENT_ID = "";

  function getClientId() {
    return localStorage.getItem(STORAGE_KEYS.clientId) || DEFAULT_CLIENT_ID;
  }

  function setClientId(clientId) {
    if (!clientId) return;
    localStorage.setItem(STORAGE_KEYS.clientId, clientId);
  }

  function isTokenValid() {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.expiresAt) || 0);
    return Boolean(token) && Date.now() < expiresAt - 60_000;
  }

  function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let value = "";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let index = 0; index < length; index += 1) {
      value += chars[bytes[index] % chars.length];
    }
    return value;
  }

  async function sha256(value) {
    const data = new TextEncoder().encode(value);
    return crypto.subtle.digest("SHA-256", data);
  }

  function base64UrlEncode(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function getRedirectUri() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  async function startLogin() {
    const clientId = getClientId();
    if (!clientId) {
      throw new Error("SPOTIFY_CLIENT_ID manquant.");
    }

    const state = randomString(20);
    const verifier = randomString(96);
    const challenge = base64UrlEncode(await sha256(verifier));

    localStorage.setItem(STORAGE_KEYS.state, state);
    localStorage.setItem(STORAGE_KEYS.verifier, verifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: getRedirectUri(),
      code_challenge_method: "S256",
      code_challenge: challenge,
      state
    });

    window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
  }

  async function exchangeCodeForToken(code) {
    const clientId = getClientId();
    const verifier = localStorage.getItem(STORAGE_KEYS.verifier) || "";
    if (!clientId || !verifier) {
      throw new Error("Échange de token impossible.");
    }

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier
    });

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    if (!res.ok) {
      throw new Error("Connexion Spotify refusée.");
    }

    const tokenData = await res.json();
    persistToken(tokenData);
    localStorage.removeItem(STORAGE_KEYS.verifier);
    localStorage.removeItem(STORAGE_KEYS.state);
  }

  async function refreshAccessToken() {
    const clientId = getClientId();
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
    if (!clientId || !refreshToken) return false;

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    });

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    if (!res.ok) return false;

    const tokenData = await res.json();
    persistToken(tokenData);
    return true;
  }

  function persistToken(tokenData) {
    localStorage.setItem(STORAGE_KEYS.token, tokenData.access_token);
    localStorage.setItem(
      STORAGE_KEYS.expiresAt,
      String(Date.now() + Number(tokenData.expires_in || 3600) * 1000)
    );

    if (tokenData.refresh_token) {
      localStorage.setItem(STORAGE_KEYS.refreshToken, tokenData.refresh_token);
    }
  }

  async function bootstrapAuth() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const storedState = localStorage.getItem(STORAGE_KEYS.state);

    if (code) {
      if (!state || !storedState || state !== storedState) {
        throw new Error("État OAuth invalide.");
      }
      await exchangeCodeForToken(code);
      params.delete("code");
      params.delete("state");
      const cleaned = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", cleaned);
    }

    return isTokenValid();
  }

  async function getAccessToken(options = {}) {
    if (isTokenValid()) {
      return localStorage.getItem(STORAGE_KEYS.token) || "";
    }

    const refreshed = await refreshAccessToken();
    if (refreshed && isTokenValid()) {
      return localStorage.getItem(STORAGE_KEYS.token) || "";
    }

    if (options.interactive) {
      await startLogin();
      throw new Error("Redirection vers Spotify...");
    }

    throw new Error("Session Spotify expirée.");
  }

  async function apiFetch(path, params = {}) {
    const token = await getAccessToken();
    const url = new URL(`${API_ENDPOINT}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        throw new Error("Session Spotify expirée.");
      }
      return apiFetch(path, params);
    }

    if (!res.ok) {
      throw new Error("Erreur Spotify API.");
    }

    return res.json();
  }

  async function search(query, types, limit, offset) {
    return apiFetch("/search", {
      q: query,
      type: types.join(","),
      limit,
      offset
    });
  }

  async function getAlbum(id) {
    return apiFetch(`/albums/${encodeURIComponent(id)}`);
  }

  async function getTrack(id) {
    return apiFetch(`/tracks/${encodeURIComponent(id)}`);
  }

  window.spotifyApi = {
    bootstrapAuth,
    getAccessToken,
    startLogin,
    search,
    getAlbum,
    getTrack,
    getClientId,
    setClientId,
    isTokenValid
  };
})();
