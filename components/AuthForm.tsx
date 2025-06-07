// This file is a client-side React component
"use client";

// Importing libraries and components
import { z } from "zod"; // For schema validation
import Link from "next/link"; // For client-side navigation
import Image from "next/image"; // For optimized image rendering
import { toast } from "sonner"; // For toast notifications
import { auth } from "@/firebase/client"; // Firebase auth instance
import { useForm } from "react-hook-form"; // Form state management
import { useRouter } from "next/navigation"; // Next.js navigation hook
import { zodResolver } from "@hookform/resolvers/zod"; // Bridge between Zod and react-hook-form

// Firebase functions for authentication
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

// UI components
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

// Custom backend actions
import { signIn, signUp } from "@/lib/actions/auth.action";
import FormField from "./FormField"; // Custom form input field component

// Function that returns a validation schema depending on form type (sign-in or sign-up)
const authFormSchema = (type: FormType) => {
  return z.object({
    name: type === "sign-up" ? z.string().min(3) : z.string().optional(), // Only required in sign-up
    email: z.string().email(), // Must be a valid email
    password: z.string().min(3), // Minimum password length
  });
};

// The main AuthForm component
const AuthForm = ({ type }: { type: FormType }) => {
  const router = useRouter(); // For programmatic navigation

  const formSchema = authFormSchema(type); // Create schema based on type
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema), // Use Zod to validate
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  // Function to handle form submission
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      if (type === "sign-up") {
        // Destructure user inputs
        const { name, email, password } = data;

        // Create user in Firebase
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        // Call backend signUp logic
        const result = await signUp({
          uid: userCredential.user.uid,
          name: name!,
          email,
          password,
        });

        // Handle potential backend error
        if (!result.success) {
          toast.error(result.message);
          return;
        }

        // Notify and redirect user to sign-in
        toast.success("Account created successfully. Please sign in.");
        router.push("/sign-in");
      } else {
        // Sign-in case
        const { email, password } = data;

        // Firebase sign-in
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        // Get JWT token
        const idToken = await userCredential.user.getIdToken();
        if (!idToken) {
          toast.error("Sign in Failed. Please try again.");
          return;
        }

        // Call backend signIn logic
        await signIn({
          email,
          idToken,
        });

        // Notify and redirect
        toast.success("Signed in successfully.");
        router.push("/");
      }
    } catch (error) {
      // Catch any unexpected errors
      console.log(error);
      toast.error(`There was an error: ${error}`);
    }
  };

  // Helper to check if the form is in sign-in mode
  const isSignIn = type === "sign-in";

  return (
    <div className="card-border lg:min-w-[566px]">
      <div className="flex flex-col gap-6 card py-14 px-10">
        <div className="flex flex-row gap-2 justify-center">
          <Image src="/logo.svg" alt="logo" height={32} width={38} />
          <h2 className="text-primary-100">PrepWise</h2>
        </div>

        <h3>Practice job interviews with AI</h3>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="w-full space-y-6 mt-4 form"
          >
            {!isSignIn && (
              <FormField
                control={form.control}
                name="name"
                label="Name"
                placeholder="Your Name"
                type="text"
              />
            )}

            <FormField
              control={form.control}
              name="email"
              label="Email"
              placeholder="Your email address"
              type="email"
            />

            <FormField
              control={form.control}
              name="password"
              label="Password"
              placeholder="Enter your password"
              type="password"
            />

            <Button className="btn" type="submit">
              {isSignIn ? "Sign In" : "Create an Account"}
            </Button>
          </form>
        </Form>

        <p className="text-center">
          {isSignIn ? "No account yet?" : "Have an account already?"}
          <Link
            href={!isSignIn ? "/sign-in" : "/sign-up"}
            className="font-bold text-user-primary ml-1"
          >
            {!isSignIn ? "Sign In" : "Sign Up"}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthForm;