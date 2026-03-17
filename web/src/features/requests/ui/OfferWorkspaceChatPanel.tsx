import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { alpha } from '@mui/material/styles';
import { Box, Button, Chip, Divider, IconButton, Paper, Stack, SvgIcon, TextField, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { OfferWorkspaceMessage } from '@shared/api/offers/offerWorkspaceActions';
import { getFileKey, mergeUniqueFiles } from '@shared/lib/files';

const AUTO_SCROLL_THRESHOLD_PX = 64;

const chatSchema = z.object({
  text: z.string().trim().min(1, 'Введите сообщение').max(3000, 'Максимум 3000 символов'),
  files: z.array(z.instanceof(File)).default([])
});

type ChatFormValues = z.infer<typeof chatSchema>;

const formatTime = (value: string | null) => {
  if (!value) return '--:--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const AUTO_EMAIL_MESSAGE_LABEL = 'Сообщение сформировано автоматически из письма';
const AUTO_EMAIL_PREFIXES = ['📧 Из письма контрагента', AUTO_EMAIL_MESSAGE_LABEL, '🤖 Сообщение сформировано автоматически из письма'];
const AUTO_EMAIL_OFFER_CREATED_TEXTS = [
  'Оффер сформирован автоматически из письма',
  '📧 Оффер создан из ответа на e-mail',
  '🤖 Оффер сформирован автоматически из письма'
];

const parseEmailOriginText = (text: string) => {
  const normalized = text.trimStart();
  const prefix = AUTO_EMAIL_PREFIXES.find((item) => normalized.startsWith(item));
  if (!prefix) {
    return { isEmailOrigin: false, body: text };
  }

  const body = normalized.slice(prefix.length).trimStart();
  return { isEmailOrigin: true, body };
};

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
  const messagesContainerRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToBottom = React.useCallback((force = false) => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (!force && distanceToBottom > AUTO_SCROLL_THRESHOLD_PX) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, []);

  const sortedMessages = React.useMemo(() => {
    return [...messages].sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );
  }, [messages]);

  const handleRemoveAttachedFile = (fileToRemove: File) => {
    const nextFiles = attachedFiles.filter((file) => getFileKey(file) !== getFileKey(fileToRemove));
    setValue('files', nextFiles, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  };

  React.useEffect(() => {
    scrollToBottom(true);
  }, [scrollToBottom, isOpen]);

  React.useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, sortedMessages]);

  const onSubmitMessage = async (values: ChatFormValues) => {
    if (!canSendMessage) return;

    const trimmedText = values.text.trim();
    if (!trimmedText) return;

    await onSendMessage(trimmedText, values.files);
    reset({ text: '', files: [] });
    scrollToBottom(true);
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
        minHeight: { xs: 420, lg: 0 },
        height: { lg: '100%' },
        overflow: 'hidden',
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


          <Stack spacing={1} sx={{ p: 2, height: '100%', minHeight: 0 }}>
            <Box
              ref={messagesContainerRef}
              sx={{
                flex: 1,
                minHeight: 0,
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
                    const isSystemMessage = Boolean(item.is_system);
                    const parsedEmailText = parseEmailOriginText(item.text);
                    const isEmailOriginMessage = !isSystemMessage && parsedEmailText.isEmailOrigin;
                    const normalizedText = item.text.trim();
                    const isAutoOfferCreatedMessage = !isSystemMessage
                      && AUTO_EMAIL_OFFER_CREATED_TEXTS.some((text) => normalizedText.startsWith(text));
                    const isSystemVisualMessage = isSystemMessage || isAutoOfferCreatedMessage;
                    const displayText = isEmailOriginMessage ? parsedEmailText.body : item.text;

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
                            justifyContent: isSystemVisualMessage ? 'center' : ownMessage ? 'flex-end' : 'flex-start',
                            mt: showDateDivider ? 0.9 : isGroupedWithPrev ? 0.25 : 0.9
                          }}
                        >
                          <Box
                            sx={(theme) => {
                              const R = 18;
                              const CUT = 6;
                              const top = isGroupedWithPrev ? 10 : R;

                              return {
                                maxWidth: isSystemVisualMessage ? '100%' : '82%',
                                px: 1.6,
                                py: isSystemVisualMessage ? 0.7 : 1.1,

                                borderRadius: isSystemVisualMessage  ? '999px' : `${R}px`,
                                borderTopLeftRadius: ownMessage ? `${top}px` : `${CUT}px`,
                                borderTopRightRadius: ownMessage ? `${CUT}px` : `${top}px`,
                                borderBottomLeftRadius: `${R}px`,
                                borderBottomRightRadius: `${R}px`,

                                backgroundColor: isSystemVisualMessage 
                                  ? alpha(theme.palette.warning.main, 0.12)
                                  : isEmailOriginMessage
                                    ? alpha(theme.palette.primary.main, 0.12)
                                    : ownMessage
                                      ? theme.palette.primary.main
                                      : isContractorMessage
                                        ? '#eaf4ff'
                                        : alpha(theme.palette.background.paper, 0.98),
                                color: isSystemVisualMessage
                                  ? theme.palette.text.secondary
                                  : isEmailOriginMessage
                                    ? theme.palette.text.primary
                                    : ownMessage
                                      ? 'rgba(255,255,255,0.96)'
                                      : theme.palette.text.primary,
                                opacity: item.is_muted ? 0.6 : 1,

                                boxShadow: isSystemVisualMessage
                                  ? 'none'
                                  : ownMessage
                                  ? `0 6px 18px ${alpha(theme.palette.primary.main, 0.18)}`
                                  : '0 1px 4px rgba(0,0,0,0.06)',

                                border: isSystemVisualMessage
                                  ? `1px dashed ${alpha(theme.palette.warning.main, 0.4)}`
                                  : isEmailOriginMessage
                                    ? `1px dashed ${alpha(theme.palette.primary.main, 0.35)}`
                                    : ownMessage
                                      ? 'none'
                                      : isContractorMessage
                                        ? `1px solid ${alpha(theme.palette.primary.main, 0.16)}`
                                        : 'none',

                                overflowWrap: 'anywhere'
                              };
                            }}
                          >
                            {!isGroupedWithPrev && !isSystemVisualMessage  ? (
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

                            {isEmailOriginMessage ? (
                              <Typography
                                variant="caption"
                                sx={{
                                  display: 'block',
                                  mb: 0.45,
                                  fontStyle: 'italic',
                                  color: 'text.secondary'
                                }}
                              >
                                {AUTO_EMAIL_MESSAGE_LABEL}
                              </Typography>
                            ) : null}
                            
                            <Typography
                              variant={isSystemVisualMessage  ? 'caption' : 'body1'}
                              sx={{
                                mb: item.attachments.length > 0 ? 0.8 : 0.4,
                                lineHeight: 1.32,
                                whiteSpace: 'pre-wrap',
                                fontStyle: isSystemVisualMessage ? 'italic' : 'normal',
                                textAlign: isSystemVisualMessage ? 'center' : 'left',
                                display: isEmailOriginMessage && !displayText ? 'none' : 'block'
                              }}
                            >
                              {displayText}
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
                                      alignSelf: isSystemVisualMessage ? 'center' : ownMessage ? 'flex-end' : 'flex-start',
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
                                justifyContent: isSystemVisualMessage ? 'center' : 'flex-end',
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
                                  color: ownMessage && !isSystemVisualMessage ? alpha('#fff', 0.82) : 'text.secondary'
                                }}
                              >
                                {formatTime(item.created_at)}
                              </Typography>

                              {ownMessage && !isSystemVisualMessage ? <MessageStatusIcon status={item.status} /> : null}
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

            <Box component="form" onSubmit={handleSubmit(onSubmitMessage)} sx={{ flexShrink: 0 }}>
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
