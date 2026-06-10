import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  Input,
  Output
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR
} from '@angular/forms';
import { MAX_FILES_PER_ATTACHMENT } from '../../../config/attachments.config';
import { StoredAttachment } from '../../../models/attachment.model';
import { CloudinaryService } from '../../../services/cloudinary.service';
import { NotificationService } from '../../../services/notification.service';
import { normalizeAttachments } from '../../../config/attachments.config';
import { resolveCloudinaryFileUrl } from '../../utils/cloudinary-url.util';

interface AttachedFileItem extends StoredAttachment {
  id: string;
  uploading?: boolean;
}

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FileUploadComponent),
      multi: true
    }
  ]
})
export class FileUploadComponent implements ControlValueAccessor {
  @Input() label = 'Upload files';
  @Input() hint = 'Drag & drop or click to browse';
  @Input() maxFiles = MAX_FILES_PER_ATTACHMENT;
  @Input() accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt,.zip';

  @Output() uploadError = new EventEmitter<string>();

  files: AttachedFileItem[] = [];
  uploadingCount = 0;
  dragOver = false;
  disabled = false;
  removingId: string | null = null;

  private onChange: (value: StoredAttachment[]) => void = () => {};
  private onTouched: () => void = () => {};
  private nextId = 0;

  constructor(
    private cloudinaryService: CloudinaryService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  writeValue(value: StoredAttachment[] | string[] | null | undefined): void {
    const attachments = normalizeAttachments(value);
    const existingByUrl = new Map(
      this.files.filter((f) => !f.uploading && f.url).map((f) => [f.url, f])
    );

    this.files = attachments.map((attachment) => {
      const existing = existingByUrl.get(attachment.url);
      return (
        existing ?? {
          id: this.createId(),
          ...attachment
        }
      );
    });
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: StoredAttachment[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  get savedCount(): number {
    return this.files.filter((f) => !f.uploading && f.url).length;
  }

  get canAddMore(): boolean {
    return !this.disabled && this.uploadingCount === 0 && this.files.length < this.maxFiles;
  }

  get slotsRemaining(): number {
    return Math.max(0, this.maxFiles - this.files.length);
  }

  get isBusy(): boolean {
    return this.uploadingCount > 0 || this.removingId !== null;
  }

  onBrowseClick(event: Event, input: HTMLInputElement): void {
    event.stopPropagation();
    if (!this.canAddMore) {
      return;
    }
    input.click();
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files ? Array.from(input.files) : [];
    input.value = '';
    void this.handleFiles(selected);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.canAddMore) {
      this.dragOver = true;
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;

    if (!this.canAddMore) {
      return;
    }

    const dropped = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
    await this.handleFiles(dropped);
  }

  openUrl(file: AttachedFileItem): string {
    return resolveCloudinaryFileUrl(file);
  }

  isRemoving(file: AttachedFileItem): boolean {
    return this.removingId === file.id;
  }

  async removeFile(file: AttachedFileItem, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (this.disabled || file.uploading || this.removingId) {
      return;
    }

    this.removingId = file.id;
    this.cdr.markForCheck();

    try {
      if (file.publicId) {
        await this.cloudinaryService.deleteFile(file.publicId, file.resourceType);
      }

      this.files = this.files.filter((item) => item.id !== file.id);
      this.emitValue();
      this.onTouched();
      this.notificationService.success(`"${file.name}" removed.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete file.';
      this.notificationService.error(message);
    } finally {
      this.removingId = null;
      this.cdr.markForCheck();
    }
  }

  private async handleFiles(selected: File[]): Promise<void> {
    if (!selected.length) {
      return;
    }

    const available = this.slotsRemaining;
    if (available <= 0) {
      this.notificationService.warning(`Maximum ${this.maxFiles} files allowed.`);
      return;
    }

    const batch = selected.slice(0, available);
    if (selected.length > available) {
      this.notificationService.warning(`Only ${available} more file(s) can be added.`);
    }

    this.onTouched();

    for (const file of batch) {
      const pending: AttachedFileItem = {
        id: this.createId(),
        url: '',
        publicId: '',
        resourceType: 'raw',
        name: file.name,
        uploading: true
      };

      this.files = [...this.files, pending];
      this.uploadingCount += 1;
      this.cdr.markForCheck();

      try {
        const uploaded = await this.cloudinaryService.uploadFile(file);
        this.files = this.files.map((item) =>
          item.id === pending.id
            ? { ...item, ...uploaded, uploading: false }
            : item
        );
        this.emitValue();
      } catch (error) {
        this.files = this.files.filter((item) => item.id !== pending.id);
        const message = error instanceof Error ? error.message : 'Upload failed.';
        this.uploadError.emit(message);
        this.notificationService.error(message);
      } finally {
        this.uploadingCount -= 1;
        this.cdr.markForCheck();
      }
    }
  }

  private emitValue(): void {
    const attachments: StoredAttachment[] = this.files
      .filter((file) => !file.uploading && file.url)
      .map(({ url, publicId, resourceType, name }) => ({
        url,
        publicId,
        resourceType,
        name
      }));
    this.onChange(attachments);
  }

  private createId(): string {
    this.nextId += 1;
    return `file-${Date.now()}-${this.nextId}`;
  }
}
