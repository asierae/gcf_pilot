import {
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  ViewChild,
  forwardRef,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { COUNTRY_NAMES } from "../../data/countries";

@Component({
  selector: "app-country-select",
  standalone: true,
  templateUrl: "./country-select.component.html",
  styleUrl: "./country-select.component.css",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CountrySelectComponent),
      multi: true,
    },
  ],
})
export class CountrySelectComponent implements ControlValueAccessor {
  @Input() placeholder = "Select country...";
  @Input() multiple = false;
  @Input() compact = false;
  /** Table cells need a floating panel; forms use an inline one. */
  @Input() overlay = false;
  @Input() inputId = "";
  @Input() name = "";

  @HostBinding("attr.name") get hostName(): string | null {
    return this.name || null;
  }

  @ViewChild("control") control?: ElementRef<HTMLElement>;
  @ViewChild("panel") panel?: ElementRef<HTMLElement>;
  @ViewChild("searchInput") searchInput?: ElementRef<HTMLInputElement>;

  value = "";
  disabled = false;
  open = false;
  query = "";
  activeIndex = 0;
  panelStyle: Record<string, string> = {};
  readonly countries = COUNTRY_NAMES;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  get selected(): string[] {
    return this.value
      ? this.value.split(",").map((part) => part.trim()).filter(Boolean)
      : [];
  }

  get displayValue(): string {
    return this.multiple ? this.selected.join(", ") : this.value;
  }

  get filteredCountries(): string[] {
    const query = this.query.trim().toLowerCase();
    if (!query) return this.countries;
    return this.countries.filter(
      (country) =>
        country.toLowerCase().includes(query) ||
        country.toLowerCase().startsWith(query),
    );
  }

  writeValue(value: string | null): void {
    this.value = typeof value === "string" ? value : "";
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    if (disabled) this.close();
  }

  toggle(event?: Event): void {
    event?.stopPropagation();
    if (this.disabled) return;
    if (this.open) this.close();
    else this.openPanel();
  }

  private openPanel(): void {
    this.open = true;
    this.query = "";
    this.activeIndex = 0;

    const control = this.control?.nativeElement;
    const maxHeight = 250;
    if (control && window.innerHeight - control.getBoundingClientRect().bottom < maxHeight + 16) {
      // Bring the field into view so the panel opens downwards and stays visible.
      control.scrollIntoView({ block: "center", behavior: "auto" });
    }

    if (this.overlay && control) {
      const rect = control.getBoundingClientRect();
      this.panelStyle = {
        left: `${rect.left}px`,
        width: `${Math.max(rect.width, 200)}px`,
        top: `${rect.bottom + 4}px`,
        maxHeight: `${maxHeight}px`,
      };
    }

    setTimeout(() => this.searchInput?.nativeElement.focus({ preventScroll: true }));
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.query = "";
    this.activeIndex = 0;
    this.onTouched();
  }

  onSearch(event: Event): void {
    this.query = (event.target as HTMLInputElement).value;
    this.activeIndex = 0;
  }

  isSelected(country: string): boolean {
    return this.selected.includes(country);
  }

  select(country: string): void {
    if (this.multiple) {
      const values = new Set(this.selected);
      if (values.has(country)) values.delete(country);
      else values.add(country);
      this.setValue([...values].join(", "));
    } else {
      this.setValue(country === this.value ? "" : country);
      this.close();
    }
  }

  remove(country: string, event: Event): void {
    event.stopPropagation();
    this.setValue(this.selected.filter((item) => item !== country).join(", "));
  }

  clear(event: Event): void {
    event.stopPropagation();
    this.setValue("");
    this.close();
  }

  private setValue(value: string): void {
    this.value = value;
    this.onChange(value);
  }

  onControlKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;
    if (["Enter", " ", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      this.openPanel();
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const rows = this.filteredCountries;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, rows.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const country = rows[this.activeIndex];
      if (country) this.select(country);
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.close();
    }
  }

  @HostListener("document:mousedown", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!this.open || !target) return;
    const insideControl = this.control?.nativeElement.contains(target);
    const insidePanel = this.panel?.nativeElement.contains(target);
    if (!insideControl && !insidePanel) this.close();
  }

  @HostListener("window:resize")
  onViewportChange(): void {
    if (this.open && this.overlay) this.close();
  }

  @HostListener("window:scroll")
  onWindowScroll(): void {
    if (this.open && this.overlay) this.close();
  }
}
