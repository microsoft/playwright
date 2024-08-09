import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  selector: 'app-root',
  template: `
    <header>
      <img alt="Angular logo" class="logo" src="./assets/logo.svg" width="125" height="125" />
      <a routerLink="/">Login</a>
      <a routerLink="/dashboard">Dashboard</a>
    </header>
    <router-outlet></router-outlet>
  `
})
export class AppComponent {}
