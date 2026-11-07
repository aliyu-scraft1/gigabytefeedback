import { NextResponse } from "next/server";
import { requestHasAdminSession } from "../../../lib/admin-auth";
import { readFeedbackStateFromDatabase, replaceFeedbackState } from "../../../lib/server-feedback-store";

function databaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "DATABASE_URL is required to connect to the feedback database.") {
    return "DATABASE_URL is required to connect to the feedback database. Add your Neon connection string to the project root .env file.";
  }
  return "The feedback database could not be reached. Check DATABASE_URL and the Neon connection settings.";
}

export async function GET(request: Request) {
  if (!requestHasAdminSession(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, state: await readFeedbackStateFromDatabase() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: databaseErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  if (!requestHasAdminSession(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const state = payload?.state;
    if (!state || !Array.isArray(state.conversations) || !Array.isArray(state.trash)) {
      return NextResponse.json({ ok: false, error: "A valid feedback state is required." }, { status: 400 });
    }

    const savedState = await replaceFeedbackState(state);
    return NextResponse.json({ ok: true, state: savedState });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: databaseErrorMessage(error) },
      { status: 500 },
    );
  }
}
