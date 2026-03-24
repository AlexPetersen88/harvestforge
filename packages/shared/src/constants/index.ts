// Machine status display configuration
export const MACHINE_STATUS_CONFIG = {
  harvesting: { color: "#22c55e", label: "Harvesting", icon: "🌾" },
  moving: { color: "#3b82f6", label: "Moving", icon: "🚛" },
  idle: { color: "#f59e0b", label: "Idle", icon: "⏸" },
  breakdown: { color: "#ef4444", label: "Breakdown", icon: "⚠" },
  maintenance: { color: "#a855f7", label: "Maintenance", icon: "🔧" },
  offline: { color: "#6b7280", label: "Offline", icon: "○" },
} as const;

export const ALERT_LEVEL_CONFIG = {
  critical: { color: "#ef4444", label: "Critical", priority: 1 },
  warning: { color: "#f59e0b", label: "Warning", priority: 2 },
  info: { color: "#60a5fa", label: "Info", priority: 3 },
} as const;

export const HARVEST_WINDOW_CONFIG = {
  clear: { color: "#22c55e", label: "Clear" },
  marginal: { color: "#f59e0b", label: "Marginal" },
  unsuitable: { color: "#ef4444", label: "Unsuitable" },
} as const;

// Keyboard shortcuts for Command Center
export const KEYBOARD_SHORTCUTS = {
  SEARCH_FLEET: { key: "f", mod: "ctrl", label: "Search fleet" },
  QUICK_REPLAN: { key: "r", mod: null, label: "Quick Replan" },
  TOGGLE_HARVEST_MODE: { key: "h", mod: "ctrl", label: "Toggle Harvest Mode" },
  TOGGLE_DARK_MODE: { key: "d", mod: "ctrl", label: "Toggle Dark Mode" },
  REFRESH: { key: "F5", mod: null, label: "Refresh data" },
  NEXT_MACHINE: { key: "ArrowDown", mod: null, label: "Next machine" },
  PREV_MACHINE: { key: "ArrowUp", mod: null, label: "Previous machine" },
} as const;

// API rate limits
export const RATE_LIMITS = {
  STANDARD: { max: 100, window: "1 minute" },
  SYNC: { max: 300, window: "1 minute" },
  MOBILE: { max: 60, window: "1 minute" },
  REPORTS: { max: 10, window: "1 minute" },
} as const;

// Stale data threshold
export const STALE_THRESHOLD_MIN = 15;

// Convoy desync threshold
export const CONVOY_GAP_THRESHOLD_MIN = 15;

// Solver timeout
export const SOLVER_TIMEOUT_MS = 30000;

// Mobile touch target minimum (dp)
export const MIN_TOUCH_TARGET_DP = 48;
