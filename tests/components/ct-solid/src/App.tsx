import { Routes, Route, A } from "@solidjs/router"
import logo from './assets/logo.svg';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return <>
    <header>
      { /* 2023-05-03: remove elementtiming and fetchpriority from img when this issue is resolved: https://github.com/ryansolid/dom-expressions/pull/244 */}
      <img src={logo} alt="logo" width={125} height={125} elementtiming="0" fetchpriority="auto" />
      <A href="/">Login</A>
      <A href="/dashboard">Dashboard</A>
    </header>
    <Routes>
      <Route path="/">
        <Route path="/" component={LoginPage} />
        <Route path="dashboard" component={DashboardPage} />
      </Route>
    </Routes>
  </>
};
