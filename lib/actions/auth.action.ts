// Marks this module to be run on the server (Next.js server actions)
'use server';

// Import admin Firebase SDK and cookie utility from Next.js
import { db, auth } from "@/firebase/admin";
import { redirect } from 'next/navigation';
import { cookies } from "next/headers";

// Define one week in seconds for cookie expiration
const ONE_WEEK = 60 * 60 * 24 * 7;

// Function to sign up a new user and add them to Firestore
export async function signUp(params: SignUpParams) {
    const { uid, name, email } = params;

    try {
        // Check if a user with the same UID already exists
        const userRecord = await db.collection('users').doc(uid).get();

        if(userRecord.exists) {
            return {
                success: false,
                message: 'User already exists. Please sign in instead.'
            }
        }

        // If user doesn't exist, create a new document with their details
        await db.collection('users').doc(uid).set({
            name,
            email
        });

        return {
            success: true,
            message: 'Account created successfully. Please sign in.'
        }
    } catch (e: any) {
        console.error('Error creating a user', e);

        // Specific error for duplicate email (if caught here)
        if(e.code === 'auth/email-already-exists') {
            return {
                success: false,
                message: 'This email is already in use.'
            }
        }

        return {
            success: false,
            message: 'Failed to create an account'
        }
    }
}

// Function to sign in a user and set a session cookie
export async function signIn(params: SignInParams) {
    const { email, idToken } = params;

    try {
        // Look up user by email in Firebase Auth
        const userRecord = await auth.getUserByEmail(email);

        // If user is not found, suggest account creation
        if(!userRecord) {
            return {
                success: false,
                message: 'User does not exist. Create an account instead.'
            }
        }

        // Set secure session cookie using the ID token
        await setSessionCookie(idToken);
    } catch (e) {
        console.log(e);

        return {
            success: false,
            message: 'Failed to log into an account.'
        }
    }
}

// Helper function to create and set a secure session cookie
export async function setSessionCookie(idToken: string) {
    const cookieStore = await cookies(); // Access the Next.js cookie store

    // Generate a Firebase session cookie from the ID token
    const sessionCookie = await auth.createSessionCookie(idToken, {
        expiresIn: ONE_WEEK * 1000, // Convert seconds to milliseconds
    });

    // Set the cookie in the user's browser
    cookieStore.set('session', sessionCookie, {
        maxAge: ONE_WEEK,
        httpOnly: true, // Not accessible via JavaScript (XSS protection)
        secure: process.env.NODE_ENV === 'production', // Secure only in prod
        path: '/',
        sameSite: 'lax' // Some CSRF protection while allowing basic use
    });
}

// Get the current authenticated user based on session cookie
export async function getCurrentUser(): Promise<User | null> {
    const cookieStore = await cookies();

    // Get the session cookie value
    const sessionCookie = cookieStore.get('session')?.value;

    if(!sessionCookie) return null;

    try {
        // Decode the session cookie to get Firebase UID
        const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

        // Get user data from Firestore using UID
        const userRecord = await db
            .collection('users')
            .doc(decodedClaims.uid)
            .get();

        if(!userRecord.exists) return null;

        // Return the user data with the ID included
        return {
            ...userRecord.data(),
            id: userRecord.id,
        } as User;
    } catch (e) {
        console.log(e);
        return null;
    }
}

// Check if a user is currently authenticated
export async function isAuthenticated() {
    const user = await getCurrentUser();

    // Return true if user exists, false otherwise
    return !!user;
}

// Function to sign out the user by clearing the session cookie
export async function signOut() {
    const cookieStore = await cookies();
    cookieStore.delete('session')
    redirect('/sign-in'); // Redirect to sign-in page after signing out
}