// This injects a box into the page that moves with the mouse;
// Useful for debugging
(function(){
  const box = document.createElement('div');
  box.classList.add('mouse-helper');
  const styleElement = document.createElement('style');
  styleElement.innerHTML = `
  .mouse-helper {
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
    width: 20px;
    height: 20px;
    background: rgba(0,0,0,.4);
    border: 1px solid white;
    border-radius: 10px;
    margin-left: -10px;
    margin-top: -10px;
    transition: background .2s, border-radius .2s, border-color .2s;
  }
  .mouse-helper.button-1 {
    transition: none;
    background: rgba(0,0,0,0.9);
  }
  .mouse-helper.button-2 {
    transition: none;
    border-color: rgba(0,0,255,0.9);
  }
  .mouse-helper.button-3 {
    transition: none;
    border-radius: 4px;
  }
  .mouse-helper.button-4 {
    transition: none;
    border-color: rgba(255,0,0,0.9);
  }
  .mouse-helper.button-5 {
    transition: none;
    border-color: rgba(0,255,0,0.9);
  }
  `;
  document.head.appendChild(styleElement);
  document.body.appendChild(box);
  document.addEventListener('mousemove', event => {
    box.style.left = event.pageX + 'px';
    box.style.top = event.pageY + 'px';
    updateButtons(event.buttons);
  }, true);
  document.addEventListener('mousedown', event => {
    updateButtons(event.buttons);
    box.classList.add('button-' + event.which);
  }, true);
  document.addEventListener('mouseup', event => {
    updateButtons(event.buttons);
    box.classList.remove('button-' + event.which);
  }, true);
  function updateButtons(buttons) {
    for (let i = 0; i < 5; i++)
      box.classList.toggle('button-' + i, buttons & (1 << i));
  }
})();
