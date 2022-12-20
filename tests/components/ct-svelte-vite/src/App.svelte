<script lang="ts">
import { Link, Route, Router } from "svelte-navigator";
import logo from './assets/svelte.png'
import LoginPage from './pages/LoginPage.svelte';
import DashboardPage from './pages/DashboardPage.svelte';
</script>

<Router>
  <header>
    <img src="{logo}" alt="logo" width="125" height="125" />
    <Link to="/">Login</Link>
    <Link to="/dashboard">Dashboard</Link>
  </header>
  <Route path="/*">
    <Route component="{LoginPage}" />
    <Route path="dashboard" component="{DashboardPage}" />
  </Route>
</Router>
