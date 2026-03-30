import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { DataTable } from '@shared/components/DataTable';
import { getContractorRequestView } from '@shared/api/requests/getContractorRequestView';
import type { ContractorRequestView } from '@shared/api/requests/getContractorRequestView';
import { createOfferForRequest } from '@shared/api/offers/createOfferForRequest';
import { downloadFile } from '@shared/api/fileDownload';

const statusOptions = [
  { value: 'open', label: 'Открыта', color: '#2e7d32' },
  { value: 'review', label: 'На рассмотрении', color: '#ed6c02' },
  { value: 'closed', label: 'Закрыта', color: '#787878ff' },
  { value: 'cancelled', label: 'Отменена', color: '#d32f2f' }
] as const;

const detailsColumns = [
  { key: 'label', label: 'Параметр' },
  { key: 'value', label: 'Значение' }
];

const formatDate = (value: string | null) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

const parseAmountInput = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const ContractorRequestDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const requestId = Number(id ?? 0);
  const [request, setRequest] = useState<ContractorRequestView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [offerAmount, setOfferAmount] = useState('');

  useEffect(() => {
    if (!Number.isFinite(requestId) || requestId <= 0) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    getContractorRequestView(requestId)
      .then((response) => {
        if (!isMounted) {
          return;
        }
        if (response.existing_offer?.actions.open_workspace) {
          navigate(`/offers/${response.existing_offer.offer_id}/workspace`, { replace: true });
          return;
        }
        setRequest(response);
      })
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Ошибка загрузки заявки');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [navigate, requestId]);

  const statusConfig = useMemo(
    () => statusOptions.find((item) => item.value === request?.status) ?? statusOptions[0],
    [request?.status]
  );

  const canCreateOffer = useMemo(
    () => Boolean(request?.actions.create_offer),
    [request?.actions.create_offer]
  );

  const detailsRows = [
    { id: 'status', label: 'Статус', value: request?.status_label ?? '-' },
    { id: 'offer', label: 'Номер КП', value: '-' },
    { id: 'deadline', label: 'Дедлайн сбора КП', value: formatDate(request?.deadline_at ?? null) },
    { id: 'owner', label: 'Ответственный', value: request?.owner_full_name ?? request?.owner_user_id ?? '-' }
  ];

  const handleRespond = async () => {
    if (!request) {
      return;
    }

    const parsedOfferAmount = parseAmountInput(offerAmount);
    if (Number.isNaN(parsedOfferAmount)) {
      setErrorMessage('Укажите корректную сумму КП');
      return;
    }
    if (parsedOfferAmount !== null && parsedOfferAmount < 0) {
      setErrorMessage('Сумма КП не может быть отрицательной');
      return;
    }

    setIsResponding(true);
    setErrorMessage(null);
    try {
      const createdOffer = await createOfferForRequest(
        request.id,
        undefined,
        parsedOfferAmount === null ? undefined : { offer_amount: parsedOfferAmount }
      );
      navigate(createdOffer.workspacePath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось отправить отклик');
    } finally {
      setIsResponding(false);
    }
  };

  if (isLoading) {
    return <Typography>Загрузка...</Typography>;
  }

  if (!request) {
    if (errorMessage) {
      return (
        <Stack spacing={2} alignItems="flex-start">
          <Button variant="outlined" onClick={() => navigate('/requests')}>
            Назад
          </Button>
          <Typography color="error">{errorMessage}</Typography>
        </Stack>
      );
    }
    return (
      <Stack spacing={2} alignItems="flex-start">
        <Button variant="outlined" onClick={() => navigate('/requests')}>
          Назад
        </Button>
        <Typography color="text.secondary">Заявка не найдена.</Typography>
      </Stack>
    );
  }

  return (
    <Box>
      <Button variant="outlined" onClick={() => navigate('/requests')} sx={{ mb: 2 }}>
        Назад
      </Button>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
          Номер заявки: {request.id}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'nowrap' }}>
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: statusConfig.color
            }}
          />
          <Select
            size="small"
            value={statusConfig.value}
            disabled
            sx={{
              minWidth: 200,
              borderRadius: 999,
              backgroundColor: 'background.paper'
            }}
          >
            {statusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      </Stack>

      {errorMessage ? (
        <Typography color="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Typography>
      ) : null}

      <Box
        sx={(theme) => ({
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          padding: { xs: 2, md: 3 },
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }
        })}
      >
        <Stack spacing={2}>
          <TextField
            value={request.description ?? ''}
            multiline
            minRows={6}
            InputProps={{ readOnly: true }}
            sx={{ borderRadius: 3 }}
          />

          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Файлы заявки
            </Typography>
            {request.files.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {request.files.map((file) => (
                  <Chip
                    key={file.id}
                    label={file.name}
                    variant="outlined"
                    sx={{ borderRadius: 999, backgroundColor: '#fff' }}
                    onClick={() => void downloadFile(file.download_url, file.name)}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2">Файлы не прикреплены</Typography>
            )}
          </Stack>
        </Stack>

        <DataTable
          columns={detailsColumns}
          rows={detailsRows}
          rowKey={(row) => row.id}
          showHeader={false}
          enableColumnControls={false}
          renderRow={(row) => [
            <Typography variant="body2">{row.label}</Typography>,
            <Typography variant="body2">{row.value}</Typography>
          ]}
        />
      </Box>

      {canCreateOffer ? (
        <Stack spacing={1} sx={{ mt: 3, maxWidth: 360 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Сумма КП, руб. (необязательно)
          </Typography>
          <TextField
            size="small"
            value={offerAmount}
            onChange={(event) => setOfferAmount(event.target.value)}
            inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
            helperText="Можно оставить пустым и заполнить позже в рабочем пространстве КП."
          />
        </Stack>
      ) : null}

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
        <Button variant="contained" disabled={!canCreateOffer || isResponding} onClick={() => void handleRespond()}>
          {isResponding ? 'Создаём отклик...' : 'Откликнуться'}
        </Button>
      </Stack>
    </Box>
  );
};
