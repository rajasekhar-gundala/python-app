import { defineMiddleware } from "astro:middleware";
import PocketBase from "pocketbase";

export const onRequest = defineMiddleware(async ({ locals, request, redirect, cookies, url }, next) => {
    // 1. Initialize PocketBase client
    // Internal Docker URL is correct for 8GB RAM VPS performance
    const pb = new PocketBase("http://pocketbase:8080");
    
    // 2. Load the auth store from cookie
    const authCookie = cookies.get("pb_auth")?.value || "";
    pb.authStore.loadFromCookie(authCookie);

    try {
        // 3. Refresh session if valid
        if (pb.authStore.isValid) {
            // This ensures we have the latest user data (role, name, etc.)
            await pb.collection("users").authRefresh();
            locals.user = pb.authStore.model; 
        } else {
            locals.user = null;
        }
    } catch (_) {
        pb.authStore.clear();
        locals.user = null;
    }

    // 4. Attach PB to locals for page-level access
    locals.pb = pb;

    // 5. SECURITY: Protected Route Logic
    const isAdminRoute = url.pathname.startsWith("/admin");
    const isLoginPage = url.pathname === "/login";
    const isSignupPage = url.pathname === "/signup";

    // Redirect to login if accessing admin unauthorized
    if (isAdminRoute && !locals.user) {
        return redirect("/login");
    }

    // Redirect to admin if accessing auth pages while logged in
    if ((isLoginPage || isSignupPage) && locals.user) {
        return redirect("/admin/tenants");
    }

    // 6. Execute the request
    const response = await next();

    // 7. Sync the auth store back to the cookie
    // We use exportToCookie to ensure the browser saves the refreshed token
    const cookieString = pb.authStore.exportToCookie({
        httpOnly: true,
        secure: true, // Crucial for Caddy/HTTPS
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // Important: Append the cookie to the response headers
    response.headers.append("set-cookie", cookieString);

    return response;
});