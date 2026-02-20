import { apiFetch } from './client';
const resolveBaseUrl = () => {
  

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
};

const buildAbsoluteUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.replace(/^\//, '');
  const baseUrl = resolveBaseUrl();

  if (!baseUrl) {
    return `/${normalizedPath}`;
  }

  return `${baseUrl}/${normalizedPath}`;
};

const toRequestPath = (path: string) => {
  if (!path) {
    return path;
  }

  if (/^https?:\/\//i.test(path)) {
    const parsed = new URL(path);
    return `${parsed.pathname}${parsed.search}`;
  }

  return path.startsWith('/') ? path : `/${path}`;
};

export const getDownloadUrl = (fileId?: number | null, filePath?: string | null): string | null => {
  if (fileId) {
    return buildAbsoluteUrl(`/api/v1/files/${fileId}/download`);
  }

  if (filePath) {
    return buildAbsoluteUrl(filePath);
  }

  return null;
};

export const downloadFile = async (downloadUrl: string, fileName: string) => {
  const response = await apiFetch(toRequestPath(downloadUrl), { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Ошибка скачивания файла: ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};