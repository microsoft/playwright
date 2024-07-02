import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <div (click)="submit.emit('hello')">
      <div data-testid="props">{{ count }}</div>
      <div data-testid="remount-count">{{ this.remountCount }}</div>
      <ng-content select="[main]"></ng-content>
      <ng-content></ng-content>
    </div>
  `,
})
export class CounterComponent {
  remountCount = Number(localStorage.getItem('remountCount'));
  @Input() count!: number;

  @Output() submit = new EventEmitter();

  constructor() {
    localStorage.setItem('remountCount', String(this.remountCount++))
  }
}
