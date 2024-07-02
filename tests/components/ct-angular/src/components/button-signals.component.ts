import { Component, input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-button-signals',
  template: `
  <button>{{title()}}</button>
  `
})
export class ButtonSignalsComponent {
  title = input.required<string>();
}
