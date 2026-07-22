import Button from './Button';

// Spreads props so a test can pass `title`, `className`, or a real `onClick` callback.
export const Default = (props: any) => <Button title="Submit" {...props} />;
