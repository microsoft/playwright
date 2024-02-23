import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-button',
  template: `
  <button (click)="submit.emit('hello')">{{title}}</button>
  `
})
export class ButtonComponent {
  @Input({required: true}) title!: string;
  @Output() submit = new EventEmitter();
}
