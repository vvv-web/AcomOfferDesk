import { Box, Button, IconButton, InputAdornment, MenuItem, Popover, Stack, SvgIcon, TextField, Typography } from '@mui/material';
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

const ReasonIcon = () => (
  <SvgIcon fontSize="small" sx={{ color: '#7f8fa6' }}>
    <path d="M4 4h16v14H4z" fill="none" />
    <path d="M6 4a2 2 0 0 0-2 2v12h2V6h12v2h2V6a2 2 0 0 0-2-2H6Zm3 5v2h9V9H9Zm0 4v2h6v-2H9ZM4 20h16v-2H4v2Z" />
  </SvgIcon>
);

const CalendarIcon = () => (
  <SvgIcon fontSize="small" sx={{ color: '#7f8fa6' }}>
    <path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2Zm13 8H4v10h16V10Zm0-2V6H4v2h16Z" />
  </SvgIcon>
);

const ArrowDownIcon = () => (
  <SvgIcon fontSize="small" sx={{ color: '#707b8f' }}>
    <path d="M7 10l5 5 5-5z" />
  </SvgIcon>
);

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 3,
    backgroundColor: '#f5f6f8'
  },
  '& .MuiInputBase-input': {
    color: '#1f2a44',
    fontWeight: 600
  },
  '& .MuiFormHelperText-root': {
    ml: 0.5
  }
} as const;

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string): Date | null => {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return null;
  }
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const displayDate = (value: string): string => {
  const date = parseDateInputValue(value);
  if (!date) {
    return 'Не выбрано';
  }
  return date.toLocaleDateString('ru-RU');
};

type CalendarField = 'start' | 'end';

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
  const [viewDate, setViewDate] = useState<Date>(() => new Date());

  const openCalendar = (field: CalendarField, event: MouseEvent<HTMLElement>) => {
    const value = field === 'start' ? startedAtValue : endedAtValue;
    const parsed = parseDateInputValue(value);
    setViewDate(parsed ?? new Date());
    setActiveField(field);
    setAnchorEl(event.currentTarget);
  };

  const closeCalendar = () => setAnchorEl(null);

  const calendarCells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const firstWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; date: Date | null }> = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push({ day: null, date: null });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ day, date: new Date(year, month, day) });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, date: null });
    }

    return cells;
  }, [viewDate]);

  const selectedValue = activeField === 'start' ? startedAtValue : endedAtValue;

  return (
    <Stack spacing={1.8}>
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

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.8}>
        <TextField
          label="Дата начала"
          value={displayDate(startedAtValue)}
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
          value={displayDate(endedAtValue)}
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
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={closeCalendar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 2,
            width: 290,
            backgroundColor: '#f7f8fb'
          }
        }}
      >
        <Stack spacing={1.6}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={700}>
              {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <IconButton size="small" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
                <SvgIcon fontSize="small"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z" /></SvgIcon>
              </IconButton>
              <IconButton size="small" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
                <SvgIcon fontSize="small"><path d="m8.6 16.6 1.4 1.4 6-6-6-6-1.4 1.4 4.6 4.6z" /></SvgIcon>
              </IconButton>
            </Stack>
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.6 }}>
            {weekdays.map((weekday) => (
              <Typography key={weekday} variant="caption" textAlign="center" sx={{ color: '#71819a', fontWeight: 700 }}>
                {weekday[0]}
              </Typography>
            ))}
            {calendarCells.map((cell, index) => {
              const value = cell.date ? toDateInputValue(cell.date) : null;
              const isSelected = value !== null && value === selectedValue;
              return (
                <Button
                  key={`${index}-${cell.day ?? 'empty'}`}
                  onClick={() => {
                    if (!value) {
                      return;
                    }
                    if (activeField === 'start') {
                      onStartedAtChange(value);
                    } else {
                      onEndedAtChange(value);
                    }
                    closeCalendar();
                  }}
                  disabled={!value}
                  sx={{
                    minWidth: 0,
                    p: 0,
                    borderRadius: '50%',
                    width: 34,
                    height: 34,
                    justifySelf: 'center',
                    color: isSelected ? '#fff' : '#2d3b55',
                    backgroundColor: isSelected ? '#2f8cf0' : 'transparent',
                    '&:hover': {
                      backgroundColor: isSelected ? '#2f8cf0' : 'rgba(47, 140, 240, 0.1)'
                    }
                  }}
                >
                  {cell.day ?? ''}
                </Button>
              );
            })}
          </Box>
        </Stack>
      </Popover>
    </Stack>
  );
};
