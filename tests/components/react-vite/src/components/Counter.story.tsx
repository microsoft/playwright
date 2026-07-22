import Counter from './Counter';

// Spreads props (count, onClick, children) so tests can drive it and, crucially, call
// component.update(newProps) to re-render in place — remount-count stays 1.
export const Default = (props: any) => <Counter {...props} />;
