import { bootstrapApplication } from '@angular/platform-browser';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Register the full icon set so ion-icon renders offline (no CDN dependency).
addIcons(allIcons as unknown as Record<string, string>);

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
