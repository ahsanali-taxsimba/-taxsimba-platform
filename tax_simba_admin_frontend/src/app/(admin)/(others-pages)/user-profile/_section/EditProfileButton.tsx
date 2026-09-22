"use client";

import { useState } from 'react';
import { Edit } from 'lucide-react';
import ProfileEditModal from './ProfileEditModal';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import clientAxios from '@/lib/axios-client';
import { toast } from 'react-toastify';

function isValidStaffPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return true; // optional clear/omit
  if (trimmed.length > 20) return false;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  return /^[+]?[\d\s().-]{7,20}$/.test(trimmed);
}

export default function EditProfileButton({ profileData }: { profileData?: any }) {
  const { data: session, update } = useSession();
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  const handleSave = async (formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    bio: string;
    specialization: string;
    experience: string;
    profilePhoto?: File | null;
  }) => {
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();

    if (!isValidStaffPhone(formData.phone)) {
      toast.error("Enter a valid phone number (7–15 digits, max 20 characters).");
      throw new Error("Invalid phone");
    }

    // Multipart when a new profile image is selected; otherwise JSON (express.json path).
    try {
      const hasPhoto = Boolean(formData.profilePhoto);
      let response;
      if (hasPhoto) {
        const multipart = new FormData();
        multipart.append("name", fullName);
        multipart.append("mobile", formData.phone.trim());
        multipart.append("phone", formData.phone.trim());
        multipart.append("address", formData.address.trim());
        multipart.append("profilePhoto", formData.profilePhoto as File);
        response = await clientAxios.put("/auth/update-account-settings", multipart, true);
      } else {
        const payload: Record<string, string> = {
          name: fullName,
          mobile: formData.phone.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
        };
        response = await clientAxios.put("/auth/update-account-settings", payload, true);
      }

      if (!response?.data?.success) {
        throw new Error(response?.data?.message || "Profile update failed");
      }

      const updatedUser = response.data.data;

      const photoUrl = updatedUser?.profilePhoto
        ? updatedUser.profilePhoto
        : session?.user?.image;

      await update({
        ...session,
        user: {
          ...session?.user,
          name: updatedUser?.name || fullName,
          email: formData.email,
          mobile: updatedUser?.mobile ?? updatedUser?.phone ?? formData.phone,
          address: updatedUser?.address ?? formData.address,
          bio: formData.bio,
          specialization: formData.specialization,
          experience: formData.experience,
          image: photoUrl,
          profilePhoto: photoUrl,
        },
      });

      toast.success("Profile updated successfully.");
      setShowModal(false);
      router.refresh();

    } catch (err: any) {
      console.error("Failed to update profile:", err);
      const message =
        err?.response?.data?.message ||
        (err?.response == null
          ? "Unable to reach the server. Please check your connection and try again."
          : "Failed to update profile. Please try again.");
      toast.error(
        typeof message === "string" && message.trim()
          ? message
          : "Failed to update profile. Please try again.",
      );
      throw err;
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-white text-[#37a267] px-6 py-3 border border-[#37a267] rounded-lg font-medium transition-colors"
      >
        <Edit className="w-4 h-4 inline mr-2" />
        Edit Profile
      </button>

      {showModal && (
        <ProfileEditModal
          isOpen={showModal}
          profileData={profileData}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}
