// Marks this file as a server-side module (used by Next.js server actions)
'use server';

// Import Firestore database instance and other necessary libraries
import { db } from "@/firebase/admin";
import { generateObject } from "ai"; // AI SDK to generate structured output
import { google } from "@ai-sdk/google"; // Google Gemini model for AI processing
import { feedbackSchema } from "@/constants"; // Schema for structured AI feedback

// Fetches all interviews associated with a specific user ID
export async function getInterviewsByUserId(userId: string): Promise<Interview[] | null> {
    const interviews = await db
        .collection('interviews')
        .where('userId', '==', userId) // Filter by user ID
        .orderBy('createdAt', 'desc') // Sort by creation time, newest first
        .get();

    // Convert Firestore docs to Interview objects
    return interviews.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
    })) as Interview[];
}

// Fetches the latest finalized interviews that were not created by the current user
export async function getLatestInterviews(params: GetLatestInterviewsParams): Promise<Interview[] | null> {
    const { userId, limit = 20 } = params;

    const interviews = await db
        .collection('interviews')
        .orderBy('createdAt', 'desc') // Order by newest first
        .where('finalized', '==', true) // Only include finalized interviews
        .where('userId', '!=', userId) // Exclude the user's own interviews
        .limit(limit) // Limit the number of interviews returned
        .get();

    // Map Firestore docs to Interview objects
    return interviews.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
    })) as Interview[];
}

// Retrieves a single interview by its document ID
export async function getInterviewById(id: string): Promise<Interview | null> {
    const interview = await db
        .collection('interviews')
        .doc(id)
        .get();

    return interview.data() as Interview | null;
}

// Creates feedback for a given interview by analyzing the transcript with AI
export async function createFeedback(params: CreateFeedbackParams) {
    const { interviewId, userId, transcript } = params;

    try {
        // Format the transcript into a readable string for the AI model
        const formattedTranscript = transcript
            .map((sentence: { role: string; content: string; }) => (
                `- ${sentence.role}: ${sentence.content}\n`
            )).join('');

        // Generate structured feedback using the Google Gemini model and predefined schema
        const { object: { totalScore, categoryScores, strengths, areasForImprovement, finalAssessment } } = await generateObject({
            model: google('gemini-2.0-flash-001', {
                structuredOutputs: false, // We provide the schema ourselves
            }),
            schema: feedbackSchema, // Schema defines how the output should be structured
            prompt: `You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.
        Transcript:
        ${formattedTranscript}

        Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
        - **Communication Skills**: Clarity, articulation, structured responses.
        - **Technical Knowledge**: Understanding of key concepts for the role.
        - **Problem-Solving**: Ability to analyze problems and propose solutions.
        - **Cultural & Role Fit**: Alignment with company values and job role.
        - **Confidence & Clarity**: Confidence in responses, engagement, and clarity.
        `,
            system:
                "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories",
        });

        // Save the generated feedback to Firestore
        const feedback = await db.collection('feedback').add({
            interviewId,
            userId,
            totalScore,
            categoryScores,
            strengths,
            areasForImprovement,
            finalAssessment,
            createdAt: new Date().toISOString() // Timestamp
        })

        return {
            success: true,
            feedbackId: feedback.id
        }
    } catch (e) {
        console.error('Error saving feedback', e)

        return { success: false }
    }
}

// Retrieves feedback for a specific interview and user
export async function getFeedbackByInterviewId(params: GetFeedbackByInterviewIdParams): Promise<Feedback | null> {
    const { interviewId, userId } = params;

    // Query feedback collection where both interviewId and userId match
    const feedback = await db
        .collection('feedback')
        .where('interviewId', '==', interviewId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

    if(feedback.empty) return null;

    const feedbackDoc = feedback.docs[0];

    // Return feedback with ID
    return {
        id: feedbackDoc.id,
        ...feedbackDoc.data()
    } as Feedback;
}
