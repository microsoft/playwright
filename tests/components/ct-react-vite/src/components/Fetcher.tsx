import { useEffect, useState } from "react"

export default function Fetcher() {
  const [data, setData] = useState<{ name: string }>({ name: '<none>' });
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    const doFetch = async () => {
      try {
        const response = await fetch('/data.json');
        setData(await response.json());
      } catch {
        setData({ name: '<error>' });
      }
      setFetched(true);
    }

    if (!fetched)
      doFetch();
  }, [fetched, setFetched, setData]);

  return <div>
    <div data-testid='name'>{data.name}</div>
    <button onClick={() => {
      setFetched(false);
      setData({ name: '<none>' });
    }}>Reset</button>
    <button onClick={() => {
      fetch('/post', { method: 'POST', body: 'hello from the page' });
    }}>Post it</button>
  </div>;
}
