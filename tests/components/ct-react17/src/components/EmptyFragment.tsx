export default function EmptyFragment(props: unknown) {
  Object.assign(window, { props });
  return <>{[]}</>;
}
