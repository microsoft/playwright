type ButtonProps = {
  title: string;
}
export default function Button(props: ButtonProps) {
  return <button>{props.title}</button>
}
