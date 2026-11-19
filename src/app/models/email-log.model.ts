/** One entry of the admin "Send email" log (one row per send operation). */
export interface EmailLogEntry {
  id: string;
  subject: string;
  title: string;
  senderAlias: string;
  recipients: string[];
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
  createdBy: string;
  createdAt: string;
}
