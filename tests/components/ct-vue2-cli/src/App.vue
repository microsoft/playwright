<template>
  <div id="app">
    <header>
      <img alt="Vue logo" src="./assets/logo.png" width="60" height="60">
      <router-link to="/">Login</router-link>
      <router-link to="/dashboard">Dashboard</router-link>
    </header>
    <router-view />
  </div>
</template>