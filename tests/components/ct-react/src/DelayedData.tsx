import React, { useEffect, useState } from 'react';

export const DelayedData: React.FC<{ data: string }> = ({ data }) => {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const timeout = setTimeout(() => setStatus(data), 500);
    return () => {
      clearTimeout(timeout);
    }
  }, [data])

  return <p>{status}</p>
};
