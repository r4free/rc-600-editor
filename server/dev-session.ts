/** Ask the API whether this browser may see the editor. The UI process must not decide that on its own. */
export async function editorSessionAllowed(cookie: string | undefined): Promise<boolean> {
  const port = Number(process.env.RC600_API_PORT || 5191);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/session`, {
      headers: cookie ? { cookie } : {},
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { ok?: boolean; requireLicense?: boolean };
    if (!data.requireLicense) return true;
    return data.ok === true;
  } catch {
    return false;
  }
}
