import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Popover,
  Stack,
  SvgIcon,
  TextField,
  Typography
} from '@mui/material';
import { useMemo, useState, type MouseEvent } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

export const UNAVAILABILITY_REASON_OPTIONS = [
  { value: 'sick', label: 'Больничный' },
  { value: 'vacation', label: 'Отпуск' },
  { value: 'fired', label: 'Уволен' },
  { value: 'maternity', label: 'Декрет' },
  { value: 'business_trip', label: 'Командировка' },
  { value: 'unavailable', label: 'Недоступен' }
] as const;

type UnavailabilityPeriodEditorProps = {
  statusField: UseFormRegisterReturn<'status'>;
  startedAtField: UseFormRegisterReturn<'started_at'>;
  endedAtField: UseFormRegisterReturn<'ended_at'>;
  startedAtValue: string;
  endedAtValue: string;
  onStartedAtChange: (value: string) => void;
  onEndedAtChange: (value: string) => void;
  statusError?: string;
  startedAtError?: string;
  endedAtError?: string;
};

type CalendarField = 'start' | 'end';

const ReasonIcon = () => (
  <SvgIcon fontSize="small" sx={{ color: '#8a95a8' }}>
    <path d="M4 4h16v14H4z" fill="none" />
    <path d="M6 4a2 2 0 0 0-2 2v12h2V6h12v2h2V6a2 2 0 0 0-2-2H6Zm3 5v2h9V9H9Zm0 4v2h6v-2H9ZM4 20h16v-2H4v2Z" />
  </SvgIcon>
);

const CalendarIcon = () => (
  <SvgIcon fontSize="small" sx={{ color: '#8a95a8' }}>
    <path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2Zm13 8H4v10h16V10Zm0-2V6H4v2h16Z" />
  </SvgIcon>
);

const ArrowDownIcon = () => (
  <SvgIcon fontSize="small" sx={{ color: '#8e98aa' }}>
    <path d="M7 10l5 5 5-5z" />
  </SvgIcon>
);

const fieldSx = {
  '& .MuiInputLabel-root': {
    color: '#6f7f99'
  },
  '& .MuiOutlinedInput-root': {
    borderRadius: 999,
    backgroundColor: '#f3f5f8',
    color: '#31415f',
    '& fieldset': {
      borderColor: '#cbd4e2'
    },
    '&:hover fieldset': {
      borderColor: '#bcc8da'
    },
    '&.Mui-focused fieldset': {
      borderColor: '#aebcd3',
      borderWidth: '1px'
    }
  },
  '& .MuiInputBase-input': {
    color: '#31415f',
    fontWeight: 500,
    fontSize: 15
  },
  '& .MuiFormHelperText-root': {
    ml: 0.5
  }
} as const;

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const formatValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseValue = (value: string): Date | null => {
  if (!value) {
    return null;
  }

  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) {
    return null;
  }

  const parsed = new Date(y, m - 1, d);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const formatDisplay = (value: string): string => {
  const parsed = parseValue(value);
  return parsed ? parsed.toLocaleDateString('ru-RU') : 'Выберите дату';
};

