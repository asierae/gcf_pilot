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

interface TimelineResponse {
  eyeKey: string;
  nameKey: string;
  timeKey: string;
  unitKey: string;
  copyKey: string;
}

const KEY = 'ACCREDITATION_TIMELINE.';

@Component({
  selector: 'app-accreditation-timeline',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './accreditation-timeline.component.html',
  styleUrl: './accreditation-timeline.component.css',
})
export class AccreditationTimelineComponent {
  readonly weeks = Array.from({ length: 8 }, (_, index) => `W${index + 1}`);
  readonly t = (key: string): string => `${KEY}${key}`;

  readonly legend = [
    { key: this.t('LEGEND_CORE'), kind: 'gold' },
    { key: this.t('LEGEND_PARALLEL'), kind: 'blue' },
    { key: this.t('LEGEND_VALIDATION'), kind: 'soft' },
    { key: this.t('LEGEND_MILESTONE'), kind: 'diamond' },
  ];

  readonly tasks: TimelineTask[] = [
    { n: '01', nameKey: this.t('TASK1_NAME'), detailKey: this.t('TASK1_DETAIL'), bar: 'gold', column: '1 / span 1', label: 'W1' },
    { n: '02', nameKey: this.t('TASK2_NAME'), detailKey: this.t('TASK2_DETAIL'), bar: 'blue', column: '1 / span 2', label: 'W1–2' },
    { n: '03', nameKey: this.t('TASK3_NAME'), detailKey: this.t('TASK3_DETAIL'), bar: 'blue', column: '2 / span 2', label: 'W2–3' },
    { n: '04', nameKey: this.t('TASK4_NAME'), detailKey: this.t('TASK4_DETAIL'), bar: 'blue', column: '2 / span 4', label: 'W2–5' },
    { n: '05', nameKey: this.t('TASK5_NAME'), detailKey: this.t('TASK5_DETAIL'), bar: 'gold', column: '3 / span 5', label: 'W3–7' },
    { n: '06', nameKey: this.t('TASK6_NAME'), detailKey: this.t('TASK6_DETAIL'), bar: 'blue', column: '4 / span 4', label: 'W4–7' },
    { n: '07', nameKey: this.t('TASK7_NAME'), detailKey: this.t('TASK7_DETAIL'), bar: 'gold', column: '6 / span 2', label: 'W6–7' },
    { n: '08', nameKey: this.t('TASK8_NAME'), detailKey: this.t('TASK8_DETAIL'), bar: 'soft', column: '7 / span 2', label: 'W7–8' },
  ];

  readonly outputs: TimelineOutput[] = [
    { idKey: this.t('OUT1_ID'), nameKey: this.t('OUT1_NAME'), copyKey: this.t('OUT1_COPY') },
    { idKey: this.t('OUT2_ID'), nameKey: this.t('OUT2_NAME'), copyKey: this.t('OUT2_COPY') },
    { idKey: this.t('OUT3_ID'), nameKey: this.t('OUT3_NAME'), copyKey: this.t('OUT3_COPY') },
    { idKey: this.t('OUT4_ID'), nameKey: this.t('OUT4_NAME'), copyKey: this.t('OUT4_COPY') },
  ];

  readonly responses: TimelineResponse[] = [
    { eyeKey: this.t('RESP1_EYE'), nameKey: this.t('RESP1_NAME'), timeKey: this.t('RESP1_TIME'), unitKey: this.t('RESP1_UNIT'), copyKey: this.t('RESP1_COPY') },
    { eyeKey: this.t('RESP2_EYE'), nameKey: this.t('RESP2_NAME'), timeKey: this.t('RESP2_TIME'), unitKey: this.t('RESP2_UNIT'), copyKey: this.t('RESP2_COPY') },
    { eyeKey: this.t('RESP3_EYE'), nameKey: this.t('RESP3_NAME'), timeKey: this.t('RESP3_TIME'), unitKey: this.t('RESP3_UNIT'), copyKey: this.t('RESP3_COPY') },
  ];

  readonly gcfLink = 'https://www.greenclimate.fund/access-funding/accreditation';
}
