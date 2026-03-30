import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const formData = await request.formData();
        const name = formData.get('name')?.toString();
        const domain = formData.get('domain')?.toString();
        const email = formData.get('email')?.toString();

        if (!name || !domain || !email) {
            return new Response("Missing required fields", { status: 400 });
        }

        const pb = locals.pb;

        // 1. Generate a random temporary password
        const tempPassword = Math.random().toString(36).slice(-12) + "A1!";

        // 2. Create the PocketBase User in the 'users' collection
        const newUser = await pb.collection('users').create({
            email: email,
            password: tempPassword,
            passwordConfirm: tempPassword,
            name: name,
            emailVisibility: true,
        });

        // 3. Create the Tenant linked to that User
        const newTenant = await pb.collection('tenants').create({
            name: name,
            domain: domain,
            active: true,
            owner: newUser.id, 
            contact_email: email,
            settings: {
                theme_color: "#2563eb",
                bot_name: "AI Assistant"
            }
        });

        // 4. Trigger Password Reset (Background task)
        try {
            await pb.collection('users').requestPasswordReset(email);
        } catch (e) {
            console.error("Email failed, but account created:", e);
        }

        // 5. BULLETPROOF REDIRECT
        // We use a manual Response to prevent the "Save As" browser prompt
        const successUrl = `/signup-success?id=${newTenant.id}`;
        
        return new Response(null, {
            status: 303,
            headers: {
                "Location": successUrl,
                "Cache-Control": "no-cache",
                "Content-Type": "text/html"
            }
        });

    } catch (error: any) {
        console.error("Automation Error:", error);
        return new Response(`Error: ${error.message}`, { 
            status: 500,
            headers: { "Content-Type": "text/plain" }
        });
    }
};