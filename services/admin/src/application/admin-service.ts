import type { UserSuspensionCommand, SystemMaintenanceConfig } from "../domain/types.js";

export class AdminGovernanceService {
  private static readonly PROTECTED_ADMIN_EMAILS = [
    "sahinbolukbasii@gmail.com",
  ];

  /**
   * Enforces that root/protected platform administrators cannot be accidentally suspended or demoted.
   */
  public canModifyUser(targetEmail: string): boolean {
    return !AdminGovernanceService.PROTECTED_ADMIN_EMAILS.includes(targetEmail.toLowerCase());
  }

  /**
   * Sanitizes export data against CSV formula injection.
   */
  public sanitizeCsvField(value: string): string {
    if (/^[=+\-@\t\r]/.test(value)) {
      return `'${value}`;
    }
    return value;
  }
}
