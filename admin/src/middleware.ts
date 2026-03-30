import { defineMiddleware } from "astro:middleware";
import PocketBase from "pocketbase";

export const onRequest = defineMiddleware(async ({ locals, request, redirect, cookies }, next) => {
    // 1. Initialize PocketBase client for this request
    // Using the internal Docker URL for speed and security
    const pb = new PocketBase("http://pocketbase:8080");
    
    // 2. Load the auth store from the request cookie
    const authCookie = cookies.get("pb_auth")?.value || "";
    pb.authStore.loadFromCookie(authCookie);

    try {
        // 3. Refresh the session if it exists to keep it valid
        if (pb.authStore.isValid) {
            await pb.collection("users").authRefresh();
            locals.user = pb.authStore.record;
        } else {
            locals.user = null;
        }
    } catch (_) {
        // Clear the store if the token is expired or invalid
        pb.authStore.clear();
        locals.user = null;
    }

    // 4. Attach the PB instance to locals so pages can use it
    locals.pb = pb;

    // 5. SECURITY: Protected Route Logic
    const url = new URL(request.url);
    const isAdminRoute = url.pathname.startsWith("/admin");
    const isLoginPage = url.pathname === "/login";

    // IF trying to access /admin WITHOUT being logged in -> Redirect to Login
    if (isAdminRoute && !locals.user) {
        return redirect("/login");
    }

    // IF trying to access /login WHILE already logged in -> Redirect to Admin
    if (isLoginPage && locals.user) {
        return redirect("/admin/tenants");
    }

    // 6. Execute the request
    const response = await next();

    // 7. Sync the auth store back to the cookie so the session persists in the browser
    response.headers.append("set-cookie", pb.authStore.exportToCookie({
        httpOnly: true,
        secure: true, // Required for Caddy/HTTPS
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7 // 7 days
    }));

    return response;
});