import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterModule],
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
