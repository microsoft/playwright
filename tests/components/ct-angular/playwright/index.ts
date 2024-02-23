import '@angular/compiler';
import { beforeMount, afterMount } from '@playwright/experimental-ct-angular/hooks';
import { Router, provideRouter } from '@angular/router';
import { ButtonComponent } from '@/components/button.component';
import { TOKEN } from '@/components/inject.component';
import { routes } from '@/router';
import '@/assets/styles.css';
import { APP_INITIALIZER, inject } from '@angular/core';

export type HooksConfig = {
  routing?: boolean;
  injectToken?: boolean;
};

beforeMount<HooksConfig>(async ({ hooksConfig, TestBed }) => {
  TestBed.configureTestingModule({
    imports: [ButtonComponent],
  });

  if (hooksConfig?.routing)
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: APP_INITIALIZER,
          multi: true,
          useFactory() {
            const router = inject(Router);
            return () => router.initialNavigation();
          }
        }
      ],
    });

  if (hooksConfig?.injectToken)
    TestBed.configureTestingModule({
      providers: [{ provide: TOKEN, useValue: { text: 'has been overwritten' }}]
    })
});

afterMount<HooksConfig>(async () => {
  console.log('After mount');
});
