export async function getUserProfile(accessToken: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/get-account-details`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}