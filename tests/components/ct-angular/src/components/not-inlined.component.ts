import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  templateUrl: './not-inlined.component.html',
})
export class NotInlinedComponent {}