import { alpha } from '@mui/material/styles';
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

export const AppFooter = () => (
  <Box
    component="footer"
    sx={(theme) => ({
      width: '100%',
      px: { xs: 1.25, md: 2.5 },
      pt: { xs: 0.8, md: 1.1 },
      pb: { xs: 1.1, md: 1.5 },
      borderTop: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
      background: `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 22%, ${theme.palette.background.paper} 100%)`
    })}
  >
    <Box
      sx={(theme) => ({
        maxWidth: 1200,
        mx: 'auto',
        px: { xs: 1.1, md: 1.75 },
        py: { xs: 0.8, md: 0.95 },
        borderRadius: 4,
        border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
        background: `linear-gradient(135deg, ${alpha('#ffffff', 0.95)} 0%, ${alpha(theme.palette.primary.light, 0.22)} 100%)`,
        boxShadow: '0 10px 24px rgba(15, 35, 75, 0.1)',
        backdropFilter: 'blur(6px)'
      })}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems="center"
        justifyContent="space-between"
        spacing={{ xs: 0.9, md: 2.2 }}
      >
        <Box sx={{ flex: 1, display: 'flex', justifyContent: { xs: 'center', md: 'flex-start' } }}>
          <Stack direction="row" alignItems="center" spacing={1.1}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              Created by «Цифровизация проектных задач»
            </Typography>
            <Link href={BITRIX_LINK} target="_blank" rel="noreferrer" aria-label="Перейти в Битрикс" sx={iconLinkSx}>
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
            textAlign: 'center',
            whiteSpace: 'nowrap'
          }}
        >
          AcomOfferDesk
        </Typography>

        <Box sx={{ flex: 1, display: 'flex', justifyContent: { xs: 'center', md: 'flex-end' } }}>
          <Stack direction="row" alignItems="center" spacing={1.1}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              По вопросам системы писать сюда
            </Typography>
            <Link href={MAX_CONTACT_LINK} target="_blank" rel="noreferrer" aria-label="Открыть MAX" sx={iconLinkSx}>
              <Box component="img" src={maxLogo} alt="MAX" sx={iconImageSx} />
            </Link>
          </Stack>
        </Box>
      </Stack>
    </Box>
  </Box>
);
