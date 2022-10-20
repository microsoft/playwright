type ButtonProps = {
  title: string;
  onClick?(props: string): void;
}
export default function Button(props: ButtonProps) {
  return <button onClick={() => props.onClick?.('hello')}>{props.title}</button>
}
