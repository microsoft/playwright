import { LitElement, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'


@customElement('pw-button')
export default class Button2 extends LitElement {
  @property({ type: String, })
  title = '';

  render() {
    return html`<button>Submit ${this.title}</button>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'Button': Button2
  }
}
