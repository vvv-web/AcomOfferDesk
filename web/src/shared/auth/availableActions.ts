import type { AuthLink } from '@shared/api/loginWebUser';

type SessionWithAvailableAction = {
  availableActions?: AuthLink[];
} | null | undefined;

const normalizeMethod = (method: string) => method.trim().toUpperCase();

const normalizeHref = (href: string) => {
  const normalized = href.trim();
  if (!normalized) {
    return normalized;
  }

  const url = normalized.startsWith('http')
    ? new URL(normalized)
    : new URL(normalized, 'http://local');

  const pathname = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  return pathname || '/';
};

export const findAvailableAction  = (
  session: SessionWithAvailableAction,
  href: string,
  method: string
): AuthLink | null => {
  const availableActions = session?.availableActions ?? [];
  if (!availableActions.length) {
    return null;
  }

  return (
    availableActions.find(
      (availableAction) =>
        normalizeHref(availableAction.href) === normalizeHref(href) &&
        normalizeMethod(availableAction.method) === normalizeMethod(method)
    ) ?? null
  );
};

export const hasAvailableAction = (
  session: SessionWithAvailableAction,
  href: string,
  method: string
): boolean => Boolean(findAvailableAction(session, href, method));