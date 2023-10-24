import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <div>
      <header>
        <ng-content select="[header]"></ng-content>
      </header>
      <main>
        <ng-content select="[main]"></ng-content>
      </main>
      <footer>
        <ng-content select="[footer]"></ng-content>
      </footer>
    </div>
  `,
})
export class NamedSlotsComponent {}
