import type {
  LinksFunction,
  LoaderFunction,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { ShouldReloadFunction, useFetcher } from "@remix-run/react";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
} from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@reach/dialog";
import reachDialogStylesheet from "@reach/dialog/styles.css";
import { getUser } from "./session.server";

import tailwindStylesheetUrl from "./styles/tailwind.css";
import { dangerButtonClasses, submitButtonClasses } from "./components";

export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: tailwindStylesheetUrl },
    { rel: "stylesheet", href: reachDialogStylesheet },
  ];
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Fakebooks Remix",
});

type LoaderData = {
  user: Awaited<ReturnType<typeof getUser>>;
};

export const loader: LoaderFunction = async ({ request }) => {
  return json<LoaderData>({
    user: await getUser(request),
  });
};

export default function App() {
  const { user } = useLoaderData() as LoaderData;
  return (
    <html lang="en" className="h-full">
      <head>
        <Meta />
        <Links />
      </head>
      <body className="h-full">
        <Outlet />
        {user ? <LogoutTimer /> : null}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

function LogoutTimer() {
  const [status, setStatus] = useState<"idle" | "show-modal">("idle");
  const location = useLocation();
  // 💿 add the useFetcher hook here so you can trigger a logout

  const logoutFetcher = useFetcher();

  // const logoutTime = 1000 * 60 * 60 * 24;
  // const modalTime = logoutTime - 1000 * 60 * 2;
  // 💰 you can swap the logoutTime and modalTime with these to test this more easily:
  const logoutTime = 5000;
  const modalTime = 2000;
  const modalTimer = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>();

  const logout = useCallback(() => {
    // 💿 log the user out by posting the /logout
    logoutFetcher.submit({ redirectTo: location.pathname }, { action: '/logout', method: 'post' })
  }, [location.pathname, logoutFetcher]);

  const cleanupTimers = useCallback(() => {
    clearTimeout(modalTimer.current);
    clearTimeout(logoutTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    cleanupTimers();
    modalTimer.current = setTimeout(() => {
      setStatus("show-modal");
    }, modalTime);
    logoutTimer.current = setTimeout(logout, logoutTime);
  }, [cleanupTimers, logout, logoutTime, modalTime]);

  useEffect(() => resetTimers(), [resetTimers, location.key]);
  useEffect(() => cleanupTimers, [cleanupTimers]);

  function closeModal() {
    setStatus("idle");
    resetTimers();
  }

  return (
    <Dialog
      aria-label="Pending Logout Notification"
      isOpen={status === "show-modal"}
      onDismiss={closeModal}
    >
      <div>
        <h1 className="mb-4 text-d-h3">Are you still there?</h1>
        <p>
          You are going to be logged out due to inactivity. Close this modal to
          stay logged in.
        </p>
        <div className="h-8" />
        <div className="flex items-end gap-8">
          <button onClick={closeModal} className={submitButtonClasses}>
            Remain Logged In
          </button>
          <button onClick={logout} className={dangerButtonClasses}>
            Logout
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// There's currently a bug in this API when used in combination with
// fetcher.submit, so we'll disable this optimization for this exercise
// export const unstable_shouldReload: ShouldReloadFunction = ({ submission }) =>
//   submission?.action === "/logout" || submission?.action === "/login";
