// This route is no longer needed for the PKCE flow
// Device auth was replaced with browser-based OAuth2 with PKCE
export async function POST() {
  return new Response('Device auth endpoint deprecated. Use browser-based OAuth flow instead.', {
    status: 410 // Gone
  });
}