import { defineMiddleware } from "astro:middleware";
import { pb } from "./lib/pocketbase";

export const onRequest = defineMiddleware(async ({ locals, request, redirect, url }, next) => {
    // Load auth state from cookies
    pb.authStore.loadFromCookie(request.headers.get('cookie') || '');

    try {
        // Verify auth and refresh token if needed
        if (pb.authStore.isValid) await pb.collection('users').authRefresh();
    } catch (_) {
        pb.authStore.clear();
    }

    // Protect the /admin route
    if (url.pathname.startsWith('/admin') && !pb.authStore.isValid) {
        return redirect('/login');
    }

    locals.pb = pb;
    locals.user = pb.authStore.model;

    return next();
});
