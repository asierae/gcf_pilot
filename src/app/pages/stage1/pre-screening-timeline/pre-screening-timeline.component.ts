import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

interface TimelineTask {
  n: string;
  nameKey: string;
  detailKey: string;
  bar: 'gold' | 'blue' | 'soft';
  column: string;
  label: string;
}

interface TimelineOutput {
  idKey: string;
  nameKey: string;
  copyKey: string;
}

const KEY = 'PRE_SCREENING_TIMELINE.';

@Component({
  selector: 'app-pre-screening-timeline',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './pre-screening-timeline.component.html',
  styleUrl: './pre-screening-timeline.component.css',
})
export class PreScreeningTimelineComponent {
  readonly days = Array.from({ length: 14 }, (_, index) => `D${index + 1}`);
  readonly t = (key: string): string => `${KEY}${key}`;

  readonly legend = [
    { key: this.t('LEGEND_CORE'), kind: 'gold' },
    { key: this.t('LEGEND_PARALLEL'), kind: 'blue' },
    { key: this.t('LEGEND_VALIDATION'), kind: 'soft' },
    { key: this.t('LEGEND_MILESTONE'), kind: 'diamond' },
  ];

  readonly tasks: TimelineTask[] = [
    { n: '01', nameKey: this.t('TASK1_NAME'), detailKey: this.t('TASK1_DETAIL'), bar: 'gold', column: '1 / span 2', label: 'D1–2' },
    { n: '02', nameKey: this.t('TASK2_NAME'), detailKey: this.t('TASK2_DETAIL'), bar: 'blue', column: '1 / span 5', label: 'D1–5' },
    { n: '03', nameKey: this.t('TASK3_NAME'), detailKey: this.t('TASK3_DETAIL'), bar: 'blue', column: '3 / span 5', label: 'D3–7' },
    { n: '04', nameKey: this.t('TASK4_NAME'), detailKey: this.t('TASK4_DETAIL'), bar: 'blue', column: '4 / span 7', label: 'D4–10' },
    { n: '05', nameKey: this.t('TASK5_NAME'), detailKey: this.t('TASK5_DETAIL'), bar: 'gold', column: '5 / span 8', label: 'D5–12' },
    { n: '06', nameKey: this.t('TASK6_NAME'), detailKey: this.t('TASK6_DETAIL'), bar: 'soft', column: '12 / span 3', label: 'D12–14' },
  ];

  readonly outputs: TimelineOutput[] = [
    { idKey: this.t('OUT1_ID'), nameKey: this.t('OUT1_NAME'), copyKey: this.t('OUT1_COPY') },
    { idKey: this.t('OUT2_ID'), nameKey: this.t('OUT2_NAME'), copyKey: this.t('OUT2_COPY') },
    { idKey: this.t('OUT3_ID'), nameKey: this.t('OUT3_NAME'), copyKey: this.t('OUT3_COPY') },
    { idKey: this.t('OUT4_ID'), nameKey: this.t('OUT4_NAME'), copyKey: this.t('OUT4_COPY') },
  ];

  readonly gcfLink = 'https://www.greenclimate.fund/access-funding/accreditation/pre-screening';
}
