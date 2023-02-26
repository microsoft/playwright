import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from '@/app.component';
import { environment } from '@/environments/environment';
import { routes } from '@/router';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes)
  ]
}).catch(err => console.error(err));
