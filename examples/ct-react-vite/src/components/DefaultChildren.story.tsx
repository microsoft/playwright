import DefaultChildren from './DefaultChildren';
import Button from './Button';

// Children cannot cross the test/browser boundary as JSX, so each composition is its own story.
export const Text = () => <DefaultChildren>Main Content</DefaultChildren>;

export const WithButton = () => <DefaultChildren><Button title="Submit" /></DefaultChildren>;

export const Multiple = () => <DefaultChildren>
  <div data-testid="one">One</div>
  <div data-testid="two">Two</div>
</DefaultChildren>;

export const Number = () => <DefaultChildren>{1337}</DefaultChildren>;

// A clickable child whose handler is supplied by the test as a callback prop.
export const ClickableChild = (props: { onChildClick?: () => void }) =>
  <DefaultChildren><span onClick={props.onChildClick}>Main Content</span></DefaultChildren>;
