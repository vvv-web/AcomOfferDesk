type UnauthorizedHandler = () => void;

let authToken: string | null = null;
let unauthorizedHandler: UnauthorizedHandler | null = null;

const ERROR_TRANSLATIONS: Record<string, string> = {
  'User is not active': 'Пользователь неактивен',
  'User not found': 'Пользователь не найден',
  'TG user not found': 'Telegram-пользователь не найден',
  'Contractor not found': 'Контрагент не найден',
  'Owner user not found': 'Ответственный пользователь не найден',

  'Invalid credentials': 'Неверный логин или пароль',
  'Current password is invalid': 'Текущий пароль указан неверно',
  'Missing credentials': 'Отсутствуют учетные данные',
  'Token expired': 'Срок действия токена истек',
  'Invalid token': 'Некорректный токен',
  'Invalid token payload': 'Некорректные данные токена',
  'Link expired': 'Срок действия ссылки истек',

  'Access denied': 'Доступ запрещен',
  'Insufficient permissions to access own profile': 'Недостаточно прав для доступа к своему профилю',
  'Insufficient permissions for request management': 'Недостаточно прав для управления заявками',
  'Insufficient permissions for open requests': 'Недостаточно прав для просмотра открытых заявок',
  'Insufficient permissions to view chat': 'Недостаточно прав для просмотра чата',
  'Insufficient permissions to send chat message': 'Недостаточно прав для отправки сообщения в чат',
  'Insufficient permissions for file download': 'Недостаточно прав для скачивания файла',
  'Only admin, superadmin and lead economist can manage economist users':
    'Только администратор, суперадмин и ведущий экономист могут управлять экономистами',
  'Only admin, superadmin, lead economist and project manager can manage economist users':
    'Только администратор, суперадмин, ведущий экономист и руководитель проекта могут управлять экономистами',
  'Only contractor can manage company contacts': 'Только контрагент может управлять данными компании',
  'Only contractor can create offers': 'Только контрагент может создавать офферы',
  'Only contractor can view offered requests': 'Только контрагент может просматривать свои заявки',
  'Lead economist and project manager can view only economist users':
    'Ведущий экономист и руководитель проекта могут просматривать только экономистов',
  'Lead economist can create only economist users': 'Ведущий экономист может создавать только экономистов',

  'Lead economist and project manager can update status only for economist users':
    'Ведущий экономист и руководитель проекта могут менять статус только у экономистов',
  'Lead economist and project manager can create only economist users':
    'Ведущий экономист и руководитель проекта могут создавать только экономистов',
  'Lead economist can view only economist users': 'Ведущий экономист может просматривать только экономистов',
  'Lead economist can update status only for economist users':
    'Ведущий экономист может менять статус только у экономистов',
  'Admin can create only economist and operator users': 'Администратор может создавать только экономистов и операторов',
  'Superadmin cannot create superadmin users': 'Суперадмин не может создавать суперадминов',
  'Only admin and superadmin can update user roles': 'Только администратор и суперадмин могут изменять роли пользователей',
  'Only admin and economist roles are allowed for update': 'Изменение возможно только на роли администратора и экономиста',
  'Economist user must have a lead economist manager': 'Для экономиста необходимо указать руководителя с ролью ведущего экономиста',
  'Economist user can have only lead economist manager': 'Руководителем экономиста может быть только ведущий экономист',
  'Lead economist user must have a project manager': 'Для ведущего экономиста необходимо указать руководителя проекта',
  'Lead economist user can have only project manager': 'Руководителем ведущего экономиста может быть только руководитель проекта',
  'Parent user not found': 'Руководитель не найден',
  'Superadmin role cannot be changed': 'Роль суперадмина нельзя изменить',
  'Economist can edit only own requests': 'Экономист может редактировать только свои заявки',
  'Only lead economist and superadmin can change request owner':
    'Только ведущий экономист и суперадмин могут менять ответственного по заявке',
  'Only lead economist, project manager and superadmin can change request owner':
    'Только ведущий экономист, руководитель проекта и суперадмин могут менять ответственного по заявке',
  'Contractor can view only own profile': 'Контрагент может просматривать только свой профиль',
  'Contractor can access only own offers': 'Контрагент может работать только со своими офферами',

  'Request not found': 'Заявка не найдена',
  'Open request not found': 'Открытая заявка не найдена',
  'Request offer stats not found': 'Статистика офферов по заявке не найдена',
  'Offer not found': 'Оффер не найден',
  'Chat not found': 'Чат не найден',
  'File not found': 'Файл не найден',
  'File content not found': 'Содержимое файла не найдено',
  'File is not attached to request': 'Файл не прикреплен к заявке',
  'File is not attached to offer': 'Файл не прикреплен к офферу',

  'Role is not allowed for creation': 'Создание пользователя с этой ролью запрещено',
  'User already exists': 'Пользователь уже существует',
  'TG user already linked': 'Этот Telegram уже привязан к другому пользователю',
  'User has no linked Telegram account': 'У пользователя нет привязанного Telegram-аккаунта',
  'Economist requires full_name and phone': 'Для экономиста обязательны ФИО и телефон',
  'Company contacts not found': 'Контакты компании не найдены',

  'Unsupported users.status value': 'Неподдерживаемое значение статуса пользователя',
  'Unsupported tg_users.status value': 'Неподдерживаемое значение статуса Telegram',
  'Unsupported request status': 'Неподдерживаемый статус заявки',
  'Unsupported offer status': 'Неподдерживаемый статус оффера',

  'Deadline cannot be in the past': 'Дедлайн не может быть в прошлом',
  'At least one file is required': 'Нужно прикрепить хотя бы один файл',
  'Offer for this request already exists': 'Оффер по этой заявке уже существует',
  'Cannot edit files for finalized offer': 'Нельзя редактировать файлы у завершенного оффера',
  'Message text cannot be empty': 'Текст сообщения не может быть пустым',
  'Too many attachments': 'Слишком много вложений',
  'Attachments total size exceeded': 'Превышен общий размер вложений',

  'File name is required': 'Необходимо указать имя файла',
  'Unsafe file name': 'Недопустимое имя файла',
  'Forbidden file type': 'Тип файла запрещен',
  'Unsupported file extension': 'Неподдерживаемое расширение файла',
  'File cannot be empty': 'Файл не может быть пустым',
  'File too large': 'Файл слишком большой',
  'File content does not match extension': 'Содержимое файла не соответствует расширению',

  'TG links are not configured': 'Telegram-ссылки не настроены',
  'Public backend URL is not configured': 'Публичный URL backend не настроен',

  Forbidden: 'Доступ запрещен'
};