export const UnavailabilityPeriodEditor = ({
  statusField,
  startedAtField,
  endedAtField,
  startedAtValue,
  endedAtValue,
  onStartedAtChange,
  onEndedAtChange,
  statusError,
  startedAtError,
  endedAtError
}: UnavailabilityPeriodEditorProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeField, setActiveField] = useState<CalendarField>('start');
  const [viewDate, setViewDate] = useState(() => new Date());
  const [draftValue, setDraftValue] = useState<string>('');

  const openCalendar = (field: CalendarField, event: MouseEvent<HTMLElement>) => {
    const currentValue = field === 'start' ? startedAtValue : endedAtValue;
    const parsed = parseValue(currentValue);

    setActiveField(field);
    setViewDate(parsed ?? new Date());
    setDraftValue(currentValue);
    setAnchorEl(event.currentTarget);
  };

  const closeCalendar = () => setAnchorEl(null);

  const calendarCells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ date: Date | null }> = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push({ date: null });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: new Date(year, month, day) });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ date: null });
    }

    return cells;
  }, [viewDate]);

  const applyDraftDate = () => {
    if (activeField === 'start') {
      onStartedAtChange(draftValue);
    } else {
      onEndedAtChange(draftValue);
    }

    closeCalendar();
  };

  const clearDate = () => {
    if (activeField === 'start') {
      onStartedAtChange('');
    } else {
      onEndedAtChange('');
    }

    closeCalendar();
  };

  const isOpen = Boolean(anchorEl);

  return (
    <Stack spacing={1.5}>
      <input type="hidden" {...startedAtField} />
      <input type="hidden" {...endedAtField} />

      <TextField
        label="Причина"
        select
        {...statusField}
        error={Boolean(statusError)}
        helperText={statusError}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <ReasonIcon />
            </InputAdornment>
          )
        }}
        sx={fieldSx}
      >
        {UNAVAILABILITY_REASON_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <TextField
          label="Дата начала"
          value={formatDisplay(startedAtValue)}
          error={Boolean(startedAtError)}
          helperText={startedAtError}
          onClick={(event) => openCalendar('start', event)}
          inputProps={{ readOnly: true }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <CalendarIcon />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <ArrowDownIcon />
              </InputAdornment>
            )
          }}
          sx={{ ...fieldSx, cursor: 'pointer' }}
          fullWidth
        />

        <TextField
          label="Дата окончания"
          value={formatDisplay(endedAtValue)}
          error={Boolean(endedAtError)}
          helperText={endedAtError}
          onClick={(event) => openCalendar('end', event)}
          inputProps={{ readOnly: true }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <CalendarIcon />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <ArrowDownIcon />
              </InputAdornment>
            )
          }}
          sx={{ ...fieldSx, cursor: 'pointer' }}
          fullWidth
        />
      </Stack>

      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={closeCalendar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          elevation: 4,
          sx: {
            borderRadius: 3,
            p: 2,
            width: 300,
            border: '1px solid #d4dce8',
            backgroundColor: '#f7f8fb'
          }
        }}
      >
        <Stack spacing={1.6}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography
              sx={{
                fontSize: 18,
                lineHeight: '24px',
                fontWeight: 600,
                color: '#42597a',
                textTransform: 'capitalize'
              }}
            >
              {viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </Typography>

            <Stack direction="row" spacing={0.5}>
              <IconButton
                size="small"
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                aria-label="Предыдущий месяц"
                sx={{ color: '#8a95a8' }}
              >
                <SvgIcon fontSize="small">
                  <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z" />
                </SvgIcon>
              </IconButton>

              <IconButton
                size="small"
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                aria-label="Следующий месяц"
                sx={{ color: '#8a95a8' }}
              >
                <SvgIcon fontSize="small">
                  <path d="m8.6 16.6 1.4 1.4 6-6-6-6-1.4 1.4 4.6 4.6z" />
                </SvgIcon>
              </IconButton>
            </Stack>
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
            {weekdays.map((weekday, index) => (
              <Typography
                key={`${weekday}-${index}`}
                variant="caption"
                align="center"
                sx={{ color: '#6f7f99', fontWeight: 600, letterSpacing: 0.2 }}
              >
                {weekday}
              </Typography>
            ))}

            {calendarCells.map((cell, index) => {
              const cellValue = cell.date ? formatValue(cell.date) : null;
              const isSelected = cellValue !== null && cellValue === draftValue;

              return (
                <Box
                  key={`${index}-${cellValue ?? 'empty'}`}
                  component="button"
                  type="button"
                  onClick={() => setDraftValue(cellValue ?? '')}
                  disabled={!cell.date}
                  sx={{
                    border: 0,
                    bgcolor: isSelected ? '#e1e7f0' : 'transparent',
                    color: isSelected ? '#344766' : '#465775',
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    justifySelf: 'center',
                    cursor: cell.date ? 'pointer' : 'default',
                    fontSize: 14,
                    fontWeight: isSelected ? 600 : 400,
                    boxShadow: 'none',
                    transition: 'background-color 0.2s ease',
                    '&:hover': {
                      bgcolor: isSelected ? '#dde4ef' : 'rgba(127, 143, 166, 0.12)'
                    },
                    '&:disabled': {
                      color: 'transparent'
                    }
                  }}
                >
                  {cell.date?.getDate() ?? ''}
                </Box>
              );
            })}
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button
              fullWidth
              variant="outlined"
              onClick={clearDate}
              sx={{
                borderRadius: 999,
                textTransform: 'none',
                color: '#6c7b91',
                borderColor: '#c5cfdd',
                backgroundColor: '#f4f6f9',
                '&:hover': {
                  borderColor: '#b9c6d8',
                  backgroundColor: '#eef2f7'
                }
              }}
            >
              Удалить
            </Button>

            <Button
              fullWidth
              variant="outlined"
              onClick={applyDraftDate}
              sx={{
                borderRadius: 999,
                textTransform: 'none',
                color: '#42597a',
                borderColor: '#bcc8da',
                backgroundColor: '#eef2f7',
                '&:hover': {
                  borderColor: '#aebcd3',
                  backgroundColor: '#e6ebf3'
                }
              }}
            >
              Готово
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </Stack>
  );
};
