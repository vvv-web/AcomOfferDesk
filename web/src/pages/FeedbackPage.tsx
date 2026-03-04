import { Alert, Box, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import { getFeedbackList, type FeedbackListItem } from '@shared/api/getFeedbackList';

const columns: DataTableColumn[] = [
  { key: 'id', label: 'ID', minWidth: 90, fraction: 0.5 },
  { key: 'text', label: 'Текст обратной связи', minWidth: 480, fraction: 3.5 }
];

export const FeedbackPage = () => {
  const [items, setItems] = useState<FeedbackListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await getFeedbackList();
        if (!isMounted) {
          return;
        }
        setItems(list);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить обратную связь');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Stack spacing={1.5}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Обратная связь
      </Typography>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box sx={{ minWidth: 0 }}>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(row) => row.id}
          renderRow={(row) => [row.id, row.text]}
          isLoading={isLoading}
          emptyMessage="Обратная связь пока не поступала"
          storageKey="superadmin-feedback"
          stickyLastColumn={false}
        />
      </Box>
    </Stack>
  );
};
