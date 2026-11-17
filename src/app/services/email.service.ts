import { Injectable } from '@angular/core';
import { CONTACT_EMAIL, EMAIL_API_URL } from '../config/email.config';

export interface ReviewEmailPayload {
  to: string;
  subject: string;
  body: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  /** Replies land in the shared inbox, never in the noreply account. */
  readonly senderEmail = CONTACT_EMAIL;

  async sendReviewEmail(payload: ReviewEmailPayload): Promise<'automatic' | 'manual'> {
    try {
      const response = await fetch(`${EMAIL_API_URL}/api/send-review-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.to,
          subject: payload.subject,
          body: payload.body
        })
      });

      if (response.ok) {
        return 'automatic';
      }
    } catch {
      // Backend not running or not configured — fall back to Gmail compose
    }

    this.openGmailCompose(payload);
    return 'manual';
  }

  openGmailCompose(payload: ReviewEmailPayload): void {
    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: payload.to,
      su: payload.subject,
      body: payload.body,
      authuser: CONTACT_EMAIL
    });

    window.open(`https://mail.google.com/mail/?${params.toString()}`, '_blank');
  }
}