const STATUS_FALLBACK_TRANSLATIONS: Record<number, string> = {
  400: 'Некорректный запрос',
  401: 'Требуется авторизация',
  403: 'Доступ запрещен',
  404: 'Ресурс не найден',
  409: 'Конфликт данных',
  413: 'Файл слишком большой. Уменьшите размер и повторите попытку',
  422: 'Ошибка валидации данных',
  429: 'Слишком много запросов. Попробуйте позже',
  500: 'Внутренняя ошибка сервера',
  502: 'Сервер временно недоступен. Попробуйте позже',
  503: 'Сервис временно недоступен. Попробуйте позже',
  504: 'Сервер не ответил вовремя. Попробуйте позже'
};

const VALIDATION_TRANSLATIONS: Record<string, string> = {
  'Field required': 'Поле обязательно для заполнения',
  'Input should be a valid string': 'Значение должно быть строкой',
  'Input should be a valid integer': 'Значение должно быть целым числом',
  'Input should be greater than or equal to 1': 'Значение должно быть больше или равно 1',
  'String should have at least 1 character': 'Минимум 1 символ',
  'String should have at least 8 characters': 'Минимум 8 символов',
  'String should have at most 255 characters': 'Максимум 255 символов'
};

const translateText = (message: string | null | undefined): string | null => {
  const normalized = (message ?? '').trim();
  if (!normalized) {
    return null;
  }
  return ERROR_TRANSLATIONS[normalized] ?? VALIDATION_TRANSLATIONS[normalized] ?? normalized;
};

const humanizeLoc = (loc: unknown): string => {
  if (!Array.isArray(loc)) {
    return 'Поле';
  }
  const parts = loc
    .filter((item) => typeof item === 'string' && item !== 'body' && item !== 'query' && item !== 'path')
    .map((item) => String(item));
  if (!parts.length) {
    return 'Поле';
  }
  return parts.join('.');
};

const extractDetailMessage = (detail: unknown): string | null => {
  if (typeof detail === 'string') {
    return translateText(detail);
  }

  if (Array.isArray(detail)) {
    const validationMessages = detail
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const msg = translateText((item as { msg?: string }).msg);
        if (!msg) {
          return null;
        }
        const loc = humanizeLoc((item as { loc?: unknown }).loc);
        return `${loc}: ${msg}`;
      })
      .filter((value): value is string => Boolean(value));

    if (validationMessages.length) {
      return validationMessages.join('; ');
    }
  }

  if (detail && typeof detail === 'object' && 'message' in detail) {
    return translateText((detail as { message?: string }).message);
  }

  return null;
};

const translateErrorMessage = (message: string | null | undefined, fallback: string): string => {
  return translateText(message) ?? fallback;
};


export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler;
};

const getErrorMessage = async (response: Response, fallback: string) => {
  const data = await response.json().catch(() => null);
  if (data && typeof data === 'object' && 'detail' in data) {
    const detailMessage = extractDetailMessage((data as { detail?: unknown }).detail);
    if (detailMessage) {
      return detailMessage;
    }
  }

  const statusFallback = STATUS_FALLBACK_TRANSLATIONS[response.status];
  if (statusFallback) {
    return statusFallback;
  }

  return translateErrorMessage(null, fallback);
};

export const apiFetch = async (url: string, init: RequestInit = {}, withAuth = true) => {
  const headers = new Headers(init.headers);
  if (withAuth && authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers
    });
  } catch {
    throw new Error('Сервер временно недоступен. Попробуйте позже');
  }

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