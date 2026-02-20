import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  SvgIcon,
  TextField,
  Typography
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { OfferWorkspaceMessage } from '@shared/api/offerWorkspaceActions';

const chatSchema = z.object({
  text: z.string().trim().min(1, 'Введите сообщение').max(3000, 'Максимум 3000 символов'),
  files: z.array(z.instanceof(File)).default([])
});

type ChatFormValues = z.infer<typeof chatSchema>;

const getFileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

const mergeUniqueFiles = (currentFiles: File[], addedFiles: File[]) => {
  const fileMap = new Map<string, File>();
  [...currentFiles, ...addedFiles].forEach((file) => fileMap.set(getFileKey(file), file));
  return Array.from(fileMap.values());
};

const formatTime = (value: string | null) => {
  if (!value) return '--:--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatDayLabel = (iso: string | null) => {
  if (!iso) return 'Без даты';

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Без даты';

  const today = startOfDay(new Date());
  const msgDay = startOfDay(d);

  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);

  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(d);
};

const MessageStatusIcon = ({ status }: { status: OfferWorkspaceMessage['status'] }) => {
  const isDouble = status === 'received' || status === 'read';
  const colorByStatus: Record<OfferWorkspaceMessage['status'], string> = {
    send: 'rgba(214,236,255,0.95)',
    received: '#d2e9ff',
    read: '#ffffff'
  };

  const color = colorByStatus[status];

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ml: 0.5,
        color,
        opacity: status === 'send' ? 0.9 : 1,
      }}
      aria-label={`message-status-${status}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
        <path
          d="M6.6 12.6l3.1 3.1 7.7-7.7"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {isDouble ? (
          <path
            d="M10.2 12.6l3.1 3.1 7.7-7.7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.95"
          />
        ) : null}
      </svg>
    </Box>
  );
};

type OfferWorkspaceChatPanelProps = {
  offerId: number;
  isOpen: boolean;
  onToggleOpen: (next: boolean) => void;
  messages: OfferWorkspaceMessage[];
  sessionLogin?: string;
  canSendMessage: boolean;
  canSendMessageWithAttachments: boolean;
  isSending: boolean;
  onSendMessage: (text: string, files: File[]) => Promise<void>;
  onMessageInputClick: () => Promise<void> | void;
  onDownloadAttachment: (downloadUrl: string, name: string) => void;
  chatItems?: Array<{ offerId: number; label: string; isReadOnly?: boolean }>;
  activeOfferId?: number;
  onSelectOffer?: (offerId: number) => void;
  readOnlyNotice?: string | null;
  contractorUserId?: string;
};

export const OfferWorkspaceChatPanel = ({
  offerId,
  isOpen,
  onToggleOpen,
  messages,
  sessionLogin,
  canSendMessage,
  canSendMessageWithAttachments,
  isSending,
  onSendMessage,
  onMessageInputClick,
  onDownloadAttachment,
  chatItems = [],
  activeOfferId = offerId,
  onSelectOffer,
  readOnlyNotice,
  contractorUserId
}: OfferWorkspaceChatPanelProps) => {
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<ChatFormValues>({
    resolver: zodResolver(chatSchema),
    defaultValues: { text: '', files: [] }
  });

  const attachedFiles = watch('files');
  const messageText = watch('text');

  const sortedMessages = React.useMemo(() => {
    return [...messages].sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );
  }, [messages]);

  const handleRemoveAttachedFile = (fileToRemove: File) => {
    const nextFiles = attachedFiles.filter((file) => getFileKey(file) !== getFileKey(fileToRemove));
    setValue('files', nextFiles, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  };

  const onSubmitMessage = async (values: ChatFormValues) => {
    if (!canSendMessage) return;

    const trimmedText = values.text.trim();
    if (!trimmedText) return;

    await onSendMessage(trimmedText, values.files);
    reset({ text: '', files: [] });
  };

  return (
    <Paper
      sx={{
        width: { xs: '100%', lg: isOpen ? 430 : 72 },
        borderRadius: 0,
        borderLeft: { lg: '1px solid #d6dbe4' },
        p: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: { xs: 420, lg: '100%' },
        height: { lg: '100%' },
        transition: 'width 0.2s ease'
      }}
    >
      {isOpen ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
            <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
              Чат по офферу №{offerId}
            </Typography>
            <IconButton onClick={() => onToggleOpen(false)} aria-label="Скрыть чат">
              <SvgIcon fontSize="small">
                <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </SvgIcon>
            </IconButton>
          </Box>
          <Divider />

          {chatItems.length > 1 ? (
            <Box sx={{ px: 1.5, pt: 1 }}>
              <Tabs
                value={activeOfferId}
                onChange={(_, nextOfferId: number) => onSelectOffer?.(nextOfferId)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {chatItems.map((item) => (
                  <Tab key={item.offerId} value={item.offerId} label={item.label} />
                ))}
              </Tabs>
            </Box>
          ) : null}

          <Stack spacing={1} sx={{ p: 2, height: '100%' }}>
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': {
                  display: 'none'
                },
                borderRadius: 2,
                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.05),
                p: 2
              }}
            >
              {sortedMessages.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Сообщений пока нет.
                </Typography>
              ) : (
                <Stack spacing={0} alignItems="stretch">
                  {sortedMessages.map((item, idx) => {
                    const ownMessage = item.user_id === sessionLogin;
                    const isContractorMessage = Boolean(contractorUserId) && item.user_id === contractorUserId;

                    const prev = idx > 0 ? sortedMessages[idx - 1] : null;

                    const showDateDivider = !prev
                      ? true
                      : (() => {
                        const a = new Date(prev.created_at ?? '');
                        const b = new Date(item.created_at ?? '');
                        if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
                        return !isSameDay(a, b);
                      })();

                    const isGroupedWithPrev = Boolean(
                      prev &&
                      prev.user_id === item.user_id &&
                      isSameDay(new Date(prev.created_at ?? ''), new Date(item.created_at ?? ''))
                    );

                    const senderName = item.user_full_name?.trim() || item.user_id;

                    return (
                      <Box key={item.id}>
                        {showDateDivider ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
                            <Box
                              sx={(theme) => ({
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 600,
                                color: theme.palette.text.secondary,
                                backgroundColor: alpha(theme.palette.common.white, 0.75),
                                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                              })}
                            >
                              {formatDayLabel(item.created_at)}
                            </Box>
                          </Box>
                        ) : null}

                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: ownMessage ? 'flex-end' : 'flex-start',
                            mt: showDateDivider ? 0.9 : isGroupedWithPrev ? 0.25 : 0.9
                          }}
                        >
                          <Box
                            sx={(theme) => {
                              const R = 18;
                              const CUT = 6;
                              const top = isGroupedWithPrev ? 10 : R;

                              return {
                                maxWidth: '82%',
                                px: 1.6,
                                py: 1.1,

                                borderRadius: `${R}px`,
                                borderTopLeftRadius: ownMessage ? `${top}px` : `${CUT}px`,
                                borderTopRightRadius: ownMessage ? `${CUT}px` : `${top}px`,
                                borderBottomLeftRadius: `${R}px`,
                                borderBottomRightRadius: `${R}px`,

                                backgroundColor: ownMessage
                                  ? theme.palette.primary.main
                                  : isContractorMessage
                                    ? '#eaf4ff'
                                    : alpha(theme.palette.background.paper, 0.98),
                                color: ownMessage ? 'rgba(255,255,255,0.96)' : theme.palette.text.primary,

                                boxShadow: ownMessage
                                  ? `0 6px 18px ${alpha(theme.palette.primary.main, 0.18)}`
                                  : '0 1px 4px rgba(0,0,0,0.06)',

                                border: ownMessage
                                  ? 'none'
                                  : isContractorMessage
                                    ? `1px solid ${alpha(theme.palette.primary.main, 0.16)}`
                                    : 'none',

                                overflowWrap: 'anywhere'
                              };
                            }}
                          >
                            {!isGroupedWithPrev ? (
                              <Typography
                                variant="caption"
                                sx={{
                                  display: 'block',
                                  mb: 0.5,
                                  fontWeight: 600,
                                  color: ownMessage ? alpha('#fff', 0.9) : 'text.secondary',
                                  letterSpacing: 0.1
                                }}
                              >
                                {ownMessage ? 'Я' : senderName}
                              </Typography>
                            ) : null}
                            
                            <Typography
                              variant="body1"
                              sx={{
                                mb: item.attachments.length > 0 ? 0.8 : 0.4,
                                lineHeight: 1.32,
                                whiteSpace: 'pre-wrap'
                              }}
                            >
                              {item.text}
                            </Typography>

                            {item.attachments.length > 0 ? (
                              <Stack spacing={0.5} sx={{ mb: 0.75 }}>
                                {item.attachments.map((attachment) => (
                                  <Chip
                                    key={attachment.id}
                                    size="small"
                                    label={attachment.name}
                                    variant="outlined"
                                    onClick={() => onDownloadAttachment(attachment.download_url, attachment.name)}
                                    sx={(theme) => ({
                                      alignSelf: ownMessage ? 'flex-end' : 'flex-start',
                                      borderColor: ownMessage
                                        ? alpha(theme.palette.common.white, 0.35)
                                        : theme.palette.divider,
                                      color: ownMessage ? 'rgba(255,255,255,0.92)' : theme.palette.text.primary,
                                      backgroundColor: ownMessage
                                        ? alpha(theme.palette.primary.dark, 0.34)
                                        : theme.palette.background.default,
                                      '& .MuiChip-label': { color: 'inherit' }
                                    })}
                                  />
                                ))}
                              </Stack>
                            ) : null}

                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                gap: 0.6,
                                mt: 0.2
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  fontSize: 12,
                                  lineHeight: 1,
                                  color: ownMessage ? alpha('#fff', 0.82) : 'text.secondary'
                                }}
                              >
                                {formatTime(item.created_at)}
                              </Typography>

                              {ownMessage ? <MessageStatusIcon status={item.status} /> : null}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>

            {readOnlyNotice ? (
              <Typography variant="caption" color="text.secondary">{readOnlyNotice}</Typography>
            ) : null}

            <Box component="form" onSubmit={handleSubmit(onSubmitMessage)}>
              <TextField
                placeholder="Введите сообщение"
                multiline
                minRows={3}
                fullWidth
                disabled={!canSendMessage || isSending}
                error={Boolean(errors.text)}
                helperText={errors.text?.message}
                {...register('text')}
                onClick={() => void onMessageInputClick()}
              />

              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                {attachedFiles.map((file) => (
                  <Chip
                    key={getFileKey(file)}
                    label={file.name}
                    size="small"
                    onDelete={() => handleRemoveAttachedFile(file)}
                  />
                ))}
              </Stack>

              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                {canSendMessageWithAttachments ? (
                  <IconButton
                    component="label"
                    disabled={isSending}
                    color="primary"
                    aria-label="Прикрепить файлы"
                    sx={{
                      border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                      backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                      '&:hover': {
                        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.16)
                      }
                    }}
                  >
                    <SvgIcon fontSize="small">
                      <path
                        d="M15.5 6.5v8.25a3.75 3.75 0 1 1-7.5 0V5.75a2.5 2.5 0 1 1 5 0v7.5a1.25 1.25 0 1 1-2.5 0V7.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </SvgIcon>
                    <Controller
                      control={control}
                      name="files"
                      render={({ field: { value, onChange } }) => (
                        <input
                          type="file"
                          hidden
                          multiple
                          onChange={(event) => {
                            const nextFiles = Array.from(event.target.files ?? []);
                            onChange(mergeUniqueFiles(value ?? [], nextFiles));
                            event.target.value = '';
                          }}
                        />
                      )}
                    />
                  </IconButton>
                ) : (
                  <Box />
                )}

                <IconButton
                  type="submit"
                  color="primary"
                  disabled={!canSendMessage || isSending || !messageText.trim()}
                  aria-label={isSending ? 'Отправка сообщения' : 'Отправить сообщение'}
                  sx={{
                    border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
                    '&:hover': {
                      backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.2)
                    }
                  }}
                >
                  <SvgIcon fontSize="small">
                    <path
                      d="M3.5 12.5 19.75 4.5l-3.75 15-4.25-6-8.25-1z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.85"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m19.75 4.5-8 9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.85"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </SvgIcon>
                </IconButton>
              </Stack>
            </Box>
          </Stack>
        </>
      ) : (
        <Box sx={{ p: 1 }}>
          <Button variant="text" size="small" onClick={() => onToggleOpen(true)}>
            Чат
          </Button>
        </Box>
      )}
    </Paper>
  );
};
