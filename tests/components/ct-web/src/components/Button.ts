export default class Button extends HTMLElement {
  constructor() {
    super();

    this.innerHTML = '<button>Submit</button>';
  }
}

customElements.define('pw-button', Button);
