type UnauthorizedHandler = () => void;

let authToken: string | null = null;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler;
};

const getErrorMessage = async (response: Response, fallback: string) => {
  const data = await response.json().catch(() => null);
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail?: string }).detail;
    if (detail) {
      return detail;
    }
  }
  return fallback;
};

export const apiFetch = async (url: string, init: RequestInit = {}, withAuth = true) => {
  const headers = new Headers(init.headers);
  if (withAuth && authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (response.status === 401 && unauthorizedHandler) {
    unauthorizedHandler();
  }

  return response;
};

export const fetchJson = async <T>(
  url: string,
  init: RequestInit,
  fallbackError: string,
  withAuth = true
): Promise<T> => {
  const response = await apiFetch(url, init, withAuth);

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackError));
  }

  return response.json() as Promise<T>;
};

export const fetchEmpty = async (
  url: string,
  init: RequestInit,
  fallbackError: string,
  withAuth = true
) => {
  const response = await apiFetch(url, init, withAuth);
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackError));
  }
};