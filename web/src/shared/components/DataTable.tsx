import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

export type DataTableColumn = {
  key: string;
  label: ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: number; // px hint for manual
  minWidth?: number;
  fraction?: number;
};

type DataTableProps<T> = {
  columns: DataTableColumn[];
  rows: T[];
  rowKey: (row: T) => string | number;
  renderRow: (row: T) => ReactNode[];
  isLoading?: boolean;
  emptyMessage?: string;
  statusContent?: ReactNode;
  onRowClick?: (row: T) => void;
  rowHoverOutlineColor?: string;
  showHeader?: boolean;
  enableColumnControls?: boolean;
  defaultHiddenColumnKeys?: string[];
  storageKey?: string;

  stickyFirstColumn?: boolean;
  stickyLastColumn?: boolean;
};

const tablePalette = {
  surface: '#ffffff',
  surfaceMuted: '#edf3ff',
  border: '#d3dbe7',
  headerBg: '#e7f0ff',
  headerText: '#1f2a44',
  rowHover: '#eaf2ff',
  accent: '#2f6fd6',
};

const controlButtonSx = {
  borderColor: tablePalette.accent,
  color: tablePalette.accent,
  fontWeight: 600,
  textTransform: 'none',
  '&:hover': {
    borderColor: '#245bb5',
    backgroundColor: 'rgba(47, 111, 214, 0.08)',
  },
};

const baseCellSx = {
  paddingY: 1.4,
  paddingX: 1.5,
  borderRight: `1px solid ${tablePalette.border}`,
  borderBottom: `1px solid ${tablePalette.border}`,
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box' as const,
  minWidth: 0,

  // ✅ перенос по умолчанию (и в шапке, и в ячейках)
  whiteSpace: 'normal' as const,
  overflow: 'hidden' as const,
  textOverflow: 'clip' as const,
  overflowWrap: 'anywhere' as const,
  wordBreak: 'break-word' as const,

  color: tablePalette.headerText,
  fontSize: 14,
  lineHeight: 1.35,
};

const resolveAlignment = (align: DataTableColumn['align']) => {
  if (align === 'center') return 'center';
  if (align === 'right') return 'flex-end';
  return 'flex-start';
};

type StickySide = false | 'left' | 'right';

const TableCell = ({
  children,
  isLast,
  align,
  isHeader,
  columnKey,
  showResizer = false,
  onResizeStart,
  setRef,
  stickySide = false,
}: {
  children: ReactNode;
  isLast: boolean;
  align?: DataTableColumn['align'];
  isHeader?: boolean;
  columnKey?: string;
  showResizer?: boolean;
  onResizeStart?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  setRef?: (node: HTMLDivElement | null) => void;
  stickySide?: StickySide;
}) => (
  <Box
    ref={setRef}
    data-column-key={columnKey}
    data-cell-role={isHeader ? 'header' : 'body'}
    sx={{
      ...baseCellSx,
      borderRight: isLast ? 'none' : baseCellSx.borderRight,
      fontWeight: isHeader ? 700 : 400,
      justifyContent: resolveAlignment(align),

      position: stickySide ? 'sticky' : showResizer ? 'relative' : 'static',
      left: stickySide === 'left' ? 0 : 'auto',
      right: stickySide === 'right' ? 0 : 'auto',
      zIndex: stickySide ? (isHeader ? 6 : 4) : 'auto',

      backgroundColor: isHeader ? tablePalette.headerBg : tablePalette.surface,
      userSelect: showResizer ? 'none' : 'auto',
      textTransform: isHeader ? 'uppercase' : 'none',
      letterSpacing: isHeader ? '0.04em' : 'normal',

      // ✅ убрали затемнение/тени при скролле полностью
      boxShadow: 'none',
      borderLeft: stickySide === 'right' ? `1px solid ${tablePalette.border}` : undefined,
    }}
  >
    {children}
    {showResizer && (
      <Box
        onMouseDown={onResizeStart}
        sx={{
          position: 'absolute',
          top: 0,
          right: -4,
          width: 8,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 10,
          '&:hover': { backgroundColor: 'rgba(47, 111, 214, 0.12)' },
        }}
      />
    )}
  </Box>
);

const renderHeaderLabel = (label: ReactNode) => {
  if (typeof label === 'string' || typeof label === 'number') {
    return <Typography variant="body2">{label}</Typography>;
  }
  return label;
};

type ResizeSession = {
  key: string;
  startX: number;
  startWidth: number;
};

