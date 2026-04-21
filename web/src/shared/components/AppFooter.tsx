import { Box, Link, Stack, Typography } from '@mui/material';
import bitrixLogo from '@shared/assets/bitrix24-logo.png';
import maxLogo from '@shared/assets/max-logo-2025.png';

const BITRIX_LINK = 'https://team.alabuga.ru/company/structure.php?set_filter_structure=Y&structure_UF_DEPARTMENT=8304&filter=Y&set_filter=Y';
const MAX_CONTACT_LINK = 'https://max.ru/u/f9LHodD0cOIA4s2RhH3dW5NoCLRn88NF67UYfQe_rOnnM6Y1a7VW_vOUt5I';

const iconLinkSx = {
  width: 40,
  height: 40,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 2.5,
  border: '1px solid',
  borderColor: 'divider',
  backgroundColor: 'rgba(255, 255, 255, 0.86)',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
  '&:hover': {
    borderColor: 'primary.main',
    backgroundColor: '#fff',
    transform: 'translateY(-1px) scale(1.02)',
    boxShadow: '0 8px 16px rgba(15, 35, 75, 0.16)'
  }
};

const iconImageSx = {
  display: 'block',
  width: 30,
  height: 30,
  objectFit: 'cover' as const,
  borderRadius: 2
};

const CREATED_BY_LABEL = 'Created by «Цифровизация проектных задач»';
const SUPPORT_LABEL = 'По вопросам системы писать сюда';
const BITRIX_ARIA_LABEL = 'Перейти в Битрикс';
const MAX_ARIA_LABEL = 'Открыть MAX';

export const AppFooter = () => (
  <Box
    component="footer"
    sx={{
      width: '100%',
      pr: { lg: 'var(--offer-workspace-chat-offset, 0px)' },
      px: { xs: 0.5, md: 1.2 },
      pt: { xs: 0.4, md: 0.6 },
      pb: { xs: 0.9, md: 1.1 },
      transition: 'padding-right 0.2s ease'
    }}
  >
    <Box
      sx={{
        maxWidth: '100%',
        mx: 'auto',
        px: { xs: 1.1, md: 1.75 },
        py: { xs: 0.8, md: 0.95 },
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.82)',
        boxShadow: '0 8px 24px rgba(15, 35, 75, 0.08)'
      }}
    >
      <Stack
        direction={{ xs: 'column', xl: 'row' }}
        alignItems={{ xs: 'stretch', xl: 'center' }}
        justifyContent="space-between"
        spacing={{ xs: 0.9, md: 2.2 }}
      >
        <Box sx={{ flex: 1, display: 'flex', justifyContent: { xs: 'center', xl: 'flex-start' } }}>
          <Stack direction="row" alignItems="center" spacing={1.1} useFlexGap flexWrap="wrap" justifyContent={{ xs: 'center', xl: 'flex-start' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, textAlign: { xs: 'center', xl: 'left' } }}>
              {CREATED_BY_LABEL}
            </Typography>
            <Link href={BITRIX_LINK} target="_blank" rel="noreferrer" aria-label={BITRIX_ARIA_LABEL} sx={iconLinkSx}>
              <Box component="img" src={bitrixLogo} alt="Bitrix24" sx={iconImageSx} />
            </Link>
          </Stack>
        </Box>

        <Typography
          variant="subtitle1"
          color="text.primary"
          sx={{
            fontWeight: 600,
            letterSpacing: 0.3,
            textTransform: 'none',
            textAlign: 'center'
          }}
        >
          AcomOfferDesk
        </Typography>

        <Box sx={{ flex: 1, display: 'flex', justifyContent: { xs: 'center', xl: 'flex-end' } }}>
          <Stack direction="row" alignItems="center" spacing={1.1} useFlexGap flexWrap="wrap" justifyContent={{ xs: 'center', xl: 'flex-end' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, textAlign: { xs: 'center', xl: 'right' } }}>
              {SUPPORT_LABEL}
            </Typography>
            <Link href={MAX_CONTACT_LINK} target="_blank" rel="noreferrer" aria-label={MAX_ARIA_LABEL} sx={iconLinkSx}>
              <Box component="img" src={maxLogo} alt="MAX" sx={iconImageSx} />
            </Link>
          </Stack>
        </Box>
      </Stack>
    </Box>
  </Box>
);
