import '@angular/compiler';
import { beforeMount, afterMount } from '@playwright/experimental-ct-angular/hooks';
import { provideRouter } from '@angular/router';
import { ButtonComponent } from '@/components/button.component';
import { TOKEN } from '@/components/inject.component';
import { routes } from '@/router';
import '@/assets/styles.css';

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
      providers: [provideRouter(routes)],
    });

  if (hooksConfig?.injectToken)
    TestBed.configureTestingModule({
      providers: [{ provide: TOKEN, useValue: { text: 'has been overwritten' }}]
    })
});

afterMount<HooksConfig>(async () => {
  console.log('After mount');
});
