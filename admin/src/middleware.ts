import { defineMiddleware } from "astro:middleware";
import PocketBase from 'pocketbase';

export const onRequest = defineMiddleware(async ({ locals, request, redirect, url }, next) => {
    // 1. Create a fresh instance for THIS request only
    const pb = new PocketBase('http://pocketbase:8080');

    // 2. Load auth state from cookies
    pb.authStore.loadFromCookie(request.headers.get('cookie') || '');

    try {
        // 3. Verify and refresh
        if (pb.authStore.isValid) {
            await pb.collection('users').authRefresh();
        }
    } catch (_) {
        pb.authStore.clear();
    }

    // 4. Protect the /admin route
    // Note: If you are using PocketBase for Admin auth, ensure your 'users' collection 
    // has the appropriate 'isAdmin' field or logic.
    if (url.pathname.startsWith('/admin') && !pb.authStore.isValid) {
        return redirect('/login');
    }

    // 5. Pass it to locals so tenants.astro can use it
    locals.pb = pb;
    locals.user = pb.authStore.model;

    const response = await next();

    // 6. Set the cookie BACK to the browser (Crucial for persistence!)
    response.headers.append('set-cookie', pb.authStore.exportToCookie({ httpOnly: false }));

    return response;
});