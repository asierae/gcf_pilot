import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';

interface CalendarDay {
  date: Date;
  label: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  disabled: boolean;
}

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css'
})
export class DatePickerComponent implements OnChanges {
  @Input() value = '';
  @Input() label = '';
  @Input() placeholder = 'Select date';
  @Input() minDate = '';
  @Input() maxDate = '';
  @Input() ariaLabel = 'Select date';

  @Output() valueChange = new EventEmitter<string>();

  open = false;
  viewMonth = new Date();
  readonly weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && this.value) {
      const parsed = this.parseIsoDate(this.value);
      if (parsed) {
        this.viewMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
      }
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }

  get displayValue(): string {
    if (!this.value) {
      return this.placeholder;
    }

    const parsed = this.parseIsoDate(this.value);
    if (!parsed) {
      return this.placeholder;
    }

    return parsed.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  get monthLabel(): string {
    return this.viewMonth.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric'
    });
  }

  get calendarDays(): CalendarDay[] {
    const year = this.viewMonth.getFullYear();
    const month = this.viewMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);
    const today = this.startOfDay(new Date());
    const selected = this.value ? this.parseIsoDate(this.value) : null;
    const days: CalendarDay[] = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const inMonth = date.getMonth() === month;
      days.push({
        date,
        label: date.getDate(),
        inMonth,
        isToday: this.isSameDay(date, today),
        isSelected: selected ? this.isSameDay(date, selected) : false,
        disabled: !this.isDateAllowed(date)
      });
    }

    return days;
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.open = !this.open;
    if (this.open) {
      const base = this.value ? this.parseIsoDate(this.value) : new Date();
      if (base) {
        this.viewMonth = new Date(base.getFullYear(), base.getMonth(), 1);
      }
    }
  }

  onDropdownClick(event: Event): void {
    event.stopPropagation();
  }

  prevMonth(event: Event): void {
    event.stopPropagation();
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() - 1, 1);
  }

  nextMonth(event: Event): void {
    event.stopPropagation();
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() + 1, 1);
  }

  selectDay(day: CalendarDay, event: Event): void {
    event.stopPropagation();
    if (day.disabled) {
      return;
    }

    this.valueChange.emit(this.toIsoDate(day.date));
    this.open = false;
  }

  clearValue(event: Event): void {
    event.stopPropagation();
    this.valueChange.emit('');
    this.open = false;
  }

  private isDateAllowed(date: Date): boolean {
    const day = this.startOfDay(date);

    if (this.minDate) {
      const min = this.parseIsoDate(this.minDate);
      if (min && day < this.startOfDay(min)) {
        return false;
      }
    }

    if (this.maxDate) {
      const max = this.parseIsoDate(this.maxDate);
      if (max && day > this.startOfDay(max)) {
        return false;
      }
    }

    return true;
  }

  private parseIsoDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
