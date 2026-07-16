import { ComponentAsProp } from './ComponentAsProp';
import Button from './Button';

// The rendered node passed as a prop is baked into the story (JSX can't travel from the test).
export const WithButton = () => <ComponentAsProp component={<Button title="Submit" />} />;

export const WithArray = () => <ComponentAsProp component={[<h4>{[4]}</h4>, [[<p>[2,3]</p>]]]} />;
