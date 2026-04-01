import { defineMiddleware } from "astro:middleware";
import PocketBase from "pocketbase";

export const onRequest = defineMiddleware(async ({ locals, request, redirect, url }, next) => {
    // 1. Initialize PocketBase client (Internal Docker URL)
    const pb = new PocketBase("http://pocketbase:8080");
    
    // 2. Load the auth store from the RAW cookie header, not Astro's parsed value
    pb.authStore.loadFromCookie(request.headers.get("cookie") || "");

    // 3. Populate locals safely without hammering the database
    if (pb.authStore.isValid) {
        // The JWT is valid. PocketBase automatically decoded the user model from the cookie.
        locals.user = pb.authStore.model; 
    } else {
        // Token expired or invalid
        pb.authStore.clear();
        locals.user = null;
    }

    // 4. Attach PB to locals for page/API level access
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

    // 7. Sync the auth store back to the browser cookie
    // This updates the cookie if they just logged in, or clears it if they logged out
    const cookieString = pb.authStore.exportToCookie({
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // True for Caddy HTTPS, false for local dev
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    response.headers.append("set-cookie", cookieString);

    return response;
});