import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  selector: 'button-component',
  template: `
  <button (click)="submit.emit('hello')">{{title}}</button>
  `
})
export class ButtonComponent {
  @Input() title!: string;
  @Output() submit = new EventEmitter();
}
