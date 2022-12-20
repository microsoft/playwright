<script lang="ts">
import { Link, Route, Router } from "svelte-navigator";
import LoginPage from './pages/LoginPage.svelte';
import DashboardPage from './pages/DashboardPage.svelte';
</script>

<Router>
  <header>
    <Link to="/">Login</Link>
    <Link to="/dashboard">Dashboard</Link>
  </header>
  <Route path="/*">
    <Route component="{LoginPage}" />
    <Route path="dashboard" component="{DashboardPage}" />
  </Route>
</Router>
