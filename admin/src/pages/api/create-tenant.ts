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
            owner: newUser.id, // Ensure your 'tenants' collection has an 'owner' relation field
            contact_email: email,
            settings: {
                theme_color: "#007bff",
                bot_name: "AI Assistant"
            }
        });

        // 4. Request a password reset email (Best practice so they can set their own)
        await pb.collection('users').requestPasswordReset(email);

        // 5. Success: Redirect to a 'Thank You' page or back to dashboard if Admin
        if (request.headers.get('referer')?.includes('/admin')) {
            return redirect(`/signup-success?id=${newTenant.id}`);
        }
        
        return redirect('/signup-success');

    } catch (error: any) {
        console.error("Automation Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};