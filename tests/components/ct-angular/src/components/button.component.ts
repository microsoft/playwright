import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  template: `<button (click)="submit.emit('hello')">{{title}}</button>`,
  selector: 'button-component'
})
export class ButtonComponent {
  @Input() title!: string;
  @Output() submit = new EventEmitter();
}
