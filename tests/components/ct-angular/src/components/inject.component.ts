import { Component, inject, InjectionToken } from '@angular/core';

export const TOKEN = new InjectionToken<{ text: string }>('gets overwritten');

@Component({
  standalone: true,
  template: `<div>{{ data.text }}</div>`,
})
export class InjectComponent {
  public data = inject(TOKEN);
}
