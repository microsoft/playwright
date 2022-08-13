
type MultipleChildrenProps = {
  children?: [any, any, any];
}

export default function MultipleChildren(props: MultipleChildrenProps) {
  return <div>
  <header>
    {props.children?.[0]}
  </header>
  <main>
    {props.children?.[1]}
  </main>
  <footer>
    {props.children?.[2]}
  </footer>
</div>
}