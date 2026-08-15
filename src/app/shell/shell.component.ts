import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import {
  IonSplitPane, IonMenu, IonContent, IonList, IonListHeader, IonItem, IonIcon,
  IonLabel, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonButton,
  IonFooter, IonNote, IonMenuToggle,
} from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';
import { uiConfig, ROLE_LABELS, NavSection } from '../config/ui.config';

/**
 * Application shell. Provides the responsive layout:
 *  - Web: persistent left navigation + header + content (ion-split-pane).
 *  - Tablet: split layout (split-pane collapses at its breakpoint).
 *  - Phone: header menu toggle opens the same navigation as an overlay.
 * Navigation items are hidden when the user lacks the required capability;
 * server-side authorization independently blocks unauthorized API calls.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive, RouterOutlet,
    IonSplitPane, IonMenu, IonContent, IonList, IonListHeader, IonItem, IonIcon,
    IonLabel, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonButton,
    IonFooter, IonNote, IonMenuToggle,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  readonly ui = uiConfig;
  readonly roleLabels = ROLE_LABELS;
  readonly user = this.auth.user;

  private readonly _sections = signal<NavSection[]>(uiConfig.navSections);
  readonly visibleSections = computed(() => this.filterSections());

  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    if (this.auth.capabilities().length === 0) {
      await this.auth.loadCapabilities();
      this._sections.set([...uiConfig.navSections]);
    }
  }

  private filterSections(): NavSection[] {
    // Recompute against current capabilities signal.
    this.auth.capabilities();
    return this._sections()
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.requiredCapabilities.length === 0 ||
            item.requiredCapabilities.every((c) => this.auth.hasCapability(c)),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }

  roleLabel(): string {
    const u = this.user();
    return u ? this.roleLabels[u.role] : '';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
