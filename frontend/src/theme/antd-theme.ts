import type { ThemeConfig } from 'antd'
import { tokens } from './tokens'

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: tokens.accent.cyan,
    colorBgBase: tokens.bg.base,
    colorBgContainer: tokens.bg.surface,
    colorBgElevated: tokens.bg.elevated,
    colorBorder: tokens.border.subtle,
    colorBorderSecondary: tokens.border.medium,
    colorText: tokens.text.primary,
    colorTextSecondary: tokens.text.secondary,
    colorTextTertiary: tokens.text.muted,
    colorTextDisabled: tokens.text.inactive,
    colorError: tokens.accent.red,
    colorWarning: tokens.accent.amber,
    colorInfo: tokens.accent.blue,
    colorSuccess: tokens.accent.cyan,
    colorLink: tokens.accent.cyan,
    colorLinkHover: tokens.accent.cyanHover,
    fontFamily: tokens.font.body,
    fontSize: 13,
    borderRadius: 4,
    borderRadiusSM: 3,
    borderRadiusLG: 6,
    controlHeight: 32,
    lineHeight: 1.5,
    boxShadow: 'none',
    boxShadowSecondary: 'none',
  },
  components: {
    Layout: {
      bodyBg: tokens.bg.base,
      headerBg: tokens.bg.elevated,
      siderBg: tokens.bg.surface,
      footerBg: tokens.bg.base,
    },
    Menu: {
      darkItemBg: tokens.bg.surface,
      darkSubMenuItemBg: tokens.bg.elevated,
      darkItemSelectedBg: tokens.accent.cyanBg,
      darkItemSelectedColor: tokens.accent.cyan,
      darkItemColor: tokens.text.secondary,
      darkItemHoverColor: tokens.text.primary,
    },
    Table: {
      headerBg: tokens.bg.elevated,
      rowHoverBg: 'rgba(255,255,255,0.03)',
      borderColor: tokens.border.subtle,
    },
    Modal: {
      contentBg: tokens.bg.surface,
      headerBg: tokens.bg.elevated,
    },
    Card: {
      colorBgContainer: tokens.bg.surface,
    },
    Input: {
      colorBgContainer: tokens.bg.elevated,
      activeBorderColor: tokens.accent.cyan,
      hoverBorderColor: tokens.border.strong,
    },
    Select: {
      colorBgContainer: tokens.bg.elevated,
      optionActiveBg: tokens.accent.cyanBg,
      optionSelectedBg: tokens.accent.cyanBg,
    },
    Button: {
      primaryColor: tokens.bg.base,
      defaultBg: tokens.bg.elevated,
      defaultBorderColor: tokens.border.medium,
      defaultColor: tokens.text.primary,
    },
    Tag: {
      defaultBg: tokens.bg.elevated,
      defaultColor: tokens.text.secondary,
    },
    Tooltip: {
      colorBgSpotlight: tokens.bg.elevated,
    },
  },
  algorithm: undefined,
}
