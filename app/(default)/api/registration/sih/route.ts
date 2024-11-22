import { db } from "@/Firebase";
import { sihValidate } from "@/lib/server/utils";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { NextResponse } from "next/server";

// Add a new registration
export async function POST(request: Request) {
  const formData = await request.json();
  const { recaptcha_token, ...data } = formData;

  // Only one Registration per Email

  const { team_info: { team_leader: { email } } } = data;
  const q = query(
    collection(db, "sih2024"),
    where("team_info.team_leader.email", "==", email)
  );
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    return NextResponse.json(
      {
        message: "Email is already registered!",
        error: "Email is already registered!",
      },

      {
        status: 500,
      }
    );
  }

  const recaptchaToken = recaptcha_token;
  if (!recaptchaToken) {
    return NextResponse.json(
      {
        message: "reCAPTCHA token not found! Refresh and try again",
        error: "reCAPTCHA token not found!",
      },
      {
        status: 500,
      }
    );
  }
  const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;

  // Verify reCAPTCHA token
  const recaptchaResponse = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${recaptchaToken}`,
    { method: "POST" }
  );
  const recaptchaResult = await recaptchaResponse.json();

  if (!recaptchaResult.success) {
    return NextResponse.json(
      {
        message: "reCAPTCHA validation failed",
        error: recaptchaResult["error-codes"],
      },
      {
        status: 500,
      }
    );
  }
    // if (!isRecaptchaValid) {
    //     return NextResponse.json({ message: 'reCAPTCHA verification failed', error: true });
    // }

    // Validate the data
    const val = sihValidate(data);

  try {
    // Save to Firebase
    const docRef = await addDoc(collection(db, "sih2024"), data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "An error occurred", error });
  }
  // Return a response
  return NextResponse.json({ message: "Registration successful" });
}
