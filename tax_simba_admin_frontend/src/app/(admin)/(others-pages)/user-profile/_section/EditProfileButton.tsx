"use client";

import { useState } from 'react';
import { Edit } from 'lucide-react';
import ProfileEditModal from './ProfileEditModal';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import clientAxios from '@/lib/axios-client';

export default function EditProfileButton({ profileData }: { profileData?: any }) {
  const { data: session, update } = useSession();
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const userSessiondata = session?.user;

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

    const form = new FormData();
    form.append("name", fullName);
    form.append("mobile", formData.phone);

    if (formData.address) form.append("address", formData.address);
    if (formData.bio) form.append("bio", formData.bio);
    if (formData.specialization) form.append("specialization", formData.specialization);
    if (formData.experience) form.append("experience", formData.experience);
    if (formData.profilePhoto) form.append("profilePhoto", formData.profilePhoto);

    try {
      const response = await clientAxios.put(
        "/auth/update-account-settings",
        form,
        true,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const updatedUser = response.data.data;

      await update({
        ...session,
        user: {
          ...session?.user,
          name: fullName,
          email: formData.email,       
          mobile: formData.phone,
          address: formData.address,
          bio: formData.bio,
          specialization: formData.specialization,
          experience: formData.experience,
          image: updatedUser.profilePhoto,
        },
      });

      setShowModal(false);
      router.refresh();

    } catch (err) {
      console.error("Failed to update profile:", err);
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
