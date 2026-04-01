import { defineMiddleware } from "astro:middleware";
import PocketBase from "pocketbase";

export const onRequest = defineMiddleware(async ({ locals, request, redirect, url, cookies }, next) => {
    // 1. Initialize PocketBase client (Internal Docker URL)
    const pb = new PocketBase("http://pocketbase:8080");
    
    // 2. Read the cookie saved by Astro's native cookie handler in login.astro
    const pbCookie = cookies.get("pb_auth")?.value || "";
    
    // PocketBase parses the string and populates pb.authStore
    pb.authStore.loadFromCookie(pbCookie);

    // 3. Populate locals safely without database calls
    if (pb.authStore.isValid) {
        locals.user = pb.authStore.model; 
    } else {
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

    // 7. Keep the cookie alive and synced
    if (pb.authStore.isValid) {
        response.headers.append('set-cookie', pb.authStore.exportToCookie({ 
            httpOnly: true, 
            secure: false, // Critical fix: Prevents session drops behind Docker/Caddy proxies
            sameSite: 'lax',
            path: '/' 
        }));
    }

    return response;
});