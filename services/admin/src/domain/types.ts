export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  category: "account" | "payment" | "route" | "other";
  messages: Array<{
    author: "user" | "support";
    body: string;
    createdAt: string;
  }>;
  internalNotes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditEvent {
  id: string;
  action: string;
  operatorId: string;
  targetId: string;
  timestamp: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface UserSuspensionCommand {
  targetUserId: string;
  reason: string;
  suspendedBy: string;
  disableCognito: boolean;
}

export interface SystemMaintenanceConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  updatedAt: number;
  updatedBy: string;
}
