import { theme as antTheme } from 'antd'
import type { ThemeConfig } from 'antd'

const shared: ThemeConfig = {
  token: {
    fontFamily: "'Golos Text', 'Inter', 'Helvetica Neue', sans-serif",
    fontSize: 13,
    borderRadius: 2,
    borderRadiusSM: 2,
    borderRadiusLG: 2,
    controlHeight: 34,
    lineHeight: 1.5,
    boxShadow: 'none',
    boxShadowSecondary: 'none',
    boxShadowTertiary: 'none',
    motionDurationFast: '0.15s',
    motionDurationMid: '0.18s',
    motionDurationSlow: '0.22s',
  },
}

export const darkTheme: ThemeConfig = {
  ...shared,
  algorithm: antTheme.darkAlgorithm,
  token: {
    ...shared.token,
    colorPrimary: '#e9ff57',
    colorBgBase: '#0b0c0d',
    colorBgContainer: '#111315',
    colorBgElevated: '#17191c',
    colorBgLayout: '#0b0c0d',
    colorBorder: 'rgba(255,255,255,0.07)',
    colorBorderSecondary: 'rgba(255,255,255,0.14)',
    colorText: '#ecedee',
    colorTextSecondary: '#9ba1a7',
    colorTextTertiary: '#6a7076',
    colorTextDisabled: '#484e54',
    colorError: '#ff4a4a',
    colorWarning: '#e0a458',
    colorSuccess: '#7fd18f',
    colorInfo: '#7e9cd8',
    colorLink: '#e9ff57',
    colorLinkHover: '#f4ff9c',
    colorFillAlter: 'rgba(255,255,255,0.03)',
  },
  components: {
    Layout: {
      bodyBg: '#0b0c0d',
      siderBg: '#111315',
      headerBg: 'transparent',
      footerBg: '#0b0c0d',
    },
    Menu: {
      darkItemBg: '#111315',
      darkSubMenuItemBg: '#17191c',
      darkItemSelectedBg: 'rgba(233,255,87,0.1)',
      darkItemSelectedColor: '#e9ff57',
      darkItemColor: '#6a7076',
      darkItemHoverColor: '#ecedee',
      darkItemHoverBg: 'rgba(255,255,255,0.03)',
      itemHeight: 44,
      collapsedWidth: 48,
    },
    Table: {
      headerBg: '#17191c',
      rowHoverBg: 'rgba(255,255,255,0.02)',
      borderColor: 'rgba(255,255,255,0.07)',
      headerColor: '#6a7076',
      cellFontSize: 13,
    },
    Modal: {
      contentBg: '#111315',
      headerBg: '#111315',
    },
    Card: {
      colorBgContainer: '#111315',
    },
    Input: {
      colorBgContainer: '#17191c',
      activeBorderColor: '#e9ff57',
      hoverBorderColor: 'rgba(255,255,255,0.22)',
      activeShadow: 'none',
    },
    Select: {
      colorBgContainer: '#17191c',
      optionActiveBg: 'rgba(255,255,255,0.04)',
      optionSelectedBg: 'rgba(233,255,87,0.1)',
      optionSelectedColor: '#e9ff57',
    },
    Button: {
      primaryColor: '#0b0c0d',
      defaultBg: 'transparent',
      defaultBorderColor: 'rgba(255,255,255,0.14)',
      defaultColor: '#9ba1a7',
    },
    Tag: {
      defaultBg: '#17191c',
      defaultColor: '#6a7076',
    },
    Tooltip: {
      colorBgSpotlight: '#1e2125',
    },
    Breadcrumb: {
      linkColor: '#6a7076',
      lastItemColor: '#ecedee',
      separatorColor: '#484e54',
    },
    Slider: {
      trackBg: '#e9ff57',
      handleColor: '#e9ff57',
      railBg: '#1e2125',
    },
  },
}

export const lightTheme: ThemeConfig = {
  ...shared,
  algorithm: antTheme.defaultAlgorithm,
  token: {
    ...shared.token,
    colorPrimary: '#8faf6e',
    colorBgBase: '#f2f2f0',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#f6f6f4',
    colorBgLayout: '#f2f2f0',
    colorBorder: 'rgba(10,12,13,0.09)',
    colorBorderSecondary: 'rgba(10,12,13,0.17)',
    colorText: '#101214',
    colorTextSecondary: '#585e64',
    colorTextTertiary: '#82878d',
    colorTextDisabled: '#afb4b9',
    colorError: '#ff4a4a',
    colorWarning: '#e0a458',
    colorSuccess: '#7fd18f',
    colorInfo: '#7e9cd8',
    colorLink: '#8faf6e',
    colorLinkHover: '#a8c48a',
  },
  components: {
    Layout: {
      bodyBg: '#f2f2f0',
      siderBg: '#ffffff',
      headerBg: 'transparent',
    },
    Menu: {
      itemBg: '#ffffff',
      subMenuItemBg: '#f6f6f4',
      itemSelectedBg: 'rgba(143,175,110,0.16)',
      itemSelectedColor: '#8faf6e',
      itemColor: '#82878d',
      itemHoverColor: '#101214',
    },
    Table: {
      headerBg: '#f6f6f4',
      rowHoverBg: 'rgba(0,0,0,0.02)',
      borderColor: 'rgba(10,12,13,0.09)',
    },
    Button: {
      defaultBg: 'transparent',
      defaultBorderColor: 'rgba(10,12,13,0.17)',
      defaultColor: '#585e64',
    },
  },
}

/** Legacy default export — dark theme (backward compat) */
export const antdTheme = darkTheme
