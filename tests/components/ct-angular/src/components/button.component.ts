import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-button',
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  @Input({required: true}) title!: string;
  @Output() submit = new EventEmitter();
}
