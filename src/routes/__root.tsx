import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import appCss from "../styles.css?url";
import { AppBootstrap } from "@/components/providers/AppBootstrap";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { BrandingProvider } from "@/components/providers/BrandingProvider";
import { Toaster } from "@/components/ui/sonner";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Genossenschaft – Mitgliederverwaltung" },
      { name: "description", content: "Community Connect is a customizable member management application for energy cooperatives." },
      { property: "og:title", content: "Genossenschaft – Mitgliederverwaltung" },
      { property: "og:description", content: "Community Connect is a customizable member management application for energy cooperatives." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Genossenschaft – Mitgliederverwaltung" },
      { name: "twitter:description", content: "Community Connect is a customizable member management application for energy cooperatives." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/852f2cfc-dc17-4aa0-962f-48b15ec384db/id-preview-d7c3db14--bc8803d2-e1cc-4166-9ede-5b8d6f4d9efc.lovable.app-1778100667927.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/852f2cfc-dc17-4aa0-962f-48b15ec384db/id-preview-d7c3db14--bc8803d2-e1cc-4166-9ede-5b8d6f4d9efc.lovable.app-1778100667927.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <AuthProvider>
          <AppBootstrap>
            <Outlet />
            <Toaster richColors position="top-right" />
          </AppBootstrap>
        </AuthProvider>
      </BrandingProvider>
    </QueryClientProvider>
  );
}
