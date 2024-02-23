type DefaultChildrenProps = {
  children?: any;
}

export default function CheckChildrenProp(props: DefaultChildrenProps) {
  const content = 'children' in props ? props.children : 'No Children';
  return <div>
    <h1>Welcome!</h1>
    <main>
      {content}
    </main>
    <footer>
      Thanks for visiting.
    </footer>
  </div>
}
