interface ProfessionalDetailsProps {
  profileData: {
    certifications: string[];
    languages: string[];
    experience: string;
    completedReturns: number;
    joinedDate: string;
  };
}

export default function ProfessionalDetails({ profileData }: ProfessionalDetailsProps) {
  return (
    <div className="space-y-6">
      {/* Certifications */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Certifications</h3>
        <div className="flex flex-wrap gap-2">
          {profileData.certifications.map((cert) => (
            <span key={cert} className="bg-green-50 text-[#37a267] px-3 py-1 rounded-full text-sm font-medium">
              {cert}
            </span>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Languages</h3>
        <div className="flex flex-wrap gap-2">
          {profileData.languages.map((lang) => (
            <span key={lang} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              {lang}
            </span>
          ))}
        </div>
      </div>

      {/* Experience Summary */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Experience Summary </h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Years of Experience</span>
            <span className="font-medium text-gray-900">{profileData.experience}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Completed Returns</span>
            <span className="font-medium text-gray-900">{profileData.completedReturns.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Member Since</span>
            <span className="font-medium text-gray-900">{new Date(profileData.joinedDate).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}