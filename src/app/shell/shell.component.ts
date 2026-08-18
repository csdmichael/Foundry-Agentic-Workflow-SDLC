import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import {
  IonMenu, IonContent, IonIcon, IonHeader, IonToolbar, IonTitle,
  IonButtons, IonMenuButton, IonButton, IonMenuToggle,
} from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';
import { uiConfig, ROLE_LABELS, NavSection } from '../config/ui.config';

const EXPANDED_STORAGE_KEY = 'agentic_sdlc_nav_expanded';

/**
 * Application shell. Provides the responsive layout:
 *  - Desktop: persistent left sidebar + header + content.
 *  - Tablet/phone: the same navigation as an overlay behind the menu button.
 * Navigation categories collapse independently and the choice is remembered.
 * Items are hidden when the user lacks the required capability; server-side
 * authorization independently blocks unauthorized API calls.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive, RouterOutlet,
    IonMenu, IonContent, IonIcon, IonHeader, IonToolbar, IonTitle,
    IonButtons, IonMenuButton, IonButton, IonMenuToggle,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  readonly ui = uiConfig;
  readonly roleLabels = ROLE_LABELS;
  readonly user = this.auth.user;

  private readonly _sections = signal<NavSection[]>(uiConfig.navSections);
  private readonly _expanded = signal<Record<string, boolean>>(this.restoreExpanded());
  private readonly _url = signal<string>(this.router.url);

  readonly visibleSections = computed(() => this.filterSections());

  readonly initials = computed(() => {
    const name = this.user()?.name ?? '';
    // Ignore parenthetical suffixes like "Guest (read-only)" so initials stay alphabetic.
    const parts = name.split(/\s+/).filter((p) => /^[\p{L}\p{N}]/u.test(p));
    if (parts.length === 0) return '?';
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  });

  constructor(private auth: AuthService, private router: Router) {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this._url.set(this.router.url);
      this.expandActiveSection();
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.auth.capabilities().length === 0) {
      await this.auth.loadCapabilities();
      this._sections.set([...uiConfig.navSections]);
    }
    this.expandActiveSection();
  }

  isExpanded(sectionId: string): boolean {
    return this._expanded()[sectionId] !== false;
  }

  toggleSection(sectionId: string): void {
    const next = { ...this._expanded(), [sectionId]: !this.isExpanded(sectionId) };
    this._expanded.set(next);
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(next));
  }

  /** Number of items in a collapsed section that match the current route. */
  activeCountIn(section: NavSection): number {
    const url = this._url();
    return section.items.filter((item) => url.startsWith(item.path)).length;
  }

  roleLabel(): string {
    const u = this.user();
    return u ? this.roleLabels[u.role] : '';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private expandActiveSection(): void {
    const section = this.visibleSections().find((s) => this.activeCountIn(s) > 0);
    if (section && !this.isExpanded(section.id)) this.toggleSection(section.id);
  }

  private restoreExpanded(): Record<string, boolean> {
    try {
      const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
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
}
