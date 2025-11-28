import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http'; // <-- import
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Add provideHttpClient(withFetch()) to your appConfig providers
bootstrapApplication(App, {
  ...appConfig,
  providers: [
    ...(appConfig.providers || []),
    provideHttpClient(withFetch()) // <-- enable fetch for HttpClient
  ]
})
.catch((err) => console.error(err));
