import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  template: `<button (click)="onClick.emit($event)">{{title}}</button>`,
})
export class ButtonComponent {
  @Input() title!: string;
  @Output() onClick = new EventEmitter();
}
