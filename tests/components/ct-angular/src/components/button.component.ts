import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  selector: 'button-component',
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  @Input() title!: string;
  @Output() submit = new EventEmitter();
}
