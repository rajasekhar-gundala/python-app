import type { APIRoute } from 'astro';
import PocketBase from 'pocketbase';

export const POST: APIRoute = async ({ request }) => {
    // 1. Create a FRESH instance just for this admin operation
    const pb = new PocketBase("http://pocketbase:8080");

    try {
        const formData = await request.formData();
        const name = formData.get('name')?.toString();
        const domain = formData.get('domain')?.toString();
        const email = formData.get('email')?.toString();

        if (!name || !domain || !email) {
            return new Response("Missing fields", { status: 400 });
        }

        // 2. ELEVATE TO SUPERUSER (Using process.env for Docker runtime)
        const adminEmail = process.env.PB_ADMIN_EMAIL;
        const adminPass = process.env.PB_ADMIN_PASSWORD;

        if (!adminEmail || !adminPass) {
            console.error("CRITICAL: Missing admin credentials in environment variables.");
            return new Response("Server Configuration Error", { status: 500 });
        }

        // Use the new _superusers collection for PB v0.23+
        await pb.collection('_superusers').authWithPassword(adminEmail, adminPass);

        let userId: string;

        try {
            // 3. SEARCH FOR EXISTING USER
            const existingUser = await pb.collection('users').getFirstListItem(`email="${email}"`);
            userId = existingUser.id;
        } catch (e) {
            // 4. CREATE NEW USER IF NOT FOUND
            const tempPassword = Math.random().toString(36).slice(-12) + "A1!";
            const newUser = await pb.collection('users').create({
                email: email,
                password: tempPassword,
                passwordConfirm: tempPassword,
                name: name,
                emailVisibility: true,
                verified: false
            });
            userId = newUser.id;
        }

        // 5. CREATE THE TENANT
        const newTenant = await pb.collection('tenants').create({
            name: name,
            domain: domain,
            active: true,
            owner: userId,
            contact_email: email,
            settings: { theme_color: "#2563eb", bot_name: "AI Assistant" }
        });

        // 6. TRIGGER PASSWORD RESET (Fire and forget)
        await pb.collection('users').requestPasswordReset(email).catch(() => null);

        // 7. BULLETPROOF REDIRECT
        return new Response(null, {
            status: 303,
            headers: {
                "Location": `/signup-success?id=${newTenant.id}`,
                "Content-Type": "text/html"
            }
        });

    } catch (error: any) {
        console.error("Signup Error:", error);
        
        // Extract the true error message from PocketBase
        const errorMsg = error.response?.message || error.message || "Failed to create record";
        return new Response(`Error: ${errorMsg}`, { status: 500 });
    }
};