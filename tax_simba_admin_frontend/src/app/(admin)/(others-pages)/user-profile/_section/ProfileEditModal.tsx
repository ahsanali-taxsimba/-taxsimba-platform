"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import FileInput from "@/components/form/input/FileInput";
import Image from "next/image";

type ProfileEditModalProps = {
  profileData: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    bio: string;
    specialization: string;
    experience: string;
    profilePhoto?: File | null;
  }) => Promise<void>;
};

const ProfileEditModal = ({ profileData, isOpen, onClose, onSave }: ProfileEditModalProps) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    bio: "",
    specialization: "",
    experience: "",
  });
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (profileData) {
      const [firstName = "", lastName = ""] = profileData.name?.split(" ") || [];
      setFormData({
        firstName,
        lastName,
        email: profileData.email || "",
        phone: profileData.phone || profileData.mobile || "",
        address: profileData.address || "",
        bio: profileData.bio || "",
        specialization: profileData.specialization || "",
        experience: profileData.experience || "",
      });
      setImagePreview(profileData.profilePhoto || null);
    }
  }, [profileData]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await onSave({ ...formData, profilePhoto });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="w-full max-w-lg md:max-w-2xl lg:max-w-4xl 
             mx-4 max-h-[90vh] overflow-y-auto p-4 md:p-6 text-start"
    >
      <h3 className="text-xl font-semibold text-dark mb-6">Edit Profile</h3>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-start mt-4">
        {/* Profile Image Section */}
        <div className="col-span-1 lg:col-span-2 flex flex-col items-center justify-center space-y-4 pb-6 border-b">
          <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-gray-200">
            {imagePreview ? (
              <Image
                src={imagePreview.startsWith('data:') ? imagePreview : (imagePreview.startsWith('http') ? imagePreview : `${process.env.NEXT_PUBLIC_API_URL}${imagePreview}`)}
                alt="Profile Preview"
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
          </div>
          <div className="w-full max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1 text-center">Change Profile Photo</label>
            <FileInput onChange={handleImageChange} />
          </div>
        </div>

        {/* Personal Information */}
        <div className="space-y-4">
          <h5 className="font-medium text-dark">Personal Information</h5>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled
              className="w-full border border-gray-300 rounded-lg px-3 py-2 
          focus:ring-2 focus:ring-blue-500 focus:border-transparent 
          text-black
          disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>
        </div>

        {/* Professional Information */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 text-dark">Professional Information</h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
            <input
              type="text"
              name="specialization"
              value={formData.specialization}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
            <input
              type="text"
              name="experience"
              value={formData.experience}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Professional Bio</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2 flex justify-end gap-2 mt-8 pt-6 border-t font-bold">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-[#37a267] text-white rounded-lg hover:bg-[#37a267]/90 transition-colors disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ProfileEditModal;
