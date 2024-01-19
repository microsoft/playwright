import { Routes, Route, Link } from 'react-router-dom';
import logo from './assets/logo.svg';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

export default function App({ title }: { title?: string }) {
  return <>
    <header>
      <img src={logo} alt="logo" width={125} height={125} />
      {title && <h1>{title}</h1>}
      <Link to="/">Login</Link>
      <Link to="/dashboard">Dashboard</Link>
    </header>
    <Routes>
      <Route path="/">
        <Route index element={<LoginPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
      </Route>
    </Routes>
  </>
}
