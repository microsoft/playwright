import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <div>
      <h1>Welcome!</h1>
      <main>
        <ng-content></ng-content>
      </main>
      <footer>
        Thanks for visiting.
      </footer>
    </div>
  `,
})
export class DefaultSlotComponent {}