export const DataTable = <T,>({
  columns,
  rows,
  rowKey,
  renderRow,
  isLoading = false,
  emptyMessage = 'Данные отсутствуют.',
  statusContent,
  onRowClick,
  rowHoverOutlineColor = 'rgba(47, 111, 214, 0.4)',
  showHeader = true,
  enableColumnControls = true,
  defaultHiddenColumnKeys,
  storageKey,
  stickyFirstColumn = true,
  stickyLastColumn = true,
}: DataTableProps<T>) => {
  const hasRows = rows.length > 0;

  const columnOrder = useMemo(() => columns.map((c) => c.key), [columns]);
  const hiddenColumnKeys = useMemo(() => defaultHiddenColumnKeys ?? [], [defaultHiddenColumnKeys]);

  const storageKeyValue = storageKey ? `dataTable:${storageKey}` : null;
  const storedState = useMemo(() => {
    if (!storageKeyValue) return null;
    try {
      const raw = sessionStorage.getItem(storageKeyValue);
      if (!raw) return null;
      return JSON.parse(raw) as {
        visibleColumnKeys?: string[];
        columnWidths?: Record<string, number>;
      };
    } catch {
      return null;
    }
  }, [storageKeyValue]);

  const initialVisibleColumnKeys = useMemo(
    () => columns.filter((c) => !hiddenColumnKeys.includes(c.key)).map((c) => c.key),
    [columns, hiddenColumnKeys]
  );

  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(
    storedState?.visibleColumnKeys?.length ? storedState.visibleColumnKeys : initialVisibleColumnKeys
  );

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => storedState?.columnWidths ?? {}
  );
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const headerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const resizeRef = useRef<ResizeSession | null>(null);

  const [scrollerWidth, setScrollerWidth] = useState<number>(0);

  const columnsWithIndex = useMemo(() => columns.map((column, index) => ({ ...column, index })), [columns]);

  const normalizeVisibleColumns = useCallback(
    (keys: string[]) => columnOrder.filter((key) => keys.includes(key)),
    [columnOrder]
  );

  useEffect(() => {
    setVisibleColumnKeys((prev) => {
      if (prev.length === 0 || prev.every((key) => !columnOrder.includes(key))) return initialVisibleColumnKeys;
      return normalizeVisibleColumns(prev);
    });
  }, [columnOrder, initialVisibleColumnKeys, normalizeVisibleColumns]);

  const visibleColumns = useMemo(
    () => columnsWithIndex.filter((c) => visibleColumnKeys.includes(c.key)),
    [columnsWithIndex, visibleColumnKeys]
  );

  const hasCustomWidths = useMemo(
    () => Object.values(columnWidths).some((w) => typeof w === 'number'),
    [columnWidths]
  );

  useEffect(() => {
    if (!storageKeyValue) return;
    sessionStorage.setItem(storageKeyValue, JSON.stringify({ visibleColumnKeys, columnWidths }));
  }, [columnWidths, storageKeyValue, visibleColumnKeys]);

  const handleVisibleColumnsChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    const nextKeys = Array.isArray(value) ? value : value.split(',');
    if (nextKeys.length === 0) return;
    setVisibleColumnKeys(normalizeVisibleColumns(nextKeys));
  };

  const handleToggleColumn = (key: string) => {
    setVisibleColumnKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      return next.length > 0 ? normalizeVisibleColumns(next) : prev;
    });
  };

  const handleShowAllColumns = () => setVisibleColumnKeys(columnOrder);
  const handleResetWidths = () => setColumnWidths({});

  const updateScrollerWidth = useCallback((el: HTMLDivElement) => {
    setScrollerWidth(el.clientWidth);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateScrollerWidth(el);

    const ro = new ResizeObserver(() => updateScrollerWidth(el));
    ro.observe(el);

    return () => ro.disconnect();
  }, [updateScrollerWidth]);

  const ensureManualWidths = useCallback(() => {
    const next = visibleColumns.reduce<Record<string, number>>((acc, c) => {
      const measured = headerRefs.current[c.key]?.offsetWidth;
      const fallback = c.width ?? c.minWidth ?? 140;
      acc[c.key] = typeof measured === 'number' && measured > 0 ? measured : fallback;
      return acc;
    }, {});
    setColumnWidths(next);
    return next;
  }, [visibleColumns]);

  // ------- "приклеить" последний столбец к правому краю в MANUAL, если всё помещается -------
  const manualLayout = useMemo(() => {
    if (!hasCustomWidths || visibleColumns.length === 0) {
      return { containerWidth: '100%' as const, gridTemplateColumns: '' };
    }

    const last = visibleColumns[visibleColumns.length - 1];

    const getWidth = (c: DataTableColumn) =>
      typeof columnWidths[c.key] === 'number' ? columnWidths[c.key]! : c.width ?? c.minWidth ?? 140;

    const fixedBeforeLast = visibleColumns.slice(0, -1).reduce((sum, c) => sum + getWidth(c), 0);
    const lastWidth = getWidth(last);

    const fits = scrollerWidth > 0 && fixedBeforeLast + lastWidth < scrollerWidth;

    const template = fits
      ? [...visibleColumns.slice(0, -1).map((c) => `${Math.max(0, Math.floor(getWidth(c)))}px`), 'minmax(0px, 1fr)'].join(
          ' '
        )
      : visibleColumns.map((c) => `${Math.max(0, Math.floor(getWidth(c)))}px`).join(' ');

    return {
      containerWidth: fits ? ('100%' as const) : ('max-content' as const),
      gridTemplateColumns: template,
    };
  }, [columnWidths, hasCustomWidths, scrollerWidth, visibleColumns]);

  const gridTemplateColumns = useMemo(() => {
    if (!visibleColumns.length) return '1fr';

    if (hasCustomWidths) return manualLayout.gridTemplateColumns || '1fr';

    const total = visibleColumns.reduce((sum, c) => sum + (c.fraction ?? 1), 0) || 1;
    return visibleColumns
      .map((c) => {
        const fr = (c.fraction ?? 1) / total;
        return `minmax(0px, ${fr}fr)`;
      })
      .join(' ');
  }, [hasCustomWidths, manualLayout.gridTemplateColumns, visibleColumns]);

  // --- Resizing ---
  const onPointerMove = useCallback((e: PointerEvent) => {
    const s = resizeRef.current;
    if (!s) return;

    const dx = e.clientX - s.startX;
    const nextWidth = Math.max(0, s.startWidth + dx);
    setColumnWidths((prev) => ({ ...prev, [s.key]: nextWidth }));
  }, []);

  const endResize = useCallback(() => {
    if (!resizeRef.current) return;
    resizeRef.current = null;

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endResize);
    window.removeEventListener('pointercancel', endResize);
  }, [onPointerMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endResize);
      window.removeEventListener('pointercancel', endResize);
    };
  }, [endResize, onPointerMove]);

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, columnKey: string) => {
      event.preventDefault();

      const manual = hasCustomWidths ? columnWidths : ensureManualWidths();

      const headerWidth = headerRefs.current[columnKey]?.offsetWidth ?? manual[columnKey] ?? 140;
      const currentWidth = typeof manual[columnKey] === 'number' ? manual[columnKey] : headerWidth;

      resizeRef.current = { key: columnKey, startX: event.clientX, startWidth: currentWidth };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', endResize, { passive: true });
      window.addEventListener('pointercancel', endResize, { passive: true });
    },
    [columnWidths, endResize, ensureManualWidths, hasCustomWidths, onPointerMove]
  );

  const showControls = enableColumnControls && columns.length > 1;
  const settingsOpen = Boolean(settingsAnchor);
  const selectedColumnCountLabel = `Выбрано: ${visibleColumnKeys.length}/${columns.length}`;

  const getStickySide = useCallback(
    (index: number, len: number): StickySide => {
      const isFirst = index === 0;
      const isLast = index === len - 1;

      if (stickyFirstColumn && isFirst) return 'left';
      if (stickyLastColumn && isLast) return 'right';
      return false;
    },
    [stickyFirstColumn, stickyLastColumn]
  );

  const content = () => {
    if (statusContent) return <Box sx={{ padding: 2 }}>{statusContent}</Box>;

    if (isLoading) {
      return (
        <Box sx={{ padding: 2 }}>
          <Typography variant="body2">Загрузка...</Typography>
        </Box>
      );
    }

    if (!hasRows) {
      return (
        <Box sx={{ padding: 2 }}>
          <Typography variant="body2">{emptyMessage}</Typography>
        </Box>
      );
    }

    return rows.map((row) => {
      const cells = renderRow(row);

      return (
        <Box
          key={rowKey(row)}
          sx={{
            display: 'grid',
            gridTemplateColumns,
            alignItems: 'stretch',
            width: hasCustomWidths ? manualLayout.containerWidth : '100%',
            minWidth: '100%',
            backgroundColor: tablePalette.surface,
            borderRadius: 2,
            overflow: 'hidden',
            transition: 'background-color 0.2s ease',
            '&:hover': {
              backgroundColor: tablePalette.rowHover,
              outline: `2px solid ${rowHoverOutlineColor}`,
              outlineOffset: -1,
            },
            cursor: onRowClick ? 'pointer' : 'default',
          }}
          onClick={() => onRowClick?.(row)}
        >
          {visibleColumns.map((column, index) => {
            const stickySide = getStickySide(index, visibleColumns.length);

            return (
              <TableCell
                key={column.key}
                isLast={index === visibleColumns.length - 1}
                align={column.align}
                columnKey={column.key}
                stickySide={stickySide}
              >
                {cells[column.index]}
              </TableCell>
            );
          })}
        </Box>
      );
    });
  };

  return (
    <Box
      sx={{
        backgroundColor: tablePalette.surfaceMuted,
        borderRadius: 3,
        padding: 2.5,
        border: `1px solid ${tablePalette.border}`,
        boxShadow: '0 12px 28px rgba(15, 35, 75, 0.08)',
        width: '100%',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {showControls && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
          >
            <FormControl
              size="small"
              sx={{
                minWidth: 220,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: tablePalette.surface,
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: tablePalette.border,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: tablePalette.accent,
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: tablePalette.accent,
                },
                '& .MuiInputLabel-root': {
                  color: tablePalette.headerText,
                },
                '& .MuiSvgIcon-root': {
                  color: tablePalette.accent,
                },
              }}
            >
              <InputLabel id="columns-filter-label">Столбцы</InputLabel>
              <Select
                labelId="columns-filter-label"
                multiple
                value={visibleColumnKeys}
                label="Столбцы"
                onChange={handleVisibleColumnsChange}
                renderValue={() => selectedColumnCountLabel}
              >
                {columns.map((column) => (
                  <MenuItem key={column.key} value={column.key}>
                    <Checkbox checked={visibleColumnKeys.includes(column.key)} />
                    <ListItemText primary={column.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={1} alignItems="center">
              <Button size="small" variant="outlined" sx={controlButtonSx} onClick={handleShowAllColumns}>
                Показать все
              </Button>
              <Button
                size="small"
                variant="outlined"
                sx={controlButtonSx}
                onClick={(event) => setSettingsAnchor(event.currentTarget)}
              >
                Настройки
              </Button>
            </Stack>

            <Menu
              anchorEl={settingsAnchor}
              open={settingsOpen}
              onClose={() => setSettingsAnchor(null)}
              MenuListProps={{ dense: true }}
            >
              <MenuItem disabled>Настройка столбцов</MenuItem>
              {columns.map((column) => (
                <MenuItem key={column.key} onClick={() => handleToggleColumn(column.key)}>
                  <Checkbox checked={visibleColumnKeys.includes(column.key)} />
                  <ListItemText primary={column.label} />
                </MenuItem>
              ))}
              <MenuItem onClick={handleShowAllColumns}>Показать все</MenuItem>
              <MenuItem onClick={handleResetWidths}>Сбросить ширину</MenuItem>
            </Menu>
          </Stack>
        )}

        <Box
          ref={scrollerRef}
          onScroll={(e) => updateScrollerWidth(e.currentTarget)}
          sx={{
            overflowX: 'auto',
            overflowY: 'hidden',
            width: '100%',
            paddingBottom: 0.5,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {showHeader && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns,
                  alignItems: 'stretch',
                  width: hasCustomWidths ? manualLayout.containerWidth : '100%',
                  minWidth: '100%',
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: `1px solid ${tablePalette.border}`,
                  borderBottom: 'none',
                  boxShadow: '0 6px 16px rgba(15, 35, 75, 0.06)',
                }}
              >
                {visibleColumns.map((column, index) => {
                  const stickySide = getStickySide(index, visibleColumns.length);

                  return (
                    <TableCell
                      key={column.key}
                      isLast={index === visibleColumns.length - 1}
                      align={column.align}
                      columnKey={column.key}
                      isHeader
                      showResizer
                      stickySide={stickySide}
                      setRef={(node) => {
                        headerRefs.current[column.key] = node;
                      }}
                      onResizeStart={(event) => handleResizeStart(event, column.key)}
                    >
                      {renderHeaderLabel(column.label)}
                    </TableCell>
                  );
                })}
              </Box>
            )}

            {content()}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
