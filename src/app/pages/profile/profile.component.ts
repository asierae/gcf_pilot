import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { collectAttachmentFields } from '../../config/attachments.config';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { StorageService } from '../../services/storage.service';
import { StoredAttachment } from '../../models/attachment.model';
import { resolveCloudinaryFileUrl } from '../../shared/utils/cloudinary-url.util';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  loading = true;
  applicantName = '';
  applicantAcronym = '';
  attachmentFields: { key: string; label: string; attachments: StoredAttachment[] }[] = [];

  constructor(
    public authService: AuthService,
    private storageService: StorageService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    void this.loadProfile();
  }

  fileUrl(attachment: StoredAttachment | string): string {
    return resolveCloudinaryFileUrl(attachment);
  }

  private async loadProfile(): Promise<void> {
    this.loading = true;

    try {
      const data = await this.storageService.getLatestApplicantData();
      this.applicantName = (data['applicantName'] as string) || 'Applicant';
      this.applicantAcronym = (data['applicantAcronym'] as string) || '';
      this.attachmentFields = collectAttachmentFields(data);
    } catch {
      this.notificationService.error('Could not load your profile documents from Firebase.');
    } finally {
      this.loading = false;
    }
  }
}
