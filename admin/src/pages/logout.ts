import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals, redirect, cookies }) => {
    // 1. Clear the PocketBase Auth Store in memory
    locals.pb.authStore.clear();

    // 2. Explicitly clear the user from locals
    locals.user = null;

    // 3. Delete the session cookie using the Astro Cookies API
    // This is more robust than manually setting the Header string
    cookies.delete('pb_auth', {
        path: '/',
        httpOnly: true,
        secure: true, // Recommended since you are using SSL with Caddy
        sameSite: 'lax'
    });

    // 4. Redirect to the login page
    return redirect('/login');
};