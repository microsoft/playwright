import { Routes, Route, A } from "@solidjs/router"
import logo from './assets/logo.svg';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return <>
    <header>
      <img src={logo} alt="logo" width={125} height={125} />
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
