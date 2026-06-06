import { Injectable } from '@angular/core';
import { EMAIL_API_URL, REVIEW_SENDER_EMAIL } from '../config/email.config';

export interface ReviewEmailPayload {
  to: string;
  subject: string;
  body: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  readonly senderEmail = REVIEW_SENDER_EMAIL;

  async sendReviewEmail(payload: ReviewEmailPayload): Promise<'automatic' | 'manual'> {
    try {
      const response = await fetch(`${EMAIL_API_URL}/api/send-review-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.to,
          subject: payload.subject,
          body: payload.body,
          from: REVIEW_SENDER_EMAIL
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
      authuser: REVIEW_SENDER_EMAIL
    });

    window.open(`https://mail.google.com/mail/?${params.toString()}`, '_blank');
  }
}
