import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [RouterLink, IonContent, IonButton, IonIcon],
  template: `
    <ion-content class="ion-padding ion-text-center">
      <div style="max-width:480px;margin:15vh auto;">
        <ion-icon name="lock-closed-outline" style="font-size:64px;color:var(--ion-color-medium)"></ion-icon>
        <h1>Access denied</h1>
        <p class="muted">Your role does not have permission to view this section.</p>
        <ion-button routerLink="/dashboard" fill="outline">Back to dashboard</ion-button>
      </div>
    </ion-content>
  `,
})
export class AccessDeniedPage {}
