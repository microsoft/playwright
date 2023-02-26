import { beforeMount, afterMount } from '@playwright/experimental-ct-angular/hooks';
import { provideRouter } from '@angular/router';
import { ButtonComponent } from '@/components/button.component';
import { routes } from '@/router';
import '@/assets/styles.css';

export type HooksConfig = {
  routing?: boolean
}

beforeMount<HooksConfig>(async ({ hooksConfig, TestBed }) => {
  TestBed.configureTestingModule({
    imports: [ButtonComponent],
  });

  if (hooksConfig?.routing) 
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)]
    })
});

afterMount<HooksConfig>(async () => {
  console.log('After mount');
});
