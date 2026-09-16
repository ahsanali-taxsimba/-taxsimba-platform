import { User, Edit, Star } from 'lucide-react';
import Image from 'next/image';
import EditProfileButton from './EditProfileButton';

interface ProfileData {
  name: string;
  specialization: string;
  license: string;
  averageRating: number;
  totalReviews: number;
  profilePhoto: string;
}

interface ProfileHeaderProps {
  profileData: ProfileData;
}

export default function ProfileHeader({ profileData }: ProfileHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-[#37a267] to-[#37a267] rounded-xl p-3 lg:text-start text-center lg:p-8 text-white">
      <div className="flex items-center lg:justify-between justify-center flex-wrap lg:flex-nowrap gap-3">
        <div className="flex items-center lg:justify-start justify-center space-x-6 flex-wrap lg:flex-nowrap gap-3">
          <div className="w-24 h-24 min-w-24 bg-white rounded-full flex items-center justify-center overflow-hidden me-0">
            {profileData?.profilePhoto ? (
              <Image
                src={profileData.profilePhoto.startsWith('http')
                  ? profileData.profilePhoto
                  : `${process.env.NEXT_PUBLIC_API_URL}${profileData?.profilePhoto}`
                }
                alt={profileData.name}
                width={96}
                height={96}
                className="rounded-full object-cover"
              />
            ) : (
              <User className="h-12 w-12 text-blue-600" />
            )}
          </div>
          <div className='md:text-start sm:text-center'>
            <h2 className="text-3xl font-bold">{profileData.name}</h2>
            <p className="text-blue-100 text-lg mb-0">{profileData.specialization}</p>
                     <div className="flex items-center space-x-4 mt-2 lg:justify-start justify-center">
              <div className="flex items-center space-x-1">
                <Star className="w-5 h-5 text-yellow-300 fill-current" />
                <span className="font-bold text-xl">{profileData.averageRating.toFixed(2)}</span>
              </div>
              <div className="px-3 py-1.5 bg-white/10 rounded-lg border border-white/5">
                <span className="text-white font-medium">{profileData.totalReviews} reviews</span>
              </div>
            </div>
          </div>
        </div>
        <EditProfileButton profileData={profileData} />
      </div>
    </div>
  );
}