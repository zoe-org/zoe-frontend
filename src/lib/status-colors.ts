/** Cores de estado do Operations, num lugar só. */

export const CAMPAIGN_STATUS_COLOR: Record<string, string> = {
  Draft: "#6B7280",
  Active: "#00A799",
  Completed: "#2563EB",
  Cancelled: "#DC2626",
}

export const CONTRACT_STATUS_COLOR: Record<string, string> = {
  Draft: "#6B7280",
  SentForSignature: "#D97706",
  Signed: "#00A799",
  Cancelled: "#DC2626",
}

export const ESCROW_STATE_COLOR: Record<string, string> = {
  PendingDeposit: "#9CA3AF",
  Funded: "#2563EB",
  InProduction: "#D97706",
  Delivered: "#7C3AED",
  UnderReview: "#8B5CF6",
  Releasable: "#00A799",
  Released: "#059669",
  Disputed: "#DC2626",
  Refunded: "#6B7280",
}

export const DELIVERY_STATUS_COLOR: Record<string, string> = {
  Submitted: "#6B7280",
  UnderReview: "#D97706",
  Approved: "#00A799",
  ReworkRequested: "#DC2626",
  Rejected: "#DC2626",
}

export const DRAFT_STATUS_COLOR: Record<string, string> = {
  AwaitingReview: "#D97706",
  Approved: "#00A799",
  ChangesRequested: "#DC2626",
}
