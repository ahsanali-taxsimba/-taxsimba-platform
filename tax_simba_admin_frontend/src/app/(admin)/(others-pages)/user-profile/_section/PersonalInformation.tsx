import { Mail, Phone } from 'lucide-react';

interface PersonalInformationProps {
  profileData: {
    name: string;
    license: string;
    email: string;
    phone: string;
    address: string;
    bio: string;
  };
}

export default function PersonalInformation({ profileData }: PersonalInformationProps) {
  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Personal Information</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <p className="text-gray-900">{profileData.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <p className="text-gray-900 mb-0">{profileData.phone}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <p className="text-gray-900 mb-0">{profileData.email}</p>
            </div>
          </div>
        
        </div>


        {profileData.address && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <p className="text-gray-900">{profileData.address}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Professional Bio</label>
          <p className="text-gray-700 leading-relaxed">{profileData.bio}</p>
        </div>
      </div>
    </div>
  );
}