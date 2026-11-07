export async function GET() {
  return Response.json({
    status: "ok",
    service: "Gigabyte feedback backend",
    message: "Gigabyte feedback backend is running",
  });
}
