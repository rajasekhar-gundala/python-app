import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals, redirect, cookies }) => {
    // 1. Clear PocketBase Auth Store
    locals.pb.authStore.clear();

    // 2. Overwrite the cookie with an expired one
    // This tells the browser to delete the session
    return new Response(null, {
        status: 302,
        headers: {
            'Location': '/login',
            'Set-Cookie': 'pb_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly;'
        }
    });
};