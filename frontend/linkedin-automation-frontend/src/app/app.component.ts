import { Component, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { TopbarComponent } from './shared/components/topbar/topbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    @if (isAuthPage()) {
      <!-- Bare layout for login -->
      <router-outlet />
    } @else {
      <!-- App shell with sidebar + topbar -->
      <div class="flex h-screen bg-surface overflow-hidden">
        <app-sidebar />
        <div class="flex flex-col flex-1 ml-64 overflow-hidden">
          <app-topbar />
          <main class="flex-1 overflow-y-auto p-6 pt-[88px]">
            <router-outlet />
          </main>
        </div>
      </div>
    }
  `,
})
export class AppComponent {
  private url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  isAuthPage = computed(() => this.url()?.startsWith('/login'));

  constructor(private router: Router) {}
}

