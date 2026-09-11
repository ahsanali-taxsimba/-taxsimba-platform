import { Metadata } from "next";
import React from "react";
import UserMetaCard from "./_section/UserMetaCard";
import UserAddressCard from "./_section/UserAddressCard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getUserProfile } from "./_section/getUserProfile";
import ProfileHeader from "./_section/ProfileHeader";
import PersonalInformation from "./_section/PersonalInformation";
import ProfessionalDetails from "./_section/ProfessionalDetails";
import PerformanceMetrics from "./_section/PerformanceMetrics";

export const metadata: Metadata = {
  title: "Next.js User-Profile | TailAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js User-Profile page for TailAdmin - Next.js Tailwind CSS Admin Dashboard Template",
};

export default async function UserProfile() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.accessToken) {
    redirect('/login');
  }

  const userProfile = await getUserProfile(session.user.accessToken);
  
  // Fetch reviews to ensure accurate rating if profile says 0
  let calculatedAverageRating = 0;
  let totalReviewCount = 0;

  try {
    const isAccountant = session.user.role === 'ACCOUNTANT';
    const reviewsEndpoint = isAccountant 
      ? `${process.env.NEXT_PUBLIC_API_URL}/accountant/get-all-reviews` 
      : `${process.env.NEXT_PUBLIC_API_URL}/admin/get-all-reviews`;
    
    const reviewsResponse = await fetch(reviewsEndpoint, {
      method: isAccountant ? 'GET' : 'GET', // Both are GET usually
      headers: {
        'Authorization': `Bearer ${session.user.accessToken}`,
      },
      cache: 'no-store',
    });

    const reviewsData = await reviewsResponse.json();
    if (reviewsData.success && Array.isArray(reviewsData.data)) {
      totalReviewCount = reviewsData.data.length;
      if (totalReviewCount > 0) {
        const sum = reviewsData.data.reduce((acc: number, rev: any) => acc + (rev.rating || 0), 0);
        calculatedAverageRating = sum / totalReviewCount;
      }
    }
  } catch (err) {
    console.error("Error fetching reviews for profile:", err);
  }

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Profile Not Found</h2>
          <p className="text-gray-600">Unable to load profile information.</p>
        </div>
      </div>
    );
  }

  // Transform data for components
  const profileData = {
    id: userProfile.id || 'USR-001',
    name: userProfile.name || 'Unknown User',
    email: userProfile.email || '',
    phone: userProfile.mobile || '',
    role: userProfile.role || 'Tax Professional',
    profilePhoto: userProfile.profilePhoto || '/images/logo/favicon.ico',
    license: userProfile.license || 'CPA-12345',
    specialization: userProfile.specialization || 'Individual & Corporate Tax Returns',
    experience: userProfile.experience || '5+ years',
    address: userProfile.address || '',
    bio: userProfile.bio || 'Experienced tax professional dedicated to providing excellent service.',
    joinedDate: userProfile.createdAt || '2020-01-01',
    certifications: userProfile.certifications || ['CPA', 'EA'],
    languages: userProfile.languages || ['English'],
    totalReviews: userProfile.totalReviews || totalReviewCount || 0,
    averageRating: userProfile.averageRating || calculatedAverageRating || 0,
    completedReturns: userProfile.completedReturns || 0,
    responseRate: userProfile.responseRate || 0,
  };

  return (
    <div className="space-y-8 lg:p-6">
      <ProfileHeader profileData={profileData} />

      <PerformanceMetrics profileData={profileData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PersonalInformation profileData={profileData} />
        <ProfessionalDetails profileData={profileData} />
      </div>

    </div>
  );
}
