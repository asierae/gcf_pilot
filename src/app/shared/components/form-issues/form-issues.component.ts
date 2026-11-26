import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** One requirement that still blocks a form submission. */
export interface FormIssue {
  /** Section shown as the group heading (already localised by the caller). */
  section: string;
  /** Field or requirement that is missing. */
  label: string;
  /** Wizard step that renders the field. */
  step: number;
  /** Control name, used to scroll to and focus the exact input. */
  field?: string;
  /** `required`, `email` or `invalid`. */
  error?: string;
}

interface FormIssueGroup {
  section: string;
  items: FormIssue[];
}

/**
 * Dismissible summary of the requirements missing before a submission.
 *
 * The host page keeps the list and toggles it on a failed submit; the card only
 * renders it grouped by section and lets the user jump to each field.
 */
@Component({
  selector: 'app-form-issues',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './form-issues.component.html',
  styleUrl: './form-issues.component.css',
})
export class FormIssuesComponent {
  @Input() issues: FormIssue[] = [];

  /** Optional extra line (e.g. "Complete the current step before continuing"). */
  @Input() note = '';

  @Output() dismiss = new EventEmitter<void>();
  @Output() select = new EventEmitter<FormIssue>();

  get groups(): FormIssueGroup[] {
    const groups: FormIssueGroup[] = [];
    for (const issue of this.issues) {
      const last = groups[groups.length - 1];
      if (last && last.section === issue.section) {
        last.items.push(issue);
      } else {
        groups.push({ section: issue.section, items: [issue] });
      }
    }
    return groups;
  }

  errorKey(error?: string): string {
    if (!error || error === 'required') return '';
    return error === 'email' ? 'FORM_ISSUES.INVALID_EMAIL' : 'FORM_ISSUES.INVALID_VALUE';
  }
}
