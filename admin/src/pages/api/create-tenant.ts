import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
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

        // 2. Create the PocketBase User
        // Note: Using 'users' collection
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
                theme_color: "#007bff",
                bot_name: "AI Assistant"
            }
        });

        // 4. Request a password reset email 
        // This is safe even if the SMTP isn't 100% configured yet; it won't crash the script
        try {
            await pb.collection('users').requestPasswordReset(email);
        } catch (e) {
            console.error("Password reset email failed to send, but tenant was created:", e);
        }

        // 5. Success: Always redirect to success page with the new ID
        // This ensures the user sees their script tag immediately
        const successUrl = `/signup-success?id=${newTenant.id}`;
        
        // We explicitly use a 303 See Other for POST-to-GET redirects to prevent the "Save As" popup
        return redirect(successUrl, 303);

    } catch (error: any) {
        console.error("Automation Error:", error);
        
        // Return a clean error message instead of raw JSON to prevent download prompts
        return new Response(`Error: ${error.message}`, { 
            status: 500,
            headers: { "Content-Type": "text/plain" }
        });
    }
};