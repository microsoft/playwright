if (process.env.REACT_APP_TESTING)
  import('./index-tests');
else
  import('./index-app');

export {};
