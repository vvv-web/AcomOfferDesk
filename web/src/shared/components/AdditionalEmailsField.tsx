import { forwardRef, useImperativeHandle, useState } from 'react';
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import {
  isValidAdditionalEmail,
  mergeAdditionalEmails,
  splitAdditionalEmails,
} from '@shared/lib/additionalEmails';

export type AdditionalEmailsFieldHandle = {
  commitPendingInput: () => string[] | null;
};

type AdditionalEmailsFieldProps = {
  emails: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  placeholder?: string;
  helperText?: string;
};

export const AdditionalEmailsField = forwardRef<AdditionalEmailsFieldHandle, AdditionalEmailsFieldProps>(
  (
    {
      emails,
      onChange,
      disabled = false,
      label = 'Дополнительные e-mail для рассылки',
      description = 'Необязательно. Можно добавить адреса, которых нет в базе верифицированных контрагентов.',
      placeholder = 'name@example.com',
      helperText = 'Можно ввести несколько email через запятую, а затем нажать Enter или кнопку',
    },
    ref
  ) => {
    const [inputValue, setInputValue] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const commitPendingInput = () => {
      const parsedEmails = splitAdditionalEmails(inputValue);
      if (parsedEmails.length === 0) {
        setErrorMessage(null);
        return emails;
      }

      for (const email of parsedEmails) {
        if (!isValidAdditionalEmail(email)) {
          setErrorMessage(`Некорректный email: ${email}`);
          return null;
        }
      }

      const nextEmails = mergeAdditionalEmails(emails, parsedEmails);
      onChange(nextEmails);
      setInputValue('');
      setErrorMessage(null);
      return nextEmails;
    };

    useImperativeHandle(
      ref,
      () => ({
        commitPendingInput,
      }),
      [commitPendingInput]
    );

    const handleRemoveEmail = (emailToRemove: string) => {
      onChange(emails.filter((email) => email !== emailToRemove));
      setErrorMessage(null);
    };

    return (
      <Stack spacing={1.5} mt={3}>
        <Typography variant="subtitle1" fontWeight={500}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
          <TextField
            fullWidth
            placeholder={placeholder}
            value={inputValue}
            disabled={disabled}
            error={Boolean(errorMessage)}
            helperText={errorMessage ?? helperText}
            onChange={(event) => {
              setInputValue(event.target.value);
              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                commitPendingInput();
              }
            }}
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          <Button
            variant="outlined"
            disabled={disabled}
            onClick={() => {
              commitPendingInput();
            }}
            sx={{
              minWidth: { sm: 132 },
              borderRadius: 999,
              textTransform: 'none',
              paddingX: 3,
            }}
          >
            Добавить
          </Button>
        </Stack>
        {emails.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {emails.map((email) => (
              <Chip
                key={email}
                label={email}
                onDelete={disabled ? undefined : () => handleRemoveEmail(email)}
                variant="outlined"
                sx={{
                  maxWidth: '100%',
                  borderRadius: 999,
                  backgroundColor: '#fff',
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              />
            ))}
          </Box>
        ) : null}
      </Stack>
    );
  }
);

AdditionalEmailsField.displayName = 'AdditionalEmailsField';
